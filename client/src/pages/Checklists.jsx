import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function Checklists() {
  const { canDelete, isAdmin } = useAuth();
  const [checklists, setChecklists] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = () => api.get('/hr/checklists').then(r => setChecklists(r.data));
  useEffect(() => { load(); api.get('/auth/users').then(r => setUsers(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (editing) { await api.put(`/hr/checklists/${editing.id}`, form); }
    else { await api.post('/hr/checklists', form); }
    toast.success(editing ? 'Updated' : 'Created');
    setModal(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Checklists & Recurring Tasks</h3>
        {isAdmin() && (
          <button onClick={() => { setEditing(null); setForm({ description: '', frequency: 'monthly', due_date: '', due_time: '', assigned_to: '' }); setModal(true); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Checklist</button>
        )}
      </div>
      {!isAdmin() && (
        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Only admins can create checklists. Upload your daily proof from the Dashboard.
        </p>
      )}
      <div className="card p-0 overflow-hidden"><table>
        <thead><tr><th>Task</th><th>Frequency</th><th>Due Date / Time</th><th>Assigned To</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {checklists.map(c => (
            <tr key={c.id}>
              <td className="font-medium max-w-md"><div className="line-clamp-2">{c.description || c.title}</div></td>
              <td className="capitalize">{c.frequency}</td>
              <td>
                {c.frequency === 'daily'
                  ? (c.due_time ? <span className="font-mono">{c.due_time}</span> : <span className="text-gray-400">anytime</span>)
                  : <span>{c.due_date || '—'}{c.due_time ? ` · ${c.due_time}` : ''}</span>}
              </td>
              <td>{c.assigned_to_name || <span className="text-gray-400">—</span>}</td>
              <td><StatusBadge status={c.status} /></td>
              <td><div className="flex gap-1">
                {isAdmin() && <button onClick={() => { setEditing(c); setForm(c); setModal(true); }} className="p-1.5 hover:bg-red-50 rounded text-red-600"><FiEdit2 size={15} /></button>}
                {isAdmin() && canDelete('checklists') && <button onClick={async () => {
                  if (!confirm(`Delete this checklist?`)) return;
                  try { await api.delete(`/hr/checklists/${c.id}`); toast.success('Deleted'); load(); }
                  catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                }} className="p-1 text-gray-400 hover:text-red-600"><FiTrash2 size={14} /></button>}
                {!isAdmin() && <span className="text-[10px] text-gray-400">view only</span>}
              </div></td>
            </tr>
          ))}
          {checklists.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No checklists yet</td></tr>}
        </tbody>
      </table></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Checklist' : 'Add Checklist'}>
        <form onSubmit={save} className="space-y-4">
          <div><label className="label">Task Description *</label><textarea className="input" rows="3" required value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="What needs to be done…" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Frequency</label><select className="select" value={form.frequency || 'monthly'} onChange={e => setForm({...form, frequency: e.target.value})}>{['daily','weekly','monthly','quarterly','yearly','once'].map(f => <option key={f} value={f}>{f}</option>)}</select></div>
            {/* For 'once' tasks we keep the Due Date. For recurring (daily/weekly/…),
                we show Time of Day instead since the date is derived from the frequency. */}
            {form.frequency === 'daily' ? (
              <div><label className="label">Time of Day</label><input className="input" type="time" value={form.due_time || ''} onChange={e => setForm({...form, due_time: e.target.value})} /><p className="text-[10px] text-gray-400 mt-0.5">When should this task be done each day?</p></div>
            ) : (
              <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date || ''} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
            )}
            {form.frequency !== 'daily' && (
              <div><label className="label">Time of Day <span className="text-gray-400 font-normal">(optional)</span></label><input className="input" type="time" value={form.due_time || ''} onChange={e => setForm({...form, due_time: e.target.value})} /></div>
            )}
            <div><label className="label">Assigned To *</label><select className="select" required value={form.assigned_to || ''} onChange={e => setForm({...form, assigned_to: e.target.value})}><option value="">Select a user…</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            {editing && <div><label className="label">Status</label><select className="select" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>{['pending','in_progress','completed','overdue'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>}
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
