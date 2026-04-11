import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';

export default function Procurement() {
  const [tab, setTab] = useState('indents');
  const [indents, setIndents] = useState([]);
  const [vendorPos, setVendorPos] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [indentItems, setIndentItems] = useState([{ description: '', quantity: 1, unit: 'nos', rate: 0, vendor_id: '' }]);

  const load = () => {
    api.get('/procurement/indents').then(r => setIndents(r.data));
    api.get('/procurement/vendor-po').then(r => setVendorPos(r.data));
    api.get('/procurement/purchase-bills').then(r => setPurchaseBills(r.data));
    api.get('/procurement/delivery-notes').then(r => setDeliveryNotes(r.data));
    api.get('/procurement/vendors').then(r => setVendors(r.data));
  };
  useEffect(() => { load(); }, []);

  const saveIndent = async (e) => {
    e.preventDefault();
    await api.post('/procurement/indents', { ...form, items: indentItems });
    toast.success('Indent created');
    setModal(false); load();
  };

  const approveIndent = async (id, status) => {
    await api.put(`/procurement/indents/${id}`, { status });
    toast.success(`Indent ${status}`);
    load();
  };

  const saveVendorPo = async (e) => {
    e.preventDefault();
    await api.post('/procurement/vendor-po', form);
    toast.success('Vendor PO created');
    setModal(false); load();
  };

  const savePurchaseBill = async (e) => {
    e.preventDefault();
    await api.post('/procurement/purchase-bills', form);
    toast.success('Purchase bill added');
    setModal(false); load();
  };

  const saveDeliveryNote = async (e) => {
    e.preventDefault();
    await api.post('/procurement/delivery-notes', form);
    toast.success('Delivery note created');
    setModal(false); load();
  };

  const tabs = [
    { id: 'indents', label: 'Indents' },
    { id: 'vendorpo', label: 'Vendor PO' },
    { id: 'bills', label: 'Purchase Bills' },
    { id: 'delivery', label: 'Delivery Notes' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">{tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}>{t.label}</button>
      ))}</div>

      {tab === 'indents' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Material Indents</h3>
            <button onClick={() => { setForm({ notes: '' }); setIndentItems([{ description: '', quantity: 1, unit: 'nos', rate: 0, vendor_id: '' }]); setModal('indent'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Indent</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Indent No</th><th>Date</th><th>Created By</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {indents.map(i => (
                <tr key={i.id}>
                  <td className="font-medium">{i.indent_number}</td><td>{i.indent_date}</td><td>{i.created_by_name}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>
                    {i.status === 'submitted' && (
                      <div className="flex gap-1">
                        <button onClick={() => approveIndent(i.id, 'approved')} className="btn btn-success text-xs py-1 px-2">Approve</button>
                        <button onClick={() => approveIndent(i.id, 'rejected')} className="btn btn-danger text-xs py-1 px-2">Reject</button>
                      </div>
                    )}
                    {i.status === 'draft' && <button onClick={() => approveIndent(i.id, 'submitted')} className="btn btn-primary text-xs py-1 px-2">Submit</button>}
                  </td>
                </tr>
              ))}
              {indents.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">No indents yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'vendorpo' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Vendor Purchase Orders</h3>
            <button onClick={() => { setForm({ indent_id: '', vendor_id: '', total_amount: 0, advance_required: false }); setModal('vendorpo'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Vendor PO</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>PO Number</th><th>Vendor</th><th>Amount</th><th>Advance</th><th>Status</th></tr></thead>
            <tbody>
              {vendorPos.map(v => (
                <tr key={v.id}>
                  <td className="font-medium">{v.po_number}</td><td>{v.vendor_name}</td><td>Rs {v.total_amount?.toLocaleString()}</td>
                  <td>{v.advance_required ? (v.advance_paid ? 'Paid' : 'Required') : 'N/A'}</td>
                  <td><StatusBadge status={v.status} /></td>
                </tr>
              ))}
              {vendorPos.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">No vendor POs yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'bills' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Purchase Bills</h3>
            <button onClick={() => { setForm({ vendor_id: '', bill_number: '', bill_date: '', amount: 0, gst_amount: 0, total_amount: 0 }); setModal('bill'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Bill</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Bill No</th><th>Vendor</th><th>Date</th><th>Amount</th><th>GST</th><th>Total</th><th>Payment</th></tr></thead>
            <tbody>
              {purchaseBills.map(b => (
                <tr key={b.id}>
                  <td className="font-medium">{b.bill_number}</td><td>{b.vendor_name}</td><td>{b.bill_date}</td>
                  <td>Rs {b.amount?.toLocaleString()}</td><td>Rs {b.gst_amount?.toLocaleString()}</td>
                  <td className="font-semibold">Rs {b.total_amount?.toLocaleString()}</td>
                  <td><StatusBadge status={b.payment_status} /></td>
                </tr>
              ))}
              {purchaseBills.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">No bills yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'delivery' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Delivery Notes & Receiving</h3>
            <button onClick={() => { setForm({ vendor_po_id: '', delivery_date: '', notes: '' }); setModal('delivery'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Note</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>ID</th><th>Date</th><th>Received By</th><th>Status</th></tr></thead>
            <tbody>
              {deliveryNotes.map(d => (
                <tr key={d.id}>
                  <td>#{d.id}</td><td>{d.delivery_date}</td><td>{d.received_by_name}</td>
                  <td><StatusBadge status={d.status} /></td>
                </tr>
              ))}
              {deliveryNotes.length === 0 && <tr><td colSpan="4" className="text-center py-8 text-gray-400">No delivery notes yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {/* Indent Modal */}
      <Modal isOpen={modal === 'indent'} onClose={() => setModal(false)} title="Create Indent" wide>
        <form onSubmit={saveIndent} className="space-y-4">
          <h4 className="font-semibold text-sm">Items</h4>
          {indentItems.map((item, i) => (
            <div key={i} className="grid grid-cols-6 gap-2">
              <input className="input col-span-2" placeholder="Description" value={item.description} onChange={e => { const n = [...indentItems]; n[i].description = e.target.value; setIndentItems(n); }} />
              <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={e => { const n = [...indentItems]; n[i].quantity = +e.target.value; setIndentItems(n); }} />
              <input className="input" placeholder="Unit" value={item.unit} onChange={e => { const n = [...indentItems]; n[i].unit = e.target.value; setIndentItems(n); }} />
              <input className="input" type="number" placeholder="Rate" value={item.rate} onChange={e => { const n = [...indentItems]; n[i].rate = +e.target.value; setIndentItems(n); }} />
              <select className="select" value={item.vendor_id} onChange={e => { const n = [...indentItems]; n[i].vendor_id = e.target.value; setIndentItems(n); }}>
                <option value="">Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          ))}
          <button type="button" onClick={() => setIndentItems([...indentItems, { description: '', quantity: 1, unit: 'nos', rate: 0, vendor_id: '' }])} className="btn btn-secondary text-xs">+ Add Item</button>
          <div><label className="label">Notes</label><textarea className="input" rows="2" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>

      {/* Vendor PO Modal */}
      <Modal isOpen={modal === 'vendorpo'} onClose={() => setModal(false)} title="Create Vendor PO">
        <form onSubmit={saveVendorPo} className="space-y-4">
          <div><label className="label">Indent</label><select className="select" value={form.indent_id} onChange={e => setForm({...form, indent_id: e.target.value})}><option value="">Select</option>{indents.filter(i => i.status === 'approved').map(i => <option key={i.id} value={i.id}>{i.indent_number}</option>)}</select></div>
          <div><label className="label">Vendor *</label><select className="select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} required><option value="">Select</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div><label className="label">Total Amount</label><input className="input" type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount: +e.target.value})} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.advance_required} onChange={e => setForm({...form, advance_required: e.target.checked})} /> Advance Required</label>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>

      {/* Purchase Bill Modal */}
      <Modal isOpen={modal === 'bill'} onClose={() => setModal(false)} title="Add Purchase Bill">
        <form onSubmit={savePurchaseBill} className="space-y-4">
          <div><label className="label">Vendor *</label><select className="select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} required><option value="">Select</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Bill Number</label><input className="input" value={form.bill_number} onChange={e => setForm({...form, bill_number: e.target.value})} /></div>
            <div><label className="label">Bill Date</label><input className="input" type="date" value={form.bill_date} onChange={e => setForm({...form, bill_date: e.target.value})} /></div>
            <div><label className="label">Amount</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: +e.target.value, total_amount: +e.target.value + (form.gst_amount || 0)})} /></div>
            <div><label className="label">GST Amount</label><input className="input" type="number" value={form.gst_amount} onChange={e => setForm({...form, gst_amount: +e.target.value, total_amount: (form.amount || 0) + +e.target.value})} /></div>
          </div>
          <div><label className="label">Total</label><input className="input" type="number" value={form.total_amount} readOnly /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Modal>

      {/* Delivery Note Modal */}
      <Modal isOpen={modal === 'delivery'} onClose={() => setModal(false)} title="Add Delivery Note">
        <form onSubmit={saveDeliveryNote} className="space-y-4">
          <div><label className="label">Vendor PO</label><select className="select" value={form.vendor_po_id} onChange={e => setForm({...form, vendor_po_id: e.target.value})}><option value="">Select</option>{vendorPos.map(v => <option key={v.id} value={v.id}>{v.po_number} - {v.vendor_name}</option>)}</select></div>
          <div><label className="label">Delivery Date</label><input className="input" type="date" value={form.delivery_date} onChange={e => setForm({...form, delivery_date: e.target.value})} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
