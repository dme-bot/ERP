const express = require('express');
const { getDb } = require('../db/schema');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// Vendors
router.get('/vendors', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM vendors WHERE active=1 ORDER BY name').all());
});

router.post('/vendors', (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'Vendor name required' });
  const db = getDb();
  // Auto-generate vendor code if empty
  let code = b.vendor_code;
  if (!code) {
    const count = db.prepare('SELECT COUNT(*) as c FROM vendors').get().c;
    code = `SEVC${String(count + 2000).padStart(4, '0')}`;
  }
  const r = db.prepare('INSERT OR IGNORE INTO vendors (vendor_code,name,firm_name,contact_person,phone,email,district,state,address,category,deals_in,authorized_dealer,type,turnover,team_size,payment_terms,credit_days,gst_number,source,category_wise,sub_category,existing_vendor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(code, b.name, b.firm_name, b.contact_person, b.phone, b.email, b.district, b.state, b.address, b.category, b.deals_in, b.authorized_dealer, b.type, b.turnover, b.team_size, b.payment_terms, b.credit_days, b.gst_number, b.source, b.category_wise, b.sub_category, b.existing_vendor);
  res.status(201).json({ id: r.lastInsertRowid, vendor_code: code });
});

router.put('/vendors/:id', (req, res) => {
  const b = req.body;
  getDb().prepare('UPDATE vendors SET vendor_code=?,name=?,firm_name=?,contact_person=?,phone=?,email=?,district=?,state=?,address=?,category=?,deals_in=?,authorized_dealer=?,type=?,turnover=?,team_size=?,payment_terms=?,credit_days=?,gst_number=?,source=?,sub_category=?,active=? WHERE id=?')
    .run(b.vendor_code, b.name, b.firm_name, b.contact_person, b.phone, b.email, b.district, b.state, b.address, b.category, b.deals_in, b.authorized_dealer, b.type, b.turnover, b.team_size, b.payment_terms, b.credit_days, b.gst_number, b.source, b.sub_category, b.active !== undefined ? (b.active ? 1 : 0) : 1, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/vendors/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const uses = db.prepare(`SELECT
    (SELECT COUNT(*) FROM vendor_pos WHERE vendor_id=?) +
    (SELECT COUNT(*) FROM purchase_bills WHERE vendor_id=?) +
    (SELECT COUNT(*) FROM indent_items WHERE vendor_id=?) +
    (SELECT COUNT(*) FROM vendor_rates WHERE vendor1_id=? OR vendor2_id=? OR vendor3_id=? OR selected_vendor_id=?) as c`
  ).get(id, id, id, id, id, id, id).c;
  if (uses > 0) return res.status(409).json({ error: 'Cannot delete: vendor is referenced by POs, bills, indents or rate comparisons' });
  db.prepare('DELETE FROM vendors WHERE id=?').run(id);
  res.json({ message: 'Deleted' });
});

// Vendor Rate Comparison
router.get('/vendor-rates', (req, res) => {
  const { planning_id } = req.query;
  let sql = `SELECT vr.*, v1.name as vendor1_name, v2.name as vendor2_name, v3.name as vendor3_name, sv.name as selected_vendor_name
    FROM vendor_rates vr LEFT JOIN vendors v1 ON vr.vendor1_id=v1.id LEFT JOIN vendors v2 ON vr.vendor2_id=v2.id
    LEFT JOIN vendors v3 ON vr.vendor3_id=v3.id LEFT JOIN vendors sv ON vr.selected_vendor_id=sv.id`;
  if (planning_id) sql += ` WHERE vr.planning_id=${planning_id}`;
  sql += ' ORDER BY vr.created_at DESC';
  res.json(getDb().prepare(sql).all());
});

router.post('/vendor-rates', (req, res) => {
  const { planning_id, item_description, vendor1_id, vendor1_rate, vendor2_id, vendor2_rate, vendor3_id, vendor3_rate, final_rate, selected_vendor_id } = req.body;
  const r = getDb().prepare(
    'INSERT INTO vendor_rates (planning_id,item_description,vendor1_id,vendor1_rate,vendor2_id,vendor2_rate,vendor3_id,vendor3_rate,final_rate,selected_vendor_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(planning_id, item_description, vendor1_id, vendor1_rate, vendor2_id, vendor2_rate, vendor3_id, vendor3_rate, final_rate, selected_vendor_id);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.delete('/vendor-rates/:id', (req, res) => {
  getDb().prepare('DELETE FROM vendor_rates WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

router.put('/vendor-rates/:id/approve', (req, res) => {
  const { approval_status, approved_by } = req.body;
  getDb().prepare('UPDATE vendor_rates SET approval_status=?, approved_by=? WHERE id=?')
    .run(approval_status, approved_by || req.user.name, req.params.id);
  res.json({ message: 'Updated' });
});

// Indents
router.get('/indents', (req, res) => {
  res.json(getDb().prepare(`SELECT i.*, u.name as created_by_name, au.name as approved_by_name FROM indents i
    LEFT JOIN users u ON i.created_by=u.id LEFT JOIN users au ON i.approved_by=au.id ORDER BY i.created_at DESC`).all());
});

router.post('/indents', (req, res) => {
  const db = getDb();
  const { planning_id, items, notes } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM indents').get().c;
  const indentNum = `IND-${String(count + 1).padStart(4, '0')}`;
  const r = db.prepare('INSERT INTO indents (planning_id, indent_number, notes, created_by) VALUES (?,?,?,?)')
    .run(planning_id, indentNum, notes, req.user.id);
  const insertItem = db.prepare('INSERT INTO indent_items (indent_id,description,quantity,unit,rate,amount,vendor_id) VALUES (?,?,?,?,?,?,?)');
  for (const i of (items || [])) {
    insertItem.run(r.lastInsertRowid, i.description, i.quantity, i.unit, i.rate, i.quantity * i.rate, i.vendor_id);
  }
  res.status(201).json({ id: r.lastInsertRowid, indent_number: indentNum });
});

router.put('/indents/:id', (req, res) => {
  const { status } = req.body;
  const db = getDb();
  db.prepare('UPDATE indents SET status=?, approved_by=? WHERE id=?')
    .run(status, status === 'approved' ? req.user.id : null, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/indents/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const vpoCount = db.prepare('SELECT COUNT(*) as c FROM vendor_pos WHERE indent_id=?').get(id).c;
  if (vpoCount > 0) return res.status(409).json({ error: 'Cannot delete: Vendor POs reference this indent' });
  db.prepare('DELETE FROM indent_items WHERE indent_id=?').run(id);
  db.prepare('DELETE FROM indents WHERE id=?').run(id);
  res.json({ message: 'Deleted' });
});

router.get('/indents/:id', (req, res) => {
  const indent = getDb().prepare('SELECT * FROM indents WHERE id=?').get(req.params.id);
  if (!indent) return res.status(404).json({ error: 'Not found' });
  indent.items = getDb().prepare('SELECT ii.*, v.name as vendor_name FROM indent_items ii LEFT JOIN vendors v ON ii.vendor_id=v.id WHERE ii.indent_id=?').all(req.params.id);
  res.json(indent);
});

// Vendor PO
router.get('/vendor-po', (req, res) => {
  res.json(getDb().prepare(`SELECT vp.*, v.name as vendor_name FROM vendor_pos vp
    LEFT JOIN vendors v ON vp.vendor_id=v.id ORDER BY vp.created_at DESC`).all());
});

router.post('/vendor-po', (req, res) => {
  const db = getDb();
  const { indent_id, vendor_id, total_amount, advance_required } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM vendor_pos').get().c;
  const poNum = `VPO-${String(count + 1).padStart(4, '0')}`;
  const r = db.prepare('INSERT INTO vendor_pos (indent_id,vendor_id,po_number,total_amount,advance_required) VALUES (?,?,?,?,?)')
    .run(indent_id, vendor_id, poNum, total_amount, advance_required ? 1 : 0);
  if (indent_id) db.prepare('UPDATE indents SET status=? WHERE id=?').run('po_sent', indent_id);
  res.status(201).json({ id: r.lastInsertRowid, po_number: poNum });
});

router.put('/vendor-po/:id', (req, res) => {
  const { status, advance_paid } = req.body;
  getDb().prepare('UPDATE vendor_pos SET status=?, advance_paid=? WHERE id=?')
    .run(status, advance_paid ? 1 : 0, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/vendor-po/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const billCount = db.prepare('SELECT COUNT(*) as c FROM purchase_bills WHERE vendor_po_id=?').get(id).c;
  const dnCount = db.prepare('SELECT COUNT(*) as c FROM delivery_notes WHERE vendor_po_id=?').get(id).c;
  if (billCount > 0 || dnCount > 0) return res.status(409).json({ error: 'Cannot delete: Purchase Bills or Delivery Notes reference this Vendor PO' });
  db.prepare('DELETE FROM vendor_pos WHERE id=?').run(id);
  res.json({ message: 'Deleted' });
});

// Purchase Bills
router.get('/purchase-bills', (req, res) => {
  res.json(getDb().prepare(`SELECT pb.*, v.name as vendor_name FROM purchase_bills pb
    LEFT JOIN vendors v ON pb.vendor_id=v.id ORDER BY pb.created_at DESC`).all());
});

router.post('/purchase-bills', (req, res) => {
  const { vendor_po_id, vendor_id, bill_number, bill_date, amount, gst_amount, total_amount } = req.body;
  const r = getDb().prepare('INSERT INTO purchase_bills (vendor_po_id,vendor_id,bill_number,bill_date,amount,gst_amount,total_amount) VALUES (?,?,?,?,?,?,?)')
    .run(vendor_po_id, vendor_id, bill_number, bill_date, amount, gst_amount, total_amount);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.delete('/purchase-bills/:id', (req, res) => {
  getDb().prepare('DELETE FROM purchase_bills WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Delivery Notes
router.get('/delivery-notes', (req, res) => {
  res.json(getDb().prepare(`SELECT dn.*, u.name as received_by_name FROM delivery_notes dn
    LEFT JOIN users u ON dn.received_by=u.id ORDER BY dn.created_at DESC`).all());
});

router.post('/delivery-notes', (req, res) => {
  const { vendor_po_id, delivery_date, notes } = req.body;
  const r = getDb().prepare('INSERT INTO delivery_notes (vendor_po_id,delivery_date,received_by,notes) VALUES (?,?,?,?)')
    .run(vendor_po_id, delivery_date, req.user.id, notes);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/delivery-notes/:id', (req, res) => {
  const { status, notes } = req.body;
  getDb().prepare('UPDATE delivery_notes SET status=?, notes=? WHERE id=?').run(status, notes, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/delivery-notes/:id', (req, res) => {
  getDb().prepare('DELETE FROM delivery_notes WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// Sales Bills
router.get('/sales-bills', (req, res) => {
  res.json(getDb().prepare(`SELECT sb.*, po.po_number FROM sales_bills sb
    LEFT JOIN purchase_orders po ON sb.po_id=po.id ORDER BY sb.created_at DESC`).all());
});

router.post('/sales-bills', (req, res) => {
  const db = getDb();
  const { po_id, bill_date, amount, gst_amount, total_amount } = req.body;
  const count = db.prepare('SELECT COUNT(*) as c FROM sales_bills').get().c;
  const billNum = `SB-${String(count + 1).padStart(4, '0')}`;
  const r = db.prepare('INSERT INTO sales_bills (po_id,bill_number,bill_date,amount,gst_amount,total_amount) VALUES (?,?,?,?,?,?)')
    .run(po_id, billNum, bill_date, amount, gst_amount, total_amount);
  res.status(201).json({ id: r.lastInsertRowid, bill_number: billNum });
});

router.delete('/sales-bills/:id', (req, res) => {
  getDb().prepare('DELETE FROM sales_bills WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
