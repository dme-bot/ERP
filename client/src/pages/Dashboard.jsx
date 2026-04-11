import { useState, useEffect } from 'react';
import api from '../api';
import StatusBadge from '../components/StatusBadge';
import { FiTarget, FiShoppingCart, FiTool, FiAlertCircle, FiUsers, FiDollarSign } from 'react-icons/fi';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(r => setStats(r.data));
  }, []);

  if (!stats) return <div className="text-center py-10">Loading...</div>;

  const cards = [
    { title: 'Total Leads', value: stats.leads.total, sub: `${stats.leads.new} new`, icon: FiTarget, color: 'bg-blue-500' },
    { title: 'Won Deals', value: stats.leads.won, sub: `${stats.leads.qualified} qualified`, icon: FiTarget, color: 'bg-emerald-500' },
    { title: 'Active Orders', value: stats.orders.total, sub: `Rs ${(stats.orders.totalValue/100000).toFixed(1)}L value`, icon: FiShoppingCart, color: 'bg-purple-500' },
    { title: 'Installations', value: stats.installations.inProgress, sub: `${stats.installations.completed} completed`, icon: FiTool, color: 'bg-amber-500' },
    { title: 'Open Complaints', value: stats.complaints.open, sub: `${stats.complaints.inProgress} in progress`, icon: FiAlertCircle, color: 'bg-red-500' },
    { title: 'Employees', value: stats.hr.employees, sub: `${stats.hr.subContractors} contractors`, icon: FiUsers, color: 'bg-teal-500' },
    { title: 'Pending Expenses', value: `Rs ${stats.expenses.pending.toLocaleString()}`, sub: `Rs ${stats.expenses.approved.toLocaleString()} approved`, icon: FiDollarSign, color: 'bg-orange-500' },
    { title: 'Candidates', value: stats.hr.candidates, sub: 'in pipeline', icon: FiUsers, color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="stat-card">
            <div className={`${c.color} p-3 rounded-xl text-white`}><c.icon size={24} /></div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{c.value}</div>
              <div className="text-xs text-gray-500">{c.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Leads</h3>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Company</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {stats.recentLeads.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.company_name}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {stats.recentLeads.length === 0 && <tr><td colSpan="3" className="text-center text-gray-400 py-4">No leads yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>PO Number</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recentOrders.map(o => (
                  <tr key={o.id}>
                    <td className="font-medium">{o.po_number}</td>
                    <td>Rs {o.total_amount?.toLocaleString()}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
                {stats.recentOrders.length === 0 && <tr><td colSpan="3" className="text-center text-gray-400 py-4">No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Complaints</h3>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Number</th><th>Description</th><th>Priority</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recentComplaints.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.complaint_number}</td>
                    <td className="max-w-xs truncate">{c.description}</td>
                    <td><StatusBadge status={c.priority} /></td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
                {stats.recentComplaints.length === 0 && <tr><td colSpan="4" className="text-center text-gray-400 py-4">No complaints</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
