const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Approval workflow: who approves at each step based on category
const WORKFLOW = {
  'TA/DA': [
    { step: 1, name: 'HR Approval', approver_role: 'HR Manager' },
    { step: 2, name: 'Accounts Approval (Budget Check)', approver_role: 'Accountant' },
    { step: 3, name: 'MD/Director Approval', approver_role: 'Admin' },
  ],
  'Purchase': [
    { step: 1, name: 'Purchase Head Approval', approver_role: 'Purchase Manager' },
    { step: 2, name: 'Accounts Approval (Budget Check)', approver_role: 'Accountant' },
    { step: 3, name: 'MD/Director Approval', approver_role: 'Admin' },
  ],
  'Labour': [
    { step: 1, name: 'Site Engineer Approval', approver_role: 'Site Engineer' },
    { step: 2, name: 'Accounts Approval (Budget Check)', approver_role: 'Accountant' },
    { step: 3, name: 'MD/Director Approval', approver_role: 'Admin' },
  ],
  'Transport': [
    { step: 1, name: 'Purchase Dept Approval', approver_role: 'Purchase Manager' },
    { step: 2, name: 'Accounts Approval (Budget Check)', approver_role: 'Accountant' },
    { step: 3, name: 'MD/Director Approval', approver_role: 'Admin' },
  ],
};

// Check if current user can approve this step
function canUserApproveStep(db, userId, category, step) {
  const workflow = WORKFLOW[category];
  if (!workflow) return false;
  const stepInfo = workflow.find(w => w.step === step);
  if (!stepInfo) return false;

  // Admin can approve any step
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(userId);
  if (user?.role === 'admin') return true;

  // Check if user has the required role
  const userRoles = db.prepare(`SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=?`).all(userId);
  return userRoles.some(r => r.name === stepInfo.approver_role);
}

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

// GET my pending approvals (for current user's role)
router.get('/my-approvals', requirePermission('payment_required', 'view'), (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  // Get user's roles
  const user = db.prepare('SELECT role FROM users WHERE id=?').get(userId);
  const userRoles = db.prepare(`SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=?`).all(userId);
  const roleNames = userRoles.map(r => r.name);
  if (user?.role === 'admin') roleNames.push('Admin');

  // Find which categories and steps this user can approve
  const pendingRequests = [];
  const allPending = db.prepare(`SELECT pr.*, u.name as created_by_name FROM payment_requests pr
    LEFT JOIN users u ON pr.created_by=u.id WHERE pr.status NOT IN ('final_approved','rejected') ORDER BY pr.created_at DESC`).all();

  for (const req of allPending) {
    const workflow = WORKFLOW[req.category];
    if (!workflow) continue;
    const stepInfo = workflow.find(w => w.step === req.current_step);
    if (!stepInfo) continue;

    // Check if this user's role matches the required approver
    if (user?.role === 'admin' || roleNames.includes(stepInfo.approver_role)) {
      pendingRequests.push({ ...req, step_name: stepInfo.name, approver_role: stepInfo.approver_role });
    }
  }
  res.json(pendingRequests);
});

// GET dashboard stats
router.get('/stats', requirePermission('payment_required', 'view'), (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const total = db.prepare('SELECT COUNT(*) as c FROM payment_requests').get();
  const totalAmount = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM payment_requests').get();
  const pending = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status NOT IN ('final_approved','rejected')").get();
  const approved = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status='final_approved'").get();
  const rejected = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status='rejected'").get();
  const byCategory = db.prepare("SELECT category, COUNT(*) as count, COALESCE(SUM(amount),0) as amount FROM payment_requests GROUP BY category").all();
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM payment_requests GROUP BY status").all();
  res.json({ total: total.c, totalAmount: totalAmount.t, pending: pending.c, approved: approved.c, rejected: rejected.c, byCategory, byStatus });
});

// GET single request with approval trail
router.get('/:id', requirePermission('payment_required', 'view'), (req, res) => {
  const db = getDb();
  const request = db.prepare(`SELECT pr.*, u.name as created_by_name, s.name as site_display FROM payment_requests pr
    LEFT JOIN users u ON pr.created_by=u.id LEFT JOIN sites s ON pr.site_id=s.id WHERE pr.id=?`).get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  request.approvals = db.prepare(`SELECT pa.*, u.name as approved_by_name FROM payment_approvals pa
    LEFT JOIN users u ON pa.approved_by=u.id WHERE pa.request_id=? ORDER BY pa.step`).all(req.params.id);
  // Add workflow info
  request.workflow = WORKFLOW[request.category] || [];
  // Check if current user can approve current step
  request.can_approve_current = canUserApproveStep(db, req.user.id, request.category, request.current_step);
  res.json(request);
});

