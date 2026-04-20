const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Candidates
router.get('/candidates', (req, res) => {
  const { status, source } = req.query;
  let sql = 'SELECT * FROM candidates WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (source) { sql += ' AND source=?'; params.push(source); }
  sql += ' ORDER BY created_at DESC';
  res.json(getDb().prepare(sql).all(...params));
});

router.post('/candidates', (req, res) => {
  const { name, phone, email, source, position, notes } = req.body;
  const r = getDb().prepare('INSERT INTO candidates (name,phone,email,source,position,notes) VALUES (?,?,?,?,?,?)')
    .run(name, phone, email, source, position, notes);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/candidates/:id', (req, res) => {
  const { name, phone, email, source, position, status, notes } = req.body;
  getDb().prepare('UPDATE candidates SET name=?,phone=?,email=?,source=?,position=?,status=?,notes=? WHERE id=?')
    .run(name, phone, email, source, position, status, notes, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/candidates/:id', (req, res) => {
  getDb().prepare('DELETE FROM candidates WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

router.get('/candidates/stats', (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM candidates').get();
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM candidates GROUP BY status').all();
  const bySource = db.prepare('SELECT source, COUNT(*) as count FROM candidates GROUP BY source').all();
  res.json({ total: total.count, byStatus, bySource });
});

// Employees — salary is confidential; strip it from the response unless the
// requester is an admin or on the HR team (by role name or department).
// JWT only carries { id, role, name, email }, so we look up HR role + dept
// from the DB on each request. The DPR staff-cost endpoint works independently
// via a server-side aggregate, so non-HR users never see individual figures
// even if they are site engineers.
const canSeeSalary = (userId, userRole) => {
  if (userRole === 'admin') return true;
  const db = getDb();
  const u = db.prepare('SELECT department FROM users WHERE id=?').get(userId);
  if (u?.department && String(u.department).toLowerCase().includes('hr')) return true;
  const roles = db.prepare(
    `SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=?`
  ).all(userId);
  return roles.some(r => String(r.name || '').toLowerCase().includes('hr'));
};

router.get('/employees', (req, res) => {
  const rows = getDb().prepare(
    `SELECT e.*, u.name as linked_user_name, u.username as linked_username
     FROM employees e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.name`
  ).all();
  if (canSeeSalary(req.user.id, req.user.role)) return res.json(rows);
  // Redact salary for everyone else
  res.json(rows.map(({ salary, ...rest }) => rest));
});

router.post('/employees', (req, res) => {
  const { name, phone, email, designation, department, join_date, salary } = req.body;
  let { user_id } = req.body;
  const db = getDb();
  // Auto-link by email if user_id wasn't explicitly set
  if (!user_id && email) {
    const u = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (u) user_id = u.id;
  }
  const r = db.prepare('INSERT INTO employees (user_id,name,phone,email,designation,department,join_date,salary) VALUES (?,?,?,?,?,?,?,?)')
    .run(user_id || null, name, phone, email, designation, department, join_date, salary);
  res.status(201).json({ id: r.lastInsertRowid, linked_user_id: user_id || null });
});

// Auto-link existing employees to users by matching email (case-insensitive).
// Safe to run any time — only fills rows where user_id IS NULL.
router.post('/employees/auto-link', (req, res) => {
  const db = getDb();
  const candidates = db.prepare(
    `SELECT e.id, u.id as user_id FROM employees e
     JOIN users u ON LOWER(u.email) = LOWER(e.email)
     WHERE e.user_id IS NULL AND e.email IS NOT NULL AND e.email != ''`
  ).all();
  const upd = db.prepare('UPDATE employees SET user_id = ? WHERE id = ?');
  let linked = 0;
  for (const c of candidates) { upd.run(c.user_id, c.id); linked++; }
  res.json({ linked, scanned: candidates.length });
});

// Bulk import employees
router.post('/employees/bulk', (req, res) => {
  const { employees } = req.body;
  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: 'No employee data provided' });
  }
  const db = getDb();
  const insert = db.prepare('INSERT INTO employees (name,phone,email,designation,department,join_date,salary) VALUES (?,?,?,?,?,?,?)');
  let added = 0, errors = [];
  for (let i = 0; i < employees.length; i++) {
    const e = employees[i];
    if (!e.name || !e.name.trim()) { errors.push(`Row ${i + 1}: Name is required`); continue; }
    try {
      insert.run(e.name?.trim(), e.phone?.trim() || '', e.email?.trim() || '', e.designation?.trim() || '', e.department?.trim() || '', e.join_date || '', e.salary || 0);
      added++;
    } catch (err) { errors.push(`Row ${i + 1}: ${err.message}`); }
  }
  res.json({ added, errors, total: employees.length });
});

router.put('/employees/:id', (req, res) => {
  const { name, phone, email, designation, department, salary, status, user_id } = req.body;
  getDb().prepare('UPDATE employees SET name=?,phone=?,email=?,designation=?,department=?,salary=?,status=?,user_id=? WHERE id=?')
    .run(name, phone, email, designation, department, salary, status, user_id || null, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/employees/:id', (req, res) => {
  getDb().prepare('DELETE FROM employees WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Sub-Contractors
router.get('/sub-contractors', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM sub_contractors ORDER BY name').all());
});

router.post('/sub-contractors', (req, res) => {
  const { name, phone, email, specialization, rate, rate_unit, notes } = req.body;
  const r = getDb().prepare('INSERT INTO sub_contractors (name,phone,email,specialization,rate,rate_unit,notes) VALUES (?,?,?,?,?,?,?)')
    .run(name, phone, email, specialization, rate, rate_unit, notes);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/sub-contractors/:id', (req, res) => {
  const { name, phone, email, specialization, rate, rate_unit, status, notes } = req.body;
  getDb().prepare('UPDATE sub_contractors SET name=?,phone=?,email=?,specialization=?,rate=?,rate_unit=?,status=?,notes=? WHERE id=?')
    .run(name, phone, email, specialization, rate, rate_unit, status, notes, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/sub-contractors/:id', (req, res) => {
  getDb().prepare('DELETE FROM sub_contractors WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Expenses
router.get('/expenses', (req, res) => {
  res.json(getDb().prepare(`SELECT e.*, u1.name as submitted_by_name, u2.name as approved_by_name FROM expenses e
    LEFT JOIN users u1 ON e.submitted_by=u1.id LEFT JOIN users u2 ON e.approved_by=u2.id ORDER BY e.created_at DESC`).all());
});

router.post('/expenses', (req, res) => {
  const { title, description, amount, category, expense_date } = req.body;
  const r = getDb().prepare('INSERT INTO expenses (title,description,amount,category,expense_date,submitted_by) VALUES (?,?,?,?,?,?)')
    .run(title, description, amount, category, expense_date, req.user.id);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/expenses/:id', (req, res) => {
  const { status } = req.body;
  const db = getDb();
  const updates = { status };
  if (status === 'approved') updates.approved_by = req.user.id;
  if (status === 'paid') updates.paid_date = new Date().toISOString().split('T')[0];
  db.prepare('UPDATE expenses SET status=?, approved_by=?, paid_date=? WHERE id=?')
    .run(updates.status, updates.approved_by || null, updates.paid_date || null, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/expenses/:id', (req, res) => {
  getDb().prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Checklists
router.get('/checklists', (req, res) => {
  res.json(getDb().prepare(`SELECT c.*, u1.name as assigned_to_name, u2.name as created_by_name FROM checklists c
    LEFT JOIN users u1 ON c.assigned_to=u1.id LEFT JOIN users u2 ON c.created_by=u2.id ORDER BY c.created_at DESC`).all());
});

router.post('/checklists', (req, res) => {
  const { title, description, frequency, due_date, assigned_to } = req.body;
  const r = getDb().prepare('INSERT INTO checklists (title,description,frequency,due_date,assigned_to,created_by) VALUES (?,?,?,?,?,?)')
    .run(title, description, frequency, due_date, assigned_to, req.user.id);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/checklists/:id', (req, res) => {
  const { status, title, description, frequency, due_date, assigned_to } = req.body;
  getDb().prepare('UPDATE checklists SET status=?,title=?,description=?,frequency=?,due_date=?,assigned_to=? WHERE id=?')
    .run(status, title, description, frequency, due_date, assigned_to, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/checklists/:id', (req, res) => {
  getDb().prepare('DELETE FROM checklists WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
