const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// GET all business book entries with filters
router.get('/', requirePermission('business_book', 'view'), (req, res) => {
  const { status, category, order_type, lead_type, search, date_from, date_to } = req.query;
  let sql = `SELECT bb.*, po.po_number, u.name as employee_name FROM business_book bb
    LEFT JOIN purchase_orders po ON bb.po_id=po.id LEFT JOIN users u ON bb.employee_id=u.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND bb.status=?'; params.push(status); }
  if (category) { sql += ' AND bb.category=?'; params.push(category); }
  if (order_type) { sql += ' AND bb.order_type=?'; params.push(order_type); }
  if (lead_type) { sql += ' AND bb.lead_type=?'; params.push(lead_type); }
  if (date_from) { sql += ' AND bb.created_at >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND bb.created_at <= ?'; params.push(date_to + ' 23:59:59'); }
  if (search) {
    sql += ' AND (bb.client_name LIKE ? OR bb.company_name LIKE ? OR bb.lead_no LIKE ? OR bb.project_name LIKE ? OR bb.district LIKE ? OR bb.state LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY bb.created_at DESC';
  res.json(getDb().prepare(sql).all(...params));
});

// GET summary/stats (must be before /:id)
router.get('/stats/summary', requirePermission('business_book', 'view'), (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM business_book').get();
  const amounts = db.prepare('SELECT COALESCE(SUM(po_amount),0) as total_po, COALESCE(SUM(advance_received),0) as total_advance, COALESCE(SUM(balance_amount),0) as total_balance, COALESCE(SUM(sale_amount_without_gst),0) as total_sale FROM business_book').get();
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM business_book GROUP BY status").all();
  const byCategory = db.prepare("SELECT category, COUNT(*) as count, COALESCE(SUM(po_amount),0) as amount FROM business_book WHERE category IS NOT NULL AND category != '' GROUP BY category").all();
  const byOrderType = db.prepare("SELECT order_type, COUNT(*) as count, COALESCE(SUM(po_amount),0) as amount FROM business_book GROUP BY order_type").all();
  const recentEntries = db.prepare('SELECT id, lead_no, client_name, project_name, po_amount, status, created_at FROM business_book ORDER BY created_at DESC LIMIT 5').all();
  res.json({ total: total.count, ...amounts, byStatus, byCategory, byOrderType, recentEntries });
});

// GET single entry by ID
router.get('/:id', requirePermission('business_book', 'view'), (req, res) => {
  const entry = getDb().prepare(`SELECT bb.*, po.po_number, u.name as employee_name FROM business_book bb
    LEFT JOIN purchase_orders po ON bb.po_id=po.id LEFT JOIN users u ON bb.employee_id=u.id WHERE bb.id=?`).get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  res.json(entry);
});

// POST create new entry (with auto-flow)
router.post('/', requirePermission('business_book', 'create'), (req, res) => {
  const {
    po_id, lead_type, client_name, company_name, project_name, client_contact,
    source_of_enquiry, district, state, billing_address, shipping_address,
    guarantee_required, sale_amount_without_gst, po_amount, order_type, penalty_clause,
    committed_start_date, committed_delivery_date, committed_completion_date,
    category, customer_type, management_person_name, management_person_contact,
    employee_assigned, employee_id, tpa_items_count, tpa_material_amount, tpa_labour_amount,
    advance_received, boq_file_link, tpa_material_link, tpa_labour_link, remarks
  } = req.body;
  const db = getDb();

  // Auto-generate Lead No: SEPL + count
  const count = db.prepare('SELECT COUNT(*) as c FROM business_book').get().c;
  const leadNo = `SEPL${String(count + 20001).padStart(5, '0')}`;

  // 1. Create Business Book entry
  const r = db.prepare(`INSERT INTO business_book (
    lead_no, po_id, lead_type, client_name, company_name, project_name, client_contact,
    source_of_enquiry, district, state, billing_address, shipping_address,
    guarantee_required, sale_amount_without_gst, po_amount, order_type, penalty_clause,
    committed_start_date, committed_delivery_date, committed_completion_date,
    category, customer_type, management_person_name, management_person_contact,
    employee_assigned, employee_id, tpa_items_count, tpa_material_amount, tpa_labour_amount,
    advance_received, balance_amount, boq_file_link, tpa_material_link, tpa_labour_link, remarks, created_by
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    leadNo, po_id || null, lead_type || 'Private', client_name, company_name, project_name, client_contact,
    source_of_enquiry, district, state, billing_address, shipping_address,
    guarantee_required ? 1 : 0, sale_amount_without_gst || 0, po_amount || 0, order_type || 'Supply', penalty_clause,
    committed_start_date || null, committed_delivery_date || null, committed_completion_date || null,
    category, customer_type, management_person_name, management_person_contact,
    employee_assigned, employee_id || null, tpa_items_count || 0, tpa_material_amount || 0, tpa_labour_amount || 0,
    advance_received || 0, (po_amount || 0) - (advance_received || 0),
    boq_file_link, tpa_material_link, tpa_labour_link, remarks, req.user.id
  );
  const bbId = r.lastInsertRowid;

  // 2. Auto-create Order Planning
  const planResult = db.prepare(
    'INSERT INTO order_planning (po_id, business_book_id, planned_start, planned_end, notes, created_by) VALUES (?,?,?,?,?,?)'
  ).run(po_id || null, bbId, committed_start_date || null, committed_completion_date || null,
    `Auto-created from Business Book: ${leadNo} - ${project_name || client_name} [${category || ''} | ${order_type || 'Supply'}]`, req.user.id);

  // 3. Auto-create DPR Site
  const existingSite = po_id ? db.prepare('SELECT id FROM sites WHERE po_id=?').get(po_id) : null;
  let siteId = existingSite?.id;
  if (!siteId) {
    const siteName = project_name || `${client_name} - ${category || 'Project'}`;
    const siteAddress = shipping_address || billing_address || `${district || ''}, ${state || ''}`;
    const siteResult = db.prepare(
      'INSERT INTO sites (name, address, client_name, po_id, supervisor) VALUES (?,?,?,?,?)'
    ).run(siteName, siteAddress, client_name || company_name, po_id || null, employee_assigned || management_person_name);
    siteId = siteResult.lastInsertRowid;
  }

  // 4. Auto-pick BOQ items
  if (po_id) {
    const po = db.prepare('SELECT quotation_id FROM purchase_orders WHERE id=?').get(po_id);
    if (po?.quotation_id) {
      const quotation = db.prepare('SELECT boq_id FROM quotations WHERE id=?').get(po.quotation_id);
      if (quotation?.boq_id) {
        const boqItems = db.prepare('SELECT * FROM boq_items WHERE boq_id=?').all(quotation.boq_id);
        for (const item of boqItems) {
          db.prepare('INSERT OR IGNORE INTO indent_items (indent_id, description, quantity, unit, rate, amount) VALUES (?,?,?,?,?,?)')
            .run(null, item.description, item.quantity, item.unit, item.rate, item.amount);
        }
      }
    }
  }

  // 5. Auto-create Cash Flow entry for advance
  if (advance_received && advance_received > 0) {
    const today = new Date().toISOString().split('T')[0];
    let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date=?').get(today);
    if (!daily) {
      const prev = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(today);
      const dr = db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance) VALUES (?,?,?)').run(today, prev?.closing_balance || 0, prev?.closing_balance || 0);
      daily = { id: dr.lastInsertRowid };
    }
    db.prepare('INSERT INTO cash_flow_entries (daily_id, date, type, category, description, amount, party_name, created_by) VALUES (?,?,?,?,?,?,?,?)')
      .run(daily.id, today, 'inflow', 'Advance Received', `Advance from ${client_name} - ${leadNo}`, advance_received, client_name, req.user.id);

    const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='inflow'").get(daily.id);
    const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='outflow'").get(daily.id);
    const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id=?').get(daily.id);
    db.prepare('UPDATE cash_flow_daily SET total_inflows=?, total_outflows=?, closing_balance=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(inflows.t, outflows.t, (opening?.opening_balance || 0) + inflows.t - outflows.t, daily.id);
  }

  // 6. Auto-create receivable for balance
  if (po_amount > (advance_received || 0)) {
    const balanceAmount = po_amount - (advance_received || 0);
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare('INSERT INTO receivables (client_name, project_name, po_id, invoice_amount, received_amount, outstanding_amount, due_date, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(client_name, project_name, po_id || null, po_amount, advance_received || 0, balanceAmount, dueDate, 'green', req.user.id);
  }

  res.status(201).json({
    id: bbId,
    lead_no: leadNo,
    message: 'Business Book entry created with auto-links',
    auto_created: {
      order_planning: planResult.lastInsertRowid,
      dpr_site: siteId,
      receivable: 'Created in Collection Engine',
      cash_flow: advance_received > 0 ? 'Advance added to Cash Flow' : 'No advance'
    }
  });
});

// PUT update entry
router.put('/:id', requirePermission('business_book', 'edit'), (req, res) => {
  const {
    lead_type, client_name, company_name, project_name, client_contact,
    source_of_enquiry, district, state, billing_address, shipping_address,
    guarantee_required, sale_amount_without_gst, po_amount, order_type, penalty_clause,
    committed_start_date, committed_delivery_date, committed_completion_date,
    category, customer_type, management_person_name, management_person_contact,
    employee_assigned, employee_id, tpa_items_count, tpa_material_amount, tpa_labour_amount,
    advance_received, balance_amount, boq_file_link, tpa_material_link, tpa_labour_link,
    remarks, status
  } = req.body;

  const computedBalance = balance_amount !== undefined ? balance_amount : (po_amount || 0) - (advance_received || 0);

  getDb().prepare(`UPDATE business_book SET
    lead_type=?, client_name=?, company_name=?, project_name=?, client_contact=?,
    source_of_enquiry=?, district=?, state=?, billing_address=?, shipping_address=?,
    guarantee_required=?, sale_amount_without_gst=?, po_amount=?, order_type=?, penalty_clause=?,
    committed_start_date=?, committed_delivery_date=?, committed_completion_date=?,
    category=?, customer_type=?, management_person_name=?, management_person_contact=?,
    employee_assigned=?, employee_id=?, tpa_items_count=?, tpa_material_amount=?, tpa_labour_amount=?,
    advance_received=?, balance_amount=?, boq_file_link=?, tpa_material_link=?, tpa_labour_link=?,
    remarks=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
    lead_type, client_name, company_name, project_name, client_contact,
    source_of_enquiry, district, state, billing_address, shipping_address,
    guarantee_required ? 1 : 0, sale_amount_without_gst || 0, po_amount || 0, order_type, penalty_clause,
    committed_start_date || null, committed_delivery_date || null, committed_completion_date || null,
    category, customer_type, management_person_name, management_person_contact,
    employee_assigned, employee_id || null, tpa_items_count || 0, tpa_material_amount || 0, tpa_labour_amount || 0,
    advance_received || 0, computedBalance, boq_file_link, tpa_material_link, tpa_labour_link,
    remarks, status, req.params.id
  );
  res.json({ message: 'Updated' });
});

// DELETE entry
router.delete('/:id', requirePermission('business_book', 'delete'), (req, res) => {
  getDb().prepare('DELETE FROM business_book WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