// POST create new request
router.post('/', requirePermission('payment_required', 'create'), (req, res) => {
  const b = req.body;
  if (!b.employee_name || !b.category || !b.amount || !b.purpose) {
    return res.status(400).json({ error: 'Employee name, category, amount, and purpose are required' });
  }
  if (!WORKFLOW[b.category]) return res.status(400).json({ error: 'Invalid category' });
  const db = getDb();
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
  res.status(201).json({ id: r.lastInsertRowid, request_no: requestNo });
});

// PUT approve current step (only if user has correct role)
router.put('/:id/approve', requirePermission('payment_required', 'approve'), (req, res) => {
  const { remarks } = req.body;
  if (!remarks || remarks.trim().length < 5) {
    return res.status(400).json({ error: 'Approval reason is required (minimum 5 characters)' });
  }
  const db = getDb();
  const request = db.prepare('SELECT * FROM payment_requests WHERE id=?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (request.status === 'final_approved' || request.status === 'rejected') {
    return res.status(400).json({ error: 'Request already ' + request.status });
  }

  // Check if this user can approve this step
  if (!canUserApproveStep(db, req.user.id, request.category, request.current_step)) {
    return res.status(403).json({ error: 'You are not authorized to approve this step. This step requires: ' + (WORKFLOW[request.category]?.find(w => w.step === request.current_step)?.approver_role || 'unknown') });
  }

  const workflow = WORKFLOW[request.category];
  const currentStep = request.current_step;
  const stepInfo = workflow.find(w => w.step === currentStep);

  // Record approval
  db.prepare('INSERT INTO payment_approvals (request_id, step, step_name, action, remarks, approved_by) VALUES (?,?,?,?,?,?)')
    .run(request.id, currentStep, stepInfo.name, 'approved', remarks, req.user.id);

  // Move to next step or final approve
  const nextStep = currentStep + 1;
  const hasNextStep = workflow.find(w => w.step === nextStep);
  let newStatus = '';

  if (hasNextStep) {
    newStatus = `step${currentStep}_approved`;
    db.prepare('UPDATE payment_requests SET current_step=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(nextStep, newStatus, request.id);
  } else {
    // Final step approved
    newStatus = 'final_approved';
    db.prepare('UPDATE payment_requests SET current_step=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(currentStep, newStatus, request.id);

    // Add to cash flow as outflow
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
      const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='inflow'").get(daily.id);
      const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='outflow'").get(daily.id);
      const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id=?').get(daily.id);
      db.prepare('UPDATE cash_flow_daily SET total_inflows=?, total_outflows=?, closing_balance=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(inflows.t, outflows.t, (opening?.opening_balance || 0) + inflows.t - outflows.t, daily.id);
    } catch (e) {}
  }

  res.json({ message: `${stepInfo.name} - Approved`, nextStep: hasNextStep ? nextStep : null, status: newStatus });
});

// PUT reject (only if user has correct role for current step)
router.put('/:id/reject', requirePermission('payment_required', 'approve'), (req, res) => {
  const { remarks } = req.body;
  if (!remarks || remarks.trim().length < 5) {
    return res.status(400).json({ error: 'Rejection reason is required (minimum 5 characters)' });
  }
  const db = getDb();
  const request = db.prepare('SELECT * FROM payment_requests WHERE id=?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Not found' });

  if (!canUserApproveStep(db, req.user.id, request.category, request.current_step)) {
    return res.status(403).json({ error: 'You are not authorized to reject at this step' });
  }

  const stepInfo = WORKFLOW[request.category]?.find(w => w.step === request.current_step);
  db.prepare('INSERT INTO payment_approvals (request_id, step, step_name, action, remarks, approved_by) VALUES (?,?,?,?,?,?)')
    .run(request.id, request.current_step, stepInfo?.name || 'Unknown', 'rejected', remarks, req.user.id);
  db.prepare('UPDATE payment_requests SET status=?, rejection_remarks=?, rejected_by=?, rejected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run('rejected', remarks, req.user.id, request.id);
  res.json({ message: `Rejected at ${stepInfo?.name}` });
});

// DELETE
router.delete('/:id', requirePermission('payment_required', 'delete'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM payment_approvals WHERE request_id=?').run(req.params.id);
  db.prepare('DELETE FROM payment_requests WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
