const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// ===== SITES =====
// Non-admins see only sites where they are assigned as a site engineer —
// either directly on the site row, or via a PO linked to that site whose
// site_engineer_ids CSV contains their user id.
router.get('/sites', (req, res) => {
  const db = getDb();
  const isAdmin = req.user.role === 'admin';
  const uid = req.user.id;

  let sql = `SELECT MIN(s.id) as id, s.name, s.address, s.client_name, s.po_id, s.business_book_id,
    s.site_engineer_id, s.supervisor, s.status, u.name as engineer_name, bb.lead_no,
    COUNT(*) as entry_count
    FROM sites s
    LEFT JOIN users u ON s.site_engineer_id=u.id
    LEFT JOIN business_book bb ON s.business_book_id=bb.id`;
  const params = [];

  if (!isAdmin) {
    sql += ` WHERE (s.site_engineer_id = ? OR EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE (po.id = s.po_id OR po.business_book_id = s.business_book_id)
        AND ((',' || COALESCE(po.site_engineer_ids,'') || ',') LIKE ? OR po.site_engineer_id = ?)
    ))`;
    params.push(uid, `%,${uid},%`, uid);
  }

  sql += ' GROUP BY s.name ORDER BY s.name';
  res.json(db.prepare(sql).all(...params));
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

// Get PO items for a site - fetches ALL PO items for that company/site name
router.get('/sites/:site_id/po-items', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT name, po_id, business_book_id FROM sites WHERE id=?').get(req.params.site_id);
  if (!site) return res.json([]);
  // Get ALL business_book IDs for this company name (all POs for same company)
  const allBBIds = db.prepare('SELECT DISTINCT s.business_book_id FROM sites s WHERE s.name=? AND s.business_book_id IS NOT NULL').all(site.name);
  const bbIds = allBBIds.map(r => r.business_book_id);
  let items = [];
  if (bbIds.length > 0) {
    items = db.prepare(`SELECT * FROM po_items WHERE business_book_id IN (${bbIds.join(',')})`).all();
  } else if (site.business_book_id) {
    items = db.prepare('SELECT * FROM po_items WHERE business_book_id=?').all(site.business_book_id);
  }
  if (items.length > 0) {
    // Calculate already filled qty from previous DPRs
    const result = items.map(item => {
      const filled = db.prepare('SELECT COALESCE(SUM(actual_qty),0) as total FROM dpr_work_items WHERE po_item_id=?').get(item.id);
      const filledQty = filled?.total || 0;
      const remaining = Math.max(0, (item.quantity || 0) - filledQty);
      return { ...item, filled_qty: filledQty, remaining_qty: remaining };
    });
    return res.json(result);
  }
  res.json([]);
});

// ===== DPR =====
router.get('/', (req, res) => {
  const { site_id, date, status } = req.query;
  const isAdmin = req.user.role === 'admin';
  const uid = req.user.id;
  let sql = `SELECT d.*, s.name as site_name, u.name as submitted_by_name, au.name as approved_by_name
    FROM dpr d LEFT JOIN sites s ON d.site_id=s.id LEFT JOIN users u ON d.submitted_by=u.id LEFT JOIN users au ON d.approved_by=au.id WHERE 1=1`;
  const params = [];
  if (site_id) { sql += ' AND d.site_id=?'; params.push(site_id); }
  if (date) { sql += ' AND d.report_date=?'; params.push(date); }
  if (status) { sql += ' AND d.approval_status=?'; params.push(status); }
  if (!isAdmin) {
    sql += ` AND (s.site_engineer_id = ? OR EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE (po.id = s.po_id OR po.business_book_id = s.business_book_id)
        AND ((',' || COALESCE(po.site_engineer_ids,'') || ',') LIKE ? OR po.site_engineer_id = ?)
    ))`;
    params.push(uid, `%,${uid},%`, uid);
  }
  sql += ' ORDER BY d.report_date DESC, s.name';
  res.json(getDb().prepare(sql).all(...params));
});

// Dashboard summary
router.get('/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const activeSites = db.prepare("SELECT COUNT(DISTINCT name) as c FROM sites WHERE status='active'").get();
  const todayDprs = db.prepare('SELECT COUNT(*) as c FROM dpr WHERE report_date=?').get(today);
  const pendingApproval = db.prepare("SELECT COUNT(*) as c FROM dpr WHERE approval_status='pending'").get();
  const billingReady = db.prepare('SELECT COUNT(*) as c FROM dpr WHERE billing_ready=1').get();
  const isAdmin = req.user.role === 'admin';
  const uid = req.user.id;
  let missingSql = `SELECT MIN(s.id) as id, s.name, s.supervisor FROM sites s WHERE s.status='active'
    AND s.id NOT IN (SELECT site_id FROM dpr WHERE report_date=?)`;
  const missingParams = [today];
  if (!isAdmin) {
    missingSql += ` AND (s.site_engineer_id = ? OR EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE (po.id = s.po_id OR po.business_book_id = s.business_book_id)
        AND ((',' || COALESCE(po.site_engineer_ids,'') || ',') LIKE ? OR po.site_engineer_id = ?)
    ))`;
    missingParams.push(uid, `%,${uid},%`, uid);
  }
  missingSql += ' GROUP BY s.name';
  const missingSites = db.prepare(missingSql).all(...missingParams);
  const variance = db.prepare(`SELECT d.report_date, s.name as site_name,
    COALESCE(AVG(w.variance_pct),0) as avg_variance
    FROM dpr d JOIN sites s ON d.site_id=s.id LEFT JOIN dpr_work_items w ON w.dpr_id=d.id
    WHERE d.report_date >= date('now','-7 days') GROUP BY d.id ORDER BY d.report_date DESC LIMIT 20`).all();
  res.json({ activeSites: activeSites.c, todaySubmissions: todayDprs.c, pendingApproval: pendingApproval.c, billingReady: billingReady.c, missingSites, recentVariance: variance });
});

