import { useState, useEffect } from 'react';
import api from '../../api';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiUserX, FiUserCheck, FiKey } from 'react-icons/fi';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [selectedRoles, setSelectedRoles] = useState([]);

  const load = () => {
    api.get('/auth/users').then(r => setUsers(r.data));
    api.get('/auth/roles').then(r => setRoles(r.data));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'user', department: '', phone: '', active: true });
    setSelectedRoles([]);
    setModal(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({ ...user, password: '', active: !!user.active });
    // Parse existing roles
    const currentRoleNames = user.role_names ? user.role_names.split(',') : [];
    const roleIds = roles.filter(r => currentRoleNames.includes(r.name)).map(r => r.id);
    setSelectedRoles(roleIds);
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/auth/users/${editing.id}`, { ...form, role_ids: selectedRoles });
        toast.success('User updated');
      } else {
        if (!form.password) return toast.error('Password is required');
        await api.post('/auth/register', { ...form, role_ids: selectedRoles });
        toast.success('User created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const toggleActive = async (user) => {
    await api.put(`/auth/users/${user.id}`, { ...user, active: !user.active, role_ids: undefined });
    toast.success(user.active ? 'User deactivated' : 'User activated');
    load();
  };

  const toggleRole = (roleId) => {
    setSelectedRoles(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-800">User Management</h3>
          <p className="text-sm text-gray-500">Create users and assign roles to control access</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add User</button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600">{users.length}</div>
          <div className="text-sm text-gray-500">Total Users</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-emerald-600">{users.filter(u => u.active).length}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-red-600">{users.filter(u => !u.active).length}</div>
          <div className="text-sm text-gray-500">Inactive</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600">{users.filter(u => u.role === 'admin').length}</div>
          <div className="text-sm text-gray-500">Admins</div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>System Role</th><th>Assigned Roles</th><th>Department</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-gray-600">{u.email}</td>
                <td>{u.phone}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'manager' ? 'badge-purple' : 'badge-blue'}`}>{u.role}</span></td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.role_names ? u.role_names.split(',').map((r, i) => (
                      <span key={i} className="badge badge-green text-[10px]">{r}</span>
                    )) : <span className="text-xs text-gray-400">No roles</span>}
                  </div>
                </td>
                <td>{u.department}</td>
                <td>{u.active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Edit"><FiEdit2 size={15} /></button>
                    <button onClick={() => toggleActive(u)} className={`p-1.5 rounded ${u.active ? 'hover:bg-red-50 text-red-600' : 'hover:bg-green-50 text-green-600'}`} title={u.active ? 'Deactivate' : 'Activate'}>
                      {u.active ? <FiUserX size={15} /> : <FiUserCheck size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit User' : 'Create New User'} wide>
        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Full Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Department</label><input className="input" value={form.department || ''} onChange={e => setForm({...form, department: e.target.value})} /></div>
            <div>
              <label className="label">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input className="input" type="password" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} {...(!editing && { required: true })} />
            </div>
            <div>
              <label className="label">System Role</label>
              <select className="select" value={form.role || 'user'} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Role Assignment */}
          <div>
            <label className="label flex items-center gap-2"><FiKey size={14} /> Assign Permission Roles</label>
            <p className="text-xs text-gray-500 mb-3">Select which roles this user should have. Each role grants specific permissions to modules.</p>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <label key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedRoles.includes(r.id) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} className="w-4 h-4" />
              <span>User is Active</span>
            </label>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Update User' : 'Create User'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
