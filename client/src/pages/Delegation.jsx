import { useState, useEffect, useRef } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiMic, FiMicOff, FiUpload, FiCheck, FiX, FiTrash2, FiExternalLink, FiAlertTriangle, FiClock, FiCalendar } from 'react-icons/fi';

// Web Speech API — available as SpeechRecognition in Chromium-based browsers
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function Delegation() {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [scope, setScope] = useState('mine'); // mine | given | all
  const [statusFilter, setStatusFilter] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(null); // task being submitted
  const [rejectModal, setRejectModal] = useState(null); // task being rejected
  const [extendModal, setExtendModal] = useState(null); // task: assignee requests more time
  const [form, setForm] = useState({});
  const [submitForm, setSubmitForm] = useState({ proof_url: '', uploading: false });
  const [rejectReason, setRejectReason] = useState('');
  const [extendForm, setExtendForm] = useState({ requested_due_date: '', reason: '' });
  // Voice input
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const load = () => {
    const params = new URLSearchParams({ scope });
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/delegations?${params.toString()}`).then(r => setTasks(r.data)).catch(() => setTasks([]));
  };
  useEffect(() => {
    load();
    api.get('/auth/users').then(r => setUsers((r.data || []).filter(u => u.active !== 0))).catch(() => {});
  }, [scope, statusFilter]);

  // Voice → description. Appends to existing text so user can combine typing + voice.
  const toggleVoice = () => {
    if (!SR) {
      toast.error("Your browser doesn't support voice input. Use Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = true;
    let finalBuf = '';
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalBuf += t + ' ';
        else interim += t;
      }
      setForm(f => ({ ...f, description: ((f._base || '') + finalBuf + interim).trim() }));
    };
    rec.onstart = () => setForm(f => ({ ...f, _base: (f.description ? f.description + ' ' : '') }));
    rec.onerror = (e) => { toast.error('Voice error: ' + (e.error || 'unknown')); setListening(false); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const openCreate = () => {
    setForm({ description: '', assigned_to: '', due_date: new Date().toISOString().split('T')[0] });
    setCreateModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!String(form.description || '').trim()) return toast.error('Description is required');
    try {
      await api.post('/delegations', { description: form.description, assigned_to: form.assigned_to, due_date: form.due_date });
      toast.success('Task assigned');
      setCreateModal(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create'); }
  };

  // Extension request / approval (admin)
  const requestExtension = async (e) => {
    e.preventDefault();
    if (!extendForm.requested_due_date) return toast.error('Pick a new date');
    if (!extendForm.reason.trim()) return toast.error('Reason is required');
    try {
      await api.post(`/delegations/${extendModal.id}/request-extension`, extendForm);
      toast.success('Extension requested — admin will review');
      setExtendModal(null); setExtendForm({ requested_due_date: '', reason: '' }); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const approveExtension = async (task) => {
    if (!confirm(`Approve extension to ${task.requested_due_date}?`)) return;
    try { await api.post(`/delegations/${task.id}/approve-extension`); toast.success('Extension approved'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const rejectExtension = async (task) => {
    if (!confirm(`Reject extension request for "${task.title}"?`)) return;
    try { await api.post(`/delegations/${task.id}/reject-extension`); toast.success('Extension rejected'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  // Upload proof file then submit
  const uploadProof = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    setSubmitForm(s => ({ ...s, uploading: true }));
    try {
      const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSubmitForm({ proof_url: res.data.url, uploading: false });
      toast.success('File uploaded — click Submit');
    } catch { toast.error('Upload failed'); setSubmitForm(s => ({ ...s, uploading: false })); }
  };
  const submitProof = async (e) => {
    e.preventDefault();
    if (!submitForm.proof_url) return toast.error('Please upload proof first');
    try {
      await api.post(`/delegations/${submitModal.id}/submit`, { proof_url: submitForm.proof_url });
      toast.success('Proof submitted — awaiting approval');
      setSubmitModal(null); setSubmitForm({ proof_url: '', uploading: false }); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const approve = async (task) => {
    if (!confirm(`Approve "${task.title}"?`)) return;
    try { await api.post(`/delegations/${task.id}/approve`); toast.success('Approved'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const reject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return toast.error('Reason is required');
    try {
      await api.post(`/delegations/${rejectModal.id}/reject`, { reason: rejectReason });
      toast.success('Rejected — assignee notified');
      setRejectModal(null); setRejectReason(''); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const del = async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try { await api.delete(`/delegations/${task.id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const statusBadge = (s) => {
    const map = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      submitted: 'bg-blue-100 text-blue-800 border-blue-200',
      approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${map[s] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{s}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Delegations</h3>
          <p className="text-sm text-gray-500">Assign tasks, upload proof, approve or reject</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-2"><FiPlus /> New Task</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { id: 'mine', label: 'Assigned to me' },
          ...(isAdmin() ? [{ id: 'all', label: 'All (admin)' }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setScope(t.id)}
            className={`px-3 py-1.5 rounded-lg font-medium border ${scope === t.id ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
        <select className="select text-sm max-w-[180px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {tasks.length === 0 && <div className="card text-center text-gray-400 py-8">No tasks</div>}
        {tasks.map(t => {
          const isAssignee = t.assigned_to === user?.id;
          const isAssigner = t.assigned_by === user?.id;
          return (
            <div key={t.id} className={`card p-3 ${t.status === 'rejected' ? 'border-l-4 border-red-500' : t.status === 'submitted' ? 'border-l-4 border-blue-500' : ''}`}>
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(t.status)}
                    {t.due_date && <span className="text-[11px] text-gray-500 flex items-center gap-1"><FiClock size={11} /> Due {t.due_date}</span>}
                  </div>
                  {t.description && <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap font-medium">{t.description}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-gray-500">
                    <span>Assigned by <b>{t.assigned_by_name}</b></span>
                    <span>to <b>{t.assigned_to_name}</b></span>
                    {t.proof_url && <a href={t.proof_url} target="_blank" rel="noreferrer" className="text-red-600 flex items-center gap-1 hover:underline"><FiExternalLink size={11} /> View proof</a>}
                  </div>
                  {t.status === 'rejected' && t.reject_reason && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded px-2 py-1.5 text-[11px] text-red-700 flex items-start gap-1.5">
                      <FiAlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span><b>Rejected:</b> {t.reject_reason}</span>
                    </div>
                  )}
                  {t.extension_status === 'pending' && t.requested_due_date && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                      <FiCalendar size={12} className="mt-0.5 flex-shrink-0" />
                      <span><b>Extension requested:</b> new date {t.requested_due_date}{t.extension_reason ? ` — ${t.extension_reason}` : ''}. Awaiting admin review.</span>
                    </div>
                  )}
                  {t.extension_status === 'rejected' && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-600 flex items-start gap-1.5">
                      <FiX size={12} className="mt-0.5 flex-shrink-0" />
                      <span>Previous extension request was rejected by admin.</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                  {isAssignee && (t.status === 'pending' || t.status === 'rejected') && (
                    <button onClick={() => { setSubmitModal(t); setSubmitForm({ proof_url: '', uploading: false }); }} className="btn btn-success text-xs px-3 py-1 flex items-center gap-1"><FiUpload size={12} /> Submit Proof</button>
                  )}
                  {isAssignee && t.status !== 'approved' && t.extension_status !== 'pending' && (
                    <button onClick={() => { setExtendModal(t); setExtendForm({ requested_due_date: t.due_date || '', reason: '' }); }} className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"><FiCalendar size={12} /> Request Extension</button>
                  )}
                  {isAssigner && t.status === 'submitted' && (
                    <>
                      <button onClick={() => approve(t)} className="btn btn-success text-xs px-3 py-1 flex items-center gap-1"><FiCheck size={12} /> Approve</button>
                      <button onClick={() => { setRejectModal(t); setRejectReason(''); }} className="btn btn-danger text-xs px-3 py-1 flex items-center gap-1"><FiX size={12} /> Reject</button>
                    </>
                  )}
                  {isAdmin() && t.extension_status === 'pending' && (
                    <>
                      <button onClick={() => approveExtension(t)} className="btn btn-success text-xs px-3 py-1 flex items-center gap-1" title={`Approve extension to ${t.requested_due_date}`}><FiCheck size={12} /> Approve Ext</button>
                      <button onClick={() => rejectExtension(t)} className="btn btn-danger text-xs px-3 py-1 flex items-center gap-1"><FiX size={12} /> Reject Ext</button>
                    </>
                  )}
                  {(isAssigner || isAdmin()) && <button onClick={() => del(t)} className="p-1.5 text-gray-400 hover:text-red-600"><FiTrash2 size={13} /></button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Assign New Task">
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label flex items-center justify-between">
              <span>Task Description * {listening && <span className="ml-2 text-[10px] text-red-600 animate-pulse">● Listening…</span>}</span>
              <button type="button" onClick={toggleVoice} className={`text-[11px] px-2 py-1 rounded-full flex items-center gap-1 ${listening ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {listening ? <><FiMicOff size={12} /> Stop</> : <><FiMic size={12} /> Voice</>}
              </button>
            </label>
            <textarea className="input" rows="4" required value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value, _base: undefined })} placeholder="Type or speak the task details…" />
            {!SR && <p className="text-[10px] text-amber-600 mt-0.5">Voice input needs Chrome or Edge browser.</p>}
          </div>
          <div>
            <label className="label">Assign To *</label>
            <SearchableSelect
              options={users.map(u => ({ ...u, label: `${u.name}${u.username ? ' (@' + u.username + ')' : ''}` }))}
              value={form.assigned_to || null}
              valueKey="id" displayKey="label"
              placeholder="Search user by name or username…"
              onChange={(u) => setForm({ ...form, assigned_to: u?.id || '' })}
            />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input className="input" type="date" value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Assign Task</button>
          </div>
        </form>
      </Modal>

      {/* Submit Proof Modal */}
      <Modal isOpen={!!submitModal} onClose={() => setSubmitModal(null)} title={submitModal ? `Submit proof — ${submitModal.title}` : 'Submit proof'}>
        <form onSubmit={submitProof} className="space-y-3">
          {submitModal?.status === 'rejected' && submitModal.reject_reason && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              <p className="font-semibold mb-0.5 flex items-center gap-1"><FiAlertTriangle size={12} /> Previous rejection</p>
              <p>{submitModal.reject_reason}</p>
            </div>
          )}
          <div>
            <label className="label">Upload proof (photo / PDF / doc)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" disabled={submitForm.uploading}
              onChange={e => { const f = e.target.files[0]; if (f) uploadProof(f); }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" />
            {submitForm.uploading && <p className="text-xs text-red-500 mt-1">Uploading…</p>}
            {submitForm.proof_url && <p className="text-xs text-emerald-600 mt-1">✓ Ready to submit</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSubmitModal(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={!submitForm.proof_url || submitForm.uploading} className="btn btn-primary disabled:opacity-50">Submit for Approval</button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title={rejectModal ? `Reject — ${rejectModal.title}` : 'Reject'}>
        <form onSubmit={reject} className="space-y-3">
          <div>
            <label className="label">Reason for rejection *</label>
            <textarea className="input" rows="3" value={rejectReason} onChange={e => setRejectReason(e.target.value)} required placeholder="Explain what needs to change so the assignee can fix and resubmit" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejectModal(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-danger">Reject & Send Back</button>
          </div>
        </form>
      </Modal>

      {/* Request Extension Modal (assignee) — routed to admin for approval */}
      <Modal isOpen={!!extendModal} onClose={() => setExtendModal(null)} title="Request Due-Date Extension">
        <form onSubmit={requestExtension} className="space-y-3">
          <p className="text-xs text-gray-500">Ask admin for more time on this task. They will see your request and approve or reject it.</p>
          <div>
            <label className="label">New requested date *</label>
            <input className="input" type="date" required min={extendModal?.due_date || undefined}
              value={extendForm.requested_due_date} onChange={e => setExtendForm(s => ({ ...s, requested_due_date: e.target.value }))} />
            {extendModal?.due_date && <p className="text-[10px] text-gray-400 mt-0.5">Current due date: {extendModal.due_date}</p>}
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea className="input" rows="3" required value={extendForm.reason} onChange={e => setExtendForm(s => ({ ...s, reason: e.target.value }))} placeholder="Why do you need more time?" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setExtendModal(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Send Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
