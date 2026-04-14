import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiUpload, FiEdit2, FiExternalLink, FiEye } from 'react-icons/fi';
import SearchableSelect from '../components/SearchableSelect';

export default function Orders() {
  const [tab, setTab] = useState('po');
  const [pos, setPos] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [bbEntries, setBbEntries] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [poItems, setPoItems] = useState([{ item_master_id: '', description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
  const [masterItems, setMasterItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editingPO, setEditingPO] = useState(null);

  const load = () => {
    api.get('/orders/po').then(r => setPos(r.data));
    api.get('/orders/planning').then(r => setPlanning(r.data));
  };

  useEffect(() => {
    load();
    api.get('/orders/business-book-entries').then(r => setBbEntries(r.data));
    api.get('/item-master/dropdown?type=PO').then(r => setMasterItems(r.data)).catch(() => {});
  }, []);

  const addItem = () => setPoItems([...poItems, { item_master_id: '', description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
  const removeItem = (i) => setPoItems(poItems.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) => {
    const items = [...poItems];
    items[i][key] = val;
    if (key === 'quantity' || key === 'rate') items[i].amount = (items[i].quantity || 0) * (items[i].rate || 0);
    setPoItems(items);
  };

  const handleBBSelect = (bbId) => {
    const bb = bbEntries.find(b => b.id === +bbId);
    if (bb) {
      setForm({ ...form, business_book_id: bb.id, po_number: '', total_amount: bb.po_amount || bb.sale_amount_without_gst || 0 });
    } else {
      setForm({ ...form, business_book_id: '' });
    }
  };

  const handleEditPO = (po) => {
    setEditingPO(po);
    setForm({
      business_book_id: po.business_book_id || '',
      po_number: po.po_number, po_date: po.po_date, total_amount: po.total_amount || 0,
      advance_amount: po.advance_amount || 0, po_copy_link: po.po_copy_link || '',
      pt_advance: po.pt_advance || '', pt_delivery: po.pt_delivery || '',
      pt_installation: po.pt_installation || '', pt_commissioning: po.pt_commissioning || '',
      pt_retention: po.pt_retention || '', status: po.status || 'received'
    });
    // Load existing PO items
    api.get(`/orders/po/${po.id}/items`).then(r => {
      setPoItems(r.data.length > 0 ? r.data.map(i => ({ ...i, item_master_id: i.item_master_id || '' })) : [{ item_master_id: '', description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
    }).catch(() => setPoItems([{ item_master_id: '', description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]));
    setModal('po');
  };

  const savePo = async (e) => {
    e.preventDefault();
    try {
      if (editingPO) {
        await api.put(`/orders/po/${editingPO.id}`, { ...form });
        await api.post(`/orders/po/${editingPO.id}/items`, { items: poItems.filter(item => item.description && item.description.trim()) });
        toast.success('PO updated');
      } else {
        await api.post('/orders/po', { ...form, items: poItems.filter(item => item.description && item.description.trim()) });
        toast.success('PO created');
      }
      setModal(false); setEditingPO(null);
      setPoItems([{ item_master_id: '', description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const savePlanning = async (e) => {
    e.preventDefault();
    await api.post('/orders/planning', form);
    toast.success('Planning created');
    setModal(false); load();
  };

  const itemsTotal = poItems.reduce((s, i) => s + (i.amount || 0), 0);
  const paymentTotal = (+(form.pt_advance || 0)) + (+(form.pt_delivery || 0)) + (+(form.pt_installation || 0)) + (+(form.pt_commissioning || 0)) + (+(form.pt_retention || 0));

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
              setEditingPO(null);
              setForm({ business_book_id: '', po_number: '', po_date: '', total_amount: 0, advance_amount: 0, po_copy_link: '', pt_advance: '', pt_delivery: '', pt_installation: '', pt_commissioning: '', pt_retention: '' });
              setPoItems([{ item_master_id: '', description: '', quantity: 0, unit: 'nos', rate: 0, amount: 0, hsn_code: '' }]);
              setModal('po');
            }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add PO</button>
          </div>
          <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table>
            <thead><tr><th>PO Number</th><th>Lead No</th><th>Client</th><th>Project</th><th>Category</th><th>Date</th><th>Amount</th><th>PO Copy</th><th>Status</th><th>Actions</th></tr></thead>
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
                  <td>{p.po_copy_link ? <a href={p.po_copy_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs"><FiExternalLink size={12} /> View</a> : <span className="text-gray-400 text-xs">-</span>}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <button onClick={() => handleEditPO(p)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit"><FiEdit2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {pos.length === 0 && <tr><td colSpan="10" className="text-center py-8 text-gray-400">No orders yet</td></tr>}
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
                <tr key={p.id}><td>{p.po_number}</td><td>{p.client_name}</td><td>{p.planned_start}</td><td>{p.planned_end}</td><td><StatusBadge status={p.status} /></td></tr>
              ))}
              {planning.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">No plans yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {/* Add PO Modal */}
      <Modal isOpen={modal === 'po'} onClose={() => { setModal(false); setEditingPO(null); }} title={editingPO ? `Edit PO - ${editingPO.po_number}` : 'Upload Client Purchase Order'} wide>
        <form onSubmit={savePo} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          {/* 1. Business Book Entry */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Select Business Book Entry</h4>
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

          {/* 2. PO Upload & Details */}
          <div className="border rounded-lg p-3 bg-blue-50">
            <h4 className="font-semibold text-sm text-blue-700 mb-3">Purchase Order Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">PO Number *</label><input className="input" value={form.po_number || ''} onChange={e => setForm({ ...form, po_number: e.target.value })} required /></div>
              <div><label className="label">PO Date *</label><input className="input" type="date" value={form.po_date || ''} onChange={e => setForm({ ...form, po_date: e.target.value })} required /></div>
              <div><label className="label">Total Amount (Rs)</label><input className="input" type="number" value={form.total_amount || 0} onChange={e => setForm({ ...form, total_amount: +e.target.value })} /></div>
              {editingPO && <div><label className="label">Status</label><select className="select" value={form.status || 'received'} onChange={e => setForm({ ...form, status: e.target.value })}><option value="received">Received</option><option value="booked">Booked</option><option value="planning">Planning</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></div>}
              <div>
                <label className="label flex items-center gap-2"><FiUpload size={14} /> Upload PO Copy</label>
                {form.po_copy_link ? (
                  <div className="flex items-center gap-2">
                    <a href={form.po_copy_link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline truncate flex-1">{form.po_copy_link.split('/').pop()}</a>
                    <button type="button" onClick={() => setForm({ ...form, po_copy_link: '' })} className="text-red-500 text-xs">Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setUploading(true);
                      try {
                        const fd = new FormData(); fd.append('file', file);
                        const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                        setForm(f => ({ ...f, po_copy_link: res.data.url }));
                        toast.success(`Uploaded: ${res.data.filename}`);
                      } catch { toast.error('Upload failed'); }
                      setUploading(false); e.target.value = '';
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                )}
                {uploading && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
              </div>
            </div>
          </div>

          {/* 3. Payment Terms */}
          <div className="border rounded-lg p-3 bg-emerald-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm text-emerald-700">Payment Terms (%)</h4>
              <span className={`text-xs font-bold ${paymentTotal === 100 ? 'text-emerald-600' : paymentTotal > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                Total: {paymentTotal}% {paymentTotal === 100 ? '(Valid)' : paymentTotal > 100 ? '(Exceeds 100%)' : ''}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="label text-xs">Advance %</label>
                <input className="input text-center" type="number" min="0" max="100" value={form.pt_advance || ''} onChange={e => setForm({ ...form, pt_advance: e.target.value })} placeholder="%" />
              </div>
              <div>
                <label className="label text-xs">Against Delivery %</label>
                <input className="input text-center" type="number" min="0" max="100" value={form.pt_delivery || ''} onChange={e => setForm({ ...form, pt_delivery: e.target.value })} placeholder="%" />
              </div>
              <div>
                <label className="label text-xs">Against Installation %</label>
                <input className="input text-center" type="number" min="0" max="100" value={form.pt_installation || ''} onChange={e => setForm({ ...form, pt_installation: e.target.value })} placeholder="%" />
              </div>
              <div>
                <label className="label text-xs">Testing & Commissioning %</label>
                <input className="input text-center" type="number" min="0" max="100" value={form.pt_commissioning || ''} onChange={e => setForm({ ...form, pt_commissioning: e.target.value })} placeholder="%" />
              </div>
              <div>
                <label className="label text-xs">Retention %</label>
                <input className="input text-center" type="number" min="0" max="100" value={form.pt_retention || ''} onChange={e => setForm({ ...form, pt_retention: e.target.value })} placeholder="%" />
              </div>
            </div>
            {form.total_amount > 0 && paymentTotal > 0 && (
              <div className="mt-3 pt-2 border-t border-emerald-200 grid grid-cols-5 gap-3 text-xs text-emerald-700">
                <div className="text-center"><span className="font-bold">Rs {Math.round((form.total_amount * (form.pt_advance || 0)) / 100).toLocaleString()}</span></div>
                <div className="text-center"><span className="font-bold">Rs {Math.round((form.total_amount * (form.pt_delivery || 0)) / 100).toLocaleString()}</span></div>
                <div className="text-center"><span className="font-bold">Rs {Math.round((form.total_amount * (form.pt_installation || 0)) / 100).toLocaleString()}</span></div>
                <div className="text-center"><span className="font-bold">Rs {Math.round((form.total_amount * (form.pt_commissioning || 0)) / 100).toLocaleString()}</span></div>
                <div className="text-center"><span className="font-bold">Rs {Math.round((form.total_amount * (form.pt_retention || 0)) / 100).toLocaleString()}</span></div>
              </div>
            )}
          </div>

          {/* 4. PO Items */}
          <div className="border rounded-lg p-3 bg-indigo-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm text-indigo-700">PO Items (Item-wise Entry)</h4>
              <button type="button" onClick={addItem} className="btn btn-secondary text-xs flex items-center gap-1"><FiPlus size={12} /> Add Item</button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-1">
                <div className="col-span-4">Description</div><div>Qty</div><div>Unit</div><div className="col-span-2">Rate</div><div className="col-span-2">Amount</div><div>HSN</div><div></div>
              </div>
              {poItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <SearchableSelect
                      options={masterItems.map(mi => ({ id: mi.id, label: `[${mi.item_code}] ${mi.display_name}`, ...mi }))}
                      value={item.item_master_id || null}
                      valueKey="id"
                      displayKey="label"
                      placeholder="Type to search items..."
                      onChange={(mi) => {
                        const items = [...poItems];
                        items[i].item_master_id = mi?.id || '';
                        items[i].description = mi?.display_name || '';
                        items[i].unit = mi?.uom?.toLowerCase() || items[i].unit;
                        items[i].rate = mi?.current_price || items[i].rate;
                        items[i].amount = (items[i].quantity || 0) * (items[i].rate || 0);
                        setPoItems(items);
                      }}
                    />
                  </div>
                  <input className="input text-sm" type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
                  <select className="select text-sm" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                    <option>nos</option><option>mtr</option><option>kg</option><option>sqm</option><option>rft</option><option>set</option><option>lot</option><option>pair</option>
                  </select>
                  <input className="input col-span-2 text-sm" type="number" value={item.rate} onChange={e => updateItem(i, 'rate', +e.target.value)} />
                  <div className="col-span-2 text-sm font-medium text-gray-700 px-2">Rs {(item.amount || 0).toLocaleString()}</div>
                  <input className="input text-sm" placeholder="HSN" value={item.hsn_code || ''} onChange={e => updateItem(i, 'hsn_code', e.target.value)} />
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600">{poItems.length > 1 && <FiTrash2 size={14} />}</button>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-indigo-200 flex justify-between text-sm">
              <span className="text-indigo-600 font-medium">{poItems.filter(i => i.description).length} items</span>
              <span className="font-bold text-indigo-800">Items Total: Rs {itemsTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setModal(false); setEditingPO(null); }} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{editingPO ? 'Update Purchase Order' : 'Create Purchase Order'}</button>
          </div>
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
