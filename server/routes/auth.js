const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/schema');
const { generateToken, authMiddleware, adminOnly, getUserPermissions } = require('../middleware/auth');
const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken(user);
  const permissions = getUserPermissions(user.id);
  const userRoles = db.prepare(`SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=?`).all(user.id);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone },
    permissions,
    userRoles: userRoles.map(r => r.name)
  });
});

router.post('/register', authMiddleware, adminOnly, (req, res) => {
  const { name, email, password, role, department, phone, role_ids } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const db = getDb();
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password, role, department, phone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, email, hash, role || 'user', department || null, phone || null);

    // Assign roles
    if (role_ids && role_ids.length > 0) {
      const insertUserRole = db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)');
      for (const rid of role_ids) insertUserRole.run(result.lastInsertRowid, rid);
    }

    const user = db.prepare('SELECT id, name, email, role, department, phone FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user, message: 'User created successfully' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, department, phone FROM users WHERE id = ?').get(req.user.id);
  const permissions = getUserPermissions(req.user.id);
  const userRoles = db.prepare(`SELECT r.name FROM roles r JOIN user_roles ur ON r.id=ur.role_id WHERE ur.user_id=?`).all(req.user.id);
  res.json({ ...user, permissions, userRoles: userRoles.map(r => r.name) });
});

router.get('/users', authMiddleware, (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department, u.phone, u.active, u.created_at,
    GROUP_CONCAT(r.name) as role_names
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    GROUP BY u.id ORDER BY u.name
  `).all();
  res.json(users);
});

// Update user (admin only)
router.put('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, email, department, phone, role, active, role_ids, password } = req.body;
  const db = getDb();

  let sql = 'UPDATE users SET name=?, email=?, department=?, phone=?, role=?, active=? WHERE id=?';
  let params = [name, email, department, phone, role, active ? 1 : 0, req.params.id];

  if (password) {
    sql = 'UPDATE users SET name=?, email=?, department=?, phone=?, role=?, active=?, password=? WHERE id=?';
    params = [name, email, department, phone, role, active ? 1 : 0, bcrypt.hashSync(password, 10), req.params.id];
  }

  db.prepare(sql).run(...params);

  // Update role assignments
  if (role_ids) {
    db.prepare('DELETE FROM user_roles WHERE user_id=?').run(req.params.id);
    const insertUserRole = db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)');
    for (const rid of role_ids) insertUserRole.run(req.params.id, rid);
  }

  res.json({ message: 'User updated' });
});

// Deactivate user (admin only)
router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  getDb().prepare('UPDATE users SET active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'User deactivated' });
});

// ===== ROLES & PERMISSIONS (Admin Only) =====

router.get('/roles', authMiddleware, (req, res) => {
  const db = getDb();
  const roles = db.prepare('SELECT * FROM roles ORDER BY name').all();
  res.json(roles);
});

router.post('/roles', authMiddleware, adminOnly, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name required' });
  try {
    const r = getDb().prepare('INSERT INTO roles (name, description) VALUES (?, ?)').run(name, description);
    res.status(201).json({ id: r.lastInsertRowid, message: 'Role created' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Role already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/roles/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, description } = req.body;
  getDb().prepare('UPDATE roles SET name=?, description=? WHERE id=?').run(name, description, req.params.id);
  res.json({ message: 'Role updated' });
});

router.delete('/roles/:id', authMiddleware, adminOnly, (req, res) => {
  const role = getDb().prepare('SELECT * FROM roles WHERE id=?').get(req.params.id);
  if (role?.is_system) return res.status(400).json({ error: 'Cannot delete system role' });
  getDb().prepare('DELETE FROM roles WHERE id=?').run(req.params.id);
  res.json({ message: 'Role deleted' });
});

// Get permissions for a specific role
router.get('/roles/:id/permissions', authMiddleware, (req, res) => {
  const perms = getDb().prepare('SELECT * FROM role_permissions WHERE role_id=?').all(req.params.id);
  res.json(perms);
});

// Set permissions for a role (bulk update)
router.put('/roles/:id/permissions', authMiddleware, adminOnly, (req, res) => {
  const { permissions } = req.body; // Array of { module, can_view, can_create, can_edit, can_delete, can_approve }
  const db = getDb();
  db.prepare('DELETE FROM role_permissions WHERE role_id=?').run(req.params.id);
  const insert = db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES (?,?,?,?,?,?,?)');
  for (const p of (permissions || [])) {
    insert.run(req.params.id, p.module, p.can_view ? 1 : 0, p.can_create ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0, p.can_approve ? 1 : 0);
  }
  res.json({ message: 'Permissions updated' });
});

// Get permissions for current user
router.get('/my-permissions', authMiddleware, (req, res) => {
  res.json(getUserPermissions(req.user.id));
});

module.exports = router;
