import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Modal } from '../components/ui.jsx';
import OperatorList from './OperatorList.jsx';
import OperatorScheduleView from './OperatorScheduleView.jsx';
import OperatorHistoryModal from './OperatorHistoryModal.jsx';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const OperatorMaster = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [operators, setOperators] = useState([]);
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(false);

  const [viewingScheduleId, setViewingScheduleId] = useState(null);
  const [viewingHistoryOp, setViewingHistoryOp] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOp, setEditingOp] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    status: 'ACTIVE'
  });

  const fetchOperators = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/operators`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch operators');
      const data = await res.json();
      setOperators(data);

      try {
        const ovRes = await fetch(`${API_BASE}/operators/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ovRes.ok) {
          const ovData = await ovRes.json();
          setOverview(Object.fromEntries(ovData.map(r => [r.id, r])));
        }
      } catch (e) {
        console.error('Error fetching operator overview:', e);
      }
    } catch (err) {
      errorToast(err.message || 'Error loading operators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  // Handle URL query parameters (e.g. ?schedule=12 or ?history=12)
  useEffect(() => {
    const schedId = searchParams.get('schedule');
    const histId = searchParams.get('history');
    if (schedId) setViewingScheduleId(schedId);
    if (histId && operators.length > 0) {
      const match = operators.find(o => String(o.id) === String(histId));
      if (match) setViewingHistoryOp(match);
    }
  }, [searchParams, operators]);

  const handleOpenNew = () => {
    setEditingOp(null);
    setFormData({
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      status: 'ACTIVE'
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (op) => {
    setEditingOp(op);
    setFormData({
      username: op.username,
      first_name: op.first_name || '',
      last_name: op.last_name || '',
      email: op.email || '',
      phone: op.phone || '',
      password: '',
      status: op.status || 'ACTIVE'
    });
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const isEdit = Boolean(editingOp?.id);
      const url = isEdit ? `${API_BASE}/operators/${editingOp.id}` : `${API_BASE}/operators`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || 'Failed to save operator');

      successToast(isEdit ? 'Operator updated successfully' : 'Operator created successfully');
      setIsFormOpen(false);
      fetchOperators();
    } catch (err) {
      errorToast(err.message || 'Error saving operator');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {viewingScheduleId ? (
        <OperatorScheduleView
          operatorId={viewingScheduleId}
          onBack={() => setViewingScheduleId(null)}
        />
      ) : (
        <OperatorList
          operators={operators}
          overview={overview}
          loading={loading}
          onNew={handleOpenNew}
          onRefresh={fetchOperators}
          onSchedule={(op) => setViewingScheduleId(op.id)}
          onHistory={(op) => setViewingHistoryOp(op)}
          onEdit={handleOpenEdit}
        />
      )}

      {/* Operator History Modal */}
      {viewingHistoryOp && (
        <OperatorHistoryModal
          operator={viewingHistoryOp}
          isOpen={Boolean(viewingHistoryOp)}
          onClose={() => setViewingHistoryOp(null)}
        />
      )}

      {/* Add / Edit Operator Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingOp ? `Edit Operator: ${editingOp.first_name || ''} ${editingOp.last_name || ''} (${editingOp.username})` : 'Add New Operator'}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingOp)}
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. operator1"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md disabled:bg-slate-50 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="e.g. Ramesh"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="e.g. Patil"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. operator@company.com"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {!editingOp && (
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave blank for default (operator123)"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm"
            >
              {editingOp ? 'Update Operator' : 'Create Operator'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default OperatorMaster;
