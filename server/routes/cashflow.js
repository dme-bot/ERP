const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// ============= PROJECT FINANCIAL TRACKER =============

// GET all projects with financial data
router.get('/projects', requirePermission('cashflow', 'view'), (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Get all unique projects from business_book
  const projects = db.prepare(`SELECT bb.id, bb.lead_no, bb.company_name as project_name, bb.client_name,
    bb.employee_assigned as crm_person, bb.sale_amount_without_gst, bb.po_amount, bb.advance_received,
    bb.balance_amount, bb.category, bb.order_type, bb.committed_start_date, bb.committed_completion_date,
    bb.created_at, s.name as site_name
    FROM business_book bb
    LEFT JOIN sites s ON s.business_book_id=bb.id
    GROUP BY bb.company_name
    ORDER BY bb.company_name`).all();

  const result = projects.map((p, idx) => {
    // Amount received (from cash flow inflows for this client)
    const received = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE type='inflow' AND party_name LIKE ?").get(`%${p.client_name}%`);

    // Purchase value (from payment_requests approved for this site)
    const purchaseValue = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM payment_requests WHERE status='final_approved' AND site_name LIKE ?").get(`%${p.project_name}%`);

    // Total PO value for this company
    const totalPO = db.prepare("SELECT COALESCE(SUM(po.total_amount),0) as total FROM purchase_orders po JOIN business_book bb ON po.business_book_id=bb.id WHERE bb.company_name=?").get(p.project_name);

    // Cash velocity = received / purchase value (if purchase > 0)
    const amountReceived = received?.total || 0;
    const purchaseAmt = purchaseValue?.total || 0;
    const cashVelocity = purchaseAmt > 0 ? Math.round((amountReceived / purchaseAmt) * 100) / 100 : 0;

    // Days calculation
    const startDate = p.committed_start_date ? new Date(p.committed_start_date) : new Date(p.created_at);
    const completionDate = p.committed_completion_date ? new Date(p.committed_completion_date) : null;
    const todayDate = new Date(today);
    const completionDays = completionDate ? Math.ceil((completionDate - startDate) / (1000 * 60 * 60 * 24)) : 0;
    const daysSinceStart = Math.ceil((todayDate - startDate) / (1000 * 60 * 60 * 24));
    const paymentDays = daysSinceStart;
    const totalDays = completionDays + paymentDays;

    return {
      sr_no: idx + 1,
      id: p.id,
      project_name: p.project_name || p.client_name,
      crm_person: p.crm_person,
      category: p.category,
      sale_amount: p.sale_amount_without_gst || 0,
      po_amount: totalPO?.total || p.po_amount || 0,
      amount_received: amountReceived,
      milestone_name: '',
      aanchal_value: Math.round((amountReceived / 100000) * 100) / 100, // in lakhs
      purchase_value: purchaseAmt,
      cash_velocity: cashVelocity,
      live_date: today,
      payment_investment_days: 0,
      completion_days: completionDays,
      payment_days: paymentDays,
      total_days: totalDays,
      committed_start: p.committed_start_date,
      committed_completion: p.committed_completion_date,
    };
  });

  // Summary
  const totalSale = result.reduce((s, r) => s + r.sale_amount, 0);
  const totalReceived = result.reduce((s, r) => s + r.amount_received, 0);
  const totalPurchase = result.reduce((s, r) => s + r.purchase_value, 0);

  res.json({ projects: result, summary: { totalSale, totalReceived, totalPurchase, projectCount: result.length } });
});

// POST update project manual fields (milestone, aanchal value, payment days)
router.post('/projects/:id/update', requirePermission('cashflow', 'edit'), (req, res) => {
  const { amount_received, milestone_name, aanchal_value, payment_investment_days } = req.body;
  // Store in a separate table or update business_book
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO project_finance (business_book_id, amount_received, milestone_name, aanchal_value, payment_investment_days, updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)')
    .run(req.params.id, amount_received || 0, milestone_name, aanchal_value || 0, payment_investment_days || 0);
  res.json({ message: 'Updated' });
});

