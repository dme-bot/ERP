import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

const candidateStatuses = ['lead','called','qualified','interview_scheduled','interview_done','offer_sent','accepted','onboarded','rejected'];
const sources = ['facebook','naukri','linkedin','reference','other'];

export default function HR() {
  const { canDelete } = useAuth();
  const [tab, setTab] = useState('candidates');
  const [candidates, setCandidates] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = () => {
    api.get('/hr/candidates').then(r => setCandidates(r.data));
    api.get('/hr/sub-contractors').then(r => setContractors(r.data));
  };
  useEffect(() => { load(); }, []);

  const saveCandidate = async (e) => {
    e.preventDefault();
    if (editing) { await api.put(`/hr/candidates/${editing.id}`, form); }
    else { await api.post('/hr/candidates', form); }
    toast.success(editing ? 'Updated' : 'Created');
    setModal(false); load();
  };

  const saveContractor = async (e) => {
    e.preventDefault();
    if (editing) { await api.put(`/hr/sub-contractors/${editing.id}`, form); }
    else { await api.post('/hr/sub-contractors', form); }
    toast.success(editing ? 'Updated' : 'Created');
    setModal(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('candidates')} className={`btn ${tab === 'candidates' ? 'btn-primary' : 'btn-secondary'}`}>Candidates</button>
        <button onClick={() => setTab('contractors')} className={`btn ${tab === 'contractors' ? 'btn-primary' : 'btn-secondary'}`}>Sub-Contractors</button>
      </div>

      {tab === 'candidates' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Hiring Pipeline</h3>
            <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', email: '', source: 'naukri', position: '', notes: '' }); setModal('candidate'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Candidate</button>
          </div>
          <div className="card p-0 overflow-x-auto"><table>
            <thead><tr><th>Name</th><th>Phone</th><th>Position</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {candidates.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td><td>{c.phone}</td><td>{c.position}</td>
                  <td className="capitalize">{c.source}</td><td><StatusBadge status={c.status} /></td>
                  <td><div className="flex gap-1">
                    <button onClick={() => { setEditing(c); setForm(c); setModal('candidate'); }} className="p-1.5 hover:bg-red-50 rounded text-red-600"><FiEdit2 size={15} /></button>
                    {canDelete('hr') && <button onClick={async () => {
                      if (!confirm(`Delete candidate "${c.name}"?`)) return;
                      try { await api.delete(`/hr/candidates/${c.id}`); toast.success('Deleted'); load(); }
                      catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                    }} className="p-1 text-gray-400 hover:text-red-600"><FiTrash2 size={14} /></button>}
                  </div></td>
                </tr>
              ))}
              {candidates.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No candidates yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'contractors' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Sub-Contractors</h3>
            <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', email: '', specialization: '', rate: 0, rate_unit: 'per_day', notes: '' }); setModal('contractor'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Contractor</button>
          </div>
          <div className="card p-0 overflow-x-auto"><table>
            <thead><tr><th>Name</th><th>Phone</th><th>Specialization</th><th>Rate</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {contractors.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td><td>{c.phone}</td><td>{c.specialization}</td>
                  <td>Rs {c.rate}/{c.rate_unit?.replace(/_/g,' ')}</td><td><StatusBadge status={c.status} /></td>
                  <td><div className="flex gap-1">
                    <button onClick={() => { setEditing(c); setForm(c); setModal('contractor'); }} className="p-1.5 hover:bg-red-50 rounded text-red-600"><FiEdit2 size={15} /></button>
                    {canDelete('hr') && <button onClick={async () => {
                      if (!confirm(`Delete contractor "${c.name}"?`)) return;
                      try { await api.delete(`/hr/sub-contractors/${c.id}`); toast.success('Deleted'); load(); }
                      catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                    }} className="p-1 text-gray-400 hover:text-red-600"><FiTrash2 size={14} /></button>}
                  </div></td>
                </tr>
              ))}
              {contractors.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No contractors yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      <Modal isOpen={modal === 'candidate'} onClose={() => setModal(false)} title={editing ? 'Edit Candidate' : 'Add Candidate'}>
        <form onSubmit={saveCandidate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label className="label">Position</label><input className="input" value={form.position || ''} onChange={e => setForm({...form, position: e.target.value})} /></div>
            <div><label className="label">Source</label><select className="select" value={form.source || ''} onChange={e => setForm({...form, source: e.target.value})}>{sources.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            {editing && <div><label className="label">Status</label><select className="select" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>{candidateStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>}
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'contractor'} onClose={() => setModal(false)} title={editing ? 'Edit Contractor' : 'Add Contractor'}>
        <form onSubmit={saveContractor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label className="label">Specialization</label><input className="input" value={form.specialization || ''} onChange={e => setForm({...form, specialization: e.target.value})} /></div>
            <div><label className="label">Rate (Rs)</label><input className="input" type="number" value={form.rate || 0} onChange={e => setForm({...form, rate: +e.target.value})} /></div>
            <div><label className="label">Rate Unit</label><select className="select" value={form.rate_unit || 'per_day'} onChange={e => setForm({...form, rate_unit: e.target.value})}><option value="per_day">Per Day</option><option value="per_hour">Per Hour</option><option value="per_sqft">Per Sqft</option><option value="lump_sum">Lump Sum</option></select></div>
            {editing && <div><label className="label">Status</label><select className="select" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>{['qualified','negotiation','onboarded','active','inactive'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