// Submit MEPF DPR
router.post('/', (req, res) => {
  const { site_id, report_date, weather, overall_status, shift, contractor_name, contractor_manpower, mb_sheet_no,
    floor_zone, system_type, safety_toolbox_talk, safety_ppe_compliance, safety_incidents,
    next_day_plan, hindrances, remarks, grand_total_a, grand_total_b, profit_loss,
    work_items, manpower, machinery } = req.body;

  if (!site_id || !report_date) return res.status(400).json({ error: 'Site and date required' });
  const db = getDb();

  try {
  const r = db.prepare(`INSERT INTO dpr (site_id, report_date, submitted_by, submission_time, weather, overall_status,
    shift, contractor_name, contractor_manpower, mb_sheet_no, grand_total_a, grand_total_b, profit_loss,
    floor_zone, system_type, safety_toolbox_talk, safety_ppe_compliance, safety_incidents,
    next_day_plan, hindrances, remarks) VALUES (?,?,?,CURRENT_TIMESTAMP,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(site_id, report_date, req.user.id, weather || 'clear', overall_status || 'on_track',
      shift || 'day', contractor_name, contractor_manpower || 0, mb_sheet_no,
      grand_total_a || 0, grand_total_b || 0, profit_loss || 0,
      floor_zone, system_type, safety_toolbox_talk ? 1 : 0, safety_ppe_compliance ? 1 : 0,
      safety_incidents, next_day_plan, hindrances, remarks);
  const dprId = r.lastInsertRowid;

  // Table A: Installation work items from PO
  const insertWork = db.prepare('INSERT INTO dpr_work_items (dpr_id, po_item_id, description, unit, floor_zone, boq_qty, rate, amount, planned_qty, actual_qty, cumulative_qty, variance_pct, remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const w of (work_items || [])) {
    if (!w.description && !w.po_item_id) continue;
    const qty = w.qty || 0;
    const rate = w.rate || 0;
    const amount = qty * rate;
    // Verify po_item_id exists, set null if not
    const validPoItemId = w.po_item_id ? (db.prepare('SELECT id FROM po_items WHERE id=?').get(w.po_item_id) ? w.po_item_id : null) : null;
    insertWork.run(dprId, validPoItemId, w.description, w.unit, w.location || w.floor_zone,
      w.boq_qty || 0, rate, amount, qty, qty, w.cumulative_qty || 0, 0, w.remarks);
  }

  // Table B: Costs (stored in manpower table - trade=type, required=qty, deployed=rate, shortage=amount)
  const insertCost = db.prepare('INSERT INTO dpr_manpower (dpr_id, trade, required, deployed, shortage) VALUES (?,?,?,?,?)');
  for (const c of (manpower || [])) {
    const costType = c.type || c.trade || '';
    const qty = c.qty || c.required || 0;
    const rate = c.rate || c.deployed || 0;
    const amount = c.amount || c.shortage || (qty * rate);
    if (costType) insertCost.run(dprId, costType, qty, rate, amount);
  }

  // Machinery/Tools
  const insertMach = db.prepare('INSERT INTO dpr_machinery (dpr_id, equipment, quantity, hours_used, condition, remarks) VALUES (?,?,?,?,?,?)');
  for (const mc of (machinery || [])) {
    if (mc.equipment) insertMach.run(dprId, mc.equipment, mc.quantity || 1, mc.hours_used || 0, mc.condition || 'working', mc.remarks);
  }

  res.status(201).json({ id: dprId, message: 'DPR submitted' });
  } catch (err) {
    console.error('DPR submit error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to submit DPR' });
  }
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

// Delete DPR (cascade child tables)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  db.prepare('DELETE FROM dpr_work_items WHERE dpr_id=?').run(id);
  db.prepare('DELETE FROM dpr_manpower WHERE dpr_id=?').run(id);
  db.prepare('DELETE FROM dpr_material WHERE dpr_id=?').run(id);
  db.prepare('DELETE FROM dpr_machinery WHERE dpr_id=?').run(id);
  db.prepare('DELETE FROM dpr WHERE id=?').run(id);
  res.json({ message: 'Deleted' });
});

router.delete('/sites/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const dprCount = db.prepare('SELECT COUNT(*) as c FROM dpr WHERE site_id=?').get(id).c;
  if (dprCount > 0) return res.status(409).json({ error: 'Cannot delete: DPRs reference this site' });
  db.prepare('DELETE FROM sites WHERE id=?').run(id);
  res.json({ message: 'Deleted' });
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
