const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Get daily cash position for a date range
router.get('/daily', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM cash_flow_daily WHERE 1=1';
  const params = [];
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY date DESC';
  res.json(getDb().prepare(sql).all(...params));
});

// Get today's cash position
router.get('/today', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  let daily = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(today);

  if (!daily) {
    // Auto-create today with yesterday's closing as opening
    const yesterday = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(today);
    const opening = yesterday?.closing_balance || 0;
    db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance) VALUES (?, ?, ?)').run(today, opening, opening);
    daily = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(today);
  }

  // Get entries for today
  const entries = db.prepare('SELECT * FROM cash_flow_entries WHERE date = ? ORDER BY created_at DESC').all(today);

  // Get summary
  const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE date = ? AND type = 'inflow'").get(today);
  const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE date = ? AND type = 'outflow'").get(today);

  res.json({
    ...daily,
    entries,
    inflow_total: inflows.total,
    outflow_total: outflows.total
  });
});

// Get cash flow summary/dashboard
router.get('/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const todayData = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(today);

  // Last 7 days
  const last7 = db.prepare('SELECT * FROM cash_flow_daily ORDER BY date DESC LIMIT 7').all();

  // Category-wise breakdown for today
  const inflowByCategory = db.prepare("SELECT category, SUM(amount) as total FROM cash_flow_entries WHERE date = ? AND type = 'inflow' GROUP BY category").all(today);
  const outflowByCategory = db.prepare("SELECT category, SUM(amount) as total FROM cash_flow_entries WHERE date = ? AND type = 'outflow' GROUP BY category").all(today);

  // Monthly totals
  const monthStart = today.substring(0, 7) + '-01';
  const monthInflow = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE date >= ? AND type = 'inflow'").get(monthStart);
  const monthOutflow = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE date >= ? AND type = 'outflow'").get(monthStart);

  res.json({
    today: todayData || { opening_balance: 0, total_inflows: 0, total_outflows: 0, closing_balance: 0 },
    last7Days: last7,
    inflowByCategory,
    outflowByCategory,
    monthlyInflow: monthInflow.total,
    monthlyOutflow: monthOutflow.total
  });
});

// Add cash flow entry (inflow or outflow)
router.post('/entry', (req, res) => {
  const { date, type, category, description, amount, payment_mode, party_name, reference_type, reference_id } = req.body;
  if (!date || !type || !category || !description || !amount) {
    return res.status(400).json({ error: 'date, type, category, description, amount required' });
  }
  const db = getDb();

  // Ensure daily record exists
  let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date = ?').get(date);
  if (!daily) {
    const prev = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(date);
    const opening = prev?.closing_balance || 0;
    const r = db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance, created_by) VALUES (?, ?, ?, ?)').run(date, opening, opening, req.user.id);
    daily = { id: r.lastInsertRowid };
  }

  // Insert entry
  db.prepare('INSERT INTO cash_flow_entries (daily_id, date, type, category, description, amount, payment_mode, party_name, reference_type, reference_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(daily.id, date, type, category, description, amount, payment_mode, party_name, reference_type || null, reference_id || null, req.user.id);

  // Recalculate daily totals
  const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'inflow'").get(daily.id);
  const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'outflow'").get(daily.id);
  const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id = ?').get(daily.id);
  const closing = (opening?.opening_balance || 0) + inflows.t - outflows.t;

  db.prepare('UPDATE cash_flow_daily SET total_inflows = ?, total_outflows = ?, closing_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(inflows.t, outflows.t, closing, daily.id);

  res.status(201).json({ message: 'Entry added', closing_balance: closing });
});

// Get entries for a specific date
router.get('/entries/:date', (req, res) => {
  const entries = getDb().prepare('SELECT e.*, u.name as created_by_name FROM cash_flow_entries e LEFT JOIN users u ON e.created_by=u.id WHERE e.date = ? ORDER BY e.created_at DESC').all(req.params.date);
  res.json(entries);
});

// Delete entry
router.delete('/entry/:id', (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM cash_flow_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM cash_flow_entries WHERE id = ?').run(req.params.id);

  // Recalculate
  const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'inflow'").get(entry.daily_id);
  const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'outflow'").get(entry.daily_id);
  const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id = ?').get(entry.daily_id);
  const closing = (opening?.opening_balance || 0) + inflows.t - outflows.t;
  db.prepare('UPDATE cash_flow_daily SET total_inflows = ?, total_outflows = ?, closing_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(inflows.t, outflows.t, closing, entry.daily_id);

  res.json({ message: 'Deleted' });
});

// Set opening balance for a date
router.post('/opening-balance', (req, res) => {
  const { date, opening_balance } = req.body;
  const db = getDb();
  let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date = ?').get(date);
  if (daily) {
    db.prepare('UPDATE cash_flow_daily SET opening_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(opening_balance, daily.id);
  } else {
    db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance, created_by) VALUES (?, ?, ?, ?)').run(date, opening_balance, opening_balance, req.user.id);
  }
  // Recalculate closing
  daily = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(date);
  const closing = opening_balance + (daily.total_inflows || 0) - (daily.total_outflows || 0);
  db.prepare('UPDATE cash_flow_daily SET closing_balance = ? WHERE date = ?').run(closing, date);
  res.json({ message: 'Opening balance set', closing_balance: closing });
});

module.exports = router;
