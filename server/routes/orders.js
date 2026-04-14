const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Business Book entries for PO dropdown
router.get('/business-book-entries', (req, res) => {
  res.json(getDb().prepare(
    "SELECT id, lead_no, client_name, company_name, project_name, category, order_type, po_amount, sale_amount_without_gst, district, state FROM business_book ORDER BY created_at DESC"
  ).all());
});

// Purchase Orders
router.get('/po', (req, res) => {
  res.json(getDb().prepare(`SELECT po.*, bb.lead_no, bb.client_name as bb_client, bb.company_name as bb_company,
    bb.project_name as bb_project, bb.category as bb_category,
    l.company_name, q.quotation_number FROM purchase_orders po
    LEFT JOIN business_book bb ON po.business_book_id=bb.id
    LEFT JOIN leads l ON po.lead_id=l.id LEFT JOIN quotations q ON po.quotation_id=q.id ORDER BY po.created_at DESC`).all());
});

router.post('/po', (req, res) => {
  const { business_book_id, lead_id, quotation_id, po_number, po_date, total_amount, advance_amount, po_copy_link, pt_advance, pt_delivery, pt_installation, pt_commissioning, pt_retention, items } = req.body;
  const db = getDb();

  const r = db.prepare(
    'INSERT INTO purchase_orders (business_book_id, lead_id, quotation_id, po_number, po_date, total_amount, advance_amount, po_copy_link, pt_advance, pt_delivery, pt_installation, pt_commissioning, pt_retention, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(business_book_id || null, lead_id || null, quotation_id || null, po_number, po_date, total_amount, advance_amount || 0, po_copy_link || null, pt_advance || 0, pt_delivery || 0, pt_installation || 0, pt_commissioning || 0, pt_retention || 0, req.user.id);
  const poId = r.lastInsertRowid;

  // Insert PO items
  if (items && items.length > 0) {
    const insertItem = db.prepare('INSERT INTO po_items (business_book_id, item_master_id, description, quantity, unit, rate, amount, hsn_code) VALUES (?,?,?,?,?,?,?,?)');
    for (const item of items) {
      if (item.description && item.description.trim()) {
        insertItem.run(business_book_id || null, item.item_master_id || null, item.description.trim(), item.quantity || 0, item.unit || 'nos', item.rate || 0, item.amount || 0, item.hsn_code || '');
      }
    }
  }

  // Sync po_number back to business_book
  if (business_book_id) {
    db.prepare('UPDATE business_book SET po_number=?, po_date=?, po_amount=? WHERE id=?')
      .run(po_number, po_date, total_amount || 0, business_book_id);
    // Update site's po_id if exists
    db.prepare('UPDATE sites SET po_id=? WHERE business_book_id=?').run(poId, business_book_id);
    // Update order_planning po_id
    db.prepare('UPDATE order_planning SET po_id=? WHERE business_book_id=?').run(poId, business_book_id);
  }

  // Update lead status to won
  if (lead_id) db.prepare('UPDATE leads SET status=? WHERE id=?').run('won', lead_id);

  res.status(201).json({ id: poId });
});

router.put('/po/:id', (req, res) => {
  const { status, advance_received } = req.body;
  getDb().prepare('UPDATE purchase_orders SET status=?, advance_received=? WHERE id=?')
    .run(status, advance_received ? 1 : 0, req.params.id);
  res.json({ message: 'Updated' });
});

// PO Items CRUD
router.get('/po/:id/items', (req, res) => {
  // Get items via business_book_id linked to this PO
  const po = getDb().prepare('SELECT business_book_id FROM purchase_orders WHERE id=?').get(req.params.id);
  if (po?.business_book_id) {
    res.json(getDb().prepare('SELECT * FROM po_items WHERE business_book_id=?').all(po.business_book_id));
  } else {
    res.json([]);
  }
});

router.post('/po/:id/items', (req, res) => {
  const { items } = req.body;
  const db = getDb();
  const po = db.prepare('SELECT business_book_id FROM purchase_orders WHERE id=?').get(req.params.id);
  const bbId = po?.business_book_id || null;

  // Clear old items for this business_book
  if (bbId) db.prepare('DELETE FROM po_items WHERE business_book_id=?').run(bbId);

  const insert = db.prepare('INSERT INTO po_items (business_book_id, item_master_id, description, quantity, unit, rate, amount, hsn_code) VALUES (?,?,?,?,?,?,?,?)');
  let count = 0;
  for (const item of (items || [])) {
    if (item.description && item.description.trim()) {
      insert.run(bbId, item.item_master_id || null, item.description.trim(), item.quantity || 0, item.unit || 'nos', item.rate || 0, item.amount || 0, item.hsn_code || '');
      count++;
    }
  }
  res.json({ message: 'Items saved', count });
});

// Get PO items by business_book_id directly
router.get('/bb/:bbId/items', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM po_items WHERE business_book_id=?').all(req.params.bbId));
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
