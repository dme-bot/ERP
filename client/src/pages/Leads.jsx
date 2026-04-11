import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const statuses = ['new','called','qualified','meeting_scheduled','meeting_done','boq_drawing','quotation_sent','negotiation','won','lost'];

export default function Leads() {
  const { canCreate, canEdit, canDelete } = useAuth();
  const [leads, setLeads] = useState([]);
  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ company_name: '', contact_person: '', phone: '', email: '', source_id: '', status: 'new', assigned_to: '', notes: '' });

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (filterStatus) params.status = filterStatus;
    api.get('/leads', { params }).then(r => setLeads(r.data));
  };

  useEffect(() => {
    load();
    api.get('/leads/sources').then(r => setSources(r.data));
    api.get('/auth/users').then(r => setUsers(r.data));
  }, [search, filterStatus]);

  const openCreate = () => {
    setEditing(null);
    setForm({ company_name: '', contact_person: '', phone: '', email: '', source_id: '', status: 'new', assigned_to: '', notes: '' });
    setModal(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setForm({ ...lead, source_id: lead.source_id || '', assigned_to: lead.assigned_to || '' });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/leads/${editing.id}`, form);
        toast.success('Lead updated');
      } else {
        await api.post('/leads', form);
        toast.success('Lead created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await api.delete(`/leads/${id}`);
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input className="input pl-9 w-64" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select w-48" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {canCreate('leads') && <button onClick={openCreate} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Lead</button>}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Contact</th><th>Phone</th><th>Source</th><th>Status</th><th>Assigned To</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id}>
                  <td className="font-medium">{l.company_name}</td>
                  <td>{l.contact_person}</td>
                  <td>{l.phone}</td>
                  <td>{l.source_name}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td>{l.assigned_to_name}</td>
                  <td>
                    <div className="flex gap-2">
                      {canEdit('leads') && <button onClick={() => openEdit(l)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><FiEdit2 size={15} /></button>}
                      {canDelete('leads') && <button onClick={() => remove(l.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><FiTrash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">No leads found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Lead' : 'Add Lead'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Company Name *</label><input className="input" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} required /></div>
            <div><label className="label">Contact Person</label><input className="input" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div>
              <label className="label">Source</label>
              <select className="select" value={form.source_id} onChange={e => setForm({...form, source_id: e.target.value})}>
                <option value="">Select</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <select className="select" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                <option value="">Select</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
