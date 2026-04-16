const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Helper: calculate distance between 2 GPS points (meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET today's attendance for current user
router.get('/my-today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const record = getDb().prepare('SELECT * FROM attendance WHERE user_id=? AND date=?').get(req.user.id, today);
  res.json(record || null);
});

// GET attendance list (admin view) with filters
router.get('/', requirePermission('attendance', 'view'), (req, res) => {
  const { date, user_id, status, date_from, date_to } = req.query;
  let sql = `SELECT a.*, u.name as user_name, u.department, u.phone FROM attendance a LEFT JOIN users u ON a.user_id=u.id WHERE 1=1`;
  const params = [];
  if (date) { sql += ' AND a.date=?'; params.push(date); }
  if (user_id) { sql += ' AND a.user_id=?'; params.push(user_id); }
  if (status) { sql += ' AND a.status=?'; params.push(status); }
  if (date_from) { sql += ' AND a.date >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND a.date <= ?'; params.push(date_to); }
  sql += ' ORDER BY a.date DESC, a.punch_in_time DESC';
  res.json(getDb().prepare(sql).all(...params));
});

// GET admin dashboard stats
router.get('/dashboard', requirePermission('attendance', 'view'), (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE active=1").get();
  const presentToday = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM attendance WHERE date=? AND punch_in_time IS NOT NULL").get(today);
  const absentToday = totalUsers.c - presentToday.c;
  const lateToday = db.prepare("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='late'").get(today);
  const onLeave = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='approved' AND from_date <= ? AND to_date >= ?").get(today, today);

  const todayRecords = db.prepare(`SELECT a.*, u.name as user_name, u.department FROM attendance a
    LEFT JOIN users u ON a.user_id=u.id WHERE a.date=? ORDER BY a.punch_in_time DESC`).all(today);

  // Users who haven't punched in
  const punchedUserIds = todayRecords.map(r => r.user_id);
  const notPunched = db.prepare(`SELECT id, name, department, phone FROM users WHERE active=1 ${punchedUserIds.length > 0 ? 'AND id NOT IN (' + punchedUserIds.join(',') + ')' : ''}`).all();

  // Geofence settings
  const geofences = db.prepare('SELECT * FROM geofence_settings WHERE active=1').all();

  res.json({
    totalUsers: totalUsers.c, present: presentToday.c, absent: absentToday, late: lateToday.c, onLeave: onLeave.c,
    todayRecords, notPunched, geofences
  });
});

