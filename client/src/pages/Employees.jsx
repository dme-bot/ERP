import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = () => api.get('/hr/employees').then(r => setEmployees(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (editing) { await api.put(`/hr/employees/${editing.id}`, form); }
    else { await api.post('/hr/employees', form); }
    toast.success(editing ? 'Updated' : 'Created');
    setModal(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Employee Directory</h3>
        <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', email: '', designation: '', department: '', join_date: '', salary: 0 }); setModal(true); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Employee</button>
      </div>
      <div className="card p-0 overflow-hidden"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Designation</th><th>Department</th><th>Join Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {employees.map(e => (
            <tr key={e.id}>
              <td className="font-medium">{e.name}</td><td>{e.phone}</td><td>{e.email}</td>
              <td>{e.designation}</td><td>{e.department}</td><td>{e.join_date}</td>
              <td><StatusBadge status={e.status} /></td>
              <td><button onClick={() => { setEditing(e); setForm(e); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><FiEdit2 size={15} /></button></td>
            </tr>
          ))}
          {employees.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-gray-400">No employees yet</td></tr>}
        </tbody>
      </table></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label className="label">Designation</label><input className="input" value={form.designation || ''} onChange={e => setForm({...form, designation: e.target.value})} /></div>
            <div><label className="label">Department</label><input className="input" value={form.department || ''} onChange={e => setForm({...form, department: e.target.value})} /></div>
            <div><label className="label">Join Date</label><input className="input" type="date" value={form.join_date || ''} onChange={e => setForm({...form, join_date: e.target.value})} /></div>
            <div><label className="label">Salary (Rs)</label><input className="input" type="number" value={form.salary || 0} onChange={e => setForm({...form, salary: +e.target.value})} /></div>
            {editing && <div><label className="label">Status</label><select className="select" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>{['active','training','inactive','terminated'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
