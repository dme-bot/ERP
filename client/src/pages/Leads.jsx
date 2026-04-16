import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiChevronRight, FiCheck, FiX, FiUpload, FiCalendar, FiFileText, FiTarget } from 'react-icons/fi';

const STAGE_COLORS = { new_lead: 'bg-blue-500', qualified: 'bg-indigo-500', meeting_assigned: 'bg-purple-500', mom_uploaded: 'bg-violet-500', drawing_uploaded: 'bg-amber-500', boq_created: 'bg-orange-500', quotation_sent: 'bg-cyan-500', won: 'bg-emerald-500', lost: 'bg-red-500' };
const STAGE_LABELS = { new_lead: 'New Lead', qualified: 'Qualified', meeting_assigned: 'Meeting', mom_uploaded: 'MOM', drawing_uploaded: 'Drawing', boq_created: 'BOQ', quotation_sent: 'Quotation', won: 'Won', lost: 'Lost' };
const CATEGORIES = ['MEP', 'Fire Fighting', 'Electrical', 'HVAC', 'Low Voltage', 'Solar', 'Plumbing', 'CCTV', 'Access Control'];

export default function Leads() {
  const { canCreate, canEdit, canDelete, user } = useAuth();
  const [tab, setTab] = useState('pipeline');
  const [leads, setLeads] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [viewData, setViewData] = useState(null);
  const [stageForm, setStageForm] = useState({});

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stageFilter !== 'all') params.set('stage', stageFilter);
    api.get(`/sales-funnel?${params}`).then(r => setLeads(r.data)).catch(() => {});
    api.get('/sales-funnel/dashboard').then(r => setDashboard(r.data)).catch(() => {});
  }, [search, stageFilter]);

  useEffect(() => { load(); }, [load]);
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveLead = async (e) => {
    e.preventDefault();
    try {
      if (form.id) { await api.put(`/sales-funnel/${form.id}`, form); toast.success('Updated'); }
      else { const res = await api.post('/sales-funnel', form); toast.success(`Lead ${res.data.lead_no} created`); }
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const advanceStage = async (id, stage, data) => {
    try {
      await api.post(`/sales-funnel/${id}/stage`, { stage, ...data });
      toast.success(`Stage: ${STAGE_LABELS[stage] || stage}`);
      setModal(null); setViewData(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const uploadFile = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.url;
  };

  const viewLead = (lead) => { setViewData(lead); setStageForm({}); setModal('view'); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><FiTarget className="text-blue-600" /> Sales Funnel</h1>
          <p className="text-[10px] text-gray-400">Lead → Qualified → Meeting → MOM → Drawing → BOQ → Quotation → Won/Lost</p></div>
        {canCreate('leads') && <button onClick={() => { setForm({ client_name: '', company_name: '', phone: '', email: '', category: '', address: '', source: '', assigned_sc: user?.name || '', assigned_asm: '', remarks: '' }); setModal('add'); }} className="btn btn-primary flex items-center gap-2 text-sm"><FiPlus size={15} /> New Lead</button>}
      </div>
      <div className="flex gap-2"><button onClick={() => setTab('pipeline')} className={`btn ${tab === 'pipeline' ? 'btn-primary' : 'btn-secondary'} text-xs`}>Pipeline</button><button onClick={() => setTab('list')} className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-secondary'} text-xs`}>All Leads</button></div>

      {tab === 'pipeline' && dashboard && (<>
        <div className="grid grid-cols-3 md:grid-cols-9 gap-2">{dashboard.stages?.map(s => {
          const count = dashboard.byStage?.find(b => b.current_stage === s.key)?.count || 0;
          return (<button key={s.key} onClick={() => setStageFilter(stageFilter === s.key ? 'all' : s.key)} className={`p-2 rounded-xl text-center ${stageFilter === s.key ? 'ring-2 ring-blue-500' : ''}`}>
            <div className={`w-8 h-8 ${STAGE_COLORS[s.key]} rounded-lg flex items-center justify-center mx-auto mb-1`}><span className="text-white font-bold text-sm">{count}</span></div>
            <p className="text-[9px] font-semibold text-gray-600">{s.label}</p><p className="text-[8px] text-gray-400">{s.who}</p>
          </button>);
        })}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 border-l-4 border-blue-500"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{dashboard.total}</p></div>
          <div className="card p-3 border-l-4 border-emerald-500"><p className="text-xs text-gray-500">Won</p><p className="text-xl font-bold text-emerald-600">{dashboard.won?.c}</p></div>
          <div className="card p-3 border-l-4 border-red-500"><p className="text-xs text-gray-500">Lost</p><p className="text-xl font-bold text-red-600">{dashboard.lost?.c}</p></div>
          <div className="card p-3 border-l-4 border-purple-500"><p className="text-xs text-gray-500">This Month</p><p className="text-xl font-bold">{dashboard.thisMonth}</p></div>
        </div>
      </>)}

      <div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input className="input pl-10" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table className="text-xs">
        <thead><tr><th className="px-2 py-2">Lead No</th><th className="px-2 py-2">Client</th><th className="px-2 py-2">Company</th><th className="px-2 py-2">Category</th><th className="px-2 py-2">Location</th><th className="px-2 py-2">SC</th><th className="px-2 py-2">Stage</th><th className="px-2 py-2">Actions</th></tr></thead>
        <tbody>{leads.map(l => (<tr key={l.id} className="border-b hover:bg-blue-50/30">
          <td className="px-2 py-2 font-bold text-blue-600 cursor-pointer" onClick={() => viewLead(l)}>{l.lead_no}</td>
          <td className="px-2 py-2 font-medium">{l.client_name}</td><td className="px-2 py-2">{l.company_name || '-'}</td>
          <td className="px-2 py-2"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded">{l.category || '-'}</span></td>
          <td className="px-2 py-2">{l.district || l.address || '-'}</td><td className="px-2 py-2">{l.assigned_sc || '-'}</td>
          <td className="px-2 py-2"><span className={`text-[9px] px-2 py-1 rounded-full font-bold text-white ${STAGE_COLORS[l.current_stage] || 'bg-gray-400'}`}>{STAGE_LABELS[l.current_stage] || l.current_stage}</span></td>
          <td className="px-2 py-2"><div className="flex gap-1">
            <button onClick={() => viewLead(l)} className="p-1 text-blue-600"><FiEye size={14} /></button>
            {canEdit('leads') && <button onClick={() => { setForm(l); setModal('edit'); }} className="p-1 text-amber-600"><FiEdit2 size={14} /></button>}
            {canDelete('leads') && <button onClick={async () => { if (!confirm('Delete?')) return; await api.delete(`/sales-funnel/${l.id}`); toast.success('Deleted'); load(); }} className="p-1 text-red-600"><FiTrash2 size={14} /></button>}
          </div></td>
        </tr>))}{leads.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-gray-400">No leads</td></tr>}</tbody>
      </table></div></div>

      {/* View + Stage Actions */}
      <Modal isOpen={modal === 'view'} onClose={() => { setModal(null); setViewData(null); }} title={`${viewData?.lead_no} - ${viewData?.client_name}`} wide>
        {viewData && (<div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-1 overflow-x-auto pb-2">{Object.entries(STAGE_LABELS).filter(([k]) => k !== 'lost').map(([key, label], idx) => {
            const keys = Object.keys(STAGE_LABELS).filter(k => k !== 'lost');
            const stageIdx = keys.indexOf(viewData.current_stage);
            const thisIdx = keys.indexOf(key);
            const isDone = thisIdx <= stageIdx;
            const isCurrent = viewData.current_stage === key;
            return (<div key={key} className="flex items-center"><div className={`px-2 py-1 rounded text-[9px] font-bold min-w-[55px] text-center ${isCurrent ? STAGE_COLORS[key]+' text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{label}</div>{idx < keys.length-1 && <FiChevronRight size={10} className="text-gray-300 mx-0.5" />}</div>);
          })}</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><span className="text-gray-400 text-[10px]">Client</span><br/><span className="font-medium">{viewData.client_name}</span></div>
            <div><span className="text-gray-400 text-[10px]">Company</span><br/><span className="font-medium">{viewData.company_name||'-'}</span></div>
            <div><span className="text-gray-400 text-[10px]">Category</span><br/><span className="font-medium">{viewData.category||'-'}</span></div>
            <div><span className="text-gray-400 text-[10px]">Phone</span><br/>{viewData.phone||'-'}</div>
            <div><span className="text-gray-400 text-[10px]">SC</span><br/>{viewData.assigned_sc||'-'}</div>
            <div><span className="text-gray-400 text-[10px]">ASM</span><br/>{viewData.assigned_asm||'-'}</div>
          </div>
          {viewData.qualified_remarks && <div className="bg-indigo-50 p-2 rounded text-xs"><strong>Qualified:</strong> {viewData.qualified_remarks}</div>}
          {viewData.meeting_date && <div className="bg-purple-50 p-2 rounded text-xs"><strong>Meeting:</strong> {viewData.meeting_date} - {viewData.meeting_location}</div>}
          {viewData.mom_notes && <div className="bg-violet-50 p-2 rounded text-xs"><strong>MOM:</strong> {viewData.mom_notes} {viewData.mom_file_link && <a href={viewData.mom_file_link} className="text-blue-600 underline" target="_blank" rel="noreferrer">File</a>}</div>}
          {viewData.drawing_file1 && <div className="bg-amber-50 p-2 rounded text-xs"><strong>Drawings:</strong> <a href={viewData.drawing_file1} className="text-blue-600 underline" target="_blank" rel="noreferrer">1</a> {viewData.drawing_file2 && <a href={viewData.drawing_file2} className="text-blue-600 underline ml-2" target="_blank" rel="noreferrer">2</a>} {viewData.drawing_file3 && <a href={viewData.drawing_file3} className="text-blue-600 underline ml-2" target="_blank" rel="noreferrer">3</a>}</div>}
          {viewData.boq_file_link && <div className="bg-orange-50 p-2 rounded text-xs"><strong>BOQ:</strong> Rs {viewData.boq_amount?.toLocaleString()} <a href={viewData.boq_file_link} className="text-blue-600 underline" target="_blank" rel="noreferrer">View</a></div>}
          {viewData.quotation_number && <div className="bg-cyan-50 p-2 rounded text-xs"><strong>Quotation:</strong> {viewData.quotation_number} - Rs {viewData.quotation_amount?.toLocaleString()}</div>}
          {viewData.result && <div className={`p-3 rounded font-bold text-center ${viewData.result==='won'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{viewData.result.toUpperCase()} {viewData.won_amount>0&&`- Rs ${viewData.won_amount.toLocaleString()}`} {viewData.result_remarks&&`(${viewData.result_remarks})`}</div>}

          {viewData.current_stage !== 'won' && viewData.current_stage !== 'lost' && (
            <div className="border-2 border-blue-300 rounded-xl p-4 bg-blue-50 space-y-3">
              <h5 className="font-bold text-blue-800">Next Action</h5>
              {viewData.current_stage === 'new_lead' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">SC: Qualify this lead</p>
                <textarea className="input" rows="2" placeholder="Remarks..." value={stageForm.qualified_remarks||''} onChange={e=>setStageForm({...stageForm,qualified_remarks:e.target.value})} />
                <div className="flex gap-2"><button onClick={()=>advanceStage(viewData.id,'qualified',stageForm)} className="btn btn-success flex-1"><FiCheck className="inline mr-1"/>Qualified</button><button onClick={()=>advanceStage(viewData.id,'not_qualified',stageForm)} className="btn btn-danger flex-1"><FiX className="inline mr-1"/>Not Qualified</button></div>
              </div>)}
              {viewData.current_stage === 'qualified' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">SC: Assign Meeting</p>
                <input className="input" type="datetime-local" value={stageForm.meeting_date||''} onChange={e=>setStageForm({...stageForm,meeting_date:e.target.value})} />
                <input className="input" placeholder="Location" value={stageForm.meeting_location||''} onChange={e=>setStageForm({...stageForm,meeting_location:e.target.value})} />
                <input className="input" placeholder="Assigned To (ASM)" value={stageForm.meeting_assigned_to||''} onChange={e=>setStageForm({...stageForm,meeting_assigned_to:e.target.value})} />
                <button onClick={()=>advanceStage(viewData.id,'meeting_assigned',stageForm)} className="btn btn-primary w-full"><FiCalendar className="inline mr-1"/>Assign Meeting</button>
              </div>)}
              {viewData.current_stage === 'meeting_assigned' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">ASM: Upload MOM</p>
                <textarea className="input" rows="3" placeholder="Meeting notes..." value={stageForm.mom_notes||''} onChange={e=>setStageForm({...stageForm,mom_notes:e.target.value})} />
                <input type="file" onChange={async(e)=>{const f=e.target.files[0];if(!f)return;try{stageForm.mom_file_link=await uploadFile(f);toast.success('Uploaded');}catch{toast.error('Failed');}}} className="text-xs" />
                <button onClick={()=>advanceStage(viewData.id,'mom_uploaded',stageForm)} disabled={!stageForm.mom_notes} className="btn btn-primary w-full disabled:opacity-50"><FiFileText className="inline mr-1"/>Submit MOM</button>
              </div>)}
              {viewData.current_stage === 'mom_uploaded' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">ASM: Upload Drawings</p>
                {[1,2,3].map(n=>(<div key={n} className="flex items-center gap-2"><span className="text-xs w-16">Drawing {n}:</span><input type="file" onChange={async(e)=>{const f=e.target.files[0];if(!f)return;try{const url=await uploadFile(f);setStageForm(s=>({...s,[`drawing_file${n}`]:url}));toast.success(`Drawing ${n}`);}catch{toast.error('Failed');}}} className="text-xs flex-1"/>{stageForm[`drawing_file${n}`]&&<span className="text-emerald-600 text-xs">OK</span>}</div>))}
                <button onClick={()=>advanceStage(viewData.id,'drawing_uploaded',stageForm)} disabled={!stageForm.drawing_file1} className="btn btn-primary w-full disabled:opacity-50"><FiUpload className="inline mr-1"/>Submit</button>
              </div>)}
              {viewData.current_stage === 'drawing_uploaded' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">Designer: Create BOQ</p>
                <input type="file" onChange={async(e)=>{const f=e.target.files[0];if(!f)return;try{stageForm.boq_file_link=await uploadFile(f);toast.success('BOQ uploaded');}catch{toast.error('Failed');}}} className="text-xs" />
                <input className="input" type="number" placeholder="BOQ Amount" value={stageForm.boq_amount||''} onChange={e=>setStageForm({...stageForm,boq_amount:+e.target.value})} />
                <button onClick={()=>advanceStage(viewData.id,'boq_created',stageForm)} className="btn btn-primary w-full">Submit BOQ</button>
              </div>)}
              {viewData.current_stage === 'boq_created' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">SC: Send Quotation</p>
                <input className="input" placeholder="Quotation Number" value={stageForm.quotation_number||''} onChange={e=>setStageForm({...stageForm,quotation_number:e.target.value})} />
                <input className="input" type="number" placeholder="Amount" value={stageForm.quotation_amount||''} onChange={e=>setStageForm({...stageForm,quotation_amount:+e.target.value})} />
                <input type="file" onChange={async(e)=>{const f=e.target.files[0];if(!f)return;try{stageForm.quotation_file_link=await uploadFile(f);toast.success('Uploaded');}catch{toast.error('Failed');}}} className="text-xs" />
                <button onClick={()=>advanceStage(viewData.id,'quotation_sent',stageForm)} className="btn btn-primary w-full">Send Quotation</button>
              </div>)}
              {viewData.current_stage === 'quotation_sent' && (<div className="space-y-2">
                <p className="text-xs text-blue-600 font-medium">SC: Final Result</p>
                <textarea className="input" rows="2" placeholder="Remarks..." value={stageForm.result_remarks||''} onChange={e=>setStageForm({...stageForm,result_remarks:e.target.value})} />
                <input className="input" type="number" placeholder="Won Amount" value={stageForm.won_amount||''} onChange={e=>setStageForm({...stageForm,won_amount:+e.target.value})} />
                <div className="flex gap-2"><button onClick={()=>advanceStage(viewData.id,'won',stageForm)} className="btn btn-success flex-1">WON</button><button onClick={()=>advanceStage(viewData.id,'lost',stageForm)} className="btn btn-danger flex-1">LOST</button></div>
              </div>)}
            </div>
          )}
        </div>)}
      </Modal>

      {/* Add/Edit */}
      <Modal isOpen={modal==='add'||modal==='edit'} onClose={()=>setModal(null)} title={modal==='edit'?'Edit Lead':'New Lead'} wide>
        <form onSubmit={saveLead} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Client Name *</label><input className="input" value={form.client_name||''} onChange={e=>F('client_name',e.target.value)} required/></div>
            <div><label className="label">Company</label><input className="input" value={form.company_name||''} onChange={e=>F('company_name',e.target.value)}/></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone||''} onChange={e=>F('phone',e.target.value)}/></div>
            <div><label className="label">Email</label><input className="input" value={form.email||''} onChange={e=>F('email',e.target.value)}/></div>
            <div><label className="label">Category</label><select className="select" value={form.category||''} onChange={e=>F('category',e.target.value)}><option value="">Select</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Source</label><select className="select" value={form.source||''} onChange={e=>F('source',e.target.value)}><option value="">Select</option><option>Inbound</option><option>Indiamart</option><option>WhatsApp</option><option>LinkedIn</option><option>Reference</option><option>Tender</option></select></div>
            <div><label className="label">Address</label><input className="input" value={form.address||''} onChange={e=>F('address',e.target.value)}/></div>
            <div><label className="label">District</label><input className="input" value={form.district||''} onChange={e=>F('district',e.target.value)}/></div>
            <div><label className="label">State</label><input className="input" value={form.state||''} onChange={e=>F('state',e.target.value)}/></div>
            <div><label className="label">SC</label><input className="input" value={form.assigned_sc||''} onChange={e=>F('assigned_sc',e.target.value)}/></div>
            <div><label className="label">ASM</label><input className="input" value={form.assigned_asm||''} onChange={e=>F('assigned_asm',e.target.value)}/></div>
          </div>
          <div><label className="label">Remarks</label><textarea className="input" rows="2" value={form.remarks||''} onChange={e=>F('remarks',e.target.value)}/></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={()=>setModal(null)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{modal==='edit'?'Update':'Create Lead'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
