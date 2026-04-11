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
  const r = getDb().prepare(
    'INSERT INTO business_book (po_id, client_name, project_name, po_amount, advance_received, balance_amount) VALUES (?,?,?,?,?,?)'
  ).run(po_id, client_name, project_name, po_amount, advance_received || 0, po_amount - (advance_received || 0));
  res.status(201).json({ id: r.lastInsertRowid });
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

module.exports = router;
