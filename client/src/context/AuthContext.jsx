import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [userRoles, setUserRoles] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(r => {
          setUser({ id: r.data.id, name: r.data.name, email: r.data.email, role: r.data.role, department: r.data.department, phone: r.data.phone });
          setPermissions(r.data.permissions || {});
          setUserRoles(r.data.userRoles || []);
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token);
    setUser(data.user);
    setPermissions(data.permissions || {});
    setUserRoles(data.userRoles || []);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setPermissions({});
    setUserRoles([]);
  };

  // Permission helper functions
  const can = (module, action = 'view') => {
    if (user?.role === 'admin') return true;
    const perm = permissions[module];
    if (!perm) return false;
    const actionMap = { view: 'can_view', create: 'can_create', edit: 'can_edit', delete: 'can_delete', approve: 'can_approve' };
    return !!perm[actionMap[action]];
  };

  const canView = (module) => can(module, 'view');
  const canCreate = (module) => can(module, 'create');
  const canEdit = (module) => can(module, 'edit');
  const canDelete = (module) => can(module, 'delete');
  const canApprove = (module) => can(module, 'approve');
  const isAdmin = () => user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user, token, permissions, userRoles,
      login, logout, loading,
      can, canView, canCreate, canEdit, canDelete, canApprove, isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
