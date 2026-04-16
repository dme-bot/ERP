import { useState, useEffect } from 'react';
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
  { path: '/cashflow', label: 'Cash Flow', icon: FiTrendingUp, module: 'cashflow' },
  { path: '/payment-required', label: 'Payment Required', icon: FiDollarSign, module: 'payment_required' },
  { path: '/attendance', label: 'Attendance', icon: FiCheckSquare, module: 'attendance' },
  { path: '/collections', label: 'Collection Engine', icon: FiCreditCard, module: 'collections' },
  { path: '/indent-fms', label: 'Indent to Payment', icon: FiLayers, module: 'indent_fms' },
  { path: '/dpr', label: 'DPR', icon: FiBarChart2, module: 'dpr' },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const { user, logout, canView, isAdmin, userRoles } = useAuth();

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const visibleMenu = menuItems.filter(item => canView(item.module));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 bg-black/60 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-40 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-transform duration-300 flex-shrink-0 ${isMobile ? 'w-56' : 'w-64'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">SEPL ERP</h1>
          </div>
          {isMobile && <button className="p-1.5 hover:bg-white/10 rounded" onClick={() => setSidebarOpen(false)}><FiX size={18} /></button>}
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {visibleMenu.map(item => (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === item.path ? 'bg-white/15 text-white font-medium' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <item.icon size={16} />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
          {isAdmin() && (
            <>
              <div className="pt-3 pb-1 px-3"><span className="text-[10px] font-semibold text-slate-500 uppercase">Admin</span></div>
              {adminItems.map(item => (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === item.path ? 'bg-white/15 text-white font-medium' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                  <item.icon size={16} />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="text-sm text-slate-300">{user?.name}</div>
          <div className="text-[10px] text-slate-500 mb-1">{user?.email}</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {userRoles.map((r, i) => (
              <span key={i} className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{r}</span>
            ))}
          </div>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-300 hover:text-red-200 hover:bg-white/10 rounded w-full">
            <FiLogOut size={15} /> <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="bg-white shadow-sm border-b border-gray-200 px-3 md:px-6 py-2.5 flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <FiMenu size={20} />
          </button>
          <h2 className="text-sm md:text-lg font-semibold text-gray-800 truncate">
            {[...menuItems, ...adminItems].find(m => m.path === location.pathname)?.label || 'SEPL ERP'}
          </h2>
        </header>
        <main className="flex-1 overflow-y-auto p-2 md:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
