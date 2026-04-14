import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiMapPin, FiAlertTriangle, FiCheck, FiEye } from 'react-icons/fi';

const MEPF_TRADES = ['Electrician', 'Plumber', 'Fire Fitter', 'Welder', 'CCTV Technician', 'AC Technician', 'Cable Jointer', 'Helper', 'Supervisor', 'Site Engineer'];
const SYSTEMS = ['Electrical', 'Fire Fighting', 'Fire Alarm', 'CCTV', 'Access Control', 'PA System', 'Plumbing', 'HVAC', 'Solar', 'Networking', 'Combined'];
const EQUIPMENT_LIST = ['Welding Machine', 'Pipe Threading Machine', 'Drill Machine', 'Grinder', 'Ladder', 'Scaffolding', 'Pipe Bending Machine', 'Cable Pulling Machine', 'Multimeter', 'Megger', 'Earth Tester', 'Hydro Test Pump', 'Generator', 'Compressor'];

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
  const [workItems, setWorkItems] = useState([]);
  const [manpower, setManpower] = useState(MEPF_TRADES.slice(0, 5).map(t => ({ trade: t, required: 0, deployed: 0 })));
  const [materials, setMaterials] = useState([]);
  const [machinery, setMachinery] = useState([{ equipment: '', quantity: 1, hours_used: 0, condition: 'working' }]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [poItemsForSite, setPoItemsForSite] = useState([]);

  const load = () => {
    api.get('/dpr/summary').then(r => setSummary(r.data));
    api.get('/dpr', { params: { date: filterDate } }).then(r => setDprs(r.data));
    api.get('/dpr/sites').then(r => setSites(r.data));
    api.get('/auth/users').then(r => setUsers(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [filterDate]);

  const handleSiteSelect = (siteId) => {
    setForm(f => ({ ...f, site_id: siteId }));
    if (siteId) {
      api.get(`/dpr/sites/${siteId}/po-items`).then(r => {
        setPoItemsForSite(r.data);
        if (r.data.length > 0) {
          setWorkItems(r.data.map(item => ({
            po_item_id: item.id, description: item.description, unit: item.unit || 'nos',
            floor_zone: '', boq_qty: item.quantity || 0, rate: item.rate || 0, amount: item.amount || 0,
            planned_qty: 0, actual_qty: 0, cumulative_qty: 0
          })));
          setMaterials(r.data.map(item => ({
            po_item_id: item.id, material_name: item.description, unit: item.unit || 'nos',
            boq_qty: item.quantity || 0, consumed_today: 0, cumulative_consumed: 0
          })));
        } else {
          setWorkItems([{ description: '', unit: 'nos', floor_zone: '', boq_qty: 0, planned_qty: 0, actual_qty: 0, cumulative_qty: 0 }]);
          setMaterials([{ material_name: '', unit: 'nos', boq_qty: 0, consumed_today: 0, cumulative_consumed: 0 }]);
        }
      }).catch(() => { setPoItemsForSite([]); });
    }
  };

  const submitDpr = async (e) => {
    e.preventDefault();
    try {
      await api.post('/dpr', { ...form, work_items: workItems, manpower, materials, machinery: machinery.filter(m => m.equipment) });
      toast.success('DPR submitted!'); setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const createSite = async (e) => { e.preventDefault(); await api.post('/dpr/sites', form); toast.success('Site created'); setSiteModal(false); load(); };
  const approveDpr = async (id, status, billingReady) => { await api.put(`/dpr/${id}/approve`, { approval_status: status, billing_ready: billingReady }); toast.success(`DPR ${status}`); load(); };
  const viewDpr = async (id) => { const { data } = await api.get(`/dpr/${id}`); setSelectedDpr(data); setDetailModal(true); };

  if (!summary) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {['dashboard', 'reports', 'sites'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t === 'dashboard' ? 'Dashboard' : t === 'reports' ? 'Daily Reports' : 'Sites'}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center border-l-4 border-blue-500"><div className="text-3xl font-bold text-blue-600">{summary.activeSites}</div><div className="text-sm text-gray-500">Active Sites</div></div>
            <div className="card text-center border-l-4 border-emerald-500"><div className="text-3xl font-bold text-emerald-600">{summary.todaySubmissions}</div><div className="text-sm text-gray-500">DPR Today</div></div>
            <div className="card text-center border-l-4 border-amber-500"><div className="text-3xl font-bold text-amber-600">{summary.pendingApproval}</div><div className="text-sm text-gray-500">Pending Approval</div></div>
            <div className="card text-center border-l-4 border-purple-500"><div className="text-3xl font-bold text-purple-600">{summary.billingReady}</div><div className="text-sm text-gray-500">Billing Ready</div></div>
          </div>
          {summary.missingSites.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><FiAlertTriangle className="text-red-600" size={20} /><h4 className="font-bold text-red-700">NO DPR - Payment Blocked!</h4></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">{summary.missingSites.map(s => (
                <div key={s.id} className="bg-white border border-red-300 rounded-lg p-3 flex items-center gap-2"><FiMapPin className="text-red-500" /><div><div className="font-medium text-sm">{s.name}</div><div className="text-xs text-gray-500">{s.supervisor || 'N/A'}</div></div></div>
              ))}</div>
            </div>
          )}
          {summary.missingSites.length === 0 && summary.activeSites > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3"><FiCheck className="text-emerald-600" size={24} /><h4 className="font-bold text-emerald-700">All sites submitted DPR today!</h4></div>
          )}
        </>
      )}

      {tab === 'reports' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <input type="date" className="input w-48" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <button onClick={() => {
              setForm({ site_id: '', report_date: filterDate, weather: 'clear', overall_status: 'on_track', system_type: '', floor_zone: '', safety_toolbox_talk: false, safety_ppe_compliance: false, safety_incidents: '', next_day_plan: '', hindrances: '', remarks: '' });
              setWorkItems([]); setMaterials([]); setPoItemsForSite([]);
              setManpower(MEPF_TRADES.slice(0, 5).map(t => ({ trade: t, required: 0, deployed: 0 })));
              setMachinery([{ equipment: '', quantity: 1, hours_used: 0, condition: 'working' }]);
              setModal(true);
            }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Submit DPR</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Site</th><th>Date</th><th>System</th><th>By</th><th>Weather</th><th>Status</th><th>Safety</th><th>Approval</th><th>Actions</th></tr></thead>
            <tbody>
              {dprs.map(d => (
                <tr key={d.id}>
                  <td className="font-medium">{d.site_name}</td><td>{d.report_date}</td><td className="text-xs">{d.system_type || '-'}</td>
                  <td>{d.submitted_by_name}</td><td className="capitalize">{d.weather}</td><td><StatusBadge status={d.overall_status} /></td>
                  <td>{d.safety_toolbox_talk ? <span className="text-emerald-600 text-xs font-bold">TBT Done</span> : <span className="text-red-500 text-xs">No TBT</span>}</td>
                  <td><StatusBadge status={d.approval_status} /></td>
                  <td><div className="flex gap-1">
                    <button onClick={() => viewDpr(d.id)} className="p-1 hover:bg-blue-50 rounded text-blue-600"><FiEye size={14} /></button>
                    {d.approval_status === 'pending' && <>
                      <button onClick={() => approveDpr(d.id, 'approved', true)} className="btn btn-success text-[10px] py-0.5 px-1.5">Approve+Bill</button>
                      <button onClick={() => approveDpr(d.id, 'approved', false)} className="btn btn-primary text-[10px] py-0.5 px-1.5">Approve</button>
                      <button onClick={() => approveDpr(d.id, 'rejected', false)} className="btn btn-danger text-[10px] py-0.5 px-1.5">Reject</button>
                    </>}
                  </div></td>
                </tr>
              ))}
              {dprs.length === 0 && <tr><td colSpan="9" className="text-center py-8 text-gray-400">No DPR for this date</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'sites' && (
        <>
          <div className="flex justify-between items-center"><h4 className="font-semibold">Project Sites</h4>
            <button onClick={() => { setForm({ name: '', address: '', client_name: '', site_engineer_id: '', supervisor: '' }); setSiteModal(true); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Site</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Site</th><th>Address</th><th>Client</th><th>Engineer</th><th>Supervisor</th><th>Status</th></tr></thead>
            <tbody>{sites.map(s => (<tr key={s.id}><td className="font-medium">{s.name}</td><td>{s.address}</td><td>{s.client_name}</td><td>{s.engineer_name}</td><td>{s.supervisor}</td><td><StatusBadge status={s.status} /></td></tr>))}
              {sites.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No sites</td></tr>}</tbody>
          </table></div>
        </>
      )}

      {/* ===== SUBMIT MEPF DPR MODAL ===== */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Submit MEPF Daily Progress Report" wide>
        <form onSubmit={submitDpr} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

          {/* 1. Site + Date + System */}
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Site *</label>
              <select className="select" value={form.site_id || ''} onChange={e => handleSiteSelect(e.target.value)} required>
                <option value="">Select Site</option>{sites.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Date *</label><input className="input" type="date" value={form.report_date || ''} onChange={e => setForm({ ...form, report_date: e.target.value })} required /></div>
            <div><label className="label">MEPF System</label>
              <select className="select" value={form.system_type || ''} onChange={e => setForm({ ...form, system_type: e.target.value })}>
                <option value="">Select</option>{SYSTEMS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Weather</label>
              <select className="select" value={form.weather || 'clear'} onChange={e => setForm({ ...form, weather: e.target.value })}>
                <option value="clear">Clear</option><option value="rainy">Rainy</option><option value="cloudy">Cloudy</option><option value="hot">Hot</option><option value="windy">Windy</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Floor / Zone / Area</label><input className="input" value={form.floor_zone || ''} onChange={e => setForm({ ...form, floor_zone: e.target.value })} placeholder="e.g. Ground Floor Block-A, 2nd Floor Zone-2" /></div>
            <div><label className="label">Overall Status</label>
              <select className="select" value={form.overall_status || 'on_track'} onChange={e => setForm({ ...form, overall_status: e.target.value })}>
                <option value="on_track">On Track</option><option value="delayed">Delayed</option><option value="ahead">Ahead</option><option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          {/* 2. Work Progress from PO Items */}
          <div className="border rounded-lg p-3 bg-blue-50">
            <h5 className="font-semibold text-sm text-blue-700 mb-2">Work Progress (PO Items)</h5>
            {poItemsForSite.length > 0 ? (
              <>
                <p className="text-xs text-blue-600 mb-2">Items from PO. Enter floor/zone, planned & actual qty.</p>
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-gray-500 mb-1 min-w-[800px]">
                    <div className="col-span-3">Item (from PO)</div><div>Unit</div><div>BOQ</div><div>Rate</div><div className="col-span-2">Floor/Zone</div><div>Planned</div><div>Actual</div><div>Cum.</div>
                  </div>
                  {workItems.map((w, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 mb-1 items-center min-w-[800px]">
                      <div className="col-span-3 text-xs font-medium truncate" title={w.description}>{w.description}</div>
                      <div className="text-xs text-gray-500">{w.unit}</div>
                      <div className="text-xs font-semibold">{w.boq_qty}</div>
                      <div className="text-xs">Rs{(w.rate||0).toLocaleString()}</div>
                      <input className="input text-xs col-span-2" placeholder="Floor/Zone" value={w.floor_zone || ''} onChange={e => { const n = [...workItems]; n[i].floor_zone = e.target.value; setWorkItems(n); }} />
                      <input className="input text-xs" type="number" value={w.planned_qty || ''} onChange={e => { const n = [...workItems]; n[i].planned_qty = +e.target.value; setWorkItems(n); }} />
                      <input className="input text-xs" type="number" value={w.actual_qty || ''} onChange={e => { const n = [...workItems]; n[i].actual_qty = +e.target.value; setWorkItems(n); }} />
                      <input className="input text-xs" type="number" value={w.cumulative_qty || ''} onChange={e => { const n = [...workItems]; n[i].cumulative_qty = +e.target.value; setWorkItems(n); }} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-600">Select a site with PO items to auto-load work items.</p>
            )}
          </div>

          {/* 3. MEPF Trade-wise Manpower */}
          <div className="border rounded-lg p-3 bg-amber-50">
            <h5 className="font-semibold text-sm text-amber-700 mb-2">Manpower by MEPF Trade</h5>
            <div className="grid grid-cols-3 gap-1 text-xs font-semibold text-gray-500 mb-1"><div>Trade</div><div>Required</div><div>Deployed</div></div>
            {manpower.map((m, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 mb-1.5">
                <select className="input text-sm" value={m.trade} onChange={e => { const n = [...manpower]; n[i].trade = e.target.value; setManpower(n); }}>
                  {MEPF_TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input className="input text-sm" type="number" placeholder="0" value={m.required || ''} onChange={e => { const n = [...manpower]; n[i].required = +e.target.value; setManpower(n); }} />
                <input className="input text-sm" type="number" placeholder="0" value={m.deployed || ''} onChange={e => { const n = [...manpower]; n[i].deployed = +e.target.value; setManpower(n); }} />
              </div>
            ))}
            <button type="button" onClick={() => setManpower([...manpower, { trade: 'Helper', required: 0, deployed: 0 }])} className="text-xs text-amber-700 hover:underline">+ Add Trade</button>
          </div>

          {/* 4. Material Consumed */}
          <div className="border rounded-lg p-3 bg-purple-50">
            <h5 className="font-semibold text-sm text-purple-700 mb-2">Material Consumed</h5>
            {poItemsForSite.length > 0 ? (
              <>
                <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold text-gray-500 mb-1"><div className="col-span-2">Material</div><div>BOQ</div><div>Today</div><div>Cumulative</div></div>
                {materials.map((m, i) => (
                  <div key={i} className="grid grid-cols-5 gap-1 mb-1 items-center">
                    <div className="col-span-2 text-xs font-medium truncate">{m.material_name}</div>
                    <div className="text-xs font-semibold">{m.boq_qty}</div>
                    <input className="input text-xs" type="number" value={m.consumed_today || ''} onChange={e => { const n = [...materials]; n[i].consumed_today = +e.target.value; setMaterials(n); }} />
                    <input className="input text-xs" type="number" value={m.cumulative_consumed || ''} onChange={e => { const n = [...materials]; n[i].cumulative_consumed = +e.target.value; setMaterials(n); }} />
                  </div>
                ))}
              </>
            ) : <p className="text-xs text-amber-600">Materials auto-load from PO items when site is selected.</p>}
          </div>

          {/* 5. Machinery/Tools */}
          <div className="border rounded-lg p-3 bg-cyan-50">
            <h5 className="font-semibold text-sm text-cyan-700 mb-2">Machinery / Tools Used</h5>
            {machinery.map((m, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-1.5">
                <select className="input text-sm" value={m.equipment} onChange={e => { const n = [...machinery]; n[i].equipment = e.target.value; setMachinery(n); }}>
                  <option value="">Select Equipment</option>{EQUIPMENT_LIST.map(eq => <option key={eq}>{eq}</option>)}
                </select>
                <input className="input text-sm" type="number" placeholder="Qty" value={m.quantity || ''} onChange={e => { const n = [...machinery]; n[i].quantity = +e.target.value; setMachinery(n); }} />
                <input className="input text-sm" type="number" placeholder="Hours" value={m.hours_used || ''} onChange={e => { const n = [...machinery]; n[i].hours_used = +e.target.value; setMachinery(n); }} />
                <select className="input text-sm" value={m.condition || 'working'} onChange={e => { const n = [...machinery]; n[i].condition = e.target.value; setMachinery(n); }}>
                  <option value="working">Working</option><option value="idle">Idle</option><option value="breakdown">Breakdown</option>
                </select>
              </div>
            ))}
            <button type="button" onClick={() => setMachinery([...machinery, { equipment: '', quantity: 1, hours_used: 0, condition: 'working' }])} className="text-xs text-cyan-700 hover:underline">+ Add Equipment</button>
          </div>

          {/* 6. Safety */}
          <div className="border rounded-lg p-3 bg-red-50">
            <h5 className="font-semibold text-sm text-red-700 mb-2">Safety & Compliance</h5>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-emerald-600" checked={form.safety_toolbox_talk || false} onChange={e => setForm({ ...form, safety_toolbox_talk: e.target.checked })} />
                <span className="text-sm">Toolbox Talk (TBT) Conducted</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-emerald-600" checked={form.safety_ppe_compliance || false} onChange={e => setForm({ ...form, safety_ppe_compliance: e.target.checked })} />
                <span className="text-sm">PPE Compliance (Helmet, Shoes, Vest)</span>
              </label>
            </div>
            <div className="mt-2"><label className="label text-xs">Safety Incidents (if any)</label>
              <input className="input" value={form.safety_incidents || ''} onChange={e => setForm({ ...form, safety_incidents: e.target.value })} placeholder="Nil / Describe incident" />
            </div>
          </div>

          {/* 7. Hindrances */}
          <div className="border rounded-lg p-3 bg-orange-50">
            <h5 className="font-semibold text-sm text-orange-700 mb-2">Hindrances / Issues</h5>
            <textarea className="input" rows="2" value={form.hindrances || ''} onChange={e => setForm({ ...form, hindrances: e.target.value })}
              placeholder="Material shortage, Drawing pending, Client dependency, No access, Rain stoppage, etc." />
          </div>

          {/* 8. Next Day Plan */}
          <div className="border rounded-lg p-3 bg-emerald-50">
            <h5 className="font-semibold text-sm text-emerald-700 mb-2">Next Day Plan</h5>
            <textarea className="input" rows="2" value={form.next_day_plan || ''} onChange={e => setForm({ ...form, next_day_plan: e.target.value })}
              placeholder="Tomorrow's planned work - which floor/zone, which system, expected manpower..." />
          </div>

          {/* 9. Remarks */}
          <div><label className="label">Remarks</label><textarea className="input" rows="2" value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>

          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Submit MEPF DPR</button></div>
        </form>
      </Modal>

      {/* Site Modal */}
      <Modal isOpen={siteModal} onClose={() => setSiteModal(false)} title="Add Project Site">
        <form onSubmit={createSite} className="space-y-4">
          <div><label className="label">Site Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Address</label><textarea className="input" rows="2" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client</label><input className="input" value={form.client_name || ''} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
            <div><label className="label">Supervisor</label><input className="input" value={form.supervisor || ''} onChange={e => setForm({ ...form, supervisor: e.target.value })} /></div>
            <div><label className="label">Site Engineer</label><select className="select" value={form.site_engineer_id || ''} onChange={e => setForm({ ...form, site_engineer_id: e.target.value })}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setSiteModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create Site</button></div>
        </form>
      </Modal>

      {/* DPR Detail Modal */}
      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title={`MEPF DPR - ${selectedDpr?.site_name}`} wide>
        {selectedDpr && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-4 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
              <div><strong>Site:</strong> {selectedDpr.site_name}</div>
              <div><strong>Date:</strong> {selectedDpr.report_date}</div>
              <div><strong>System:</strong> {selectedDpr.system_type || '-'}</div>
              <div><strong>Floor/Zone:</strong> {selectedDpr.floor_zone || '-'}</div>
              <div><strong>Weather:</strong> {selectedDpr.weather}</div>
              <div><strong>Status:</strong> <StatusBadge status={selectedDpr.overall_status} /></div>
              <div><strong>By:</strong> {selectedDpr.submitted_by_name}</div>
              <div><strong>Billing:</strong> {selectedDpr.billing_ready ? 'Yes' : 'No'}</div>
            </div>

            {/* Safety */}
            <div className="flex gap-4 text-sm">
              <span className={selectedDpr.safety_toolbox_talk ? 'text-emerald-600 font-bold' : 'text-red-500'}>TBT: {selectedDpr.safety_toolbox_talk ? 'Done' : 'Not Done'}</span>
              <span className={selectedDpr.safety_ppe_compliance ? 'text-emerald-600 font-bold' : 'text-red-500'}>PPE: {selectedDpr.safety_ppe_compliance ? 'Compliant' : 'Non-Compliant'}</span>
              {selectedDpr.safety_incidents && <span className="text-red-600">Incident: {selectedDpr.safety_incidents}</span>}
            </div>

            {selectedDpr.work_items?.length > 0 && (
              <div><h5 className="font-semibold text-sm mb-2">Work Progress</h5><table className="text-xs"><thead><tr><th>Item</th><th>Floor</th><th>BOQ</th><th>Rate</th><th>Planned</th><th>Actual</th><th>Cum.</th><th>Var%</th></tr></thead>
                <tbody>{selectedDpr.work_items.map(w => (<tr key={w.id}><td>{w.description}</td><td>{w.floor_zone}</td><td>{w.boq_qty}</td><td>Rs{w.rate}</td><td>{w.planned_qty}</td><td>{w.actual_qty}</td><td>{w.cumulative_qty}</td><td className={w.variance_pct < 0 ? 'text-red-600' : 'text-emerald-600'}>{w.variance_pct}%</td></tr>))}</tbody></table></div>
            )}
            {selectedDpr.manpower?.length > 0 && (
              <div><h5 className="font-semibold text-sm mb-2">Manpower (MEPF Trades)</h5><table className="text-xs"><thead><tr><th>Trade</th><th>Required</th><th>Deployed</th><th>Shortage</th></tr></thead>
                <tbody>{selectedDpr.manpower.map(m => (<tr key={m.id}><td>{m.trade}</td><td>{m.required}</td><td>{m.deployed}</td><td className={m.shortage > 0 ? 'text-red-600 font-bold' : ''}>{m.shortage}</td></tr>))}</tbody></table></div>
            )}
            {selectedDpr.materials?.length > 0 && (
              <div><h5 className="font-semibold text-sm mb-2">Material Consumption</h5><table className="text-xs"><thead><tr><th>Material</th><th>BOQ</th><th>Today</th><th>Cum.</th><th>Balance</th></tr></thead>
                <tbody>{selectedDpr.materials.map(m => (<tr key={m.id}><td>{m.material_name}</td><td>{m.boq_qty}</td><td>{m.consumed_today}</td><td>{m.cumulative_consumed}</td><td className={m.balance_qty < 0 ? 'text-red-600' : ''}>{m.balance_qty}</td></tr>))}</tbody></table></div>
            )}
            {selectedDpr.machinery?.length > 0 && (
              <div><h5 className="font-semibold text-sm mb-2">Machinery/Tools</h5><table className="text-xs"><thead><tr><th>Equipment</th><th>Qty</th><th>Hours</th><th>Condition</th></tr></thead>
                <tbody>{selectedDpr.machinery.map(m => (<tr key={m.id}><td>{m.equipment}</td><td>{m.quantity}</td><td>{m.hours_used}h</td><td className={m.condition === 'breakdown' ? 'text-red-600 font-bold' : ''}>{m.condition}</td></tr>))}</tbody></table></div>
            )}
            {selectedDpr.hindrances && <div className="bg-orange-50 p-3 rounded text-sm"><strong className="text-orange-700">Hindrances:</strong> {selectedDpr.hindrances}</div>}
            {selectedDpr.next_day_plan && <div className="bg-emerald-50 p-3 rounded text-sm"><strong className="text-emerald-700">Next Day Plan:</strong> {selectedDpr.next_day_plan}</div>}
            {selectedDpr.remarks && <div className="text-sm"><strong>Remarks:</strong> {selectedDpr.remarks}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
