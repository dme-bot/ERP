import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';

export default function Complaints() {
  const [tab, setTab] = useState('complaints');
  const [complaints, setComplaints] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});

  const load = () => {
    api.get('/installation/complaints').then(r => setComplaints(r.data));
    api.get('/installation/handover').then(r => setHandovers(r.data));
  };
  useEffect(() => {
    load();
    api.get('/installation').then(r => setInstallations(r.data));
    api.get('/auth/users').then(r => setUsers(r.data));
  }, []);

  const saveComplaint = async (e) => { e.preventDefault(); await api.post('/installation/complaints', form); toast.success('Created'); setModal(false); load(); };
  const updateComplaint = async (id, status, notes) => { await api.put(`/installation/complaints/${id}`, { status, resolution_notes: notes }); toast.success('Updated'); load(); };
  const saveHandover = async (e) => { e.preventDefault(); await api.post('/installation/handover', form); toast.success('Created'); setModal(false); load(); };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('complaints')} className={`btn ${tab === 'complaints' ? 'btn-primary' : 'btn-secondary'}`}>Complaints</button>
        <button onClick={() => setTab('handover')} className={`btn ${tab === 'handover' ? 'btn-primary' : 'btn-secondary'}`}>Handover Certificates</button>
      </div>

      {tab === 'complaints' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Complaint Management</h3>
            <button onClick={() => { setForm({ installation_id: '', description: '', priority: 'medium', assigned_to: '' }); setModal('complaint'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Raise Complaint</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Number</th><th>Description</th><th>Priority</th><th>Status</th><th>Created By</th><th>Assigned To</th><th>Actions</th></tr></thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.complaint_number}</td>
                  <td className="max-w-xs truncate">{c.description}</td>
                  <td><StatusBadge status={c.priority} /></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.created_by_name}</td><td>{c.assigned_to_name}</td>
                  <td>
                    {c.status !== 'closed' && (
                      <select className="select w-32" value={c.status} onChange={e => updateComplaint(c.id, e.target.value, c.resolution_notes)}>
                        {['open','in_progress','resolved','closed'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">No complaints</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'handover' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Handover Certificates</h3>
            <button onClick={() => { setForm({ installation_id: '', handover_date: '', client_signatory: '', company_signatory: '', notes: '' }); setModal('handover'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Certificate</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Certificate No</th><th>Date</th><th>Client Signatory</th><th>Company Signatory</th><th>Status</th></tr></thead>
            <tbody>
              {handovers.map(h => (
                <tr key={h.id}>
                  <td className="font-medium">{h.certificate_number}</td><td>{h.handover_date}</td>
                  <td>{h.client_signatory}</td><td>{h.company_signatory}</td>
                  <td><StatusBadge status={h.status} /></td>
                </tr>
              ))}
              {handovers.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">No certificates yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      <Modal isOpen={modal === 'complaint'} onClose={() => setModal(false)} title="Raise Complaint">
        <form onSubmit={saveComplaint} className="space-y-4">
          <div><label className="label">Installation</label><select className="select" value={form.installation_id} onChange={e => setForm({...form, installation_id: e.target.value})}><option value="">Select</option>{installations.map(i => <option key={i.id} value={i.id}>#{i.id} - {i.site_address}</option>)}</select></div>
          <div><label className="label">Description *</label><textarea className="input" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Priority</label><select className="select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>{['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="label">Assign To</label><select className="select" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}><option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'handover'} onClose={() => setModal(false)} title="Create Handover Certificate">
        <form onSubmit={saveHandover} className="space-y-4">
          <div><label className="label">Installation</label><select className="select" value={form.installation_id} onChange={e => setForm({...form, installation_id: e.target.value})}><option value="">Select</option>{installations.map(i => <option key={i.id} value={i.id}>#{i.id} - {i.site_address}</option>)}</select></div>
          <div><label className="label">Handover Date</label><input className="input" type="date" value={form.handover_date} onChange={e => setForm({...form, handover_date: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Signatory</label><input className="input" value={form.client_signatory} onChange={e => setForm({...form, client_signatory: e.target.value})} /></div>
            <div><label className="label">Company Signatory</label><input className="input" value={form.company_signatory} onChange={e => setForm({...form, company_signatory: e.target.value})} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>
    </div>
  );
}
