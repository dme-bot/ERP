import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

export default function Orders() {
  const [tab, setTab] = useState('po');
  const [pos, setPos] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [bbEntries, setBbEntries] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [poItems, setPoItems] = useState([{ description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);

  const load = () => {
    api.get('/orders/po').then(r => setPos(r.data));
    api.get('/orders/planning').then(r => setPlanning(r.data));
  };

  useEffect(() => {
    load();
    api.get('/orders/business-book-entries').then(r => setBbEntries(r.data));
  }, []);

  const addItem = () => setPoItems([...poItems, { description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
  const removeItem = (i) => setPoItems(poItems.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) => {
    const items = [...poItems];
    items[i][key] = val;
    if (key === 'quantity' || key === 'rate') {
      items[i].amount = (items[i].quantity || 0) * (items[i].rate || 0);
    }
    setPoItems(items);
  };

  const handleBBSelect = (bbId) => {
    const bb = bbEntries.find(b => b.id === +bbId);
    if (bb) {
      setForm({
        ...form,
        business_book_id: bb.id,
        po_number: bb.po_number || '',
        total_amount: bb.po_amount || bb.sale_amount_without_gst || 0,
      });
    } else {
      setForm({ ...form, business_book_id: '' });
    }
  };

  const savePo = async (e) => {
    e.preventDefault();
    try {
      await api.post('/orders/po', {
        ...form,
        items: poItems.filter(item => item.description && item.description.trim())
      });
      toast.success('PO created with items');
      setModal(false);
      setPoItems([{ description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const savePlanning = async (e) => {
    e.preventDefault();
    await api.post('/orders/planning', form);
    toast.success('Planning created');
    setModal(false); load();
  };

  const itemsTotal = poItems.reduce((s, i) => s + (i.amount || 0), 0);

  const tabs = [
    { id: 'po', label: 'Purchase Orders' },
    { id: 'planning', label: 'Order Planning' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">{tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}>{t.label}</button>
      ))}</div>

      {tab === 'po' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Client Purchase Orders</h3>
            <button onClick={() => {
              setForm({ business_book_id: '', po_number: '', po_date: '', total_amount: 0, advance_amount: 0 });
              setPoItems([{ description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
              setModal('po');
            }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add PO</button>
          </div>
          <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table>
            <thead><tr><th>PO Number</th><th>Lead No</th><th>Client</th><th>Project</th><th>Category</th><th>Date</th><th>Amount</th><th>Advance</th><th>Status</th></tr></thead>
            <tbody>
              {pos.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.po_number}</td>
                  <td className="text-blue-600 font-bold">{p.lead_no || '-'}</td>
                  <td>{p.bb_client || p.company_name || '-'}</td>
                  <td>{p.bb_project || '-'}</td>
                  <td>{p.bb_category || '-'}</td>
                  <td>{p.po_date}</td>
                  <td className="font-semibold">Rs {p.total_amount?.toLocaleString()}</td>
                  <td>Rs {p.advance_amount?.toLocaleString()}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {pos.length === 0 && <tr><td colSpan="9" className="text-center py-8 text-gray-400">No orders yet</td></tr>}
            </tbody>
          </table></div></div>
        </>
      )}

      {tab === 'planning' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Order Planning</h3>
            <button onClick={() => { setForm({ po_id: '', business_book_id: '', planned_start: '', planned_end: '', notes: '' }); setModal('planning'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Plan</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>PO</th><th>Client</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>
              {planning.map(p => (
                <tr key={p.id}>
                  <td>{p.po_number}</td><td>{p.client_name}</td>
                  <td>{p.planned_start}</td><td>{p.planned_end}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {planning.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">No plans yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {/* Add PO Modal */}
      <Modal isOpen={modal === 'po'} onClose={() => setModal(false)} title="Add Purchase Order" wide>
        <form onSubmit={savePo} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded font-medium">Select a Business Book entry to auto-link client, project, and site.</p>

          {/* Business Book Entry Selection */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Business Book Entry</h4>
            <select className="select" value={form.business_book_id || ''} onChange={e => handleBBSelect(e.target.value)}>
              <option value="">-- Select Business Book Entry --</option>
              {bbEntries.map(bb => (
                <option key={bb.id} value={bb.id}>
                  {bb.lead_no} | {bb.client_name} | {bb.project_name || bb.company_name} | {bb.category || '-'} | Rs {(bb.sale_amount_without_gst || 0).toLocaleString()}
                </option>
              ))}
            </select>
            {form.business_book_id && (() => {
              const bb = bbEntries.find(b => b.id === +form.business_book_id);
              return bb ? (
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div><span className="text-gray-400">Client:</span> <span className="font-medium">{bb.client_name}</span></div>
                  <div><span className="text-gray-400">Company:</span> <span className="font-medium">{bb.company_name}</span></div>
                  <div><span className="text-gray-400">Project:</span> <span className="font-medium">{bb.project_name}</span></div>
                  <div><span className="text-gray-400">Category:</span> <span className="font-medium">{bb.category}</span></div>
                </div>
              ) : null;
            })()}
          </div>

          {/* PO Details */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">PO Number *</label><input className="input" value={form.po_number || ''} onChange={e => setForm({ ...form, po_number: e.target.value })} required /></div>
            <div><label className="label">PO Date *</label><input className="input" type="date" value={form.po_date || ''} onChange={e => setForm({ ...form, po_date: e.target.value })} required /></div>
            <div><label className="label">Total Amount</label><input className="input" type="number" value={form.total_amount || 0} onChange={e => setForm({ ...form, total_amount: +e.target.value })} /></div>
            <div><label className="label">Advance Amount</label><input className="input" type="number" value={form.advance_amount || 0} onChange={e => setForm({ ...form, advance_amount: +e.target.value })} /></div>
          </div>

          {/* PO Items */}
          <div className="border rounded-lg p-3 bg-blue-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm text-blue-700">PO Items (Item-wise Entry)</h4>
              <button type="button" onClick={addItem} className="btn btn-secondary text-xs flex items-center gap-1"><FiPlus size={12} /> Add Item</button>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-1">
                <div className="col-span-4">Description</div>
                <div>Qty</div>
                <div>Unit</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">Amount</div>
                <div>HSN</div>
                <div></div>
              </div>

              {poItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-4 text-sm" placeholder="Item description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                  <input className="input text-sm" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
                  <select className="select text-sm" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                    <option>nos</option><option>mtr</option><option>kg</option><option>sqm</option><option>rft</option><option>set</option><option>lot</option><option>pair</option>
                  </select>
                  <input className="input col-span-2 text-sm" type="number" placeholder="Rate" value={item.rate} onChange={e => updateItem(i, 'rate', +e.target.value)} />
                  <div className="col-span-2 text-sm font-medium text-gray-700 px-2">Rs {(item.amount || 0).toLocaleString()}</div>
                  <input className="input text-sm" placeholder="HSN" value={item.hsn_code || ''} onChange={e => updateItem(i, 'hsn_code', e.target.value)} />
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600" title="Remove">
                    {poItems.length > 1 && <FiTrash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-2 border-t border-blue-200 flex justify-between text-sm">
              <span className="text-blue-600 font-medium">{poItems.filter(i => i.description).length} items</span>
              <span className="font-bold text-blue-800">Items Total: Rs {itemsTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create PO with Items</button></div>
        </form>
      </Modal>

      {/* Order Planning Modal */}
      <Modal isOpen={modal === 'planning'} onClose={() => setModal(false)} title="Create Order Plan">
        <form onSubmit={savePlanning} className="space-y-4">
          <div><label className="label">Purchase Order</label><select className="select" value={form.po_id || ''} onChange={e => setForm({ ...form, po_id: e.target.value })}><option value="">Select</option>{pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Planned Start</label><input className="input" type="date" value={form.planned_start || ''} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
            <div><label className="label">Planned End</label><input className="input" type="date" value={form.planned_end || ''} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>
    </div>
  );
}
