import React, { useState, useEffect } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const OperationMaster = () => {
  const [workstations, setWorkstations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    workstation_code: '',
    workstation_name: '',
    workstation_type: 'Machine',
    department: 'Production',
    capacity_type: 'Hour',
    hourly_rate: 0,
    status: 'Active'
  });

  const workstationTypes = ['Machine', 'Manual', 'Assembly', 'QC', 'Other'];
  const departments = ['Production', 'Design Engineering', 'Quality', 'Maintenance', 'Store'];
  const capacityTypes = ['Hour', 'Unit', 'Shift', 'Batch'];
  const statuses = ['Active', 'Inactive', 'Maintenance'];

  useEffect(() => {
    fetchWorkstations();
  }, []);

  const fetchWorkstations = async () => {
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
  };

  const fetchNextCode = async () => {
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
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        throw new Error(errorData.message || 'Failed to save operation');
      }

      Swal.fire('Success', `Operation ${isEditing ? 'updated' : 'created'} successfully`, 'success');
      setShowForm(false);
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        workstation_code: '',
        workstation_name: '',
        workstation_type: 'Machine',
        department: 'Production',
        capacity_type: 'Hour',
        hourly_rate: 0,
        status: 'Active'
      });
      fetchWorkstations();
      if (!isEditing) fetchNextCode();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleEdit = (ws) => {
    setFormData({
      workstation_code: ws.workstation_code,
      workstation_name: ws.workstation_name,
      workstation_type: ws.workstation_type,
      department: ws.department,
      capacity_type: ws.capacity_type,
      hourly_rate: ws.hourly_rate,
      status: ws.status
    });
    setEditingId(ws.id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete operation: ${name}`,
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
        if (!response.ok) throw new Error('Failed to delete operation');
        Swal.fire('Deleted!', 'Operation has been deleted.', 'success');
        fetchWorkstations();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredWorkstations = workstations.filter(ws => 
    ws.workstation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ws.workstation_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-indigo-100 rounded-lg text-indigo-600">🏭</span>
            Operation Master
          </h1>
          <p className="text-sm text-slate-500 ml-10">Manage factory operations and machine capacities</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setShowForm(true);
              setIsEditing(false);
              setFormData({
                workstation_code: '',
                workstation_name: '',
                workstation_type: 'Machine',
                department: 'Production',
                capacity_type: 'Hour',
                hourly_rate: 0,
                status: 'Active'
              });
              fetchNextCode();
            }} 
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
          >
            <span>+ Add Operation</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
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
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type / Dept</th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Capacity</th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hourly Rate</th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400">Loading operations...</td></tr>
                ) : filteredWorkstations.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400 italic">No operations found</td></tr>
                ) : (
                  filteredWorkstations.map((ws) => (
                    <tr key={ws.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">{ws.workstation_code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900">{ws.workstation_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600 font-medium">{ws.workstation_type}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{ws.department}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-bold text-slate-700">Per {ws.capacity_type}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-bold text-indigo-600">₹{parseFloat(ws.hourly_rate).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={ws.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(ws)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">✏️</button>
                          <button onClick={() => handleDelete(ws.id, ws.workstation_name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">🗑️</button>
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

      {showForm && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all border border-slate-200">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-xs">🏭</span>
                  {isEditing ? 'Edit Operation' : 'Add New Operation'}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Code *</label>
                    <input 
                      type="text" 
                      name="workstation_code"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      placeholder="e.g., OP-VMC-01"
                      value={formData.workstation_code}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Name *</label>
                    <input 
                      type="text" 
                      name="workstation_name"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      placeholder="e.g., VMC Machining Center"
                      value={formData.workstation_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operation Type</label>
                    <select 
                      name="workstation_type"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      value={formData.workstation_type}
                      onChange={handleInputChange}
                    >
                      {workstationTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                    <select 
                      name="department"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      value={formData.department}
                      onChange={handleInputChange}
                    >
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Capacity Type</label>
                    <select 
                      name="capacity_type"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      value={formData.capacity_type}
                      onChange={handleInputChange}
                    >
                      {capacityTypes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hourly Rate (₹)</label>
                    <input 
                      type="number" 
                      name="hourly_rate"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      placeholder="800"
                      value={formData.hourly_rate}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                    <select 
                      name="status"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {isEditing ? 'Update Operation' : 'Save Operation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationMaster;
