import { useState, useEffect, useRef } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiDownload, FiUpload, FiSearch, FiUsers } from 'react-icons/fi';

export default function Employees() {
  const { canDelete } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [bulkData, setBulkData] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const fileRef = useRef(null);

  const load = () => api.get('/hr/employees').then(r => setEmployees(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (editing) { await api.put(`/hr/employees/${editing.id}`, form); }
    else { await api.post('/hr/employees', form); }
    toast.success(editing ? 'Updated' : 'Created');
    setModal(false); load();
  };

  // Export CSV
  const exportCSV = () => {
    if (employees.length === 0) return toast.error('No data');
    const headers = ['Name', 'Phone', 'Email', 'Designation', 'Department', 'Join Date', 'Salary', 'Status'];
    const rows = employees.map(e => [e.name, e.phone, e.email, e.designation, e.department, e.join_date, e.salary, e.status]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  // Download template
  const downloadTemplate = () => {
    const csv = 'Name,Phone,Email,Designation,Department,Join Date (YYYY-MM-DD),Salary\nJohn Doe,9876543210,john@example.com,Engineer,Engineering,2024-01-15,50000\nJane Smith,9123456789,jane@example.com,Manager,HR,2024-02-01,60000';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'employee-bulk-template.csv';
    a.click();
    toast.success('Template downloaded');
  };

  // Parse CSV
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (cols[0]) {
        rows.push({
          name: cols[0] || '',
          phone: cols[1] || '',
          email: cols[2] || '',
          designation: cols[3] || '',
          department: cols[4] || '',
          join_date: cols[5] || '',
          salary: parseFloat(cols[6]) || 0,
        });
      }
    }
    return rows;
  };

  // Handle file upload
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setBulkData(text);
      const parsed = parseCSV(text);
      setBulkPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle paste data
  const handlePaste = (text) => {
    setBulkData(text);
    if (text.trim()) {
      const parsed = parseCSV(text);
      setBulkPreview(parsed);
    } else {
      setBulkPreview([]);
    }
  };

  // Bulk import
  const bulkImport = async () => {
    if (bulkPreview.length === 0) return toast.error('No valid data to import');
    try {
      const res = await api.post('/hr/employees/bulk', { employees: bulkPreview });
      toast.success(`Added ${res.data.added} of ${res.data.total} employees`);
      if (res.data.errors.length > 0) {
        toast.error(`${res.data.errors.length} errors: ${res.data.errors[0]}`);
      }
      setBulkModal(false); setBulkData(''); setBulkPreview([]); load();
    } catch (err) { toast.error('Import failed'); }
  };

  const filtered = employees.filter(e =>
    !search || [e.name, e.phone, e.email, e.designation, e.department].some(f => (f || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><FiUsers className="text-blue-600" /> Employee Directory</h3>
          <p className="text-sm text-gray-500">{employees.length} total employees</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="btn btn-secondary flex items-center gap-2 text-sm"><FiDownload size={15} /> Export CSV</button>
          <button onClick={() => { setBulkData(''); setBulkPreview([]); setBulkModal(true); }} className="btn btn-secondary flex items-center gap-2 text-sm"><FiUpload size={15} /> Bulk Import</button>
          <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', email: '', designation: '', department: '', join_date: '', salary: 0 }); setModal(true); }} className="btn btn-primary flex items-center gap-2"><FiPlus size={15} /> Add Employee</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input className="input pl-10" placeholder="Search by name, phone, email, designation, department..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Designation</th><th>Department</th><th>Join Date</th><th>Salary</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id}>
              <td className="font-medium">{e.name}</td><td>{e.phone}</td><td>{e.email}</td>
              <td>{e.designation}</td><td>{e.department}</td><td>{e.join_date}</td>
              <td className="font-medium">Rs {(e.salary || 0).toLocaleString('en-IN')}</td>
              <td><StatusBadge status={e.status} /></td>
              <td><div className="flex gap-1">
                <button onClick={() => { setEditing(e); setForm(e); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><FiEdit2 size={15} /></button>
                {canDelete('employees') && <button onClick={async () => {
                  if (!confirm(`Delete employee "${e.name}"?`)) return;
                  try { await api.delete(`/hr/employees/${e.id}`); toast.success('Deleted'); load(); }
                  catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                }} className="p-1 text-gray-400 hover:text-red-600"><FiTrash2 size={14} /></button>}
              </div></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan="9" className="text-center py-8 text-gray-400">No employees found</td></tr>}
        </tbody>
      </table></div>

      {/* Add/Edit Modal */}
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

      {/* Bulk Import Modal */}
      <Modal isOpen={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Import Employees" wide>
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <p className="font-semibold mb-1">How to bulk import:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Download the CSV template below</li>
              <li>Fill in your employee data (keep the header row)</li>
              <li>Upload the CSV file or paste the data below</li>
              <li>Review the preview and click Import</li>
            </ol>
          </div>

          <button onClick={downloadTemplate} className="btn btn-secondary text-sm flex items-center gap-2"><FiDownload size={14} /> Download CSV Template</button>

          <div>
            <label className="label">Upload CSV File</label>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          <div>
            <label className="label">Or Paste CSV Data</label>
            <textarea className="input font-mono text-xs" rows="6" placeholder="Name,Phone,Email,Designation,Department,Join Date,Salary&#10;John Doe,9876543210,john@example.com,Engineer,Engineering,2024-01-15,50000"
              value={bulkData} onChange={e => handlePaste(e.target.value)} />
          </div>

          {/* Preview */}
          {bulkPreview.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview: {bulkPreview.length} employees to import</p>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">Phone</th><th className="px-2 py-1.5">Email</th><th className="px-2 py-1.5">Designation</th><th className="px-2 py-1.5">Department</th><th className="px-2 py-1.5">Join Date</th><th className="px-2 py-1.5">Salary</th></tr></thead>
                  <tbody>
                    {bulkPreview.map((e, i) => (
                      <tr key={i} className={!e.name ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1.5 font-medium">{e.name || '(empty)'}</td>
                        <td className="px-2 py-1.5">{e.phone}</td><td className="px-2 py-1.5">{e.email}</td>
                        <td className="px-2 py-1.5">{e.designation}</td><td className="px-2 py-1.5">{e.department}</td>
                        <td className="px-2 py-1.5">{e.join_date}</td><td className="px-2 py-1.5">{e.salary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setBulkModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={bulkImport} disabled={bulkPreview.length === 0} className="btn btn-primary flex items-center gap-2 disabled:opacity-50">
              <FiUpload size={14} /> Import {bulkPreview.length} Employees
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
