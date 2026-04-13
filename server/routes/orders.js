const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Purchase Orders
router.get('/po', (req, res) => {
  res.json(getDb().prepare(`SELECT po.*, l.company_name, q.quotation_number FROM purchase_orders po
    LEFT JOIN leads l ON po.lead_id=l.id LEFT JOIN quotations q ON po.quotation_id=q.id ORDER BY po.created_at DESC`).all());
});

router.post('/po', (req, res) => {
  const { lead_id, quotation_id, po_number, po_date, total_amount, advance_amount } = req.body;
  const r = getDb().prepare(
    'INSERT INTO purchase_orders (lead_id, quotation_id, po_number, po_date, total_amount, advance_amount, created_by) VALUES (?,?,?,?,?,?,?)'
  ).run(lead_id, quotation_id, po_number, po_date, total_amount, advance_amount || 0, req.user.id);
  // Update lead status to won
  if (lead_id) getDb().prepare('UPDATE leads SET status=? WHERE id=?').run('won', lead_id);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/po/:id', (req, res) => {
  const { status, advance_received } = req.body;
  getDb().prepare('UPDATE purchase_orders SET status=?, advance_received=? WHERE id=?')
    .run(status, advance_received ? 1 : 0, req.params.id);
  res.json({ message: 'Updated' });
});

// Business Book
router.get('/business-book', (req, res) => {
  res.json(getDb().prepare(`SELECT bb.*, po.po_number FROM business_book bb
    LEFT JOIN purchase_orders po ON bb.po_id=po.id ORDER BY bb.created_at DESC`).all());
});

