import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus } from 'react-icons/fi';

export default function Orders() {
  const [tab, setTab] = useState('po');
  const [pos, setPos] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [leads, setLeads] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});

  const load = () => {
    api.get('/orders/po').then(r => setPos(r.data));
    api.get('/orders/planning').then(r => setPlanning(r.data));
  };

  useEffect(() => {
    load();
    api.get('/leads').then(r => setLeads(r.data));
    api.get('/quotations').then(r => setQuotations(r.data));
  }, []);

  const savePo = async (e) => {
    e.preventDefault();
    await api.post('/orders/po', form);
    toast.success('PO created');
    setModal(false); load();
  };

  const savePlanning = async (e) => {
    e.preventDefault();
    await api.post('/orders/planning', form);
    toast.success('Planning created');
    setModal(false); load();
  };

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
            <button onClick={() => { setForm({ lead_id: '', quotation_id: '', po_number: '', po_date: '', total_amount: 0, advance_amount: 0 }); setModal('po'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add PO</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>PO Number</th><th>Client</th><th>Quotation</th><th>Date</th><th>Amount</th><th>Advance</th><th>Status</th></tr></thead>
            <tbody>
              {pos.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.po_number}</td><td>{p.company_name}</td><td>{p.quotation_number}</td>
                  <td>{p.po_date}</td><td>Rs {p.total_amount?.toLocaleString()}</td><td>Rs {p.advance_amount?.toLocaleString()}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {pos.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">No orders yet</td></tr>}
            </tbody>
          </table></div>
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

      <Modal isOpen={modal === 'po'} onClose={() => setModal(false)} title="Add Purchase Order">
        <form onSubmit={savePo} className="space-y-4">
          <div><label className="label">Client</label><select className="select" value={form.lead_id} onChange={e => setForm({...form, lead_id: e.target.value})}><option value="">Select</option>{leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}</select></div>
          <div><label className="label">Quotation</label><select className="select" value={form.quotation_id} onChange={e => setForm({...form, quotation_id: e.target.value})}><option value="">Select</option>{quotations.map(q => <option key={q.id} value={q.id}>{q.quotation_number}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">PO Number *</label><input className="input" value={form.po_number} onChange={e => setForm({...form, po_number: e.target.value})} required /></div>
            <div><label className="label">PO Date *</label><input className="input" type="date" value={form.po_date} onChange={e => setForm({...form, po_date: e.target.value})} required /></div>
            <div><label className="label">Total Amount</label><input className="input" type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount: +e.target.value})} /></div>
            <div><label className="label">Advance Amount</label><input className="input" type="number" value={form.advance_amount} onChange={e => setForm({...form, advance_amount: +e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'planning'} onClose={() => setModal(false)} title="Create Order Plan">
        <form onSubmit={savePlanning} className="space-y-4">
          <div><label className="label">Purchase Order</label><select className="select" value={form.po_id} onChange={e => setForm({...form, po_id: e.target.value})}><option value="">Select</option>{pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Planned Start</label><input className="input" type="date" value={form.planned_start} onChange={e => setForm({...form, planned_start: e.target.value})} /></div>
            <div><label className="label">Planned End</label><input className="input" type="date" value={form.planned_end} onChange={e => setForm({...form, planned_end: e.target.value})} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>
    </div>
  );
}
