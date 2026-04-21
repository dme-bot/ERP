const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// List delegations. By default, a user sees tasks assigned TO them and tasks
// they have assigned. Admins see everything. Query params: ?scope=mine|given|all
// and ?status=pending|submitted|approved|rejected.
router.get('/', (req, res) => {
  const db = getDb();
  const isAdmin = req.user.role === 'admin';
  const uid = req.user.id;
  const { scope = 'mine', status } = req.query;

  const where = [];
  const params = [];
  if (isAdmin && scope === 'all') {
    // no filter
  } else if (scope === 'given') {
    where.push('d.assigned_by = ?'); params.push(uid);
  } else if (scope === 'mine') {
    where.push('d.assigned_to = ?'); params.push(uid);
  } else {
    where.push('(d.assigned_to = ? OR d.assigned_by = ?)'); params.push(uid, uid);
  }
  if (status) { where.push('d.status = ?'); params.push(status); }

  const sql = `SELECT d.*,
      au.name as assigned_by_name,
      tu.name as assigned_to_name,
      rv.name as reviewer_name
    FROM delegations d
    LEFT JOIN users au ON au.id = d.assigned_by
    LEFT JOIN users tu ON tu.id = d.assigned_to
    LEFT JOIN users rv ON rv.id = d.reviewer_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      CASE d.status WHEN 'rejected' THEN 0 WHEN 'pending' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END,
      COALESCE(d.due_date, '9999-12-31') ASC,
      d.created_at DESC`;
  res.json(db.prepare(sql).all(...params));
});

// Create a new delegation. Anyone can create; assigned_by = logged-in user.
router.post('/', (req, res) => {
  const { title, description, assigned_to, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!assigned_to) return res.status(400).json({ error: 'Assignee is required' });
  const db = getDb();
  const r = db.prepare(
    `INSERT INTO delegations (title, description, assigned_by, assigned_to, due_date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(title.trim(), description || '', req.user.id, assigned_to, due_date || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Assignee submits proof. Moves status from pending/rejected → submitted.
router.post('/:id/submit', (req, res) => {
  const { proof_url } = req.body;
  const db = getDb();
  const d = db.prepare('SELECT * FROM delegations WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Task not found' });
  if (d.assigned_to !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the assignee can submit proof' });
  }
  if (!proof_url) return res.status(400).json({ error: 'Proof file is required' });
  db.prepare(
    `UPDATE delegations SET status='submitted', proof_url=?, submitted_at=CURRENT_TIMESTAMP, reject_reason=NULL WHERE id=?`
  ).run(proof_url, req.params.id);
  res.json({ message: 'Proof submitted, awaiting approval' });
});

// Assigner (or admin) approves a submitted task.
router.post('/:id/approve', (req, res) => {
  const db = getDb();
  const d = db.prepare('SELECT * FROM delegations WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Task not found' });
  if (d.assigned_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the assigner can approve' });
  }
  if (d.status !== 'submitted') return res.status(400).json({ error: 'Task is not awaiting approval' });
  db.prepare(
    `UPDATE delegations SET status='approved', reviewed_at=CURRENT_TIMESTAMP, reviewer_id=? WHERE id=?`
  ).run(req.user.id, req.params.id);
  res.json({ message: 'Task approved' });
});

// Assigner (or admin) rejects with a reason. Task returns to the assignee's
// dashboard as "pending with reject reason" so they can redo and resubmit.
router.post('/:id/reject', (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'Rejection reason is required' });
  const db = getDb();
  const d = db.prepare('SELECT * FROM delegations WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Task not found' });
  if (d.assigned_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the assigner can reject' });
  }
  db.prepare(
    `UPDATE delegations SET status='rejected', reject_reason=?, reviewed_at=CURRENT_TIMESTAMP, reviewer_id=? WHERE id=?`
  ).run(reason.trim(), req.user.id, req.params.id);
  res.json({ message: 'Task rejected, assignee notified' });
});

// Delete a delegation — only the assigner or an admin.
router.delete('/:id', (req, res) => {
  const db = getDb();
  const d = db.prepare('SELECT assigned_by FROM delegations WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Task not found' });
  if (d.assigned_by !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the assigner can delete' });
  }
  db.prepare('DELETE FROM delegations WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Dashboard stats for the current user — minimal payload for the homepage widgets.
router.get('/stats', (req, res) => {
  const db = getDb();
  const uid = req.user.id;
  const pending_mine = db.prepare(
    `SELECT COUNT(*) as c FROM delegations WHERE assigned_to=? AND status IN ('pending','rejected')`
  ).get(uid).c;
  const awaiting_approval = db.prepare(
    `SELECT COUNT(*) as c FROM delegations WHERE assigned_by=? AND status='submitted'`
  ).get(uid).c;
  const rejected_mine = db.prepare(
    `SELECT COUNT(*) as c FROM delegations WHERE assigned_to=? AND status='rejected'`
  ).get(uid).c;
  res.json({ pending_mine, awaiting_approval, rejected_mine });
});

module.exports = router;
