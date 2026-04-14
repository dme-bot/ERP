import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  FiPlus, FiSearch, FiFilter, FiDownload, FiEdit2, FiTrash2, FiEye,
  FiX, FiBook, FiDollarSign, FiTrendingUp, FiClock, FiChevronDown, FiChevronUp
} from 'react-icons/fi';

const STATUSES = ['booked', 'advance_received', 'planning', 'execution', 'completed'];
const CATEGORIES = ['Low Voltage', 'Fire Fighting', 'Fire Alarm', 'CCTV', 'Access Control', 'PA System', 'Networking', 'Solar', 'Other'];
const ORDER_TYPES = ['Supply', 'SITC', 'AMC', 'Service'];
const LEAD_TYPES = ['Private', 'Government'];
const SOURCES = ['Inbound Enquiry', 'Indiamart Enquiry', 'WhatsApp', 'LinkedIn', 'Reference', 'Tender', 'Other'];

const emptyForm = {
  po_id: '', lead_type: 'Private', client_name: '', company_name: '', project_name: '',
  client_contact: '', source_of_enquiry: '', district: '', state: '',
  billing_address: '', shipping_address: '', guarantee_required: false,
  sale_amount_without_gst: 0, po_amount: 0, order_type: 'Supply', penalty_clause: '',
  committed_start_date: '', committed_delivery_date: '', committed_completion_date: '',
  category: '', customer_type: '', management_person_name: '', management_person_contact: '',
  employee_assigned: '', employee_id: '', tpa_items_count: 0, tpa_material_amount: 0,
  tpa_labour_amount: 0, advance_received: 0, remarks: '', status: 'booked'
};

