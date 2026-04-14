const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// ===== SITES =====
router.get('/sites', (req, res) => {
  res.json(getDb().prepare(`SELECT s.*, u.name as engineer_name, bb.lead_no FROM sites s
    LEFT JOIN users u ON s.site_engineer_id=u.id
    LEFT JOIN business_book bb ON s.business_book_id=bb.id ORDER BY s.name`).all());
});

router.post('/sites', (req, res) => {
  const { name, address, client_name, po_id, site_engineer_id, supervisor } = req.body;
  const r = getDb().prepare('INSERT INTO sites (name, address, client_name, po_id, site_engineer_id, supervisor) VALUES (?,?,?,?,?,?)')
    .run(name, address, client_name, po_id, site_engineer_id, supervisor);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/sites/:id', (req, res) => {
  const { name, address, client_name, site_engineer_id, supervisor, status } = req.body;
  getDb().prepare('UPDATE sites SET name=?, address=?, client_name=?, site_engineer_id=?, supervisor=?, status=? WHERE id=?')
    .run(name, address, client_name, site_engineer_id, supervisor, status, req.params.id);
  res.json({ message: 'Updated' });
});

// Get PO items for a site
router.get('/sites/:site_id/po-items', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT po_id, business_book_id FROM sites WHERE id=?').get(req.params.site_id);
  if (!site) return res.json([]);
  if (site.business_book_id) {
    const items = db.prepare('SELECT * FROM po_items WHERE business_book_id=?').all(site.business_book_id);
    if (items.length > 0) return res.json(items);
  }
  res.json([]);
});

// ===== DPR =====
router.get('/', (req, res) => {
  const { site_id, date, status } = req.query;
  let sql = `SELECT d.*, s.name as site_name, u.name as submitted_by_name, au.name as approved_by_name
    FROM dpr d LEFT JOIN sites s ON d.site_id=s.id LEFT JOIN users u ON d.submitted_by=u.id LEFT JOIN users au ON d.approved_by=au.id WHERE 1=1`;
  const params = [];
  if (site_id) { sql += ' AND d.site_id=?'; params.push(site_id); }
  if (date) { sql += ' AND d.report_date=?'; params.push(date); }
  if (status) { sql += ' AND d.approval_status=?'; params.push(status); }
  sql += ' ORDER BY d.report_date DESC, s.name';
  res.json(getDb().prepare(sql).all(...params));
});

// Dashboard summary
router.get('/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const activeSites = db.prepare("SELECT COUNT(*) as c FROM sites WHERE status='active'").get();
  const todayDprs = db.prepare('SELECT COUNT(*) as c FROM dpr WHERE report_date=?').get(today);
  const pendingApproval = db.prepare("SELECT COUNT(*) as c FROM dpr WHERE approval_status='pending'").get();
  const billingReady = db.prepare('SELECT COUNT(*) as c FROM dpr WHERE billing_ready=1').get();
  const missingSites = db.prepare(`SELECT s.id, s.name, s.supervisor FROM sites s WHERE s.status='active'
    AND s.id NOT IN (SELECT site_id FROM dpr WHERE report_date=?)`).all(today);
  const variance = db.prepare(`SELECT d.report_date, s.name as site_name,
    COALESCE(AVG(w.variance_pct),0) as avg_variance
    FROM dpr d JOIN sites s ON d.site_id=s.id LEFT JOIN dpr_work_items w ON w.dpr_id=d.id
    WHERE d.report_date >= date('now','-7 days') GROUP BY d.id ORDER BY d.report_date DESC LIMIT 20`).all();
  res.json({ activeSites: activeSites.c, todaySubmissions: todayDprs.c, pendingApproval: pendingApproval.c, billingReady: billingReady.c, missingSites, recentVariance: variance });
});

