import React, { useState, useEffect, useCallback } from 'react';
import { Card, StatusBadge, FormControl, Modal, DataTable, Badge } from '../components/ui.jsx';
import { Search, Plus, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

const WorkstationMaster = ({ showForm, setShowForm }) => {
  const [workstations, setWorkstations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    workstation_code: '',
    workstation_name: '',
    location: '',
    department: 'Production',
    capacity_per_hour: 0,
    target_utilization: 80,
    hourly_rate: 0,
    workstation_type: 'CNC Machine',
    equipment_code: '',
    maintenance_frequency: 'Monthly',
    last_maintenance_date: '',
    assigned_operators: '',
    description: '',
    status: 'Active'
  });

  const equipmentTypes = ['CNC Machine', 'Assembly Line', 'Welding Station', 'Manual Station', 'QC Station', 'Other'];
  const departments = ['Production', 'Maintenance', 'Quality', 'Inventory', 'Design Engineering'];
  const maintenanceFrequencies = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

  const fetchWorkstations = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/workstations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch workstations');
      const data = await response.json();
      setWorkstations(data);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load workstations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNextCode = useCallback(async () => {
    if (isEditing) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/workstations/next-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch next code');
      const data = await response.json();
      setFormData(prev => ({ ...prev, workstation_code: data.nextCode }));
    } catch (error) {
      console.error(error);
    }
  }, [isEditing]);

  useEffect(() => {
    fetchWorkstations();
    fetchNextCode();
    
    const handleRefresh = () => fetchWorkstations();
    window.addEventListener('refreshWorkstations', handleRefresh);
    return () => window.removeEventListener('refreshWorkstations', handleRefresh);
  }, [fetchWorkstations, fetchNextCode]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'Active' : 'Inactive') : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const url = isEditing ? `${API_BASE}/workstations/${editingId}` : `${API_BASE}/workstations`;
      const method = isEditing ? 'PUT' : 'POST';

      // Ensure empty date is sent as null
      const payload = {
        ...formData,
        last_maintenance_date: formData.last_maintenance_date || null
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save workstation');
      }

      successToast(`Workstation ${isEditing ? 'updated' : 'created'} successfully`);
      resetForm();
      fetchWorkstations();
      setShowForm(false);
    } catch (error) {
      errorToast(error.message);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      workstation_code: '',
      workstation_name: '',
      location: '',
      department: 'Production',
      capacity_per_hour: 0,
      target_utilization: 80,
      hourly_rate: 0,
      workstation_type: 'CNC Machine',
      equipment_code: '',
      maintenance_frequency: 'Monthly',
      last_maintenance_date: '',
      assigned_operators: '',
      description: '',
      status: 'Active'
    });
    fetchNextCode();
  };

  const handleEdit = (ws) => {
    setFormData({
      workstation_code: ws.workstation_code,
      workstation_name: ws.workstation_name,
      location: ws.location || '',
      department: ws.department || 'Production',
      capacity_per_hour: ws.capacity_per_hour || 0,
      target_utilization: ws.target_utilization || 80,
      hourly_rate: ws.hourly_rate || 0,
      workstation_type: ws.workstation_type || 'CNC Machine',
      equipment_code: ws.equipment_code || '',
      maintenance_frequency: ws.maintenance_frequency || 'Monthly',
      last_maintenance_date: ws.last_maintenance_date ? ws.last_maintenance_date.split('T')[0] : '',
      assigned_operators: ws.assigned_operators || '',
      description: ws.description || '',
      status: ws.status || 'Active'
    });
    setEditingId(ws.id);
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete workstation: ${name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/workstations/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete workstation');
        successToast('Workstation has been deleted.');
        fetchWorkstations();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const columns = [
    { 
      label: 'ID Code', 
      key: 'workstation_code', 
      sortable: true,
      render: (val) => <span className=" text-indigo-600 font-mono">{val}</span>
    },
    { 
      label: 'Workstation / Location', 
      key: 'workstation_name', 
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-medium text-slate-900">{val}</div>
          <div className="text-[10px] text-slate-400">{row.location}</div>
        </div>
      )
    },
    { 
      label: 'Classification', 
      key: 'workstation_type',
      render: (val, row) => (
        <div>
          <Badge variant="info">{val}</Badge>
          <div className="text-[10px] text-slate-400 mt-1">{row.department}</div>
        </div>
      )
    },
    { 
      label: 'Metric (Units/hr)', 
      key: 'capacity_per_hour',
      render: (val) => <span className="text-slate-600 font-medium">{val} units/hr</span>
    },
    { 
      label: 'Hourly Rate', 
      key: 'hourly_rate',
      render: (val) => <span className="text-emerald-600 ">₹{val}</span>
    },
    { 
      label: 'Target', 
      key: 'target_utilization',
      render: (val) => <span className="text-amber-600 font-medium">{val}%</span>
    },
    { 
      label: 'Status', 
      key: 'status',
      render: (val) => (
        <Badge variant={val === 'Active' ? 'success' : 'danger'}>
          {val}
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
            title="Edit Workstation"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDelete(row.id, row.workstation_name)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Workstation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      <Modal isOpen={showForm} onClose={() => { resetForm(); setShowForm(false); }} title={isEditing ? "Edit Workstation" : "Create Workstation"}>
        <form onSubmit={handleSubmit} className="space-y-3">
            {/* Basic Information */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm">📋</span>
                <h3 className="text-sm  text-slate-500">Basic Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormControl label="Workstation ID *">
                  <input
                    type="text"
                    name="workstation_code"
                    value={formData.workstation_code}
                    onChange={handleInputChange}
                    placeholder="e.g., WS-001"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                    required
                  />
                </FormControl>
                <FormControl label="Workstation Name *">
                  <input
                    type="text"
                    name="workstation_name"
                    value={formData.workstation_name}
                    onChange={handleInputChange}
                    placeholder="e.g., Assembly Line 1"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                    required
                  />
                </FormControl>
                <FormControl label="Location">
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., Building A, Floor 2"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  />
                </FormControl>
                <FormControl label="Department">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  >
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </FormControl>
              </div>
            </section>

            {/* Capacity & Performance */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm">⚙️</span>
                <h3 className="text-sm  text-slate-500">Capacity & Performance</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormControl label="Capacity (units/hour)">
                  <input
                    type="number"
                    name="capacity_per_hour"
                    value={formData.capacity_per_hour}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  />
                </FormControl>
                <FormControl label="Target Utilization (%)">
                  <input
                    type="number"
                    name="target_utilization"
                    value={formData.target_utilization}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  />
                </FormControl>
                <FormControl label="Hourly Rate (₹)">
                  <input
                    type="number"
                    name="hourly_rate"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={handleInputChange}
                    placeholder="e.g., 500.00"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  />
                </FormControl>
              </div>
            </section>

            {/* Equipment Information */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm">🔧</span>
                <h3 className="text-sm  text-slate-500">Equipment Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormControl label="Equipment Type">
                  <select
                    name="workstation_type"
                    value={formData.workstation_type}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  >
                    {equipmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormControl>
                <FormControl label="Equipment Code/Reference">
                  <input
                    type="text"
                    name="equipment_code"
                    value={formData.equipment_code}
                    onChange={handleInputChange}
                    placeholder="e.g., EQ-12345"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  />
                </FormControl>
              </div>
            </section>

            {/* Maintenance Schedule */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-sm">🛠️</span>
                <h3 className="text-sm  text-slate-500">Maintenance Schedule</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormControl label="Maintenance Frequency">
                  <select
                    name="maintenance_frequency"
                    value={formData.maintenance_frequency}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  >
                    {maintenanceFrequencies.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </FormControl>
                <FormControl label="Last Maintenance Date">
                  <input
                    type="date"
                    name="last_maintenance_date"
                    value={formData.last_maintenance_date}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                  />
                </FormControl>
              </div>
            </section>

            {/* Operations & Assignment */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-sm">👥</span>
                <h3 className="text-sm  text-slate-500">Operations & Assignment</h3>
              </div>
              <FormControl label="Assigned Operators">
                <input
                  type="text"
                  name="assigned_operators"
                  value={formData.assigned_operators}
                  onChange={handleInputChange}
                  placeholder="Comma-separated operator names or IDs (e.g., OP-001, OP-002)"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                />
              </FormControl>
            </section>

            {/* Details & Notes */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm">📝</span>
                <h3 className="text-sm  text-slate-500">Details & Notes</h3>
              </div>
              <FormControl label="Description">
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Detailed description of the workstation, equipment specifications, etc."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                ></textarea>
              </FormControl>
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 w-fit">
                <input
                  type="checkbox"
                  name="status"
                  id="activeStatus"
                  checked={formData.status === 'Active'}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="activeStatus" className="text-sm  text-slate-700">Active Status</label>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-8 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm  text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm  shadow-lg shadow-cyan-100 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {isEditing ? 'Update Workstation' : 'Save Workstation'}
              </button>
            </div>
          </form>
      </Modal>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
            <RefreshCw className={`w-6 h-6 text-white ${loading ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h1 className="text-2xl  text-slate-900">Workstation Master</h1>
            <p className="text-slate-500 text-sm">Manage production floor workstations and equipment</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-200 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Workstation
        </button>
      </div>

      {/* List Section */}
      <Card className="overflow-hidden border-none shadow-xl bg-white/50 backdrop-blur-sm">
        <DataTable
          columns={columns}
          data={workstations}
          loading={loading}
          searchPlaceholder="Search workstations, locations, or types..."
          searchKey="workstation_name"
        />
      </Card>
    </div>
  );
};

export default WorkstationMaster;

