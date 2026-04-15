import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome, FiUsers, FiTarget, FiFileText, FiShoppingCart,
  FiTruck, FiTool, FiAlertCircle, FiUserPlus, FiDollarSign,
  FiCheckSquare, FiMenu, FiX, FiLogOut, FiPackage, FiClipboard,
  FiSettings, FiShield, FiTrendingUp, FiCreditCard, FiLayers, FiBarChart2, FiBook, FiGrid
} from 'react-icons/fi';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: FiHome, module: 'dashboard' },
  // 4 Critical Systems
  { path: '/cashflow', label: 'Cash Flow', icon: FiTrendingUp, module: 'cashflow' },
  { path: '/payment-required', label: 'Payment Required', icon: FiDollarSign, module: 'payment_required' },
  { path: '/collections', label: 'Collection Engine', icon: FiCreditCard, module: 'collections' },
  { path: '/indent-fms', label: 'Indent to Payment', icon: FiLayers, module: 'indent_fms' },
  { path: '/dpr', label: 'DPR (Daily Progress)', icon: FiBarChart2, module: 'dpr' },
  // Other modules
  { path: '/leads', label: 'Leads / CRM', icon: FiTarget, module: 'leads' },
  { path: '/quotations', label: 'BOQ & Quotations', icon: FiFileText, module: 'quotations' },
  { path: '/business-book', label: 'Business Book', icon: FiBook, module: 'business_book' },
  { path: '/item-master', label: 'Item Master', icon: FiGrid, module: 'item_master' },
  { path: '/orders', label: 'Orders & Planning', icon: FiShoppingCart, module: 'orders' },
  { path: '/vendors', label: 'Vendors', icon: FiTruck, module: 'vendors' },
  { path: '/procurement', label: 'Procurement', icon: FiPackage, module: 'procurement' },
  { path: '/installation', label: 'Installation', icon: FiTool, module: 'installation' },
  { path: '/billing', label: 'Billing', icon: FiClipboard, module: 'billing' },
  { path: '/complaints', label: 'Complaints', icon: FiAlertCircle, module: 'complaints' },
  { path: '/hr', label: 'HR & Hiring', icon: FiUserPlus, module: 'hr' },
  { path: '/employees', label: 'Employees', icon: FiUsers, module: 'employees' },
  { path: '/expenses', label: 'Expenses', icon: FiDollarSign, module: 'expenses' },
  { path: '/checklists', label: 'Checklists', icon: FiCheckSquare, module: 'checklists' },
];

const adminItems = [
  { path: '/admin/users', label: 'User Management', icon: FiSettings, module: 'users' },
  { path: '/admin/roles', label: 'Roles & Permissions', icon: FiShield, module: 'users' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const location = useLocation();
  const { user, logout, canView, isAdmin, userRoles } = useAuth();

  // Filter menu items based on user permissions
  const visibleMenu = menuItems.filter(item => canView(item.module));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay - tap to close sidebar */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full w-0'} fixed md:relative z-40 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 flex-shrink-0 md:translate-x-0 ${!sidebarOpen && 'md:w-0 md:-ml-64'}`}>
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Business ERP</h1>
            <p className="text-xs text-slate-400 mt-1">Management System</p>
          </div>
          <button className="md:hidden p-1 hover:bg-white/10 rounded" onClick={() => setSidebarOpen(false)}><FiX size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleMenu.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Admin Section */}
          {isAdmin() && (
            <>
              <div className="pt-4 pb-2 px-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</span>
              </div>
              {adminItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-sm text-slate-300 mb-1">{user?.name}</div>
          <div className="text-xs text-slate-500 mb-1">{user?.email}</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {userRoles.map((r, i) => (
              <span key={i} className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{r}</span>
            ))}
            {userRoles.length === 0 && <span className="text-[10px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded capitalize">{user?.role}</span>}
          </div>
          <button onClick={logout} className="sidebar-link text-red-300 hover:text-red-200 w-full">
            <FiLogOut size={18} /> <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
            <FiMenu size={20} />
          </button>
          <h2 className="text-base md:text-lg font-semibold text-gray-800 truncate">
            {[...menuItems, ...adminItems].find(m => m.path === location.pathname)?.label || 'Business ERP'}
          </h2>
        </header>
        <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