// ============= DAILY CASH FLOW (existing) =============

router.get('/daily', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM cash_flow_daily WHERE 1=1';
  const params = [];
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY date DESC';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/today', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  let daily = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(today);
  if (!daily) {
    const yesterday = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(today);
    const opening = yesterday?.closing_balance || 0;
    db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance) VALUES (?, ?, ?)').run(today, opening, opening);
    daily = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(today);
  }
  res.json(daily);
});

router.get('/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const todayData = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(today);
  const last7 = db.prepare('SELECT * FROM cash_flow_daily ORDER BY date DESC LIMIT 7').all();
  const monthStart = today.substring(0, 7) + '-01';
  const monthInflow = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE date >= ? AND type = 'inflow'").get(monthStart);
  const monthOutflow = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow_entries WHERE date >= ? AND type = 'outflow'").get(monthStart);
  res.json({
    today: todayData || { opening_balance: 0, total_inflows: 0, total_outflows: 0, closing_balance: 0 },
    last7Days: last7,
    monthlyInflow: monthInflow.total,
    monthlyOutflow: monthOutflow.total
  });
});

router.post('/entry', (req, res) => {
  const { date, type, category, description, amount, payment_mode, party_name } = req.body;
  if (!date || !type || !category || !description || !amount) return res.status(400).json({ error: 'All fields required' });
  const db = getDb();
  let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date = ?').get(date);
  if (!daily) {
    const prev = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(date);
    const r = db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance, created_by) VALUES (?, ?, ?, ?)').run(date, prev?.closing_balance || 0, prev?.closing_balance || 0, req.user.id);
    daily = { id: r.lastInsertRowid };
  }
  db.prepare('INSERT INTO cash_flow_entries (daily_id, date, type, category, description, amount, payment_mode, party_name, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(daily.id, date, type, category, description, amount, payment_mode, party_name, req.user.id);
  const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'inflow'").get(daily.id);
  const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'outflow'").get(daily.id);
  const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id = ?').get(daily.id);
  const closing = (opening?.opening_balance || 0) + inflows.t - outflows.t;
  db.prepare('UPDATE cash_flow_daily SET total_inflows = ?, total_outflows = ?, closing_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(inflows.t, outflows.t, closing, daily.id);
  res.status(201).json({ message: 'Entry added', closing_balance: closing });
});

router.get('/entries/:date', (req, res) => {
  res.json(getDb().prepare('SELECT e.*, u.name as created_by_name FROM cash_flow_entries e LEFT JOIN users u ON e.created_by=u.id WHERE e.date = ? ORDER BY e.created_at DESC').all(req.params.date));
});

router.delete('/entry/:id', (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM cash_flow_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM cash_flow_entries WHERE id = ?').run(req.params.id);
  const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'inflow'").get(entry.daily_id);
  const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id = ? AND type = 'outflow'").get(entry.daily_id);
  const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id = ?').get(entry.daily_id);
  db.prepare('UPDATE cash_flow_daily SET total_inflows = ?, total_outflows = ?, closing_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(inflows.t, outflows.t, (opening?.opening_balance || 0) + inflows.t - outflows.t, entry.daily_id);
  res.json({ message: 'Deleted' });
});

router.post('/opening-balance', (req, res) => {
  const { date, opening_balance } = req.body;
  const db = getDb();
  let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date = ?').get(date);
  if (daily) {
    db.prepare('UPDATE cash_flow_daily SET opening_balance = ? WHERE id = ?').run(opening_balance, daily.id);
  } else {
    db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance, created_by) VALUES (?, ?, ?, ?)').run(date, opening_balance, opening_balance, req.user.id);
  }
  daily = db.prepare('SELECT * FROM cash_flow_daily WHERE date = ?').get(date);
  const closing = opening_balance + (daily.total_inflows || 0) - (daily.total_outflows || 0);
  db.prepare('UPDATE cash_flow_daily SET closing_balance = ? WHERE date = ?').run(closing, date);
  res.json({ message: 'Set', closing_balance: closing });
});

module.exports = router;
