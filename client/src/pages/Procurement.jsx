import { useState, useEffect } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiCheck, FiX, FiTrash2, FiExternalLink } from 'react-icons/fi';

const EMPTY_ITEM = { po_item_id: '', item_master_id: '', description: '', make: '', quantity: 1, unit: 'nos', item_type: '', boq_qty: 0, remaining_qty: null, manual: false };

export default function Procurement() {
  const { canDelete, user } = useAuth();
  const [tab, setTab] = useState('indents');
  const [indents, setIndents] = useState([]);
  const [vendorPos, setVendorPos] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [masterItems, setMasterItems] = useState([]); // Item Master dropdown source
  const [boqItems, setBoqItems] = useState([]); // BOQ items for the currently-selected site
  const [boqLoading, setBoqLoading] = useState(false);
  const [boqDiag, setBoqDiag] = useState(null); // backend diagnostic when BOQ is empty/partial
  const [uploadingBoq, setUploadingBoq] = useState(false);
  const [manualMode, setManualMode] = useState(false); // when true, items are typed free-text (no BOQ lookup)
  const [sites, setSites] = useState([]);         // unique site names (Business Book)
  const [employees, setEmployees] = useState([]); // for "Raised By" dropdown
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [indentItems, setIndentItems] = useState([{ ...EMPTY_ITEM }]);

  const load = () => {
    api.get('/procurement/indents').then(r => setIndents(r.data));
    api.get('/procurement/vendor-po').then(r => setVendorPos(r.data));
    api.get('/procurement/purchase-bills').then(r => setPurchaseBills(r.data));
    api.get('/procurement/delivery-notes').then(r => setDeliveryNotes(r.data));
    api.get('/procurement/vendors').then(r => setVendors(r.data));
    api.get('/item-master/dropdown').then(r => setMasterItems(r.data || [])).catch(() => setMasterItems([]));
    api.get('/procurement/sites').then(r => {
      // Response is one row per business_book: [{ bb_id, name, lead_no }]
      setSites(r.data || []);
    }).catch(() => setSites([]));
    api.get('/hr/employees').then(r => setEmployees((r.data || []).filter(e => !e.status || e.status === 'active'))).catch(() => setEmployees([]));
  };
  useEffect(() => { load(); }, []);

  // When the site changes, pull BOQ items for that site and reset any picked items.
  // Response shape: { items: [...], diagnostic?: {reason, message} }. We surface
  // the diagnostic message in the UI so the raiser sees exactly what to fix.
  const reloadBoq = async (bbId) => {
    if (!bbId) { setBoqItems([]); setBoqDiag(null); return; }
    setBoqLoading(true);
    try {
      const r = await api.get('/procurement/boq-items-by-bb', { params: { bb_id: bbId } });
      const payload = r.data;
      const list = Array.isArray(payload) ? payload : (payload?.items || []);
      const diag = Array.isArray(payload) ? null : (payload?.diagnostic || null);
      setBoqItems(list);
      setBoqDiag(diag);
    } catch { setBoqItems([]); setBoqDiag(null); }
    setBoqLoading(false);
  };
  const handleSiteChange = (site) => {
    // `site` is the full object from SearchableSelect ({ bb_id, name, lead_no }).
    setForm(f => ({ ...f, bb_id: site?.bb_id || null, site_name: site?.name || '', lead_no: site?.lead_no || '' }));
    setIndentItems([{ ...EMPTY_ITEM }]);
    setBoqDiag(null);
    setManualMode(false);
    reloadBoq(site?.bb_id || null);
  };

  // Fetch items from the BOQ already attached to this site's PO. No
  // re-upload — server parses boq_file_link on disk or falls back to
  // boq_items via the linked quotation, then saves into po_items so
  // Remaining tracking works across indents.
  const fetchExistingBoq = async () => {
    if (!form.site_name) return toast.error('Pick a site first');
    setUploadingBoq(true);
    try {
      const r = await api.post('/procurement/fetch-existing-boq', { site_name: form.site_name });
      toast.success(`Fetched ${r.data.items_saved} items from ${r.data.source === 'po_file' ? `PO ${r.data.po_number} BOQ file` : 'BOQ module'}`);
      reloadBoq(form.site_name);
    } catch (err) { toast.error(err.response?.data?.error || 'Fetch failed'); }
    setUploadingBoq(false);
  };

  // Fallback — if truly nothing on file, admin can still upload.
  const uploadBoqForSite = async (file) => {
    if (!form.site_name) return toast.error('Pick a site first');
    setUploadingBoq(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('site_name', form.site_name);
      const r = await api.post('/procurement/upload-boq-for-site', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`BOQ saved — ${r.data.items_saved} items`);
      reloadBoq(form.site_name);
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    setUploadingBoq(false);
  };

  // Picking an actual SKU from Item Master for this row. One BOQ line often
  // maps to one PO item plus a few FOC accessories — each gets its own row
  // that references the same BOQ item but a different Item Master entry.
  const pickMasterItem = (i, master) => {
    const n = [...indentItems];
    n[i] = {
      ...n[i],
      item_master_id: master?.id || '',
      description: master ? [master.item_name, master.specification, master.size].filter(Boolean).join(' / ') : n[i].description,
      unit: master?.uom?.toLowerCase() || n[i].unit || 'nos',
      item_type: master?.type || n[i].item_type || '',
      make: master?.make || n[i].make || '',
    };
    setIndentItems(n);
  };

  // Picking a BOQ item for this row — fills description / unit / type / make
  // and copies BOQ qty + remaining so the UI can show "BOQ 100 · Rem 60"
  // like DPR does. FOC items have remaining = null (hidden in UI).
  const pickBoqItem = (i, item) => {
    const n = [...indentItems];
    n[i] = {
      ...n[i],
      po_item_id: item?.id || '',
      item_master_id: item?.item_master_id || '',
      description: item?.description || '',
      unit: (item?.unit || n[i].unit || 'nos').toString().toLowerCase(),
      item_type: item?.item_type || '',
      make: item?.item_make || n[i].make || '',
      boq_qty: item?.boq_qty || 0,
      remaining_qty: item?.remaining_qty,
      is_foc: !!item?.is_foc,
    };
    setIndentItems(n);
  };

  const saveIndent = async (e) => {
    e.preventDefault();
    if (!form.site_name) return toast.error('Site Name is required');
    if (!form.raised_by_name) return toast.error('Raised By is required');
    const clean = indentItems.filter(it => it.po_item_id || it.item_master_id || (it.description && it.description.trim()));
    if (clean.length === 0) return toast.error('Add at least one item (pick from BOQ or type manually)');
    try {
      await api.post('/procurement/indents', {
        business_book_id: form.bb_id || null,
        site_name: form.site_name,
        raised_by_name: form.raised_by_name,
        notes: form.notes || '',
        items: clean.map(it => ({ ...it, make: it.make || '' })),
      });
      toast.success('Indent raised — purchase team will take over');
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  // Admin only — wipes all indents, vendor POs and related rows. Used when
  // mam wants a clean slate before a demo / new operating cycle.
  const wipeData = async () => {
    if (!confirm('Delete ALL Dispatches, Vendor POs, Purchase Bills and Delivery Notes?\n\nThis cannot be undone. Type YES in the next prompt to confirm.')) return;
    const c = prompt('Type YES (in capitals) to confirm permanent deletion:');
    if (c !== 'YES') return toast.error('Cancelled — nothing deleted');
    try {
      const r = await api.post('/procurement/admin/wipe-indents-pos');
      toast.success(`Cleared: ${r.data.counts.indents} dispatches, ${r.data.counts.vendor_pos} POs, ${r.data.counts.purchase_bills} bills, ${r.data.counts.delivery_notes} delivery notes`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Wipe failed'); }
  };

  const approveIndent = async (id, status) => {
    await api.put(`/procurement/indents/${id}`, { status });
    toast.success(`Indent ${status}`);
    load();
  };

  const saveVendorPo = async (e) => {
    e.preventDefault();
    await api.post('/procurement/vendor-po', form);
    toast.success('Vendor PO created');
    setModal(false); load();
  };

  const savePurchaseBill = async (e) => {
    e.preventDefault();
    await api.post('/procurement/purchase-bills', form);
    toast.success('Purchase bill added');
    setModal(false); load();
  };

  const saveDeliveryNote = async (e) => {
    e.preventDefault();
    await api.post('/procurement/delivery-notes', form);
    toast.success('Dispatch recorded');
    setModal(false); load();
  };

  // Order matches the flow: raise an indent first, purchase team turns it
  // into a vendor PO, books the purchase bill, and finally the goods are
  // dispatched to site.
  const tabs = [
    { id: 'indents', label: 'Raise Indent' },
    { id: 'vendorpo', label: 'Vendor PO' },
    { id: 'bills', label: 'Purchase Bills' },
    { id: 'delivery', label: 'Dispatch' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">{tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}>{t.label}</button>
      ))}</div>

      {tab === 'indents' && (
        <>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-semibold">Raise Indent</h3>
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <button onClick={wipeData} className="btn btn-danger text-xs flex items-center gap-1" title="Admin: delete all indents, POs, bills, dispatches"><FiTrash2 size={13} /> Wipe All</button>
              )}
              <button onClick={() => { setForm({ notes: '', site_name: '', raised_by_name: user?.name || '' }); setIndentItems([{ ...EMPTY_ITEM }]); setBoqItems([]); setModal('indent'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Raise Indent</button>
            </div>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Indent No</th><th>Date</th><th>Site</th><th>Raised By</th><th>BOQ</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {indents.map(i => (
                <tr key={i.id}>
                  <td className="font-medium">{i.indent_number}</td>
                  <td className="text-xs text-gray-600">{i.created_at ? new Date(i.created_at).toLocaleString() : (i.indent_date || '—')}</td>
                  <td>{i.site_name || i.client_name || <span className="text-gray-400">—</span>}</td>
                  <td>{i.raised_by_name || i.created_by_name}</td>
                  <td>
                    {i.boq_file_link
                      ? <a href={i.boq_file_link} target="_blank" rel="noreferrer" className="text-red-600 hover:underline flex items-center gap-1 text-xs"><FiExternalLink size={12} /> View</a>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>
                    <div className="flex gap-1 items-center">
                      {i.status === 'submitted' && (
                        <>
                          <button onClick={() => approveIndent(i.id, 'approved')} className="btn btn-success text-xs py-1 px-2">Approve</button>
                          <button onClick={() => approveIndent(i.id, 'rejected')} className="btn btn-danger text-xs py-1 px-2">Reject</button>
                        </>
                      )}
                      {i.status === 'draft' && <button onClick={() => approveIndent(i.id, 'submitted')} className="btn btn-primary text-xs py-1 px-2">Submit</button>}
                      {canDelete('procurement') && <button onClick={async () => {
                        if (!confirm(`Delete indent "${i.indent_number}"?`)) return;
                        try { await api.delete(`/procurement/indents/${i.id}`); toast.success('Deleted'); load(); }
                        catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                      }} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><FiTrash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {indents.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">No indents yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'vendorpo' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Vendor Purchase Orders</h3>
            <button onClick={() => { setForm({ indent_id: '', vendor_id: '', total_amount: 0, advance_required: false }); setModal('vendorpo'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Vendor PO</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>PO Number</th><th>Vendor</th><th>Amount</th><th>Advance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {vendorPos.map(v => (
                <tr key={v.id}>
                  <td className="font-medium">{v.po_number}</td><td>{v.vendor_name}</td><td>Rs {v.total_amount?.toLocaleString()}</td>
                  <td>{v.advance_required ? (v.advance_paid ? 'Paid' : 'Required') : 'N/A'}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td>{canDelete('procurement') && <button onClick={async () => {
                    if (!confirm(`Delete vendor PO "${v.po_number}"?`)) return;
                    try { await api.delete(`/procurement/vendor-po/${v.id}`); toast.success('Deleted'); load(); }
                    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                  }} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><FiTrash2 size={14} /></button>}</td>
                </tr>
              ))}
              {vendorPos.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400">No vendor POs yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'bills' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Purchase Bills</h3>
            <button onClick={() => { setForm({ vendor_id: '', bill_number: '', bill_date: '', amount: 0, gst_amount: 0, total_amount: 0 }); setModal('bill'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Bill</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>Bill No</th><th>Vendor</th><th>Date</th><th>Amount</th><th>GST</th><th>Total</th><th>Payment</th><th>Actions</th></tr></thead>
            <tbody>
              {purchaseBills.map(b => (
                <tr key={b.id}>
                  <td className="font-medium">{b.bill_number}</td><td>{b.vendor_name}</td><td>{b.bill_date}</td>
                  <td>Rs {b.amount?.toLocaleString()}</td><td>Rs {b.gst_amount?.toLocaleString()}</td>
                  <td className="font-semibold">Rs {b.total_amount?.toLocaleString()}</td>
                  <td><StatusBadge status={b.payment_status} /></td>
                  <td>{canDelete('procurement') && <button onClick={async () => {
                    if (!confirm(`Delete purchase bill "${b.bill_number}"?`)) return;
                    try { await api.delete(`/procurement/purchase-bills/${b.id}`); toast.success('Deleted'); load(); }
                    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                  }} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><FiTrash2 size={14} /></button>}</td>
                </tr>
              ))}
              {purchaseBills.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-gray-400">No bills yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {tab === 'delivery' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Dispatch to Site</h3>
            <button onClick={() => { setForm({ vendor_po_id: '', delivery_date: '', notes: '' }); setModal('delivery'); }} className="btn btn-primary flex items-center gap-2"><FiPlus /> Add Dispatch</button>
          </div>
          <div className="card p-0 overflow-hidden"><table>
            <thead><tr><th>ID</th><th>Date</th><th>Received By</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {deliveryNotes.map(d => (
                <tr key={d.id}>
                  <td>#{d.id}</td><td>{d.delivery_date}</td><td>{d.received_by_name}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{canDelete('procurement') && <button onClick={async () => {
                    if (!confirm(`Delete delivery note #${d.id}?`)) return;
                    try { await api.delete(`/procurement/delivery-notes/${d.id}`); toast.success('Deleted'); load(); }
                    catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
                  }} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><FiTrash2 size={14} /></button>}</td>
                </tr>
              ))}
              {deliveryNotes.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">No delivery notes yet</td></tr>}
            </tbody>
          </table></div>
        </>
      )}

      {/* Indent Modal */}
      <Modal isOpen={modal === 'indent'} onClose={() => setModal(false)} title="Raise Purchase Indent" wide>
        <form onSubmit={saveIndent} className="space-y-4">
          {/* Auto timestamp — mirrors the 'Dated' field on the physical form */}
          <div className="text-[11px] text-gray-500 bg-gray-50 rounded px-3 py-1.5 flex justify-between items-center">
            <span>Dated: <b className="text-gray-700">{new Date().toLocaleString()}</b></span>
            <span className="text-gray-400">(auto-recorded on create)</span>
          </div>
          {/* Header — Site from Business Book, Raised By from Employees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Site Name *</label>
              <SearchableSelect
                options={sites.map(s => ({ id: s.bb_id, label: `${s.lead_no ? '[' + s.lead_no + '] ' : ''}${s.name}`, ...s }))}
                value={form.bb_id || null}
                valueKey="id" displayKey="label"
                placeholder="Search project from Business Book…"
                onChange={(s) => handleSiteChange(s)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                {form.site_name
                  ? (boqLoading ? 'Loading BOQ…' : `${boqItems.length} BOQ item${boqItems.length === 1 ? '' : 's'} available for this site`)
                  : 'Pick a site first — its BOQ items will load below.'}
              </p>
            </div>
            <div>
              <label className="label">Raised By *</label>
              <SearchableSelect
                options={employees.map(e => ({ id: e.name, label: e.name, ...e }))}
                value={form.raised_by_name || null}
                valueKey="id" displayKey="label"
                placeholder="Search employee…"
                onChange={(e) => setForm({ ...form, raised_by_name: e?.id || '' })}
              />
            </div>
          </div>

          <h4 className="font-semibold text-sm">
            Items <span className="text-gray-400 font-normal">(pick from this site's BOQ — "item wise sheet")</span>
          </h4>
          {!form.site_name ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500 bg-gray-50">
              Pick a site above to load its BOQ items.
            </div>
          ) : boqItems.length === 0 && !boqLoading && !manualMode ? (
            <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-sm text-amber-700 bg-amber-50">
              <p className="font-semibold mb-1">No BOQ items found for <b>{form.site_name}</b>.</p>
              <p className="text-xs mb-3">Pick one of the options below to keep going:</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => { setManualMode(true); setIndentItems([{ ...EMPTY_ITEM, manual: true }]); }} className="btn btn-primary inline-flex items-center gap-2 text-xs">
                  ✍ Type items manually
                </button>
                <button type="button" disabled={uploadingBoq} onClick={fetchExistingBoq} className="btn btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-60">
                  🔄 {uploadingBoq ? 'Fetching…' : 'Retry Fetch from BOQ'}
                </button>
                <label className="text-[11px] text-amber-700 underline cursor-pointer">
                  or upload a new BOQ file
                  <input type="file" accept=".xlsx,.xls,.pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" disabled={uploadingBoq}
                    onChange={e => { const f = e.target.files[0]; if (f) uploadBoqForSite(f); e.target.value = ''; }} />
                </label>
              </div>
              {boqDiag && <p className="text-[10px] text-amber-600 mt-2">{boqDiag.message}</p>}
            </div>
          ) : (
            <>
              {boqDiag?.reason === 'fallback_parsed' && (
                <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-[11px] text-blue-800">
                  ℹ Items loaded from this project's BOQ file ({boqDiag.po_number}).
                </div>
              )}
              {(boqDiag?.reason === 'borrowed_from_sibling' || boqDiag?.reason === 'borrowed_from_sibling_file') && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-[11px] text-amber-800">
                  📋 {boqDiag.message}
                </div>
              )}
              <div className="space-y-2">
                <div className="grid grid-cols-14 gap-2 text-[10px] font-bold text-gray-500 uppercase px-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                  <div className="col-span-4">BOQ Item</div>
                  <div className="col-span-4">Item (Item Master)</div>
                  <div className="col-span-2">Make</div>
                  <div>Qty</div>
                  <div>Unit</div>
                  <div className="col-span-2">Type</div>
                </div>
                {indentItems.map((item, i) => {
                  const t = String(item.item_type || '').toUpperCase();
                  const typeClass = t === 'FOC' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : t === 'RGP' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : t === 'PO' ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200';
                  const rem = item.remaining_qty;
                  const overRem = !item.is_foc && rem !== null && rem !== undefined && (item.quantity || 0) > rem;
                  const inManual = manualMode || item.manual;
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr)) auto' }}>
                        <div className="col-span-4">
                          {inManual ? (
                            <input className="input text-sm" placeholder="Type item description…" value={item.description || ''}
                              onChange={e => { const n = [...indentItems]; n[i].description = e.target.value; n[i].manual = true; setIndentItems(n); }} />
                          ) : (
                            <SearchableSelect
                              options={boqItems.map(b => ({
                                id: b.id,
                                label: `${b.item_code ? '[' + b.item_code + '] ' : ''}${b.description}${b.is_foc ? ' · FOC' : ` · BOQ ${b.boq_qty || 0} · Rem ${b.remaining_qty ?? 0}`}`,
                                ...b,
                              }))}
                              value={item.po_item_id || null}
                              valueKey="id" displayKey="label"
                              placeholder="Search BOQ item…"
                              onChange={(b) => pickBoqItem(i, b)}
                            />
                          )}
                        </div>
                        <div className="col-span-4">
                          <SearchableSelect
                            options={masterItems.map(m => ({ id: m.id, label: `[${m.item_code}] ${m.display_name || m.item_name}${m.type ? ' · ' + m.type : ''}`, ...m }))}
                            value={item.item_master_id || null}
                            valueKey="id" displayKey="label"
                            placeholder="Pick Item Master SKU (one PO + FOC items)…"
                            onChange={(m) => pickMasterItem(i, m)}
                          />
                        </div>
                        <input className="input col-span-2 text-sm" placeholder="Make" value={item.make || ''} onChange={e => { const n = [...indentItems]; n[i].make = e.target.value; setIndentItems(n); }} />
                        <input className={`input text-sm ${overRem ? 'border-red-400 ring-1 ring-red-300' : ''}`} type="number" min="0" placeholder="Qty" value={item.quantity} onChange={e => { const n = [...indentItems]; n[i].quantity = +e.target.value; setIndentItems(n); }} />
                        <input className="input text-sm" placeholder="Unit" value={item.unit} readOnly={!inManual}
                          onChange={e => { if (!inManual) return; const n = [...indentItems]; n[i].unit = e.target.value; setIndentItems(n); }} />
                        <div className={`col-span-2 text-center text-[11px] font-bold uppercase px-2 py-1.5 rounded-lg border ${typeClass}`}>
                          {inManual ? <select className="bg-transparent w-full outline-none text-[11px]" value={item.item_type || ''} onChange={e => { const n = [...indentItems]; n[i].item_type = e.target.value; setIndentItems(n); }}><option value="">—</option><option value="PO">PO</option><option value="FOC">FOC</option><option value="RGP">RGP</option></select> : (t || '—')}
                        </div>
                        <button type="button" onClick={() => setIndentItems(indentItems.filter((_, x) => x !== i))} className="p-1 text-gray-300 hover:text-red-600 justify-self-center" title="Remove row">
                          {indentItems.length > 1 && <FiTrash2 size={14} />}
                        </button>
                      </div>
                      {item.po_item_id && !inManual && (
                        <div className="col-span-12 text-[10px] text-gray-500 pl-1 flex gap-3">
                          {item.is_foc
                            ? <span className="text-emerald-700 font-semibold">FOC item — not counted against BOQ consumption</span>
                            : <>
                                <span>BOQ total: <b>{item.boq_qty}</b></span>
                                <span>Remaining: <b className={overRem ? 'text-red-600' : 'text-emerald-700'}>{rem}</b></span>
                                {overRem && <span className="text-red-600">⚠ Indent qty exceeds remaining</span>}
                              </>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setIndentItems([...indentItems, { ...EMPTY_ITEM, manual: manualMode }])} className="btn btn-secondary text-xs">+ Add Item</button>
                {manualMode && <span className="text-[10px] text-gray-500">✍ Manual mode — typing items directly (no BOQ)</span>}
              </div>
            </>
          )}
          <div><label className="label">Notes</label><textarea className="input" rows="2" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any remarks for Purchase…" /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create Indent</button></div>
        </form>
      </Modal>

      {/* Vendor PO Modal */}
      <Modal isOpen={modal === 'vendorpo'} onClose={() => setModal(false)} title="Create Vendor PO">
        <form onSubmit={saveVendorPo} className="space-y-4">
          <div><label className="label">Indent</label><select className="select" value={form.indent_id} onChange={e => setForm({...form, indent_id: e.target.value})}><option value="">Select</option>{indents.filter(i => i.status === 'approved').map(i => <option key={i.id} value={i.id}>{i.indent_number}</option>)}</select></div>
          <div><label className="label">Vendor *</label><select className="select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} required><option value="">Select</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div><label className="label">Total Amount</label><input className="input" type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount: +e.target.value})} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.advance_required} onChange={e => setForm({...form, advance_required: e.target.checked})} /> Advance Required</label>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
        </form>
      </Modal>

      {/* Purchase Bill Modal */}
      <Modal isOpen={modal === 'bill'} onClose={() => setModal(false)} title="Add Purchase Bill">
        <form onSubmit={savePurchaseBill} className="space-y-4">
          <div><label className="label">Vendor *</label><select className="select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} required><option value="">Select</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Bill Number</label><input className="input" value={form.bill_number} onChange={e => setForm({...form, bill_number: e.target.value})} /></div>
            <div><label className="label">Bill Date</label><input className="input" type="date" value={form.bill_date} onChange={e => setForm({...form, bill_date: e.target.value})} /></div>
            <div><label className="label">Amount</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: +e.target.value, total_amount: +e.target.value + (form.gst_amount || 0)})} /></div>
            <div><label className="label">GST Amount</label><input className="input" type="number" value={form.gst_amount} onChange={e => setForm({...form, gst_amount: +e.target.value, total_amount: (form.amount || 0) + +e.target.value})} /></div>
          </div>
          <div><label className="label">Total</label><input className="input" type="number" value={form.total_amount} readOnly /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Modal>

      {/* Delivery / Dispatch Modal */}
      <Modal isOpen={modal === 'delivery'} onClose={() => setModal(false)} title="Record Dispatch to Site">
        <form onSubmit={saveDeliveryNote} className="space-y-4">
          <div><label className="label">Vendor PO</label><select className="select" value={form.vendor_po_id} onChange={e => setForm({...form, vendor_po_id: e.target.value})}><option value="">Select</option>{vendorPos.map(v => <option key={v.id} value={v.id}>{v.po_number} - {v.vendor_name}</option>)}</select></div>
          <div><label className="label">Delivery Date</label><input className="input" type="date" value={form.delivery_date} onChange={e => setForm({...form, delivery_date: e.target.value})} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows="3" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
