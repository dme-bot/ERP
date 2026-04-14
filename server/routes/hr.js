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

router.get('/candidates/stats', (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM candidates').get();
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM candidates GROUP BY status').all();
  const bySource = db.prepare('SELECT source, COUNT(*) as count FROM candidates GROUP BY source').all();
  res.json({ total: total.count, byStatus, bySource });
});

// Employees
router.get('/employees', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM employees ORDER BY name').all());
});

router.post('/employees', (req, res) => {
  const { name, phone, email, designation, department, join_date, salary } = req.body;
  const r = getDb().prepare('INSERT INTO employees (name,phone,email,designation,department,join_date,salary) VALUES (?,?,?,?,?,?,?)')
    .run(name, phone, email, designation, department, join_date, salary);
  res.status(201).json({ id: r.lastInsertRowid });
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
  const { name, phone, email, designation, department, salary, status } = req.body;
  getDb().prepare('UPDATE employees SET name=?,phone=?,email=?,designation=?,department=?,salary=?,status=? WHERE id=?')
    .run(name, phone, email, designation, department, salary, status, req.params.id);
  res.json({ message: 'Updated' });
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

module.exports = router;
