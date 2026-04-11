import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [rates, setRates] = useState([]);
  const [tab, setTab] = useState('vendors');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const load = () => {
    api.get('/procurement/vendors').then(r => setVendors(r.data));
    api.get('/procurement/vendor-rates').then(r => setRates(r.data));
  };
  useEffect(() => { load(); }, []);

  const saveVendor = async (e) => {
    e.preventDefault();
    if (editing) { await api.put(`/procurement/vendors/${editing.id}`, form); }
    else { await api.post('/procurement/vendors', form); }
    toast.success(editing ? 'Updated' : 'Created');
    setModal(false); load();
  };

  const saveRate = async (e) => {
    e.preventDefault();
    await api.post('/procurement/vendor-rates', form);
    toast.success('Rate comparison saved');
    setModal(false); load();
  };

  const approveRate = async (id, status) => {
    await api.put(`/procurement/vendor-rates/${id}/approve`, { approval_status: status });
    toast.success(`Rate ${status}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('vendors')} className={`btn ${tab === 'vendors' ? 'btn-primary' : 'btn-secondary'}`}>Vendors</button>
        <button onClick={() => setTab('rates')} className={`btn ${tab === 'rates' ? 'btn-primary' : 'btn-secondary'}`}>Rate Comparison</button>
      </div>

      {tab === 'vendors' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Vendor List</h3>
            <button onClick={() => { setEditing(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '' }); setModal('vendor'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Vendor</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>GST</th><th>Actions</th></tr></thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id}>
                  <td className="font-medium">{v.name}</td><td>{v.contact_person}</td><td>{v.phone}</td><td>{v.email}</td><td>{v.gst_number}</td>
                  <td><button onClick={() => { setEditing(v); setForm(v); setModal('vendor'); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><FiEdit2 size={15} /></button></td>
                </tr>
              ))}
              {vendors.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No vendors yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'rates' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">3 Vendor Rate Comparison</h3>
            <button onClick={() => { setForm({ item_description: '', vendor1_id: '', vendor1_rate: 0, vendor2_id: '', vendor2_rate: 0, vendor3_id: '', vendor3_rate: 0, final_rate: 0, selected_vendor_id: '' }); setModal('rate'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Comparison</button>
          </div>
          <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table>
            <thead><tr><th>Item</th><th>Vendor 1</th><th>Rate 1</th><th>Vendor 2</th><th>Rate 2</th><th>Vendor 3</th><th>Rate 3</th><th>Final Rate</th><th>Selected</th><th>Approval</th><th>Actions</th></tr></thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.id}>
                  <td className="font-medium">{r.item_description}</td>
                  <td>{r.vendor1_name}</td><td>Rs {r.vendor1_rate}</td>
                  <td>{r.vendor2_name}</td><td>Rs {r.vendor2_rate}</td>
                  <td>{r.vendor3_name}</td><td>Rs {r.vendor3_rate}</td>
                  <td className="font-semibold">Rs {r.final_rate}</td>
                  <td className="font-medium text-blue-600">{r.selected_vendor_name}</td>
                  <td><span className={`badge ${r.approval_status === 'approved' ? 'badge-green' : r.approval_status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>{r.approval_status}</span></td>
                  <td>
                    {r.approval_status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => approveRate(r.id, 'approved')} className="btn btn-success text-xs py-1 px-2">Approve</button>
                        <button onClick={() => approveRate(r.id, 'rejected')} className="btn btn-danger text-xs py-1 px-2">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rates.length === 0 && <tr><td colSpan="11" className="text-center py-8 text-gray-400">No rate comparisons yet</td></tr>}
            </tbody>
          </table></div></div>
        </>
      )}

      <Modal isOpen={modal === 'vendor'} onClose={() => setModal(false)} title={editing ? 'Edit Vendor' : 'Add Vendor'}>
        <form onSubmit={saveVendor} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="label">Contact Person</label><input className="input" value={form.contact_person || ''} onChange={e => setForm({...form, contact_person: e.target.value})} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div><label className="label">GST Number</label><input className="input" value={form.gst_number || ''} onChange={e => setForm({...form, gst_number: e.target.value})} /></div>
          </div>
          <div><label className="label">Address</label><textarea className="input" rows="2" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'rate'} onClose={() => setModal(false)} title="3 Vendor Rate Comparison" wide>
        <form onSubmit={saveRate} className="space-y-4">
          <div><label className="label">Item Description *</label><input className="input" value={form.item_description || ''} onChange={e => setForm({...form, item_description: e.target.value})} required /></div>
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(n => (
              <div key={n} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-sm">Vendor {n}</h4>
                <select className="select" value={form[`vendor${n}_id`] || ''} onChange={e => setForm({...form, [`vendor${n}_id`]: e.target.value})}>
                  <option value="">Select</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input className="input" type="number" placeholder="Rate" value={form[`vendor${n}_rate`] || 0} onChange={e => setForm({...form, [`vendor${n}_rate`]: +e.target.value})} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Final Rate</label><input className="input" type="number" value={form.final_rate || 0} onChange={e => setForm({...form, final_rate: +e.target.value})} /></div>
            <div><label className="label">Selected Vendor</label><select className="select" value={form.selected_vendor_id || ''} onChange={e => setForm({...form, selected_vendor_id: e.target.value})}><option value="">Select</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
