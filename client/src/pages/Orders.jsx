import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus } from 'react-icons/fi';

export default function Orders() {
  const [tab, setTab] = useState('po');
  const [pos, setPos] = useState([]);
  const [book, setBook] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [leads, setLeads] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});

  const load = () => {
    api.get('/orders/po').then(r => setPos(r.data));
    api.get('/orders/business-book').then(r => setBook(r.data));
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

  const saveBook = async (e) => {
    e.preventDefault();
    await api.post('/orders/business-book', form);
    toast.success('Added to business book');
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
    { id: 'book', label: 'Business Book' },
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

      {tab === 'book' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Master Business Book</h3>
            <button onClick={() => { setForm({ po_id: '', lead_type: 'Private', client_name: '', company_name: '', project_name: '', client_contact: '', source_of_enquiry: '', district: '', state: '', billing_address: '', shipping_address: '', guarantee_required: false, sale_amount_without_gst: 0, po_amount: 0, order_type: 'Supply', penalty_clause: '', committed_start_date: '', committed_delivery_date: '', committed_completion_date: '', category: '', customer_type: '', management_person_name: '', management_person_contact: '', employee_assigned: '', employee_id: '', tpa_items_count: 0, tpa_material_amount: 0, tpa_labour_amount: 0, advance_received: 0, remarks: '' }); setModal('book'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Business Entry</button>
          </div>
          <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">When you add an entry here, it auto-creates: Order Planning + DPR Site + Collection Engine Receivable + Cash Flow Entry</p>
          <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table>
            <thead><tr><th>Lead No</th><th>Type</th><th>Client</th><th>Company</th><th>Project</th><th>Category</th><th>Order</th><th>PO Amount</th><th>Advance</th><th>Balance</th><th>Start</th><th>Delivery</th><th>Status</th></tr></thead>
            <tbody>
              {book.map(b => (
                <tr key={b.id}>
                  <td className="font-bold text-blue-600">{b.lead_no}</td>
                  <td><span className={`badge ${b.lead_type === 'Government' ? 'badge-purple' : 'badge-blue'}`}>{b.lead_type}</span></td>
                  <td className="font-medium">{b.client_name}</td><td>{b.company_name}</td><td>{b.project_name}</td>
                  <td>{b.category}</td>
                  <td><span className="badge badge-gray">{b.order_type}</span></td>
                  <td>Rs {b.po_amount?.toLocaleString()}</td><td className="text-emerald-600">Rs {b.advance_received?.toLocaleString()}</td>
                  <td className="font-semibold text-red-600">Rs {b.balance_amount?.toLocaleString()}</td>
                  <td className="text-xs">{b.committed_start_date}</td><td className="text-xs">{b.committed_delivery_date}</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {book.length === 0 && <tr><td colSpan="13" className="text-center py-8 text-gray-400">No entries yet</td></tr>}
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

      <Modal isOpen={modal === 'book'} onClose={() => setModal(false)} title="Master Business Book Entry" wide>
        <form onSubmit={saveBook} className="space-y-4">
          <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded font-medium">Lead No. will be auto-generated (SEPL format). This entry will auto-create: Order Planning + DPR Site + Receivable + Cash Flow.</p>

          {/* Section 1: Client Details */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Client & Company Details</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Lead Type</label><select className="select" value={form.lead_type} onChange={e => setForm({...form, lead_type: e.target.value})}><option value="Private">Private</option><option value="Government">Government</option></select></div>
              <div><label className="label">Client Name *</label><input className="input" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} required /></div>
              <div><label className="label">Company/Department</label><input className="input" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
              <div><label className="label">Client Contact No.</label><input className="input" value={form.client_contact} onChange={e => setForm({...form, client_contact: e.target.value})} /></div>
              <div><label className="label">Source of Enquiry</label><select className="select" value={form.source_of_enquiry} onChange={e => setForm({...form, source_of_enquiry: e.target.value})}><option value="">Select</option><option>Inbound Enquiry</option><option>Indiamart Enquiry</option><option>WhatsApp</option><option>LinkedIn</option><option>Reference</option><option>Tender</option><option>Other</option></select></div>
              <div><label className="label">Customer Type</label><input className="input" value={form.customer_type} onChange={e => setForm({...form, customer_type: e.target.value})} placeholder="Hospital, Factory, etc." /></div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Location & Address</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">District</label><input className="input" value={form.district} onChange={e => setForm({...form, district: e.target.value})} /></div>
              <div><label className="label">State</label><input className="input" value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
              <div><label className="label">Billing Address</label><input className="input" value={form.billing_address} onChange={e => setForm({...form, billing_address: e.target.value})} /></div>
              <div className="col-span-2"><label className="label">Shipping / Site Address</label><input className="input" value={form.shipping_address} onChange={e => setForm({...form, shipping_address: e.target.value})} /></div>
            </div>
          </div>

          {/* Section 3: Project & Order */}
          <div className="border rounded-lg p-3 bg-blue-50">
            <h4 className="font-semibold text-sm text-blue-700 mb-3">Project & Order Details</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Project Name</label><input className="input" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} /></div>
              <div><label className="label">Purchase Order</label><select className="select" value={form.po_id} onChange={e => setForm({...form, po_id: e.target.value})}><option value="">Select (optional)</option>{pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}</select></div>
              <div><label className="label">Order Type</label><select className="select" value={form.order_type} onChange={e => setForm({...form, order_type: e.target.value})}><option value="Supply">Supply</option><option value="SITC">SITC (Supply, Install, Test, Commission)</option><option value="AMC">AMC</option><option value="Service">Service</option></select></div>
              <div><label className="label">Category</label><select className="select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}><option value="">Select</option><option>Low Voltage</option><option>Fire Fighting</option><option>Fire Alarm</option><option>CCTV</option><option>Access Control</option><option>PA System</option><option>Networking</option><option>Solar</option><option>Other</option></select></div>
              <div><label className="label">Guarantee Required</label><select className="select" value={form.guarantee_required ? 'Yes' : 'No'} onChange={e => setForm({...form, guarantee_required: e.target.value === 'Yes'})}><option value="No">No</option><option value="Yes">Yes</option></select></div>
              <div><label className="label">Penalty Clause</label><input className="input" value={form.penalty_clause} onChange={e => setForm({...form, penalty_clause: e.target.value})} /></div>
            </div>
          </div>

          {/* Section 4: Amounts */}
          <div className="border rounded-lg p-3 bg-emerald-50">
            <h4 className="font-semibold text-sm text-emerald-700 mb-3">Financial Details</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Sale Amount (Without GST)</label><input className="input" type="number" value={form.sale_amount_without_gst} onChange={e => setForm({...form, sale_amount_without_gst: +e.target.value})} /></div>
              <div><label className="label">PO Amount (With GST)</label><input className="input" type="number" value={form.po_amount} onChange={e => setForm({...form, po_amount: +e.target.value})} /></div>
              <div><label className="label">Advance Received</label><input className="input" type="number" value={form.advance_received} onChange={e => setForm({...form, advance_received: +e.target.value})} /></div>
              <div><label className="label">TPA Items Count</label><input className="input" type="number" value={form.tpa_items_count} onChange={e => setForm({...form, tpa_items_count: +e.target.value})} /></div>
              <div><label className="label">TPA Material Amount</label><input className="input" type="number" value={form.tpa_material_amount} onChange={e => setForm({...form, tpa_material_amount: +e.target.value})} /></div>
              <div><label className="label">TPA Labour Amount</label><input className="input" type="number" value={form.tpa_labour_amount} onChange={e => setForm({...form, tpa_labour_amount: +e.target.value})} /></div>
            </div>
          </div>

          {/* Section 5: Committed Dates */}
          <div className="border rounded-lg p-3 bg-amber-50">
            <h4 className="font-semibold text-sm text-amber-700 mb-3">Committed Dates</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Committed Start Date</label><input className="input" type="date" value={form.committed_start_date} onChange={e => setForm({...form, committed_start_date: e.target.value})} /></div>
              <div><label className="label">Committed Delivery Date</label><input className="input" type="date" value={form.committed_delivery_date} onChange={e => setForm({...form, committed_delivery_date: e.target.value})} /></div>
              <div><label className="label">Committed Completion Date</label><input className="input" type="date" value={form.committed_completion_date} onChange={e => setForm({...form, committed_completion_date: e.target.value})} /></div>
            </div>
          </div>

          {/* Section 6: People */}
          <div className="border rounded-lg p-3 bg-purple-50">
            <h4 className="font-semibold text-sm text-purple-700 mb-3">People & Management</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Management Person Name</label><input className="input" value={form.management_person_name} onChange={e => setForm({...form, management_person_name: e.target.value})} /></div>
              <div><label className="label">Management Person Contact</label><input className="input" value={form.management_person_contact} onChange={e => setForm({...form, management_person_contact: e.target.value})} /></div>
              <div><label className="label">Employee Assigned</label><input className="input" value={form.employee_assigned} onChange={e => setForm({...form, employee_assigned: e.target.value})} /></div>
            </div>
          </div>

          <div><label className="label">Remarks</label><textarea className="input" rows="2" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} /></div>

          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create Master Business Entry</button></div>
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
