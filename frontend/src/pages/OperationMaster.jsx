import React, { useState, useEffect } from 'react';
import { Card, Modal, DataTable, Badge, FormControl, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

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
      errorToast('Failed to load operations');
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

      successToast(`Operation ${isEditing ? 'updated' : 'created'} successfully`);
      setShowForm(false);
      resetForm();
      fetchOperations();
    } catch (error) {
      errorToast(error.message);
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
        successToast(`Operation has been ${newStatus ? 'enabled' : 'disabled'}.`);
        fetchOperations();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const handleDelete = async (op) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete operation: ${op.operation_name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/operations/${op.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete operation');
        successToast('Operation has been deleted successfully');
        fetchOperations();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredOperations = operations.filter(op => 
    op.operation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.operation_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { 
      label: 'Operation Code', 
      key: 'operation_code', 
      sortable: true,
      render: (val) => <span className=" text-indigo-600 font-mono">{val}</span>
    },
    { 
      label: 'Operation Name', 
      key: 'operation_name', 
      sortable: true,
      render: (val) => <span className="font-medium text-slate-900">{val}</span>
    },
    { 
      label: 'Workstation', 
      key: 'workstation_name', 
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="text-slate-900 font-medium">{val}</div>
          <div className="text-[10px] text-slate-400 font-mono">{row.workstation_code}</div>
        </div>
      )
    },
    { 
      label: 'Std Time', 
      key: 'std_time',
      render: (val, row) => (
        <span className="text-slate-600 font-medium">
          {val} {row.time_uom}
        </span>
      )
    },
    { 
      label: 'Hourly Rate', 
      key: 'operation_rate',
      render: (val) => (
        <span className="text-emerald-600 ">
          ₹{val || 0}
        </span>
      )
    },
    { 
      label: 'Status', 
      key: 'is_active',
      render: (val) => (
        <Badge variant={val ? 'success' : 'danger'}>
          {val ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => handleEdit(row)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit Operation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button 
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition-colors ${row.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
            title={row.is_active ? 'Disable Operation' : 'Enable Operation'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>
          <button 
            onClick={() => handleDelete(row)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Operation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl text-slate-900">Operation Master</h1>
          <p className="text-xs text-slate-500 font-medium">Define and manage manufacturing operations and standard times</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchOperations}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
            title="Refresh Data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button 
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs  hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Operation
          </button>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={operations}
        loading={loading}
        searchPlaceholder="Search by code or name..."
      />

      <Modal 
        isOpen={showForm} 
        onClose={() => { setShowForm(false); resetForm(); }}
        title={isEditing ? 'Edit Operation' : 'Add New Operation'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Operation Code *</label>
              <input 
                type="text" 
                name="operation_code"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                placeholder="e.g., OP-10"
                value={formData.operation_code}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Operation Name *</label>
              <input 
                type="text" 
                name="operation_name"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                placeholder="e.g., VMC Machining"
                value={formData.operation_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Workstation *</label>
              <select 
                name="workstation_id"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
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
                <label className="text-xs font-medium text-slate-500">Std Time *</label>
                <input 
                  type="number" 
                  name="std_time"
                  step="0.01"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  value={formData.std_time}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">UOM</label>
                <select 
                  name="time_uom"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  value={formData.time_uom}
                  onChange={handleInputChange}
                >
                  {timeUOMs.map(uom => <option key={uom} value={uom}>{uom}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Hourly Rate (Override)</label>
              <div className="relative">
                <span className="absolute left-4 top-2.5 text-slate-400 text-sm">₹</span>
                <input 
                  type="number" 
                  name="hourly_rate"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
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
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs  hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
            >
              {isEditing ? 'Update Operation' : 'Save Operation'}
            </button>
          </div>
        </form>
      </Modal>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2  rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl">Operation List</h2>
              <p className="text-slate-400 text-[10px] mt-0.5">Manage manufacturing steps and standard times</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (!showForm) resetForm();
                setShowForm(!showForm);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              {showForm ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              )}
              {showForm ? 'Close Form' : 'Add Operation'}
            </button>
            <button 
              onClick={fetchOperations}
              className="p-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all"
              title="Refresh Data"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 bg-white border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
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
          <table className="min-w-full divide-y divide-slate-200 bg-white">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Operation Code</th>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Operation Name</th>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Workstation</th>
                <th className="p-2 text-left text-xs text-slate-500  tracking-wider">Std Time</th>
                <th className="p-2 text-left text-xs text-slate-500  tracking-wider">Hourly Rate</th>
                <th className="p-2 text-left text-xs text-slate-500  tracking-wider">Status</th>
                <th className="p-2 text-right text-xs  text-slate-500  tracking-wider">Actions</th>
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
                    <td className="p-2">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] ">{op.operation_code}</span>
                    </td>
                    <td className="p-2">
                      <div className="text-sm text-slate-900">{op.operation_name}</div>
                    </td>
                    <td className="p-2">
                      <div className="text-sm text-slate-600 font-medium">{op.workstation_name || 'N/A'}</div>
                    </td>
                    <td className="p-2 text-center">
                      <div className="text-sm  text-slate-700">{op.std_time} {op.time_uom}</div>
                    </td>
                    <td className="p-2 text-center">
                      <div className="text-sm  text-indigo-600">₹{op.hourly_rate ? parseFloat(op.hourly_rate).toFixed(2) : '0.00'}</div>
                    </td>
                    <td className="p-2 text-center">
                      <StatusBadge status={op.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(op)} 
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(op)} 
                          className={`p-2 ${op.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'} rounded-lg transition-colors`} 
                          title={op.is_active ? 'Disable' : 'Enable'}
                        >
                          {op.is_active ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button 
                          onClick={() => handleDelete(op)} 
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
