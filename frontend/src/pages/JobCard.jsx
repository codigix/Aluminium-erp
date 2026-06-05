import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, Tabs, Button, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import {
  ClipboardList, Activity, CheckCircle, TrendingUp, Calendar,
  Play, Check, Edit2, Trash2, Filter, Plus, X, Pause, Square,
  Clock, Package, User, Monitor, AlertCircle, ChevronDown, ChevronRight, ChevronLeft,
  DollarSign, Zap, Eye, Truck, Box, Target, Layers, ArrowRight, FileText, History,
  AlertTriangle, Download, BarChart2, ShieldCheck, Info, Save, Upload
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast } from '../utils/toast';
import { cleanProjectName } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const TimePicker = ({ value, ampmValue, onTimeChange, onAMPMChange, label, small = false, placeholder = '08:00', placeholderAMPM = 'AM', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const isPlaceholder = !value || !ampmValue;
  const displayTime = value || placeholder;
  const displayAMPM = ampmValue || placeholderAMPM;

  const hour = displayTime?.split(':')[0] || '08';
  const minute = displayTime?.split(':')[1] || '00';

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periods = ['AM', 'PM'];

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerHeight = 256; // h-64
      const viewportHeight = window.innerHeight;

      const spaceBelow = viewportHeight - rect.bottom;
      const shouldOpenAbove = spaceBelow < pickerHeight && rect.top > pickerHeight;

      setCoords({
        top: shouldOpenAbove ? -1 : 1, // Indicator for above/below
        width: Math.max(rect.width, small ? 150 : 180)
      });
    }
  }, [isOpen, small]);

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative w-full" ref={triggerRef}>
      <div
        onClick={toggleOpen}
        className={`flex items-center gap-1.5 border border-slate-200 rounded transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 ${small ? 'px-2 py-1' : 'px-3 py-2'} ${disabled
          ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100'
          : 'bg-white cursor-pointer hover:border-indigo-400'
          }`}
      >
        <Clock className={`${small ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-400`} />
        <span className={`${small ? 'text-xs ' : 'text-xs'}  ${isPlaceholder ? 'text-slate-400' : disabled ? 'text-slate-400' : 'text-slate-700'}`}>
          {hour}:{minute} {displayAMPM}
        </span>
        <ChevronDown className={`${small ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-slate-400 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <div
            style={{
              position: 'absolute',
              top: coords.top === -1 ? 'auto' : 'calc(100% + 4px)',
              bottom: coords.top === -1 ? 'calc(100% + 4px)' : 'auto',
              left: '0',
              minWidth: `${coords.width}px`
            }}
            className="z-[101] bg-white border border-slate-200 rounded shadow-2xl flex overflow-hidden h-64 animate-in fade-in zoom-in-95 duration-200 origin-top"
          >
            {/* Hours */}
            <div className="flex-1 overflow-y-auto scrollbar-hide border-r border-slate-50 py-1 bg-white">
              {hours.map(h => (
                <div
                  key={h}
                  onClick={() => onTimeChange(`${h}:${minute}`)}
                  className={`px-3 py-2 text-xs text-center cursor-pointer transition-colors ${hour === h ? 'bg-indigo-600 text-white ' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {h}
                </div>
              ))}
            </div>
            {/* Minutes */}
            <div className="flex-1 overflow-y-auto scrollbar-hide border-r border-slate-50 py-1 bg-white">
              {minutes.map(m => (
                <div
                  key={m}
                  onClick={() => onTimeChange(`${hour}:${m}`)}
                  className={`px-3 py-2 text-xs text-center cursor-pointer transition-colors ${minute === m ? 'bg-indigo-600 text-white ' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {m}
                </div>
              ))}
            </div>
            {/* AM/PM */}
            <div className="flex-1 py-1 bg-slate-50/50">
              {periods.map(p => (
                <div
                  key={p}
                  onClick={() => onAMPMChange(p)}
                  className={`px-3 py-2 text-xs text-center cursor-pointer transition-colors ${displayAMPM === p ? 'bg-indigo-600 text-white ' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const JobCard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [searchParams] = useSearchParams();
  const [jobCards, setJobCards] = useState([]);
  const [liveAllocations, setLiveAllocations] = useState([]);
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
  const isShipmentOp = (jc) => {
    if (!jc) return false;
    const opName = (jc.operation_name || '').toLowerCase();
    const opType = (jc.operation_type || '').toLowerCase();
    return opName === 'shipment' || opName === 'dispatch' || opType === 'dispatch';
  };
  const calculateDayOffset = (jc, targetDateStr) => {
    if (!jc) return 1;
    const todayStr = new Date().toISOString().slice(0, 10);
    const startDateStr = jc.actual_start_date || jc.created_at || jc.start_time || todayStr;
    const d1 = new Date(startDateStr);
    const d2 = new Date(targetDateStr);
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
  };
  const [shipmentForm, setShipmentForm] = useState({
    dispatchMode: 'Partial',
    dispatchDate: new Date().toISOString().split('T')[0],
    sourceWarehouseId: '',
    targetWarehouseId: '',
    dispatchQty: 0,
    carrierName: '',
    trackingNumber: '',
    shippingNotes: '',
    enableAutoTransfer: false
  });
  const [expandedWOs, setExpandedWOs] = useState(new Set());
  const [isOutwardModalOpen, setIsOutwardModalOpen] = useState(false);
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [selectedJCOutward, setSelectedJCOutward] = useState(null);
  const [logs, setLogs] = useState({ timeLogs: [], qualityLogs: [], downtimeLogs: [] });
  const qcStats = useMemo(() => {
    const totalProduced = (logs.timeLogs || []).reduce((sum, log) => sum + parseFloat(log.produced_qty || 0), 0);
    const totalInspected = (logs.qualityLogs || []).reduce((sum, log) => sum + parseFloat(log.inspected_qty || 0), 0);
    const totalAccepted = (logs.qualityLogs || []).reduce((sum, log) => sum + parseFloat(log.accepted_qty || 0), 0);
    const totalRejected = (logs.qualityLogs || []).reduce((sum, log) => sum + parseFloat(log.rejected_qty || 0), 0);
    const totalScrap = (logs.qualityLogs || []).reduce((sum, log) => sum + parseFloat(log.scrap_qty || 0), 0);
    const hasPending = (logs.qualityLogs || []).some(log => log.status !== 'APPROVED');
    const isComplete = totalInspected >= totalProduced && totalProduced > 0;

    return {
      totalProduced,
      totalInspected,
      totalAccepted,
      totalRejected,
      totalScrap,
      hasPending,
      isComplete,
      isApproved: (logs.qualityLogs || []).length > 0 && !hasPending
    };
  }, [logs]);
  const [machineStatus, setMachineStatus] = useState("AVAILABLE"); // AVAILABLE, RUNNING, STOPPED
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Update every minute for live timer
    return () => clearInterval(interval);
  }, []);

  const [inwardFormData, setInwardFormData] = useState({
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    remarks: '',
    receivedDate: new Date().toLocaleDateString('en-CA'),
    inwardItems: [],
    vendorInvoice: null
  });

  const [outwardFormData, setOutwardFormData] = useState({
    vendorId: '',
    operationName: '',
    plannedQty: 0,
    expectedReturnDate: '',
    dispatchDate: new Date().toISOString().split('T')[0],
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
    remarks: '',
    executionMode: 'In-house', // 'In-house' or 'Outsource'
    vendorId: '',
    vendorRate: 0,
    status: 'PENDING',
    producedQty: 0,
    acceptedQty: 0,
    stdTime: 0,
    timeUom: 'Min',
    startDateTime: '',
    endDateTime: '',
    startTime: '08:00',
    startAMPM: 'AM',
    endTime: '04:00',
    endAMPM: 'PM',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    latestLogStartTime: null
  });

  const formatDisplayDate = value => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatLocalTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(String(isoString).replace(' ', 'T'));
    if (isNaN(date.getTime())) return isoString;

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const formatDateTimeShort = (isoString) => {
    if (!isoString) return '';
    const date = new Date(String(isoString).replace(' ', 'T'));
    if (isNaN(date.getTime())) return isoString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const formattedHours = String(hours).padStart(2, '0');

    return `${day}/${month} ${formattedHours}:${minutes} ${ampm}`;
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

  const calculateISODuration = (startISO, endISO) => {
    if (!startISO || !endISO) return 0;
    const start = new Date(startISO);
    const end = new Date(endISO);
    let diff = Math.round((end - start) / (1000 * 60));
    if (diff <= 0) diff += 24 * 60;
    return diff;
  };

  const to12h = (time24) => {
    if (!time24) return { time: '08:00', ampm: 'AM' };
    let [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, ampm };
  };

  const to24h = (time12, ampm) => {
    if (!time12 || !ampm) return '08:00';
    let [h, m] = time12.split(':').map(Number);
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getHours = (timeStr) => timeStr?.split(':')[0] || '08';
  const getMinutes = (timeStr) => timeStr?.split(':')[1] || '00';

  const handleManualTimeChange = (field, part, val, setForm) => {
    setForm(prev => {
      let [h, m] = (prev[field] || '08:00').split(':');
      if (part === 'h') h = val;
      else if (part === 'm') m = val;
      return { ...prev, [field]: `${h}:${m}` };
    });
  };

  const handleTimeChange = (field, val, setForm) => {
    if (!val) {
      setForm(prev => ({ ...prev, [field]: val }));
      return;
    }
    const { time, ampm } = to12h(val);
    const ampmField = field.replace('Time', 'AMPM');
    setForm(prev => ({ ...prev, [field]: time, [ampmField]: ampm }));
  };

  const parseTimeToMinutes = (timeStr, ampm) => {
    if (!timeStr) return 0;
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const parse12hMinutes = (time12h) => {
    if (!time12h || time12h === '--:--') return 0;
    const parts = time12h.split(' ');
    if (parts.length < 2) return 0;
    return parseTimeToMinutes(parts[0], parts[1]);
  };

  const checkDateTimeOverlap = (startAStr, endAStr, startBStr, endBStr) => {
    if (!startAStr || !endAStr || !startBStr || !endBStr) return false;
    const parse = (str) => new Date(str.replace(' ', 'T'));
    const startA = parse(startAStr);
    const endA = parse(endAStr);
    const startB = parse(startBStr);
    const endB = parse(endBStr);
    if (isNaN(startA.getTime()) || isNaN(endA.getTime()) || isNaN(startB.getTime()) || isNaN(endB.getTime())) {
      return false;
    }
    return startA < endB && endA > startB;
  };

  const calculateModalStdTimeSuggestion = () => {
    const selectedOp = operations.find(op => String(op.id) === String(formData.operationId));
    if (!selectedOp && !formData.stdTime) return 0;

    let netTime = parseFloat(formData.stdTime) || (selectedOp ? (parseFloat(selectedOp.cycle_time) || parseFloat(selectedOp.std_time) || 0) : 0);
    let timeUom = parseFloat(formData.stdTime) > 0 ? formData.timeUom : (selectedOp?.time_uom || 'Min');

    if (timeUom === 'Hr') netTime *= 60;
    else if (timeUom === 'Sec') netTime /= 60;

    const planned = parseFloat(formData.plannedQty || 0);
    const produced = parseFloat(formData.producedQty || 0);
    const qty = Math.max(0, planned - produced);

    const setupTime = parseFloat(selectedOp?.setup_time || 0);

    return Math.round((netTime * qty) + setupTime);
  };

  const calculateSuggestedEndDateTime = (startDate, startTime, startAMPM, plannedQty, producedQty, stdTime, timeUom) => {
    try {
      const planned = parseFloat(plannedQty || 0);
      const produced = parseFloat(producedQty || 0);
      const qty = Math.max(0, planned - produced);

      let cycleTime = parseFloat(stdTime || 0);
      const uom = (timeUom || 'Min').toLowerCase();
      if (uom === 'hr') {
        cycleTime *= 60;
      } else if (uom === 'sec') {
        cycleTime /= 60;
      }

      const requiredMins = Math.round(cycleTime * qty);
      if (requiredMins <= 0) {
        return {
          startDate,
          startTime,
          startAMPM,
          endDate: startDate,
          endTime: startTime,
          endAMPM: startAMPM
        };
      }

      const start24 = to24h(startTime || '08:00', startAMPM || 'AM');
      let start = new Date(`${startDate}T${start24}:00`);
      if (isNaN(start.getTime())) {
        return { startDate, startTime, startAMPM };
      }

      const getShiftStart = (dateStr) => new Date(`${dateStr}T08:00:00`);
      const getShiftEnd = (dateStr) => new Date(`${dateStr}T20:00:00`);

      const formatDateStr = (d) => {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      };

      let currentDateStr = startDate;
      let currentStart = new Date(start.getTime());

      let shiftStart = getShiftStart(currentDateStr);
      let shiftEnd = getShiftEnd(currentDateStr);

      if (currentStart < shiftStart) {
        currentStart = new Date(shiftStart.getTime());
      } else if (currentStart > shiftEnd) {
        const nextDay = new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000);
        currentDateStr = formatDateStr(nextDay);
        currentStart = getShiftStart(currentDateStr);
        shiftStart = getShiftStart(currentDateStr);
        shiftEnd = getShiftEnd(currentDateStr);
      }

      let remMins = requiredMins;
      let finalEnd = null;

      while (remMins > 0) {
        const availableMins = Math.round((shiftEnd.getTime() - currentStart.getTime()) / 60000);
        if (remMins <= availableMins) {
          finalEnd = new Date(currentStart.getTime() + remMins * 60000);
          remMins = 0;
        } else {
          remMins -= availableMins;
          const nextDay = new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000);
          currentDateStr = formatDateStr(nextDay);
          currentStart = getShiftStart(currentDateStr);
          shiftStart = getShiftStart(currentDateStr);
          shiftEnd = getShiftEnd(currentDateStr);
        }
      }

      const finalEndDateStr = formatDateStr(finalEnd);
      const end24 = String(finalEnd.getHours()).padStart(2, '0') + ':' + String(finalEnd.getMinutes()).padStart(2, '0');
      const { time: finalEndTime, ampm: finalEndAMPM } = to12h(end24);

      return {
        startDate: formatDateStr(start),
        startTime,
        startAMPM,
        endDate: finalEndDateStr,
        endTime: finalEndTime,
        endAMPM: finalEndAMPM
      };
    } catch (e) {
      console.error('Error in calculateSuggestedEndDateTime:', e);
    }
    return { startDate, startTime, startAMPM };
  };

  const handleAutoSuggestEndDateTime = () => {
    const suggested = calculateSuggestedEndDateTime(
      formData.startDate,
      formData.startTime,
      formData.startAMPM,
      formData.plannedQty,
      formData.producedQty,
      formData.stdTime,
      formData.timeUom
    );
    if (suggested.endDate) {
      setFormData(prev => ({
        ...prev,
        endDate: suggested.endDate,
        endTime: suggested.endTime,
        endAMPM: suggested.endAMPM
      }));
    }
  };



  const calculateModalOverlapAlert = () => {
    if (formData.executionMode === 'Outsource') return null;
    if (!formData.startDate || !formData.startTime || !formData.endTime || !formData.workstationId) return null;

    const ws = workstations.find(w => String(w.id) === String(formData.workstationId));
    if (!ws) return null;
    const capacity = 1;

    const formStartStr = formData.startDate + 'T' + to24h(formData.startTime, formData.startAMPM) + ':00';
    const formEndStr = formData.endDate + 'T' + to24h(formData.endTime, formData.endAMPM) + ':00';

    // Filter other active/planned job cards on the same workstation using liveAllocations
    const overlappingWSActions = liveAllocations.filter(jc => {
      if (String(jc.id) === String(formData.id)) return false; // Skip current
      if (String(jc.workstation_id) !== String(formData.workstationId)) return false;

      return checkDateTimeOverlap(formStartStr, formEndStr, jc.start_time, jc.end_time);
    });

    if (overlappingWSActions.length >= capacity) {
      const firstOverlap = overlappingWSActions[0];
      const busyStartStr = firstOverlap ? formatLocalTime(firstOverlap.latest_log_start_time || firstOverlap.start_time) : '';
      const busyEndStr = firstOverlap ? getEstimatedEndTime(firstOverlap) : '';
      return `${ws.workstation_name} is already allocated to Job Card ${firstOverlap.job_card_no} from ${busyStartStr} to ${busyEndStr}. Please select another time slot.`;
    }

    if (formData.assignedTo) {
      const op = users.find(u => String(u.id) === String(formData.assignedTo));
      const overlappingOpActions = liveAllocations.filter(jc => {
        if (String(jc.id) === String(formData.id)) return false;
        if (String(jc.assigned_to) !== String(formData.assignedTo)) return false;

        return checkDateTimeOverlap(formStartStr, formEndStr, jc.start_time, jc.end_time);
      });

      if (overlappingOpActions.length > 0) {
        const firstOverlap = overlappingOpActions[0];
        const busyStartStr = firstOverlap ? formatLocalTime(firstOverlap.latest_log_start_time || firstOverlap.start_time) : '';
        const busyEndStr = firstOverlap ? getEstimatedEndTime(firstOverlap) : '';
        return `${op?.username || 'Selected User'} is already allocated to Job Card ${firstOverlap.job_card_no} from ${busyStartStr} to ${busyEndStr}. Please select another time slot.`;
      }
    }

    return null;
  };

  const calculateTotalMins = (start, startAMPM, end, endAMPM) => {
    try {
      if (!start || !end || start.includes('NaN') || end.includes('NaN')) return 0;
      if (start === end && startAMPM === endAMPM) return 0;

      const startMins = parseTimeToMinutes(start, startAMPM);
      const endMins = parseTimeToMinutes(end, endAMPM);

      if (isNaN(startMins) || isNaN(endMins)) return 0;

      let diff = endMins - startMins;
      if (diff < 0) diff += 24 * 60; // Handle overnight shift
      return diff;
    } catch (e) {
      return 0;
    }
  };

  const consolidatedReport = useMemo(() => {
    if (!logs) return [];

    const reportMap = {};

    // Process Time Logs
    (logs.timeLogs || []).forEach(log => {
      const key = `${log.log_date}_${log.shift}`;
      if (!reportMap[key]) {
        reportMap[key] = {
          date: log.log_date,
          shift: log.shift,
          operator: log.operator_name,
          mins: 0,
          produced: 0,
          accepted: 0,
          rejected: 0,
          scrap: 0,
          downtime: 0,
          id: log.id,
          startTime: log.start_time,
          endTime: log.end_time
        };
      } else {
        if (log.start_time && (!reportMap[key].startTime || new Date(log.start_time) < new Date(reportMap[key].startTime))) {
          reportMap[key].startTime = log.start_time;
        }
        if (log.end_time && (!reportMap[key].endTime || new Date(log.end_time) > new Date(reportMap[key].endTime))) {
          reportMap[key].endTime = log.end_time;
        }
        if (log.operator_name && (!reportMap[key].operator || reportMap[key].operator === 'N/A')) {
          reportMap[key].operator = log.operator_name;
        }
      }
      reportMap[key].produced += parseFloat(log.produced_qty || 0);
      reportMap[key].mins += calculateISODuration(log.start_time, log.end_time);
    });

    // Process Quality Logs
    (logs.qualityLogs || []).forEach(log => {
      const key = `${log.check_date}_${log.shift}`;
      if (!reportMap[key]) {
        reportMap[key] = {
          date: log.check_date,
          shift: log.shift,
          operator: 'N/A',
          mins: 0,
          produced: 0,
          accepted: 0,
          rejected: 0,
          scrap: 0,
          downtime: 0,
          id: `q-${log.id}`
        };
      }
      reportMap[key].accepted += parseFloat(log.accepted_qty || 0);
      reportMap[key].rejected += parseFloat(log.rejected_qty || 0);
      reportMap[key].scrap += parseFloat(log.scrap_qty || 0);
    });

    // Process Downtime Logs
    (logs.downtimeLogs || []).forEach(log => {
      const key = `${log.downtime_date}_${log.shift}`;
      if (!reportMap[key]) {
        reportMap[key] = {
          date: log.downtime_date,
          shift: log.shift,
          operator: 'N/A',
          mins: 0,
          produced: 0,
          accepted: 0,
          rejected: 0,
          scrap: 0,
          downtime: 0,
          id: `d-${log.id}`
        };
      }
      reportMap[key].downtime += calculateISODuration(log.start_time, log.end_time);
    });

    return Object.values(reportMap).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [logs]);

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

  const fetchInwardItems = async (jobCardId, jcFallback = null) => {
    try {
      const token = localStorage.getItem('authToken');

      // 1. Fetch original outward items
      const response = await fetch(`${API_BASE}/outward-challans/job-card/${jobCardId}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // 2. Fetch existing inward challan from new endpoint
      const inwardRes = await fetch(`${API_BASE}/outward-challans/inward/job-card/${jobCardId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const outwardItems = await response.json();
        let existingInwardItems = [];
        let existingInward = null;

        if (inwardRes.ok) {
          existingInward = await inwardRes.json();
          existingInwardItems = existingInward.items || [];
        }

        // Map rates and release_qty from existing record if found, otherwise default to 0
        const itemsWithRate = outwardItems.map(item => {
          const matched = existingInwardItems.find(ei => ei.item_code === item.item_code);
          return {
            ...item,
            release_qty: matched ? matched.received_qty : (parseFloat(item.release_qty) || parseFloat(item.required_qty) || 0),
            rate: matched ? matched.rate : 0
          };
        });

        // Get job card fallback if needed
        const jc = jcFallback || jobCards.find(j => String(j.id) === String(jobCardId));

        setInwardFormData(prev => ({
          ...prev,
          inwardItems: itemsWithRate,
          receivedDate: existingInward ? existingInward.received_date.split('T')[0] : prev.receivedDate,
          remarks: existingInward ? (existingInward.notes || '') : prev.remarks,
          acceptedQty: jc && jc.status === 'COMPLETED' ? jc.accepted_qty : (existingInward ? existingInward.total_received_qty : prev.acceptedQty),
          receivedQty: existingInward ? existingInward.total_received_qty : prev.receivedQty,
          rejectedQty: jc && jc.status === 'COMPLETED' ? jc.rejected_qty : (existingInward ? 0 : prev.rejectedQty),
          scrapQty: existingInward ? 0 : prev.scrapQty
        }));
      }
    } catch (error) {
      console.error('Error fetching inward items:', error);
    }
  };

  useEffect(() => {
    // Auto Suggest End Time logic
    const hasLogProcessStarted = formData.id && (formData.status === 'COMPLETED' || parseFloat(formData.producedQty || 0) > 0 || formData.latestLogStartTime);

    if (!hasLogProcessStarted && formData.executionMode === 'In-house' && formData.startTime && formData.operationId && formData.plannedQty) {
      const operation = operations.find(o => String(o.id) === String(formData.operationId));
      let netTime = parseFloat(formData.stdTime || operation?.net_time || operation?.std_time || 0);
      let timeUom = formData.stdTime > 0 ? formData.timeUom : (operation?.time_uom || 'Min');

      // Convert to minutes if UOM is Hr or Sec
      if (timeUom === 'Hr') netTime *= 60;
      else if (timeUom === 'Sec') netTime /= 60;

      if (netTime > 0) {
        const start24 = to24h(formData.startTime, formData.startAMPM);
        const start = new Date(`${formData.startDate}T${start24}:00`);

        if (!isNaN(start.getTime())) {
          const planned = parseFloat(formData.plannedQty || 0);
          const produced = parseFloat(formData.producedQty || 0);
          const qty = Math.max(0, planned - produced);
          const totalMins = Math.round(netTime * qty);
          const end = new Date(start.getTime() + totalMins * 60000);

          const endDate = end.getFullYear() + '-' + (end.getMonth() + 1).toString().padStart(2, '0') + '-' + end.getDate().toString().padStart(2, '0');
          const end24 = end.getHours().toString().padStart(2, '0') + ':' + end.getMinutes().toString().padStart(2, '0');
          const { time: endTime, ampm: endAMPM } = to12h(end24);

          if (formData.endDate !== endDate || formData.endTime !== endTime || formData.endAMPM !== endAMPM) {
            setFormData(prev => ({
              ...prev,
              endDate,
              endTime,
              endAMPM
            }));
          }
        }
      }
    }
  }, [formData.startTime, formData.startAMPM, formData.startDate, formData.operationId, formData.plannedQty, formData.producedQty, formData.executionMode, formData.id, formData.status, operations]);

  useEffect(() => {
    if (isModalOpen) {
      fetchLiveAllocations();
    }
  }, [
    isModalOpen,
    formData.startDate,
    formData.startTime,
    formData.startAMPM,
    formData.endDate,
    formData.endTime,
    formData.endAMPM
  ]);

  const fetchLiveAllocations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/active-allocations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLiveAllocations(data);
      }
    } catch (error) {
      console.error('Error fetching active allocations:', error);
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
        fetchLiveAllocations();

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
      label: `${i.item_code} | ${i.material_name || i.item_description || ''}`,
      itemName: '',
      type: 'Stock'
    }));

    return itemOptions;
  }, [items]);

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

  const getSourcePriority = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('assembly') || t === 'sa') return 1;
    if (t.includes('semi') || t === 'sfg') return 2;
    if (t.includes('finish') || t === 'fg') return 3;
    return 4;
  };

  const filteredJobCards = useMemo(() => {
    // Show Job Cards for Finished Goods (FG) and Sub-Assemblies (SA)
    const allowedSourceTypes = ['FG', 'SA', 'SFG', 'Sub Assembly', 'Finished Goods'];
    const filteredBySource = jobCards.filter(jc => allowedSourceTypes.includes(jc.source_type));

    let result = filteredBySource;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = filteredBySource.filter(jc =>
        jc.job_card_no?.toLowerCase().includes(query) ||
        jc.wo_number?.toLowerCase().includes(query) ||
        jc.operation_name?.toLowerCase().includes(query) ||
        jc.operator_name?.toLowerCase().includes(query)
      );
    }

    // 1. Group items by batch and find the latest ID in each batch
    const groups = {};
    result.forEach(jc => {
      const groupKey = jc.plan_id ? `plan_${jc.plan_id}` : (jc.parent_wo_id ? `parent_${jc.parent_wo_id}` : `wo_${jc.work_order_id}`);
      if (!groups[groupKey]) {
        groups[groupKey] = { latestId: 0, items: [] };
      }
      groups[groupKey].items.push(jc);
      const currentId = Number(jc.id) || 0;
      if (currentId > groups[groupKey].latestId) {
        groups[groupKey].latestId = currentId;
      }
    });

    // 2. Sort groups by their latest ID (newest batch first)
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => groups[b].latestId - groups[a].latestId);

    // 3. Within each group, sort by SA first, then ID ASC
    const finalResult = [];
    sortedGroupKeys.forEach(key => {
      const groupedItems = groups[key].items.sort((a, b) => {
        const aPrio = getSourcePriority(a.source_type);
        const bPrio = getSourcePriority(b.source_type);
        if (aPrio !== bPrio) return aPrio - bPrio;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      });
      finalResult.push(...groupedItems);
    });

    return finalResult;
  }, [jobCards, searchQuery]);

  const groupedJobCards = useMemo(() => {
    const acc = {};
    const allowedSourceTypes = ['FG', 'SA', 'SFG', 'Sub Assembly', 'Finished Goods'];
    const query = searchQuery.toLowerCase();

    // 1. Group Work Orders and find latest ID in each batch for sorting
    const woGroups = {};
    workOrders.forEach(wo => {
      if (!allowedSourceTypes.includes(wo.source_type)) return;
      const matchesSearch = !searchQuery ||
        wo.wo_number?.toLowerCase().includes(query) ||
        wo.item_name?.toLowerCase().includes(query);
      if (!matchesSearch) return;

      const groupKey = wo.plan_id ? `plan_${wo.plan_id}` : (wo.parent_wo_id ? `parent_${wo.parent_wo_id}` : `wo_${wo.id}`);
      if (!woGroups[groupKey]) {
        woGroups[groupKey] = { latestId: 0, items: [] };
      }
      woGroups[groupKey].items.push(wo);
      const currentId = Number(wo.id) || 0;
      if (currentId > woGroups[groupKey].latestId) {
        woGroups[groupKey].latestId = currentId;
      }
    });

    // 2. Sort WO groups by newest first
    const sortedGroupKeys = Object.keys(woGroups).sort((a, b) => woGroups[b].latestId - woGroups[a].latestId);

    // 3. Initialize headers in correct order
    sortedGroupKeys.forEach(key => {
      const sortedInGroup = woGroups[key].items.sort((a, b) => {
        const aPrio = getSourcePriority(a.source_type);
        const bPrio = getSourcePriority(b.source_type);
        if (aPrio !== bPrio) return aPrio - bPrio;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      });

      sortedInGroup.forEach(wo => {
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
      });
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
          item_code: jc.item_code,
          priority: jc.priority,
          wo_quantity: jc.wo_quantity,
          wo_status: jc.wo_status,
          wo_end_date: jc.wo_end_date,
          source_type: jc.source_type,
          cards: [jc]
        };
      }
    });

    // 3. Sort cards within each group by sequence_no
    Object.values(acc).forEach(group => {
      group.cards.sort((a, b) => {
        const aSeq = parseInt(a.sequence_no || a.operation_sequence || 0);
        const bSeq = parseInt(b.sequence_no || b.operation_sequence || 0);
        return aSeq - bSeq;
      });
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

  const workOrderOperations = useMemo(() => {
    if (!selectedJC && !viewingJobCard) return [];
    const woId = selectedJC?.work_order_id || viewingJobCard?.work_order_id;
    return jobCards.filter(jc => String(jc.work_order_id) === String(woId))
      .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0));
  }, [jobCards, selectedJC, viewingJobCard]);

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

  const [viewingTimeLog, setViewingTimeLog] = useState(null);
  const [editingTimeLogId, setEditingTimeLogId] = useState(null);
  const [editTimeLogForm, setEditTimeLogForm] = useState({
    day: 1,
    logDate: '',
    shift: '',
    operatorId: '',
    workstationId: '',
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

  const [downtimeLogForm, setDowntimeLogForm] = useState({
    downtimeDate: new Date().toISOString().slice(0, 10),
    shift: 'SHIFT_A',
    downtimeType: '',
    startTime: '',
    startAMPM: '',
    endTime: '',
    endAMPM: '',
    remarks: '',
    day: 1
  });

  const [viewingQualityLog, setViewingQualityLog] = useState(null);
  const [editingQualityLogId, setEditingQualityLogId] = useState(null);
  const [editingReportKey, setEditingReportKey] = useState(null);
  const [editReportForm, setEditReportForm] = useState({
    produced: 0,
    accepted: 0,
    rejected: 0,
    scrap: 0
  });
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

  const [qcSuccessMessage, setQcSuccessMessage] = useState('');

  const sendToQuality = async () => {
    if (!selectedJC) return;

    const totalProduced = (logs.timeLogs || []).reduce((sum, log) => sum + parseFloat(log.produced_qty || 0), 0);
    const totalInspected = (logs.qualityLogs || []).reduce((sum, log) => sum + parseFloat(log.inspected_qty || 0), 0);
    const unsentQty = Math.max(0, totalProduced - totalInspected);

    if (unsentQty <= 0) {
      errorToast('Please record new produced quantity first (no unsent quantity found)');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        jcId: selectedJC.id,
        jobId: selectedJC.job_card_no,
        operation: selectedJC.operation_name,
        inspectedQty: unsentQty,
        date: timeLogForm.logDate || new Date().toISOString().slice(0, 10),
        shift: timeLogForm.shift === 'SHIFT_A' ? 'A' : timeLogForm.shift === 'SHIFT_B' ? 'B' : 'C',
        status: "PENDING"
      };

      const response = await fetch(`${API_BASE}/quality-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setQcSuccessMessage('Sent to Quality Department');
        setTimeout(() => setQcSuccessMessage(''), 5000);
        successToast('Data sent to quality successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorToast(`Failed to send data: ${errorData.message || errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending to quality:', error);
      errorToast('Error sending to quality');
    }
  };

  const [timeLogForm, setTimeLogForm] = useState({
    logDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
    operatorId: '',
    workstationId: '',
    shift: 'SHIFT_A',
    startTime: '08:00',
    startAMPM: 'AM',
    endTime: '08:00',
    endAMPM: 'PM',
    producedQty: '',
    day: 1
  });


  useEffect(() => {
    if (showProductionEntry && selectedJC) {
      const calculateAutoEndTime = () => {
        return; // Disable auto end time suggestions
        const qty = parseFloat(timeLogForm.producedQty || 0);
        if (!timeLogForm.startTime) return;

        let stdTime = parseFloat(selectedJC.std_time || 0);
        const uom = (selectedJC.time_uom || 'min').toLowerCase();

        if (uom === 'hr' || uom === 'hour' || uom === 'hours') stdTime *= 60;
        else if (uom === 'sec' || uom === 'second' || uom === 'seconds') stdTime /= 60;

        if (!stdTime || stdTime <= 0) return;

        const totalMinsToAdd = Math.round(stdTime * qty);

        let [hours, minutes] = timeLogForm.startTime.split(':').map(Number);
        let ampm = timeLogForm.startAMPM;

        // Convert to 24hr for calculation
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const startTotalMins = hours * 60 + minutes;
        const endTotalMins = startTotalMins + totalMinsToAdd;

        let endHours = Math.floor((endTotalMins / 60) % 24);
        let endMins = endTotalMins % 60;

        const end24 = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        const { time: endTime12, ampm: endTimeAMPM } = to12h(end24);

        setTimeLogForm(prev => {
          if (prev.endTime === endTime12 && prev.endAMPM === endTimeAMPM) return prev;
          return {
            ...prev,
            endTime: endTime12,
            endAMPM: endTimeAMPM
          };
        });
      };

      calculateAutoEndTime();
    }
  }, [timeLogForm.producedQty, timeLogForm.startTime, timeLogForm.startAMPM, showProductionEntry, selectedJC?.std_time, selectedJC?.time_uom]);


  useEffect(() => {
    if (editingTimeLogId && selectedJC) {
      const calculateAutoEndTime = () => {
        return; // Disable auto end time suggestions
        const qty = parseFloat(editTimeLogForm.producedQty || 0);
        if (!editTimeLogForm.startTime) return;

        let stdTime = parseFloat(selectedJC.std_time || 0);
        const uom = (selectedJC.time_uom || 'min').toLowerCase();

        if (uom === 'hr' || uom === 'hour' || uom === 'hours') stdTime *= 60;
        else if (uom === 'sec' || uom === 'second' || uom === 'seconds') stdTime /= 60;

        if (!stdTime || stdTime <= 0) return;

        const totalMinsToAdd = Math.round(stdTime * qty);

        let [hours, minutes] = editTimeLogForm.startTime.split(':').map(Number);
        let ampm = editTimeLogForm.startAMPM;

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const startTotalMins = hours * 60 + minutes;
        const endTotalMins = startTotalMins + totalMinsToAdd;

        let endHours = Math.floor((endTotalMins / 60) % 24);
        let endMins = endTotalMins % 60;

        const end24 = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        const { time: endTime12, ampm: endTimeAMPM } = to12h(end24);

        setEditTimeLogForm(prev => {
          if (prev.endTime === endTime12 && prev.endAMPM === endTimeAMPM) return prev;
          return {
            ...prev,
            endTime: endTime12,
            endAMPM: endTimeAMPM
          };
        });
      };

      calculateAutoEndTime();
    }
  }, [editTimeLogForm.producedQty, editTimeLogForm.startTime, editTimeLogForm.startAMPM, editingTimeLogId, selectedJC?.std_time, selectedJC?.time_uom]);


  const handleDayChange = (type, val) => {
    if (!selectedJC) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const startDateStr = selectedJC.actual_start_date || selectedJC.created_at || selectedJC.start_time || todayStr;
    const startDate = new Date(startDateStr);
    const newDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (parseInt(val || 1) - 1)));
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

    const diffDays = calculateDayOffset(selectedJC, val);

    if (type === 'time') {
      setTimeLogForm(prev => ({ ...prev, logDate: val, day: diffDays }));
    } else if (type === 'quality') {
      setQualityLogForm(prev => ({ ...prev, checkDate: val, day: diffDays }));
    } else if (type === 'downtime') {
      setDowntimeLogForm(prev => ({ ...prev, downtimeDate: val, day: diffDays }));
    }
  };

  const getEstimatedEndTime = (jc) => {
    if (jc.latest_log_end_time) return formatLocalTime(jc.latest_log_end_time);
    if (jc.end_time) return formatLocalTime(jc.end_time);
    const startTime = jc.latest_log_start_time || jc.start_time;
    if (!startTime) return '--:--';

    try {
      const start = new Date(String(startTime).replace(' ', 'T'));
      if (isNaN(start.getTime())) return '--:--';

      let stdTimeInMinutes = parseFloat(jc.std_time || 0);
      if (jc.time_uom === 'Hr') stdTimeInMinutes *= 60;
      else if (jc.time_uom === 'Sec') stdTimeInMinutes /= 60;

      const totalPlannedTime = stdTimeInMinutes * parseFloat(jc.planned_qty || 0);
      const estimatedEnd = new Date(start.getTime() + totalPlannedTime * 60000);

      return formatLocalTime(estimatedEnd.toISOString());
    } catch (e) {
      return '--:--';
    }
  };

  const getMachineState = (jc, allJobs) => {
    // ✅ Completed → never BUSY
    if (jc.status === "COMPLETED") {
      return { status: "COMPLETED" };
    }

    // ✅ In Progress → always RUNNING (even if workstation is N/A / not assigned)
    if (jc.status === "IN_PROGRESS") {
      return {
        status: "RUNNING",
        startTime: jc.latest_log_start_time || jc.start_time
      };
    }

    // ❌ No workstation assigned
    if (!jc.workstation_id || jc.workstation_name === 'N/A') {
      return { status: "NOT_ASSIGNED" };
    }

    // find all in-progress jobs on same machine, sorted by start time (log time first)
    const inProgressJobs = allJobs
      .filter(j =>
        j.workstation_id === jc.workstation_id &&
        j.status === "IN_PROGRESS" &&
        j.operator_name &&
        (j.latest_log_start_time || j.start_time)
      )
      .sort((a, b) => {
        const timeA = new Date(a.latest_log_start_time || a.start_time);
        const timeB = new Date(b.latest_log_start_time || b.start_time);
        return timeA - timeB;
      });

    const primaryJob = inProgressJobs[0];

    // ✅ Machine is BUSY with another job (either running or this is secondary in-progress)
    if (primaryJob) {
      return {
        status: "BUSY",
        jobId: primaryJob.job_card_no,
        endTime: getEstimatedEndTime(primaryJob)
      };
    }

    return { status: "FREE" };
  };

  const handleUpdateStatus = async (jc, status) => {
    if (status === 'IN_PROGRESS' && jc.workstation_id) {
      const ws = workstations.find(w => w.id === jc.workstation_id);
      const capacity = 1;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const overlappingJobs = jobCards.filter(other => {
        if (other.id === jc.id || other.workstation_id !== jc.workstation_id || other.status !== 'IN_PROGRESS') {
          return false;
        }

        const busyDate = (other.latest_log_start_time || other.start_time || '').split(/[ T]/)[0];
        if (todayStr && busyDate && todayStr !== busyDate) {
          return false; // Different dates, no overlap
        }

        const busyEndStr = getEstimatedEndTime(other);
        const busyStartStr = formatLocalTime(other.latest_log_start_time || other.start_time);

        const busyStart = parse12hMinutes(busyStartStr);
        const busyEnd = parse12hMinutes(busyEndStr);

        return nowMinutes < busyEnd && nowMinutes >= busyStart;
      });

      if (overlappingJobs.length >= capacity) {
        Swal.fire({
          title: 'Machine Busy',
          text: `Workstation "${jc.workstation_name}" has reached its capacity (${capacity} jobs). Occupied by Job Card(s): ${overlappingJobs.map(o => o.job_card_no).join(', ')}. Please wait until it's free.`,
          icon: 'warning',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
    }

    if (status === 'IN_PROGRESS' && jc.assigned_to) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const busyOpJob = jobCards.find(other => {
        if (other.id === jc.id || other.assigned_to !== jc.assigned_to || other.status !== 'IN_PROGRESS') {
          return false;
        }

        const busyDate = (other.latest_log_start_time || other.start_time || '').split(/[ T]/)[0];
        if (todayStr && busyDate && todayStr !== busyDate) {
          return false; // Different dates, no overlap
        }

        const busyEndStr = getEstimatedEndTime(other);
        const busyStartStr = formatLocalTime(other.latest_log_start_time || other.start_time);

        const busyStart = parse12hMinutes(busyStartStr);
        const busyEnd = parse12hMinutes(busyEndStr);

        return nowMinutes < busyEnd && nowMinutes >= busyStart;
      });

      if (busyOpJob) {
        const busyOp = users.find(u => u.id === jc.assigned_to);
        Swal.fire({
          title: 'Operator Not Available',
          text: `Operator "${busyOp?.username || 'Assigned Operator'}" is already busy with Job Card ${busyOpJob.job_card_no}.`,
          icon: 'warning',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }
    }

    try {
      const token = localStorage.getItem('authToken');
      const payload = { status };

      if (status === 'IN_PROGRESS') {
        payload.startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        // If the job card already has an assignee or workstation, include them
        if (jc.workstation_id) payload.workstationId = jc.workstation_id;
        if (jc.assigned_to) payload.assignedTo = jc.assigned_to;
      } else if (status === 'COMPLETED') {
        payload.endTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }

      const response = await fetch(`${API_BASE}/job-cards/${jc.id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast(`Job Card status updated to ${status}`);
        fetchJobCards();
      } else {
        const error = await response.json();
        errorToast(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      errorToast('Network error');
    }
  };

  const validateJobCardCompleteness = (jc) => {
    const isShipment = isShipmentOp(jc);
    const isSubcontract = jc.execution_type === 'Outsource' || jc.execution_type === 'Subcontract' || jc.execution_type === 'Sub-Contract' || jc.outward_challan_id;

    if (!isSubcontract && !isShipment) {
      const isWorkstationNull = !jc.workstation_id;
      const isStartTimeNull = !jc.start_time;
      const isEndTimeNull = !jc.end_time;
      const hasNoTimeLogs = !jc.produced_qty || parseFloat(jc.produced_qty) === 0;

      if (jc.status === 'IN_PROGRESS' && isWorkstationNull && isStartTimeNull && isEndTimeNull && hasNoTimeLogs) {
        errorToast('Cannot Log Production. Assign workstation and operation timing first.');
        return false;
      }
    }
    return true;
  };

  const handleLogProgress = async (jc) => {
    if (!validateJobCardCompleteness(jc)) return;
    setSelectedJC(jc);
    setActiveTab('time');
    await fetchLogs(jc.id);
    setProgressData({
      producedQty: 0,
      acceptedQty: 0,
      rejectedQty: 0,
      remarks: jc.remarks || ''
    });

    // Compute preceding sequence availability for shipment operations
    const parentId = jc.plan_id || jc.parent_wo_id || jc.sales_order_id;
    const woJCs = jobCards
      .filter(j => {
        if (String(j.work_order_id) === String(jc.work_order_id)) return true;
        const jParentId = j.plan_id || j.parent_wo_id || j.sales_order_id;
        if (parentId && jParentId && String(parentId) === String(jParentId)) return true;
        return false;
      })
      .sort((a, b) => {
        const aSeq = parseInt(a.operation_sequence || a.sequence_no || 0);
        const bSeq = parseInt(b.sequence_no || b.operation_sequence || 0);
        if (aSeq !== bSeq) return aSeq - bSeq;
        return a.id - b.id;
      });
    const currentIndex = woJCs.findIndex(j => j.id === jc.id);
    
    const precedingJC = (() => {
      const precedingJCs = woJCs.filter(j => {
        const jSeq = parseInt(j.operation_sequence || j.sequence_no || 0);
        const currentSeq = parseInt(jc.operation_sequence || jc.sequence_no || 0);
        return jSeq < currentSeq;
      });
      if (precedingJCs.length === 0) return null;
      const sameItemPrev = [...precedingJCs].reverse().find(j => j.item_code === jc.item_code || j.item_name === jc.item_name);
      if (sameItemPrev) return sameItemPrev;
      const isAssembly = jc.item_name === jc.source_fg || jc.item_code === jc.source_fg || (jc.source_type && jc.source_type !== 'SA');
      if (isAssembly) {
        return precedingJCs[precedingJCs.length - 1];
      }
      return null;
    })();

    const availableQty = precedingJC ? parseFloat(precedingJC.accepted_qty || precedingJC.produced_qty || 0) : parseFloat(jc.planned_qty || 0);
    const dispatchedQty = parseFloat(jc.dispatch_qty || jc.accepted_qty || 0);
    const remainingQty = Math.max(0, availableQty - dispatchedQty);

    setShipmentForm({
      dispatchMode: 'Partial',
      dispatchDate: new Date().toISOString().split('T')[0],
      sourceWarehouseId: precedingJC ? (precedingJC.target_warehouse_id || '') : '',
      targetWarehouseId: jc.target_warehouse_id || '',
      dispatchQty: remainingQty,
      carrierName: jc.carrier_name || '',
      trackingNumber: jc.tracking_number || '',
      shippingNotes: jc.shipping_notes || '',
      enableAutoTransfer: false
    });

    // Pre-fill forms
    const today = new Date().toISOString().split('T')[0];
    const startDate = jc.start_time ? (jc.start_time.includes('T') ? jc.start_time.split('T')[0] : jc.start_time.split(' ')[0]) : today;
    const diffDays = calculateDayOffset(jc, startDate);

    const logRemainingQty = Math.max(0, (parseFloat(jc.planned_qty || 0) + parseFloat(jc.rework_qty || 0)) - parseFloat(jc.accepted_qty || 0));

    const startInfo = jc.start_time ? to12h(jc.start_time.split('T')[1]?.slice(0, 5) || jc.start_time.split(' ')[1]?.slice(0, 5)) : { time: '08:00', ampm: 'AM' };
    const endInfo = jc.end_time ? to12h(jc.end_time.split('T')[1]?.slice(0, 5) || jc.end_time.split(' ')[1]?.slice(0, 5)) : { time: '04:00', ampm: 'PM' };

    setTimeLogForm(prev => ({
      ...prev,
      logDate: startDate,
      day: diffDays,
      operatorId: jc.assigned_to || '',
      workstationId: jc.workstation_id || '',
      producedQty: logRemainingQty,
      startTime: startInfo.time,
      startAMPM: startInfo.ampm,
      endTime: endInfo.time,
      endAMPM: endInfo.ampm
    }));
    setQualityLogForm(prev => ({ ...prev, checkDate: startDate, day: diffDays, shift: 'SHIFT_A', inspectedQty: 0, acceptedQty: 0, rejectedQty: 0, scrapQty: 0 }));
    setDowntimeLogForm(prev => ({ ...prev, downtimeDate: startDate, day: diffDays, shift: 'SHIFT_A', startTime: '', startAMPM: '', endTime: '', endAMPM: '', downtimeType: '', remarks: '' }));

    // Set machine status based on current job state
    const mState = getMachineState(jc, jobCards);
    if (mState.status === "RUNNING" || mState.status === "BUSY") {
      setMachineStatus("RUNNING");
    } else if (jc.status === "STOPPED") {
      setMachineStatus("STOPPED");
    } else {
      setMachineStatus("AVAILABLE");
    }

    // Auto-fetch next operation in sequence
    const remainingJCs = woJCs.filter(j => {
      const seq = parseInt(j.operation_sequence || j.sequence_no || 0);
      const currentSeq = parseInt(jc.operation_sequence || jc.sequence_no || 0);
      return seq > currentSeq;
    });

    const nextJC = (() => {
      const sameItemNext = remainingJCs.find(j => j.item_code === jc.item_code || j.item_name === jc.item_name);
      if (sameItemNext) return sameItemNext;
      const parentFGNext = remainingJCs.find(j => 
        j.item_name === jc.source_fg || 
        j.item_code === jc.source_fg ||
        (j.source_type && j.source_type !== 'SA')
      );
      if (parentFGNext) return parentFGNext;
      return remainingJCs[0] || null;
    })();

    const mode = nextJC?.execution_type || 'In-house';
    const normalizedMode = (mode.toLowerCase().includes('outsource') || mode.toLowerCase().includes('sub')) ? 'Outsource' : 'In-house';

    setNextStageForm({
      nextOperationId: nextJC ? nextJC.operation_id : '',
      assignOperatorId: nextJC ? (nextJC.assigned_to || '') : '',
      targetWarehouseId: nextJC ? (nextJC.target_warehouse_id || '') : '',
      executionMode: normalizedMode
    });

    if (!location.pathname.includes('/production-entry')) {
      navigate(`${deptPrefix}/job-card/production-entry?id=${jc.id}`);
    }
    setShowProductionEntry(true);
  };

  useEffect(() => {
    const isProductionEntryPath = location.pathname.includes('/production-entry');
    const isAddPath = location.pathname.includes('/job-card/add');
    const isEditPath = location.pathname.includes('/job-card/edit');
    const isViewPath = location.pathname.includes('/job-card/view');
    const isOutwardPath = location.pathname.includes('/job-card/outward');
    const isInwardPath = location.pathname.includes('/job-card/inward');
    const jcId = searchParams.get('id');

    if (jobCards.length > 0) {
      if (isProductionEntryPath && jcId) {
        const jc = jobCards.find(j => String(j.id) === String(jcId));
        if (jc && (!selectedJC || String(selectedJC.id) !== String(jcId) || !showProductionEntry)) {
          handleLogProgress(jc);
        }
      } else if (isAddPath && !isModalOpen) {
        handleCreateNew();
      } else if (isEditPath && jcId) {
        const jc = jobCards.find(j => String(j.id) === String(jcId));
        if (jc && (!formData.id || String(formData.id) !== String(jcId) || !isModalOpen)) {
          handleEdit(jc);
        }
      } else if (isViewPath && jcId) {
        const jc = jobCards.find(j => String(j.id) === String(jcId));
        if (jc && (!viewingJobCard || String(viewingJobCard.id) !== String(jcId))) {
          setViewingJobCard(jc);
        }
      } else if (isOutwardPath && jcId) {
        const jc = jobCards.find(j => String(j.id) === String(jcId));
        if (jc && (!selectedJCOutward || String(selectedJCOutward.id) !== String(jcId) || !isOutwardModalOpen)) {
          handleOutwardChallan(jc);
        }
      } else if (isInwardPath && jcId) {
        const jc = jobCards.find(j => String(j.id) === String(jcId));
        if (jc && (!selectedJCOutward || String(selectedJCOutward.id) !== String(jcId) || !isInwardModalOpen)) {
          // Special case for inward - needs fetchInwardItems
          setSelectedJCOutward(jc);
          setInwardFormData(prev => ({
            ...prev,
            receivedQty: jc.dispatch_qty || jc.planned_qty,
            acceptedQty: jc.dispatch_qty || jc.planned_qty,
            inwardItems: [],
            vendorInvoice: null
          }));
          fetchInwardItems(jc.id, jc);
          setIsInwardModalOpen(true);
        }
      }
    }

    // Reset modals if path doesn't match
    if (location.pathname === `${deptPrefix}/job-card` || location.pathname === `${deptPrefix}/job-card/`) {
      if (isModalOpen) setIsModalOpen(false);
      if (viewingJobCard) setViewingJobCard(null);
      if (isOutwardModalOpen) setIsOutwardModalOpen(false);
      if (isInwardModalOpen) setIsInwardModalOpen(false);
      if (showProductionEntry) {
        setShowProductionEntry(false);
        setSelectedJC(null);
      }
    }
  }, [location.pathname, searchParams, jobCards]);

  const handleEditTimeLog = (log) => {
    const startStr = formatLocalTime(log.start_time);
    const endStr = formatLocalTime(log.end_time);

    const [startTime, startAMPM] = startStr.split(' ');
    const [endTime, endAMPM] = endStr.split(' ');

    const diffDays = calculateDayOffset(selectedJC, log.log_date);

    setEditingTimeLogId(log.id);
    setEditTimeLogForm({
      day: diffDays,
      logDate: log.log_date.slice(0, 10),
      shift: log.shift,
      operatorId: log.operator_id,
      workstationId: log.workstation_id,
      startTime: startTime,
      startAMPM: startAMPM || 'AM',
      endTime: endTime,
      endAMPM: endAMPM || 'AM',
      producedQty: log.produced_qty
    });
  };

  const handleEditQualityLog = (log) => {
    const diffDays = calculateDayOffset(selectedJC, log.check_date);

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

  const handleEditReport = (row) => {
    const key = `${row.date}_${row.shift}`;
    setEditingReportKey(key);
    setEditReportForm({
      produced: row.produced,
      accepted: row.accepted,
      rejected: row.rejected,
      scrap: row.scrap
    });
  };

  const handleUpdateReport = async (row) => {
    const date = row.date;
    const shift = row.shift;

    try {
      // 1. Find the time log for this date/shift
      const timeLog = logs.timeLogs.find(l => l.log_date === date && l.shift === shift);
      if (parseFloat(editReportForm.produced) !== parseFloat(row.produced)) {
        if (timeLog) {
          const startStr = formatLocalTime(timeLog.start_time);
          const endStr = formatLocalTime(timeLog.end_time);
          const [startTime, startAMPM] = startStr.split(' ');
          const [endTime, endAMPM] = endStr.split(' ');

          await updateTimeLog(timeLog.id, {
            ...timeLog,
            producedQty: parseFloat(editReportForm.produced),
            startTime: startTime,
            startAMPM: startAMPM || 'AM',
            endTime: endTime,
            endAMPM: endAMPM || 'AM',
            logDate: timeLog.log_date.slice(0, 10),
            operatorId: timeLog.operator_id,
            workstationId: timeLog.workstation_id
          });
        } else {
          errorToast("Cannot update Produced Qty: No Time Log found for this shift.");
        }
      }

      // 2. Find the quality log for this date/shift
      const qualityLog = logs.qualityLogs.find(l => l.check_date === date && l.shift === shift);
      if (
        parseFloat(editReportForm.accepted) !== parseFloat(row.accepted) ||
        parseFloat(editReportForm.rejected) !== parseFloat(row.rejected) ||
        parseFloat(editReportForm.scrap) !== parseFloat(row.scrap)
      ) {
        if (qualityLog) {
          await updateQualityLog(qualityLog.id, {
            ...qualityLog,
            acceptedQty: parseFloat(editReportForm.accepted),
            rejectedQty: parseFloat(editReportForm.rejected),
            scrapQty: parseFloat(editReportForm.scrap),
            checkDate: qualityLog.check_date.slice(0, 10)
          });
        } else {
          errorToast("Cannot update Quality values: No Quality Entry found for this shift.");
        }
      }

      setEditingReportKey(null);
      fetchLogs(selectedJC.id);
      successToast("Report updated successfully");
    } catch (error) {
      console.error("Error updating report:", error);
      errorToast("Failed to update report");
    }
  };

  const handleWorkstationChange = (wsId) => {
    setTimeLogForm(prev => ({ ...prev, workstationId: wsId }));

    // Also update machine status for the new workstation
    const mState = getMachineState({ ...selectedJC, workstation_id: wsId }, jobCards);
    if (mState.status === "RUNNING" || mState.status === "BUSY") {
      setMachineStatus("RUNNING");
    } else if (selectedJC.status === "STOPPED") {
      setMachineStatus("STOPPED");
    } else {
      setMachineStatus("AVAILABLE");
    }
  };

  const handleModalWorkstationChange = (wsId) => {
    setFormData(prev => ({ ...prev, workstationId: wsId }));
  };

  const calculateAutoEndTime = (startTime, startAMPM, producedQty) => {
    if (!startTime || !startAMPM || !selectedJC) return;

    try {
      const [hStr, mStr] = startTime.split(':');
      let hours = parseInt(hStr);
      const minutes = parseInt(mStr);

      if (startAMPM === 'PM' && hours < 12) hours += 12;
      if (startAMPM === 'AM' && hours === 12) hours = 0;

      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);

      const cycleTime = parseFloat(selectedJC.cycle_time) || parseFloat(selectedJC.std_time) || 0;
      const setupTime = parseFloat(selectedJC.setup_time || 0);
      const qty = parseFloat(producedQty || 0);

      // Total time in minutes = (Cycle Time * Quantity) + Setup Time
      const totalMinutes = (cycleTime * qty) + setupTime;
      const endDate = new Date(startDate.getTime() + totalMinutes * 60000);

      let endHours = endDate.getHours();
      const endMinutes = endDate.getMinutes();
      const endAMPM = endHours >= 12 ? 'PM' : 'AM';

      if (endHours > 12) endHours -= 12;
      if (endHours === 0) endHours = 12;

      const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      setTimeLogForm(prev => ({
        ...prev,
        endTime: endTimeStr,
        endAMPM: endAMPM
      }));
    } catch (error) {
      console.error('Error calculating auto end time:', error);
    }
  };

  const renderProductionEntry = () => {
    if (!selectedJC) return null;

    const balanceWip = parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0) - parseFloat(selectedJC.accepted_qty || 0);

    const totalStdMins = (() => {
      const cycleTime = parseFloat(selectedJC.cycle_time) || parseFloat(selectedJC.std_time) || 0;
      const setupTime = parseFloat(selectedJC.setup_time || 0);
      return Math.round((cycleTime * parseFloat(selectedJC.accepted_qty || 0)) + setupTime);
    })();

    const totalActualMins = (logs.timeLogs || []).reduce((acc, log) => {
      return acc + calculateISODuration(log.start_time, log.end_time);
    }, 0);

    // Sequence & Handover Metrics (real database-driven)
    const parentId = selectedJC.plan_id || selectedJC.parent_wo_id || selectedJC.sales_order_id;
    const woJCs = jobCards
      .filter(j => {
        if (String(j.work_order_id) === String(selectedJC.work_order_id)) return true;
        const jParentId = j.plan_id || j.parent_wo_id || j.sales_order_id;
        if (parentId && jParentId && String(parentId) === String(jParentId)) return true;
        return false;
      })
      .sort((a, b) => {
        const aSeq = parseInt(a.sequence_no || a.operation_sequence || 0);
        const bSeq = parseInt(b.sequence_no || b.operation_sequence || 0);
        if (aSeq !== bSeq) return aSeq - bSeq;
        return a.id - b.id;
      });
    const currentIndex = woJCs.findIndex(j => j.id === selectedJC.id);
    
    const precedingJC = (() => {
      const precedingJCs = woJCs.filter(j => {
        const jSeq = parseInt(j.operation_sequence || j.sequence_no || 0);
        const currentSeq = parseInt(selectedJC.operation_sequence || selectedJC.sequence_no || 0);
        return jSeq < currentSeq;
      });
      if (precedingJCs.length === 0) return null;
      const sameItemPrev = [...precedingJCs].reverse().find(j => j.item_code === selectedJC.item_code || j.item_name === selectedJC.item_name);
      if (sameItemPrev) return sameItemPrev;
      const isAssembly = selectedJC.item_name === selectedJC.source_fg || selectedJC.item_code === selectedJC.source_fg || (selectedJC.source_type && selectedJC.source_type !== 'SA');
      if (isAssembly) {
        return precedingJCs[precedingJCs.length - 1];
      }
      return null;
    })();

    const currentSeq = parseInt(selectedJC.sequence_no || selectedJC.operation_sequence || 0);
    const remainingJCs = woJCs.filter(j => {
      const seq = parseInt(j.sequence_no || j.operation_sequence || 0);
      return seq > currentSeq;
    });
    const nextOperationOptions = remainingJCs.map(j => ({
      value: j.operation_id,
      label: j.operation_name
    }));

    console.log("DEBUG nextOperationOptions:", {
      selectedJC_id: selectedJC.id,
      selectedJC_sequence_no: selectedJC.sequence_no,
      selectedJC_operation_sequence: selectedJC.operation_sequence,
      currentSeq,
      woJCs: woJCs.map(j => ({ id: j.id, op: j.operation_name, seq: j.sequence_no })),
      remainingJCs: remainingJCs.map(j => ({ id: j.id, op: j.operation_name, seq: j.sequence_no })),
      nextOperationOptions
    });

    const isSelectedOperatorBusy = (() => {
      if (!nextStageForm.assignOperatorId) return false;
      return jobCards.some(jc => String(jc.assigned_to) === String(nextStageForm.assignOperatorId) && jc.status === 'IN_PROGRESS');
    })();

    const precedingStageName = precedingJC ? precedingJC.operation_name : 'Raw Materials Store';
    const precedingSeq = precedingJC ? (precedingJC.sequence_no || precedingJC.operation_sequence || currentIndex) : 0;

    // Handover limits
    const availableQty = precedingJC ? parseFloat(precedingJC.accepted_qty || precedingJC.produced_qty || 0) : (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0));
    const dispatchedQty = parseFloat(selectedJC.dispatch_qty || selectedJC.accepted_qty || 0);
    const remainingQty = Math.max(0, (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0)) - dispatchedQty);
    const isConstrained = availableQty < (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0));

    const targetQty = parseFloat(selectedJC.wo_quantity || selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0);
    const remainingAvailableQty = Math.max(0, availableQty - dispatchedQty);
    const remainingWorkOrderQty = Math.max(0, targetQty - dispatchedQty);

    const selectedNextJCForBtn = woJCs.find(j => String(j.operation_id) === String(nextStageForm.nextOperationId));
    const alreadyTransferredQtyForBtn = selectedNextJCForBtn
      ? (selectedNextJCForBtn.status === 'PENDING' ? 0 : Math.max(parseFloat(selectedNextJCForBtn.planned_qty || 0), parseFloat(selectedNextJCForBtn.accepted_qty || 0)))
      : parseFloat(selectedJC.transferred_qty || 0);
    const availableTransferQty = Math.max(0, (selectedJC.accepted_qty || qcStats.totalAccepted || 0) - alreadyTransferredQtyForBtn);
    const isTransferDisabled = !nextStageForm.nextOperationId || availableTransferQty <= 0;

    // Handover percentage
    const handoverPercentage = (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0)) > 0 ? ((availableQty / (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0))) * 100).toFixed(1) : '0.0';

    // Check if other stages in the work order are completed
    const isPlanFullyFulfilled = woJCs.filter(j => j.id !== selectedJC.id).every(j => j.status === 'COMPLETED' || (parseFloat(j.accepted_qty || 0) >= parseFloat(j.planned_qty || 0) && parseFloat(j.planned_qty || 0) > 0));

    return (
      <div className="space-y-2 pb-12">
        {/* New Header UI */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-indigo-50 text-xs  text-indigo-600 border border-indigo-100">
                {selectedJC.sequence_no || selectedJC.operation_sequence || '-'}
              </span>
              <h1 className="text-xl  text-slate-900">Production Entry: {selectedJC.operation_name}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">{selectedJC.job_card_no}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">WO: {selectedJC.work_order_no || selectedJC.wo_number}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setShowProductionEntry(false);
              setSelectedJC(null);
              navigate(`${deptPrefix}/job-card`);
            }}
            className="flex items-center gap-2 p-1.5 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs   ">Back</span>
          </button>
        </div>
        {/* Warning Banners - ONLY for Shipment Operations */}
        {isShipmentOp(selectedJC) && isConstrained && (
          <div className="space-y-2 mt-2">
            {/* Orange Banner: Operation Dependency Active */}
            <div className="flex items-center justify-between p-3.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">Operation Dependency Active:</span>
                  <span className="ml-1">Only {availableQty} units have been transferred from {precedingStageName}. Production is capped at this amount until more units are transferred.</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase tracking-wider border border-amber-200">
                Constrained
              </span>
            </div>

            {/* Blue Banner: Production Constraints Active */}
            <div className="flex items-center justify-between p-3.5 bg-indigo-50 text-indigo-800 border border-indigo-200/60 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">Production Constraints Active:</span>
                  <span className="ml-1">You can only produce {availableQty} units because of preceding stage constraints. See the preceding stage handover section below for details.</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded uppercase tracking-wider border border-indigo-200">
                Limited by {precedingStageName}
              </span>
            </div>
          </div>
        )}

        {/* Target Item Summary */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mt-3">
          {isShipmentOp(selectedJC) ? (
            <div className="space-y-4">
              {/* Target Item Header row */}
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Target Item (Shipment Operation)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <h3 className="text-base text-slate-900 font-bold">{selectedJC.item_name}</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-200">
                      {selectedJC.drawing_no || 'S-BASEFRAMEASSEMBLY'}
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100 uppercase">
                      {isShipmentOp(selectedJC) ? 'DISPATCH' : (selectedJC.execution_type || selectedJC.execution_mode || 'In-House')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      successToast("Ready to update progress!");
                    }}
                    className="px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    Update Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShipmentForm(prev => ({ ...prev, dispatchQty: remainingAvailableQty }));
                      successToast(`Transferred ${remainingAvailableQty} Units to Dispatch Qty!`);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Transfer {remainingAvailableQty} Units
                  </button>
                </div>
              </div>

              {/* Thin divider line */}
              <div className="border-t border-slate-100 my-2"></div>

              {/* Stats Columns row */}
              <div className="grid grid-cols-3 gap-4 pt-1">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Ready for Dispatch</p>
                  <p className="text-lg font-bold text-amber-600 mt-0.5">
                    {remainingAvailableQty} <span className="text-xs text-amber-400 font-normal">Units</span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Dispatched</p>
                  <p className="text-lg font-bold text-indigo-600 mt-0.5">
                    {dispatchedQty} <span className="text-xs text-indigo-400 font-normal">Units</span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Remaining</p>
                  <p className="text-lg font-bold text-rose-600 mt-0.5">
                    {remainingWorkOrderQty} <span className="text-xs text-rose-400 font-normal">Units</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <div>
                  <p className="text-xs  text-slate-400   mb-0.5">Target Item</p>
                  <h3 className="text-xs  text-slate-900">{selectedJC.item_name}</h3>
                  <p className="text-xs  text-slate-500 mt-0.5">{selectedJC.drawing_no || 'S-BASEFRAMEASSEMBLY'}</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs  text-slate-400   mb-1.5">Planned</p>
                <p className="text-xs  text-slate-900">
                  {parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0)} <span className="text-xs text-slate-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs  text-slate-400   mb-1.5">Produced</p>
                <p className="text-xs  text-slate-900">
                  {selectedJC.produced_qty || 0} <span className="text-xs text-slate-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs  text-slate-400   mb-1.5">Accepted</p>
                <p className="text-sm  text-emerald-600">
                  {selectedJC.accepted_qty || 0} <span className="text-xs text-emerald-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs  text-slate-400   mb-1.5 text-indigo-400">Transferred</p>
                <p className="text-sm  text-indigo-600">
                  {selectedJC.transferred_qty || 0} <span className="text-xs text-indigo-400">Units</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs  text-slate-400   mb-1.5">Balance WIP</p>
                <p className="text-sm  text-amber-600">
                  {balanceWip.toFixed(2)} <span className="text-xs text-amber-400">Units</span>
                </p>
              </div>
              <div className="text-center border-l border-slate-100">
                <p className="text-xs text-indigo-500 mb-1.5 ">Total Execution Time</p>
                <p className="text-xs  text-slate-400 mb-1  italic">(For all units)</p>
                <div className="flex flex-col items-center">
                  <p className="text-sm  text-indigo-600 ">
                    {(((parseFloat(selectedJC.cycle_time) || parseFloat(selectedJC.std_time) || 0) * (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0))) + parseFloat(selectedJC.setup_time || 0)).toFixed(0)} <span className="text-xs  text-indigo-400 lowercase">Min</span>
                  </p>
                  <div className="text-[9px] text-slate-400 mt-1 flex gap-1">
                    <span>C: {(() => {
                      const val = parseFloat(selectedJC.cycle_time) || parseFloat(selectedJC.std_time) || 0;
                      return val >= 1 ? Math.round(val) : val;
                    })()}m</span>
                    <span>•</span>
                    <span>S: {(() => {
                      const val = parseFloat(selectedJC.setup_time || 0);
                      return val >= 1 ? Math.round(val) : val;
                    })()}m</span>
                  </div>
                </div>
              </div>
              <div className="text-center border-l border-slate-100">
                <p className="text-xs text-slate-400 mb-1.5 ">Net Time (Per Unit)</p>
                <p className="text-sm  text-slate-600">
                  {(parseFloat(selectedJC.cycle_time) || parseFloat(selectedJC.std_time) || 0).toFixed(0)} <span className="text-xs  text-slate-400 lowercase">{(selectedJC.time_uom || 'Min').toLowerCase()}</span>
                  <span className="text-[9px] text-slate-400 ml-1">/ unit</span>
                </p>
              </div>
              <div className="text-right border-l border-slate-100 pl-8 min-w-[120px]">
                <p className="text-xs  text-slate-400   mb-1">Current Status</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`w-2 h-2 rounded animate-pulse shrink-0 ${selectedJC.status === 'IN_PROGRESS' ? 'bg-amber-500' :
                    selectedJC.status === 'COMPLETED' ? 'bg-emerald-500' :
                      'bg-slate-400'
                    }`}></span>
                  <p className={`text-sm   ${selectedJC.status === 'IN_PROGRESS' ? 'text-amber-600' :
                    selectedJC.status === 'COMPLETED' ? 'text-emerald-600' :
                      'text-slate-600'
                    }`}>
                    {selectedJC.status === 'IN_PROGRESS' ? 'Running' : selectedJC.status === 'COMPLETED' ? 'Completed' : selectedJC.status}
                  </p>
                </div>
                <p className="text-xs   text-slate-400 mt-1  ">{selectedJC.operation_name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-12 mt-12">
          {isShipmentOp(selectedJC) ? (
            <>
              {/* 1. Preceding Operation Handover Card */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-8 h-8 bg-indigo-50 rounded flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Preceding Operation Handover</h2>
                    <p className="text-[11px] text-slate-400">Progress of material transfer from previous stage</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Left: Progress details */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Source Stage</p>
                          <p className="text-xs text-slate-500 font-medium">Sequence {precedingSeq}: {precedingStageName}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${parseFloat(handoverPercentage) >= 100
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                          {parseFloat(handoverPercentage) >= 100 ? 'Full Handover' : 'Partial Handover'} ({handoverPercentage}%)
                        </span>
                      </div>

                      {/* Horizontal progress bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, parseFloat(handoverPercentage))}%` }}
                        ></div>
                      </div>

                      <p className="text-[10px] text-slate-400 italic font-medium">
                        * This operation is constrained by the quantity transferred from the previous stage.
                      </p>
                    </div>

                    {/* Right: Mini-stats grid */}
                    <div className="lg:col-span-5 grid grid-cols-5 gap-2 border-l border-slate-100 pl-6 min-w-[320px]">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Produced</p>
                        <p className="text-sm font-bold text-slate-800 mt-1">{precedingJC ? (precedingJC.produced_qty || 0) : (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Accepted</p>
                        <p className="text-sm font-bold text-slate-800 mt-1">{precedingJC ? (precedingJC.accepted_qty || 0) : (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase text-amber-600">Transferred</p>
                        <p className="text-sm font-extrabold text-amber-600 mt-1">{precedingJC ? (precedingJC.transferred_qty || precedingJC.accepted_qty || 0) : (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase text-blue-600">Received</p>
                        <p className="text-sm font-extrabold text-blue-600 mt-1">{precedingJC ? (precedingJC.received_qty || precedingJC.accepted_qty || 0) : (parseFloat(selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0))}</p>
                      </div>
                      <div className="text-center border-l border-slate-100 pl-2">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase text-rose-600">Balance WIP</p>
                        <p className="text-sm font-extrabold text-rose-600 mt-1">
                          {(() => {
                            const precedingAccepted = precedingJC ? (precedingJC.accepted_qty || precedingJC.produced_qty || 0) : 0;
                            const totalQty = parseFloat(selectedJC.wo_quantity || selectedJC.planned_qty || 0) + parseFloat(selectedJC.rework_qty || 0);
                            const precedingWip = Math.max(0, totalQty - parseFloat(precedingAccepted));
                            return `${precedingWip.toFixed(2)} Units`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Overall Production Plan Status & Component Cards */}
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-50 rounded flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">Overall Production Plan Status</h2>
                      <p className="text-[11px] text-slate-400">Validation across all work orders in plan: {selectedJC.work_order_no || selectedJC.wo_number}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${isPlanFullyFulfilled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                    {isPlanFullyFulfilled ? 'Production Complete' : 'Production Incomplete'}
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
                  {/* Grid of Work Order Stage Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {woJCs.map((jc, index) => {
                      const isCompleted = jc.status === 'COMPLETED';
                      const isActive = jc.id === selectedJC.id;
                      return (
                        <div
                          key={jc.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-[110px] ${isActive
                            ? 'bg-indigo-50/20 border-indigo-200 ring-2 ring-indigo-500/5'
                            : isCompleted
                              ? 'bg-emerald-50/10 border-emerald-100'
                              : 'bg-slate-50/40 border-slate-100'
                            }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[9px] text-slate-400 font-semibold tracking-wider truncate uppercase max-w-[120px]">
                                {jc.drawing_no || selectedJC.drawing_no || 'SA-COMPONENT'}
                              </p>
                              <h4 className="text-xs font-bold text-slate-800 mt-0.5 truncate max-w-[140px]">
                                {jc.operation_name}
                              </h4>
                            </div>
                            <span className="p-1 rounded bg-white border border-slate-100 text-slate-400">
                              {isCompleted ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-100/60 flex justify-between items-center mt-2">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {isShipmentOp(jc) ? 'Dispatched' : 'Ready Qty'}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {isShipmentOp(jc)
                                ? `${parseFloat(jc.dispatch_qty || jc.accepted_qty || 0)} / ${parseFloat(jc.wo_quantity || selectedJC.wo_quantity || jc.planned_qty || 0)}`
                                : `${parseFloat(jc.accepted_qty || jc.produced_qty || 0)} / ${parseFloat(jc.wo_quantity || selectedJC.wo_quantity || jc.planned_qty || 0)}`
                              }
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Warning banner if not fully completed */}
                  {!isPlanFullyFulfilled && (
                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100/60 text-amber-800 text-[11px] font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Production plan is not fully fulfilled. Full dispatch is disabled to prevent shipping errors.</span>
                    </div>
                  )}
                </div>
              </section>

              {/* 3. Shipment/Dispatch Parameters Form */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-8 h-8 bg-emerald-50 rounded flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Shipment & Courier Parameters Form</h2>
                    <p className="text-[11px] text-slate-400">Specify courier details, dispatch quantities, and target warehouse movement parameters</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-6">
                  {/* Read-Only Shipping Address Banner */}
                  {selectedJC.shipping_address && (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3">
                      <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-indigo-800">Customer Delivery Destination Address</p>
                        <p className="text-xs text-indigo-900 mt-1 leading-relaxed">{selectedJC.shipping_address}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Final Stage */}
                    <div className="col-span-12 md:col-span-4">
                      <FormControl label="Final Stage">
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50/40 border border-emerald-100 text-emerald-800 rounded-md text-xs font-semibold">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Shipment / Dispatch</span>
                        </div>
                      </FormControl>
                    </div>

                    {/* Dispatch Mode */}
                    <div className="col-span-12 md:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Dispatch Mode *</label>
                      <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="dispatchMode"
                            checked={shipmentForm.dispatchMode === 'Complete'}
                            onChange={() => setShipmentForm(prev => ({ ...prev, dispatchMode: 'Complete' }))}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span>Full Dispatch</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="dispatchMode"
                            checked={shipmentForm.dispatchMode === 'Partial'}
                            onChange={() => setShipmentForm(prev => ({ ...prev, dispatchMode: 'Partial' }))}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span>Partial Dispatch <span className="text-[10px] text-amber-600 font-semibold">(Recommended)</span></span>
                        </label>
                      </div>
                    </div>

                    {/* Dispatch Date */}
                    <div className="col-span-12 md:col-span-4">
                      <FormControl label="Dispatch Date *" required>
                        <input
                          type="date"
                          value={shipmentForm.dispatchDate}
                          onChange={e => setShipmentForm(prev => ({ ...prev, dispatchDate: e.target.value }))}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 transition-all"
                        />
                      </FormControl>
                    </div>

                    {/* Source Warehouse */}
                    <div className="col-span-12 md:col-span-4">
                      <FormControl label="Source Warehouse *" required>
                        <SearchableSelect
                          options={warehouses.map(w => ({ value: w.id, label: w.warehouse_name }))}
                          value={shipmentForm.sourceWarehouseId}
                          onChange={(e) => setShipmentForm(prev => ({ ...prev, sourceWarehouseId: e.target.value }))}
                          placeholder="Select Source Warehouse"
                        />
                      </FormControl>
                    </div>

                    {/* Target Warehouse */}
                    <div className="col-span-12 md:col-span-4">
                      <FormControl label="Target Warehouse *" required>
                        <SearchableSelect
                          options={warehouses.map(w => ({ value: w.id, label: w.warehouse_name }))}
                          value={shipmentForm.targetWarehouseId}
                          onChange={(e) => setShipmentForm(prev => ({ ...prev, targetWarehouseId: e.target.value }))}
                          placeholder="Finished Goods Store"
                        />
                      </FormControl>
                    </div>

                    {/* Dispatch Quantity */}
                    <div className="col-span-12 md:col-span-4">
                      <FormControl label="Dispatch Quantity *" required>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.001"
                            max={remainingQty}
                            step="any"
                            value={shipmentForm.dispatchQty}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              if (val > remainingQty) {
                                warningToast(`Cannot exceed available remaining qty (${remainingQty} Units)`);
                              }
                              setShipmentForm(prev => ({ ...prev, dispatchQty: e.target.value }));
                            }}
                            className="w-full p-2.5 pr-20 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 font-semibold text-slate-800 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShipmentForm(prev => ({ ...prev, dispatchQty: remainingQty }))}
                            className="absolute right-1.5 top-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold transition-all"
                          >
                            Ready: {remainingQty}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          Recommended: Only dispatch <span className="font-semibold text-amber-600">{remainingQty} units</span> which have passed quality check.
                        </p>
                      </FormControl>
                    </div>

                    {/* Carrier/Courier Name */}
                    <div className="col-span-12 md:col-span-6">
                      <FormControl label="Carrier / Courier Name">
                        <input
                          type="text"
                          placeholder="e.g. FedEx, BlueDart, Self-Delivery"
                          value={shipmentForm.carrierName}
                          onChange={e => setShipmentForm(prev => ({ ...prev, carrierName: e.target.value }))}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 transition-all"
                        />
                      </FormControl>
                    </div>

                    {/* Tracking Number / Docket No */}
                    <div className="col-span-12 md:col-span-6">
                      <FormControl label="Tracking Number / Docket No">
                        <input
                          type="text"
                          placeholder="Enter tracking ID"
                          value={shipmentForm.trackingNumber}
                          onChange={e => setShipmentForm(prev => ({ ...prev, trackingNumber: e.target.value }))}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 transition-all"
                        />
                      </FormControl>
                    </div>

                    {/* Shipping Notes */}
                    <div className="col-span-12">
                      <FormControl label="Shipping Notes">
                        <textarea
                          placeholder="Any additional details"
                          value={shipmentForm.shippingNotes}
                          onChange={e => setShipmentForm(prev => ({ ...prev, shippingNotes: e.target.value }))}
                          rows={3}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 resize-none transition-all"
                        />
                      </FormControl>
                    </div>
                  </div>

                  {/* Enable Auto-transfer */}
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="enableAutoTransfer"
                      checked={shipmentForm.enableAutoTransfer}
                      onChange={e => setShipmentForm(prev => ({ ...prev, enableAutoTransfer: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="enableAutoTransfer" className="text-xs text-slate-600 cursor-pointer font-medium">
                      Enable Auto-transfer on Production Log
                    </label>
                  </div>

                  {/* Form Footer */}
                  <div className="pt-6 border-t border-slate-100 flex flex-wrap justify-between items-center gap-4 mt-6">
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="text-emerald-600">● Accepted: {availableQty}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-indigo-600">● Transferred: {dispatchedQty}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-blue-600">● Available: {Math.max(0, availableQty - dispatchedQty)}</span>
                    </div>

                    <button
                      onClick={handleShipmentDispatchSubmit}
                      disabled={!shipmentForm.dispatchQty}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${!shipmentForm.dispatchQty
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                        }`}
                    >
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Dispatch {shipmentForm.dispatchQty || 0} Units ({shipmentForm.dispatchMode === 'Complete' ? 'Full' : 'Partial'})</span>
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              {/* 1. Add Time Log Section */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">

                  <h2 className="text-sm  text-slate-800  ">Add Time Log</h2>
                </div>

                <div className="bg-white rounded  border border-slate-100 shadow-sm">
                  <div className="p-2">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <div className='col-span-3'>
                        <FormControl label="Day & Date" required>
                          <div className="flex items-center  gap-1">
                            <input
                              type="number"
                              value={timeLogForm.day}
                              onChange={e => setTimeLogForm({ ...timeLogForm, day: e.target.value })}
                              className="p-2 w-10 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 "
                            />
                            <input
                              type="date"
                              value={timeLogForm.logDate}
                              onChange={e => handleDateChange('time', e.target.value)}
                              className="flex-1 p-2 bg-white border  border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                            />
                          </div>
                        </FormControl>
                      </div>

                      <div className='col-span-3'>
                        <FormControl label="Operator" required>
                          <SearchableSelect
                            options={users.map(u => {
                              let isBusyNow = false;
                              let busyRange = '';

                              // 1. Check current job card's logged times
                              logs.timeLogs?.forEach(log => {
                                if (log.operator_id !== u.id) return;

                                const logDateStr = log.log_date?.split(/[ T]/)[0];
                                if (timeLogForm.logDate && logDateStr && timeLogForm.logDate !== logDateStr) {
                                  return;
                                }

                                const busyStartStr = formatLocalTime(log.start_time);
                                const busyEndStr = formatLocalTime(log.end_time);

                                const busyStart = parse12hMinutes(busyStartStr);
                                const busyEnd = parse12hMinutes(busyEndStr);

                                const newStart = parseTimeToMinutes(timeLogForm.startTime || '08:00', timeLogForm.startAMPM || 'AM');
                                const newEnd = parseTimeToMinutes(timeLogForm.endTime || '04:00', timeLogForm.endAMPM || 'PM');

                                if (newStart < busyEnd && newEnd > busyStart) {
                                  isBusyNow = true;
                                  busyRange = `${busyStartStr} – ${busyEndStr} (${selectedJC?.job_card_no || 'Current Job'})`;
                                }
                              });

                              // 2. Check other in-progress job cards
                              if (!isBusyNow) {
                                const busyJobs = jobCards.filter(jc =>
                                  jc.id !== selectedJC?.id &&
                                  jc.assigned_to === u.id &&
                                  jc.status === 'IN_PROGRESS'
                                );

                                for (const jc of busyJobs) {
                                  const busyDate = (jc.latest_log_start_time || jc.start_time || '').split(/[ T]/)[0];
                                  if (timeLogForm.logDate && busyDate && timeLogForm.logDate !== busyDate) {
                                    continue;
                                  }

                                  const busyEndStr = getEstimatedEndTime(jc);
                                  const busyStartStr = formatLocalTime(jc.latest_log_start_time || jc.start_time);

                                  const busyStart = parse12hMinutes(busyStartStr);
                                  const busyEnd = parse12hMinutes(busyEndStr);

                                  const newStart = parseTimeToMinutes(timeLogForm.startTime || '08:00', timeLogForm.startAMPM || 'AM');
                                  const newEnd = parseTimeToMinutes(timeLogForm.endTime || '04:00', timeLogForm.endAMPM || 'PM');

                                  if (newStart < busyEnd && newEnd > busyStart) {
                                    isBusyNow = true;
                                    busyRange = `${busyStartStr} – ${busyEndStr} (${jc.job_card_no})`;
                                    break;
                                  }
                                }
                              }

                              return {
                                value: u.id,
                                label: u.username,
                                subLabel: isBusyNow
                                  ? `🔴 Busy (${busyRange})`
                                  : '🟢 Available',
                              };
                            })}
                            subLabelField="subLabel"
                            value={timeLogForm.operatorId}
                            onChange={(e) => setTimeLogForm({ ...timeLogForm, operatorId: e.target.value })}
                            placeholder="Select Operator..."
                          />
                        </FormControl>
                      </div>
                      <div className='col-span-2'>
                        <FormControl label="Workstation" required>
                          <SearchableSelect
                            options={workstations.map(w => {
                              const capacity = parseInt(w.capacity || 1);
                              let overlappingCount = 0;
                              let busyDetails = '';

                              // 1. Check current job card's logged times
                              logs.timeLogs?.forEach(log => {
                                if (Number(log.workstation_id) !== Number(w.id)) return;

                                const logDateStr = log.log_date?.split(/[ T]/)[0];
                                if (timeLogForm.logDate && logDateStr && timeLogForm.logDate !== logDateStr) {
                                  return;
                                }

                                const busyStartStr = formatLocalTime(log.start_time);
                                const busyEndStr = formatLocalTime(log.end_time);

                                const busyStart = parse12hMinutes(busyStartStr);
                                const busyEnd = parse12hMinutes(busyEndStr);

                                const newStart = parseTimeToMinutes(timeLogForm.startTime || '08:00', timeLogForm.startAMPM || 'AM');
                                const newEnd = parseTimeToMinutes(timeLogForm.endTime || '04:00', timeLogForm.endAMPM || 'PM');

                                if (newStart < busyEnd && newEnd > busyStart) {
                                  overlappingCount++;
                                  busyDetails = `${busyStartStr} – ${busyEndStr} (${selectedJC?.job_card_no || 'Current Job'})`;
                                }
                              });

                              // 2. Check other in-progress job cards
                              const activeJobs = jobCards.filter(jc =>
                                jc.id !== selectedJC?.id &&
                                Number(jc.workstation_id) === Number(w.id) &&
                                jc.status === 'IN_PROGRESS'
                              );

                              activeJobs.forEach(jc => {
                                const busyDate = (jc.latest_log_start_time || jc.start_time || '').split(/[ T]/)[0];
                                if (timeLogForm.logDate && busyDate && timeLogForm.logDate !== busyDate) {
                                  return;
                                }

                                const busyEndStr = getEstimatedEndTime(jc);
                                const busyStartStr = formatLocalTime(jc.latest_log_start_time || jc.start_time);

                                const busyStart = parse12hMinutes(busyStartStr);
                                const busyEnd = parse12hMinutes(busyEndStr);

                                const newStart = parseTimeToMinutes(timeLogForm.startTime || '08:00', timeLogForm.startAMPM || 'AM');
                                const newEnd = parseTimeToMinutes(timeLogForm.endTime || '04:00', timeLogForm.endAMPM || 'PM');

                                if (newStart < busyEnd && newEnd > busyStart) {
                                  overlappingCount++;
                                  busyDetails = `${busyStartStr} – ${busyEndStr} (${jc.job_card_no})`;
                                }
                              });

                              return {
                                value: w.id,
                                label: w.workstation_name,
                                subLabel: overlappingCount > 0
                                  ? `🔴 Busy (${busyDetails})`
                                  : '🟢 Available',
                              };
                            })}
                            subLabelField="subLabel"
                            value={timeLogForm.workstationId}
                            onChange={(e) => handleWorkstationChange(e.target.value)}
                            placeholder="Select Machine..."
                          />
                        </FormControl>
                      </div>
                      <div className='col-span-2'>
                        <FormControl label="Shift" required>
                          <div className="flex items-center gap-1">
                            <select value={timeLogForm.shift} onChange={e => setTimeLogForm({ ...timeLogForm, shift: e.target.value })} className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 appearance-none">
                              <option value="SHIFT_A">A</option>
                              <option value="SHIFT_B">B</option>
                              <option value="SHIFT_C">C</option>
                            </select>
                            <button className="p-2 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </FormControl>
                      </div>
                      <div className='col-span-2'>
                        <FormControl label="Produce Qty" required>
                          <div className="relative">
                            <input
                              type="number"
                              value={timeLogForm.producedQty}
                              onChange={e => {
                                const newQty = e.target.value;
                                setTimeLogForm({ ...timeLogForm, producedQty: newQty });
                                if (timeLogForm.startTime) {
                                  calculateAutoEndTime(timeLogForm.startTime, timeLogForm.startAMPM || 'AM', newQty);
                                }
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs  text-slate-400 ">Units</span>
                          </div>
                        </FormControl>
                      </div>
                      <div className='col-span-4'>
                        <div className="flex justify-between">
                          <FormControl label="Production Period" required>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <TimePicker
                                  value={timeLogForm.startTime}
                                  ampmValue={timeLogForm.startAMPM}
                                  placeholder="08:00"
                                  placeholderAMPM="AM"
                                  onTimeChange={(newTime) => {
                                    setTimeLogForm({ ...timeLogForm, startTime: newTime, startAMPM: timeLogForm.startAMPM || 'AM' });
                                    calculateAutoEndTime(newTime, timeLogForm.startAMPM || 'AM', timeLogForm.producedQty);
                                  }}
                                  onAMPMChange={(newAMPM) => {
                                    setTimeLogForm({ ...timeLogForm, startAMPM: newAMPM });
                                    calculateAutoEndTime(timeLogForm.startTime, newAMPM, timeLogForm.producedQty);
                                  }}
                                />
                              </div>
                              <ChevronRight className="w-3 h-3 text-slate-300" />
                              <div className="flex-1">
                                <TimePicker
                                  value={timeLogForm.endTime}
                                  ampmValue={timeLogForm.endAMPM}
                                  placeholder="04:00"
                                  placeholderAMPM="PM"
                                  onTimeChange={(newTime) => setTimeLogForm({ ...timeLogForm, endTime: newTime, endAMPM: timeLogForm.endAMPM || 'PM' })}
                                  onAMPMChange={(newAMPM) => setTimeLogForm({ ...timeLogForm, endAMPM: newAMPM })}
                                />
                              </div>
                            </div>
                          </FormControl>

                        </div>

                      </div>
                      <div className='col-span-1'>
                        <FormControl label="Execution (P)">
                          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-700 ">
                            {(() => {
                              const rawCycleTime = parseFloat(selectedJC.cycle_time) || parseFloat(selectedJC.std_time) || 0;
                              const cycleTime = rawCycleTime >= 1 ? Math.round(rawCycleTime) : rawCycleTime;
                              const setupTime = parseFloat(selectedJC.setup_time || 0);
                              const qty = parseFloat(timeLogForm.producedQty || 0);
                              const total = (cycleTime * qty) + setupTime;
                              return (
                                <div className="flex flex-col">
                                  <span>{Math.round(total)}m</span>
                                  {qty > 0 && (
                                    <span className="text-[10px] text-indigo-400 font-normal">
                                      ({cycleTime}m × {qty}) + {setupTime}m
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </FormControl>
                      </div>
                      <div className='col-span-1'>
                        <FormControl label="Actual Mins">
                          <input
                            type="text"
                            placeholder="480"
                            value={calculateTotalMins(timeLogForm.startTime, timeLogForm.startAMPM, timeLogForm.endTime, timeLogForm.endAMPM) || ''}
                            readOnly
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none  text-slate-600 "
                          />
                        </FormControl>
                      </div>
                      <div className='col-span-6'>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => addTimeLog(timeLogForm)}
                            className="px-10 py-2.5 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all text-xs    shadow-lg shadow-indigo-100 flex items-center gap-2 h-[38px]"
                          >
                            <Monitor className="w-4 h-4" />
                            Record Time
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-end gap-2">

                      <div className="flex items-center gap-2">

                      </div>
                    </div>

                    <div className=" overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-white">
                      <DataTable
                        columns={timeLogColumns}
                        data={logs.timeLogs}
                        loading={loading}
                        pageSize={10}
                        emptyMessage="No time logs recorded for this operation"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Quality & Rejection Entry Section */}
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-6 p-4 bg-white rounded border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-50 rounded flex items-center justify-center text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm text-slate-800">Quality & Rejection Entry</h2>
                  </div>

                  <div className="flex items-center gap-4">
                    {qcSuccessMessage && (
                      <span className="text-emerald-600 text-xs  animate-pulse">
                        ✅ {qcSuccessMessage}
                      </span>
                    )}
                    <button
                      onClick={sendToQuality}
                      className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-all text-xs shadow-lg shadow-emerald-100 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Send to Quality
                    </button>
                  </div>
                </div>
              </section>

              <section className="mt-8 overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-white">
                <DataTable
                  columns={qualityLogColumns}
                  data={logs.qualityLogs}
                  loading={loading}
                  pageSize={10}
                  emptyMessage="No quality inspection logs found"
                />
              </section>

              {/* 3. Operational Downtime Section */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-8 h-8 bg-amber-50 rounded  flex items-center justify-center text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm  text-slate-800  ">Operational Downtime</h2>
                </div>

                <div className="bg-white rounded  border border-slate-100 shadow-sm">
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-6 border-b border-slate-50 pb-6">
                      <FormControl label="Day & Date" required>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={downtimeLogForm.day}
                            onChange={e => setDowntimeLogForm({ ...downtimeLogForm, day: e.target.value })}
                            className="w-14 px-2 py-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500 "
                          />
                          <input
                            type="date"
                            value={downtimeLogForm.downtimeDate}
                            onChange={e => handleDateChange('downtime', e.target.value)}
                            className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500"
                          />
                        </div>
                      </FormControl>
                      <FormControl label="Shift" required>
                        <div className="flex items-center gap-1">
                          <select value={downtimeLogForm.shift} onChange={e => setDowntimeLogForm({ ...downtimeLogForm, shift: e.target.value })} className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500 appearance-none">
                            <option value="SHIFT_A">A</option>
                            <option value="SHIFT_B">B</option>
                            <option value="SHIFT_C">C</option>
                          </select>
                          <button className="p-2 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </FormControl>
                      <FormControl label="Downtime Type" required>
                        <select value={downtimeLogForm.downtimeType} onChange={e => setDowntimeLogForm({ ...downtimeLogForm, downtimeType: e.target.value })} className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:border-amber-500">
                          <option value="">Select Type</option>
                          <option value="Planned Downtime">Planned Downtime</option>
                          <option value="Unplanned Downtime">Unplanned Downtime</option>
                          <option value="Breakdown">Breakdown</option>
                        </select>
                      </FormControl>
                      <FormControl label="Start Time" required>
                        <TimePicker
                          value={downtimeLogForm.startTime}
                          ampmValue={downtimeLogForm.startAMPM}
                          placeholder="08:00"
                          placeholderAMPM="AM"
                          onTimeChange={(newTime) => setDowntimeLogForm({ ...downtimeLogForm, startTime: newTime, startAMPM: downtimeLogForm.startAMPM || 'AM' })}
                          onAMPMChange={(newAMPM) => setDowntimeLogForm({ ...downtimeLogForm, startAMPM: newAMPM })}
                        />
                      </FormControl>
                      <FormControl label="End Time" required>
                        <TimePicker
                          value={downtimeLogForm.endTime}
                          ampmValue={downtimeLogForm.endAMPM}
                          placeholder="04:00"
                          placeholderAMPM="PM"
                          onTimeChange={(newTime) => setDowntimeLogForm({ ...downtimeLogForm, endTime: newTime, endAMPM: downtimeLogForm.endAMPM || 'PM' })}
                          onAMPMChange={(newAMPM) => setDowntimeLogForm({ ...downtimeLogForm, endAMPM: newAMPM })}
                        />
                      </FormControl>
                      <FormControl label="Total Mins">
                        <input
                          type="text"
                          placeholder="480"
                          readOnly
                          value={calculateTotalMins(downtimeLogForm.startTime, downtimeLogForm.startAMPM, downtimeLogForm.endTime, downtimeLogForm.endAMPM) || ''}
                          className="w-full p-2 bg-slate-50 border border-slate-100 rounded text-xs outline-none  text-slate-400"
                        />
                      </FormControl>
                    </div>

                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1">
                        {logs.qualityLogs?.some(log => log.status?.trim() !== 'APPROVED') && (
                          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded  border border-amber-100">
                            <div className="w-5 h-5 bg-amber-100 rounded flex items-center justify-center shrink-0 mt-0.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-xs   text-amber-800   ">QC Verification Pending</p>
                              <p className="text-xs text-amber-700 leading-relaxed mt-0.5 ">
                                Cannot record downtime while quality logs are pending approval. Please verify quality entries first.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => addDowntimeLog(downtimeLogForm)}
                        disabled={logs.qualityLogs?.some(log => log.status?.trim() !== 'APPROVED')}
                        className={`px-10 py-2.5 rounded  transition-all text-xs    shadow-lg flex items-center gap-2 h-[38px] ${logs.qualityLogs?.some(log => log.status?.trim() !== 'APPROVED')
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-100'
                          }`}
                      >
                        <Clock className="w-4 h-4" />
                        Record Downtime
                      </button>
                    </div>

                    <div className="mt-8 overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-white">
                      <DataTable
                        columns={downtimeLogColumns}
                        data={logs.downtimeLogs}
                        loading={loading}
                        pageSize={10}
                        emptyMessage="No downtime recorded for this session"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Next Stage Configuration Section */}
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-50 rounded  flex items-center justify-center text-indigo-600">
                      <Play className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm  text-slate-800  ">Next Stage Configuration</h2>
                    <span className=" bg-emerald-50 text-emerald-600 rounded text-xs   border border-emerald-100">Active</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <button
                      onClick={handleReadyForDispatch}
                      disabled={logs.qualityLogs.some(log => log.status !== 'APPROVED')}
                      className={`flex items-center gap-2 p-1.5 border rounded  transition-all ${logs.qualityLogs.some(log => log.status !== 'APPROVED')
                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-white border-emerald-100 text-emerald-600 shadow-sm hover:bg-emerald-50'
                        }`}
                      title={logs.qualityLogs.some(log => log.status !== 'APPROVED') ? 'Approve all quality records to proceed' : 'Mark Ready'}
                    >
                      <Zap className={`w-3.5 h-3.5 ${logs.qualityLogs.some(log => log.status !== 'APPROVED') ? 'text-slate-200' : 'text-emerald-500 animate-pulse'}`} />
                      <span className="text-xs   ">Ready for Dispatch</span>
                    </button>
                    <div className="text-right">
                      <p className="flex items-center gap-1.5 text-xs  text-slate-400  ">
                        <Box className="w-3 h-3" />
                        Transferred so far: <span className="text-slate-700">{parseFloat(selectedJC.transferred_qty || 0).toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs  text-slate-400 italic px-1">Specify destination and operational parameters for the next manufacturing phase</p>

                <div className="bg-white rounded  border border-slate-100 shadow-sm p-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <FormControl label="Next Operation" required>
                      <SearchableSelect
                        options={nextOperationOptions}
                        value={nextStageForm.nextOperationId}
                        onChange={(e) => setNextStageForm({ ...nextStageForm, nextOperationId: e.target.value })}
                        placeholder="Select Next Op"
                      />
                    </FormControl>
                    <FormControl label="Assign Operator">
                      <SearchableSelect
                        options={users.map(u => {
                          const busyJc = jobCards.find(jc => String(jc.assigned_to) === String(u.id) && jc.status === 'IN_PROGRESS');
                          return {
                            value: u.id,
                            label: u.username,
                            availability: busyJc ? `🔴 Busy (${busyJc.job_card_no})` : `🟢 Available`
                          };
                        })}
                        subLabelField="availability"
                        value={nextStageForm.assignOperatorId}
                        onChange={(e) => setNextStageForm({ ...nextStageForm, assignOperatorId: e.target.value })}
                        placeholder="Search Operator..."
                        className={isSelectedOperatorBusy ? '!border-rose-500 !ring-rose-500/20' : ''}
                      />
                      {isSelectedOperatorBusy && (
                        <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          Selected operator is currently busy with another Job Card.
                        </p>
                      )}
                    </FormControl>
                    <FormControl label="Target Warehouse" required>
                      <SearchableSelect
                        options={warehouses.map(w => ({ value: w.id, label: w.warehouse_name }))}
                        value={nextStageForm.targetWarehouseId}
                        onChange={(e) => setNextStageForm({ ...nextStageForm, targetWarehouseId: e.target.value })}
                        placeholder="Select Destination"
                      />
                    </FormControl>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400  ">Execution Mode:</label>
                      <div className="flex items-center gap-2 p-1 bg-slate-50 rounded  w-fit">
                        <button
                          onClick={() => setNextStageForm({ ...nextStageForm, executionMode: 'In-house' })}
                          className={`flex items-center gap-2 p-1.5 rounded-md text-xs    transition-all ${nextStageForm.executionMode === 'In-house' ? 'bg-white border border-indigo-100 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          <span className={`w-2.5 h-2.5 rounded ${nextStageForm.executionMode === 'In-house' ? 'bg-indigo-500' : 'border-2 border-slate-300'}`}></span>
                          In-house
                        </button>
                        <button
                          onClick={() => setNextStageForm({ ...nextStageForm, executionMode: 'Outsource' })}
                          className={`flex items-center gap-2 p-1.5 rounded-md text-xs    transition-all ${nextStageForm.executionMode === 'Outsource' ? 'bg-white border border-indigo-100 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          <span className={`w-2.5 h-2.5 rounded ${nextStageForm.executionMode === 'Outsource' ? 'bg-indigo-500' : 'border-2 border-slate-300'}`}></span>
                          Outsource
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-start border-t border-slate-50 pt-6">
                    {selectedJC.status === 'COMPLETED' ? (
                      <div className="flex items-center gap-2.5 p-3 px-5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-sm">
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="text-left">
                          <p className="text-xs opacity-90 font-medium">Finalize & Dispatch</p>
                          <p className="text-sm font-bold">Production Completed</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleTransferQty}
                          disabled={isTransferDisabled}
                          className={`group relative flex items-center gap-2 p-2 rounded transition-all ${isTransferDisabled
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                            : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            }`}
                        >
                          <div className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${isTransferDisabled
                            ? 'bg-slate-100 text-slate-200'
                            : 'bg-white/20 text-white'
                            }`}>
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs opacity-80">Transfer Qty</p>
                            <p className="text-sm font-semibold">
                              Transfer {availableTransferQty.toFixed(0)} Qty
                            </p>
                          </div>
                        </button>

                        <button
                          onClick={handleReadyForDispatch}
                          disabled={!qcStats.isApproved || !qcStats.isComplete}
                          className={`group relative flex items-center gap-2 p-2 rounded transition-all ${!qcStats.isApproved || !qcStats.isComplete
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                            }`}
                        >
                          <div className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${!qcStats.isApproved || !qcStats.isComplete
                            ? 'bg-slate-100 text-slate-200'
                            : 'bg-white/20 text-white'
                            }`}>
                            <CheckCircle className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs opacity-80">Finalize & Dispatch</p>
                            <p className="text-sm font-semibold">Complete Production</p>
                          </div>
                          <ChevronRight className={`w-4 h-4 ml-4 transition-transform group-hover:translate-x-1 ${!qcStats.isApproved || !qcStats.isComplete ? 'opacity-20' : 'opacity-100'
                            }`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* 5. Daily Production Report Section */}
          {selectedJC && !isShipmentOp(selectedJC) && (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 rounded  flex items-center justify-center text-indigo-600">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm  text-slate-800  ">Daily Production Report</h2>
                </div>
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 p-2 bg-indigo-50 text-indigo-600 rounded  hover:bg-indigo-100 transition-colors border border-indigo-100"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-xs   ">Download CSV</span>
                </button>
              </div>

              <p className="text-xs  text-slate-400 italic px-1">Consolidated daily and shift-wise production metrics</p>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <DataTable
                  columns={consolidatedReportColumns}
                  data={consolidatedReport}
                  loading={loading}
                  pageSize={10}
                  emptyMessage="No consolidated report data available"
                />
              </div>
            </section>
          )}
        </div>

        {/* View Time Log Modal */}
        <Modal
          isOpen={!!viewingTimeLog}
          onClose={() => setViewingTimeLog(null)}
          title="View Time Log"
          maxWidth="max-w-xl"
        >
          {viewingTimeLog && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Date & Shift</p>
                  <p className="text-sm  text-slate-700">
                    {new Date(viewingTimeLog.log_date).toLocaleDateString('en-GB')} - {viewingTimeLog.shift}
                  </p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Operator</p>
                  <p className="text-sm  text-slate-700">{viewingTimeLog.operator_name}</p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Time Interval</p>
                  <p className="text-sm  text-slate-700">
                    {viewingTimeLog.start_time?.slice(11, 16)} - {viewingTimeLog.end_time?.slice(11, 16)}
                  </p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Produced Quantity</p>
                  <p className="text-sm  text-indigo-600">
                    {parseFloat(viewingTimeLog.produced_qty).toFixed(3)} Units
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  onClick={() => setViewingTimeLog(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded  text-xs    hover:bg-slate-200 transition-colors"
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
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Date & Shift</p>
                  <p className="text-sm  text-slate-700">
                    {new Date(viewingQualityLog.check_date).toLocaleDateString('en-GB')} - {viewingQualityLog.shift}
                  </p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Inspected Quantity</p>
                  <p className="text-sm  text-slate-700">{viewingQualityLog.inspected_qty} Units</p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Accepted Quantity</p>
                  <p className="text-sm  text-emerald-600">{viewingQualityLog.accepted_qty} Units</p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Rejected Quantity</p>
                  <p className="text-sm  text-rose-600">{viewingQualityLog.rejected_qty} Units</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs  text-slate-400   mb-1">Rejection Reason</p>
                  <p className="text-sm text-slate-600">{viewingQualityLog.rejection_reason || 'N/A'}</p>
                </div>
                {viewingQualityLog.vendor_invoice && (
                  <div className="col-span-2">
                    <p className="text-xs  text-slate-400   mb-1">Vendor Invoice</p>
                    <a
                      href={`${API_BASE.replace('/api', '')}/${viewingQualityLog.vendor_invoice}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 p-2 bg-emerald-50 text-emerald-700 rounded  text-xs  hover:bg-emerald-100 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Invoice Copy
                    </a>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  onClick={() => setViewingQualityLog(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded  text-xs    hover:bg-slate-200 transition-colors"
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

  const handleOutwardChallan = async (jc) => {
    setSelectedJCOutward(jc);

    if (jc.outward_challan_id) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/outward-challans/job-card/${jc.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const challan = await response.json();
          setOutwardFormData({
            id: challan.id,
            vendorId: challan.vendor_id || '',
            operationName: challan.operation_name || jc.operation_name || '',
            plannedQty: challan.planned_qty || jc.planned_qty || 0,
            expectedReturnDate: challan.expected_return_date ? challan.expected_return_date.split('T')[0] : '',
            dispatchDate: challan.dispatch_date ? challan.dispatch_date.split('T')[0] : new Date().toISOString().split('T')[0],
            dispatchQty: challan.dispatch_qty || jc.planned_qty || 0,
            dispatchNotes: challan.notes || '',
            materialItems: (challan.items || []).map(item => ({
              itemCode: item.item_code,
              requiredQty: item.required_qty,
              releaseQty: item.release_qty
            }))
          });
          setIsOutwardModalOpen(true);
          return;
        }
      } catch (error) {
        console.error('Error fetching existing outward challan:', error);
      }
    }

    setOutwardFormData({
      vendorId: jc.vendor_id || '',
      operationName: jc.operation_name || '',
      plannedQty: jc.planned_qty || 0,
      expectedReturnDate: '',
      dispatchDate: new Date().toISOString().split('T')[0],
      dispatchQty: jc.planned_qty || 0,
      dispatchNotes: '',
      materialItems: []
    });
    setIsOutwardModalOpen(true);
  };

  const handleTransferQty = async () => {
    try {
      if (!nextStageForm.nextOperationId) {
        errorToast('Please select a Next Operation to transfer quantity.');
        return;
      }

      // Check if selected next operator is busy
      const isOperatorBusy = (() => {
        if (!nextStageForm.assignOperatorId) return false;
        return jobCards.some(jc => String(jc.assigned_to) === String(nextStageForm.assignOperatorId) && jc.status === 'IN_PROGRESS');
      })();

      if (isOperatorBusy) {
        const confirmBusy = await Swal.fire({
          title: 'Operator Busy',
          text: 'The selected operator is currently busy with another Job Card. Do you want to assign them anyway?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#e11d48', // rose-600
          cancelButtonColor: '#64748b',
          confirmButtonText: 'Yes, Assign anyway',
          cancelButtonText: 'No, Cancel'
        });
        if (!confirmBusy.isConfirmed) {
          return;
        }
      }

      const parentId = selectedJC.plan_id || selectedJC.parent_wo_id || selectedJC.sales_order_id;
      const woJCs = jobCards
        .filter(j => {
          if (String(j.work_order_id) === String(selectedJC.work_order_id)) return true;
          const jParentId = j.plan_id || j.parent_wo_id || j.sales_order_id;
          if (parentId && jParentId && String(parentId) === String(jParentId)) return true;
          return false;
        })
        .sort((a, b) => {
          const aSeq = parseInt(a.sequence_no || a.operation_sequence || 0);
          const bSeq = parseInt(b.sequence_no || b.operation_sequence || 0);
          if (aSeq !== bSeq) return aSeq - bSeq;
          return a.id - b.id;
        });

      const nextJC = woJCs.find(j => String(j.operation_id) === String(nextStageForm.nextOperationId));
      if (!nextJC) {
        errorToast('Next Operation Job Card not found.');
        return;
      }

      const alreadyTransferredQty = nextJC.status === 'PENDING' ? 0 : Math.max(parseFloat(nextJC.planned_qty || 0), parseFloat(nextJC.accepted_qty || 0));
      const carryQty = Math.max(0, (selectedJC.accepted_qty || qcStats.totalAccepted || 0) - alreadyTransferredQty);

      if (carryQty <= 0) {
        errorToast('No quantity available to transfer.');
        return;
      }

      const confirmTransfer = await Swal.fire({
        title: `Transfer ${carryQty} Qty?`,
        text: `Are you sure you want to transfer ${carryQty} Qty to the next stage?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Transfer'
      });

      if (!confirmTransfer.isConfirmed) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${nextJC.id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assignedTo: nextStageForm.assignOperatorId || null,
          executionType: nextStageForm.executionMode,
          targetWarehouseId: nextStageForm.targetWarehouseId || null,
          plannedQty: carryQty
        })
      });

      if (response.ok) {
        successToast(`Successfully transferred ${carryQty} Qty to next operation.`);
        fetchJobCards();
      } else {
        const errData = await response.json().catch(() => ({}));
        errorToast(errData.error || 'Failed to transfer quantity.');
      }
    } catch (error) {
      console.error('Error transferring quantity:', error);
      errorToast('Failed to transfer quantity.');
    }
  };

  const handleReadyForDispatch = async () => {
    try {
      if (!qcStats.isApproved) {
        errorToast('All quality inspection records must be Approved before proceeding.');
        return;
      }

      if (!qcStats.isComplete) {
        errorToast(`Insufficient QC inspection! Produced: ${qcStats.totalProduced}, Inspected: ${qcStats.totalInspected}. All produced items must be inspected.`);
        return;
      }

      // Check if selected next operator is busy
      const isOperatorBusy = (() => {
        if (!nextStageForm.assignOperatorId) return false;
        return jobCards.some(jc => String(jc.assigned_to) === String(nextStageForm.assignOperatorId) && jc.status === 'IN_PROGRESS');
      })();

      if (isOperatorBusy) {
        const confirmBusy = await Swal.fire({
          title: 'Operator Busy',
          text: 'The selected operator is currently busy with another Job Card. Do you want to assign them anyway?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#e11d48', // rose-600
          cancelButtonColor: '#64748b',
          confirmButtonText: 'Yes, Assign anyway',
          cancelButtonText: 'No, Cancel'
        });
        if (!confirmBusy.isConfirmed) {
          return;
        }
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
          // If there's a next operation selected, we can optionally update its operator/status
          // Finding the next JC in sequence to auto-assign it
          const woJCs = jobCards
            .filter(j => String(j.work_order_id) === String(selectedJC.work_order_id))
            .sort((a, b) => {
              const aSeq = parseInt(a.sequence_no || a.operation_sequence || 0);
              const bSeq = parseInt(b.sequence_no || b.operation_sequence || 0);
              if (aSeq !== bSeq) return aSeq - bSeq;
              return a.id - b.id;
            });

          const currentIndex = woJCs.findIndex(j => j.id === selectedJC.id);
          const nextJC = nextStageForm.nextOperationId
            ? woJCs.find(j => String(j.operation_id) === String(nextStageForm.nextOperationId))
            : (currentIndex !== -1 ? woJCs[currentIndex + 1] : null);

          if (nextJC && nextStageForm.nextOperationId) {
            // Update next JC with selected operator, execution type, and carry-forward plannedQty
            await fetch(`${API_BASE}/job-cards/${nextJC.id}/progress`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                assignedTo: nextStageForm.assignOperatorId || null,
                executionType: nextStageForm.executionMode,
                targetWarehouseId: nextStageForm.targetWarehouseId || null
              })
            });
          }

          successToast('Job Card marked as COMPLETED');
          setShowProductionEntry(false);
          fetchJobCards();
          navigate(`${deptPrefix}/job-card`);
        } else {
          const errData = await response.json().catch(() => ({}));
          errorToast(errData.error || 'Failed to update status');
        }
      }
    } catch (error) {
      errorToast('Failed to mark ready for dispatch');
    }
  };

  const handleShipmentDispatchSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      const dispatchedQty = parseFloat(selectedJC.dispatch_qty || selectedJC.accepted_qty || 0);
      const newDispatchQty = parseFloat(shipmentForm.dispatchQty) || 0;
      const totalDispatched = dispatchedQty + newDispatchQty;
      const targetQty = parseFloat(selectedJC.wo_quantity || selectedJC.planned_qty || 0);

      const isCompleted = shipmentForm.dispatchMode === 'Complete' || totalDispatched >= targetQty;
      const nextStatus = isCompleted ? 'COMPLETED' : 'IN_PROGRESS';

      const confirmText = isCompleted
        ? `Are you sure you want to dispatch ${shipmentForm.dispatchQty} units? This will complete the shipment stage.`
        : `Are you sure you want to dispatch ${shipmentForm.dispatchQty} units? This is a partial dispatch, so the shipment stage will remain active.`;

      const result = await Swal.fire({
        title: 'Confirm Dispatch?',
        text: confirmText,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: isCompleted ? '#4f46e5' : '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Confirm Dispatch'
      });

      if (!result.isConfirmed) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: nextStatus,
          producedQty: parseFloat(selectedJC.produced_qty || 0) + newDispatchQty,
          acceptedQty: parseFloat(selectedJC.accepted_qty || 0) + newDispatchQty,
          dispatchQty: dispatchedQty + newDispatchQty,
          carrierName: shipmentForm.carrierName,
          trackingNumber: shipmentForm.trackingNumber,
          shippingNotes: shipmentForm.shippingNotes,
          dispatchDate: shipmentForm.dispatchDate,
          dispatchMode: shipmentForm.dispatchMode,
          targetWarehouseId: shipmentForm.targetWarehouseId || null
        })
      });

      if (response.ok) {
        successToast(isCompleted
          ? 'Shipment dispatched successfully and stage completed!'
          : `Shipment of ${shipmentForm.dispatchQty} units dispatched successfully! Stage remains In-Progress.`
        );
        setShowProductionEntry(false);
        fetchJobCards();
        navigate(`${deptPrefix}/job-card`);
      } else {
        const error = await response.json();
        errorToast(error.error || 'Failed to dispatch shipment');
      }
    } catch (error) {
      console.error(error);
      errorToast('Network error');
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

  const validateWorkstationAvailability = (workstationId, date, startTime, startAMPM, endTime, endAMPM) => {
    const ws = workstations.find(w => w.id === parseInt(workstationId));
    const capacity = 1;

    let overlappingCount = 0;
    let overlappingJobNo = '';

    // 1. Check current job logs
    logs.timeLogs?.forEach(log => {
      if (log.workstation_id !== parseInt(workstationId)) return;

      const logDateStr = log.log_date?.split(/[ T]/)[0];
      if (date && logDateStr && date !== logDateStr) {
        return;
      }

      const busyStartStr = formatLocalTime(log.start_time);
      const busyEndStr = formatLocalTime(log.end_time);

      const busyStart = parse12hMinutes(busyStartStr);
      const busyEnd = parse12hMinutes(busyEndStr);

      const newStart = parseTimeToMinutes(startTime, startAMPM);
      const newEnd = parseTimeToMinutes(endTime, endAMPM);

      if (newStart < busyEnd && newEnd > busyStart) {
        overlappingCount++;
        overlappingJobNo = selectedJC?.job_card_no || 'Current Job';
      }
    });

    // 2. Check other active jobs
    const activeJobs = jobCards.filter(jc =>
      jc.id !== selectedJC?.id &&
      jc.workstation_id === parseInt(workstationId) &&
      jc.status === 'IN_PROGRESS'
    );

    activeJobs.forEach(busyJob => {
      const busyDate = (busyJob.latest_log_start_time || busyJob.start_time || '').split(/[ T]/)[0];
      if (date && busyDate && date !== busyDate) {
        return;
      }

      const busyEndStr = getEstimatedEndTime(busyJob);
      const busyStartStr = formatLocalTime(busyJob.latest_log_start_time || busyJob.start_time);

      const busyStart = parse12hMinutes(busyStartStr);
      const busyEnd = parse12hMinutes(busyEndStr);

      const newStart = parseTimeToMinutes(startTime, startAMPM);
      const newEnd = parseTimeToMinutes(endTime, endAMPM);

      const isOverlap = newStart < busyEnd && newEnd > busyStart;
      if (isOverlap) {
        overlappingCount++;
        overlappingJobNo = busyJob.job_card_no;
      }
    });

    if (overlappingCount >= capacity && overlappingJobNo) {
      Swal.fire({
        icon: 'error',
        title: 'Machine Already in Use',
        html: `
          <div class="text-left space-y-1">
            <p class=" text-xs  text-rose-600">🔴 ${ws.workstation_name} busy to capacity with ${overlappingJobNo}</p>
          </div>
        `,
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
      });
      return false;
    }
    return true;
  };

  const validateOperatorAvailability = (operatorId, date, startTime, startAMPM, endTime, endAMPM) => {
    const operator = users.find(u => u.id === parseInt(operatorId));

    // 1. Check current job logs
    const localOverlap = logs.timeLogs?.find(log => {
      if (log.operator_id !== parseInt(operatorId)) return false;

      const logDateStr = log.log_date?.split(/[ T]/)[0];
      if (date && logDateStr && date !== logDateStr) {
        return false;
      }

      const busyStartStr = formatLocalTime(log.start_time);
      const busyEndStr = formatLocalTime(log.end_time);

      const busyStart = parse12hMinutes(busyStartStr);
      const busyEnd = parse12hMinutes(busyEndStr);

      const newStart = parseTimeToMinutes(startTime, startAMPM);
      const newEnd = parseTimeToMinutes(endTime, endAMPM);

      return newStart < busyEnd && newEnd > busyStart;
    });

    if (localOverlap) {
      const busyStartStr = formatLocalTime(localOverlap.start_time);
      const busyEndStr = formatLocalTime(localOverlap.end_time);

      Swal.fire({
        icon: 'error',
        title: 'Operator Not Available',
        html: `
          <div class="text-left space-y-2">
            <p class="text-sm text-slate-600">Operator is already assigned to another job during this time.</p>
            <div class="p-2 bg-rose-50 border border-rose-100 rounded">
              <p class=" text-xs text-rose-600">🔴 Busy with ${selectedJC?.job_card_no || 'Current Job'}</p>
              <p class="text-xs  text-rose-500 mt-1">⏱ ${busyStartStr} – ${busyEndStr}</p>
            </div>
            <p class="text-xs  text-emerald-600">✅ Available after ${busyEndStr}</p>
          </div>
        `,
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 6000,
        timerProgressBar: true
      });
      return false;
    }

    // 2. Check other active jobs
    const busyJob = jobCards.find(jc => {
      if (jc.id === selectedJC?.id || jc.assigned_to !== parseInt(operatorId) || jc.status !== 'IN_PROGRESS') {
        return false;
      }

      const busyDate = (jc.latest_log_start_time || jc.start_time || '').split(/[ T]/)[0];
      if (date && busyDate && date !== busyDate) {
        return false;
      }

      const busyEndStr = getEstimatedEndTime(jc);
      const busyStartStr = formatLocalTime(jc.latest_log_start_time || jc.start_time);

      const busyStart = parse12hMinutes(busyStartStr);
      const busyEnd = parse12hMinutes(busyEndStr);

      const newStart = parseTimeToMinutes(startTime, startAMPM);
      const newEnd = parseTimeToMinutes(endTime, endAMPM);

      return newStart < busyEnd && newEnd > busyStart;
    });

    if (busyJob && operator) {
      const busyEndStr = getEstimatedEndTime(busyJob);
      const busyStartStr = formatLocalTime(busyJob.latest_log_start_time || busyJob.start_time);

      Swal.fire({
        icon: 'error',
        title: 'Operator Not Available',
        html: `
          <div class="text-left space-y-2">
            <p class="text-sm text-slate-600">Operator is already assigned to another job during this time.</p>
            <div class="p-2 bg-rose-50 border border-rose-100 rounded">
              <p class=" text-xs text-rose-600">🔴 Busy with ${busyJob.job_card_no}</p>
              <p class="text-xs  text-rose-500 mt-1">⏱ ${busyStartStr} – ${busyEndStr}</p>
            </div>
            <p class="text-xs  text-emerald-600">✅ Available after ${busyEndStr}</p>
          </div>
        `,
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 6000,
        timerProgressBar: true
      });
      return false;
    }
    return true;
  };

  const handleStartMachine = () => {
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
    const [time, ampm] = startTimeStr.split(' ');

    // For "Start", we check if currently busy (overlap with current time)
    // We can use a 1-min window for the check
    const isAvailable = validateWorkstationAvailability(timeLogForm.workstationId, timeLogForm.logDate, time, ampm, time, ampm);
    if (isAvailable) {
      setMachineStatus("RUNNING");
    }
  };

  const validateShiftCapacity = (logData) => {
    if (!selectedJC) return true;

    let stdTime = parseFloat(selectedJC.std_time) || parseFloat(selectedJC.cycle_time) || 0;
    if (!stdTime || stdTime <= 0) return true;

    const uom = (selectedJC.time_uom || 'min').toLowerCase();
    if (uom === 'hr' || uom === 'hour' || uom === 'hours') {
      stdTime *= 60;
    } else if (uom === 'sec' || uom === 'second' || uom === 'seconds') {
      stdTime /= 60;
    }

    // Align validation with UI rounding (toFixed(0)) for integer-like standard/cycle times
    if (stdTime >= 1) {
      stdTime = Math.round(stdTime);
    }

    const availableMins = calculateTotalMins(logData.startTime, logData.startAMPM, logData.endTime, logData.endAMPM);
    if (availableMins <= 0) return true;

    const maxShiftMins = 720; // 12 hours max capacity per shift
    const allowedLimit = Math.min(availableMins, maxShiftMins);

    const enteredQty = parseFloat(logData.producedQty || 0);
    const requiredMins = stdTime * enteredQty;

    if (requiredMins > allowedLimit) {
      const maxQty = Math.floor(allowedLimit / stdTime);

      const formatMinsToHoursStr = (mins) => {
        const hrs = mins / 60;
        return `${Number(hrs.toFixed(2))} Hour${hrs !== 1 ? 's' : ''}`;
      };

      const requiredHoursStr = formatMinsToHoursStr(requiredMins);
      const availableHoursStr = formatMinsToHoursStr(allowedLimit);

      Swal.fire({
        icon: 'warning',
        title: 'Shift Capacity Exceeded',
        width: '360px',
        customClass: {
          title: 'text-sm font-bold text-slate-800 pt-3',
          htmlContainer: 'text-xs text-slate-600 px-4'
        },
        html: `
          <div class="text-left space-y-2.5 p-0.5">
            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs font-semibold">
              ⚠️ Maximum allowed for this shift is ${maxQty} Units.
            </div>
            <div class="space-y-1.5 text-xs text-slate-600">
              <p><strong>Entered Quantity:</strong> ${enteredQty} Units</p>
              <p><strong>Required Time:</strong> ${Number(requiredMins.toFixed(2))} Min (${requiredHoursStr})</p>
              <p><strong>Available Time:</strong> ${Number(allowedLimit.toFixed(2))} Min (${availableHoursStr})</p>
            </div>
            <p class="text-xs text-rose-600 font-semibold mt-2">Please reduce the quantity to ${maxQty} units or less.</p>
          </div>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6'
      });
      return false;
    }

    return true;
  };

  const addTimeLog = async (logData) => {
    if (!logData.operatorId || !logData.workstationId) {
      errorToast('Please select Operator and Workstation');
      return;
    }
    if (!logData.startTime || !logData.endTime || logData.startTime.includes('NaN') || logData.endTime.includes('NaN')) {
      errorToast('Please select Production Period');
      return;
    }
    if (logData.producedQty <= 0) {
      errorToast('Please enter Produce Quantity');
      return;
    }

    // Machine Busy Validation
    if (!validateWorkstationAvailability(logData.workstationId, logData.logDate, logData.startTime, logData.startAMPM, logData.endTime, logData.endAMPM)) {
      return;
    }

    // Operator Busy Validation
    if (!validateOperatorAvailability(logData.operatorId, logData.logDate, logData.startTime, logData.startAMPM, logData.endTime, logData.endAMPM)) {
      return;
    }

    // Shift Capacity Validation
    if (!validateShiftCapacity(logData)) {
      return;
    }

    // Success toast if not overlapped
    const ws = workstations.find(w => w.id === parseInt(logData.workstationId));
    const ws_name = ws?.workstation_name || 'Machine';
    Swal.fire({
      icon: 'success',
      title: 'Machine Allocated',
      html: `
        <div class="text-left space-y-1">
          <p class=" text-xs  text-emerald-600">🟢 ${ws_name} allocated successfully</p>
          <p class=" text-xs  text-slate-600">⏱ ${logData.startTime} ${logData.startAMPM} – ${logData.endTime} ${logData.endAMPM}</p>
        </div>
      `,
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });

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
        await fetchLogs(selectedJC.id);
        fetchJobCards();
        // Reset form but keep Day and Date
        const startInfo = selectedJC.start_time ? to12h(selectedJC.start_time.split('T')[1]?.slice(0, 5) || selectedJC.start_time.split(' ')[1]?.slice(0, 5)) : { time: '08:00', ampm: 'AM' };
        const endInfo = selectedJC.end_time ? to12h(selectedJC.end_time.split('T')[1]?.slice(0, 5) || selectedJC.end_time.split(' ')[1]?.slice(0, 5)) : { time: '04:00', ampm: 'PM' };
        setTimeLogForm(prev => ({
          ...prev,
          producedQty: '',
          startTime: startInfo.time,
          startAMPM: startInfo.ampm,
          endTime: endInfo.time,
          endAMPM: endInfo.ampm
        }));
      } else {
        const error = await response.json();
        errorToast(error.error || error.message || 'Failed to record time log');
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
    if (!logData.startTime || !logData.endTime || logData.startTime.includes('NaN') || logData.endTime.includes('NaN')) {
      errorToast('Please select valid start and end times');
      return;
    }

    // Shift Capacity Validation
    if (!validateShiftCapacity(logData)) {
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
        day: logData.day,
        logDate: logData.logDate,
        operatorId: logData.operatorId,
        workstationId: logData.workstationId,
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
    // Check if there are any pending quality logs
    const hasPendingQuality = logs.qualityLogs?.some(log => log.status?.trim() !== 'APPROVED');

    if (hasPendingQuality) {
      errorToast('Cannot record downtime. QC verification is pending for one or more records.');
      return;
    }

    if (!logData.startTime || !logData.endTime) {
      errorToast('Please select Downtime Period');
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
      remarks: '',
      executionMode: 'In-house',
      vendorId: '',
      vendorRate: 0,
      status: 'PENDING',
      producedQty: 0,
      acceptedQty: 0,
      stdTime: 0,
      timeUom: 'Min',
      startDateTime: '',
      endDateTime: '',
      startTime: '08:00',
      startAMPM: 'AM',
      endTime: '04:00',
      endAMPM: 'PM',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      latestLogStartTime: null
    });
    setSelectedWO(null);
    setIsModalOpen(true);
  };

  const handleCreateOutwardChallan = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const isEdit = !!outwardFormData.id;
      const url = isEdit ? `${API_BASE}/outward-challans/${outwardFormData.id}` : `${API_BASE}/outward-challans`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
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
        successToast(isEdit ? 'Outward Challan updated successfully' : 'Outward Challan created successfully');
        navigate(`${deptPrefix}/job-card`);
        fetchJobCards();
      } else {
        errorToast(isEdit ? 'Failed to update outward challan' : 'Failed to create outward challan');
      }
    } catch (error) {
      console.error('Error saving outward challan:', error);
      errorToast('Error saving outward challan');
    }
  };

  const handleVendorInward = async () => {
    try {
      const token = localStorage.getItem('authToken');

      const payload = {
        outwardChallanId: selectedJCOutward.outward_challan_id,
        jobCardId: selectedJCOutward.id,
        vendorId: selectedJCOutward.vendor_id,
        receivedDate: inwardFormData.receivedDate,
        vendorInvoiceNo: inwardFormData.remarks, // Using remarks for invoice no or vice versa if needed
        totalReceivedQty: inwardFormData.receivedQty,
        acceptedQty: inwardFormData.acceptedQty,
        rejectedQty: inwardFormData.rejectedQty,
        scrapQty: inwardFormData.scrapQty,
        notes: inwardFormData.remarks,
        items: inwardFormData.inwardItems.map(item => ({
          itemCode: item.item_code,
          receivedQty: item.release_qty,
          acceptedQty: item.release_qty,
          rejectedQty: 0,
          scrapQty: 0,
          rate: item.rate
        }))
      };

      const response = await fetch(`${API_BASE}/outward-challans/inward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast('Vendor Receipt recorded successfully');
        navigate(`${deptPrefix}/job-card`);
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
    const startInfo = jc.start_time ? to12h(jc.start_time.split('T')[1]?.slice(0, 5) || jc.start_time.split(' ')[1]?.slice(0, 5)) : { time: '08:00', ampm: 'AM' };
    const endInfo = jc.end_time ? to12h(jc.end_time.split('T')[1]?.slice(0, 5) || jc.end_time.split(' ')[1]?.slice(0, 5)) : { time: '04:00', ampm: 'PM' };

    // Normalize execution mode
    let mode = jc.execution_mode || 'In-house';
    if (mode.toLowerCase().includes('outsource') || mode.toLowerCase().includes('sub')) {
      mode = 'Outsource';
    } else {
      mode = 'In-house';
    }

    setFormData({
      id: jc.id,
      jcNumber: jc.job_card_no,
      workOrderId: jc.work_order_id,
      operationId: jc.operation_id,
      workstationId: jc.workstation_id,
      assignedTo: jc.assigned_to,
      plannedQty: parseFloat(jc.planned_qty || 0) + parseFloat(jc.rework_qty || 0),
      remarks: jc.remarks || '',
      executionMode: mode,
      vendorId: jc.vendor_id || '',
      vendorRate: jc.vendor_rate || 0,
      status: jc.status || 'PENDING',
      producedQty: jc.produced_qty || 0,
      acceptedQty: jc.accepted_qty || 0,
      stdTime: jc.std_time || 0,
      timeUom: jc.time_uom || 'Min',
      startDateTime: jc.start_time || '',
      endDateTime: jc.end_time || '',
      startTime: startInfo.time,
      startAMPM: startInfo.ampm,
      endTime: endInfo.time,
      endAMPM: endInfo.ampm,
      startDate: jc.start_time ? (jc.start_time.includes('T') ? jc.start_time.split('T')[0] : jc.start_time.split(' ')[0]) : new Date().toISOString().split('T')[0],
      endDate: jc.end_time ? (jc.end_time.includes('T') ? jc.end_time.split('T')[0] : jc.end_time.split(' ')[0]) : new Date().toISOString().split('T')[0],
      latestLogStartTime: jc.latest_log_start_time || null
    });
    const wo = workOrders.find(w => String(w.id) === String(jc.work_order_id));
    setSelectedWO(wo);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate resource schedule conflicts before submitting
    const overlapAlert = calculateModalOverlapAlert();
    if (overlapAlert) {
      errorToast(overlapAlert);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const isEdit = formData.id;
      const url = isEdit ? `${API_BASE}/job-cards/${formData.id}` : `${API_BASE}/job-cards`;
      const method = isEdit ? 'PUT' : 'POST';

      const start24 = to24h(formData.startTime, formData.startAMPM);
      const end24 = to24h(formData.endTime, formData.endAMPM);

      let plannedQtyBase = parseFloat(formData.plannedQty || 0);
      if (isEdit) {
        const activeJC = jobCards.find(j => String(j.id) === String(formData.id));
        const rework = activeJC ? parseFloat(activeJC.rework_qty || 0) : 0;
        plannedQtyBase = Math.max(0, plannedQtyBase - rework);
      }

      const submissionData = {
        ...formData,
        plannedQty: plannedQtyBase,
        startDateTime: `${formData.startDate} ${start24}:00`,
        endDateTime: `${formData.endDate} ${end24}:00`
      };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });

      if (response.ok) {
        successToast(`Job Card ${isEdit ? 'updated' : 'created'} successfully`);
        navigate(`${deptPrefix}/job-card`);
        fetchJobCards();
      } else {
        const error = await response.json();
        errorToast(error.error || `Failed to ${isEdit ? 'update' : 'create'} Job Card`);
      }
    } catch (error) {
      errorToast('Network error');
    }
  };

  // --- DataTable Column Definitions ---

  const timeLogColumns = [
    {
      label: 'Day',
      key: 'day',
      render: (val, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="number"
              value={editTimeLogForm.day}
              className="w-12 px-1 py-1 border rounded text-xs"
              onChange={e => setEditTimeLogForm({ ...editTimeLogForm, day: e.target.value })}
            />
          );
        }
        return (
          <span className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500 ">
            {val || '-'}
          </span>
        );
      }
    },
    {
      label: 'Date / Shift',
      key: 'log_date',
      render: (val, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <div className="flex flex-col gap-1">
              <input
                type="date"
                value={editTimeLogForm.logDate}
                className="block w-full px-1 py-1 border rounded text-xs"
                onChange={e => setEditTimeLogForm({ ...editTimeLogForm, logDate: e.target.value })}
              />
              <select
                value={editTimeLogForm.shift}
                className="w-full px-1 py-1 border rounded text-xs"
                onChange={e => setEditTimeLogForm({ ...editTimeLogForm, shift: e.target.value })}
              >
                <option value="SHIFT_A">A</option>
                <option value="SHIFT_B">B</option>
                <option value="SHIFT_C">C</option>
              </select>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <span className="text-slate-900 ">{new Date(val).toLocaleDateString('en-GB')}</span>
            <span className="text-xs  text-slate-400 ">{row.shift?.replace('SHIFT_', 'Shift ')}</span>
          </div>
        );
      }
    },
    {
      label: 'Operator',
      key: 'operator_name',
      render: (val, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <select
              value={editTimeLogForm.operatorId}
              className="w-full px-1 py-1 border rounded text-xs"
              onChange={e => setEditTimeLogForm({ ...editTimeLogForm, operatorId: e.target.value })}
            >
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs  ">
              {val?.[0]}
            </div>
            <span className="text-slate-600 ">{val}</span>
          </div>
        );
      }
    },
    {
      label: 'Workstation',
      key: 'workstation_name',
      render: (val, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <select
              value={editTimeLogForm.workstationId}
              className="w-full px-1 py-1 border rounded text-xs"
              onChange={e => setEditTimeLogForm({ ...editTimeLogForm, workstationId: e.target.value })}
            >
              <option value="">Select Workstation</option>
              {workstations.map(w => <option key={w.id} value={w.id}>{w.workstation_name}</option>)}
            </select>
          );
        }
        return (
          <span className="text-slate-600">{val || 'N/A'}</span>
        );
      }
    },
    {
      label: 'Time Interval',
      key: 'time_interval',
      className: 'text-center',
      render: (_, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 justify-center min-w-[200px]">
                <div className="flex-1">
                  <TimePicker
                    small
                    value={editTimeLogForm.startTime}
                    ampmValue={editTimeLogForm.startAMPM}
                    onTimeChange={(newTime) => setEditTimeLogForm({ ...editTimeLogForm, startTime: newTime })}
                    onAMPMChange={(newAMPM) => setEditTimeLogForm({ ...editTimeLogForm, startAMPM: newAMPM })}
                  />
                </div>
                <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5" />
                <div className="flex-1">
                  <TimePicker
                    small
                    value={editTimeLogForm.endTime}
                    ampmValue={editTimeLogForm.endAMPM}
                    onTimeChange={(newTime) => setEditTimeLogForm({ ...editTimeLogForm, endTime: newTime })}
                    onAMPMChange={(newAMPM) => setEditTimeLogForm({ ...editTimeLogForm, endAMPM: newAMPM })}
                  />
                </div>
              </div>
              <div className="text-xs  text-center text-indigo-500 mt-1 ">
                ⏱ {calculateTotalMins(editTimeLogForm.startTime, editTimeLogForm.startAMPM, editTimeLogForm.endTime, editTimeLogForm.endAMPM)} mins
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded border border-slate-100">
              <Clock className="w-3 h-3 text-indigo-500" />
              <span className="text-slate-700  ">
                {formatLocalTime(row.start_time)} - {formatLocalTime(row.end_time)}
              </span>
            </div>
            <div className="mt-1 text-xs  text-slate-400   ">
              {calculateISODuration(row.start_time, row.end_time)} mins
            </div>
          </div>
        );
      }
    },
    {
      label: 'Produced Qty',
      key: 'produced_qty',
      className: 'text-right',
      render: (val, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="number"
              value={editTimeLogForm.producedQty}
              className="w-full px-1 py-1 border rounded text-xs text-right focus:ring-1 focus:ring-indigo-500"
              onChange={e => setEditTimeLogForm({ ...editTimeLogForm, producedQty: e.target.value })}
            />
          );
        }
        return (
          <div className="flex flex-col items-end">
            <span className="text-sm  text-indigo-600 ">{parseFloat(val).toFixed(3)}</span>
            <span className="text-xs  text-slate-400   ">UNITS</span>
          </div>
        );
      }
    },
    {
      label: 'Action',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => {
        const isEditing = editingTimeLogId === row.id;
        if (isEditing) {
          return (
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => updateTimeLog(row.id, editTimeLogForm)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all shadow-sm">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => setEditingTimeLogId(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setViewingTimeLog(row)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="View Detail">
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleEditTimeLog(row)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all" title="Edit Log">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteTimeLog(row.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all" title="Delete Log">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
    }
  ];

  const qualityLogColumns = [
    {
      label: 'Day',
      key: 'day',
      render: (val, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="number"
              value={editQualityLogForm.day}
              className="w-12 px-1 py-1 border rounded text-xs"
              onChange={e => setEditQualityLogForm({ ...editQualityLogForm, day: e.target.value })}
            />
          );
        }
        return (
          <span className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500 ">
            {val || '-'}
          </span>
        );
      }
    },
    {
      label: 'Date / Shift',
      key: 'check_date',
      render: (val, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <div className="flex flex-col gap-1">
              <input
                type="date"
                value={editQualityLogForm.checkDate}
                className="block w-full px-1 py-1 border rounded text-xs"
                onChange={e => setEditQualityLogForm({ ...editQualityLogForm, checkDate: e.target.value })}
              />
              <select
                value={editQualityLogForm.shift}
                className="w-full px-1 py-1 border rounded text-xs"
                onChange={e => setEditQualityLogForm({ ...editQualityLogForm, shift: e.target.value })}
              >
                <option value="SHIFT_A">A</option>
                <option value="SHIFT_B">B</option>
                <option value="SHIFT_C">C</option>
              </select>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <span className="text-slate-900 ">{formatDisplayDate(val)}</span>
            <span className="text-xs  text-slate-400 ">{row.shift?.replace('SHIFT_', 'Shift ')}</span>
          </div>
        );
      }
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <div className={`inline-flex items-center px-2 py-1 rounded text-xs   border   ${val?.trim() === 'APPROVED'
          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
          : 'bg-amber-50 text-amber-600 border-amber-100'
          }`}>
          <div className={`w-1.5 h-1.5 rounded mr-1.5 ${val?.trim() === 'APPROVED' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          {val?.trim() === 'APPROVED' ? 'Verified' : 'Pending Verification'}
        </div>
      )
    },
    {
      label: 'Notes / Remarks',
      key: 'notes',
      render: (val, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="text"
              placeholder="Internal notes..."
              value={editQualityLogForm.notes || ''}
              className="w-full px-1 py-1 border rounded text-xs focus:ring-1 focus:ring-indigo-500"
              onChange={e => setEditQualityLogForm({ ...editQualityLogForm, notes: e.target.value })}
            />
          );
        }
        return (
          <div className={`flex flex-col gap-1 max-w-[200px]`}>
            <div className={`inline-flex items-center  rounded text-xs   border w-fit  ${(row.rejected_qty > 0 || row.scrap_qty > 0)
              ? 'bg-rose-50 text-rose-600 border-rose-100'
              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
              {(row.rejected_qty > 0 || row.scrap_qty > 0) ? 'QC REJECTED' : 'QC PASSED'}
            </div>
            <p className="text-xs  text-slate-400 italic leading-tight truncate" title={val || row.rejection_reason}>
              {val || row.rejection_reason || 'No observations recorded'}
            </p>
          </div>
        );
      }
    },
    {
      label: 'Accepted',
      key: 'accepted_qty',
      className: 'text-center',
      render: (val, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="number"
              value={editQualityLogForm.acceptedQty}
              className="w-full px-1 py-1 border rounded text-xs text-center border-emerald-200 focus:ring-1 focus:ring-emerald-500"
              onChange={e => setEditQualityLogForm({ ...editQualityLogForm, acceptedQty: e.target.value })}
            />
          );
        }
        return (
          <div className="flex flex-col items-center">
            <span className="text-sm  text-emerald-600">{parseFloat(val).toFixed(2)}</span>
            <span className="text-[9px] text-slate-300  ">UNITS</span>
          </div>
        );
      }
    },
    {
      label: 'Rejected',
      key: 'rejected_qty',
      className: 'text-center  text-rose-600',
      render: (val, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="number"
              value={editQualityLogForm.rejectedQty}
              className="w-full px-1 py-1 border rounded text-xs text-center border-rose-200 focus:ring-1 focus:ring-rose-500"
              onChange={e => setEditQualityLogForm({ ...editQualityLogForm, rejectedQty: e.target.value })}
            />
          );
        }
        return (
          <div className="flex flex-col items-center">
            <span className="text-sm  text-rose-600">{parseFloat(val).toFixed(2)}</span>
            <span className="text-[9px] text-slate-300  ">REJECT</span>
          </div>
        );
      }
    },
    {
      label: 'Scrap',
      key: 'scrap_qty',
      className: 'text-center',
      render: (val, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <input
              type="number"
              value={editQualityLogForm.scrapQty}
              className="w-full px-1 py-1 border rounded text-xs text-center border-slate-200 focus:ring-1 focus:ring-slate-500"
              onChange={e => setEditQualityLogForm({ ...editQualityLogForm, scrapQty: e.target.value })}
            />
          );
        }
        return (
          <div className="flex flex-col items-center">
            <span className="text-sm  text-slate-500">{parseFloat(val).toFixed(2)}</span>
            <span className="text-[9px] text-slate-300  ">SCRAP</span>
          </div>
        );
      }
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => {
        const isEditing = editingQualityLogId === row.id;
        if (isEditing) {
          return (
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => updateQualityLog(row.id, editQualityLogForm)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all shadow-sm">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => setEditingQualityLogId(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => setViewingQualityLog(row)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all">
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleEditQualityLog(row)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteQualityLog(row.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => updateQualityLog(row.id, { status: 'APPROVED' })}
              disabled={row.status?.trim() === 'APPROVED'}
              className={`p-1.5 rounded transition-colors ${row.status?.trim() === 'APPROVED' ? 'text-emerald-500 cursor-default' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
              title={row.status?.trim() === 'APPROVED' ? 'APPROVED' : 'Verify'}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
    }
  ];

  const downtimeLogColumns = [
    {
      label: 'Day',
      key: 'day',
      render: (val) => (
        <span className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-500 ">
          {val || '-'}
        </span>
      )
    },
    {
      label: 'Date / Shift',
      key: 'downtime_date',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-900 ">{new Date(val).toLocaleDateString('en-GB')}</span>
          <span className="text-xs  text-slate-400 ">{row.shift?.replace('SHIFT_', 'Shift ')}</span>
        </div>
      )
    },
    {
      label: 'Category / Reason',
      key: 'downtime_type',
      render: (val) => (
        <span className=" bg-orange-50 text-orange-600 border border-orange-100 rounded text-xs    ">
          {val}
        </span>
      )
    },
    {
      label: 'Interval',
      key: 'interval',
      className: 'text-center',
      render: (_, row) => (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded border border-slate-100">
            <Clock className="w-3 h-3 text-orange-500" />
            <span className="text-slate-700  ">
              {formatLocalTime(row.start_time)} - {formatLocalTime(row.end_time)}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Duration',
      key: 'duration',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex flex-col items-end">
          <span className="text-sm  text-slate-900 ">{calculateISODuration(row.start_time, row.end_time)}</span>
          <span className="text-xs  text-slate-400   ">MINUTES</span>
        </div>
      )
    },
    {
      label: 'Action',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <button onClick={() => deleteDowntimeLog(row.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  const consolidatedReportColumns = [
    {
      label: 'Date',
      key: 'date',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-900 font-medium">{new Date(val).toLocaleDateString('en-GB')}</span>
          {row.startTime || row.endTime ? (
            <span className="text-[10px] text-slate-500 font-semibold mt-0.5 whitespace-nowrap">
              {row.startTime ? formatLocalTime(row.startTime) : '--:--'} - {row.endTime ? formatLocalTime(row.endTime) : 'Running'}
            </span>
          ) : null}
        </div>
      )
    },
    {
      label: 'Shift',
      key: 'shift',
      render: (val) => (
        <span className=" bg-slate-100 text-slate-600 rounded text-xs    ">
          {val?.replace('SHIFT_', 'Shift ')}
        </span>
      )
    },
    {
      label: 'Operator',
      key: 'operator',
      render: (val) => (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 text-[9px] ">
            {val?.[0] || 'N'}
          </div>
          <span className="text-slate-600 ">{val || 'N/A'}</span>
        </div>
      )
    },
    {
      label: 'Mins',
      key: 'mins',
      className: 'text-center  text-indigo-600',
      render: (val) => val
    },
    {
      label: 'Produced',
      key: 'produced',
      className: 'text-center  text-slate-900',
      render: (val, row) => {
        const rowKey = `${row.date}_${row.shift}`;
        if (editingReportKey === rowKey) {
          return (
            <input
              type="number"
              value={editReportForm.produced}
              onChange={e => setEditReportForm({ ...editReportForm, produced: e.target.value })}
              className="w-full px-1 py-1 border rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          );
        }
        return val;
      }
    },
    {
      label: 'Accepted',
      key: 'accepted',
      className: 'text-center  text-emerald-600',
      render: (val, row) => {
        const rowKey = `${row.date}_${row.shift}`;
        if (editingReportKey === rowKey) {
          return (
            <input
              type="number"
              value={editReportForm.accepted}
              onChange={e => setEditReportForm({ ...editReportForm, accepted: e.target.value })}
              className="w-full px-1 py-1 border rounded text-xs text-center border-emerald-200 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          );
        }
        return val;
      }
    },
    {
      label: 'Rejected',
      key: 'rejected',
      className: 'text-center  text-rose-500',
      render: (val, row) => {
        const rowKey = `${row.date}_${row.shift}`;
        if (editingReportKey === rowKey) {
          return (
            <input
              type="number"
              value={editReportForm.rejected}
              onChange={e => setEditReportForm({ ...editReportForm, rejected: e.target.value })}
              className="w-full px-1 py-1 border rounded text-xs text-center border-rose-200 focus:ring-1 focus:ring-rose-500 outline-none"
            />
          );
        }
        return val;
      }
    },
    {
      label: 'Scrap',
      key: 'scrap',
      className: 'text-center text-slate-400 ',
      render: (val, row) => {
        const rowKey = `${row.date}_${row.shift}`;
        if (editingReportKey === rowKey) {
          return (
            <input
              type="number"
              value={editReportForm.scrap}
              onChange={e => setEditReportForm({ ...editReportForm, scrap: e.target.value })}
              className="w-full px-1 py-1 border rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          );
        }
        return val;
      }
    },
    {
      label: 'Downtime',
      key: 'downtime',
      className: 'text-right',
      render: (val) => (
        <div className="flex items-center justify-end gap-1">
          <span className="text-amber-600 ">{val}</span>
          <span className="text-xs  text-slate-300  ">min</span>
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => {
        const rowKey = `${row.date}_${row.shift}`;
        const isEditing = editingReportKey === rowKey;
        if (isEditing) {
          return (
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => handleUpdateReport(row)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all shadow-sm">
                <Save className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditingReportKey(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all shadow-sm">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }
        return (
          <button onClick={() => handleEditReport(row)} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        );
      }
    }
  ];

  const jobCardColumns = [
    {
      label: 'ID / Project',
      key: 'job_card_no',
      sortable: true,
      render: (val, row) => {
        const displayProject = cleanProjectName(row.project_name, row.client_name);

        return (
          <div className="flex flex-col">
            <span className=" text-slate-900 truncate max-w-[180px]" title={displayProject}>{displayProject}</span>
            <span className="text-[10px] text-slate-500">WO: {row.work_order_no || row.wo_number}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-slate-100 text-[10px]  text-slate-700 border border-slate-200">
                {row.operation_sequence || row.sequence_no || '-'}
              </span>
              <span className="text-xs font-semibold text-indigo-600">{val}</span>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Operation / Status',
      key: 'operation_name',
      render: (val, row) => (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-slate-900 ">{val}</span>
          <span className={`w-fit ${row.status === 'IN_PROGRESS' ? ' text-amber-600' :
            row.status === 'COMPLETED' ? 'text-emerald-600' :
              'text-slate-500'
            }`}>
            {row.status === 'IN_PROGRESS' ? 'In-Progress' : row.status?.charAt(0) + row.status?.slice(1).toLowerCase()}
          </span>
        </div>
      )
    },
    {
      label: 'Specification / Execution',
      key: 'item_name',
      render: (val, row) => {
        const isSubcontract = row.execution_type === 'Outsource' || row.execution_type === 'Subcontract' || row.execution_type === 'Sub-Contract' || row.outward_challan_id;
        const isShipment = isShipmentOp(row);
        const sourceType = (row.source_type || '').toUpperCase();
        const itemName = (row.item_name || '').toUpperCase();
        const itemCode = (row.item_code || '').toUpperCase();
        const isSA = sourceType === 'SA' || sourceType === 'SUB ASSEMBLY' || sourceType === 'SFG' ||
          itemName.includes('PET PUSHER') || itemName.includes('SLIDING PLATE') ||
          itemCode.startsWith('PART-') || itemCode.includes('PART');

        let modeText = 'In-house';
        let modeClass = 'text-blue-600';
        if (isShipment) {
          modeText = 'Dispatch';
          modeClass = 'text-emerald-600';
        } else if (isSubcontract) {
          modeText = 'Outsource';
          modeClass = 'text-amber-600';
        }

        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px]  ${isSA ? 'text-amber-700' : 'text-indigo-700'}`}>
                {isSA ? 'PART' : 'ASSEMBLY'}
              </span>
              <span className={`text-[10px]  uppercase  ${modeClass}`}>
                ({modeText})
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px]  text-slate-900 leading-tight" title={val}>{val}</span>

              {isSA && row.source_fg && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-indigo-600  leading-tight">{row.source_fg}</span>
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      label: 'Target → Received',
      key: 'planned_qty',
      className: 'text-left',
      render: (val, row) => {
        const rework = parseFloat(row.rework_qty || 0);
        const target = parseFloat(row.wo_quantity || 0) + rework;
        const seq = parseInt(row.operation_sequence || row.sequence_no || 0);
        const isFirstOp = (() => {
          const woJCs = jobCards.filter(j => String(j.work_order_id) === String(row.work_order_id));
          if (woJCs.length === 0) return true;
          const minSeq = Math.min(...woJCs.map(j => parseInt(j.operation_sequence || j.sequence_no || 999)));
          return seq === minSeq;
        })();

        const received = (isFirstOp || row.status !== 'PENDING')
          ? (parseFloat(row.planned_qty || 0) + rework)
          : rework;
        const produced = parseFloat(row.produced_qty || 0);
        const accepted = parseFloat(row.accepted_qty || 0);
        const rejected = parseFloat(row.rejected_qty || 0);
        const left = Math.max(0, target - accepted);

        const percentage = target > 0 ? Math.min(100, Math.round((accepted / target) * 100)) : 0;

        return (
          <div className="flex flex-col gap-1 min-w-[170px] text-[11px] font-sans">
            {/* Header: Complete% and Numbers */}
            <div className="flex justify-between items-center text-slate-700">
              <span className="font-semibold text-slate-800">{percentage}% Complete</span>
              <span className="font-medium">
                <span className="text-emerald-600 font-bold">{accepted}</span>
                {received > 0 && (
                  <>
                    <span className="text-slate-300 mx-1">/</span>
                    <span className="text-amber-500 font-bold">{received}</span>
                  </>
                )}
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-slate-500 font-bold">{target}</span>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden border border-amber-200/20">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Footer details */}
            <div className="flex justify-between items-center text-slate-500">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                  <span>P: {produced}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                  <span>R: {rejected}</span>
                </span>
                {rework > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    <span>Rw: {rework}</span>
                  </span>
                )}
              </div>
              <span className="text-slate-400 italic font-medium">{left} left</span>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Produced',
      key: 'produced_qty',
      className: 'text-center',
      render: (val) => <span className="text-xs  text-indigo-600">{parseFloat(val || 0).toFixed(2)}</span>
    },
    {
      label: 'Accepted',
      key: 'accepted_qty',
      className: 'text-center',
      render: (val) => <span className="text-xs  text-emerald-600">{parseFloat(val || 0).toFixed(2)}</span>
    },
    {
      label: 'Rework Qty',
      key: 'rework_qty',
      className: 'text-center',
      render: (val) => <span className="text-xs font-semibold text-amber-600">{parseFloat(val || 0).toFixed(2)}</span>
    },
    {
      label: 'Time & Costing',
      key: 'cycle_time',
      render: (_, row) => {
        const cycleTime = parseFloat(row.cycle_time) || parseFloat(row.std_time) || 0;
        const hourlyRate = parseFloat(row.hourly_rate || 0);
        const totalCost = (cycleTime / 60) * (row.wo_quantity || row.planned_qty || 1) * hourlyRate;

        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock className="w-2.5 h-2.5" />
              <span>{Math.round(cycleTime)} {row.time_uom || 'min'}/u</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-600">
              <span className=" text-emerald-600">₹{totalCost.toFixed(2)}</span>
              <span className="text-slate-400">@ ₹{hourlyRate}/hr</span>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Workstation',
      key: 'workstation_name',
      render: (val, row) => {
        const isSubcontract = row.execution_type === 'Outsource' || row.execution_type === 'Subcontract' || row.execution_type === 'Sub-Contract' || row.outward_challan_id;
        return (
          <div className="flex flex-col">
            <span className={`text-xs  ${isSubcontract ? 'text-purple-600 ' : 'text-slate-900'}`}>
              {isSubcontract ? 'Subcontract' : (val || 'N/A')}
            </span>
            {!isSubcontract && (() => {
              const m = getMachineState(row, jobCards);

              if (m.status === "NOT_ASSIGNED") {
                return (
                  <span className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded"></span>
                    <span className="text-xs  text-slate-400  ">Not Assigned</span>
                  </span>
                );
              }

              if (m.status === "RUNNING") {
                return (
                  <span className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded animate-pulse"></span>
                    <span className="text-xs  text-rose-600  ">RUNNING</span>
                  </span>
                );
              }

              if (m.status === "BUSY") {
                return (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-rose-600 rounded"></span>
                      <span className="text-xs  text-rose-700 ">Busy ({m.jobId})</span>
                    </span>
                    <span className="text-[9px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-2 h-2" /> Free at {m.endTime}
                    </span>
                  </div>
                );
              }

              if (m.status === "COMPLETED") {
                return (
                  <span className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded"></span>
                    <span className="text-xs  text-emerald-600  ">COMPLETED</span>
                  </span>
                );
              }

              if (m.status === "FREE") {
                return (
                  <span className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded"></span>
                    <span className="text-xs  text-emerald-600  ">FREE</span>
                  </span>
                );
              }
              return null;
            })()}
          </div>
        );
      }
    },
    {
      label: 'Assignee & Time',
      key: 'operator_name',
      render: (val, row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs ">
              <User size={10} />
            </div>
            <span className="text-xs text-slate-600 font-medium">
              {(() => {
                const isSub = row.execution_type === 'Outsource' || row.execution_type === 'Subcontract' || row.execution_type === 'Sub-Contract' || row.outward_challan_id;
                if (isSub) {
                  const vendorMatch = vendors.find(v => String(v.id) === String(row.vendor_id));
                  return vendorMatch ? vendorMatch.vendor_name : (row.vendor_name || 'Unassigned Vendor');
                }
                return val || 'Unassigned';
              })()}
            </span>
          </div>
          {row.start_time && row.end_time && (row.outward_challan_id || row.operator_name) ? (
            <div className="text-[11px] text-slate-500 mt-1 font-normal flex flex-col gap-0.5">
              <span>S: {formatDateTimeShort(row.start_time)}</span>
              <span>E: {formatDateTimeShort(row.end_time)}</span>
            </div>
          ) : null}
          {row.status === 'IN_PROGRESS' && row.latest_log_start_time && !row.latest_log_end_time ? (
            <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-100/50 pt-1">
              <span className="text-[10px] text-indigo-500 font-semibold animate-pulse flex items-center gap-1">
                <span className="w-1 h-1 bg-indigo-500 rounded-full animate-ping"></span>
                LIVE S: {formatDateTimeShort(row.latest_log_start_time)}
              </span>
              {(() => {
                const start = new Date(row.latest_log_start_time);
                const now = new Date();
                const diff = Math.floor((now - start) / 60000);
                const hrs = Math.floor(diff / 60);
                const mins = diff % 60;
                return (
                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-2 h-2" /> ⏱ {hrs}h {mins}m logged
                  </span>
                );
              })()}
            </div>
          ) : (!row.start_time || !row.end_time) && (
            <span className="text-xs text-slate-400 mt-0.5 italic ">No Time Logged</span>
          )}
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, jc) => {
        const isShipment = isShipmentOp(jc);
        const isSubcontract = jc.execution_type === 'Outsource' || jc.execution_type === 'Subcontract' || jc.execution_type === 'Sub-Contract' || jc.outward_challan_id;

        const isWorkstationAssigned = isShipment || (jc.workstation_id !== null && jc.workstation_id !== undefined && jc.workstation_id !== '');

        let isOperatorAssigned = false;
        const mode = (jc.execution_mode || jc.execution_type || 'In-house').toLowerCase();
        const isOutsource = mode.includes('outsource') || mode.includes('sub');
        if (isOutsource) {
          isOperatorAssigned = jc.vendor_id !== null && jc.vendor_id !== undefined && jc.vendor_id !== '';
        } else {
          isOperatorAssigned = jc.assigned_to !== null && jc.assigned_to !== undefined && jc.assigned_to !== '';
        }

        const isAssigned = isWorkstationAssigned && isOperatorAssigned;

        return (
          <div className="flex items-center justify-end gap-1">
            {/* View Details - Always Show */}
            <button
              onClick={() => navigate(`${deptPrefix}/job-card/view?id=${jc.id}`)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-all"
              title="View Details"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {(isAssigned || jc.status === 'IN_PROGRESS' || jc.status === 'COMPLETED') && (
              <>
                {/* Log / Record Time - ONLY for In-house */}
                {!isSubcontract && (
                  <>
                    {jc.status !== 'IN_PROGRESS' && jc.status !== 'COMPLETED' && (
                      isShipment ? (
                        <button
                          onClick={() => handleUpdateStatus(jc, 'IN_PROGRESS')}
                          className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-all"
                          title="⚡ Start Operation"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(jc, 'IN_PROGRESS')}
                          className="p-1 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          title="Start"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                    {(jc.status === 'IN_PROGRESS' || jc.status === 'COMPLETED') && (
                      isShipment ? (
                        <button
                          onClick={() => handleLogProgress(jc)}
                          className={`p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-all ${jc.status === 'IN_PROGRESS' ? 'animate-pulse' : ''}`}
                          title="📈 Live Tracking / Production Entry"
                        >
                          <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLogProgress(jc)}
                          className={`p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-all ${jc.status === 'IN_PROGRESS' ? 'animate-pulse' : ''}`}
                          title="Log Progress"
                        >
                          <Zap className="w-3.5 h-3.5 fill-indigo-600" />
                        </button>
                      )
                    )}
                  </>
                )}

                {/* Outward / Inward Flow - ONLY for Subcontract */}
                {isSubcontract && (
                  <>
                    <button
                      onClick={() => navigate(`${deptPrefix}/job-card/outward?id=${jc.id}`)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                      title="Outward Challan"
                    >
                      <Truck className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => navigate(`${deptPrefix}/job-card/inward?id=${jc.id}`)}
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                      title="Inward Entry"
                    >
                      <Package className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {/* Quick Record - Manage Production Modal */}
                <button
                  onClick={() => {
                    if (!validateJobCardCompleteness(jc)) return;
                    setSelectedJC(jc);
                    setShowProductionEntry(true);
                    fetchLogs(jc.id);
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                  title={isShipment ? "📈 Live Tracking / Production Entry" : "Manage Production"}
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={() => navigate(`${deptPrefix}/job-card/edit?id=${jc.id}`)}
              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
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
        );
      }
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {!showProductionEntry ? (
        <>
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl  text-slate-900  ">Job Cards</h1>
                  <span className="p-2  bg-indigo-50 text-indigo-600 text-xs  rounded  border border-indigo-100  ">
                    Live Operations
                  </span>
                </div>
                <p className="text-slate-500  text-xs mt-1">
                  Manufacturing Intelligence <ChevronRight className="w-3 h-3 inline mx-1" /> <span className="text-indigo-600">Operational Controls</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 p-2  bg-white rounded  border border-slate-200 ">
                <div className="w-2 h-2 bg-emerald-500 rounded  animate-pulse"></div>
                <span className="text-xs  text-slate-500  ">System Status</span>
                <span className="text-xs  text-slate-900">{new Date().toLocaleTimeString()}</span>
              </div>
              <button className="flex items-center gap-2  p-2 text-rose-600 hover:bg-rose-50 rounded  transition-all  text-xs">
                <Trash2 className="w-4 h-4" />
                Reset Queue
              </button>
              <button
                onClick={() => navigate(`${deptPrefix}/job-card/add`)}
                className="flex items-center gap-2  p-2 bg-slate-900 text-white rounded  hover:bg-slate-800 transition-all  text-xs shadow-lg shadow-slate-200"
              >
                <Play className="w-4 h-4" />
                Create Job Card
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-2 my-5">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white rounded  border border-slate-100 p-2 flex items-center justify-between  hover: transition-all group">
                <div>
                  <p className="text-xs  text-slate-400   mb-2">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl  text-slate-900">{stat.value}</p>
                  </div>
                  <p className="text-xs  text-slate-400   mt-2 flex items-center gap-1">
                    {stat.subValue}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded  flex items-center justify-center transition-all group-hover:scale-110 ${stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-purple-50 text-purple-600'
                  }`}>
                  <stat.icon className="w-7 h-7" />
                </div>
              </div>
            ))}
          </div> */}

          <DataTable
            columns={jobCardColumns}
            data={filteredJobCards}
            loading={loading}
            pageSize={20}
            actions={
              <button className="flex items-center gap-2  p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-600 hover:bg-slate-50 transition-all ">
                <Filter className="w-4 h-4" />
                All Operational States
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>
            }
          />
        </>
      ) : (
        renderProductionEntry()
      )}

      {/* Job Card View Modal */}
      <Modal
        isOpen={!!viewingJobCard}
        onClose={() => navigate(`${deptPrefix}/job-card`)}
        title="Operational Intelligence"
        maxWidth="max-w-2xl"
      >
        {viewingJobCard && (
          <div className="space-y-2">
            {/* Header with Operation Name and Progress */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded  p-2 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl  ">{viewingJobCard.operation_name}</h3>
                  <p className="text-slate-300 text-sm mt-1">Work Order: {viewingJobCard.wo_number}</p>
                </div>
                <span className="text-4xl  text-indigo-300">
                  {viewingJobCard.planned_qty > 0 ? Math.round((parseFloat(viewingJobCard.accepted_qty || 0) / viewingJobCard.planned_qty) * 100) : 0}%
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-slate-400 text-xs  ">Planned Capacity</p>
                  <p className="text-xl  mt-1">{viewingJobCard.planned_qty || 0}.00 <span className="text-sm font-normal text-slate-300">Units</span></p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs  ">Accepted Output</p>
                  <p className="text-xl  mt-1 text-emerald-400">{parseFloat(viewingJobCard.accepted_qty || 0).toFixed(2)} <span className="text-sm font-normal text-slate-300">Units</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Total Produced: {parseFloat(viewingJobCard.produced_qty || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs  ">Transferred</p>
                  <p className="text-xl  mt-1 text-indigo-400">{parseFloat(viewingJobCard.accepted_qty || 0).toFixed(2)} <span className="text-sm font-normal text-slate-300">Units</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Available: {(parseFloat(viewingJobCard.accepted_qty || 0)).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs  ">Production Progress</p>
                  <p className="text-xl  mt-1">
                    {viewingJobCard.planned_qty > 0 ? Math.round((parseFloat(viewingJobCard.produced_qty || 0) / viewingJobCard.planned_qty) * 100) : 0}%
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Available: {(parseFloat(viewingJobCard.accepted_qty || 0)).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              tabs={[
                { id: 'timeline', label: 'Operational Timeline', icon: Calendar },
                { id: 'costing', label: 'Costing Details', icon: BarChart2 },
                { id: 'assignment', label: 'Assignment Data', icon: User }
              ]}
              activeTab={viewTab}
              onTabChange={setViewTab}
            />

            {/* Tab Content */}
            <div>
              {viewTab === 'timeline' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Scheduled Start</p>
                    <p className="text-sm  text-slate-900">N/A</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Estimated End</p>
                    <p className="text-sm  text-slate-900">N/A</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Actual Duration</p>
                    <p className="text-sm  text-slate-900">-</p>
                  </div>
                </div>
              )}

              {viewTab === 'costing' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Hourly Rate</p>
                    <p className="text-sm  text-slate-900">₹{parseFloat(viewingJobCard.hourly_rate || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Actual Cost</p>
                    <p className="text-sm  text-indigo-600">₹0.00</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Estimated Cost</p>
                    <p className="text-sm  text-slate-900">₹0.00</p>
                  </div>
                </div>
              )}

              {viewTab === 'assignment' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Assigned Unit</p>
                    <p className="text-sm  text-slate-900">{viewingJobCard.workstation_name || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded ">
                    <p className="text-xs text-slate-500   mb-2">Operator / Vendor</p>
                    <p className="text-sm  text-slate-900">{viewingJobCard.operator_name || 'Unassigned'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Intelligence Notes */}
            <div className="bg-amber-50 border border-amber-100 rounded  p-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🧠</span>
                <h4 className=" text-slate-900">Intelligence Notes</h4>
              </div>
              <p className="text-sm text-amber-700">
                {viewingJobCard.remarks || 'No supplemental operational data recorded for this phase.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                onClick={() => navigate(`${deptPrefix}/job-card`)}
                className="p-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
              >
                ✕ Terminate View
              </button>
              {viewingJobCard.status !== 'COMPLETED' && (
                <button
                  onClick={() => {
                    handleUpdateStatus(viewingJobCard.id, 'COMPLETED');
                    navigate(`${deptPrefix}/job-card`);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded  hover:shadow-lg transition-all "
                >
                  <span>⚡</span>
                  Transition to completed
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Job Card Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); navigate(`${deptPrefix}/job-card`); }}
        title={(() => {
          const selectedOp = operations.find(op => String(op.id) === String(formData.operationId));
          const activeJC = jobCards.find(j => String(j.id) === String(formData.id));
          const isShipment = (activeJC && isShipmentOp(activeJC)) || (selectedOp && (
            String(selectedOp.operation_name || '').toLowerCase() === 'shipment' ||
            String(selectedOp.operation_name || '').toLowerCase() === 'dispatch' ||
            String(selectedOp.operation_type || '').toLowerCase() === 'dispatch'
          ));
          return isShipment
            ? `Shipment Assignment: ${formData.jcNumber || 'New Job Card'}`
            : `${formData.id ? "Edit Job Card" : "Create Job Card"}${formData.jcNumber ? `: ${formData.jcNumber}` : ''}${selectedWO ? ` - ${selectedWO.wo_number}` : ''}`;
        })()}
        size="4xl"
      >
        {(() => {
          const selectedOp = operations.find(op => String(op.id) === String(formData.operationId));
          const activeJC = jobCards.find(j => String(j.id) === String(formData.id));
          const isShipment = (activeJC && isShipmentOp(activeJC)) || (selectedOp && (
            String(selectedOp.operation_name || '').toLowerCase() === 'shipment' ||
            String(selectedOp.operation_name || '').toLowerCase() === 'dispatch' ||
            String(selectedOp.operation_type || '').toLowerCase() === 'dispatch'
          ));
          if (isShipment) {
            return (
              <form onSubmit={handleSubmit} className="space-y-4 p-1">
                {/* ORDER CONTEXT Section */}
                <div className="bg-slate-50/60 border border-slate-200/60 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-600 font-medium">
                    <Info className="w-4 h-4" />
                    <span className="text-xs tracking-wider uppercase font-semibold">Order Context</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Customer</p>
                      <p className="text-sm text-slate-800 font-medium">{activeJC?.client_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Planned Qty</p>
                      <p className="text-sm text-slate-800 font-medium">{(parseFloat(activeJC?.planned_qty || 0) + parseFloat(activeJC?.rework_qty || 0) || formData.plannedQty || 0)} Nos</p>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Shipping Address</p>
                      <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">{activeJC?.shipping_address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Inputs Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <FormControl label="Assigned Operator (Dispatch)" required>
                    <SearchableSelect
                      options={users.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.username})` }))}
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Select Operator..."
                    />
                  </FormControl>

                  <FormControl label="Dispatch Date" required>
                    <input
                      type="date"
                      value={formData.startDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none hover:border-indigo-400 transition-colors"
                    />
                  </FormControl>
                </div>

                {/* Modal footer */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); navigate(`${deptPrefix}/job-card`); }}
                    className="px-5 py-2 border border-slate-200 text-slate-700 rounded text-xs hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-colors font-medium"
                  >
                    Confirm Dispatch
                  </button>
                </div>
              </form>
            );
          }

          const hasLogProcessStarted = false; // Always allow editing planned schedule, operator, and workstation in edit form

          return (
            <form onSubmit={handleSubmit} className="space-y-4 p-1">
              {/* Header Info */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl  text-slate-800">
                    {operations.find(op => String(op.id) === String(formData.operationId))?.operation_name || 'Select Operation'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selectedWO?.project_name || selectedWO?.item_name || 'No Project Selected'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={formData.status} />
                  <span className="text-xs  text-slate-400 ">Job Card Status</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Resource Assignment & Metrics */}
                <div className="space-y-6">
                  {/* Resource Assignment Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600  border-b border-indigo-50 pb-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm">Resource Assignment</span>
                    </div>

                    <div className="flex items-center gap-4 py-2">
                      <span className="text-xs text-slate-500 ">Execution Mode:</span>
                      <div className="flex bg-slate-100 p-1 rounded">
                        <button
                          type="button"
                          disabled={hasLogProcessStarted}
                          onClick={() => setFormData({ ...formData, executionMode: 'In-house' })}
                          className={`px-4 py-1.5 text-xs  rounded-md transition-all ${formData.executionMode === 'In-house'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            } ${hasLogProcessStarted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          In-house
                        </button>
                        <button
                          type="button"
                          disabled={hasLogProcessStarted}
                          onClick={() => setFormData({ ...formData, executionMode: 'Outsource' })}
                          className={`px-4 py-1.5 text-xs  rounded-md transition-all ${formData.executionMode === 'Outsource'
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            } ${hasLogProcessStarted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Outsource
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormControl label="Machine / Workstation">
                        <SearchableSelect
                          options={workstations.map(ws => {
                            let isBusyNow = false;
                            let busyRange = '';

                            const formStartStr = formData.startDate + 'T' + to24h(formData.startTime, formData.startAMPM) + ':00';
                            const formEndStr = formData.endDate + 'T' + to24h(formData.endTime, formData.endAMPM) + ':00';

                            const wsOverlaps = liveAllocations.filter(jc => {
                              if (String(jc.id) === String(formData.id)) return false;
                              if (Number(jc.workstation_id) !== Number(ws.id)) return false;

                              return checkDateTimeOverlap(formStartStr, formEndStr, jc.start_time, jc.end_time);
                            });

                            const capacity = 1;
                            if (wsOverlaps.length >= capacity) {
                              isBusyNow = true;
                              const firstOverlap = wsOverlaps[0];
                              const busyStartStr = firstOverlap ? formatLocalTime(firstOverlap.latest_log_start_time || firstOverlap.start_time) : '';
                              const busyEndStr = firstOverlap ? getEstimatedEndTime(firstOverlap) : '';
                              busyRange = `${busyStartStr} – ${busyEndStr} (${firstOverlap.job_card_no})`;
                            }

                            return {
                              value: ws.id,
                              label: ws.workstation_name,
                              subLabel: isBusyNow
                                ? `🔴 Busy\n${busyRange}`
                                : '🟢 Available'
                            };
                          })}
                          subLabelField="subLabel"
                          value={formData.workstationId}
                          onChange={(e) => handleModalWorkstationChange(e.target.value)}
                          onFocus={fetchLiveAllocations}
                          placeholder="Select Workstation"
                          disabled={hasLogProcessStarted}
                        />
                      </FormControl>

                      {formData.executionMode === 'Outsource' && (
                        <FormControl label="Subcontractor (Vendor)">
                          <select
                            value={formData.vendorId}
                            disabled={hasLogProcessStarted}
                            onChange={(e) => setFormData(prev => ({ ...prev, vendorId: e.target.value }))}
                            className={`w-full p-2 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none ${hasLogProcessStarted ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white'
                              }`}
                          >
                            <option value="">Select Vendor</option>
                            {vendors.map(v => (
                              <option key={v.id} value={v.id}>{v.vendor_name}</option>
                            ))}
                          </select>
                        </FormControl>
                      )}
                      {formData.executionMode === 'In-house' ? (
                        <FormControl label="Primary Operator">
                          <SearchableSelect
                            options={users.map(user => {
                              let isBusyNow = false;
                              let busyRange = '';

                              const formStartStr = formData.startDate + 'T' + to24h(formData.startTime, formData.startAMPM) + ':00';
                              const formEndStr = formData.endDate + 'T' + to24h(formData.endTime, formData.endAMPM) + ':00';

                              const opOverlaps = liveAllocations.filter(jc => {
                                if (String(jc.id) === String(formData.id)) return false;
                                if (Number(jc.assigned_to) !== Number(user.id)) return false;

                                return checkDateTimeOverlap(formStartStr, formEndStr, jc.start_time, jc.end_time);
                              });

                              if (opOverlaps.length > 0) {
                                isBusyNow = true;
                                const firstOverlap = opOverlaps[0];
                                const busyStartStr = firstOverlap ? formatLocalTime(firstOverlap.latest_log_start_time || firstOverlap.start_time) : '';
                                const busyEndStr = firstOverlap ? getEstimatedEndTime(firstOverlap) : '';
                                busyRange = `${busyStartStr} – ${busyEndStr} (${firstOverlap.job_card_no})`;
                              }

                              return {
                                value: user.id,
                                label: `${user.first_name || ''} ${user.last_name || ''} (${user.username || ''})`,
                                subLabel: isBusyNow
                                  ? `🔴 Busy\n${busyRange}`
                                  : '🟢 Available'
                              };
                            })}
                            subLabelField="subLabel"
                            value={formData.assignedTo}
                            onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                            onFocus={fetchLiveAllocations}
                            placeholder="Select Operator"
                            disabled={hasLogProcessStarted}
                          />
                        </FormControl>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          <div />
                          <FormControl label="Vendor Rate per Unit">
                            <input
                              type="number"
                              value={formData.vendorRate}
                              onChange={(e) => setFormData(prev => ({ ...prev, vendorRate: e.target.value }))}
                              className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </FormControl>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Execution & Metrics Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600  border-b border-indigo-50 pb-2">
                      <Activity className="w-4 h-4" />
                      <span className="text-sm">Execution & Metrics</span>
                    </div>

                    <FormControl label="Job Status">
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ON_HOLD">ON HOLD</option>
                      </select>
                    </FormControl>

                    <div className="grid grid-cols-3 gap-3">
                      <FormControl label="Planned Qty">
                        <input
                          type="number"
                          value={formData.plannedQty}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => {
                              const suggested = calculateSuggestedEndDateTime(
                                prev.startDate,
                                prev.startTime,
                                prev.startAMPM,
                                val,
                                prev.producedQty,
                                prev.stdTime,
                                prev.timeUom
                              );
                              return {
                                ...prev,
                                plannedQty: val,
                                ...(suggested.endDate ? {
                                  endDate: suggested.endDate,
                                  endTime: suggested.endTime,
                                  endAMPM: suggested.endAMPM
                                } : {})
                              };
                            });
                          }}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none"
                        />
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">
                          Remaining: {Math.max(0, parseFloat(formData.plannedQty || 0) - parseFloat(formData.producedQty || 0)).toFixed(3)}
                        </p>
                      </FormControl>
                      <FormControl label="Produced Qty">
                        <input
                          type="number"
                          value={formData.producedQty}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => {
                              const suggested = calculateSuggestedEndDateTime(
                                prev.startDate,
                                prev.startTime,
                                prev.startAMPM,
                                prev.plannedQty,
                                val,
                                prev.stdTime,
                                prev.timeUom
                              );
                              return {
                                ...prev,
                                producedQty: val,
                                ...(suggested.endDate ? {
                                  endDate: suggested.endDate,
                                  endTime: suggested.endTime,
                                  endAMPM: suggested.endAMPM
                                } : {})
                              };
                            });
                          }}
                          className="w-full p-2 bg-white border border-indigo-200 ring-1 ring-indigo-50 rounded text-xs text-indigo-700  outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </FormControl>
                      <FormControl label="Accepted Qty">
                        <input
                          type="number"
                          value={formData.acceptedQty}
                          onChange={(e) => setFormData(prev => ({ ...prev, acceptedQty: e.target.value }))}
                          className="w-full p-2 bg-white border border-emerald-200 ring-1 ring-emerald-50 rounded text-xs text-emerald-700  outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </FormControl>
                    </div>
                    <p className="text-xs  text-slate-400 italic">Note: Accepted quantity represents final yield after QC.</p>
                  </div>
                </div>

                {/* Right Column: Time Planning & Remarks */}
                <div className="space-y-2">
                  {formData.executionMode === 'In-house' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-indigo-600  border-b border-indigo-50 pb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Time Planning</span>
                      </div>

                      <div className="grid grid-cols-1">
                        <div className="space-y-1">
                          <label className="text-xs   text-slate-500  ">Start DateTime</label>
                          <div className="flex gap-1.5">
                            <input
                              type="date"
                              disabled={hasLogProcessStarted}
                              value={formData.startDate}
                              onChange={(e) => {
                                const newStartDate = e.target.value;
                                setFormData(prev => {
                                  const suggested = calculateSuggestedEndDateTime(
                                    newStartDate,
                                    prev.startTime,
                                    prev.startAMPM,
                                    prev.plannedQty,
                                    prev.producedQty,
                                    prev.stdTime,
                                    prev.timeUom
                                  );
                                  return {
                                    ...prev,
                                    startDate: newStartDate,
                                    ...(suggested.endDate ? {
                                      endDate: suggested.endDate,
                                      endTime: suggested.endTime,
                                      endAMPM: suggested.endAMPM
                                    } : {})
                                  };
                                });
                              }}
                              className={`flex-1 p-2 text-xs border border-slate-200 rounded hover:border-indigo-400 transition-colors focus:ring-2 focus:ring-indigo-500/20 outline-none ${hasLogProcessStarted ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100' : 'bg-white'
                                }`}
                            />
                            <div className="w-32">
                              <TimePicker
                                disabled={hasLogProcessStarted}
                                value={formData.startTime}
                                ampmValue={formData.startAMPM}
                                onTimeChange={(val) => setFormData(prev => {
                                  const suggested = calculateSuggestedEndDateTime(
                                    prev.startDate,
                                    val,
                                    prev.startAMPM,
                                    prev.plannedQty,
                                    prev.producedQty,
                                    prev.stdTime,
                                    prev.timeUom
                                  );
                                  return {
                                    ...prev,
                                    startTime: val,
                                    ...(suggested.endDate ? {
                                      endDate: suggested.endDate,
                                      endTime: suggested.endTime,
                                      endAMPM: suggested.endAMPM
                                    } : {})
                                  };
                                })}
                                onAMPMChange={(val) => setFormData(prev => {
                                  const suggested = calculateSuggestedEndDateTime(
                                    prev.startDate,
                                    prev.startTime,
                                    val,
                                    prev.plannedQty,
                                    prev.producedQty,
                                    prev.stdTime,
                                    prev.timeUom
                                  );
                                  return {
                                    ...prev,
                                    startAMPM: val,
                                    ...(suggested.endDate ? {
                                      endDate: suggested.endDate,
                                      endTime: suggested.endTime,
                                      endAMPM: suggested.endAMPM
                                    } : {})
                                  };
                                })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 relative">
                          <label className="text-xs   text-slate-500  ">End DateTime</label>
                          <button
                            type="button"
                            onClick={handleAutoSuggestEndDateTime}
                            className="absolute right-0 top-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Auto Suggest
                          </button>
                          <div className="flex gap-1.5">
                            <input
                              type="date"
                              disabled={hasLogProcessStarted}
                              value={formData.endDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                              className={`flex-1 p-2 text-xs border border-slate-200 rounded hover:border-indigo-400 transition-colors focus:ring-2 focus:ring-indigo-500/20 outline-none ${hasLogProcessStarted ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100' : 'bg-white'
                                }`}
                            />
                            <div className="w-32">
                              <TimePicker
                                disabled={hasLogProcessStarted}
                                value={formData.endTime}
                                ampmValue={formData.endAMPM}
                                onTimeChange={(val) => setFormData(prev => ({ ...prev, endTime: val }))}
                                onAMPMChange={(val) => setFormData(prev => ({ ...prev, endAMPM: val }))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <FormControl label="Standard Time (Min)">
                          <input
                            type="number"
                            step="0.01"
                            value={formData.stdTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => {
                                const suggested = calculateSuggestedEndDateTime(
                                  prev.startDate,
                                  prev.startTime,
                                  prev.startAMPM,
                                  prev.plannedQty,
                                  prev.producedQty,
                                  val,
                                  'Min'
                                );
                                return {
                                  ...prev,
                                  stdTime: val,
                                  timeUom: 'Min',
                                  ...(suggested.endDate ? {
                                    endDate: suggested.endDate,
                                    endTime: suggested.endTime,
                                    endAMPM: suggested.endAMPM
                                  } : {})
                                };
                              });
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </FormControl>
                      </div>

                      {/* Machine Engagement Box */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded p-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700">
                          <Monitor className="w-3.5 h-3.5" />
                          <span>Standard Cycle Time Suggestion</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-700 font-medium">{calculateModalStdTimeSuggestion()} mins</p>
                        </div>
                      </div>

                      {/* Dynamic Alert block */}
                      {calculateModalOverlapAlert() && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2.5 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-xs text-amber-800 font-medium">Schedule Overlap Alert</p>
                            <p className="text-[10px] text-amber-700 leading-relaxed">{calculateModalOverlapAlert()}</p>
                          </div>
                        </div>
                      )}

                      <div className="bg-blue-50 border border-blue-100 rounded p-2.5 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs  text-blue-700 leading-relaxed">
                          Scheduled end time is calculated based on standard cycle time. Adjust manually if resource availability differs.
                        </p>
                      </div>
                    </div>
                  )}

                  <FormControl label="Job Remarks">
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                      placeholder="Enter specific instructions for the operator..."
                    />
                  </FormControl>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => navigate(`${deptPrefix}/job-card`)}
                  className="px-6 py-2 text-xs  text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-all"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white  rounded-md hover:bg-indigo-700 transition-all text-xs shadow-lg shadow-indigo-100"
                >
                  Update Job Card
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Existing Modals */}
      <Modal
        isOpen={isOutwardModalOpen}
        onClose={() => { setIsOutwardModalOpen(false); navigate(`${deptPrefix}/job-card`); }}
        title="Outward Challan"
        size="2xl"
      >
        <div className="p-1 space-y-2">
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded  border border-slate-100">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded ">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm  text-slate-900">Dispatch Job Card {selectedJCOutward?.job_card_no} to Vendor</h3>
              <p className="text-xs text-slate-500">Create an outward challan for subcontracted operations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormControl label="Operation">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                {outwardFormData.operationName}
              </div>
            </FormControl>
            <FormControl label="Quantity">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                {outwardFormData.plannedQty} units
              </div>
            </FormControl>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded  p-2 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <User className="w-4 h-4" />
              <span className="text-xs   ">Assign Vendor</span>
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
                <span className="text-xs   ">Required Material Release</span>
              </div>
              <button
                onClick={() => setOutwardFormData({
                  ...outwardFormData,
                  materialItems: [...outwardFormData.materialItems, { itemCode: '', requiredQty: 0, releaseQty: 0 }]
                })}
                className="flex items-center gap-1 text-xs  text-indigo-600 hover:text-indigo-700   px-2 py-1 bg-indigo-50 rounded"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="border border-slate-100 rounded ">
              <table className="w-full text-left text-xs ">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-2  text-slate-500  ">Item Code</th>
                    <th className="p-2  text-slate-500   text-center">Required Qty</th>
                    <th className="p-2  text-slate-500   text-center">Release Qty</th>
                    <th className="p-2  text-slate-500   text-right">Action</th>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <FormControl label="Dispatch Date">
              <input
                type="date"
                value={outwardFormData.dispatchDate}
                onChange={(e) => setOutwardFormData({ ...outwardFormData, dispatchDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
              />
            </FormControl>
            <FormControl label="Expected Return Date">
              <div className="relative">
                <input
                  type="date"
                  value={outwardFormData.expectedReturnDate}
                  onChange={(e) => setOutwardFormData({ ...outwardFormData, expectedReturnDate: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </FormControl>
            <FormControl label="Dispatch Quantity">
              <div className="relative">
                <input
                  type="number"
                  value={outwardFormData.dispatchQty}
                  onChange={(e) => setOutwardFormData({ ...outwardFormData, dispatchQty: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 ">Units</span>
              </div>
            </FormControl>
          </div>

          <FormControl label="Dispatch Notes">
            <textarea
              rows="2"
              placeholder="Any specific instructions for the vendor..."
              value={outwardFormData.dispatchNotes}
              onChange={(e) => setOutwardFormData({ ...outwardFormData, dispatchNotes: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 resize-none"
            />
          </FormControl>

          <div className="flex justify-end items-center gap-2 pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate(`${deptPrefix}/job-card`)}
              className="p-2 text-xs  text-slate-500 hover:text-slate-700  "
            >
              Cancel
            </button>
            <button
              onClick={handleCreateOutwardChallan}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all text-xs    shadow-lg shadow-indigo-100"
            >
              <CheckCircle className="w-4 h-4" />
              {outwardFormData.id ? 'Update Outward Challan' : 'Create Outward Challan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isInwardModalOpen}
        onClose={() => { setIsInwardModalOpen(false); navigate(`${deptPrefix}/job-card`); }}
        title="Vendor Receipt (Inward)"
        size="xl"
      >
        <div className="p-1 space-y-2">
          <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded  border border-emerald-100">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded ">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm  text-slate-900">Receive Job Card {selectedJCOutward?.job_card_no} from Vendor</h3>
              <p className="text-xs text-slate-500">Challan No: {selectedJCOutward?.outward_challan_no}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormControl label="Received Date">
              <input
                type="date"
                value={inwardFormData.receivedDate}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500"
              />
            </FormControl>
            <FormControl label="Received Quantity">
              <input
                type="number"
                value={inwardFormData.receivedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedQty: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <FormControl label="Accepted Qty">
              <input
                type="number"
                value={inwardFormData.acceptedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, acceptedQty: e.target.value })}
                className="w-full p-2 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-700 outline-none"
              />
            </FormControl>
            <FormControl label="Rejected Qty">
              <input
                type="number"
                value={inwardFormData.rejectedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, rejectedQty: e.target.value })}
                className="w-full p-2 bg-rose-50 border border-rose-100 rounded text-xs text-rose-700 outline-none"
              />
            </FormControl>
            <FormControl label="Scrap Qty">
              <input
                type="number"
                value={inwardFormData.scrapQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, scrapQty: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 outline-none"
              />
            </FormControl>
          </div>

          {inwardFormData.inwardItems && inwardFormData.inwardItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Package className="w-4 h-4" />
                <span className="text-xs   ">Outward Items Breakdown</span>
              </div>
              <div className="border border-slate-100 rounded  overflow-hidden">
                <table className="w-full text-left text-xs ">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-2  text-slate-500  ">Item Code</th>
                      <th className="p-2  text-slate-500   text-center">Released Qty</th>
                      <th className="p-2  text-slate-500   text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inwardFormData.inwardItems.map((item, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="p-2 text-slate-700">
                          {item.item_code}
                          {(() => {
                            const match = items.find(i => i.item_code === item.item_code);
                            const name = match ? (match.material_name || match.item_description || '') : '';
                            return name ? ` | ${name}` : '';
                          })()}
                        </td>
                        <td className="p-2 text-center text-slate-600">
                          <input
                            type="number"
                            className="w-24 px-2 py-1 border border-slate-200 rounded text-center outline-none focus:border-emerald-500"
                            value={item.release_qty}
                            onChange={(e) => {
                              const newItems = [...inwardFormData.inwardItems];
                              newItems[idx].release_qty = e.target.value;
                              setInwardFormData({ ...inwardFormData, inwardItems: newItems });
                            }}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right outline-none focus:border-emerald-500"
                              value={item.rate}
                              onChange={(e) => {
                                const newItems = [...inwardFormData.inwardItems];
                                newItems[idx].rate = e.target.value;
                                setInwardFormData({ ...inwardFormData, inwardItems: newItems });
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/50 border-t border-slate-100 ">
                    <tr>
                      <td colSpan="2" className="p-2 text-right text-slate-500   text-xs">Sub Total</td>
                      <td className="p-2 text-right text-slate-700">
                        ₹ {inwardFormData.inwardItems.reduce((sum, item) => sum + (Number(item.release_qty || 0) * Number(item.rate || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="p-2 text-right text-slate-500   text-xs">GST (18%)</td>
                      <td className="p-2 text-right text-indigo-600">
                        ₹ {(inwardFormData.inwardItems.reduce((sum, item) => sum + (Number(item.release_qty || 0) * Number(item.rate || 0)), 0) * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-100/50">
                      <td colSpan="2" className="p-2 text-right text-slate-900   text-xs">Grand Total</td>
                      <td className="p-2 text-right text-emerald-600 text-sm">
                        ₹ {(inwardFormData.inwardItems.reduce((sum, item) => sum + (Number(item.release_qty || 0) * Number(item.rate || 0)), 0) * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormControl label="Vendor Invoice">
              <div className="relative group">
                <input
                  type="file"
                  id="vendorInvoice"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                  onChange={(e) => setInwardFormData({ ...inwardFormData, vendorInvoice: e.target.files[0] })}
                />
                <label
                  htmlFor="vendorInvoice"
                  className="flex items-center gap-2 p-2 border border-dashed border-slate-300 rounded  cursor-pointer group-hover:border-emerald-500 group-hover:bg-emerald-50/30 transition-all"
                >
                  <div className="p-1.5 bg-slate-100 text-slate-500 rounded group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs  text-slate-600 truncate">
                      {inwardFormData.vendorInvoice ? inwardFormData.vendorInvoice.name : 'Upload Invoice Copy'}
                    </p>
                    <p className="text-xs text-slate-400">PDF, Excel or Images (Max 10MB)</p>
                  </div>
                  {inwardFormData.vendorInvoice && (
                    <div className="text-emerald-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  )}
                </label>
              </div>
            </FormControl>
            <FormControl label="Remarks / Rejection Reason">
              <textarea
                rows="1"
                placeholder="Notes..."
                value={inwardFormData.remarks}
                onChange={(e) => setInwardFormData({ ...inwardFormData, remarks: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500 resize-none h-[42px]"
              />
            </FormControl>
          </div>

          <div className="flex justify-end items-center gap-2 pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate(`${deptPrefix}/job-card`)}
              className="p-2 text-xs  text-slate-500 hover:text-slate-700  "
            >
              Cancel
            </button>
            <button
              onClick={handleVendorInward}
              disabled={selectedJCOutward?.status === 'COMPLETED'}
              className={`flex items-center gap-2 px-6 py-2 rounded transition-all text-xs shadow-lg ${selectedJCOutward?.status === 'COMPLETED'
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                }`}
            >
              <CheckCircle className="w-4 h-4" />
              {selectedJCOutward?.status === 'COMPLETED' ? 'Receipt Completed' : 'Complete Receipt'}
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


