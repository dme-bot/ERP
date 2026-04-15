const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Step names for approval workflow
const STEP_MAP = {
  'TA/DA': { step: 1, name: 'HR Approval' },
  'Purchase': { step: 1, name: 'Purchase Head Approval' },
  'Labour': { step: 1, name: 'Site Engineer Approval' },
  'Transport': { step: 1, name: 'Purchase Dept Approval' },
};
const STEPS = [
  { step: 1, name: 'Category Approval' },
  { step: 2, name: 'Accounts Approval (Budget Check)' },
  { step: 3, name: 'Dues Days Validation' },
  { step: 4, name: 'Velocity Check (Auto)' },
  { step: 5, name: 'Billing Engineer Final Approval' },
];

// GET all with filters
router.get('/', requirePermission('payment_required', 'view'), (req, res) => {
  const { status, category, search, site_id, date_from, date_to } = req.query;
  let sql = `SELECT pr.*, u.name as created_by_name, s.name as site_display FROM payment_requests pr
    LEFT JOIN users u ON pr.created_by=u.id LEFT JOIN sites s ON pr.site_id=s.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND pr.status=?'; params.push(status); }
  if (category) { sql += ' AND pr.category=?'; params.push(category); }
  if (site_id) { sql += ' AND pr.site_id=?'; params.push(site_id); }
  if (date_from) { sql += ' AND pr.created_at >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND pr.created_at <= ?'; params.push(date_to + ' 23:59:59'); }
  if (search) {
    sql += ' AND (pr.employee_name LIKE ? OR pr.request_no LIKE ? OR pr.purpose LIKE ? OR pr.site_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY pr.created_at DESC';
  res.json(getDb().prepare(sql).all(...params));
});

// GET dashboard stats
router.get('/stats', requirePermission('payment_required', 'view'), (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM payment_requests').get();
  const totalAmount = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payment_requests').get();
  const pending = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status NOT IN ('final_approved','rejected')").get();
  const approved = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status='final_approved'").get();
  const rejected = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status='rejected'").get();
  const byCategory = db.prepare("SELECT category, COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM payment_requests GROUP BY category").all();
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM payment_requests GROUP BY status").all();
  const pendingApprovals = db.prepare("SELECT pr.*, u.name as created_by_name FROM payment_requests pr LEFT JOIN users u ON pr.created_by=u.id WHERE pr.status NOT IN ('final_approved','rejected') ORDER BY pr.created_at DESC LIMIT 10").all();
  res.json({ total: total.c, totalAmount: totalAmount.t, pending: pending.c, approved: approved.c, rejected: rejected.c, byCategory, byStatus, pendingApprovals });
});

// GET single request with approval trail
router.get('/:id', requirePermission('payment_required', 'view'), (req, res) => {
  const db = getDb();
  const request = db.prepare(`SELECT pr.*, u.name as created_by_name, s.name as site_display FROM payment_requests pr
    LEFT JOIN users u ON pr.created_by=u.id LEFT JOIN sites s ON pr.site_id=s.id WHERE pr.id=?`).get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  request.approvals = db.prepare(`SELECT pa.*, u.name as approved_by_name FROM payment_approvals pa
    LEFT JOIN users u ON pa.approved_by=u.id WHERE pa.request_id=? ORDER BY pa.step`).all(req.params.id);
  res.json(request);
});

// POST create new request
router.post('/', requirePermission('payment_required', 'create'), (req, res) => {
  const b = req.body;
  if (!b.employee_name || !b.category || !b.amount || !b.purpose) {
    return res.status(400).json({ error: 'Employee name, category, amount, and purpose are required' });
  }
  const db = getDb();

  // Auto-generate request number
  const count = db.prepare('SELECT COUNT(*) as c FROM payment_requests').get().c;
  const requestNo = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const r = db.prepare(`INSERT INTO payment_requests (
    request_no, employee_name, site_id, site_name, department, contact_number, category, amount, purpose,
    payment_mode, required_by_date, attachment_link,
    travel_from_to, travel_dates, mode_of_travel, stay_details,
    indent_number, item_description, vendor_name, quotation_link,
    labour_type, number_of_workers, work_duration, site_engineer_name,
    vehicle_type, from_to_location, material_description, driver_vendor_name,
    created_by
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    requestNo, b.employee_name, b.site_id || null, b.site_name, b.department, b.contact_number,
    b.category, b.amount, b.purpose, b.payment_mode || 'Bank', b.required_by_date || null, b.attachment_link,
    b.travel_from_to, b.travel_dates, b.mode_of_travel, b.stay_details,
    b.indent_number, b.item_description, b.vendor_name, b.quotation_link,
    b.labour_type, b.number_of_workers || 0, b.work_duration, b.site_engineer_name,
    b.vehicle_type, b.from_to_location, b.material_description, b.driver_vendor_name,
    req.user.id
  );

  // Log to activity
  try {
    db.prepare('INSERT INTO activity_log (user_id, module, action, record_id, details) VALUES (?,?,?,?,?)')
      .run(req.user.id, 'payment_required', 'created', r.lastInsertRowid, JSON.stringify({ request_no: requestNo, category: b.category, amount: b.amount }));
  } catch (e) {}

  res.status(201).json({ id: r.lastInsertRowid, request_no: requestNo });
});

