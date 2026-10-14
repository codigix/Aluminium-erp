import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, StatusBadge, FormControl, Modal, DataTable, Badge, SearchableSelect } from '../components/ui.jsx';
import { Search, Plus, RefreshCw, Edit2, Trash2, Eye } from 'lucide-react';
import WorkstationScheduleView from './WorkstationScheduleView.jsx';
import WorkstationList from './WorkstationList.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const WorkstationMaster = ({ showForm: propShowForm, setShowForm: propSetShowForm }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [searchParams] = useSearchParams();
  const [workstations, setWorkstations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewingWorkstation, setViewingWorkstation] = useState(null);
  const [overview, setOverview] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [showFormInternal, setShowFormInternal] = useState(false);
  const showForm = propShowForm !== undefined ? propShowForm : showFormInternal;
  const setShowForm = propSetShowForm || setShowFormInternal;

  useEffect(() => {
    const isFormPath = location.pathname.includes('/workstation-master/form');
    const id = searchParams.get('id');

    if (isFormPath) {
      if (id) {
        if (!isEditing || String(editingId) !== String(id)) {
          const ws = workstations.find(w => String(w.id) === String(id));
          if (ws) {
            handleEdit(ws);
          }
        }
      } else {
        if (isEditing || !showForm) {
          resetForm();
          setShowForm(true);
        }
      }
    } else if (showForm) {
      resetForm();
      setShowForm(false);
    }
  }, [location.pathname, searchParams, workstations]);

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
      // Live state per machine; if it cannot be loaded the list still shows the machine details
      try {
        const live = await fetch(`${API_BASE}/workstations/overview`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (live.ok) {
          const rows = await live.json();
          setOverview(Object.fromEntries(rows.map(r => [r.id, r])));
        } else {
          setOverview({});
        }
      } catch (e) {
        setOverview({});
      }
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
    if (!location.pathname.includes('/workstation-master/form')) {
      navigate(`/workstation-master/form?id=${ws.id}`);
    }
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
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message || body.error || 'Failed to delete workstation');
        }
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
      render: (val) => <span className=" text-indigo-600  ">{val}</span>
    },
    {
      label: 'Workstation / Location',
      key: 'workstation_name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-slate-900">{val}</div>
          <div className="text-xs text-slate-400">{row.location}</div>
        </div>
      )
    },
    {
      label: 'Target',
      key: 'target_utilization',
      render: (val) => <span className="text-amber-600 ">{val}%</span>
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
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setViewingWorkstation(row)}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded  transition-colors"
            title="View availability & schedule"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded  transition-colors"
            title="Edit Workstation"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id, row.workstation_name)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded  transition-colors"
            title="Delete Workstation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="">
      <Modal
        isOpen={Boolean(viewingWorkstation)}
        onClose={() => setViewingWorkstation(null)}
        title={viewingWorkstation ? `Availability & Schedule — ${viewingWorkstation.workstation_name}` : ''}
        size="7xl"
      >
        {viewingWorkstation && <WorkstationScheduleView workstationId={viewingWorkstation.id} />}
      </Modal>

      <Modal isOpen={showForm} onClose={() => { navigate(`${deptPrefix}/workstation-master`); }} title={isEditing ? "Edit Workstation" : "Create Workstation"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Basic Information */}
          <section className="space-y-2">
            <div className="flex items-center gap-2  border-b border-slate-100 pb-3">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded  text-xs">📋</span>
              <h3 className="text-xs  text-slate-500">Basic Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                <SearchableSelect
                  options={Array.from(new Set(workstations.map(ws => ws.workstation_name))).map(name => ({
                    label: name,
                    value: name
                  }))}
                  value={formData.workstation_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, workstation_name: e.target.value }))}
                  placeholder="e.g., Assembly Line 1"
                  allowCustom={true}
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-8 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { navigate(`${deptPrefix}/workstation-master`); }}
              className="p-2 rounded  border border-slate-200 text-sm  text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 rounded  bg-cyan-500 hover:bg-cyan-600 text-white text-sm  shadow-lg shadow-cyan-100 transition-all flex items-center gap-2 "
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {isEditing ? 'Update Workstation' : 'Save Workstation'}
            </button>
          </div>
        </form>
      </Modal>

      <WorkstationList
        workstations={workstations}
        overview={overview}
        loading={loading}
        onNew={() => { navigate(`${deptPrefix}/workstation-master/form`); }}
        onRefresh={fetchWorkstations}
        onSchedule={(w) => setViewingWorkstation(w)}
        onEdit={(w) => handleEdit(w)}
        onDelete={(w) => handleDelete(w.id, w.workstation_name)}
      />

    </div>
  );
};

export default WorkstationMaster;