export default function BusinessBook() {
  const { canCreate, canEdit, canDelete } = useAuth();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [pos, setPos] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'view'
  const [form, setForm] = useState({ ...emptyForm });
  const [viewEntry, setViewEntry] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', category: '', order_type: '', lead_type: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  const loadEntries = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filters.status) params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);
    if (filters.order_type) params.set('order_type', filters.order_type);
    if (filters.lead_type) params.set('lead_type', filters.lead_type);
    api.get(`/business-book?${params}`).then(r => setEntries(r.data)).catch(() => {});
  }, [search, filters]);

  const loadStats = () => {
    api.get('/business-book/stats/summary').then(r => setStats(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadEntries();
    loadStats();
    api.get('/orders/po').then(r => setPos(r.data)).catch(() => {});
  }, [loadEntries]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'edit' && form.id) {
        await api.put(`/business-book/${form.id}`, form);
        toast.success('Entry updated');
      } else {
        const res = await api.post('/business-book', form);
        toast.success(`Created ${res.data.lead_no} with auto-links`);
      }
      setModal(null);
      setForm({ ...emptyForm });
      loadEntries();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id, leadNo) => {
    if (!confirm(`Delete entry ${leadNo}? This cannot be undone.`)) return;
    try {
      await api.delete(`/business-book/${id}`);
      toast.success('Entry deleted');
      loadEntries();
      loadStats();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleView = (entry) => {
    setViewEntry(entry);
    setModal('view');
  };

  const handleEdit = (entry) => {
    setForm({
      ...entry,
      guarantee_required: !!entry.guarantee_required,
      po_id: entry.po_id || '',
      employee_id: entry.employee_id || '',
    });
    setModal('edit');
  };

  const exportCSV = () => {
    if (entries.length === 0) return toast.error('No data to export');
    const headers = ['Lead No', 'Lead Type', 'Client', 'Company', 'Project', 'Category', 'Order Type',
      'PO Amount', 'Sale Amount', 'Advance', 'Balance', 'Start Date', 'Delivery Date', 'Status',
      'District', 'State', 'Customer Type', 'Employee', 'Remarks'];
    const rows = entries.map(e => [
      e.lead_no, e.lead_type, e.client_name, e.company_name, e.project_name, e.category, e.order_type,
      e.po_amount, e.sale_amount_without_gst, e.advance_received, e.balance_amount,
      e.committed_start_date, e.committed_delivery_date, e.status,
      e.district, e.state, e.customer_type, e.employee_assigned, e.remarks
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `business-book-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const clearFilters = () => {
    setFilters({ status: '', category: '', order_type: '', lead_type: '' });
    setSearch('');
  };

  const activeFilters = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const fmt = (n) => `Rs ${(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiBook className="text-blue-600" /> Business Book
          </h1>
          <p className="text-sm text-gray-500 mt-1">Master Business Sheet - All projects & orders at a glance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn btn-secondary flex items-center gap-2 text-sm">
            <FiDownload size={16} /> Export CSV
          </button>
          {canCreate('business_book') && (
            <button onClick={() => { setForm({ ...emptyForm }); setModal('add'); }} className="btn btn-primary flex items-center gap-2">
              <FiPlus size={16} /> New Entry
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><FiBook className="text-blue-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Entries</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg"><FiDollarSign className="text-emerald-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total PO Value</p>
                <p className="text-xl font-bold text-gray-900">{fmt(stats.total_po)}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg"><FiTrendingUp className="text-amber-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Advance Received</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(stats.total_advance)}</p>
              </div>
            </div>
          </div>
          <div className="card p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><FiClock className="text-red-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Balance Pending</p>
                <p className="text-xl font-bold text-red-600">{fmt(stats.total_balance)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {stats && stats.byStatus.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {stats.byStatus.map(s => (
            <button key={s.status} onClick={() => setFilters(f => ({ ...f, status: f.status === s.status ? '' : s.status }))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filters.status === s.status ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {s.status.replace(/_/g, ' ')} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input className="input pl-10" placeholder="Search by client, company, project, lead no, location..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}>
            <FiFilter size={16} /> Filters {activeFilters > 0 && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="btn btn-secondary flex items-center gap-1 text-red-500">
              <FiX size={14} /> Clear
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
                <option value="">All</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Order Type</label>
              <select className="select" value={filters.order_type} onChange={e => setFilters(f => ({ ...f, order_type: e.target.value }))}>
                <option value="">All</option>
                {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Lead Type</label>
              <select className="select" value={filters.lead_type} onChange={e => setFilters(f => ({ ...f, lead_type: e.target.value }))}>
                <option value="">All</option>
                {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>Showing {entries.length} entries</span>
        {entries.length > 0 && (
          <span className="font-medium">
            Total: {fmt(entries.reduce((s, e) => s + (e.po_amount || 0), 0))} |
            Balance: {fmt(entries.reduce((s, e) => s + (e.balance_amount || 0), 0))}
          </span>
        )}
      </div>

      {/* Data Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Lead No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Client</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Project</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Category</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Order</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">PO Amount</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Advance</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Balance</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Dates</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(b => (
                <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-3 py-3">
                    <span className="font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => handleView(b)}>{b.lead_no}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      b.lead_type === 'Government' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>{b.lead_type}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900 text-sm">{b.client_name}</div>
                    {b.company_name && <div className="text-xs text-gray-500">{b.company_name}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-gray-800">{b.project_name || '-'}</div>
                    {b.district && <div className="text-xs text-gray-400">{b.district}, {b.state}</div>}
                  </td>
                  <td className="px-3 py-3 text-sm">{b.category || '-'}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{b.order_type}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-sm">{fmt(b.po_amount)}</td>
                  <td className="px-3 py-3 text-right text-sm text-emerald-600 font-medium">{fmt(b.advance_received)}</td>
                  <td className="px-3 py-3 text-right text-sm text-red-600 font-bold">{fmt(b.balance_amount)}</td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-gray-600">{b.committed_start_date || '-'}</div>
                    <div className="text-xs text-gray-400">to {b.committed_delivery_date || '-'}</div>
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleView(b)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View">
                        <FiEye size={15} />
                      </button>
                      {canEdit('business_book') && (
                        <button onClick={() => handleEdit(b)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit">
                          <FiEdit2 size={15} />
                        </button>
                      )}
                      {canDelete('business_book') && (
                        <button onClick={() => handleDelete(b.id, b.lead_no)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan="12" className="text-center py-12 text-gray-400">
                  <FiBook size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No entries found</p>
                  <p className="text-sm mt-1">{activeFilters > 0 ? 'Try adjusting your filters' : 'Add your first business entry'}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Detail Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => { setModal(null); setViewEntry(null); }} title={`Business Entry - ${viewEntry?.lead_no || ''}`} wide>
        {viewEntry && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
              <div>
                <h3 className="text-lg font-bold text-blue-800">{viewEntry.lead_no}</h3>
                <p className="text-sm text-blue-600">{viewEntry.project_name || viewEntry.client_name}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={viewEntry.status} />
                <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  viewEntry.lead_type === 'Government' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>{viewEntry.lead_type}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500">Sale Amount</p>
                <p className="font-bold text-gray-800">{fmt(viewEntry.sale_amount_without_gst)}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500">PO Amount</p>
                <p className="font-bold text-blue-700">{fmt(viewEntry.po_amount)}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500">Advance</p>
                <p className="font-bold text-emerald-600">{fmt(viewEntry.advance_received)}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500">Balance</p>
                <p className="font-bold text-red-600">{fmt(viewEntry.balance_amount)}</p>
              </div>
            </div>

            {/* Sections */}
            <DetailSection title="Client & Company" items={[
              ['Client Name', viewEntry.client_name],
              ['Company/Dept', viewEntry.company_name],
              ['Contact', viewEntry.client_contact],
              ['Source', viewEntry.source_of_enquiry],
              ['Customer Type', viewEntry.customer_type],
            ]} />
            <DetailSection title="Location" items={[
              ['District', viewEntry.district],
              ['State', viewEntry.state],
              ['Billing Address', viewEntry.billing_address],
              ['Shipping Address', viewEntry.shipping_address],
            ]} />
            <DetailSection title="Project & Order" items={[
              ['Project Name', viewEntry.project_name],
              ['Category', viewEntry.category],
              ['Order Type', viewEntry.order_type],
              ['PO Number', viewEntry.po_number],
              ['Guarantee Required', viewEntry.guarantee_required ? 'Yes' : 'No'],
              ['Penalty Clause', viewEntry.penalty_clause],
            ]} />
            <DetailSection title="TPA Details" items={[
              ['TPA Items Count', viewEntry.tpa_items_count],
              ['TPA Material Amount', fmt(viewEntry.tpa_material_amount)],
              ['TPA Labour Amount', fmt(viewEntry.tpa_labour_amount)],
            ]} />
            <DetailSection title="Committed Dates" items={[
              ['Start Date', viewEntry.committed_start_date || '-'],
              ['Delivery Date', viewEntry.committed_delivery_date || '-'],
              ['Completion Date', viewEntry.committed_completion_date || '-'],
            ]} />
            <DetailSection title="People" items={[
              ['Management Person', viewEntry.management_person_name],
              ['Mgmt Contact', viewEntry.management_person_contact],
              ['Employee Assigned', viewEntry.employee_assigned || viewEntry.employee_name],
            ]} />
            {viewEntry.remarks && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-yellow-700 mb-1">Remarks</p>
                <p className="text-sm text-yellow-800">{viewEntry.remarks}</p>
              </div>
            )}
            <div className="text-xs text-gray-400 text-right">Created: {viewEntry.created_at}</div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setForm({ ...emptyForm }); }}
        title={modal === 'edit' ? `Edit - ${form.lead_no || ''}` : 'New Business Book Entry'} wide>
        <form onSubmit={handleSave} className="space-y-4">
          {modal === 'add' && (
            <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded font-medium">
              Lead No. auto-generated (SEPL format). Auto-creates: Order Planning + DPR Site + Receivable + Cash Flow.
            </p>
          )}

          {/* Client Details */}
          <FormSection title="Client & Company Details" color="gray">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Lead Type</label>
                <select className="select" value={form.lead_type} onChange={e => setForm({ ...form, lead_type: e.target.value })}>
                  {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="label">Client Name *</label>
                <input className="input" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} required />
              </div>
              <div><label className="label">Company/Department</label>
                <input className="input" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div><label className="label">Client Contact No.</label>
                <input className="input" value={form.client_contact} onChange={e => setForm({ ...form, client_contact: e.target.value })} />
              </div>
              <div><label className="label">Source of Enquiry</label>
                <select className="select" value={form.source_of_enquiry} onChange={e => setForm({ ...form, source_of_enquiry: e.target.value })}>
                  <option value="">Select</option>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Customer Type</label>
                <input className="input" value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })} placeholder="Hospital, Factory, etc." />
              </div>
            </div>
          </FormSection>

          {/* Location */}
          <FormSection title="Location & Address" color="gray">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">District</label>
                <input className="input" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
              </div>
              <div><label className="label">State</label>
                <input className="input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
              </div>
              <div><label className="label">Billing Address</label>
                <input className="input" value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })} />
              </div>
              <div className="col-span-2"><label className="label">Shipping / Site Address</label>
                <input className="input" value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} />
              </div>
            </div>
          </FormSection>

          {/* Project & Order */}
          <FormSection title="Project & Order Details" color="blue">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Project Name</label>
                <input className="input" value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} />
              </div>
              <div><label className="label">Purchase Order</label>
                <select className="select" value={form.po_id} onChange={e => setForm({ ...form, po_id: e.target.value })}>
                  <option value="">Select (optional)</option>
                  {pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
                </select>
              </div>
              <div><label className="label">Order Type</label>
                <select className="select" value={form.order_type} onChange={e => setForm({ ...form, order_type: e.target.value })}>
                  {ORDER_TYPES.map(t => <option key={t} value={t}>{t === 'SITC' ? 'SITC (Supply, Install, Test, Commission)' : t}</option>)}
                </select>
              </div>
              <div><label className="label">Category</label>
                <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Guarantee Required</label>
                <select className="select" value={form.guarantee_required ? 'Yes' : 'No'} onChange={e => setForm({ ...form, guarantee_required: e.target.value === 'Yes' })}>
                  <option value="No">No</option><option value="Yes">Yes</option>
                </select>
              </div>
              <div><label className="label">Penalty Clause</label>
                <input className="input" value={form.penalty_clause} onChange={e => setForm({ ...form, penalty_clause: e.target.value })} />
              </div>
            </div>
          </FormSection>

          {/* Financial */}
          <FormSection title="Financial Details" color="emerald">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Sale Amount (Without GST)</label>
                <input className="input" type="number" value={form.sale_amount_without_gst} onChange={e => setForm({ ...form, sale_amount_without_gst: +e.target.value })} />
              </div>
              <div><label className="label">PO Amount (With GST)</label>
                <input className="input" type="number" value={form.po_amount} onChange={e => setForm({ ...form, po_amount: +e.target.value })} />
              </div>
              <div><label className="label">Advance Received</label>
                <input className="input" type="number" value={form.advance_received} onChange={e => setForm({ ...form, advance_received: +e.target.value })} />
              </div>
              <div><label className="label">TPA Items Count</label>
                <input className="input" type="number" value={form.tpa_items_count} onChange={e => setForm({ ...form, tpa_items_count: +e.target.value })} />
              </div>
              <div><label className="label">TPA Material Amount</label>
                <input className="input" type="number" value={form.tpa_material_amount} onChange={e => setForm({ ...form, tpa_material_amount: +e.target.value })} />
              </div>
              <div><label className="label">TPA Labour Amount</label>
                <input className="input" type="number" value={form.tpa_labour_amount} onChange={e => setForm({ ...form, tpa_labour_amount: +e.target.value })} />
              </div>
            </div>
          </FormSection>

          {/* Dates */}
          <FormSection title="Committed Dates" color="amber">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Committed Start Date</label>
                <input className="input" type="date" value={form.committed_start_date} onChange={e => setForm({ ...form, committed_start_date: e.target.value })} />
              </div>
              <div><label className="label">Committed Delivery Date</label>
                <input className="input" type="date" value={form.committed_delivery_date} onChange={e => setForm({ ...form, committed_delivery_date: e.target.value })} />
              </div>
              <div><label className="label">Committed Completion Date</label>
                <input className="input" type="date" value={form.committed_completion_date} onChange={e => setForm({ ...form, committed_completion_date: e.target.value })} />
              </div>
            </div>
          </FormSection>

          {/* People */}
          <FormSection title="People & Management" color="purple">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Management Person Name</label>
                <input className="input" value={form.management_person_name} onChange={e => setForm({ ...form, management_person_name: e.target.value })} />
              </div>
              <div><label className="label">Management Person Contact</label>
                <input className="input" value={form.management_person_contact} onChange={e => setForm({ ...form, management_person_contact: e.target.value })} />
              </div>
              <div><label className="label">Employee Assigned</label>
                <input className="input" value={form.employee_assigned} onChange={e => setForm({ ...form, employee_assigned: e.target.value })} />
              </div>
            </div>
          </FormSection>

          {/* Status (only for edit) */}
          {modal === 'edit' && (
            <div><label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}

          <div><label className="label">Remarks</label>
            <textarea className="input" rows="2" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => { setModal(null); setForm({ ...emptyForm }); }} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">
              {modal === 'edit' ? 'Update Entry' : 'Create Business Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FormSection({ title, color, children }) {
  const bgMap = { gray: 'bg-gray-50', blue: 'bg-blue-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50', purple: 'bg-purple-50' };
  const textMap = { gray: 'text-gray-700', blue: 'text-blue-700', emerald: 'text-emerald-700', amber: 'text-amber-700', purple: 'text-purple-700' };
  return (
    <div className={`border rounded-lg p-3 ${bgMap[color] || 'bg-gray-50'}`}>
      <h4 className={`font-semibold text-sm ${textMap[color] || 'text-gray-700'} mb-3`}>{title}</h4>
      {children}
    </div>
  );
}

function DetailSection({ title, items }) {
  const filtered = items.filter(([, val]) => val && val !== '-' && val !== 0);
  if (filtered.length === 0) return null;
  return (
    <div className="border rounded-lg p-3">
      <h4 className="font-semibold text-sm text-gray-700 mb-2">{title}</h4>
      <div className="grid grid-cols-3 gap-2">
        {filtered.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-medium text-gray-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