// Submit MEPF DPR
router.post('/', (req, res) => {
  const { site_id, report_date, weather, overall_status, floor_zone, system_type,
    safety_toolbox_talk, safety_ppe_compliance, safety_incidents,
    next_day_plan, hindrances, remarks,
    work_items, manpower, materials, machinery } = req.body;

  if (!site_id || !report_date) return res.status(400).json({ error: 'Site and date required' });
  const db = getDb();

  const existing = db.prepare('SELECT id FROM dpr WHERE site_id=? AND report_date=?').get(site_id, report_date);
  if (existing) return res.status(409).json({ error: 'DPR already submitted for this site and date' });

  const r = db.prepare(`INSERT INTO dpr (site_id, report_date, submitted_by, submission_time, weather, overall_status,
    floor_zone, system_type, safety_toolbox_talk, safety_ppe_compliance, safety_incidents,
    next_day_plan, hindrances, remarks) VALUES (?,?,?,CURRENT_TIMESTAMP,?,?,?,?,?,?,?,?,?,?)`)
    .run(site_id, report_date, req.user.id, weather || 'clear', overall_status || 'on_track',
      floor_zone, system_type, safety_toolbox_talk ? 1 : 0, safety_ppe_compliance ? 1 : 0,
      safety_incidents, next_day_plan, hindrances, remarks);
  const dprId = r.lastInsertRowid;

  // Work items - installation progress from PO items
  const insertWork = db.prepare('INSERT INTO dpr_work_items (dpr_id, po_item_id, description, unit, floor_zone, boq_qty, rate, amount, planned_qty, actual_qty, cumulative_qty, variance_pct, remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const w of (work_items || [])) {
    if (!w.description && !w.po_item_id) continue;
    const qtyToday = w.qty_today || w.actual_qty || 0;
    const installRate = w.installation_rate || w.rate || 0;
    const amount = qtyToday * installRate;
    insertWork.run(dprId, w.po_item_id || null, w.description, w.unit, w.floor_zone,
      w.boq_qty || 0, installRate, amount,
      qtyToday, qtyToday, w.cumulative_qty || 0,
      0, w.remarks);
  }

  // Manpower by MEPF trade
  const insertMan = db.prepare('INSERT INTO dpr_manpower (dpr_id, trade, required, deployed, shortage) VALUES (?,?,?,?,?)');
  for (const m of (manpower || [])) {
    insertMan.run(dprId, m.trade, m.required || 0, m.deployed || 0, Math.max(0, (m.required || 0) - (m.deployed || 0)));
  }

  // Materials from PO items
  const insertMat = db.prepare('INSERT INTO dpr_material (dpr_id, po_item_id, material_name, unit, boq_qty, consumed_today, cumulative_consumed, balance_qty, remarks) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const mt of (materials || [])) {
    insertMat.run(dprId, mt.po_item_id || null, mt.material_name, mt.unit, mt.boq_qty || 0,
      mt.consumed_today || 0, mt.cumulative_consumed || 0, (mt.boq_qty || 0) - (mt.cumulative_consumed || 0), mt.remarks);
  }

  // Machinery/Tools
  const insertMach = db.prepare('INSERT INTO dpr_machinery (dpr_id, equipment, quantity, hours_used, condition, remarks) VALUES (?,?,?,?,?,?)');
  for (const mc of (machinery || [])) {
    if (mc.equipment) insertMach.run(dprId, mc.equipment, mc.quantity || 1, mc.hours_used || 0, mc.condition || 'working', mc.remarks);
  }

  res.status(201).json({ id: dprId, message: 'DPR submitted' });
});

// Get DPR details
router.get('/:id', (req, res) => {
  const db = getDb();
  const dpr = db.prepare(`SELECT d.*, s.name as site_name, s.client_name, u.name as submitted_by_name
    FROM dpr d LEFT JOIN sites s ON d.site_id=s.id LEFT JOIN users u ON d.submitted_by=u.id WHERE d.id=?`).get(req.params.id);
  if (!dpr) return res.status(404).json({ error: 'Not found' });
  dpr.work_items = db.prepare('SELECT * FROM dpr_work_items WHERE dpr_id=?').all(req.params.id);
  dpr.manpower = db.prepare('SELECT * FROM dpr_manpower WHERE dpr_id=?').all(req.params.id);
  dpr.materials = db.prepare('SELECT * FROM dpr_material WHERE dpr_id=?').all(req.params.id);
  dpr.machinery = db.prepare('SELECT * FROM dpr_machinery WHERE dpr_id=?').all(req.params.id);
  res.json(dpr);
});

// Approve/Reject DPR
router.put('/:id/approve', (req, res) => {
  const { approval_status, billing_ready } = req.body;
  const db = getDb();
  db.prepare('UPDATE dpr SET approval_status=?, billing_ready=?, approved_by=? WHERE id=?')
    .run(approval_status, billing_ready ? 1 : 0, req.user.id, req.params.id);
  if (billing_ready) {
    const dpr = db.prepare('SELECT d.*, s.client_name, s.name as site_name FROM dpr d JOIN sites s ON d.site_id=s.id WHERE d.id=?').get(req.params.id);
    if (dpr?.client_name) {
      const existing = db.prepare('SELECT id FROM receivables WHERE client_name=? AND project_name=? AND invoice_date=?').get(dpr.client_name, dpr.site_name, dpr.report_date);
      if (!existing) {
        db.prepare('INSERT OR IGNORE INTO receivables (client_name, project_name, invoice_date, invoice_amount, outstanding_amount, due_date, status, created_by) VALUES (?,?,?,0,0,?,?,?)')
          .run(dpr.client_name, dpr.site_name, dpr.report_date, dpr.report_date, 'green', req.user.id);
      }
    }
  }
  res.json({ message: `DPR ${approval_status}` });
});

// No DPR = no payment check
router.get('/payment-check/:site_id', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const dpr = db.prepare('SELECT id FROM dpr WHERE site_id=? AND report_date=?').get(req.params.site_id, today);
  res.json({ site_id: req.params.site_id, dpr_submitted: !!dpr, payment_allowed: !!dpr,
    message: dpr ? 'DPR submitted - payment can proceed' : 'NO DPR submitted today - payment NOT allowed' });
});

module.exports = router;