router.post('/business-book', (req, res) => {
  const { po_id, client_name, project_name, po_amount, advance_received } = req.body;
  const db = getDb();

  // 1. Create Business Book entry
  const r = db.prepare(
    'INSERT INTO business_book (po_id, client_name, project_name, po_amount, advance_received, balance_amount) VALUES (?,?,?,?,?,?)'
  ).run(po_id, client_name, project_name, po_amount, advance_received || 0, po_amount - (advance_received || 0));
  const bbId = r.lastInsertRowid;

  // === AUTO-FLOW: PO → Order Planning → DPR Site ===

  // 2. Auto-create Order Planning entry
  const planResult = db.prepare(
    'INSERT INTO order_planning (po_id, business_book_id, notes, created_by) VALUES (?,?,?,?)'
  ).run(po_id, bbId, `Auto-created from Business Book: ${project_name || client_name}`, req.user.id);

  // 3. Auto-create DPR Site from project
  const existingSite = po_id ? db.prepare('SELECT id FROM sites WHERE po_id=?').get(po_id) : null;
  let siteId = existingSite?.id;
  if (!siteId) {
    const siteResult = db.prepare(
      'INSERT INTO sites (name, client_name, po_id) VALUES (?,?,?)'
    ).run(project_name || `${client_name} Project`, client_name, po_id);
    siteId = siteResult.lastInsertRowid;
  }

  // 4. Auto-pick BOQ items from quotation/BOQ linked to PO → populate as planning items
  if (po_id) {
    const po = db.prepare('SELECT quotation_id FROM purchase_orders WHERE id=?').get(po_id);
    if (po?.quotation_id) {
      const quotation = db.prepare('SELECT boq_id FROM quotations WHERE id=?').get(po.quotation_id);
      if (quotation?.boq_id) {
        const boqItems = db.prepare('SELECT * FROM boq_items WHERE boq_id=?').all(quotation.boq_id);
        // These items are now available in planning and DPR
        // Store them as reference for DPR pre-population
        for (const item of boqItems) {
          // Auto-create indent items template for planning
          db.prepare('INSERT OR IGNORE INTO indent_items (indent_id, description, quantity, unit, rate, amount) VALUES (?,?,?,?,?,?)')
            .run(null, item.description, item.quantity, item.unit, item.rate, item.amount);
        }
      }
    }
  }

  // 5. Auto-create receivable in Collection Engine (for advance tracking)
  if (advance_received && advance_received > 0) {
    const today = new Date().toISOString().split('T')[0];
    // Add advance to cash flow as inflow
    let daily = db.prepare('SELECT id FROM cash_flow_daily WHERE date=?').get(today);
    if (!daily) {
      const prev = db.prepare('SELECT closing_balance FROM cash_flow_daily WHERE date < ? ORDER BY date DESC LIMIT 1').get(today);
      const dr = db.prepare('INSERT INTO cash_flow_daily (date, opening_balance, closing_balance) VALUES (?,?,?)').run(today, prev?.closing_balance || 0, prev?.closing_balance || 0);
      daily = { id: dr.lastInsertRowid };
    }
    db.prepare('INSERT INTO cash_flow_entries (daily_id, date, type, category, description, amount, party_name, created_by) VALUES (?,?,?,?,?,?,?,?)')
      .run(daily.id, today, 'inflow', 'Advance Received', `Advance from ${client_name} - PO`, advance_received, client_name, req.user.id);

    // Recalculate daily
    const inflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='inflow'").get(daily.id);
    const outflows = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM cash_flow_entries WHERE daily_id=? AND type='outflow'").get(daily.id);
    const opening = db.prepare('SELECT opening_balance FROM cash_flow_daily WHERE id=?').get(daily.id);
    db.prepare('UPDATE cash_flow_daily SET total_inflows=?, total_outflows=?, closing_balance=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(inflows.t, outflows.t, (opening?.opening_balance || 0) + inflows.t - outflows.t, daily.id);
  }

  // 6. Auto-create receivable for balance amount in Collection Engine
  if (po_amount > (advance_received || 0)) {
    const balanceAmount = po_amount - (advance_received || 0);
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare('INSERT INTO receivables (client_name, project_name, po_id, invoice_amount, received_amount, outstanding_amount, due_date, status, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(client_name, project_name, po_id, po_amount, advance_received || 0, balanceAmount, dueDate, balanceAmount > 0 ? 'green' : 'green', req.user.id);
  }

  res.status(201).json({
    id: bbId,
    message: 'Business Book entry created with auto-links',
    auto_created: {
      order_planning: planResult.lastInsertRowid,
      dpr_site: siteId,
      receivable: 'Created in Collection Engine',
      cash_flow: advance_received > 0 ? 'Advance added to Cash Flow' : 'No advance'
    }
  });
});

router.put('/business-book/:id', (req, res) => {
  const { status, advance_received, balance_amount } = req.body;
  getDb().prepare('UPDATE business_book SET status=?, advance_received=?, balance_amount=? WHERE id=?')
    .run(status, advance_received, balance_amount, req.params.id);
  res.json({ message: 'Updated' });
});

// Order Planning
router.get('/planning', (req, res) => {
  res.json(getDb().prepare(`SELECT op.*, po.po_number, bb.client_name FROM order_planning op
    LEFT JOIN purchase_orders po ON op.po_id=po.id LEFT JOIN business_book bb ON op.business_book_id=bb.id ORDER BY op.created_at DESC`).all());
});

router.post('/planning', (req, res) => {
  const { po_id, business_book_id, planned_start, planned_end, notes } = req.body;
  const r = getDb().prepare(
    'INSERT INTO order_planning (po_id, business_book_id, planned_start, planned_end, notes, created_by) VALUES (?,?,?,?,?,?)'
  ).run(po_id, business_book_id, planned_start, planned_end, notes, req.user.id);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/planning/:id', (req, res) => {
  const { status, planned_start, planned_end, notes } = req.body;
  getDb().prepare('UPDATE order_planning SET status=?, planned_start=?, planned_end=?, notes=? WHERE id=?')
    .run(status, planned_start, planned_end, notes, req.params.id);
  res.json({ message: 'Updated' });
});

// Get BOQ items for a PO (for DPR auto-population)
router.get('/po/:id/boq-items', (req, res) => {
  const db = getDb();
  const po = db.prepare('SELECT quotation_id FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!po?.quotation_id) return res.json([]);
  const quotation = db.prepare('SELECT boq_id FROM quotations WHERE id=?').get(po.quotation_id);
  if (!quotation?.boq_id) return res.json([]);
  const items = db.prepare('SELECT * FROM boq_items WHERE boq_id=?').all(quotation.boq_id);
  res.json(items);
});

module.exports = router;
