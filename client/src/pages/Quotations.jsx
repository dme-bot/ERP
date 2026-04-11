import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';

export default function Quotations() {
  const [tab, setTab] = useState('boq');
  const [boqs, setBoqs] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [boqItems, setBoqItems] = useState([{ description: '', quantity: 1, unit: 'nos', rate: 0 }]);

  useEffect(() => {
    api.get('/quotations/boq').then(r => setBoqs(r.data));
    api.get('/quotations').then(r => setQuotations(r.data));
    api.get('/leads').then(r => setLeads(r.data));
  }, []);

  const reload = () => {
    api.get('/quotations/boq').then(r => setBoqs(r.data));
    api.get('/quotations').then(r => setQuotations(r.data));
  };

  const addBoqItem = () => setBoqItems([...boqItems, { description: '', quantity: 1, unit: 'nos', rate: 0 }]);

  const createBoq = async (e) => {
    e.preventDefault();
    await api.post('/quotations/boq', { ...form, items: boqItems });
    toast.success('BOQ created');
    setModal(false);
    reload();
  };

  const createQuotation = async (e) => {
    e.preventDefault();
    await api.post('/quotations', form);
    toast.success('Quotation created');
    setModal(false);
    reload();
  };

  const updateQuotation = async (id, status) => {
    const q = quotations.find(x => x.id === id);
    await api.put(`/quotations/${id}`, { ...q, status });
    toast.success('Status updated');
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('boq')} className={`btn ${tab === 'boq' ? 'btn-primary' : 'btn-secondary'}`}>BOQ / Drawings</button>
        <button onClick={() => setTab('quotations')} className={`btn ${tab === 'quotations' ? 'btn-primary' : 'btn-secondary'}`}>Quotations</button>
      </div>

      {tab === 'boq' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Bill of Quantities</h3>
            <button onClick={() => { setForm({ lead_id: '', title: '', drawing_required: false }); setBoqItems([{ description: '', quantity: 1, unit: 'nos', rate: 0 }]); setModal('boq'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create BOQ</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table>
              <thead><tr><th>Title</th><th>Client</th><th>Drawing</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {boqs.map(b => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.title}</td>
                    <td>{b.company_name}</td>
                    <td>{b.drawing_required ? 'Yes' : 'No'}</td>
                    <td>Rs {b.total_amount?.toLocaleString()}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="text-gray-500">{new Date(b.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {boqs.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No BOQs yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'quotations' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Quotations</h3>
            <button onClick={() => { setForm({ lead_id: '', boq_id: '', total_amount: 0, discount: 0, final_amount: 0, valid_until: '', notes: '' }); setModal('quotation'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Quotation</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table>
              <thead><tr><th>Number</th><th>Client</th><th>Total</th><th>Discount</th><th>Final</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id}>
                    <td className="font-medium">{q.quotation_number}</td>
                    <td>{q.company_name}</td>
                    <td>Rs {q.total_amount?.toLocaleString()}</td>
                    <td>Rs {q.discount?.toLocaleString()}</td>
                    <td className="font-semibold">Rs {q.final_amount?.toLocaleString()}</td>
                    <td><StatusBadge status={q.status} /></td>
                    <td>
                      <select className="select w-32" value={q.status} onChange={e => updateQuotation(q.id, e.target.value)}>
                        {['draft','sent','negotiation','accepted','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {quotations.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">No quotations yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* BOQ Modal */}
      <Modal isOpen={modal === 'boq'} onClose={() => setModal(false)} title="Create BOQ" wide>
        <form onSubmit={createBoq} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lead / Client</label>
              <select className="select" value={form.lead_id} onChange={e => setForm({...form, lead_id: e.target.value})}>
                <option value="">Select</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
              </select>
            </div>
            <div><label className="label">Title *</label><input className="input" value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} required /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.drawing_required} onChange={e => setForm({...form, drawing_required: e.target.checked})} /> Drawing Required
          </label>
          <h4 className="font-semibold text-sm">Items</h4>
          {boqItems.map((item, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <input className="input col-span-2" placeholder="Description" value={item.description} onChange={e => { const n = [...boqItems]; n[i].description = e.target.value; setBoqItems(n); }} />
              <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={e => { const n = [...boqItems]; n[i].quantity = +e.target.value; setBoqItems(n); }} />
              <input className="input" placeholder="Unit" value={item.unit} onChange={e => { const n = [...boqItems]; n[i].unit = e.target.value; setBoqItems(n); }} />
              <input className="input" type="number" placeholder="Rate" value={item.rate} onChange={e => { const n = [...boqItems]; n[i].rate = +e.target.value; setBoqItems(n); }} />
            </div>
          ))}
          <button type="button" onClick={addBoqItem} className="btn btn-secondary text-xs">+ Add Item</button>
          <div className="text-right font-semibold">Total: Rs {boqItems.reduce((s, i) => s + i.quantity * i.rate, 0).toLocaleString()}</div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Create BOQ</button>
          </div>
        </form>
      </Modal>

      {/* Quotation Modal */}
      <Modal isOpen={modal === 'quotation'} onClose={() => setModal(false)} title="Create Quotation">
        <form onSubmit={createQuotation} className="space-y-4">
          <div>
            <label className="label">Lead / Client</label>
            <select className="select" value={form.lead_id} onChange={e => setForm({...form, lead_id: e.target.value})}>
              <option value="">Select</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">BOQ Reference</label>
            <select className="select" value={form.boq_id} onChange={e => setForm({...form, boq_id: e.target.value})}>
              <option value="">Select</option>
              {boqs.map(b => <option key={b.id} value={b.id}>{b.title} - Rs {b.total_amount?.toLocaleString()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Total Amount</label><input className="input" type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount: +e.target.value, final_amount: +e.target.value - (form.discount || 0)})} /></div>
            <div><label className="label">Discount</label><input className="input" type="number" value={form.discount} onChange={e => setForm({...form, discount: +e.target.value, final_amount: (form.total_amount || 0) - +e.target.value})} /></div>
            <div><label className="label">Final Amount</label><input className="input" type="number" value={form.final_amount} readOnly /></div>
          </div>
          <div><label className="label">Valid Until</label><input className="input" type="date" value={form.valid_until} onChange={e => setForm({...form, valid_until: e.target.value})} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
