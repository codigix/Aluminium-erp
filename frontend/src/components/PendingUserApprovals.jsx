import React, { useCallback, useEffect, useState } from 'react';
import { UserCheck, RefreshCw } from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Self sign-ups are created INACTIVE; an admin (USER_MANAGE) activates them here.
const PendingUserApprovals = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState(null);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('authToken')}` });

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.users || data.data || []);
      setUsers(list.filter(u => String(u.status || '').toUpperCase() === 'INACTIVE'));
    } catch (error) {
      console.error('[PendingUserApprovals]', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const activate = async (u) => {
    try {
      setActivatingId(u.id);
      const response = await fetch(`${API_BASE}/users/${u.id}/reactivate`, { method: 'PUT', headers: authHeaders() });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Activation failed');
      }
      successToast(`${u.first_name || u.username} can now log in`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (error) {
      errorToast(error.message);
    } finally {
      setActivatingId(null);
    }
  };

  if (!loading && users.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-amber-100 bg-amber-50/60 rounded-t-xl">
        <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
          <UserCheck className="w-4 h-4" />
          Pending account approvals {users.length > 0 && `(${users.length})`}
        </div>
        <button onClick={fetchPending} className="p-1.5 text-amber-700 hover:bg-amber-100 rounded" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <div>
              <div className="font-medium text-slate-800">{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</div>
              <div className="text-xs text-slate-500">
                {u.email} · {u.department_name || u.department_code || 'No department'} · {u.role_name || u.role_code || 'No role'}
              </div>
            </div>
            <button
              onClick={() => activate(u)}
              disabled={activatingId === u.id}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {activatingId === u.id ? 'Activating…' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingUserApprovals;
