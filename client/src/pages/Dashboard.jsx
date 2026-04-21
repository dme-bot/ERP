import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiTarget, FiShoppingCart, FiTool, FiAlertCircle, FiUsers, FiCheckSquare, FiUpload, FiClock, FiAlertTriangle, FiExternalLink, FiCalendar } from 'react-icons/fi';
import { LuIndianRupee } from 'react-icons/lu';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [todayChecklists, setTodayChecklists] = useState([]);
  const [uploadingFor, setUploadingFor] = useState(null); // id of the checklist/task currently uploading

  const loadPersonal = () => {
    api.get('/delegations?scope=mine').then(r => setMyTasks(r.data)).catch(() => setMyTasks([]));
    api.get('/hr/checklists/my-today').then(r => setTodayChecklists(r.data)).catch(() => setTodayChecklists([]));
  };

  useEffect(() => {
    api.get('/dashboard').then(r => setStats(r.data));
    loadPersonal();
  }, []);

  // Shared proof-upload helper: POST /upload then return the URL
  const uploadProof = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.url;
  };

  const completeChecklist = async (cl, file) => {
    setUploadingFor('cl-' + cl.id);
    try {
      const url = await uploadProof(file);
      await api.post(`/hr/checklists/${cl.id}/complete`, { proof_url: url });
      toast.success(`${cl.title} marked complete`);
      loadPersonal();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    setUploadingFor(null);
  };

  const submitDelegationProof = async (task, file) => {
    setUploadingFor('del-' + task.id);
    try {
      const url = await uploadProof(file);
      await api.post(`/delegations/${task.id}/submit`, { proof_url: url });
      toast.success('Proof submitted — awaiting approval');
      loadPersonal();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setUploadingFor(null);
  };

  if (!stats) return <div className="text-center py-10">Loading...</div>;

  const myPendingTasks = myTasks.filter(t => t.status === 'pending' || t.status === 'rejected');
  const pendingChecklists = todayChecklists.filter(c => !c.completion_id);
  const doneChecklists = todayChecklists.filter(c => c.completion_id);

  const cards = [
    { title: 'Total Leads', value: stats.leads.total, sub: `${stats.leads.new} new`, icon: FiTarget, color: 'bg-red-500' },
    { title: 'Won Deals', value: stats.leads.won, sub: `${stats.leads.qualified} qualified`, icon: FiTarget, color: 'bg-emerald-500' },
    { title: 'Active Orders', value: stats.orders.total, sub: `Rs ${(stats.orders.totalValue/100000).toFixed(1)}L value`, icon: FiShoppingCart, color: 'bg-purple-500' },
    { title: 'Installations', value: stats.installations.inProgress, sub: `${stats.installations.completed} completed`, icon: FiTool, color: 'bg-amber-500' },
    { title: 'Open Complaints', value: stats.complaints.open, sub: `${stats.complaints.inProgress} in progress`, icon: FiAlertCircle, color: 'bg-red-500' },
    { title: 'Employees', value: stats.hr.employees, sub: `${stats.hr.subContractors} contractors`, icon: FiUsers, color: 'bg-teal-500' },
    { title: 'Pending Expenses', value: `Rs ${stats.expenses.pending.toLocaleString()}`, sub: `Rs ${stats.expenses.approved.toLocaleString()} approved`, icon: LuIndianRupee, color: 'bg-orange-500' },
    { title: 'Candidates', value: stats.hr.candidates, sub: 'in pipeline', icon: FiUsers, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="stat-card">
            <div className={`${c.color} p-3 rounded-xl text-white`}><c.icon size={24} /></div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{c.value}</div>
              <div className="text-xs text-gray-500">{c.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* My Tasks & Today's Checklists — personal widgets */}
      {(myPendingTasks.length > 0 || todayChecklists.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My pending delegations */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FiCheckSquare className="text-red-600" /> My Tasks <span className="text-xs font-normal text-gray-400">({myPendingTasks.length} pending)</span></h3>
              <Link to="/delegations" className="text-xs text-red-600 hover:underline">Open Delegations →</Link>
            </div>
            {myPendingTasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No pending tasks — you're all caught up!</p>
            ) : (
              <div className="space-y-2">
                {myPendingTasks.slice(0, 5).map(t => (
                  <div key={t.id} className={`border rounded-lg p-2.5 ${t.status === 'rejected' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 line-clamp-2">{t.description || t.title}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mt-0.5">
                          <span>by {t.assigned_by_name}</span>
                          {t.due_date && <span className="flex items-center gap-1"><FiClock size={10} /> {t.due_date}</span>}
                        </div>
                        {t.status === 'rejected' && t.reject_reason && (
                          <p className="text-[11px] text-red-700 mt-1 flex items-start gap-1"><FiAlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {t.reject_reason}</p>
                        )}
                        {t.extension_status === 'pending' && (
                          <p className="text-[11px] text-amber-700 mt-1 flex items-start gap-1"><FiCalendar size={11} className="mt-0.5 flex-shrink-0" /> Extension to {t.requested_due_date} — awaiting admin</p>
                        )}
                      </div>
                      <label className={`btn btn-primary text-[11px] px-2 py-1 flex items-center gap-1 cursor-pointer ${uploadingFor === 'del-' + t.id ? 'opacity-60 pointer-events-none' : ''}`}>
                        <FiUpload size={11} /> {uploadingFor === 'del-' + t.id ? '...' : 'Submit'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden"
                          onChange={e => { const f = e.target.files[0]; if (f) submitDelegationProof(t, f); e.target.value = ''; }} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's checklists */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><FiCheckSquare className="text-emerald-600" /> Today's Checklists <span className="text-xs font-normal text-gray-400">({pendingChecklists.length} pending, {doneChecklists.length} done)</span></h3>
              <Link to="/checklists" className="text-xs text-red-600 hover:underline">Manage →</Link>
            </div>
            {todayChecklists.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No checklists due today.</p>
            ) : (
              <div className="space-y-2">
                {todayChecklists.slice(0, 6).map(c => (
                  <div key={c.id} className={`border rounded-lg p-2.5 ${c.completion_id ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${c.completion_id ? 'text-emerald-800' : 'text-gray-800'} line-clamp-2`}>
                          {c.completion_id && '✓ '}{c.description || c.title}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mt-0.5">
                          <span className="uppercase">{c.frequency}</span>
                          {c.due_time && <span className="flex items-center gap-1 font-mono"><FiClock size={10} /> {c.due_time}</span>}
                          {c.completion_id && c.proof_url && <a href={c.proof_url} target="_blank" rel="noreferrer" className="text-red-600 hover:underline flex items-center gap-1"><FiExternalLink size={10} /> proof</a>}
                        </div>
                      </div>
                      {!c.completion_id && (
                        <label className={`btn btn-success text-[11px] px-2 py-1 flex items-center gap-1 cursor-pointer ${uploadingFor === 'cl-' + c.id ? 'opacity-60 pointer-events-none' : ''}`}>
                          <FiUpload size={11} /> {uploadingFor === 'cl-' + c.id ? '...' : 'Upload Proof'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden"
                            onChange={e => { const f = e.target.files[0]; if (f) completeChecklist(c, f); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Leads</h3>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Company</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {stats.recentLeads.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.company_name}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {stats.recentLeads.length === 0 && <tr><td colSpan="3" className="text-center text-gray-400 py-4">No leads yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>PO Number</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recentOrders.map(o => (
                  <tr key={o.id}>
                    <td className="font-medium">{o.po_number}</td>
                    <td>Rs {o.total_amount?.toLocaleString()}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
                {stats.recentOrders.length === 0 && <tr><td colSpan="3" className="text-center text-gray-400 py-4">No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Complaints</h3>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Number</th><th>Description</th><th>Priority</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recentComplaints.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.complaint_number}</td>
                    <td className="max-w-xs truncate">{c.description}</td>
                    <td><StatusBadge status={c.priority} /></td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
                {stats.recentComplaints.length === 0 && <tr><td colSpan="4" className="text-center text-gray-400 py-4">No complaints</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
