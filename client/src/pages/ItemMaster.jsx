import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiDownload, FiUpload, FiPackage, FiFilter, FiX } from 'react-icons/fi';

const DEPARTMENTS = ['FF', 'LV', 'ELE', 'CCTV', 'AC', 'NET', 'SOL', 'OTHER'];
const DEPT_LABELS = { FF: 'Fire Fighting', LV: 'Low Voltage', ELE: 'Electrical', CCTV: 'CCTV', AC: 'Access Control', NET: 'Networking', SOL: 'Solar', OTHER: 'Other' };
const TYPES = ['PO', 'FOC', 'RGP'];
const UOMS = ['PCS', 'MTR', 'KG', 'SQMM', 'PACKET', 'SET', 'LOT', 'PAIR', 'RFT', 'LTR', 'BOX'];

const emptyForm = { item_code: '', department: 'FF', item_name: '', specification: '', size: '', uom: 'PCS', gst: '18%', type: 'PO', make: '', model_number: '', current_price: 0 };

export default function ItemMaster() {
  const { canCreate, canEdit, canDelete } = useAuth();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [bulkData, setBulkData] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterDept) params.set('department', filterDept);
    api.get(`/item-master?${params}`).then(r => setItems(r.data)).catch(() => {});
  }, [search, filterDept]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'edit' && form.id) {
        await api.put(`/item-master/${form.id}`, form);
        toast.success('Item updated');
      } else {
        const res = await api.post('/item-master', form);
        toast.success(`Item created: ${res.data.item_code}`);
      }
      setModal(null); setForm({ ...emptyForm }); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Delete item ${code}?`)) return;
    try { await api.delete(`/item-master/${id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const exportCSV = () => {
    if (items.length === 0) return toast.error('No data');
    const headers = ['Item Code', 'Department', 'Item Name', 'Specification', 'Size', 'UOM', 'GST', 'Type', 'Make', 'Model', 'Price'];
    const rows = items.map(i => [i.item_code, i.department, i.item_name, i.specification, i.size, i.uom, i.gst, i.type, i.make, i.model_number, i.current_price]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `item-master-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    toast.success('Exported');
  };

  const downloadTemplate = () => {
    const csv = 'Item Code,Department,Item Name,Specification,Size,UOM,GST,Type,Make,Price\nFF0100,FF,HYDRANT VALVE,SS BODY,63MM,PCS,18%,PO,AGNI,2500';
    const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'item-master-template.csv'; a.click();
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
      const c = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
      return c[2] ? { item_code: c[0], department: c[1], item_name: c[2], specification: c[3], size: c[4], uom: c[5] || 'PCS', gst: c[6] || '18%', type: c[7] || 'PO', make: c[8], current_price: parseFloat(c[9]) || 0 } : null;
    }).filter(Boolean);
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setBulkData(ev.target.result); setBulkPreview(parseCSV(ev.target.result)); };
    reader.readAsText(file); e.target.value = '';
  };

  const bulkImport = async () => {
    if (bulkPreview.length === 0) return toast.error('No valid data');
    try {
      const res = await api.post('/item-master/bulk', { items: bulkPreview });
      toast.success(`Added ${res.data.added} of ${res.data.total} items`);
      setBulkModal(false); setBulkData(''); setBulkPreview([]); load();
    } catch { toast.error('Import failed'); }
  };

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FiPackage className="text-indigo-600" /> Item Master</h1>
          <p className="text-sm text-gray-500">{items.length} items | From Drive Item-wise Sheet</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="btn btn-secondary flex items-center gap-2 text-sm"><FiDownload size={15} /> Export</button>
          {canCreate('item_master') && <>
            <button onClick={() => { setBulkData(''); setBulkPreview([]); setBulkModal(true); }} className="btn btn-secondary flex items-center gap-2 text-sm"><FiUpload size={15} /> Bulk Import</button>
            <button onClick={() => { setForm({ ...emptyForm }); setModal('add'); }} className="btn btn-primary flex items-center gap-2"><FiPlus size={15} /> Add Item</button>
          </>}
        </div>
      </div>

      {/* Step 1: Pick Department. Step 2: Search by name within it. */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_auto] gap-3 items-end">
        <div>
          <label className="label flex items-center gap-1"><FiFilter size={12} /> Step 1 — Department</label>
          <select className="select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d} — {DEPT_LABELS[d] || d}</option>)}
          </select>
        </div>
        <div>
          <label className="label flex items-center gap-1"><FiSearch size={12} /> Step 2 — Search by Item Name</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="input pl-10"
              placeholder={filterDept ? `Type item name in ${DEPT_LABELS[filterDept] || filterDept}…` : 'Type item name, spec, size, code, or make…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        {(search || filterDept) && (
          <button onClick={() => { setSearch(''); setFilterDept(''); }} className="btn btn-secondary text-red-500 flex items-center gap-1 whitespace-nowrap">
            <FiX size={14} /> Clear
          </button>
        )}
      </div>

      {/* Active-filter chip line */}
      {(filterDept || search) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>Showing:</span>
          {filterDept && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{DEPT_LABELS[filterDept] || filterDept}</span>}
          {search && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">"{search}"</span>}
          <span className="text-gray-400">· {items.length} match{items.length === 1 ? '' : 'es'}</span>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto"><table className="min-w-full">
          <thead><tr className="bg-gray-50">
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Code</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Dept</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Item Name / Specification / Size</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">UOM</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">GST</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Make</th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Price</th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(i => (
              <tr key={i.id} className="hover:bg-indigo-50/30">
                <td className="px-3 py-2 font-mono text-xs font-bold text-indigo-600">{i.item_code}</td>
                <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${i.department === 'FF' ? 'bg-red-100 text-red-700' : i.department === 'LV' ? 'bg-blue-100 text-blue-700' : i.department === 'ELE' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{i.department}</span></td>
                <td className="px-3 py-2">
                  <div className="font-medium text-sm">{i.item_name}</div>
                  <div className="text-xs text-gray-500">{[i.specification, i.size].filter(Boolean).join(' | ')}</div>
                </td>
                <td className="px-3 py-2 text-sm">{i.uom}</td>
                <td className="px-3 py-2 text-sm">{i.gst}</td>
                <td className="px-3 py-2"><span className={`text-xs font-medium ${i.type === 'PO' ? 'text-emerald-600' : i.type === 'FOC' ? 'text-amber-600' : 'text-gray-500'}`}>{i.type}</span></td>
                <td className="px-3 py-2 text-sm">{i.make}</td>
                <td className="px-3 py-2 text-right font-semibold text-sm">Rs {(i.current_price || 0).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {canEdit('item_master') && <button onClick={() => { setForm({ ...i }); setModal('edit'); }} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"><FiEdit2 size={14} /></button>}
                    {canDelete('item_master') && <button onClick={() => handleDelete(i.id, i.item_code)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><FiTrash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="9" className="text-center py-12 text-gray-400"><FiPackage size={40} className="mx-auto mb-3 opacity-30" /><p>No items found</p></td></tr>}
          </tbody>
        </table></div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'edit' ? `Edit - ${form.item_code}` : 'Add Item'} wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Item Code</label><input className="input font-mono" value={form.item_code || ''} onChange={e => F('item_code', e.target.value)} placeholder="Auto-generated if empty" /></div>
            <div><label className="label">Department *</label><select className="select" value={form.department} onChange={e => F('department', e.target.value)}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d} - {DEPT_LABELS[d] || d}</option>)}</select></div>
            <div><label className="label">Type</label><select className="select" value={form.type} onChange={e => F('type', e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Item Name *</label><input className="input" value={form.item_name || ''} onChange={e => F('item_name', e.target.value)} required /></div>
            <div><label className="label">Specification</label><input className="input" value={form.specification || ''} onChange={e => F('specification', e.target.value)} /></div>
            <div><label className="label">Size</label><input className="input" value={form.size || ''} onChange={e => F('size', e.target.value)} /></div>
          </div>
          <div className="bg-gray-50 p-2 rounded text-sm"><strong>Display in PO:</strong> {[form.item_name, form.specification, form.size].filter(Boolean).join(' / ') || '(enter item details)'}</div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">UOM</label><select className="select" value={form.uom} onChange={e => F('uom', e.target.value)}>{UOMS.map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label className="label">GST</label><input className="input" value={form.gst || ''} onChange={e => F('gst', e.target.value)} /></div>
            <div><label className="label">Make</label><input className="input" value={form.make || ''} onChange={e => F('make', e.target.value)} /></div>
            <div><label className="label">Current Price (Rs)</label><input className="input" type="number" value={form.current_price || 0} onChange={e => F('current_price', +e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{modal === 'edit' ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal isOpen={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Import Items" wide>
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <p className="font-semibold mb-1">CSV Format:</p>
            <p className="font-mono text-xs">Item Code, Department, Item Name, Specification, Size, UOM, GST, Type, Make, Price</p>
          </div>
          <button onClick={downloadTemplate} className="btn btn-secondary text-sm flex items-center gap-2"><FiDownload size={14} /> Download Template</button>
          <div><label className="label">Upload CSV</label><input type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" /></div>
          <div><label className="label">Or Paste CSV</label><textarea className="input font-mono text-xs" rows="5" value={bulkData} onChange={e => { setBulkData(e.target.value); setBulkPreview(parseCSV(e.target.value)); }} placeholder="Item Code,Dept,Name,Spec,Size,UOM,GST,Type,Make,Price" /></div>
          {bulkPreview.length > 0 && (
            <div><p className="text-sm font-semibold mb-2">{bulkPreview.length} items to import</p>
              <div className="max-h-48 overflow-y-auto border rounded text-xs"><table><thead><tr className="bg-gray-50"><th className="px-2 py-1">Code</th><th className="px-2 py-1">Dept</th><th className="px-2 py-1">Name</th><th className="px-2 py-1">Spec</th><th className="px-2 py-1">Size</th><th className="px-2 py-1">Price</th></tr></thead>
                <tbody>{bulkPreview.map((i, idx) => <tr key={idx}><td className="px-2 py-1">{i.item_code}</td><td className="px-2 py-1">{i.department}</td><td className="px-2 py-1 font-medium">{i.item_name}</td><td className="px-2 py-1">{i.specification}</td><td className="px-2 py-1">{i.size}</td><td className="px-2 py-1">{i.current_price}</td></tr>)}</tbody></table></div>
            </div>
          )}
          <div className="flex justify-end gap-3"><button onClick={() => setBulkModal(false)} className="btn btn-secondary">Cancel</button><button onClick={bulkImport} disabled={bulkPreview.length === 0} className="btn btn-primary disabled:opacity-50"><FiUpload size={14} /> Import {bulkPreview.length} Items</button></div>
        </div>
      </Modal>
    </div>
  );
}