// PUNCH IN
router.post('/punch-in', (req, res) => {
  const { latitude, longitude, address, photo, site_name } = req.body;
  if (!latitude || !longitude) return res.status(400).json({ error: 'Location required. Please enable GPS.' });

  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Check if already punched in today
  const existing = db.prepare('SELECT id FROM attendance WHERE user_id=? AND date=?').get(req.user.id, today);
  if (existing) return res.status(400).json({ error: 'Already punched in today' });

  // Check geofence
  const geofences = db.prepare('SELECT * FROM geofence_settings WHERE active=1').all();
  let insideGeofence = geofences.length === 0; // If no geofences, allow everywhere
  let matchedSite = site_name || '';
  for (const gf of geofences) {
    const dist = haversine(latitude, longitude, gf.latitude, gf.longitude);
    if (dist <= gf.radius_meters) {
      insideGeofence = true;
      matchedSite = gf.site_name || matchedSite;
      break;
    }
  }

  if (!insideGeofence && geofences.length > 0) {
    return res.status(400).json({ error: 'You are outside the allowed geofence area. Please go to your assigned site.' });
  }

  // Check if late (after 9:30 AM)
  const hours = new Date().getHours();
  const mins = new Date().getMinutes();
  const isLate = hours > 9 || (hours === 9 && mins > 30);

  const r = db.prepare(`INSERT INTO attendance (user_id, date, punch_in_time, punch_in_lat, punch_in_lng, punch_in_address, punch_in_photo, site_name, status)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(req.user.id, today, now, latitude, longitude, address, photo, matchedSite, isLate ? 'late' : 'present');

  res.status(201).json({ id: r.lastInsertRowid, message: isLate ? 'Punched In (Late)' : 'Punched In', site: matchedSite, isLate });
});

// PUNCH OUT
router.post('/punch-out', (req, res) => {
  const { latitude, longitude, address, photo } = req.body;
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const record = db.prepare('SELECT * FROM attendance WHERE user_id=? AND date=?').get(req.user.id, today);
  if (!record) return res.status(400).json({ error: 'You have not punched in today' });
  if (record.punch_out_time) return res.status(400).json({ error: 'Already punched out today' });

  // Calculate total hours
  const punchIn = new Date(record.punch_in_time);
  const punchOut = new Date(now);
  const totalHours = Math.round((punchOut - punchIn) / (1000 * 60 * 60) * 100) / 100;
  const status = totalHours < 4 ? 'half_day' : record.status;

  db.prepare(`UPDATE attendance SET punch_out_time=?, punch_out_lat=?, punch_out_lng=?, punch_out_address=?, punch_out_photo=?, total_hours=?, status=? WHERE id=?`)
    .run(now, latitude, longitude, address, photo, totalHours, status, record.id);

  res.json({ message: `Punched Out. Total: ${totalHours} hours`, totalHours });
});

// GET geofence settings
router.get('/geofence', requirePermission('attendance', 'view'), (req, res) => {
  res.json(getDb().prepare('SELECT * FROM geofence_settings ORDER BY site_name').all());
});

// POST add geofence
router.post('/geofence', requirePermission('attendance', 'create'), (req, res) => {
  const { site_name, latitude, longitude, radius_meters } = req.body;
  if (!latitude || !longitude || !site_name) return res.status(400).json({ error: 'Site name and location required' });
  const r = getDb().prepare('INSERT INTO geofence_settings (site_name, latitude, longitude, radius_meters) VALUES (?,?,?,?)')
    .run(site_name, latitude, longitude, radius_meters || 200);
  res.status(201).json({ id: r.lastInsertRowid });
});

// DELETE geofence
router.delete('/geofence/:id', requirePermission('attendance', 'delete'), (req, res) => {
  getDb().prepare('DELETE FROM geofence_settings WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// GET monthly report
router.get('/report', requirePermission('attendance', 'view'), (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = `${y}-${String(m).padStart(2, '0')}-31`;

  const report = getDb().prepare(`SELECT u.id as user_id, u.name, u.department,
    COUNT(CASE WHEN a.status='present' THEN 1 END) as present_days,
    COUNT(CASE WHEN a.status='late' THEN 1 END) as late_days,
    COUNT(CASE WHEN a.status='half_day' THEN 1 END) as half_days,
    COUNT(CASE WHEN a.status='absent' THEN 1 END) as absent_days,
    ROUND(AVG(a.total_hours),1) as avg_hours
    FROM users u LEFT JOIN attendance a ON u.id=a.user_id AND a.date BETWEEN ? AND ?
    WHERE u.active=1 GROUP BY u.id ORDER BY u.name`).all(startDate, endDate);

  res.json(report);
});

// Leave requests
router.post('/leave', (req, res) => {
  const { leave_type, from_date, to_date, reason } = req.body;
  if (!from_date || !to_date) return res.status(400).json({ error: 'Dates required' });
  const days = Math.ceil((new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24)) + 1;
  const r = getDb().prepare('INSERT INTO leave_requests (user_id, leave_type, from_date, to_date, days, reason) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, leave_type || 'casual', from_date, to_date, days, reason);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.get('/leaves', requirePermission('attendance', 'view'), (req, res) => {
  res.json(getDb().prepare(`SELECT lr.*, u.name as user_name FROM leave_requests lr LEFT JOIN users u ON lr.user_id=u.id ORDER BY lr.created_at DESC`).all());
});

router.put('/leave/:id/approve', requirePermission('attendance', 'approve'), (req, res) => {
  const { status, remarks } = req.body;
  getDb().prepare('UPDATE leave_requests SET status=?, approved_by=?, remarks=? WHERE id=?')
    .run(status, req.user.id, remarks, req.params.id);
  res.json({ message: `Leave ${status}` });
});

module.exports = router;
