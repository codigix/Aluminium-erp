import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  ClipboardList, Activity, CheckCircle, TrendingUp, 
  Play, Check, Edit2, Trash2, Search, Filter,
  Clock, Package, User, Monitor, AlertCircle, ChevronDown, ChevronRight,
  DollarSign, Zap, Eye
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

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
    if (!jc || !jc.start_time || jc.status === 'PENDING') return 0;
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
    // Show Job Cards for Finished Goods (FG) and Sub-Assemblies (SA)
    const allowedSourceTypes = ['FG', 'SA', 'SFG', 'Sub Assembly', 'Finished Goods'];
    const filteredBySource = jobCards.filter(jc => allowedSourceTypes.includes(jc.source_type));
    
    if (!searchQuery) return filteredBySource;
    const query = searchQuery.toLowerCase();
    return filteredBySource.filter(jc => 
      jc.job_card_no?.toLowerCase().includes(query) ||
      jc.wo_number?.toLowerCase().includes(query) ||
      jc.operation_name?.toLowerCase().includes(query) ||
      jc.operator_name?.toLowerCase().includes(query)
    );
  }, [jobCards, searchQuery]);

  const groupedJobCards = useMemo(() => {
    const acc = {};
    const allowedSourceTypes = ['FG', 'SA', 'SFG', 'Sub Assembly', 'Finished Goods'];
    const query = searchQuery.toLowerCase();

    // 1. Initialize from Work Orders to show headers even with 0 JCs
    workOrders.forEach(wo => {
      if (!allowedSourceTypes.includes(wo.source_type)) return;
      
      const matchesSearch = !searchQuery || 
        wo.wo_number?.toLowerCase().includes(query) ||
        wo.item_name?.toLowerCase().includes(query);

      if (matchesSearch) {
        acc[wo.id] = {
          id: wo.id,
          wo_number: wo.wo_number,
          item_name: wo.item_name,
          item_code: wo.item_code,
          priority: wo.priority,
          wo_quantity: wo.quantity,
          wo_status: wo.status,
          wo_end_date: wo.end_date,
          source_type: wo.source_type,
          cards: []
        };
      }
    });

    // 2. Map Job Cards to their Work Orders
    filteredJobCards.forEach(jc => {
      const woId = String(jc.work_order_id);
      if (acc[woId]) {
        acc[woId].cards.push(jc);
      } else if (!searchQuery && allowedSourceTypes.includes(jc.source_type)) {
        // Fallback for any JCs whose WO might not be in the current workOrders list
        acc[woId] = {
          id: woId,
          wo_number: jc.wo_number,
          item_name: jc.item_name,
          priority: jc.priority,
          wo_quantity: jc.wo_quantity,
          wo_status: jc.wo_status,
          wo_end_date: jc.wo_end_date,
          source_type: jc.source_type,
          cards: [jc]
        };
      }
    });

    return acc;
  }, [filteredJobCards, workOrders, searchQuery]);

  const stats = useMemo(() => {
    const allowedSourceTypes = ['FG', 'SA', 'SFG', 'Sub Assembly', 'Finished Goods'];
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

  useEffect(() => {
    if (selectedJC && jobCards.length > 0) {
      const updated = jobCards.find(jc => jc.id === selectedJC.id);
      if (updated) setSelectedJC(updated);
    }
  }, [jobCards, selectedJC?.id]);

  const [activeTab, setActiveTab] = useState('time');
  const [viewTab, setViewTab] = useState('timeline');
  const [viewingJobCard, setViewingJobCard] = useState(null);
  const [logs, setLogs] = useState({ timeLogs: [], qualityLogs: [], downtimeLogs: [] });
  const [progressData, setProgressData] = useState({
    producedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    remarks: ''
  });

  const fetchLogs = async (jcId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${jcId}/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const [timeLogForm, setTimeLogForm] = useState({
    logDate: new Date().toISOString().slice(0, 10),
    operatorId: '',
    workstationId: '',
    shift: 'SHIFT_A',
    startTime: '',
    endTime: '',
    producedQty: 0
  });

  const [qualityLogForm, setQualityLogForm] = useState({
    checkDate: new Date().toISOString().slice(0, 10),
    shift: 'SHIFT_A',
    inspectedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    rejectionReason: '',
    notes: '',
    status: 'PENDING'
  });

  const [downtimeLogForm, setDowntimeLogForm] = useState({
    downtimeDate: new Date().toISOString().slice(0, 10),
    shift: 'SHIFT_A',
    downtimeType: '',
    startTime: '',
    endTime: '',
    remarks: ''
  });

  const handleLogProgress = async (jc) => {
    setSelectedJC(jc);
    setActiveTab('time');
    await fetchLogs(jc.id);
    setProgressData({
      producedQty: 0,
      acceptedQty: 0,
      rejectedQty: 0,
      remarks: jc.remarks || ''
    });
    
    // Pre-fill forms
    setTimeLogForm(prev => ({ 
      ...prev, 
      operatorId: jc.assigned_to || '', 
      workstationId: jc.workstation_id || '',
      producedQty: 0
    }));
    setQualityLogForm(prev => ({ ...prev, inspectedQty: 0, acceptedQty: 0, rejectedQty: 0, scrapQty: 0 }));
    setDowntimeLogForm(prev => ({ ...prev, downtimeType: '', remarks: '' }));
    
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
        setIsProgressModalOpen(false);
        fetchJobCards();
      }
    } catch (error) {
      errorToast('Failed to update status');
    }
  };

  const addTimeLog = async (logData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/time-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(logData)
      });
      if (response.ok) {
        successToast('Time log recorded');
        await fetchLogs(selectedJC.id);
        fetchJobCards();
      }
    } catch (error) {
      errorToast('Failed to record time log');
    }
  };

  const addQualityLog = async (logData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/quality-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(logData)
      });
      if (response.ok) {
        successToast('Quality log recorded');
        await fetchLogs(selectedJC.id);
        fetchJobCards();
      }
    } catch (error) {
      errorToast('Failed to record quality log');
    }
  };

  const addDowntimeLog = async (logData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/downtime-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(logData)
      });
      if (response.ok) {
        successToast('Downtime log recorded');
        await fetchLogs(selectedJC.id);
      }
    } catch (error) {
      errorToast('Failed to record downtime log');
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
          <div className="w-12 h-12 bg-indigo-600 text-white rounded  flex items-center justify-center shadow-lg shadow-indigo-100">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl  text-slate-900 tracking-tight text-[28px]">Job Cards</h1>
              <span className="p-2  bg-indigo-50 text-indigo-600 text-xs  rounded  border border-indigo-100  ">
                Live Operations
              </span>
            </div>
            <p className="text-slate-500  text-sm mt-1">
              Manufacturing Intelligence <ChevronRight className="w-3 h-3 inline mx-1" /> <span className="text-indigo-600">Operational Controls</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 p-2  bg-white rounded  border border-slate-200 ">
            <div className="w-2 h-2 bg-emerald-500 rounded  animate-pulse"></div>
            <span className="text-xs  text-slate-500  tracking-widest">System Status</span>
            <span className="text-sm  text-slate-900">{new Date().toLocaleTimeString()}</span>
          </div>
          <button className="flex items-center gap-2  p-2 .5 text-rose-600 hover:bg-rose-50 rounded  transition-all  text-sm">
            <Trash2 className="w-4 h-4" />
            Reset Queue
          </button>
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2  p-2.5 bg-slate-900 text-white rounded  hover:bg-slate-800 transition-all  text-sm shadow-lg shadow-slate-200"
          >
            <Play className="w-4 h-4" />
            Create Job Card
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-[32px] border border-slate-100 p-6 flex items-center justify-between  hover:shadow-md transition-all group">
            <div>
              <p className="text-[10px]  text-slate-400  tracking-widest mb-2">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl  text-slate-900">{stat.value}</p>
              </div>
              <p className="text-[10px]  text-slate-400  tracking-widest mt-2 flex items-center gap-1">
                {stat.subValue}
              </p>
            </div>
            <div className={`w-14 h-14 rounded  flex items-center justify-center transition-all group-hover:scale-110 ${
              stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
              stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
              stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
              'bg-purple-50 text-purple-600'
            }`}>
              <stat.icon className="w-7 h-7" />
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by Work Order ID or Item name..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all "
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2  px-6 py-3 bg-white border border-slate-200 rounded  text-sm  text-slate-600 hover:bg-slate-50 transition-all ">
          <Filter className="w-4 h-4" />
          All Operational States
          <ChevronDown className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Flat Table Layout */}
      <Card className="border-none bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operation</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Execution Type</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty To Manufacture</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Produced Qty</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accepted Qty</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Workstation</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assignee</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobCards.map((jc) => (
                <tr key={jc.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-bold text-indigo-600">
                      {jc.job_card_no}
                    </span>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      WO: {jc.wo_number}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">{jc.operation_name}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{jc.item_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-semibold ${
                      jc.status === 'IN_PROGRESS' ? 'text-amber-600' : 
                      jc.status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {jc.status === 'IN_PROGRESS' ? 'In-Progress' : jc.status?.charAt(0) + jc.status?.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-medium ${jc.workstation_name === 'Subcontract' ? 'text-purple-600' : 'text-blue-600'}`}>
                      {jc.workstation_name === 'Subcontract' ? 'Subcontract' : 'In-house'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-bold text-slate-900">
                      {jc.planned_qty || 0} <span className="text-slate-400 font-normal">units</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-bold text-indigo-600">
                      {parseFloat(jc.produced_qty || 0).toFixed(2)} <span className="text-slate-400 font-normal">units</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-bold text-emerald-600">
                      {parseFloat(jc.accepted_qty || 0).toFixed(2)} <span className="text-slate-400 font-normal">units</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] text-slate-600">
                      {jc.workstation_name || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] text-slate-600">
                      {jc.operator_name || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setViewingJobCard(jc)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-all"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {jc.status !== 'IN_PROGRESS' && jc.status !== 'COMPLETED' && (
                        <button 
                          onClick={() => handleUpdateStatus(jc.id, 'IN_PROGRESS')}
                          className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          title="Start"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {jc.status === 'IN_PROGRESS' && (
                        <button 
                          onClick={() => handleLogProgress(jc)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-all animate-pulse"
                          title="Log Progress"
                        >
                          <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleEdit(jc)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(jc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredJobCards.length === 0 && !loading && (
                <tr>
                  <td colSpan="10" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <p className="text-slate-400 text-sm italic">No job cards found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rows per page:</span>
              <select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer">
                <option>20</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <span className="text-xs text-slate-500 font-medium">
              Page 1 of 1 <span className="text-slate-400 ml-1">({filteredJobCards.length} total)</span>
            </span>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                ← Prev
              </button>
              <button className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors border border-slate-200 rounded-md bg-white shadow-sm">
                Next →
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Job Card View Modal */}
      <Modal
        isOpen={!!viewingJobCard}
        onClose={() => setViewingJobCard(null)}
        title="Operational Intelligence"
        maxWidth="max-w-2xl"
      >
        {viewingJobCard && (
          <div className="space-y-6">
            {/* Header with Operation Name and Progress */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{viewingJobCard.operation_name}</h3>
                  <p className="text-slate-300 text-sm mt-1">Work Order: {viewingJobCard.wo_number}</p>
                </div>
                <span className="text-4xl font-bold text-indigo-300">
                  {viewingJobCard.planned_qty > 0 ? Math.round((parseFloat(viewingJobCard.accepted_qty || 0) / viewingJobCard.planned_qty) * 100) : 0}%
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Planned Capacity</p>
                  <p className="text-xl font-semibold mt-1">{viewingJobCard.planned_qty || 0}.00 <span className="text-sm font-normal text-slate-300">Units</span></p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Accepted Output</p>
                  <p className="text-xl font-semibold mt-1 text-emerald-400">{parseFloat(viewingJobCard.accepted_qty || 0).toFixed(2)} <span className="text-sm font-normal text-slate-300">Units</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Total Produced: {parseFloat(viewingJobCard.produced_qty || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Transferred</p>
                  <p className="text-xl font-semibold mt-1 text-indigo-400">{parseFloat(viewingJobCard.accepted_qty || 0).toFixed(2)} <span className="text-sm font-normal text-slate-300">Units</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Available: {(parseFloat(viewingJobCard.accepted_qty || 0)).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Production Progress</p>
                  <p className="text-xl font-semibold mt-1">
                    {viewingJobCard.planned_qty > 0 ? Math.round((parseFloat(viewingJobCard.produced_qty || 0) / viewingJobCard.planned_qty) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Available: {(parseFloat(viewingJobCard.accepted_qty || 0)).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200">
              {[
                { id: 'timeline', label: 'Operational Timeline', icon: '📅' },
                { id: 'costing', label: 'Costing Details', icon: '📊' },
                { id: 'assignment', label: 'Assignment Data', icon: '👤' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    viewTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {viewTab === 'timeline' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Scheduled Start</p>
                    <p className="text-sm font-semibold text-slate-900">N/A</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Estimated End</p>
                    <p className="text-sm font-semibold text-slate-900">N/A</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Actual Duration</p>
                    <p className="text-sm font-semibold text-slate-900">-</p>
                  </div>
                </div>
              )}

              {viewTab === 'costing' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Hourly Rate</p>
                    <p className="text-sm font-semibold text-slate-900">₹{parseFloat(viewingJobCard.hourly_rate || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Actual Cost</p>
                    <p className="text-sm font-semibold text-indigo-600">₹0.00</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Estimated Cost</p>
                    <p className="text-sm font-semibold text-slate-900">₹0.00</p>
                  </div>
                </div>
              )}

              {viewTab === 'assignment' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Assigned Unit</p>
                    <p className="text-sm font-semibold text-slate-900">{viewingJobCard.workstation_name || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Operator / Vendor</p>
                    <p className="text-sm font-semibold text-slate-900">{viewingJobCard.operator_name || 'Unassigned'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Intelligence Notes */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🧠</span>
                <h4 className="font-semibold text-slate-900">Intelligence Notes</h4>
              </div>
              <p className="text-sm text-amber-700">
                {viewingJobCard.remarks || 'No supplemental operational data recorded for this phase.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                onClick={() => setViewingJobCard(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                ✕ Terminate View
              </button>
              {viewingJobCard.status !== 'COMPLETED' && (
                <button
                  onClick={() => {
                    handleUpdateStatus(viewingJobCard.id, 'COMPLETED');
                    setViewingJobCard(null);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  <span>⚡</span>
                  Transition to completed
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

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
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-400  tracking-widest cursor-not-allowed"
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
                className="w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
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
                className="w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
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
                className="w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
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
                className="w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
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
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2text-xs   text-slate-400  tracking-widest">Unit</span>
              </div>
            </FormControl>
          </div>

          <FormControl label="Job Remarks">
            <textarea 
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              className="w-full p-2  bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500 outline-none h-24"
              placeholder="Enter specific instructions for the operator..."
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="p-2.5 text-sm  text-slate-500 hover:text-slate-700 transition-colors  tracking-widest"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-8 py-2.5 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all  text-sm shadow-lg shadow-indigo-100  tracking-widest"
            >
              {formData.id ? "Update Job Card" : "Initialize Job Card"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title={`Production Entry - ${selectedJC?.job_card_no}`}
        maxWidth="max-w-6xl"
      >
        <div className="space-y-6">
          {/* Header Dashboard info */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg  text-slate-900">{selectedJC?.item_name || 'Target Item'}</h3>
                  <span className="p-1  bg-amber-100 text-amber-700 roundedtext-xs    ">
                    {selectedJC?.status || 'IN_PROGRESS'}
                  </span>
                </div>
                <p className="text-xs  text-slate-400  tracking-widest">{selectedJC?.drawing_no || 'SA-MOUNTINGCLAMPASSEMBLY'}</p>
              </div>
              <div className="flex gap-8">
                <div className="text-right">
                  <p className="text-[10px]  text-slate-400  tracking-widest mb-1">Planned</p>
                  <p className="text-sm  text-slate-900">{selectedJC?.planned_qty} <span className="text-slate-400 ">Units</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]  text-slate-400  tracking-widest mb-1">Produced</p>
                  <p className="text-sm  text-indigo-600">{Number(selectedJC?.produced_qty || 0).toFixed(2)} <span className="text-slate-400 ">Units</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]  text-slate-400  tracking-widest mb-1">Accepted</p>
                  <p className="text-sm  text-emerald-600">{Number(selectedJC?.accepted_qty || 0).toFixed(2)} <span className="text-slate-400 ">Units</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]  text-slate-400  tracking-widest mb-1">Current Op</p>
                  <p className="text-sm  text-indigo-600 flex items-center gap-1 justify-end">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded  animate-pulse"></span>
                    {selectedJC?.operation_name}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded  border border-slate-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-50 rounded  flex items-center justify-center text-amber-600">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 ">
                    <span className="text-lg  text-slate-900">{calculateEfficiency(selectedJC)}%</span>
                    <span className="text-[10px]  text-slate-400  tracking-widest">78.00 / 100 MIN</span>
                  </div>
                  <p className="text-[10px]  text-slate-400  tracking-widest mt-0.5">Efficiency</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded  border border-slate-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 rounded  flex items-center justify-center text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 ">
                    <span className="text-lg  text-slate-900">
                      {selectedJC?.planned_qty > 0 ? Math.round(((selectedJC?.accepted_qty || 0) / selectedJC.planned_qty) * 100) : 0}%
                    </span>
                    <span className="text-[10px]  text-slate-400  tracking-widest">Acceptance Rate</span>
                  </div>
                  <p className="text-[10px]  text-slate-400  tracking-widest mt-0.5">Quality Yield</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded  border border-slate-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded  flex items-center justify-center text-indigo-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 ">
                    <span className="text-lg  text-slate-900">5.6</span>
                    <span className="text-[10px]  text-slate-400  tracking-widest">Units Per Hour</span>
                  </div>
                  <p className="text-[10px]  text-slate-400  tracking-widest mt-0.5">Productivity</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded  w-fit">
            {[
              { id: 'time', label: 'Time Logs', icon: Clock },
              { id: 'quality', label: 'Quality Check', icon: CheckCircle },
              { id: 'downtime', label: 'Downtime Logs', icon: AlertCircle },
              { id: 'next', label: 'Next Operation', icon: Play },
              { id: 'report', label: 'Daily Report', icon: ClipboardList }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2  p-2  rounded  text-xs  transition-all ${
                  activeTab === tab.id ? 'bg-white text-indigo-600 ' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'time' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white rounded  border border-slate-100 overflow-hidden">
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-sm  text-slate-900 flex items-center gap-2 ">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Add Time Log
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <FormControl label="Day & Date">
                        <input type="date" value={timeLogForm.logDate} onChange={e => setTimeLogForm({...timeLogForm, logDate: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                      </FormControl>
                      <FormControl label="Operator">
                        <select value={timeLogForm.operatorId} onChange={e => setTimeLogForm({...timeLogForm, operatorId: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="">Select Operator</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                      </FormControl>
                      <FormControl label="Workstation">
                        <select value={timeLogForm.workstationId} onChange={e => setTimeLogForm({...timeLogForm, workstationId: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="">Select Machine</option>
                          {workstations.map(w => <option key={w.id} value={w.id}>{w.workstation_name}</option>)}
                        </select>
                      </FormControl>
                      <FormControl label="Shift">
                        <select value={timeLogForm.shift} onChange={e => setTimeLogForm({...timeLogForm, shift: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="SHIFT_A">Shift A</option>
                          <option value="SHIFT_B">Shift B</option>
                          <option value="SHIFT_C">Shift C</option>
                        </select>
                      </FormControl>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <FormControl label="Production Period">
                        <div className="flex items-center gap-2 ">
                          <input type="time" value={timeLogForm.startTime} onChange={e => setTimeLogForm({...timeLogForm, startTime: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                          <span className="text-slate-400">to</span>
                          <input type="time" value={timeLogForm.endTime} onChange={e => setTimeLogForm({...timeLogForm, endTime: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                        </div>
                      </FormControl>
                      <FormControl label="Produce Qty">
                        <input type="number" value={timeLogForm.producedQty} onChange={e => setTimeLogForm({...timeLogForm, producedQty: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                      </FormControl>
                      <button 
                        onClick={() => addTimeLog(timeLogForm)}
                        className="col-span-1 p-2 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all  text-xs  tracking-widest h-[38px] flex items-center justify-center gap-2"
                      >
                        <Monitor className="w-4 h-4" />
                        Record Time
                      </button>
                    </div>
                  </div>
                </div>

                {/* Log Table */}
                <div className="bg-white rounded  border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Day</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Date / Shift</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Operator</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-center">Time Interval</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-right">Produced Qty</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.timeLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2  text-xs  text-slate-900">{new Date(log.log_date).toLocaleDateString(undefined, {weekday: 'short'})}</td>
                          <td className="p-2 ">
                            <div className="text-xs  text-slate-900">{new Date(log.log_date).toLocaleDateString()}</div>
                            <div className="text-[10px]  text-slate-400  tracking-widest">{log.shift}</div>
                          </td>
                          <td className="p-2 ">
                            <div className="flex items-center gap-2 ">
                              <div className="w-6 h-6 bg-slate-100 rounded  flex items-center justify-centertext-xs   text-slate-600">
                                {log.operator_name?.[0]}
                              </div>
                              <span className="text-xs  text-slate-600">{log.operator_name}</span>
                            </div>
                          </td>
                          <td className="p-2  text-center">
                            <div className="flex items-center justify-center gap-2 text-xs  text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {log.start_time?.slice(11, 16)} - {log.end_time?.slice(11, 16)}
                            </div>
                          </td>
                          <td className="p-2  text-right">
                            <span className="text-xs  text-indigo-600">{log.produced_qty} UNITS</span>
                          </td>
                          <td className="p-2  text-right">
                            <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded  transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'quality' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white rounded  border border-slate-100 overflow-hidden">
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-sm  text-slate-900 flex items-center gap-2 ">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Quality & Rejection Entry
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                      <FormControl label="Day & Date">
                        <input type="date" value={qualityLogForm.checkDate} onChange={e => setQualityLogForm({...qualityLogForm, checkDate: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                      </FormControl>
                      <FormControl label="Shift">
                        <select value={qualityLogForm.shift} onChange={e => setQualityLogForm({...qualityLogForm, shift: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="SHIFT_A">Shift A</option>
                          <option value="SHIFT_B">Shift B</option>
                          <option value="SHIFT_C">Shift C</option>
                        </select>
                      </FormControl>
                      <FormControl label="Produce Qty">
                        <input type="number" value={qualityLogForm.inspectedQty} onChange={e => setQualityLogForm({...qualityLogForm, inspectedQty: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded  text-xs  outline-none" />
                      </FormControl>
                      <FormControl label="Rejection Reason">
                        <select value={qualityLogForm.rejectionReason} onChange={e => setQualityLogForm({...qualityLogForm, rejectionReason: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="">Select Reason</option>
                          <option value="Dimensional Deviation">Dimensional Deviation</option>
                          <option value="Surface Defect">Surface Defect</option>
                          <option value="Material Flaw">Material Flaw</option>
                          <option value="Other">Other</option>
                        </select>
                      </FormControl>
                      <div className="flex gap-2">
                        <FormControl label="Accepted">
                          <input type="number" value={qualityLogForm.acceptedQty} onChange={e => setQualityLogForm({...qualityLogForm, acceptedQty: e.target.value})} className="w-full px-3 py-2 bg-emerald-50 border border-emerald-100 rounded  text-xs  text-emerald-600 outline-none" />
                        </FormControl>
                        <FormControl label="Rejected">
                          <input type="number" value={qualityLogForm.rejectedQty} onChange={e => setQualityLogForm({...qualityLogForm, rejectedQty: e.target.value})} className="w-full px-3 py-2 bg-rose-50 border border-rose-100 rounded  text-xs  text-rose-600 outline-none" />
                        </FormControl>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={() => addQualityLog({...qualityLogForm, status: 'Approved '})}
                        className="px-8 py-2 bg-emerald-600 text-white rounded  hover:bg-emerald-700 transition-all  text-xs  tracking-widest flex items-center gap-2 "
                      >
                        <Check className="w-4 h-4" />
                        Save Entry
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded  border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Date / Shift</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Inspection Status</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Quality Notes</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-center">Accepted</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-center">Rejected</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-center">Scrap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.qualityLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 ">
                            <div className="text-xs  text-slate-900">{new Date(log.check_date).toLocaleDateString()}</div>
                            <div className="text-[10px]  text-slate-400  tracking-widest">{log.shift}</div>
                          </td>
                          <td className="p-2 ">
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 roundedtext-xs     flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              {log.status}
                            </span>
                          </td>
                          <td className="p-2 ">
                            <div className="text-xs  text-rose-600  tracking-tight">{log.rejection_reason || 'PASSED'}</div>
                            <div className="text-[10px]  text-slate-400">{log.notes || 'Standard Inspection'}</div>
                          </td>
                          <td className="p-2  text-center text-xs  text-slate-900">{log.accepted_qty}</td>
                          <td className="p-2  text-center text-xs  text-rose-600">{log.rejected_qty}</td>
                          <td className="p-2  text-center text-xs  text-slate-400">{log.scrap_qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'downtime' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white rounded  border border-slate-100 overflow-hidden">
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-sm  text-slate-900 flex items-center gap-2 ">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Operational Downtime
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <FormControl label="Day & Date">
                        <input type="date" value={downtimeLogForm.downtimeDate} onChange={e => setDowntimeLogForm({...downtimeLogForm, downtimeDate: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                      </FormControl>
                      <FormControl label="Shift">
                        <select value={downtimeLogForm.shift} onChange={e => setDowntimeLogForm({...downtimeLogForm, shift: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="SHIFT_A">Shift A</option>
                          <option value="SHIFT_B">Shift B</option>
                          <option value="SHIFT_C">Shift C</option>
                        </select>
                      </FormControl>
                      <FormControl label="Downtime Type">
                        <select value={downtimeLogForm.downtimeType} onChange={e => setDowntimeLogForm({...downtimeLogForm, downtimeType: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none">
                          <option value="">Select Type</option>
                          <option value="Breakdown">Breakdown</option>
                          <option value="Maintenance">Maintenance</option>
                          <option value="Setup">Setup</option>
                          <option value="Material Shortage">Material Shortage</option>
                          <option value="Power Failure">Power Failure</option>
                        </select>
                      </FormControl>
                      <FormControl label="Time Interval">
                        <div className="flex items-center gap-2 ">
                          <input type="time" value={downtimeLogForm.startTime} onChange={e => setDowntimeLogForm({...downtimeLogForm, startTime: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                          <span className="text-slate-400">to</span>
                          <input type="time" value={downtimeLogForm.endTime} onChange={e => setDowntimeLogForm({...downtimeLogForm, endTime: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded  text-xs  outline-none" />
                        </div>
                      </FormControl>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={() => addDowntimeLog(downtimeLogForm)}
                        className="px-8 py-2 bg-amber-600 text-white rounded  hover:bg-amber-700 transition-all  text-xs  tracking-widest flex items-center gap-2 "
                      >
                        <Clock className="w-4 h-4" />
                        Record Downtime
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded  border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Day</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Date / Shift</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest">Category / Reason</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-center">Interval</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-right">Duration</th>
                        <th className="px-6 py-3text-xs   text-slate-400  tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.downtimeLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2  text-xs  text-slate-900">{new Date(log.downtime_date).toLocaleDateString(undefined, {weekday: 'short'})}</td>
                          <td className="p-2 ">
                            <div className="text-xs  text-slate-900">{new Date(log.downtime_date).toLocaleDateString()}</div>
                            <div className="text-[10px]  text-slate-400  tracking-widest">{log.shift}</div>
                          </td>
                          <td className="p-2  text-xs  text-amber-600">{log.downtime_type}</td>
                          <td className="p-2  text-center text-xs  text-slate-600">{log.start_time?.slice(11, 16)} - {log.end_time?.slice(11, 16)}</td>
                          <td className="p-2  text-right text-xs  text-slate-900">30 Min</td>
                          <td className="p-2  text-right">
                            <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded  transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
             <button
              type="button"
              onClick={() => setIsProgressModalOpen(false)}
              className="p-2.5 text-xs  text-slate-500 hover:text-slate-700 transition-colors  tracking-widest"
            >
              Back
            </button>
            <button
              onClick={() => handleUpdateStatus(selectedJC.id, 'COMPLETED')}
              className="px-8 py-2.5 bg-emerald-600 text-white rounded  hover:bg-emerald-700 transition-all  text-sm shadow-lg shadow-emerald-100  tracking-widest flex items-center gap-2 "
            >
              <CheckCircle className="w-5 h-5" />
              Complete Production
            </button>
          </div>
        </div>
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


