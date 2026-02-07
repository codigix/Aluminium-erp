import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  ClipboardList, Activity, CheckCircle, TrendingUp, 
  Play, Check, Edit2, Trash2, Search, Filter,
  Clock, Package, User, Monitor, AlertCircle, ChevronDown, ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

const JobCard = () => {
  const [searchParams] = useSearchParams();
  const [jobCards, setJobCards] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [operations, setOperations] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [previewDrawing, setPreviewDrawing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWOs, setExpandedWOs] = useState(new Set());

  const [formData, setFormData] = useState({
    jcNumber: '',
    workOrderId: '',
    operationId: '',
    workstationId: '',
    assignedTo: '',
    plannedQty: 0,
    remarks: ''
  });

  const calculateEfficiency = (jc) => {
    if (!jc.start_time || jc.status === 'PENDING') return 0;
    const startTime = new Date(jc.start_time);
    const endTime = jc.end_time ? new Date(jc.end_time) : new Date();
    const actualTimeMinutes = (endTime - startTime) / (1000 * 60);
    if (actualTimeMinutes <= 0) return 0;
    
    let stdTimeInMinutes = parseFloat(jc.std_time || 0);
    if (jc.time_uom === 'Hr') stdTimeInMinutes *= 60;
    else if (jc.time_uom === 'Sec') stdTimeInMinutes /= 60;
    
    const totalStdTime = stdTimeInMinutes * parseFloat(jc.accepted_qty || 0);
    return Math.round((totalStdTime / actualTimeMinutes) * 100);
  };

  useEffect(() => {
    fetchJobCards();
    fetchWorkOrders();
    fetchOperations();
    fetchWorkstations();
    fetchUsers();

    const filterWO = searchParams.get('filter_work_order');
    if (filterWO) {
      setSearchQuery(filterWO);
    }
  }, []);

  const fetchJobCards = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobCards(data);
        
        const filterWO = searchParams.get('filter_work_order');
        if (filterWO) {
          const targetJC = data.find(jc => jc.wo_number === filterWO);
          if (targetJC) {
            setExpandedWOs(new Set([String(targetJC.work_order_id)]));
          }
        } else {
          setExpandedWOs(new Set());
        }
      }
    } catch (error) {
      console.error('Error fetching job cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  };

  const fetchOperations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/operations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      }
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  };

  const fetchWorkstations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/workstations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkstations(data);
      }
    } catch (error) {
      console.error('Error fetching workstations:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const toggleWO = (woId) => {
    const id = String(woId);
    const newExpanded = new Set(expandedWOs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedWOs(newExpanded);
  };

  const filteredJobCards = useMemo(() => {
    // Show Job Cards for Finished Goods (FG) only, exclude Sub-Assemblies (SA)
    const allowedSourceTypes = ['FG'];
    const filteredBySource = jobCards.filter(jc => allowedSourceTypes.includes(jc.source_type));
    
    if (!searchQuery) return filteredBySource;
    const query = searchQuery.toLowerCase();
    return filteredBySource.filter(jc => 
      jc.jc_number?.toLowerCase().includes(query) ||
      jc.wo_number?.toLowerCase().includes(query) ||
      jc.operation_name?.toLowerCase().includes(query) ||
      jc.operator_name?.toLowerCase().includes(query)
    );
  }, [jobCards, searchQuery]);

  const groupedJobCards = useMemo(() => {
    return filteredJobCards.reduce((acc, jc) => {
      const woId = String(jc.work_order_id);
      if (!acc[woId]) {
        acc[woId] = {
          id: woId,
          wo_number: jc.wo_number,
          item_name: jc.item_name,
          priority: jc.priority,
          wo_quantity: jc.wo_quantity,
          wo_status: jc.wo_status,
          wo_end_date: jc.wo_end_date,
          source_type: jc.source_type,
          cards: []
        };
      }
      acc[woId].cards.push(jc);
      return acc;
    }, {});
  }, [filteredJobCards]);

  const stats = useMemo(() => {
    const allowedSourceTypes = ['FG'];
    const filteredBySource = jobCards.filter(jc => allowedSourceTypes.includes(jc.source_type));
    const total = filteredBySource.length;
    const inProduction = filteredBySource.filter(jc => jc.status === 'IN_PROGRESS').length;
    const completed = filteredBySource.filter(jc => jc.status === 'COMPLETED').length;
    const activeWOs = new Set(filteredBySource.filter(jc => jc.status !== 'COMPLETED').map(jc => jc.work_order_id)).size;
    const totalEfficiency = filteredBySource.length > 0 
      ? Math.round(filteredBySource.reduce((acc, jc) => acc + calculateEfficiency(jc), 0) / filteredBySource.length) 
      : 0;

    return [
      { label: 'Total Operations', value: total, subValue: `${activeWOs} Active Work Orders`, icon: ClipboardList, color: 'indigo' },
      { label: 'In Production', value: inProduction, subValue: '+12% Current Throughput', icon: Activity, color: 'amber' },
      { label: 'Completed', value: completed, subValue: '+5% Finalized Today', icon: CheckCircle, color: 'emerald' },
      { label: 'Efficiency', value: `${totalEfficiency}%`, subValue: 'Completion Rate', icon: TrendingUp, color: 'purple' }
    ];
  }, [jobCards]);

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedJC, setSelectedJC] = useState(null);
  const [progressData, setProgressData] = useState({
    producedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    remarks: ''
  });

  const handleLogProgress = (jc) => {
    setSelectedJC(jc);
    setProgressData({
      producedQty: 0,
      acceptedQty: 0,
      rejectedQty: 0,
      remarks: jc.remarks || ''
    });
    setIsProgressModalOpen(true);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('authToken');
      const payload = { status };
      if (status === 'IN_PROGRESS') payload.startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (status === 'COMPLETED') payload.endTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const response = await fetch(`${API_BASE}/job-cards/${id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast(`Job Card status: ${status}`);
        fetchJobCards();
      }
    } catch (error) {
      errorToast('Failed to update status');
    }
  };

  const submitProgress = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        producedQty: parseFloat(selectedJC.produced_qty || 0) + parseFloat(progressData.producedQty),
        acceptedQty: parseFloat(selectedJC.accepted_qty || 0) + parseFloat(progressData.acceptedQty),
        rejectedQty: parseFloat(selectedJC.rejected_qty || 0) + parseFloat(progressData.rejectedQty),
        remarks: progressData.remarks
      };

      if (progressData.markCompleted) {
        payload.status = 'COMPLETED';
        payload.endTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }

      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast(progressData.markCompleted ? 'Operation completed successfully' : 'Progress logged successfully');
        setIsProgressModalOpen(false);
        fetchJobCards();
      }
    } catch (error) {
      errorToast('Failed to log progress');
    }
  };

  const handleCreateNew = () => {
    setFormData({
      id: null,
      jcNumber: `JC-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(jobCards.length + 1).toString().padStart(3, '0')}`,
      workOrderId: '',
      operationId: '',
      workstationId: '',
      assignedTo: '',
      plannedQty: 0,
      remarks: ''
    });
    setSelectedWO(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/job-cards/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast('Job Card deleted successfully');
          fetchJobCards();
        } else {
          errorToast('Failed to delete Job Card');
        }
      }
    } catch (error) {
      errorToast('Network error');
    }
  };

  const handleEdit = (jc) => {
    setFormData({
      id: jc.id,
      jcNumber: jc.job_card_no,
      workOrderId: jc.work_order_id,
      operationId: jc.operation_id,
      workstationId: jc.workstation_id,
      assignedTo: jc.assigned_to,
      plannedQty: jc.planned_qty,
      remarks: jc.remarks || ''
    });
    const wo = workOrders.find(w => String(w.id) === String(jc.work_order_id));
    setSelectedWO(wo);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const isEdit = formData.id;
      const url = isEdit ? `${API_BASE}/job-cards/${formData.id}` : `${API_BASE}/job-cards`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        successToast(`Job Card ${isEdit ? 'updated' : 'created'} successfully`);
        setIsModalOpen(false);
        fetchJobCards();
      } else {
        const error = await response.json();
        errorToast(error.error || `Failed to ${isEdit ? 'update' : 'create'} Job Card`);
      }
    } catch (error) {
      errorToast('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-[28px]">Job Cards</h1>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100 uppercase tracking-wider">
                Live Operations
              </span>
            </div>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Manufacturing Intelligence <ChevronRight className="w-3 h-3 inline mx-1" /> <span className="text-indigo-600">Operational Controls</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">System Status</span>
            <span className="text-sm font-bold text-slate-900">{new Date().toLocaleTimeString()}</span>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-bold text-sm">
            <Trash2 className="w-4 h-4" />
            Reset Queue
          </button>
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-sm shadow-lg shadow-slate-200"
          >
            <Play className="w-4 h-4" />
            Create Job Card
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <p className="text-[10px] font-medium text-slate-400 mt-1">
                  {stat.subValue}
                </p>
              </div>
              <div className={`w-14 h-14 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-7 h-7" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by Work Order ID or Item name..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
          <Filter className="w-4 h-4" />
          All Operational States
          <ChevronDown className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Grouped Content */}
      <div className="space-y-6">
        {Object.values(groupedJobCards).map((group) => {
          const isExpanded = expandedWOs.has(String(group.id));
          return (
            <div key={group.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              {/* Group Header */}
              <div 
                className={`px-8 py-6 flex items-center justify-between cursor-pointer group transition-colors ${
                  isExpanded ? 'bg-slate-50/50 border-b border-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => toggleWO(group.id)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 transition-all">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-slate-900">{group.item_name || 'Project Item'}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${
                        group.wo_status === 'RELEASED' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        group.wo_status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        group.wo_status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        'bg-white text-slate-500 border-slate-200'
                      }`}>
                        {group.wo_status || 'draft'}
                      </span>
                      {group.source_type === 'SA' && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-bold rounded uppercase tracking-wider">
                          Sub-Assembly
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{group.wo_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <div className="hidden md:block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Priority Level</p>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      group.priority === 'HIGH' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {group.priority || 'medium'}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Quantity</p>
                    <p className="text-sm font-bold text-slate-900">{group.wo_quantity} <span className="text-slate-400 font-medium">Units</span></p>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Scheduled End</p>
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-bold">
                        {group.wo_end_date ? new Date(group.wo_end_date).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                  <div className={`p-2 rounded-xl bg-indigo-50 text-indigo-600 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Operations List */}
              {isExpanded && (
                <div className="p-8 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="col-span-4">Operational Phase</div>
                    <div className="col-span-2">Assignment</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Metrics</div>
                    <div className="col-span-2 text-right pr-4">Action</div>
                  </div>

                  {group.cards.map((jc) => {
                    const efficiency = calculateEfficiency(jc);
                    return (
                      <div key={jc.id} className="grid grid-cols-12 items-center bg-slate-50/30 hover:bg-slate-50 border border-slate-100/50 rounded-2xl p-6 transition-all group/row">
                        {/* Operation Name */}
                        <div className="col-span-4 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            jc.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 
                            jc.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 border border-slate-200'
                          }`}>
                            <Activity className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 group-hover/row:text-indigo-600 transition-colors">
                              {jc.operation_name}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {jc.job_card_no || `JC-${jc.id.toString().padStart(4, '0')}`}
                            </p>
                          </div>
                        </div>

                        {/* Assignment */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-bold text-slate-600">
                              {jc.operator_name || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Monitor className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] font-medium text-slate-400">
                              {jc.workstation_name || 'Unassigned'}
                            </span>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              jc.status === 'IN_PROGRESS' ? 'bg-indigo-500 animate-pulse' :
                              jc.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}></div>
                            <span className="px-2 py-0.5 bg-white text-slate-500 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">
                              {jc.status?.toLowerCase() || 'draft'}
                            </span>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</span>
                            <span className={`text-[10px] font-bold ${efficiency >= 80 ? 'text-emerald-500' : efficiency >= 50 ? 'text-amber-500' : 'text-slate-400'}`}>
                              {efficiency}%
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-bold text-slate-900">{parseFloat(jc.produced_qty || 0).toFixed(2)}</span>
                            <span className="text-[10px] font-medium text-slate-400">/ {parseFloat(jc.planned_qty || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          {jc.status === 'PENDING' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(jc.id, 'IN_PROGRESS'); }}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-bold text-xs group/btn shadow-sm"
                            >
                              <Play className="w-3.5 h-3.5 group-hover/btn:fill-current" />
                              Start
                            </button>
                          )}
                          {jc.status === 'IN_PROGRESS' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLogProgress(jc); }}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all font-bold text-xs group/btn shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Update
                            </button>
                          )}
                          <button 
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            onClick={(e) => { e.stopPropagation(); handleEdit(jc); }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            onClick={(e) => { e.stopPropagation(); handleDelete(jc.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Existing Modals */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={formData.id ? "Edit Job Card" : "Create Job Card"}
      >
        <form onSubmit={handleSubmit} className="space-y-6 p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormControl label="Job Card Number">
              <input 
                type="text" 
                value={formData.jcNumber} 
                disabled 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 uppercase tracking-widest cursor-not-allowed"
              />
            </FormControl>
            <FormControl label="Work Order" required>
              <select 
                value={formData.workOrderId} 
                onChange={(e) => {
                  const wo = workOrders.find(w => String(w.id) === e.target.value);
                  setSelectedWO(wo);
                  setFormData(prev => ({ ...prev, workOrderId: e.target.value, plannedQty: wo?.quantity || 0 }));
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">Select Work Order</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.project_name}</option>
                ))}
              </select>
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormControl label="Operation" required>
              <select 
                value={formData.operationId}
                onChange={(e) => {
                  const op = operations.find(o => String(o.id) === e.target.value);
                  setFormData(prev => ({ ...prev, operationId: e.target.value, workstationId: op?.workstation_id || prev.workstationId }));
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">Select Operation</option>
                {operations.map(op => (
                  <option key={op.id} value={op.id}>{op.operation_name} ({op.operation_code})</option>
                ))}
              </select>
            </FormControl>
            <FormControl label="Workstation">
              <select 
                value={formData.workstationId}
                onChange={(e) => setFormData(prev => ({ ...prev, workstationId: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">Select Workstation</option>
                {workstations.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.workstation_name}</option>
                ))}
              </select>
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormControl label="Operator Name">
              <select 
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              >
                <option value="">Select Operator</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.username})
                  </option>
                ))}
              </select>
            </FormControl>
            <FormControl label="Planned Quantity" required>
              <div className="relative">
                <input 
                  type="number" 
                  value={formData.plannedQty}
                  onChange={(e) => setFormData(prev => ({ ...prev, plannedQty: e.target.value }))}
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unit</span>
              </div>
            </FormControl>
          </div>

          <FormControl label="Job Remarks">
            <textarea 
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none h-24"
              placeholder="Enter specific instructions for the operator..."
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm shadow-lg shadow-indigo-100 uppercase tracking-widest"
            >
              {formData.id ? "Update Job Card" : "Initialize Job Card"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title={`Execution Update - ${selectedJC?.jc_number}`}
      >
        <form onSubmit={submitProgress} className="space-y-6 p-2">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              <span>Operation: {selectedJC?.operation_name}</span>
              <span>Work Order: {selectedJC?.wo_number}</span>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Quantity</p>
                <p className="text-xl font-bold text-slate-900">{selectedJC?.planned_qty} <span className="text-xs text-slate-400 font-medium tracking-normal uppercase">Units</span></p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completed So Far</p>
                <p className="text-xl font-bold text-emerald-600">{Number(selectedJC?.produced_qty || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <FormControl label="Produced" required>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  value={progressData.producedQty}
                  onChange={(e) => setProgressData(prev => ({ ...prev, producedQty: e.target.value }))}
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">TOTAL</span>
              </div>
            </FormControl>
            <FormControl label="Accepted" required>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  value={progressData.acceptedQty}
                  onChange={(e) => setProgressData(prev => ({ ...prev, acceptedQty: e.target.value }))}
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500">GOOD</span>
              </div>
            </FormControl>
            <FormControl label="Rejected">
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  value={progressData.rejectedQty}
                  onChange={(e) => setProgressData(prev => ({ ...prev, rejectedQty: e.target.value }))}
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-rose-600 focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-500">FAIL</span>
              </div>
            </FormControl>
          </div>

          <FormControl label="Production Notes">
            <textarea
              value={progressData.remarks}
              onChange={(e) => setProgressData(prev => ({ ...prev, remarks: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none h-32"
              placeholder="Report any downtime or quality observations..."
            ></textarea>
          </FormControl>

          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <input 
              type="checkbox" 
              id="markCompleted"
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              onChange={(e) => setProgressData(prev => ({ ...prev, markCompleted: e.target.checked }))}
            />
            <label htmlFor="markCompleted" className="text-sm font-bold text-indigo-900 cursor-pointer">
              Mark this operation as COMPLETED
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsProgressModalOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest"
            >
              Dismiss
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-sm shadow-lg shadow-slate-200 uppercase tracking-widest"
            >
              Post Update
            </button>
          </div>
        </form>
      </Modal>

      <DrawingPreviewModal 
        isOpen={!!previewDrawing}
        onClose={() => setPreviewDrawing(null)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default JobCard;


