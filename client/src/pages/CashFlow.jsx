import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiTrendingUp, FiTrendingDown, FiDollarSign, FiCalendar, FiTrash2 } from 'react-icons/fi';

export default function CashFlow() {
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [modal, setModal] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [form, setForm] = useState({ date: '', type: 'inflow', category: '', description: '', amount: 0, payment_mode: '', party_name: '' });
  const [openingBalance, setOpeningBalance] = useState(0);

  const load = () => {
    api.get('/cashflow/summary').then(r => setSummary(r.data));
    api.get(`/cashflow/entries/${selectedDate}`).then(r => setEntries(r.data));
  };
  useEffect(() => { load(); }, [selectedDate]);

  const saveEntry = async (e) => {
    e.preventDefault();
    await api.post('/cashflow/entry', { ...form, date: form.date || selectedDate });
    toast.success('Entry added');
    setModal(false); load();
  };

  const deleteEntry = async (id) => {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/cashflow/entry/${id}`);
    toast.success('Deleted'); load();
  };

  const saveOpening = async (e) => {
    e.preventDefault();
    await api.post('/cashflow/opening-balance', { date: selectedDate, opening_balance: openingBalance });
    toast.success('Opening balance set');
    setOpeningModal(false); load();
  };

  const inflowCategories = ['Collection', 'Advance Received', 'Refund', 'Investment', 'Loan', 'Other Income'];
  const outflowCategories = ['Indent Payment', 'Vendor Payment', 'Salary', 'Rent', 'Utility', 'Transport', 'Office Expense', 'Tax', 'EMI', 'Other Expense'];

  if (!summary) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl"><FiDollarSign size={24} className="text-blue-600" /></div>
          <div>
            <div className="text-2xl font-bold text-gray-800">Rs {summary.today.opening_balance?.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Opening Balance</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-xl"><FiTrendingUp size={24} className="text-emerald-600" /></div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">+ Rs {summary.today.total_inflows?.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Today's Inflows</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-xl"><FiTrendingDown size={24} className="text-red-600" /></div>
          <div>
            <div className="text-2xl font-bold text-red-600">- Rs {summary.today.total_outflows?.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Today's Outflows</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-xl"><FiDollarSign size={24} className="text-purple-600" /></div>
          <div>
            <div className="text-2xl font-bold text-purple-600">Rs {summary.today.closing_balance?.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Closing Balance</div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="font-semibold text-gray-700 mb-2">Monthly Inflows</h4>
          <div className="text-3xl font-bold text-emerald-600">Rs {summary.monthlyInflow?.toLocaleString()}</div>
        </div>
        <div className="card">
          <h4 className="font-semibold text-gray-700 mb-2">Monthly Outflows</h4>
          <div className="text-3xl font-bold text-red-600">Rs {summary.monthlyOutflow?.toLocaleString()}</div>
        </div>
      </div>

      {/* Site-wise Cash Flow */}
      {summary.siteWise?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b"><h4 className="font-semibold">Site-wise Project Value & Cash Flow</h4></div>
          <table>
            <thead><tr><th>Lead No</th><th>Site / Project Name</th><th className="text-right">Project Value</th><th className="text-right text-emerald-600">Total Inflow</th><th className="text-right text-red-600">Total Outflow</th><th className="text-right">Net</th></tr></thead>
            <tbody>
              {summary.siteWise.map((s, i) => (
                <tr key={i}>
                  <td className="text-blue-600 font-bold">{s.lead_no}</td>
                  <td className="font-medium">{s.site_name}</td>
                  <td className="text-right font-semibold">Rs {(s.project_value || 0).toLocaleString()}</td>
                  <td className="text-right text-emerald-600 font-medium">Rs {(s.total_inflow || 0).toLocaleString()}</td>
                  <td className="text-right text-red-600 font-medium">Rs {(s.total_outflow || 0).toLocaleString()}</td>
                  <td className={`text-right font-bold ${(s.total_inflow - s.total_outflow) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Rs {((s.total_inflow || 0) - (s.total_outflow || 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td></td><td>TOTAL</td>
                <td className="text-right">Rs {summary.siteWise.reduce((s, r) => s + (r.project_value || 0), 0).toLocaleString()}</td>
                <td className="text-right text-emerald-600">Rs {summary.siteWise.reduce((s, r) => s + (r.total_inflow || 0), 0).toLocaleString()}</td>
                <td className="text-right text-red-600">Rs {summary.siteWise.reduce((s, r) => s + (r.total_outflow || 0), 0).toLocaleString()}</td>
                <td className="text-right">Rs {summary.siteWise.reduce((s, r) => s + (r.total_inflow || 0) - (r.total_outflow || 0), 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Date selector + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FiCalendar className="text-gray-400" />
          <input type="date" className="input w-48" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          <button onClick={() => setOpeningModal(true)} className="btn btn-secondary text-xs">Set Opening Balance</button>
        </div>
        <button onClick={() => { setForm({ date: selectedDate, type: 'inflow', category: '', description: '', amount: 0, payment_mode: '', party_name: '' }); setModal(true); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Entry</button>
      </div>

      {/* Last 7 Days */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b"><h4 className="font-semibold">Last 7 Days Cash Position</h4></div>
        <table>
          <thead><tr><th>Date</th><th>Opening</th><th className="text-emerald-600">Inflows</th><th className="text-red-600">Outflows</th><th className="text-purple-600">Closing</th></tr></thead>
          <tbody>
            {summary.last7Days.map(d => (
              <tr key={d.id} className={d.date === selectedDate ? 'bg-blue-50' : ''} onClick={() => setSelectedDate(d.date)} style={{cursor:'pointer'}}>
                <td className="font-medium">{d.date}</td>
                <td>Rs {d.opening_balance?.toLocaleString()}</td>
                <td className="text-emerald-600 font-semibold">+ Rs {d.total_inflows?.toLocaleString()}</td>
                <td className="text-red-600 font-semibold">- Rs {d.total_outflows?.toLocaleString()}</td>
                <td className="font-bold text-purple-600">Rs {d.closing_balance?.toLocaleString()}</td>
              </tr>
            ))}
            {summary.last7Days.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">No data yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Entries for selected date */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b"><h4 className="font-semibold">Entries for {selectedDate}</h4></div>
        <table>
          <thead><tr><th>Type</th><th>Category</th><th>Description</th><th>Party</th><th>Mode</th><th>Amount</th><th>By</th><th></th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td><span className={`badge ${e.type === 'inflow' ? 'badge-green' : 'badge-red'}`}>{e.type}</span></td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td>{e.party_name}</td>
                <td>{e.payment_mode}</td>
                <td className={`font-semibold ${e.type === 'inflow' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {e.type === 'inflow' ? '+' : '-'} Rs {e.amount?.toLocaleString()}
                </td>
                <td className="text-xs text-gray-500">{e.created_by_name}</td>
                <td><button onClick={() => deleteEntry(e.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><FiTrash2 size={14} /></button></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan="8" className="text-center py-6 text-gray-400">No entries for this date</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add Entry Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Add Cash Flow Entry">
        <form onSubmit={saveEntry} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Date</label><input className="input" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div>
              <label className="label">Type</label>
              <select className="select" value={form.type} onChange={e => setForm({...form, type: e.target.value, category: ''})}>
                <option value="inflow">Inflow (Money In)</option>
                <option value="outflow">Outflow (Money Out)</option>
              </select>
            </div>
            <div>
              <label className="label">Category *</label>
              <select className="select" value={form.category} onChange={e => setForm({...form, category: e.target.value})} required>
                <option value="">Select</option>
                {(form.type === 'inflow' ? inflowCategories : outflowCategories).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Amount (Rs) *</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: +e.target.value})} required /></div>
          </div>
          <div><label className="label">Description *</label><input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Party Name</label><input className="input" value={form.party_name} onChange={e => setForm({...form, party_name: e.target.value})} /></div>
            <div>
              <label className="label">Payment Mode</label>
              <select className="select" value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                <option value="">Select</option>
                <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option><option value="Cheque">Cheque</option><option value="NEFT">NEFT</option><option value="RTGS">RTGS</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Add Entry</button></div>
        </form>
      </Modal>

      {/* Opening Balance Modal */}
      <Modal isOpen={openingModal} onClose={() => setOpeningModal(false)} title="Set Opening Balance">
        <form onSubmit={saveOpening} className="space-y-4">
          <div><label className="label">Date</label><input className="input" type="date" value={selectedDate} readOnly /></div>
          <div><label className="label">Opening Balance (Rs)</label><input className="input" type="number" value={openingBalance} onChange={e => setOpeningBalance(+e.target.value)} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setOpeningModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
