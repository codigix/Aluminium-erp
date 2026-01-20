import React, { useState, useEffect, useCallback } from 'react';
import { Card, StatusBadge, FormControl, Modal } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const WorkstationMaster = ({ showForm, setShowForm }) => {
  const [workstations, setWorkstations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
      Swal.fire('Error', 'Failed to load workstations', 'error');
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
        throw new Error(errorData.message || 'Failed to save workstation');
      }

      Swal.fire('Success', `Workstation ${isEditing ? 'updated' : 'created'} successfully`, 'success');
      resetForm();
      fetchWorkstations();
      setShowForm(false);
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
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
        Swal.fire('Deleted!', 'Workstation has been deleted.', 'success');
        fetchWorkstations();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredWorkstations = workstations.filter(ws =>
    ws.workstation_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ws.workstation_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* List Section */}
      <Card>
        <div className=" p-2 rounded-t-[32px] mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-800/50 rounded-lg">
              <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg  ">Workstation Inventory</h2>
              <p className="text-indigo-900 text-xs mt-1">Total {workstations.length} workstations configured</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Workstation
            </button>
            <div className="relative w-64">
              <span className="absolute left-3 top-2.5 text-indigo-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search inventory..."
                className="w-full pl-10 p-2  border border-indigo-700/50 rounded-md text-xs  placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">ID Code</th>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">Workstation / Location</th>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">Classification</th>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">Metric (Units/hr)</th>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">Hourly Rate</th>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">Target</th>
                <th className="p-2 text-left text-xs  text-slate-400  tracking-widest">Status</th>
                <th className="p-2 text-left text-xs text-slate-400  tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="7" className="px-8 py-12 text-center text-slate-400 animate-pulse font-medium">Fetching records...</td></tr>
              ) : filteredWorkstations.length === 0 ? (
                <tr><td colSpan="7" className="px-8 py-12 text-center text-slate-400 italic">No records found matching your criteria</td></tr>
              ) : (
                filteredWorkstations.map((ws) => (
                  <tr key={ws.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="p-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px]  group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-200/50  tracking-tighter">
                        {ws.workstation_code}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="text-xs text-slate-900">{ws.workstation_name}</div>
                      <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {ws.location || 'N/A'}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="text-xs text-slate-700 ">{ws.workstation_type}</div>
                      <div className="text-xs text-slate-400">{ws.department}</div>
                    </td>
                    <td className="p-2 text-left">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs  border border-emerald-100">
                        {ws.capacity_per_hour}
                      </div>
                    </td>
                    <td className="p-2 text-left  text-indigo-600 text-xs">
                      ₹{ws.hourly_rate ? parseFloat(ws.hourly_rate).toFixed(2) : '0.00'}
                    </td>
                    <td className="p-2 text-left  text-indigo-600 text-xs">
                      {ws.target_utilization}%
                    </td>
                    <td className="p-2 text-left">
                      <StatusBadge status={ws.status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(ws)} 
                          className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100" 
                          title="Edit Configuration"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(ws.id, ws.workstation_name)} 
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100" 
                          title="Remove Record"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default WorkstationMaster;
