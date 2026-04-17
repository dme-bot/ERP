const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// GET my tickets (user sees their own, admin sees all)
router.get('/', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(req.user.id);
  const isAdmin = user?.role === 'admin';
  let sql = `SELECT t.*, u.name as user_name, r.name as resolved_by_name FROM support_tickets t
    LEFT JOIN users u ON t.user_id=u.id LEFT JOIN users r ON t.resolved_by=r.id`;
  const params = [];
  if (!isAdmin) { sql += ' WHERE t.user_id=?'; params.push(req.user.id); }
  sql += ' ORDER BY t.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET stats (admin dashboard)
router.get('/stats', (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM support_tickets').get();
  const open = db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status='open'").get();
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status='in_progress'").get();
  const resolved = db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status='resolved'").get();
  const byCategory = db.prepare("SELECT category, COUNT(*) as count FROM support_tickets GROUP BY category").all();
  res.json({ total: total.c, open: open.c, inProgress: inProgress.c, resolved: resolved.c, byCategory });
});

// POST new ticket
router.post('/', (req, res) => {
  const { subject, description, category, priority, attachment_link, module } = req.body;
  if (!subject || !description) return res.status(400).json({ error: 'Subject and description required' });
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM support_tickets').get().c;
  const ticketNo = `TK-${String(count + 1001).padStart(5, '0')}`;
  const r = db.prepare('INSERT INTO support_tickets (ticket_no, user_id, subject, description, category, priority, attachment_link, module) VALUES (?,?,?,?,?,?,?,?)')
    .run(ticketNo, req.user.id, subject, description, category || 'bug', priority || 'medium', attachment_link, module);
  res.status(201).json({ id: r.lastInsertRowid, ticket_no: ticketNo });
});

// PUT update ticket (status, response)
router.put('/:id', (req, res) => {
  const { status, admin_response, priority } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(req.user.id);
  const isAdmin = user?.role === 'admin';
  if (!isAdmin && (status === 'resolved' || status === 'closed' || admin_response)) return res.status(403).json({ error: 'Only admin can resolve' });

  const resolvedBy = (status === 'resolved' || status === 'closed') ? req.user.id : null;
  const resolvedAt = (status === 'resolved' || status === 'closed') ? new Date().toISOString() : null;

  db.prepare('UPDATE support_tickets SET status=COALESCE(?,status), admin_response=COALESCE(?,admin_response), priority=COALESCE(?,priority), resolved_by=?, resolved_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status, admin_response, priority, resolvedBy, resolvedAt, req.params.id);
  res.json({ message: 'Updated' });
});

// DELETE (admin only)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(req.user.id);
  if (user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM support_tickets WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
