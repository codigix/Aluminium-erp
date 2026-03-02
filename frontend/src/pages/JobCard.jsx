import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  ClipboardList, Activity, CheckCircle, TrendingUp, 
  Play, Check, Edit2, Trash2, Search, Filter, Plus, X,
  Clock, Package, User, Monitor, AlertCircle, ChevronDown, ChevronRight, ChevronLeft,
  DollarSign, Zap, Eye, Truck, Box, Target, Layers, ArrowRight, FileText, History,
  AlertTriangle, Download, BarChart2, ShieldCheck, Info, Save
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
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [previewDrawing, setPreviewDrawing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWOs, setExpandedWOs] = useState(new Set());
  const [isOutwardModalOpen, setIsOutwardModalOpen] = useState(false);
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [selectedJCOutward, setSelectedJCOutward] = useState(null);

  const [inwardFormData, setInwardFormData] = useState({
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    remarks: '',
    receivedDate: new Date().toISOString().split('T')[0]
  });

  const [outwardFormData, setOutwardFormData] = useState({
    vendorId: '',
    operationName: '',
    plannedQty: 0,
    expectedReturnDate: '',
    dispatchQty: 0,
    dispatchNotes: '',
    materialItems: []
  });

  const [formData, setFormData] = useState({
    jcNumber: '',
    workOrderId: '',
    operationId: '',
    workstationId: '',
    assignedTo: '',
    plannedQty: 0,
    remarks: ''
  });

  const formatLocalTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

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
    fetchVendors();
    fetchItems();
    fetchDrawings();
    fetchWarehouses();

    const filterWO = searchParams.get('filter_work_order');
    if (filterWO) {
      setSearchQuery(filterWO);
    }
  }, []);

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

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

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched vendors:', data);
        setVendors(data);
      } else {
        console.error('Failed to fetch vendors:', response.status);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/items?includeAll=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched items:', data);
        setItems(data);
      } else {
        console.error('Failed to fetch items:', response.status);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchDrawings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched drawings:', data);
        setDrawings(data);
      } else {
        console.error('Failed to fetch drawings:', response.status);
      }
    } catch (error) {
      console.error('Error fetching drawings:', error);
    }
  };

  const combinedItems = useMemo(() => {
    const itemOptions = items.map(i => ({ 
      value: i.item_code, 
      label: i.item_code, 
      itemName: i.material_name || i.item_description,
      type: 'Stock'
    }));

    const drawingOptions = drawings.map(d => ({
      value: d.drawing_no,
      label: d.drawing_no,
      itemName: d.description || d.client_name,
      type: 'Drawing'
    }));

    // Filter out duplicates (if any item_code matches drawing_no)
    const seen = new Set();
    const result = [];

    [...itemOptions, ...drawingOptions].forEach(opt => {
      if (!seen.has(opt.value)) {
        seen.add(opt.value);
        result.push(opt);
      }
    });

    return result;
  }, [items, drawings]);

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
  const [showProductionEntry, setShowProductionEntry] = useState(false);
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
    startTime: '08:00',
    startAMPM: 'AM',
    endTime: '08:00',
    endAMPM: 'PM',
    producedQty: 0,
    day: 1
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
    status: 'PENDING',
    day: 1
  });

  const calculateISODuration = (startISO, endISO) => {
    if (!startISO || !endISO) return 0;
    const start = new Date(startISO);
    const end = new Date(endISO);
    let diff = Math.round((end - start) / (1000 * 60));
    if (diff <= 0) diff += 24 * 60; 
    return diff;
  };

  const calculateTotalMins = (start, startAMPM, end, endAMPM) => {
    try {
      if (!start || !end) return 0;
      
      const parseTime = (timeStr, ampm) => {
        let [hours, minutes] = timeStr.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const startMins = parseTime(start, startAMPM);
      const endMins = parseTime(end, endAMPM);
      
      let diff = endMins - startMins;
      if (diff <= 0) diff += 24 * 60; // Handle overnight shift or same time
      return diff;
    } catch (e) {
      return 0;
    }
  };

  const [downtimeLogForm, setDowntimeLogForm] = useState({
    downtimeDate: new Date().toISOString().slice(0, 10),
    shift: 'SHIFT_A',
    downtimeType: '',
    startTime: '08:00',
    startAMPM: 'AM',
    endTime: '08:00',
    endAMPM: 'PM',
    remarks: '',
    day: 1
  });

  const [viewingTimeLog, setViewingTimeLog] = useState(null);
  const [editingTimeLogId, setEditingTimeLogId] = useState(null);
  const [editTimeLogForm, setEditTimeLogForm] = useState({
    day: 1,
    logDate: '',
    shift: '',
    operatorId: '',
    startTime: '',
    startAMPM: 'AM',
    endTime: '',
    endAMPM: 'PM',
    producedQty: 0
  });

  const [nextStageForm, setNextStageForm] = useState({
    nextOperationId: '',
    assignOperatorId: '',
    targetWarehouseId: '',
    executionMode: 'In-house'
  });
  const [viewingQualityLog, setViewingQualityLog] = useState(null);
  const [editingQualityLogId, setEditingQualityLogId] = useState(null);
  const [editQualityLogForm, setEditQualityLogForm] = useState({
    day: 1,
    checkDate: '',
    shift: '',
    inspectedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    rejectionReason: '',
    notes: '',
    status: 'PENDING'
  });

  const handleDayChange = (type, val) => {
    if (!selectedJC) return;
    const startDateStr = selectedJC.actual_start_date || selectedJC.created_at || new Date();
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const newDate = new Date(startDate);
    newDate.setDate(startDate.getDate() + (parseInt(val) - 1));
    const formattedDate = newDate.toISOString().slice(0, 10);

    if (type === 'time') {
      setTimeLogForm(prev => ({ ...prev, day: val, logDate: formattedDate }));
    } else if (type === 'quality') {
      setQualityLogForm(prev => ({ ...prev, day: val, checkDate: formattedDate }));
    } else if (type === 'downtime') {
      setDowntimeLogForm(prev => ({ ...prev, day: val, downtimeDate: formattedDate }));
    }
  };

  const handleDateChange = (type, val) => {
    if (!selectedJC) return;
    
    let diffDays = 1;
    if (selectedJC.actual_start_date) {
      const startDate = new Date(selectedJC.actual_start_date);
      startDate.setHours(0, 0, 0, 0);
      const logDate = new Date(val);
      logDate.setHours(0, 0, 0, 0);
      diffDays = Math.floor((logDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // If no actual start date yet, this is Day 1
      diffDays = 1;
    }

    if (type === 'time') {
      setTimeLogForm(prev => ({ ...prev, logDate: val, day: diffDays }));
    } else if (type === 'quality') {
      setQualityLogForm(prev => ({ ...prev, checkDate: val, day: diffDays }));
    } else if (type === 'downtime') {
      setDowntimeLogForm(prev => ({ ...prev, downtimeDate: val, day: diffDays }));
    }
  };

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
    const today = new Date().toISOString().split('T')[0];
    let diffDays = 1;
    if (jc.actual_start_date) {
      const startDate = new Date(jc.actual_start_date);
      startDate.setHours(0, 0, 0, 0);
      const logDate = new Date(today);
      logDate.setHours(0, 0, 0, 0);
      diffDays = Math.floor((logDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      diffDays = 1;
    }

    setTimeLogForm(prev => ({ 
      ...prev, 
      logDate: today,
      day: diffDays,
      operatorId: jc.assigned_to || '', 
      workstationId: jc.workstation_id || '',
      producedQty: 0,
      startTime: '08:00',
      startAMPM: 'AM',
      endTime: '08:00',
      endAMPM: 'PM'
    }));
    setQualityLogForm(prev => ({ ...prev, checkDate: today, day: diffDays, shift: 'SHIFT_A', inspectedQty: 0, acceptedQty: 0, rejectedQty: 0, scrapQty: 0 }));
    setDowntimeLogForm(prev => ({ ...prev, downtimeDate: today, day: diffDays, shift: 'SHIFT_A', startTime: '08:00', startAMPM: 'AM', endTime: '08:00', endAMPM: 'PM', downtimeType: '', remarks: '' }));
    
    setShowProductionEntry(true);
  };

  const handleEditTimeLog = (log) => {
    const start24 = formatLocalTime(log.start_time);
    const end24 = formatLocalTime(log.end_time);
    
    const to12h = (time24) => {
      if (!time24) return { time: '08:00', ampm: 'AM' };
      let [h, m] = time24.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, ampm };
    };

    const start = to12h(start24);
    const end = to12h(end24);

    const startDateStr = selectedJC.actual_start_date || selectedJC.created_at || new Date();
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const logDate = new Date(log.log_date);
    logDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((logDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    setEditingTimeLogId(log.id);
    setEditTimeLogForm({
      day: diffDays,
      logDate: log.log_date.slice(0, 10),
      shift: log.shift,
      operatorId: log.operator_id,
      startTime: start.time,
      startAMPM: start.ampm,
      endTime: end.time,
      endAMPM: end.ampm,
      producedQty: log.produced_qty
    });
  };

  const handleEditQualityLog = (log) => {
    const startDateStr = selectedJC.actual_start_date || selectedJC.created_at || new Date();
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(log.check_date);
    checkDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((checkDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    setEditingQualityLogId(log.id);
    setEditQualityLogForm({
      day: diffDays,
      checkDate: log.check_date.slice(0, 10),
      shift: log.shift,
      inspectedQty: log.inspected_qty,
      acceptedQty: log.accepted_qty,
      rejectedQty: log.rejected_qty,
      scrapQty: log.scrap_qty,
      rejectionReason: log.rejection_reason || '',
      notes: log.notes || '',
      status: log.status
    });
  };

  const renderProductionEntry = () => {
    if (!selectedJC) return null;
    
    const balanceWip = parseFloat(selectedJC.planned_qty || 0) - parseFloat(selectedJC.accepted_qty || 0);

    return (
      <div className="space-y-8 pb-12">
        {/* New Header UI */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">Production Entry</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                {selectedJC.status || 'In-Progress'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-medium text-slate-500">{selectedJC.job_card_no}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-medium text-slate-500">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <button
            onClick={() => setShowProductionEntry(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
          </button>
        </div>

        {/* Target Item Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                <Box className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Target Item</p>
                <h3 className="text-sm font-bold text-slate-900">{selectedJC.item_name}</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">{selectedJC.drawing_no || 'S-BASEFRAMEASSEMBLY'}</p>
              </div>
            </div>

            <div className="flex gap-10">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Planned</p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedJC.planned_qty} <span className="text-[10px] font-medium text-slate-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Produced</p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedJC.produced_qty || 0} <span className="text-[10px] font-medium text-slate-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Accepted</p>
                <p className="text-sm font-bold text-emerald-600">
                  {selectedJC.accepted_qty || 0} <span className="text-[10px] font-medium text-emerald-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 text-indigo-400">Transferred</p>
                <p className="text-sm font-bold text-indigo-600">
                  {selectedJC.transferred_qty || 0} <span className="text-[10px] font-medium text-indigo-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">Balance WIP</p>
                <p className="text-sm font-bold text-amber-600">
                  {balanceWip.toFixed(2)} <span className="text-[10px] font-medium text-amber-400">Units</span>
                </p>
              </div>
              <div className="text-right border-l border-slate-100 pl-8">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Current Op</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                  <p className="text-sm font-bold text-indigo-600">{selectedJC.operation_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Efficiency, Quality Yield, Productivity Row */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">{calculateEfficiency(selectedJC)}%</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">0 / 0 MIN</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Efficiency</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">
                  {selectedJC.planned_qty > 0 ? Math.round(((selectedJC.accepted_qty || 0) / selectedJC.planned_qty) * 100) : 0}%
                </span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Acceptance Rate</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Quality Yield</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">0</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Units Per Hour</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Productivity</p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-12 mt-12">
          {/* 1. Add Time Log Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Add Time Log</h2>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                  <FormControl label="Day & Date" required>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        value={timeLogForm.day} 
                        onChange={e => setTimeLogForm({...timeLogForm, day: e.target.value})} 
                        className="w-14 px-2 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 font-bold" 
                      />
                      <input 
                        type="date" 
                        value={timeLogForm.logDate} 
                        onChange={e => handleDateChange('time', e.target.value)} 
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500" 
                      />
                    </div>
                  </FormControl>
                  <FormControl label="Operator" required>
                    <SearchableSelect
                      options={users.map(u => ({ value: u.id, label: u.username }))}
                      value={timeLogForm.operatorId}
                      onChange={(e) => setTimeLogForm({ ...timeLogForm, operatorId: e.target.value })}
                      placeholder="Select Operator..."
                    />
                  </FormControl>
                  <FormControl label="Workstation" required>
                    <SearchableSelect
                      options={workstations.map(w => ({ value: w.id, label: w.workstation_name }))}
                      value={timeLogForm.workstationId}
                      onChange={(e) => setTimeLogForm({ ...timeLogForm, workstationId: e.target.value })}
                      placeholder="Select Machine..."
                    />
                  </FormControl>
                  <FormControl label="Shift" required>
                    <div className="flex items-center gap-1">
                      <select value={timeLogForm.shift} onChange={e => setTimeLogForm({...timeLogForm, shift: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 appearance-none">
                        <option value="SHIFT_A">A</option>
                        <option value="SHIFT_B">B</option>
                        <option value="SHIFT_C">C</option>
                      </select>
                      <button className="p-2 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </FormControl>
                  <FormControl label="Produce Qty" required>
                    <div className="relative">
                      <input type="number" value={timeLogForm.producedQty} onChange={e => setTimeLogForm({...timeLogForm, producedQty: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Units</span>
                    </div>
                  </FormControl>
                </div>

                <div className="flex items-end gap-6">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <FormControl label="Production Period" required>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded px-3 py-2 focus-within:border-indigo-500">
                          <input 
                            type="time" 
                            value={timeLogForm.startTime} 
                            onChange={e => setTimeLogForm({...timeLogForm, startTime: e.target.value})} 
                            className="flex-1 text-xs outline-none" 
                          />
                          <select 
                            value={timeLogForm.startAMPM} 
                            onChange={e => setTimeLogForm({...timeLogForm, startAMPM: e.target.value})}
                            className="text-[10px] font-bold text-slate-400 outline-none ml-1 bg-transparent cursor-pointer"
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded px-3 py-2 focus-within:border-indigo-500">
                          <input 
                            type="time" 
                            value={timeLogForm.endTime} 
                            onChange={e => setTimeLogForm({...timeLogForm, endTime: e.target.value})} 
                            className="flex-1 text-xs outline-none" 
                          />
                          <select 
                            value={timeLogForm.endAMPM} 
                            onChange={e => setTimeLogForm({...timeLogForm, endAMPM: e.target.value})}
                            className="text-[10px] font-bold text-slate-400 outline-none ml-1 bg-transparent cursor-pointer"
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>
                    </FormControl>
                    <FormControl label="Total Mins" required>
                      <input 
                        type="number" 
                        value={calculateTotalMins(timeLogForm.startTime, timeLogForm.startAMPM, timeLogForm.endTime, timeLogForm.endAMPM)} 
                        readOnly 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none font-bold text-slate-600" 
                      />
                    </FormControl>
                  </div>
                  <button 
                    onClick={() => addTimeLog(timeLogForm)}
                    className="px-10 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center gap-2 h-[38px]"
                  >
                    <Monitor className="w-4 h-4" />
                    Record Time
                  </button>
                </div>

                <div className="mt-12 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Day</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Date / Shift</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Operator</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">Time Interval</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Produced Qty</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.timeLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-slate-400 italic">No data available</td>
                        </tr>
                      ) : (
                        logs.timeLogs.map((log, index) => {
                          const isEditing = editingTimeLogId === log.id;
                          const day = log.day || '-';

                          if (isEditing) {
                            return (
                              <tr key={log.id} className="bg-indigo-50/30">
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={editTimeLogForm.day} 
                                    className="w-12 px-1 py-1 border rounded text-[10px]" 
                                    onChange={e => setEditTimeLogForm({...editTimeLogForm, day: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="date" 
                                    value={editTimeLogForm.logDate} 
                                    className="block w-full px-1 py-1 border rounded text-[10px] mb-1" 
                                    onChange={e => setEditTimeLogForm({...editTimeLogForm, logDate: e.target.value})}
                                  />
                                  <select 
                                    value={editTimeLogForm.shift} 
                                    className="w-full px-1 py-1 border rounded text-[10px]"
                                    onChange={e => setEditTimeLogForm({...editTimeLogForm, shift: e.target.value})}
                                  >
                                    <option value="SHIFT_A">A</option>
                                    <option value="SHIFT_B">B</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <select 
                                    value={editTimeLogForm.operatorId} 
                                    className="w-full px-1 py-1 border rounded text-[10px]"
                                    onChange={e => setEditTimeLogForm({...editTimeLogForm, operatorId: e.target.value})}
                                  >
                                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1 justify-center">
                                    <input type="time" value={editTimeLogForm.startTime} className="w-16 px-1 py-1 border rounded text-[10px]" onChange={e => setEditTimeLogForm({...editTimeLogForm, startTime: e.target.value})} />
                                    <select value={editTimeLogForm.startAMPM} className="px-1 py-1 border rounded text-[10px]" onChange={e => setEditTimeLogForm({...editTimeLogForm, startAMPM: e.target.value})}>
                                      <option value="AM">AM</option><option value="PM">PM</option>
                                    </select>
                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                    <input type="time" value={editTimeLogForm.endTime} className="w-16 px-1 py-1 border rounded text-[10px]" onChange={e => setEditTimeLogForm({...editTimeLogForm, endTime: e.target.value})} />
                                    <select value={editTimeLogForm.endAMPM} className="px-1 py-1 border rounded text-[10px]" onChange={e => setEditTimeLogForm({...editTimeLogForm, endAMPM: e.target.value})}>
                                      <option value="AM">AM</option><option value="PM">PM</option>
                                    </select>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={editTimeLogForm.producedQty} 
                                    className="w-full px-1 py-1 border rounded text-[10px] text-right font-bold" 
                                    onChange={e => setEditTimeLogForm({...editTimeLogForm, producedQty: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => updateTimeLog(log.id, editTimeLogForm)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Save className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingTimeLogId(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"><X className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                                  {day}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-700">{new Date(log.log_date).toLocaleDateString('en-GB')}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{log.shift}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold text-slate-600">
                                    {log.operator_name?.[0]}
                                  </div>
                                  <span className="font-medium text-slate-600">{log.operator_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="font-medium text-slate-600">{formatLocalTime(log.start_time)} - {formatLocalTime(log.end_time)}</div>
                                <div className="text-[10px] text-indigo-500 font-bold">{calculateISODuration(log.start_time, log.end_time)} mins</div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-indigo-600 uppercase tracking-wider">
                                {parseFloat(log.produced_qty).toFixed(3)} UNITS
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setViewingTimeLog(log)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleEditTimeLog(log)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => deleteTimeLog(log.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Rows per page:</span>
                    <select className="bg-transparent outline-none cursor-pointer">
                      <option>10</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Page 1 of {Math.ceil(logs.timeLogs.length / 10) || 0} <span className="text-slate-300 ml-1">({logs.timeLogs.length} total)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-slate-300" disabled><ChevronLeft className="w-4 h-4" /></button>
                      <button className="px-4 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-colors">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Quality & Rejection Entry Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Quality & Rejection Entry</h2>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6 border-b border-slate-50 pb-6">
                  <FormControl label="Day & Date" required>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        value={qualityLogForm.day} 
                        onChange={e => setQualityLogForm({...qualityLogForm, day: e.target.value})} 
                        className="w-14 px-2 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-emerald-500 font-bold" 
                      />
                      <input 
                        type="date" 
                        value={qualityLogForm.checkDate} 
                        onChange={e => handleDateChange('quality', e.target.value)} 
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-emerald-500" 
                      />
                    </div>
                  </FormControl>
                  <FormControl label="Shift" required>
                    <div className="flex items-center gap-1">
                      <select value={qualityLogForm.shift} onChange={e => setQualityLogForm({...qualityLogForm, shift: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-emerald-500 appearance-none">
                        <option value="SHIFT_A">A</option>
                      </select>
                      <button className="p-2 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </FormControl>
                  <FormControl label="Produce Qty" required>
                    <input type="number" value={qualityLogForm.inspectedQty} onChange={e => setQualityLogForm({...qualityLogForm, inspectedQty: e.target.value})} className="w-full px-3 py-2 bg-indigo-50 border border-indigo-100 rounded text-xs outline-none font-bold text-indigo-600" />
                  </FormControl>
                  <FormControl label="Rejection Reason">
                    <select value={qualityLogForm.rejectionReason} onChange={e => setQualityLogForm({...qualityLogForm, rejectionReason: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-emerald-500">
                      <option value="">Select Reason</option>
                      <option value="Size/Dimension Error">Size/Dimension Error</option>
                      <option value="Surface Finish Poor">Surface Finish Poor</option>
                      <option value="Material Defect">Material Defect</option>
                      <option value="Machining Error">Machining Error</option>
                      <option value="Assembly Issue">Assembly Issue</option>
                      <option value="Quality Check Failed">Quality Check Failed</option>
                      <option value="Damage in Handling">Damage in Handling</option>
                      <option value="Other">Other</option>
                    </select>
                  </FormControl>
                  <FormControl label="Accepted" required>
                    <input type="number" value={qualityLogForm.acceptedQty} onChange={e => setQualityLogForm({...qualityLogForm, acceptedQty: e.target.value})} className="w-full px-3 py-2 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-600 outline-none font-bold" />
                  </FormControl>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      Rejected <span className="text-slate-300 font-normal capitalize">(Scrap)</span> <span className="text-rose-400 font-bold">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={qualityLogForm.rejectedQty} onChange={e => setQualityLogForm({...qualityLogForm, rejectedQty: e.target.value})} className="flex-1 px-3 py-2 bg-rose-50 border border-rose-100 rounded text-xs text-rose-600 outline-none font-bold" />
                      <input type="number" readOnly value={qualityLogForm.scrapQty} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded text-xs outline-none font-bold text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 pt-2">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-amber-800 tracking-tight">Quality Gate Active</p>
                        <p className="text-[10px] text-amber-700 leading-relaxed mt-0.5">
                          Only <span className="font-bold uppercase tracking-widest text-[9px] px-1 bg-amber-100 rounded-sm">Approved</span> quality inspection records contribute to the <span className="font-bold">Accepted Quantity</span> of this job card. Pending records will block the progression to subsequent operations.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => addQualityLog({...qualityLogForm, status: 'PENDING'})}
                    className="px-10 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center gap-2 h-[38px]"
                  >
                    <Save className="w-4 h-4" />
                    Save Entry
                  </button>
                </div>

                <div className="mt-12 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Day</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Date / Shift</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Notes</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">Accepted</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">Rejected</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">Scrap</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.qualityLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-slate-400 italic">No data available</td>
                        </tr>
                      ) : (
                        logs.qualityLogs.map((log, index) => {
                          const isEditing = editingQualityLogId === log.id;
                          const day = log.day || '-';

                          if (isEditing) {
                            return (
                              <tr key={log.id} className="bg-emerald-50/30">
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={editQualityLogForm.day} 
                                    className="w-12 px-1 py-1 border rounded text-[10px]" 
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, day: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="date" 
                                    value={editQualityLogForm.checkDate} 
                                    className="block w-full px-1 py-1 border rounded text-[10px] mb-1" 
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, checkDate: e.target.value})}
                                  />
                                  <select 
                                    value={editQualityLogForm.shift} 
                                    className="w-full px-1 py-1 border rounded text-[10px]"
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, shift: e.target.value})}
                                  >
                                    <option value="SHIFT_A">A</option>
                                    <option value="SHIFT_B">B</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3" colSpan="2">
                                  <input 
                                    type="text" 
                                    placeholder="Notes..."
                                    value={editQualityLogForm.notes || ''} 
                                    className="w-full px-1 py-1 border rounded text-[10px]" 
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, notes: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={editQualityLogForm.acceptedQty} 
                                    className="w-full px-1 py-1 border rounded text-[10px] text-emerald-600 font-bold text-center" 
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, acceptedQty: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={editQualityLogForm.rejectedQty} 
                                    className="w-full px-1 py-1 border rounded text-[10px] text-rose-600 font-bold text-center" 
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, rejectedQty: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    value={editQualityLogForm.scrapQty} 
                                    className="w-full px-1 py-1 border rounded text-[10px] text-slate-600 font-bold text-center" 
                                    onChange={e => setEditQualityLogForm({...editQualityLogForm, scrapQty: e.target.value})}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => updateQualityLog(log.id, editQualityLogForm)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Save className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingQualityLogId(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"><X className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                                  {day}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-700">{new Date(log.check_date).toLocaleDateString('en-GB')}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{log.shift}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  log.status?.trim() === 'APPROVED' 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                  <Clock className="w-2.5 h-2.5 mr-1" />
                                  {log.status?.trim() === 'APPROVED' ? 'APPROVED' : 'Pending Approval'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                                  (log.rejected_qty > 0 || log.scrap_qty > 0)
                                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`}>
                                  <span className="mr-1 opacity-60">
                                    {(log.rejected_qty > 0 || log.scrap_qty > 0) ? 'Rejected' : 'Passed'}
                                  </span> 
                                  {log.rejection_reason || log.notes || 'No notes'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                {parseFloat(log.accepted_qty).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-rose-600">
                                {parseFloat(log.rejected_qty).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-600">
                                {parseFloat(log.scrap_qty).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setViewingQualityLog(log)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleEditQualityLog(log)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button 
                                    onClick={() => updateQualityLog(log.id, { status: 'APPROVED' })} 
                                    disabled={log.status?.trim() === 'APPROVED'}
                                    className={`p-1.5 rounded transition-colors ${
                                      log.status?.trim() === 'APPROVED' ? 'text-emerald-500 cursor-default' : 'text-slate-400 hover:text-emerald-600'
                                    }`}
                                    title={log.status?.trim() === 'APPROVED' ? 'APPROVED' : 'Verify'}
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteQualityLog(log.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Rows per page:</span>
                    <select className="bg-transparent outline-none cursor-pointer">
                      <option>10</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Page 1 of {Math.ceil(logs.qualityLogs.length / 10) || 0} <span className="text-slate-300 ml-1">({logs.qualityLogs.length} total)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-slate-300" disabled><ChevronLeft className="w-4 h-4" /></button>
                      <button className="px-4 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-colors">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Operational Downtime Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Operational Downtime</h2>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 border-b border-slate-50 pb-6">
                  <FormControl label="Day & Date" required>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        value={downtimeLogForm.day} 
                        onChange={e => setDowntimeLogForm({...downtimeLogForm, day: e.target.value})} 
                        className="w-14 px-2 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500 font-bold" 
                      />
                      <input 
                        type="date" 
                        value={downtimeLogForm.downtimeDate} 
                        onChange={e => handleDateChange('downtime', e.target.value)} 
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500" 
                      />
                    </div>
                  </FormControl>
                  <FormControl label="Shift" required>
                    <div className="flex items-center gap-1">
                      <select value={downtimeLogForm.shift} onChange={e => setDowntimeLogForm({...downtimeLogForm, shift: e.target.value})} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500 appearance-none">
                        <option value="SHIFT_A">A</option>
                      </select>
                      <button className="p-2 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </FormControl>
                  <FormControl label="Downtime Type" required>
                    <select value={downtimeLogForm.downtimeType} onChange={e => setDowntimeLogForm({...downtimeLogForm, downtimeType: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500">
                      <option value="">Select Type</option>
                      <option value="Planned Downtime">Planned Downtime</option>
                      <option value="Unplanned Downtime">Unplanned Downtime</option>
                      <option value="Breakdown">Breakdown</option>
                    </select>
                  </FormControl>
                  <FormControl label="Start Time" required>
                    <div className="flex items-center bg-white border border-slate-200 rounded px-3 py-2 focus-within:border-amber-500">
                      <input 
                        type="time" 
                        value={downtimeLogForm.startTime} 
                        onChange={e => setDowntimeLogForm({...downtimeLogForm, startTime: e.target.value})} 
                        className="flex-1 text-xs outline-none" 
                      />
                      <select 
                        value={downtimeLogForm.startAMPM} 
                        onChange={e => setDowntimeLogForm({...downtimeLogForm, startAMPM: e.target.value})}
                        className="text-[10px] font-bold text-amber-600 outline-none ml-1 bg-transparent cursor-pointer"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </FormControl>
                  <FormControl label="End Time" required>
                    <div className="flex items-center bg-white border border-slate-200 rounded px-3 py-2 focus-within:border-amber-500">
                      <input 
                        type="time" 
                        value={downtimeLogForm.endTime} 
                        onChange={e => setDowntimeLogForm({...downtimeLogForm, endTime: e.target.value})} 
                        className="flex-1 text-xs outline-none" 
                      />
                      <select 
                        value={downtimeLogForm.endAMPM} 
                        onChange={e => setDowntimeLogForm({...downtimeLogForm, endAMPM: e.target.value})}
                        className="text-[10px] font-bold text-amber-600 outline-none ml-1 bg-transparent cursor-pointer"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </FormControl>
                  <FormControl label="Total Mins">
                    <input 
                      type="number" 
                      readOnly 
                      value={calculateTotalMins(downtimeLogForm.startTime, downtimeLogForm.startAMPM, downtimeLogForm.endTime, downtimeLogForm.endAMPM)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded text-xs outline-none font-bold text-slate-400" 
                    />
                  </FormControl>
                </div>
                
                <div className="flex justify-end">
                  <button 
                    onClick={() => addDowntimeLog(downtimeLogForm)}
                    className="px-10 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-orange-100 flex items-center gap-2 h-[38px]"
                  >
                    <Clock className="w-4 h-4" />
                    Record Downtime
                  </button>
                </div>

                <div className="mt-12 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Day</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Date / Shift</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Category / Reason</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-center">Interval</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Duration</th>
                        <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.downtimeLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-slate-400 italic">No data available</td>
                        </tr>
                      ) : (
                        logs.downtimeLogs.map((log, index) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {log.day || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-700">{new Date(log.downtime_date).toLocaleDateString('en-GB')}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{log.shift}</div>
                            </td>
                            <td className="px-4 py-3 font-bold text-amber-600 uppercase tracking-wider">{log.downtime_type}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-medium text-slate-600">{formatLocalTime(log.start_time)} - {formatLocalTime(log.end_time)}</div>
                              <div className="text-[10px] text-amber-500 font-bold">{calculateISODuration(log.start_time, log.end_time)} mins</div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700">
                              {calculateISODuration(log.start_time, log.end_time)} Min
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => deleteDowntimeLog(log.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Rows per page:</span>
                    <select className="bg-transparent outline-none cursor-pointer">
                      <option>10</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Page 1 of {Math.ceil(logs.downtimeLogs.length / 10) || 0} <span className="text-slate-300 ml-1">({logs.downtimeLogs.length} total)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-slate-300" disabled><ChevronLeft className="w-4 h-4" /></button>
                      <button className="px-4 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-colors">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Next Stage Configuration Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <Play className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Next Stage Configuration</h2>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase border border-emerald-100">Active</span>
              </div>
              <div className="flex items-center gap-6">
                <button 
                  onClick={handleReadyForDispatch}
                  disabled={logs.qualityLogs.some(log => log.status !== 'APPROVED')}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${
                    logs.qualityLogs.some(log => log.status !== 'APPROVED')
                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'bg-white border-emerald-100 text-emerald-600 shadow-sm hover:bg-emerald-50'
                  }`}
                  title={logs.qualityLogs.some(log => log.status !== 'APPROVED') ? 'Approve all quality records to proceed' : 'Mark Ready'}
                >
                  <CheckCircle className={`w-4 h-4 ${logs.qualityLogs.some(log => log.status !== 'APPROVED') ? 'text-slate-200' : 'text-emerald-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-widest">Ready for Dispatch</span>
                </button>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transferred so far:</p>
                  <p className="text-sm font-bold text-slate-700">{(selectedJC.transferred_qty || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic px-1">Specify destination and operational parameters for the next manufacturing phase</p>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormControl label="Next Operation" required>
                  <SearchableSelect
                    options={operations.map(o => ({ value: o.id, label: o.operation_name }))}
                    value={nextStageForm.nextOperationId}
                    onChange={(val) => setNextStageForm({ ...nextStageForm, nextOperationId: val })}
                    placeholder="Welding"
                  />
                </FormControl>
                <FormControl label="Assign Operator">
                  <SearchableSelect
                    options={users.map(u => ({ value: u.id, label: u.username }))}
                    value={nextStageForm.assignOperatorId}
                    onChange={(val) => setNextStageForm({ ...nextStageForm, assignOperatorId: val })}
                    placeholder="Search Operator..."
                  />
                </FormControl>
                <FormControl label="Target Warehouse" required>
                  <SearchableSelect
                    options={warehouses.map(w => ({ value: w.id, label: w.warehouse_name }))}
                    value={nextStageForm.targetWarehouseId}
                    onChange={(val) => setNextStageForm({ ...nextStageForm, targetWarehouseId: val })}
                    placeholder="Select Destination"
                  />
                </FormControl>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Mode:</label>
                  <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-lg w-fit">
                    <button 
                      onClick={() => setNextStageForm({ ...nextStageForm, executionMode: 'In-house' })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${nextStageForm.executionMode === 'In-house' ? 'bg-white border border-indigo-100 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${nextStageForm.executionMode === 'In-house' ? 'bg-indigo-500' : 'border-2 border-slate-300'}`}></span>
                      In-house
                    </button>
                    <button 
                      onClick={() => setNextStageForm({ ...nextStageForm, executionMode: 'Outsource' })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${nextStageForm.executionMode === 'Outsource' ? 'bg-white border border-indigo-100 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${nextStageForm.executionMode === 'Outsource' ? 'bg-indigo-500' : 'border-2 border-slate-300'}`}></span>
                      Outsource
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Daily Production Report Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Daily Production Report</h2>
              </div>
              <button 
                onClick={handleDownloadReport}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100"
              >
                <Download className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Download CSV</span>
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 italic px-1">Consolidated daily and shift-wise production metrics</p>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-12 flex items-center justify-center bg-slate-50/20">
                {logs.timeLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No data available</p>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Date</th>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Shift</th>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Produced</th>
                          <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Operator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {logs.timeLogs.slice(0, 10).map(log => (
                          <tr key={log.id}>
                            <td className="px-4 py-3 font-medium text-slate-700">{new Date(log.log_date).toLocaleDateString('en-GB')}</td>
                            <td className="px-4 py-3 text-slate-600">{log.shift}</td>
                            <td className="px-4 py-3 font-bold text-indigo-600">{parseFloat(log.produced_qty).toFixed(3)}</td>
                            <td className="px-4 py-3 text-slate-600">{log.operator_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Rows per page:</span>
                  <select className="bg-transparent outline-none cursor-pointer">
                    <option>10</option>
                  </select>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Page 1 of {Math.ceil(logs.timeLogs.length / 10) || 0} <span className="text-slate-300 ml-1">({logs.timeLogs.length} total)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-slate-300" disabled><ChevronLeft className="w-4 h-4" /></button>
                    <button className="px-4 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-colors">Next</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* View Time Log Modal */}
        <Modal
          isOpen={!!viewingTimeLog}
          onClose={() => setViewingTimeLog(null)}
          title="View Time Log"
          maxWidth="max-w-xl"
        >
          {viewingTimeLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date & Shift</p>
                  <p className="text-sm font-bold text-slate-700">
                    {new Date(viewingTimeLog.log_date).toLocaleDateString('en-GB')} - {viewingTimeLog.shift}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Operator</p>
                  <p className="text-sm font-bold text-slate-700">{viewingTimeLog.operator_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Interval</p>
                  <p className="text-sm font-bold text-slate-700">
                    {viewingTimeLog.start_time?.slice(11, 16)} - {viewingTimeLog.end_time?.slice(11, 16)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Produced Quantity</p>
                  <p className="text-sm font-bold text-indigo-600">
                    {parseFloat(viewingTimeLog.produced_qty).toFixed(3)} Units
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  onClick={() => setViewingTimeLog(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
        {/* View Quality Log Modal */}
        <Modal
          isOpen={!!viewingQualityLog}
          onClose={() => setViewingQualityLog(null)}
          title="View Quality Log"
          maxWidth="max-w-xl"
        >
          {viewingQualityLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date & Shift</p>
                  <p className="text-sm font-bold text-slate-700">
                    {new Date(viewingQualityLog.check_date).toLocaleDateString('en-GB')} - {viewingQualityLog.shift}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Inspected Quantity</p>
                  <p className="text-sm font-bold text-slate-700">{viewingQualityLog.inspected_qty} Units</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Accepted Quantity</p>
                  <p className="text-sm font-bold text-emerald-600">{viewingQualityLog.accepted_qty} Units</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rejected Quantity</p>
                  <p className="text-sm font-bold text-rose-600">{viewingQualityLog.rejected_qty} Units</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rejection Reason</p>
                  <p className="text-sm font-medium text-slate-600">{viewingQualityLog.rejection_reason || 'N/A'}</p>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  onClick={() => setViewingQualityLog(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  };

  const handleOutwardChallan = (jc) => {
    setSelectedJCOutward(jc);
    setOutwardFormData({
      vendorId: '',
      operationName: jc.operation_name || '',
      plannedQty: jc.planned_qty || 0,
      expectedReturnDate: '',
      dispatchQty: jc.planned_qty || 0,
      dispatchNotes: '',
      materialItems: []
    });
    setIsOutwardModalOpen(true);
  };

  const handleReadyForDispatch = async () => {
    try {
      // Check if all quality logs are approved
      const hasPendingQuality = logs.qualityLogs.some(log => log.status !== 'APPROVED');
      if (hasPendingQuality) {
        errorToast('All quality inspection records must be Approved before proceeding to the next stage.');
        return;
      }

      const result = await Swal.fire({
        title: 'Ready for Dispatch?',
        text: "This will mark the current operation as complete and prepare for the next stage.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Mark Ready'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        // Update status to COMPLETED
        const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/progress`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            status: 'COMPLETED',
            endTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
          })
        });

        if (response.ok) {
          successToast('Job Card marked as COMPLETED');
          setShowProductionEntry(false);
          fetchJobCards();
        } else {
          errorToast('Failed to update status');
        }
      }
    } catch (error) {
      errorToast('Failed to mark ready for dispatch');
    }
  };

  const handleDownloadReport = () => {
    if (!selectedJC || logs.timeLogs.length === 0) {
      errorToast('No data available to download');
      return;
    }

    const headers = ['Day', 'Date', 'Shift', 'Operator', 'Produced Qty'];
    const csvData = logs.timeLogs.map((log, index) => [
      index + 1,
      new Date(log.log_date).toLocaleDateString('en-GB'),
      log.shift,
      log.operator_name,
      log.produced_qty
    ]);

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Production_Report_${selectedJC.job_card_no}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    successToast('Report downloaded successfully');
  };

  const addTimeLog = async (logData) => {
    if (!logData.operatorId || !logData.workstationId) {
      errorToast('Please select Operator and Workstation');
      return;
    }
    if (logData.producedQty <= 0) {
      errorToast('Please enter Produce Quantity');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const formatTime = (time, ampm) => {
        if (!time) return '00:00:00';
        let [hours, minutes] = time.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      };

      const payload = {
        jobCardId: selectedJC.id, // Explicitly include jcId just in case
        day: logData.day,
        logDate: logData.logDate,
        operatorId: logData.operatorId,
        workstationId: logData.workstationId,
        shift: logData.shift,
        startTime: formatTime(logData.startTime, logData.startAMPM),
        endTime: formatTime(logData.endTime, logData.endAMPM),
        producedQty: logData.producedQty
      };

      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/time-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast('Time log recorded');
        await fetchLogs(selectedJC.id);
        fetchJobCards();
        // Reset form but keep Day and Date
        setTimeLogForm(prev => ({
          ...prev,
          producedQty: 0
        }));
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to record time log');
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
        setQualityLogForm(prev => ({
          ...prev,
          inspectedQty: 0,
          acceptedQty: 0,
          rejectedQty: 0,
          scrapQty: 0
        }));
      }
    } catch (error) {
      errorToast('Failed to record quality log');
    }
  };

  const deleteTimeLog = async (logId) => {
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
        const response = await fetch(`${API_BASE}/job-cards/time-logs/${logId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast('Time log deleted');
          await fetchLogs(selectedJC.id);
          fetchJobCards();
        } else {
          errorToast('Failed to delete time log');
        }
      }
    } catch (error) {
      errorToast('Failed to delete time log');
    }
  };

  const updateTimeLog = async (logId, logData) => {
    try {
      const token = localStorage.getItem('authToken');
      
      const formatTime = (time, ampm) => {
        if (!time) return '00:00:00';
        let [hours, minutes] = time.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      };

      const payload = {
        day: logData.day,
        logDate: logData.logDate,
        operatorId: logData.operatorId,
        shift: logData.shift,
        startTime: formatTime(logData.startTime, logData.startAMPM),
        endTime: formatTime(logData.endTime, logData.endAMPM),
        producedQty: logData.producedQty
      };

      const response = await fetch(`${API_BASE}/job-cards/time-logs/${logId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast('Time log updated');
        setEditingTimeLogId(null);
        await fetchLogs(selectedJC.id);
        fetchJobCards();
      } else {
        errorToast('Failed to update time log');
      }
    } catch (error) {
      errorToast('Failed to update time log');
    }
  };

  const updateQualityLog = async (logId, logData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/quality-logs/${logId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(logData)
      });

      if (response.ok) {
        successToast('Quality log updated');
        setEditingQualityLogId(null);
        await fetchLogs(selectedJC.id);
        fetchJobCards();
      } else {
        errorToast('Failed to update quality log');
      }
    } catch (error) {
      errorToast('Failed to update quality log');
    }
  };

  const deleteQualityLog = async (logId) => {
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
        const response = await fetch(`${API_BASE}/job-cards/quality-logs/${logId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast('Quality log deleted');
          await fetchLogs(selectedJC.id);
          fetchJobCards();
        } else {
          errorToast('Failed to delete quality log');
        }
      }
    } catch (error) {
      errorToast('Failed to delete quality log');
    }
  };

  const addDowntimeLog = async (logData) => {
    try {
      const token = localStorage.getItem('authToken');
      
      const formatTime = (time, ampm) => {
        if (!time) return '00:00:00';
        let [hours, minutes] = time.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      };

      const payload = {
        ...logData,
        startTime: formatTime(logData.startTime, logData.startAMPM),
        endTime: formatTime(logData.endTime, logData.endAMPM)
      };

      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/downtime-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        successToast('Downtime log recorded');
        await fetchLogs(selectedJC.id);
        // Reset form but keep Day and Date
        setDowntimeLogForm(prev => ({
          ...prev,
          remarks: ''
        }));
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to record downtime log');
      }
    } catch (error) {
      errorToast('Failed to record downtime log');
    }
  };

  const deleteDowntimeLog = async (logId) => {
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
        const response = await fetch(`${API_BASE}/job-cards/downtime-logs/${logId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          successToast('Downtime log deleted');
          await fetchLogs(selectedJC.id);
        } else {
          errorToast('Failed to delete downtime log');
        }
      }
    } catch (error) {
      errorToast('Failed to delete downtime log');
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

  const handleCreateOutwardChallan = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/outward-challans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...outwardFormData,
          jobCardId: selectedJCOutward.id,
          workOrderId: selectedJCOutward.work_order_id
        })
      });

      if (response.ok) {
        successToast('Outward Challan created successfully');
        setIsOutwardModalOpen(false);
        fetchJobCards();
      } else {
        errorToast('Failed to create outward challan');
      }
    } catch (error) {
      console.error('Error creating outward challan:', error);
      errorToast('Error creating outward challan');
    }
  };

  const handleVendorInward = async () => {
    try {
      const token = localStorage.getItem('authToken');
      // We will reuse the quality-logs endpoint to record the receipt and inspection from vendor
      const response = await fetch(`${API_BASE}/job-cards/${selectedJCOutward.id}/quality-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          checkDate: inwardFormData.receivedDate,
          shift: 'SHIFT_A',
          inspectedQty: inwardFormData.receivedQty,
          acceptedQty: inwardFormData.acceptedQty,
          rejectedQty: inwardFormData.rejectedQty,
          scrapQty: inwardFormData.scrapQty,
          rejectionReason: inwardFormData.remarks,
          notes: `Vendor Receipt from ${selectedJCOutward.outward_challan_no}`,
          status: 'APPROVED'
        })
      });

      if (response.ok) {
        // Also update the job card status to completed if everything is received
        await handleUpdateStatus(selectedJCOutward.id, 'COMPLETED');
        successToast('Vendor Receipt recorded successfully');
        setIsInwardModalOpen(false);
        fetchJobCards();
      } else {
        errorToast('Failed to record vendor receipt');
      }
    } catch (error) {
      console.error('Error recording vendor receipt:', error);
      errorToast('Error recording vendor receipt');
    }
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
      {!showProductionEntry ? (
        <>
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
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">ID</th>
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-indigo-600">
                        {jc.job_card_no}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        WO: {jc.wo_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{jc.operation_name}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">{jc.item_name}</span>
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
                    <span className={`text-[11px] font-medium ${jc.outward_challan_id ? 'text-amber-600' : 'text-blue-600'}`}>
                      {jc.outward_challan_id ? 'Subcontract' : 'In-house'}
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
                    <span className={`text-[11px] ${jc.outward_challan_id ? 'text-purple-600 font-semibold' : 'text-slate-600'}`}>
                      {jc.outward_challan_id ? 'Subcontract' : (jc.workstation_name || 'N/A')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] ${jc.outward_challan_id ? 'text-purple-600 font-semibold' : 'text-slate-600'}`}>
                      {jc.outward_challan_id ? 'N/A' : (jc.operator_name || 'Unassigned')}
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
                      {jc.outward_challan_id ? (
                        <button 
                          onClick={() => {
                            setSelectedJCOutward(jc);
                            setInwardFormData(prev => ({
                              ...prev,
                              receivedQty: jc.dispatch_qty || jc.planned_qty,
                              acceptedQty: jc.dispatch_qty || jc.planned_qty
                            }));
                            setIsInwardModalOpen(true);
                          }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          title="Vendor Receipt (Inward)"
                        >
                          <Package className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleOutwardChallan(jc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                          title="Outward Challan"
                        >
                          <Truck className="w-3.5 h-3.5" />
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
        </>
      ) : (
        renderProductionEntry()
      )}

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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 tracking-widest">Unit</span>
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

      {/* Existing Modals */}
      <Modal 
        isOpen={isOutwardModalOpen} 
        onClose={() => setIsOutwardModalOpen(false)} 
        title="Outward Challan"
        size="2xl"
      >
        <div className="p-1 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Dispatch Job Card {selectedJCOutward?.job_card_no} to Vendor</h3>
              <p className="text-xs text-slate-500">Create an outward challan for subcontracted operations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Operation">
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700">
                {outwardFormData.operationName}
              </div>
            </FormControl>
            <FormControl label="Quantity">
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700">
                {outwardFormData.plannedQty} units
              </div>
            </FormControl>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-amber-800">
              <User className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Assign Vendor</span>
            </div>
            <SearchableSelect
              options={vendors.map(v => ({ value: v.id, label: v.vendor_name, category: v.category }))}
              value={outwardFormData.vendorId}
              onChange={(e) => setOutwardFormData({ ...outwardFormData, vendorId: e.target.value })}
              placeholder="Search and select vendor..."
              subLabelField="category"
              allowCustom={false}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <ClipboardList className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Required Material Release</span>
              </div>
              <button 
                onClick={() => setOutwardFormData({
                  ...outwardFormData,
                  materialItems: [...outwardFormData.materialItems, { itemCode: '', requiredQty: 0, releaseQty: 0 }]
                })}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest px-2 py-1 bg-indigo-50 rounded"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            
            <div className="border border-slate-100 rounded-lg">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Item Code</th>
                    <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-center">Required Qty</th>
                    <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-center">Release Qty</th>
                    <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outwardFormData.materialItems.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-3 py-4 text-center text-slate-400 italic">No materials added</td>
                    </tr>
                  ) : (
                    outwardFormData.materialItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1.5 min-w-[200px]">
                          <SearchableSelect
                            options={combinedItems}
                            value={item.itemCode}
                            onChange={(e) => {
                              const newItems = [...outwardFormData.materialItems];
                              newItems[idx].itemCode = e.target.value;
                              setOutwardFormData({ ...outwardFormData, materialItems: newItems });
                            }}
                            placeholder="Select Item..."
                            subLabelField="itemName"
                            allowCustom={false}
                            openUpwards={idx >= 1}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input 
                            type="number" 
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-center outline-none focus:border-indigo-500"
                            value={item.requiredQty}
                            onChange={(e) => {
                              const newItems = [...outwardFormData.materialItems];
                              newItems[idx].requiredQty = e.target.value;
                              setOutwardFormData({ ...outwardFormData, materialItems: newItems });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input 
                            type="number" 
                            className="w-20 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-center text-indigo-600 outline-none"
                            value={item.releaseQty}
                            onChange={(e) => {
                              const newItems = [...outwardFormData.materialItems];
                              newItems[idx].releaseQty = e.target.value;
                              setOutwardFormData({ ...outwardFormData, materialItems: newItems });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button 
                            onClick={() => {
                              const newItems = outwardFormData.materialItems.filter((_, i) => i !== idx);
                              setOutwardFormData({ ...outwardFormData, materialItems: newItems });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Expected Return Date">
              <div className="relative">
                <input 
                  type="date" 
                  value={outwardFormData.expectedReturnDate}
                  onChange={(e) => setOutwardFormData({ ...outwardFormData, expectedReturnDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </FormControl>
            <FormControl label="Dispatch Quantity">
              <div className="relative">
                <input 
                  type="number" 
                  value={outwardFormData.dispatchQty}
                  onChange={(e) => setOutwardFormData({ ...outwardFormData, dispatchQty: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">Units</span>
              </div>
            </FormControl>
          </div>

          <FormControl label="Dispatch Notes">
            <textarea 
              rows="2"
              placeholder="Any specific instructions for the vendor..."
              value={outwardFormData.dispatchNotes}
              onChange={(e) => setOutwardFormData({ ...outwardFormData, dispatchNotes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 resize-none"
            />
          </FormControl>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsOutwardModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateOutwardChallan}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-100"
            >
              <CheckCircle className="w-4 h-4" />
              Create Outward Challan
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isInwardModalOpen} 
        onClose={() => setIsInwardModalOpen(false)} 
        title="Vendor Receipt (Inward)"
        size="xl"
      >
        <div className="p-1 space-y-6">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Receive Job Card {selectedJCOutward?.job_card_no} from Vendor</h3>
              <p className="text-xs text-slate-500">Challan No: {selectedJCOutward?.outward_challan_no}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Received Date">
              <input 
                type="date" 
                value={inwardFormData.receivedDate}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500"
              />
            </FormControl>
            <FormControl label="Received Quantity">
              <input 
                type="number" 
                value={inwardFormData.receivedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedQty: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormControl label="Accepted Qty">
              <input 
                type="number" 
                value={inwardFormData.acceptedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, acceptedQty: e.target.value })}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-700 outline-none"
              />
            </FormControl>
            <FormControl label="Rejected Qty">
              <input 
                type="number" 
                value={inwardFormData.rejectedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, rejectedQty: e.target.value })}
                className="w-full px-3 py-2 bg-rose-50 border border-rose-100 rounded text-xs text-rose-700 outline-none"
              />
            </FormControl>
            <FormControl label="Scrap Qty">
              <input 
                type="number" 
                value={inwardFormData.scrapQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, scrapQty: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 outline-none"
              />
            </FormControl>
          </div>

          <FormControl label="Remarks / Rejection Reason">
            <textarea 
              rows="2"
              placeholder="Enter receipt notes or rejection reasons..."
              value={inwardFormData.remarks}
              onChange={(e) => setInwardFormData({ ...inwardFormData, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500 resize-none"
            />
          </FormControl>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsInwardModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={handleVendorInward}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-100"
            >
              <CheckCircle className="w-4 h-4" />
              Complete Receipt
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