// PUT approve a step
router.put('/:id/approve', requirePermission('payment_required', 'approve'), (req, res) => {
  const { remarks } = req.body;
  const db = getDb();
  const request = db.prepare('SELECT * FROM payment_requests WHERE id=?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (request.status === 'final_approved' || request.status === 'rejected') {
    return res.status(400).json({ error: 'Request already ' + request.status });
  }

  const currentStep = request.current_step;
  const stepInfo = STEPS.find(s => s.step === currentStep) || { name: `Step ${currentStep}` };

  // For step 1, use category-specific name
  let stepName = stepInfo.name;
  if (currentStep === 1 && STEP_MAP[request.category]) {
    stepName = STEP_MAP[request.category].name;
  }

  // Record approval
  db.prepare('INSERT INTO payment_approvals (request_id, step, step_name, action, remarks, approved_by) VALUES (?,?,?,?,?,?)')
    .run(request.id, currentStep, stepName, 'approved', remarks, req.user.id);

  // Move to next step
  let nextStep = currentStep + 1;
  let newStatus = '';

  // Step 4 (Velocity Check) is auto-approved
  if (nextStep === 4) {
    db.prepare('INSERT INTO payment_approvals (request_id, step, step_name, action, remarks, approved_by) VALUES (?,?,?,?,?,?)')
      .run(request.id, 4, 'Velocity Check (Auto)', 'approved', 'Auto-approved by system', req.user.id);
    nextStep = 5;
  }

  if (currentStep === 1) newStatus = 'step1_approved';
  else if (currentStep === 2) newStatus = 'accounts_approved';
  else if (currentStep === 3) { newStatus = 'velocity_checked'; nextStep = 5; } // skip 4 (auto)
  else if (currentStep === 5) newStatus = 'final_approved';

  db.prepare('UPDATE payment_requests SET current_step=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(nextStep > 5 ? 5 : nextStep, newStatus, request.id);

  // If final approved, add to cash flow as outflow
  if (newStatus === 'final_approved') {
    try {
      const today = new Date().toISOString().split('T')[0];
      let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date=?').get(today);
      if (!daily) {
        const prev = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(today);
        const dr = db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance) VALUES (?,?,?)').run(today, prev?.closing_balance || 0, prev?.closing_balance || 0);
        daily = { id: dr.lastInsertRowid };
      }
      db.prepare('INSERT INTO cash_flow_entries (daily_id, date, type, category, description, amount, party_name, created_by) VALUES (?,?,?,?,?,?,?,?)')
        .run(daily.id, today, 'outflow', request.category, `Payment: ${request.request_no} - ${request.purpose}`, request.amount, request.employee_name, req.user.id);
      // Recalculate
      const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='inflow'").get(daily.id);
      const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='outflow'").get(daily.id);
      const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id=?').get(daily.id);
      db.prepare('UPDATE cash_flow_daily SET total_inflows=?, total_outflows=?, closing_balance=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(inflows.t, outflows.t, (opening?.opening_balance || 0) + inflows.t - outflows.t, daily.id);
    } catch (e) {}
  }

  // Log
  try {
    db.prepare('INSERT INTO activity_log (user_id, module, action, record_id, details) VALUES (?,?,?,?,?)')
      .run(req.user.id, 'payment_required', 'approved', request.id, JSON.stringify({ step: currentStep, stepName }));
  } catch (e) {}

  res.json({ message: `Step ${currentStep} (${stepName}) approved`, nextStep, status: newStatus });
});

// PUT reject
router.put('/:id/reject', requirePermission('payment_required', 'approve'), (req, res) => {
  const { remarks } = req.body;
  const db = getDb();
  const request = db.prepare('SELECT * FROM payment_requests WHERE id=?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });

  const currentStep = request.current_step;
  let stepName = STEPS.find(s => s.step === currentStep)?.name || `Step ${currentStep}`;
  if (currentStep === 1 && STEP_MAP[request.category]) stepName = STEP_MAP[request.category].name;

  db.prepare('INSERT INTO payment_approvals (request_id, step, step_name, action, remarks, approved_by) VALUES (?,?,?,?,?,?)')
    .run(request.id, currentStep, stepName, 'rejected', remarks, req.user.id);
  db.prepare('UPDATE payment_requests SET status=?, rejection_remarks=?, rejected_by=?, rejected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run('rejected', remarks, req.user.id, request.id);

  try {
    db.prepare('INSERT INTO activity_log (user_id, module, action, record_id, details) VALUES (?,?,?,?,?)')
      .run(req.user.id, 'payment_required', 'rejected', request.id, JSON.stringify({ step: currentStep, stepName, remarks }));
  } catch (e) {}

  res.json({ message: `Rejected at ${stepName}` });
});

// DELETE
router.delete('/:id', requirePermission('payment_required', 'delete'), (req, res) => {
  getDb().prepare('DELETE FROM payment_requests WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
