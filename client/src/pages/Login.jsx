import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(form.email, form.password);
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Business ERP</h1>
          <p className="text-gray-500 mt-2">Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="Enter your email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Enter your password" />
          </div>
          <button type="submit" className="btn btn-primary w-full py-3 text-base">Sign In</button>
        </form>
        <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <p className="font-semibold mb-1">Default Admin Login:</p>
          <p>Email: <strong>admin@erp.com</strong></p>
          <p>Password: <strong>admin123</strong></p>
          <p className="mt-2 text-blue-500">Contact your admin to get a new account.</p>
        </div>
      </div>
    </div>
  );
}
