import React, { useState, useEffect } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const OperationMaster = ({ showForm, setShowForm }) => {
  const [operations, setOperations] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    operation_code: '',
    operation_name: '',
    workstation_id: '',
    std_time: 0,
    time_uom: 'Hr',
    hourly_rate: 0,
    is_active: 1
  });

  const timeUOMs = ['Hr', 'Min', 'Sec'];

  useEffect(() => {
    fetchOperations();
    fetchWorkstations();

    const handleRefresh = () => fetchOperations();
    window.addEventListener('refreshOperations', handleRefresh);
    return () => window.removeEventListener('refreshOperations', handleRefresh);
  }, []);

  useEffect(() => {
    if (showForm && !isEditing) {
      fetchNextCode();
    }
  }, [showForm, isEditing]);

  const fetchOperations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/operations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch operations');
      const data = await response.json();
      setOperations(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load operations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkstations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/workstations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch workstations');
      const data = await response.json();
      setWorkstations(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchNextCode = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/operations/next-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch next code');
      const data = await response.json();
      setFormData(prev => ({ ...prev, operation_code: data.nextCode }));
    } catch (error) {
      console.error(error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const url = isEditing ? `${API_BASE}/operations/${editingId}` : `${API_BASE}/operations`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save operation');
      }

      Swal.fire('Success', `Operation ${isEditing ? 'updated' : 'created'} successfully`, 'success');
      setShowForm(false);
      resetForm();
      fetchOperations();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      operation_code: '',
      operation_name: '',
      workstation_id: '',
      std_time: 0,
      time_uom: 'Hr',
      hourly_rate: 0,
      is_active: 1
    });
  };

  const handleEdit = (op) => {
    setFormData({
      operation_code: op.operation_code,
      operation_name: op.operation_name,
      workstation_id: op.workstation_id || '',
      std_time: op.std_time,
      time_uom: op.time_uom,
      hourly_rate: op.operation_rate || op.hourly_rate || 0,
      is_active: op.is_active
    });
    setEditingId(op.id);
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (op) => {
    const newStatus = op.is_active ? 0 : 1;
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You want to ${newStatus ? 'enable' : 'disable'} operation: ${op.operation_name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: `Yes, ${newStatus ? 'enable' : 'disable'} it!`
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/operations/${op.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ ...op, is_active: newStatus })
        });
        if (!response.ok) throw new Error('Failed to update status');
        Swal.fire('Updated!', `Operation has been ${newStatus ? 'enabled' : 'disabled'}.`, 'success');
        fetchOperations();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredOperations = operations.filter(op => 
    op.operation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.operation_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      {showForm && (
        <Card>
          <div className="bg-indigo-600 -mx-8 -mt-8 px-8 py-4 rounded-t-[32px] mb-8">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚙️</span>
              {isEditing ? 'Edit Operation' : 'Add New Operation'}
            </h2>
            <p className="text-indigo-100 text-xs mt-1">Define operation parameters and standard times</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Code *</label>
                <input 
                  type="text" 
                  name="operation_code"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  placeholder="e.g., OP-10"
                  value={formData.operation_code}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Name *</label>
                <input 
                  type="text" 
                  name="operation_name"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  placeholder="e.g., VMC Machining"
                  value={formData.operation_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Workstation *</label>
                <select 
                  name="workstation_id"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  value={formData.workstation_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Workstation</option>
                  {workstations.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.workstation_name} ({ws.workstation_code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Std Time *</label>
                  <input 
                    type="number" 
                    name="std_time"
                    step="0.01"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                    value={formData.std_time}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">UOM</label>
                  <select 
                    name="time_uom"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                    value={formData.time_uom}
                    onChange={handleInputChange}
                  >
                    {timeUOMs.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hourly Rate (Override)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 text-sm">₹</span>
                  <input 
                    type="number" 
                    name="hourly_rate"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                    placeholder="Leave 0 to use workstation rate"
                    value={formData.hourly_rate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input 
                  type="checkbox" 
                  name="is_active"
                  id="is_active"
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  checked={formData.is_active === 1}
                  onChange={handleInputChange}
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
              >
                {isEditing ? 'Update Operation' : 'Save Operation'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 -mx-8 -mt-8 px-8 py-5 rounded-t-[32px] mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📋</span>
              Operation List
            </h2>
            <p className="text-slate-300 text-[10px] mt-0.5">Manage manufacturing steps and standard times</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (!showForm) resetForm();
                setShowForm(!showForm);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <span>{showForm ? '✕' : '+'}</span>
              {showForm ? 'Close Form' : 'Add Operation'}
            </button>
            <button 
              onClick={fetchOperations}
              className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all"
              title="Refresh Data"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="p-4 bg-white border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search by code or name..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Code</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Name</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Workstation</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Std Time</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hourly Rate</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400">Loading operations...</td></tr>
              ) : filteredOperations.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400 italic">No operations found</td></tr>
              ) : (
                filteredOperations.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">{op.operation_code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{op.operation_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 font-medium">{op.workstation_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-bold text-slate-700">{op.std_time} {op.time_uom}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-bold text-indigo-600">₹{op.hourly_rate ? parseFloat(op.hourly_rate).toFixed(2) : '0.00'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={op.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(op)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">✏️</button>
                        <button 
                          onClick={() => handleToggleStatus(op)} 
                          className={`p-2 ${op.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'} rounded-lg transition-colors`} 
                          title={op.is_active ? 'Disable' : 'Enable'}
                        >
                          {op.is_active ? '🚫' : '✅'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default OperationMaster;
