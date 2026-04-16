import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiClock, FiMapPin, FiCamera, FiUsers, FiCalendar, FiCheckCircle, FiXCircle, FiPlus, FiAlertTriangle } from 'react-icons/fi';

export default function Attendance() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState('punch');
  const [myToday, setMyToday] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [records, setRecords] = useState([]);
  const [report, setReport] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const load = useCallback(() => {
    api.get('/attendance/my-today').then(r => setMyToday(r.data)).catch(() => {});
    if (isAdmin()) {
      api.get('/attendance/dashboard').then(r => setDashboard(r.data)).catch(() => {});
      api.get(`/attendance?date=${filterDate}`).then(r => setRecords(r.data)).catch(() => {});
      api.get('/attendance/geofence').then(r => setGeofences(r.data)).catch(() => {});
      api.get('/attendance/leaves').then(r => setLeaves(r.data)).catch(() => {});
      const m = new Date().getMonth() + 1, y = new Date().getFullYear();
      api.get(`/attendance/report?month=${m}&year=${y}`).then(r => setReport(r.data)).catch(() => {});
    }
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  // Get current location
  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('GPS not supported');
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocation(loc);
          setAddress(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`);
          resolve(loc);
        },
        err => reject('Please enable GPS: ' + err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Camera functions
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { toast.error('Camera not available. Please allow camera access.'); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 320; canvas.height = 240;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 320, 240);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    setPhoto(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraOpen(false);
  };

  // Punch In
  const handlePunchIn = async () => {
    if (!photo) return toast.error('Please take a selfie first');
    setLoading(true);
    try {
      const loc = await getLocation();
      const res = await api.post('/attendance/punch-in', { ...loc, address, photo, site_name: '' });
      toast.success(res.data.message);
      setPhoto(null); load();
    } catch (err) { toast.error(typeof err === 'string' ? err : err.response?.data?.error || 'Failed'); }
    setLoading(false);
  };

  // Punch Out
  const handlePunchOut = async () => {
    if (!photo) return toast.error('Please take a selfie first');
    setLoading(true);
    try {
      const loc = await getLocation();
      const res = await api.post('/attendance/punch-out', { ...loc, address, photo });
      toast.success(res.data.message);
      setPhoto(null); load();
    } catch (err) { toast.error(typeof err === 'string' ? err : err.response?.data?.error || 'Failed'); }
    setLoading(false);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('punch')} className={`btn ${tab === 'punch' ? 'btn-primary' : 'btn-secondary'} text-sm`}>Punch In/Out</button>
        {isAdmin() && <>
          <button onClick={() => setTab('dashboard')} className={`btn ${tab === 'dashboard' ? 'btn-primary' : 'btn-secondary'} text-sm`}>Dashboard</button>
          <button onClick={() => setTab('records')} className={`btn ${tab === 'records' ? 'btn-primary' : 'btn-secondary'} text-sm`}>Records</button>
          <button onClick={() => setTab('report')} className={`btn ${tab === 'report' ? 'btn-primary' : 'btn-secondary'} text-sm`}>Monthly Report</button>
          <button onClick={() => setTab('geofence')} className={`btn ${tab === 'geofence' ? 'btn-primary' : 'btn-secondary'} text-sm`}>Geofence</button>
          <button onClick={() => setTab('leaves')} className={`btn ${tab === 'leaves' ? 'btn-primary' : 'btn-secondary'} text-sm`}>Leaves</button>
        </>}
      </div>

      {/* PUNCH IN/OUT TAB */}
      {tab === 'punch' && (
        <div className="max-w-md mx-auto space-y-4">
          <div className="card text-center p-6">
            <FiClock size={40} className="mx-auto text-blue-600 mb-2" />
            <h2 className="text-3xl font-bold">{timeStr}</h2>
            <p className="text-sm text-gray-500">{dateStr}</p>
            <p className="text-sm font-medium text-blue-600 mt-1">{user?.name}</p>
          </div>

          {/* Status */}
          {myToday ? (
            <div className={`card p-4 ${myToday.punch_out_time ? 'bg-gray-50' : 'bg-emerald-50'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-emerald-700"><FiCheckCircle className="inline mr-1" /> Punched In: {new Date(myToday.punch_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  {myToday.punch_out_time && <p className="text-sm text-gray-600">Punched Out: {new Date(myToday.punch_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
                  {myToday.total_hours > 0 && <p className="text-sm font-bold">Total: {myToday.total_hours} hours</p>}
                </div>
                <StatusBadge status={myToday.status} />
              </div>
              {myToday.punch_in_photo && <img src={myToday.punch_in_photo} alt="Punch In" className="mt-2 w-20 h-16 rounded object-cover" />}
            </div>
          ) : (
            <div className="card p-4 bg-amber-50 text-center"><p className="text-amber-700 font-medium"><FiAlertTriangle className="inline mr-1" /> Not punched in today</p></div>
          )}

          {/* Camera */}
          <div className="card p-4 space-y-3">
            {cameraOpen ? (
              <div className="text-center">
                <video ref={videoRef} autoPlay playsInline className="rounded-lg mx-auto w-full max-w-[320px]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2 mt-2 justify-center">
                  <button onClick={capturePhoto} className="btn btn-primary flex items-center gap-1"><FiCamera size={16} /> Capture</button>
                  <button onClick={stopCamera} className="btn btn-secondary">Cancel</button>
                </div>
              </div>
            ) : photo ? (
              <div className="text-center">
                <img src={photo} alt="Selfie" className="rounded-lg mx-auto w-40 h-32 object-cover" />
                <button onClick={() => { setPhoto(null); openCamera(); }} className="text-xs text-blue-600 mt-1 underline">Retake</button>
              </div>
            ) : (
              <button onClick={openCamera} className="btn btn-secondary w-full flex items-center justify-center gap-2 py-3">
                <FiCamera size={18} /> Take Selfie
              </button>
            )}

            {location && <p className="text-xs text-gray-500 flex items-center gap-1"><FiMapPin size={12} /> {address}</p>}

            {/* Punch Buttons */}
            {!myToday ? (
              <button onClick={handlePunchIn} disabled={loading || !photo} className="btn btn-success w-full py-4 text-lg font-bold disabled:opacity-50">
                {loading ? 'Getting Location...' : 'PUNCH IN'}
              </button>
            ) : !myToday.punch_out_time ? (
              <button onClick={handlePunchOut} disabled={loading || !photo} className="btn btn-danger w-full py-4 text-lg font-bold disabled:opacity-50">
                {loading ? 'Getting Location...' : 'PUNCH OUT'}
              </button>
            ) : (
              <p className="text-center text-emerald-600 font-bold py-2">Today's attendance completed</p>
            )}
          </div>

          {/* Leave Request */}
          <button onClick={() => { setForm({ leave_type: 'casual', from_date: '', to_date: '', reason: '' }); setModal('leave'); }} className="btn btn-secondary w-full text-sm">Apply for Leave</button>
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {tab === 'dashboard' && dashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card p-3 border-l-4 border-blue-500"><p className="text-xs text-gray-500">Total</p><p className="text-2xl font-bold">{dashboard.totalUsers}</p></div>
            <div className="card p-3 border-l-4 border-emerald-500"><p className="text-xs text-gray-500">Present</p><p className="text-2xl font-bold text-emerald-600">{dashboard.present}</p></div>
            <div className="card p-3 border-l-4 border-red-500"><p className="text-xs text-gray-500">Absent</p><p className="text-2xl font-bold text-red-600">{dashboard.absent}</p></div>
            <div className="card p-3 border-l-4 border-amber-500"><p className="text-xs text-gray-500">Late</p><p className="text-2xl font-bold text-amber-600">{dashboard.late}</p></div>
            <div className="card p-3 border-l-4 border-purple-500"><p className="text-xs text-gray-500">On Leave</p><p className="text-2xl font-bold text-purple-600">{dashboard.onLeave}</p></div>
          </div>

          {/* Not Punched In */}
          {dashboard.notPunched?.length > 0 && (
            <div className="card bg-red-50 border border-red-200">
              <h4 className="font-bold text-red-700 mb-2"><FiAlertTriangle className="inline mr-1" /> Not Punched In Today ({dashboard.notPunched.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{dashboard.notPunched.map(u => (
                <div key={u.id} className="bg-white rounded p-2 text-sm"><span className="font-medium">{u.name}</span><br/><span className="text-xs text-gray-500">{u.department}</span></div>
              ))}</div>
            </div>
          )}

          {/* Today's Records */}
          <div className="card p-0 overflow-hidden">
            <div className="p-3 border-b"><h4 className="font-semibold">Today's Attendance</h4></div>
            <div className="overflow-x-auto"><table className="text-sm">
              <thead><tr><th>Name</th><th>Dept</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Photo</th></tr></thead>
              <tbody>{dashboard.todayRecords?.map(r => (
                <tr key={r.id}>
                  <td className="font-medium">{r.user_name}</td><td className="text-xs">{r.department}</td>
                  <td className="text-emerald-600 text-xs">{r.punch_in_time ? new Date(r.punch_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="text-red-600 text-xs">{r.punch_out_time ? new Date(r.punch_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="font-semibold">{r.total_hours || '-'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.punch_in_photo && <img src={r.punch_in_photo} alt="" className="w-10 h-8 rounded object-cover" />}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </>
      )}

      {/* RECORDS TAB */}
      {tab === 'records' && (
        <>
          <input type="date" className="input w-48" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table className="text-sm">
            <thead><tr><th>Name</th><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Site</th><th>Status</th><th>In Photo</th><th>Out Photo</th></tr></thead>
            <tbody>{records.map(r => (
              <tr key={r.id}>
                <td className="font-medium">{r.user_name}</td><td>{r.date}</td>
                <td className="text-xs">{r.punch_in_time ? new Date(r.punch_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="text-xs">{r.punch_out_time ? new Date(r.punch_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="font-semibold">{r.total_hours || '-'}</td>
                <td className="text-xs">{r.site_name || '-'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.punch_in_photo && <img src={r.punch_in_photo} alt="" className="w-10 h-8 rounded object-cover" />}</td>
                <td>{r.punch_out_photo && <img src={r.punch_out_photo} alt="" className="w-10 h-8 rounded object-cover" />}</td>
              </tr>
            ))}</tbody>
          </table></div></div>
        </>
      )}

      {/* MONTHLY REPORT */}
      {tab === 'report' && (
        <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table className="text-sm">
          <thead><tr><th>Employee</th><th>Dept</th><th>Present</th><th>Late</th><th>Half Day</th><th>Absent</th><th>Avg Hours</th></tr></thead>
          <tbody>{report.map(r => (
            <tr key={r.user_id}>
              <td className="font-medium">{r.name}</td><td className="text-xs">{r.department}</td>
              <td className="text-emerald-600 font-bold">{r.present_days}</td>
              <td className="text-amber-600">{r.late_days}</td>
              <td>{r.half_days}</td>
              <td className="text-red-600">{r.absent_days}</td>
              <td className="font-semibold">{r.avg_hours || '-'}h</td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}

      {/* GEOFENCE SETTINGS */}
      {tab === 'geofence' && (
        <>
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Geofence Areas</h4>
            <button onClick={() => { setForm({ site_name: '', latitude: '', longitude: '', radius_meters: 200 }); setModal('geofence'); }} className="btn btn-primary flex items-center gap-2 text-sm"><FiPlus size={14} /> Add Geofence</button>
          </div>
          <p className="text-xs text-gray-500">Employees can only punch in/out when inside these areas. If no geofence set, punch from anywhere.</p>
          <div className="card p-0 overflow-hidden"><table className="text-sm">
            <thead><tr><th>Site</th><th>Latitude</th><th>Longitude</th><th>Radius (m)</th><th>Active</th></tr></thead>
            <tbody>{geofences.map(g => (
              <tr key={g.id}><td className="font-medium">{g.site_name}</td><td>{g.latitude}</td><td>{g.longitude}</td><td>{g.radius_meters}m</td><td>{g.active ? 'Yes' : 'No'}</td></tr>
            ))}{geofences.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">No geofence set. Employees can punch from anywhere.</td></tr>}</tbody>
          </table></div>
        </>
      )}

      {/* LEAVES TAB */}
      {tab === 'leaves' && (
        <div className="card p-0 overflow-hidden"><table className="text-sm">
          <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{leaves.map(l => (
            <tr key={l.id}>
              <td className="font-medium">{l.user_name}</td><td className="capitalize">{l.leave_type}</td>
              <td>{l.from_date}</td><td>{l.to_date}</td><td>{l.days}</td><td className="text-xs">{l.reason}</td>
              <td><StatusBadge status={l.status} /></td>
              <td>{l.status === 'pending' && <>
                <button onClick={async () => { await api.put(`/attendance/leave/${l.id}/approve`, { status: 'approved' }); toast.success('Approved'); load(); }} className="text-xs text-emerald-600 font-bold mr-2">Approve</button>
                <button onClick={async () => { await api.put(`/attendance/leave/${l.id}/approve`, { status: 'rejected' }); toast.success('Rejected'); load(); }} className="text-xs text-red-600 font-bold">Reject</button>
              </>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {/* Leave Modal */}
      <Modal isOpen={modal === 'leave'} onClose={() => setModal(null)} title="Apply for Leave">
        <form onSubmit={async (e) => { e.preventDefault(); try { await api.post('/attendance/leave', form); toast.success('Leave applied'); setModal(null); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } }} className="space-y-4">
          <div><label className="label">Leave Type</label><select className="select" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}><option value="casual">Casual</option><option value="sick">Sick</option><option value="earned">Earned</option><option value="half_day">Half Day</option><option value="comp_off">Comp Off</option></select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From *</label><input className="input" type="date" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} required /></div>
            <div><label className="label">To *</label><input className="input" type="date" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} required /></div>
          </div>
          <div><label className="label">Reason</label><textarea className="input" rows="2" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Apply</button></div>
        </form>
      </Modal>

      {/* Geofence Modal */}
      <Modal isOpen={modal === 'geofence'} onClose={() => setModal(null)} title="Add Geofence Area">
        <form onSubmit={async (e) => { e.preventDefault(); try { await api.post('/attendance/geofence', form); toast.success('Geofence added'); setModal(null); load(); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } }} className="space-y-4">
          <div><label className="label">Site Name *</label><input className="input" value={form.site_name} onChange={e => setForm({ ...form, site_name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Latitude *</label><input className="input" type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} required /></div>
            <div><label className="label">Longitude *</label><input className="input" type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} required /></div>
          </div>
          <div><label className="label">Radius (meters)</label><input className="input" type="number" value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: +e.target.value })} /></div>
          <button type="button" onClick={async () => {
            try { const loc = await getLocation(); setForm(f => ({ ...f, latitude: loc.latitude, longitude: loc.longitude })); toast.success('Current location set'); }
            catch { toast.error('GPS failed'); }
          }} className="btn btn-secondary text-sm w-full"><FiMapPin className="inline mr-1" /> Use My Current Location</button>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Save Geofence</button></div>
        </form>
      </Modal>
    </div>
  );
}
