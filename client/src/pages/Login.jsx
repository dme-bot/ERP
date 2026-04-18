import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiShield, FiUser, FiLock } from 'react-icons/fi';

export default function Login() {
  // Prefill the username if "Remember me" was ticked on a previous login.
  const savedIdentifier = typeof window !== 'undefined' ? (localStorage.getItem('sepl_remember_identifier') || '') : '';
  const [form, setForm] = useState({ identifier: savedIdentifier, password: '' });
  const [remember, setRemember] = useState(!!savedIdentifier);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(form.identifier, form.password);
      if (remember) {
        localStorage.setItem('sepl_remember_identifier', form.identifier);
      } else {
        localStorage.removeItem('sepl_remember_identifier');
      }
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <FiShield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">SEPL ERP</h1>
          <p className="text-gray-400 text-sm mt-1">Secured Engineers Pvt Ltd</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Username or Email</label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input className="input pl-10" type="text" autoComplete="username" value={form.identifier} onChange={e => setForm({...form, identifier: e.target.value})} required placeholder="Enter your username or email id" />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input className="input pl-10" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Enter your password" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
            <span className="ml-auto text-[10px] text-gray-400">Saves your username on this device</span>
          </label>

          <button type="submit" className="btn btn-primary w-full py-3.5 text-base rounded-xl">Sign In</button>
        </form>

        <p className="mt-6 text-center text-[11px] text-gray-400">Contact your admin for login credentials</p>
      </div>

      {/* Elegant footer: creator + company, centered at bottom */}
      <div className="fixed bottom-5 left-0 right-0 flex justify-center px-4 z-10 pointer-events-none">
        <div className="pointer-events-auto text-center select-none">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/40 mb-1.5">
            Crafted with <span className="text-pink-400">&hearts;</span> by
          </p>
          <p className="text-base font-bold bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent drop-shadow-sm">
            Secured Engineers Pvt Ltd
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-[10px] font-semibold tracking-widest text-white/60 uppercase">
              Monika Devi
            </p>
            <span className="h-px w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
          <p className="text-[9px] text-white/30 mt-1">&copy; {new Date().getFullYear()} &middot; All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
