import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiMapPin, FiAlertTriangle, FiCheck, FiEye } from 'react-icons/fi';

export default function DPR() {
  const [tab, setTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [dprs, setDprs] = useState([]);
  const [sites, setSites] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [siteModal, setSiteModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedDpr, setSelectedDpr] = useState(null);
  const [form, setForm] = useState({});
  const [workItems, setWorkItems] = useState([{ description: '', unit: 'nos', boq_qty: 0, planned_qty: 0, actual_qty: 0, cumulative_qty: 0 }]);
  const [manpower, setManpower] = useState([{ category: 'Skilled Labour', required: 0, deployed: 0 }]);
  const [materials, setMaterials] = useState([{ material_name: '', unit: 'nos', boq_qty: 0, consumed_today: 0, cumulative_consumed: 0 }]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [poItemsForSite, setPoItemsForSite] = useState([]);

  const load = () => {
    api.get('/dpr/summary').then(r => setSummary(r.data));
    api.get('/dpr', { params: { date: filterDate } }).then(r => setDprs(r.data));
    api.get('/dpr/sites').then(r => setSites(r.data));
    api.get('/auth/users').then(r => setUsers(r.data));
  };
  useEffect(() => { load(); }, [filterDate]);

  const submitDpr = async (e) => {
    e.preventDefault();
    try {
      await api.post('/dpr', { ...form, work_items: workItems, manpower, materials });
      toast.success('DPR submitted!');
      setModal(false); load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const createSite = async (e) => {
    e.preventDefault();
    await api.post('/dpr/sites', form);
    toast.success('Site created');
    setSiteModal(false); load();
  };

  const approveDpr = async (id, status, billingReady) => {
    await api.put(`/dpr/${id}/approve`, { approval_status: status, billing_ready: billingReady });
    toast.success(`DPR ${status}`);
    load();
  };

  const viewDpr = async (id) => {
    const { data } = await api.get(`/dpr/${id}`);
    setSelectedDpr(data);
    setDetailModal(true);
  };

  if (!summary) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('dashboard')} className={`btn ${tab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}>Dashboard</button>
        <button onClick={() => setTab('reports')} className={`btn ${tab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}>Daily Reports</button>
        <button onClick={() => setTab('sites')} className={`btn ${tab === 'sites' ? 'btn-primary' : 'btn-secondary'}`}>Sites</button>
      </div>

      {tab === 'dashboard' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center border-l-4 border-blue-500">
              <div className="text-3xl font-bold text-blue-600">{summary.activeSites}</div>
              <div className="text-sm text-gray-500">Active Sites</div>
            </div>
            <div className="card text-center border-l-4 border-emerald-500">
              <div className="text-3xl font-bold text-emerald-600">{summary.todaySubmissions}</div>
              <div className="text-sm text-gray-500">DPR Submitted Today</div>
            </div>
            <div className="card text-center border-l-4 border-amber-500">
              <div className="text-3xl font-bold text-amber-600">{summary.pendingApproval}</div>
              <div className="text-sm text-gray-500">Pending Approval</div>
            </div>
            <div className="card text-center border-l-4 border-purple-500">
              <div className="text-3xl font-bold text-purple-600">{summary.billingReady}</div>
              <div className="text-sm text-gray-500">Billing Ready</div>
            </div>
          </div>

          {/* Missing DPR Alert */}
          {summary.missingSites.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiAlertTriangle className="text-red-600" size={20} />
                <h4 className="font-bold text-red-700">NO DPR SUBMITTED - Payment Blocked!</h4>
              </div>
              <p className="text-sm text-red-600 mb-3">These sites have NOT submitted DPR today. No payment will be approved.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {summary.missingSites.map(s => (
                  <div key={s.id} className="bg-white border border-red-300 rounded-lg p-3 flex items-center gap-2">
                    <FiMapPin className="text-red-500" />
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-gray-500">Supervisor: {s.supervisor || 'N/A'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.missingSites.length === 0 && summary.activeSites > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <FiCheck className="text-emerald-600" size={24} />
              <div>
                <h4 className="font-bold text-emerald-700">All sites have submitted DPR today!</h4>
                <p className="text-sm text-emerald-600">Payment processing can proceed for all sites.</p>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'reports' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input type="date" className="input w-48" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <button onClick={() => {
              setForm({ site_id: '', report_date: filterDate, weather: 'clear', overall_status: 'on_track', remarks: '' });
              setWorkItems([{ description: '', unit: 'nos', boq_qty: 0, planned_qty: 0, actual_qty: 0, cumulative_qty: 0 }]);
              setManpower([{ category: 'Skilled Labour', required: 0, deployed: 0 }, { category: 'Unskilled Labour', required: 0, deployed: 0 }, { category: 'Supervisor', required: 0, deployed: 0 }]);
              setMaterials([{ material_name: '', unit: 'nos', boq_qty: 0, consumed_today: 0, cumulative_consumed: 0 }]);
              setModal(true);
            }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Submit DPR</button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table>
              <thead><tr><th>Site</th><th>Date</th><th>Submitted By</th><th>Weather</th><th>Status</th><th>Billing Ready</th><th>Approval</th><th>Actions</th></tr></thead>
              <tbody>
                {dprs.map(d => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.site_name}</td>
                    <td>{d.report_date}</td>
                    <td>{d.submitted_by_name}</td>
                    <td className="capitalize">{d.weather}</td>
                    <td><StatusBadge status={d.overall_status} /></td>
                    <td>{d.billing_ready ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                    <td><StatusBadge status={d.approval_status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => viewDpr(d.id)} className="p-1 hover:bg-blue-50 rounded text-blue-600"><FiEye size={14} /></button>
                        {d.approval_status === 'pending' && (
                          <>
                            <button onClick={() => approveDpr(d.id, 'approved', true)} className="btn btn-success text-[10px] py-0.5 px-1.5">Approve + Billing</button>
                            <button onClick={() => approveDpr(d.id, 'approved', false)} className="btn btn-primary text-[10px] py-0.5 px-1.5">Approve</button>
                            <button onClick={() => approveDpr(d.id, 'rejected', false)} className="btn btn-danger text-[10px] py-0.5 px-1.5">Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {dprs.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-gray-400">No DPR for this date</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'sites' && (
        <>
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Project Sites</h4>
            <button onClick={() => { setForm({ name: '', address: '', client_name: '', site_engineer_id: '', supervisor: '' }); setSiteModal(true); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Site</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table>
              <thead><tr><th>Site Name</th><th>Address</th><th>Client</th><th>Engineer</th><th>Supervisor</th><th>Status</th></tr></thead>
              <tbody>
                {sites.map(s => (
                  <tr key={s.id}><td className="font-medium">{s.name}</td><td>{s.address}</td><td>{s.client_name}</td><td>{s.engineer_name}</td><td>{s.supervisor}</td><td><StatusBadge status={s.status} /></td></tr>
                ))}
                {sites.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No sites yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Submit DPR Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Submit Daily Progress Report" wide>
        <form onSubmit={submitDpr} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Site *</label><select className="select" value={form.site_id || ''} onChange={e => {
              const siteId = e.target.value;
              setForm({...form, site_id: siteId});
              if (siteId) {
                api.get(`/dpr/sites/${siteId}/po-items`).then(r => setPoItemsForSite(r.data)).catch(() => setPoItemsForSite([]));
              } else {
                setPoItemsForSite([]);
              }
            }} required><option value="">Select</option>{sites.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Date *</label><input className="input" type="date" value={form.report_date || ''} onChange={e => setForm({...form, report_date: e.target.value})} required /></div>
            <div><label className="label">Weather</label><select className="select" value={form.weather || 'clear'} onChange={e => setForm({...form, weather: e.target.value})}><option value="clear">Clear</option><option value="rainy">Rainy</option><option value="cloudy">Cloudy</option><option value="hot">Hot</option></select></div>
          </div>
          <div><label className="label">Overall Status</label><select className="select" value={form.overall_status || 'on_track'} onChange={e => setForm({...form, overall_status: e.target.value})}><option value="on_track">On Track</option><option value="delayed">Delayed</option><option value="ahead">Ahead</option><option value="blocked">Blocked</option></select></div>

          {/* Work Items: Planned vs Actual */}
          <div className="border rounded-lg p-3 bg-blue-50">
            <h5 className="font-semibold text-sm mb-2">Work Progress (Planned vs Actual)</h5>
            {workItems.map((w, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 mb-2">
                <input className="input col-span-2" placeholder="Work Description" value={w.description} onChange={e => { const n = [...workItems]; n[i].description = e.target.value; setWorkItems(n); }} />
                <input className="input" type="number" placeholder="BOQ Qty" value={w.boq_qty} onChange={e => { const n = [...workItems]; n[i].boq_qty = +e.target.value; setWorkItems(n); }} />
                <input className="input" type="number" placeholder="Planned" value={w.planned_qty} onChange={e => { const n = [...workItems]; n[i].planned_qty = +e.target.value; setWorkItems(n); }} />
                <input className="input" type="number" placeholder="Actual" value={w.actual_qty} onChange={e => { const n = [...workItems]; n[i].actual_qty = +e.target.value; setWorkItems(n); }} />
                <input className="input" type="number" placeholder="Cumulative" value={w.cumulative_qty} onChange={e => { const n = [...workItems]; n[i].cumulative_qty = +e.target.value; setWorkItems(n); }} />
              </div>
            ))}
            <button type="button" onClick={() => setWorkItems([...workItems, { description: '', unit: 'nos', boq_qty: 0, planned_qty: 0, actual_qty: 0, cumulative_qty: 0 }])} className="text-xs text-blue-600 hover:underline">+ Add Work Item</button>
          </div>

          {/* Manpower */}
          <div className="border rounded-lg p-3 bg-amber-50">
            <h5 className="font-semibold text-sm mb-2">Manpower (Required vs Deployed)</h5>
            {manpower.map((m, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                <input className="input" placeholder="Category" value={m.category} onChange={e => { const n = [...manpower]; n[i].category = e.target.value; setManpower(n); }} />
                <input className="input" type="number" placeholder="Required" value={m.required} onChange={e => { const n = [...manpower]; n[i].required = +e.target.value; setManpower(n); }} />
                <input className="input" type="number" placeholder="Deployed" value={m.deployed} onChange={e => { const n = [...manpower]; n[i].deployed = +e.target.value; setManpower(n); }} />
              </div>
            ))}
            <button type="button" onClick={() => setManpower([...manpower, { category: '', required: 0, deployed: 0 }])} className="text-xs text-amber-700 hover:underline">+ Add Category</button>
          </div>

          {/* Materials */}
          <div className="border rounded-lg p-3 bg-purple-50">
            <h5 className="font-semibold text-sm mb-2">Material Consumed vs BOQ</h5>
            {poItemsForSite.length > 0 && <p className="text-xs text-purple-600 mb-2 font-medium">Select from PO items (auto-fills name, unit, BOQ qty)</p>}
            {materials.map((m, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                {poItemsForSite.length > 0 ? (
                  <select className="input col-span-2 text-sm" value={m.po_item_id || ''} onChange={e => {
                    const n = [...materials];
                    const item = poItemsForSite.find(p => p.id === +e.target.value);
                    n[i].po_item_id = +e.target.value || null;
                    n[i].material_name = item?.description || '';
                    n[i].unit = item?.unit || 'nos';
                    n[i].boq_qty = item?.quantity || 0;
                    setMaterials(n);
                  }}>
                    <option value="">-- Select PO Item --</option>
                    {poItemsForSite.map(item => (
                      <option key={item.id} value={item.id}>{item.description} ({item.quantity} {item.unit})</option>
                    ))}
                  </select>
                ) : (
                  <input className="input col-span-2" placeholder="Material Name" value={m.material_name} onChange={e => { const n = [...materials]; n[i].material_name = e.target.value; setMaterials(n); }} />
                )}
                <input className="input" type="number" placeholder="BOQ Qty" value={m.boq_qty} onChange={e => { const n = [...materials]; n[i].boq_qty = +e.target.value; setMaterials(n); }} />
                <input className="input" type="number" placeholder="Today" value={m.consumed_today} onChange={e => { const n = [...materials]; n[i].consumed_today = +e.target.value; setMaterials(n); }} />
                <input className="input" type="number" placeholder="Cumulative" value={m.cumulative_consumed} onChange={e => { const n = [...materials]; n[i].cumulative_consumed = +e.target.value; setMaterials(n); }} />
              </div>
            ))}
            <button type="button" onClick={() => setMaterials([...materials, { material_name: '', unit: 'nos', boq_qty: 0, consumed_today: 0, cumulative_consumed: 0, po_item_id: null }])} className="text-xs text-purple-700 hover:underline">+ Add Material</button>
          </div>

          <div><label className="label">Remarks</label><textarea className="input" rows="2" value={form.remarks || ''} onChange={e => setForm({...form, remarks: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Submit DPR</button></div>
        </form>
      </Modal>

      {/* Site Modal */}
      <Modal isOpen={siteModal} onClose={() => setSiteModal(false)} title="Add Project Site">
        <form onSubmit={createSite} className="space-y-4">
          <div><label className="label">Site Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="label">Address</label><textarea className="input" rows="2" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Name</label><input className="input" value={form.client_name || ''} onChange={e => setForm({...form, client_name: e.target.value})} /></div>
            <div><label className="label">Supervisor</label><input className="input" value={form.supervisor || ''} onChange={e => setForm({...form, supervisor: e.target.value})} /></div>
            <div><label className="label">Site Engineer</label><select className="select" value={form.site_engineer_id || ''} onChange={e => setForm({...form, site_engineer_id: e.target.value})}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setSiteModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create Site</button></div>
        </form>
      </Modal>

      {/* DPR Detail Modal */}
      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title={`DPR Detail - ${selectedDpr?.site_name}`} wide>
        {selectedDpr && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><strong>Site:</strong> {selectedDpr.site_name}</div>
              <div><strong>Date:</strong> {selectedDpr.report_date}</div>
              <div><strong>Weather:</strong> {selectedDpr.weather}</div>
              <div><strong>Status:</strong> <StatusBadge status={selectedDpr.overall_status} /></div>
              <div><strong>Submitted By:</strong> {selectedDpr.submitted_by_name}</div>
              <div><strong>Billing Ready:</strong> {selectedDpr.billing_ready ? 'Yes' : 'No'}</div>
            </div>

            {selectedDpr.work_items?.length > 0 && (
              <div>
                <h5 className="font-semibold text-sm mb-2">Work Progress</h5>
                <table className="text-xs">
                  <thead><tr><th>Description</th><th>BOQ</th><th>Planned</th><th>Actual</th><th>Cumulative</th><th>Variance</th></tr></thead>
                  <tbody>{selectedDpr.work_items.map(w => (
                    <tr key={w.id}><td>{w.description}</td><td>{w.boq_qty}</td><td>{w.planned_qty}</td><td>{w.actual_qty}</td><td>{w.cumulative_qty}</td>
                    <td className={w.variance_pct < 0 ? 'text-red-600' : 'text-emerald-600'}>{w.variance_pct}%</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {selectedDpr.manpower?.length > 0 && (
              <div>
                <h5 className="font-semibold text-sm mb-2">Manpower</h5>
                <table className="text-xs">
                  <thead><tr><th>Category</th><th>Required</th><th>Deployed</th><th>Shortage</th></tr></thead>
                  <tbody>{selectedDpr.manpower.map(m => (
                    <tr key={m.id}><td>{m.category}</td><td>{m.required}</td><td>{m.deployed}</td><td className={m.shortage > 0 ? 'text-red-600 font-bold' : ''}>{m.shortage}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {selectedDpr.materials?.length > 0 && (
              <div>
                <h5 className="font-semibold text-sm mb-2">Material Consumption</h5>
                <table className="text-xs">
                  <thead><tr><th>Material</th><th>BOQ Qty</th><th>Today</th><th>Cumulative</th><th>Balance</th></tr></thead>
                  <tbody>{selectedDpr.materials.map(m => (
                    <tr key={m.id}><td>{m.material_name}</td><td>{m.boq_qty}</td><td>{m.consumed_today}</td><td>{m.cumulative_consumed}</td><td className={m.balance_qty < 0 ? 'text-red-600' : ''}>{m.balance_qty}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {selectedDpr.remarks && <div className="text-sm"><strong>Remarks:</strong> {selectedDpr.remarks}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
