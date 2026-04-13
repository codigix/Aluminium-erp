import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, Clock, CheckCircle2, X, Play, Package, 
  Settings, Activity, BarChart3, List, History, 
  Search, ShieldCheck, AlertCircle, ArrowRight, ExternalLink
} from 'lucide-react';
import { Card, FormControl, SearchableSelect } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const WorkOrderForm = ({ workOrderId, salesOrderId: propSalesOrderId, salesOrderItemId: propSalesOrderItemId, onBack, onSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('foundation');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    woNumber: '',
    salesOrderId: '',
    salesOrderItemId: '',
    quantity: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    deliveryCommitment: 'Pending Schedule',
    priority: 'NORMAL',
    remarks: '',
    bomId: '',
    planId: '',
    item_code: '',
    item_name: '',
    status: 'DRAFT'
  });

  const [salesOrders, setSalesOrders] = useState([]);
  const [boms, setBoms] = useState([]);
  const [selectedSO, setSelectedSO] = useState(null);
  const [items, setItems] = useState([]);
  const [operations, setOperations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState({ timeLogs: [], qualityLogs: [], downtimeLogs: [] });
  const [consumptionLoading, setConsumptionLoading] = useState(false);

  const consolidatedReport = useMemo(() => {
    const report = {};
    
    // Process Time Logs (Produced Qty & Operators)
    logs.timeLogs.forEach(log => {
      const date = new Date(log.log_date).toLocaleDateString('en-GB');
      const shift = log.shift || 'N/A';
      const key = `${date}-${shift}`;
      
      if (!report[key]) {
        report[key] = { date, shift, produced: 0, accepted: 0, rejected: 0, scrap: 0, downtime: 0, operators: new Set(), mins: 0 };
      }
      
      report[key].produced += parseFloat(log.produced_qty || 0);
      if (log.operator_name) report[key].operators.add(log.operator_name);
      
      if (log.start_time && log.end_time) {
        const start = new Date(log.start_time);
        const end = new Date(log.end_time);
        report[key].mins += Math.max(0, Math.floor((end - start) / (1000 * 60)));
      }
    });

    // Process Quality Logs (Accepted/Rejected/Scrap)
    logs.qualityLogs.forEach(log => {
      const date = new Date(log.check_date).toLocaleDateString('en-GB');
      const shift = log.shift || 'N/A';
      const key = `${date}-${shift}`;
      
      if (!report[key]) {
        report[key] = { date, shift, produced: 0, accepted: 0, rejected: 0, scrap: 0, downtime: 0, operators: new Set(), mins: 0 };
      }
      
      report[key].accepted += parseFloat(log.accepted_qty || 0);
      report[key].rejected += parseFloat(log.rejected_qty || 0);
      report[key].scrap += parseFloat(log.scrap_qty || 0);
    });

    // Process Downtime Logs
    logs.downtimeLogs.forEach(log => {
      const date = new Date(log.downtime_date).toLocaleDateString('en-GB');
      const shift = log.shift || 'N/A';
      const key = `${date}-${shift}`;
      
      if (!report[key]) {
        report[key] = { date, shift, produced: 0, accepted: 0, rejected: 0, scrap: 0, downtime: 0, operators: new Set(), mins: 0 };
      }
      
      if (log.start_time && log.end_time) {
        const start = new Date(log.start_time);
        const end = new Date(log.end_time);
        report[key].downtime += Math.max(0, Math.floor((end - start) / (1000 * 60)));
      }
    });

    return Object.values(report).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      if (dateA - dateB !== 0) return dateB - dateA;
      return a.shift.localeCompare(b.shift);
    });
  }, [logs]);

  const stats = useMemo(() => {
    const totalProduced = logs.timeLogs.reduce((sum, log) => sum + parseFloat(log.produced_qty || 0), 0);
    const totalAccepted = logs.qualityLogs.reduce((sum, log) => sum + parseFloat(log.accepted_qty || 0), 0);
    const totalMins = logs.timeLogs.reduce((sum, log) => {
      if (log.start_time && log.end_time) {
        const start = new Date(log.start_time);
        const end = new Date(log.end_time);
        return sum + Math.max(0, Math.floor((end - start) / (1000 * 60)));
      }
      return sum;
    }, 0);

    const completionRate = formData.quantity > 0 ? (totalAccepted / formData.quantity) * 100 : 0;
    const yieldRate = totalProduced > 0 ? (totalAccepted / totalProduced) * 100 : 0;
    const actualHours = totalMins / 60;

    return {
      totalProduced,
      totalAccepted,
      totalMins,
      completionRate: Math.min(100, completionRate),
      yieldRate: Math.min(100, yieldRate),
      actualHours
    };
  }, [logs, formData.quantity]);

  const isLocked = Boolean(formData.planId);

  const isWeightBased = (uom) => {
    const u = (uom || '').toLowerCase();
    return u === 'kg' || u === 'kg.' || u === 'kilogram' || u === 'litre' || u === 'ltr' || u === 'meter' || u === 'mtr';
  };

  useEffect(() => {
    fetchInitialData();
    const effectiveWorkOrderId = workOrderId || location.state?.workOrderId;
    if (effectiveWorkOrderId) {
      fetchWorkOrderDetails(effectiveWorkOrderId);
    } else {
      fetchNextWONumber();
      
      const sId = propSalesOrderId || location.state?.salesOrderId;
      const siId = propSalesOrderItemId || location.state?.salesOrderItemId;
      
      if (sId) {
        handleSOChange(sId);
        if (siId) {
          setFormData(prev => ({ ...prev, salesOrderItemId: siId }));
        }
      }
    }
  }, [workOrderId, location.state?.workOrderId, propSalesOrderId, location.state?.salesOrderId, propSalesOrderItemId, location.state?.salesOrderItemId]);

  useEffect(() => {
    // Only fetch BOM details if NOT linked to a production plan
    // If linked to a plan, operations/materials are fetched via fetchPlanDetails
    if (formData.bomId && !formData.planId) {
      fetchBOMDetails(formData.bomId);
    } else if (!formData.bomId && !formData.planId) {
      setOperations([]);
      setInventory([]);
    }
  }, [formData.bomId, formData.planId, formData.quantity]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const [soRes, bomRes, itemRes] = await Promise.all([
        fetch(`${API_BASE}/sales-orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/bom/approved`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/items`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (soRes.ok) setSalesOrders(await soRes.json());
      if (bomRes.ok) setBoms(await bomRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchStockBalances = async (currentInventory) => {
    if (!currentInventory || currentInventory.length === 0) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const balances = await response.json();
        const updatedInventory = currentInventory.map(item => {
          const balance = balances.find(b => b.item_code === item.item_code);
          const stock = parseFloat(balance?.current_balance || 0);
          const consumed = parseFloat(item.consumed_qty || 0);
          return {
            ...item,
            total_stock: stock.toFixed(3),
            issued_qty: stock.toFixed(3),
            remaining_qty: (stock - consumed).toFixed(3)
          };
        });
        setInventory(updatedInventory);
      }
    } catch (error) {
      console.error('Error fetching stock balances:', error);
    }
  };

  const fetchBOMDetails = async (bomId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/items/${bomId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Map operations to include base_time (hrs)
        const mappedOps = (data.operations || []).map(op => ({
          ...op,
          operation_name: op.operation_name || op.operationName,
          base_time: ((parseFloat(op.cycle_time_min || 0) + parseFloat(op.setup_time_min || 0)) / 60).toFixed(2)
        }));
        
        // Map materials to include required_qty
        const mappedMats = (data.materials || []).map(m => {
          const req = (parseFloat(m.qty_per_pc || 0) * parseFloat(formData.quantity || 1));
          return {
            ...m,
            item_code: m.item_code || m.itemCode,
            material_name: m.material_name || m.materialName || m.description,
            required_qty: req.toFixed(3),
            issued_qty: req.toFixed(3),
            consumed_qty: (0).toFixed(3),
            total_stock: (0).toFixed(3),
            remaining_qty: (0).toFixed(3)
          };
        });

        setOperations(mappedOps);
        fetchStockBalances(mappedMats);
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
    }
  };

  const fetchMaterialRequirements = async (id) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders/${id}/material-requirements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        fetchStockBalances(data);
      }
    } catch (error) {
      console.error('Error fetching material requirements:', error);
    }
  };

  const fetchNextWONumber = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders/next-number`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, woNumber: data.woNumber }));
      }
    } catch (error) {
      console.error('Error fetching next WO number:', error);
    }
  };

  const fetchWorkOrderDetails = async (id) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          woNumber: data.wo_number || '',
          salesOrderId: data.sales_order_id || '',
          salesOrderItemId: data.sales_order_item_id || '',
          quantity: data.quantity || 1,
          startDate: data.start_date?.split('T')[0] || '',
          endDate: data.end_date?.split('T')[0] || '',
          deliveryCommitment: data.delivery_commitment || 'Pending Schedule',
          priority: data.priority || 'NORMAL',
          remarks: data.remarks || '',
          bomId: data.bom_no || '',
          planId: data.plan_id || '',
          item_code: data.item_code || '',
          item_name: data.description || data.item_name || '',
          status: data.status || 'DRAFT'
        });
        
        // Fetch logs
        const logRes = await fetch(`${API_BASE}/job-cards/work-order/${id}/logs`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (logRes.ok) {
          setLogs(await logRes.json());
        }

        if (data.sales_order_id) {
          fetchSODetails(data.sales_order_id);
        }
        if (id) {
          fetchMaterialRequirements(id);
        }
        if (data.plan_id) {
          fetchPlanDetails(data.plan_id, data.item_code);
        } else if (data.bom_no) {
          fetchBOMDetails(data.bom_no);
        }
      }
    } catch (error) {
      console.error('Error fetching WO details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSODetails = async (soId) => {
    if (!soId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${soId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedSO(data);
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
    }
  };

  const fetchPlanDetails = async (planId, itemCode) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/${planId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        
        if (data.end_date) {
          setFormData(prev => ({ ...prev, deliveryCommitment: data.end_date.split('T')[0] }));
        }

        // Filter operations for this item
        if (data.operations) {
          const itemOps = data.operations.filter(op => 
            String(op.source_item || op.sourceItem || op.itemCode || op.item_code) === String(itemCode)
          );
          if (itemOps.length > 0) {
            setOperations(itemOps.map(op => ({
              operation_name: op.operation_name || op.operationName,
              workstation: op.workstation,
              base_time: op.base_time || op.baseTime,
              source_item: op.source_item || op.sourceItem || op.itemCode || op.item_code
            })));
          }
        }

        // Filter materials for this item/assembly
        if (data.materials) {
          const itemMats = data.materials.filter(m => 
            String(m.source_assembly || m.sourceAssembly) === String(itemCode)
          );
          if (itemMats.length > 0) {
            const mappedMats = itemMats.map(m => {
              const req = parseFloat(m.required_qty || m.requiredQty || 0);
              return {
                item_code: m.item_code || m.itemCode,
                material_name: m.material_name || m.materialName,
                required_qty: req.toFixed(3),
                uom: m.uom,
                source_assembly: m.source_assembly || m.sourceAssembly,
                total_stock: (0).toFixed(3),
                remaining_qty: (0).toFixed(3),
                issued_qty: req.toFixed(3),
                consumed_qty: (0).toFixed(3)
              };
            });
            fetchStockBalances(mappedMats);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Plan details:', error);
    }
  };

  const handleSOChange = (soId) => {
    setFormData(prev => ({ ...prev, salesOrderId: soId, salesOrderItemId: '' }));
    fetchSODetails(soId);
  };

  const handleConsumptionChange = (index, value) => {
    const newInventory = [...inventory];
    const val = parseFloat(value || 0);
    newInventory[index].consumed_qty = value; // Keep as string to allow decimal input
    
    // Custom Logic: Remaining = Issued - Consumed
    const issued = parseFloat(newInventory[index].issued_qty || 0);
    const remaining = issued - val;
    newInventory[index].remaining_qty = isWeightBased(newInventory[index].uom) ? remaining.toFixed(3) : remaining.toFixed(0);
    
    setInventory(newInventory);
  };

  const commitConsumption = async () => {
    if (!workOrderId) {
      errorToast("Save Work Order first before committing consumption");
      return;
    }

    setConsumptionLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload = inventory.map(item => ({
        item_code: item.item_code,
        material_name: item.material_name,
        material_type: item.material_type,
        quantity: item.consumed_qty,
        uom: item.uom
      })).filter(item => parseFloat(item.quantity) > 0);

      if (payload.length === 0) {
        errorToast("Enter consumption quantities first");
        setConsumptionLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/work-orders/${workOrderId}/material-consumption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast("Consumption committed successfully");
        fetchMaterialRequirements(workOrderId);
      } else {
        const err = await response.json();
        errorToast(err.error || "Failed to commit consumption");
      }
    } catch (error) {
      errorToast("Network error");
    } finally {
      setConsumptionLoading(false);
    }
  };

  const handleSubmit = async (newStatus) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = workOrderId ? `${API_BASE}/work-orders/${workOrderId}` : `${API_BASE}/work-orders`;
      const method = workOrderId ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        status: newStatus || formData.status
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast(`Work Order ${workOrderId ? 'updated' : 'created'} successfully`);
        onSuccess();
      } else {
        const err = await response.json();
        errorToast(err.error || 'Failed to save Work Order');
      }
    } catch (error) {
      errorToast('Network error');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'foundation', label: 'Foundation', icon: Settings },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'operations', label: 'Operations', icon: List },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'daily-report', label: 'Daily Report', icon: History },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded  h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Header Bar */}
      <div className="bg-[#F8FAFC] border-b border-slate-200 sticky top-0 z-30 px-6 py-2 shadow-sm shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  {workOrderId ? 'Edit Manufacturing Order' : 'Create Manufacturing Order'}
                </h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full border border-slate-200 uppercase tracking-wider">
                  {formData.status}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                {formData.woNumber || 'NEW ORDER'} • {new Date().toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Close
            </button>
            <button 
              onClick={() => handleSubmit(formData.status === 'DRAFT' ? 'RELEASED' : formData.status)}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all text-xs font-bold shadow-sm ${
                formData.status === 'DRAFT' 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200'
              }`}
            >
              <Play className="w-4 h-4" />
              {saving ? 'Processing...' : (formData.status === 'DRAFT' ? 'Release to Production' : 'Update Work Order')}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <div className="flex items-center gap-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 text-xs font-bold transition-all relative ${
                    activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg border border-slate-800 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Execution Pulse</span>
              </div>
              <div className="h-3 w-px bg-slate-700 mx-1" />
              <span className="text-xs font-bold text-indigo-400">{stats.completionRate.toFixed(1)}%</span>
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-6 pb-20">
          <div className="flex gap-8 items-start">
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {activeTab === 'foundation' && (
              <div className="space-y-6">
                {/* 01 Foundation Setup */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">01 Foundation Setup</h2>
                  </div>
                  
                  <Card className=" border-slate-200/60 ">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                      <FormControl label="Target Item to Manufacture" required>
                        <SearchableSelect 
                          options={
                            isLocked && formData.item_code
                              ? [{ label: `${formData.item_code} - ${formData.item_name || 'Planned Item'}`, value: formData.salesOrderItemId, subLabel: 'Planned Item' }, ...items.map(i => ({ label: i.item_code, value: i.id, subLabel: i.description }))]
                              : items.map(i => ({ label: i.item_code, value: i.id, subLabel: i.description }))
                          }
                          value={formData.salesOrderItemId}
                          disabled={isLocked}
                          onChange={(e) => {
                            const item = items.find(i => String(i.id) === String(e.target.value));
                            const matchingBOM = boms.find(b => String(b.item_id) === String(item?.item_id) || b.item_code === item?.item_code);
                            
                            setFormData(prev => ({ 
                              ...prev, 
                              salesOrderItemId: e.target.value, 
                              quantity: item ? item.quantity : 1,
                              bomId: matchingBOM ? matchingBOM.id : prev.bomId
                            }));
                          }}
                          placeholder="Search Products..."
                        />
                      </FormControl>
                      
                      <FormControl label="Bill of Materials (BOM)">
                        <SearchableSelect 
                          options={
                            isLocked && formData.bomId
                              ? [{ label: formData.bomId, value: formData.bomId, subLabel: 'Planned BOM' }, ...boms.map(b => ({ label: b.bom_number || `BOM-${b.id}`, value: b.id, subLabel: b.item_code }))]
                              : boms.map(b => ({ label: b.bom_number || `BOM-${b.id}`, value: b.id, subLabel: b.item_code }))
                          }
                          value={formData.bomId}
                          disabled={isLocked}
                          onChange={(e) => setFormData(prev => ({ ...prev, bomId: e.target.value }))}
                          placeholder="Select BOM..."
                        />
                      </FormControl>

                      <div className="grid grid-cols-2 gap-2">
                        <FormControl label="Quantity to Produce" required>
                          <div className="relative">
                            <input 
                              type="number"
                              className={`w-full pl-3 pr-12 py-2 bg-white border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isLocked ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                              value={formData.quantity}
                              disabled={isLocked}
                              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs   text-slate-400 ">UNIT</span>
                          </div>
                        </FormControl>

                        <FormControl label="Priority Level">
                          <select 
                            className={`w-full p-2 bg-white border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-indigo-500 outline-none appearance-none ${isLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                            value={formData.priority}
                            disabled={isLocked}
                            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                          >
                            <option value="LOW">Low Priority</option>
                            <option value="NORMAL">Medium Priority</option>
                            <option value="HIGH">High Priority</option>
                            <option value="URGENT">Urgent Priority</option>
                          </select>
                        </FormControl>
                      </div>

                      <FormControl label="Sales Order Reference">
                        <div className="relative">
                          <SearchableSelect 
                            options={
                              isLocked && formData.salesOrderId && !salesOrders.some(so => String(so.id) === String(formData.salesOrderId))
                                ? [{ label: `SO-${formData.salesOrderId}`, value: formData.salesOrderId, subLabel: 'Planned SO' }, ...salesOrders.map(so => ({ label: `${so.project_name} (${so.po_number || 'No PO'})`, value: so.id, subLabel: so.company_name }))]
                                : salesOrders.map(so => ({ label: `${so.project_name} (${so.po_number || 'No PO'})`, value: so.id, subLabel: so.company_name }))
                            }
                            value={formData.salesOrderId}
                            disabled={isLocked}
                            onChange={(e) => handleSOChange(e.target.value)}
                            placeholder="SO-REFERENCE"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ExternalLink className="w-3 h-3 text-slate-300" />
                          </div>
                        </div>
                      </FormControl>
                    </div>
                  </Card>
                </section>

                {/* 02 Production Timeline */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">02 Production Timeline</h2>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Card className="border-slate-200/60 p-1">
                      <FormControl label="Planned Start Date" required>
                        <div className="relative">
                          <input 
                            type="date"
                            className={`w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none transition-all ${isLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                            value={formData.startDate}
                            disabled={isLocked}
                            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Clock className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      </FormControl>
                    </Card>

                    <Card className="border-slate-200/60 p-1">
                      <FormControl label="Planned Completion Date" required>
                        <div className="relative">
                          <input 
                            type="date"
                            className={`w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none transition-all ${isLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                            value={formData.endDate}
                            disabled={isLocked}
                            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Clock className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      </FormControl>
                    </Card>

                    <Card className="border-slate-200/60 p-1">
                      <FormControl label="Delivery Commitment">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm font-bold text-slate-700">{formData.deliveryCommitment}</span>
                          <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full border border-amber-100 uppercase tracking-wider">Target</span>
                        </div>
                      </FormControl>
                    </Card>
                  </div>
                </section>

                {/* 03 Operation Sequence */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                      <List className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">03 Operation Sequence</h2>
                  </div>

                  {operations.length > 0 ? (
                    <Card className="border-slate-200/60 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider">Step</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider">Operation</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider">Workstation</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider text-right">Base Time</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider">Source Item</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {operations.map((op, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3 text-slate-400">{(i + 1).toString().padStart(2, '0')}</td>
                              <td className="p-3 text-slate-700 font-bold">{op.operation_name}</td>
                              <td className="p-3 text-slate-500">{op.workstation || 'Unassigned'}</td>
                              <td className="p-3 text-slate-900 text-right font-bold">{op.base_time} <span className="text-slate-400 font-normal">Hrs</span></td>
                              <td className="p-3">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200">
                                  {op.source_item || formData.item_code || 'Main Item'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  ) : (
                    <Card className="p-8 border-slate-200/60 border-dashed bg-slate-50/30 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                        <Activity className="w-6 h-6 text-slate-300 animate-pulse" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-600">Production Logic Not Found</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-[300px]">
                        Release job cards or link a BOM to define the manufacturing operations for this order.
                      </p>
                    </Card>
                  )}
                </section>

                {/* 04 Required Inventory */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">04 Required Inventory</h2>
                    </div>
                    {inventory.length > 0 && (
                      <button 
                        onClick={commitConsumption}
                        disabled={consumptionLoading}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100 disabled:bg-indigo-400 disabled:shadow-none flex items-center gap-2"
                      >
                        {consumptionLoading ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {consumptionLoading ? 'Processing...' : 'Commit Consumption'}
                      </button>
                    )}
                  </div>

                  {inventory.length > 0 ? (
                    <Card className="border-slate-200/60 overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider">Material</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider text-right">Required</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider text-right">Issued</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider text-right">Consumed</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider text-right">Remaining (Stock)</th>
                            <th className="p-3 font-bold text-slate-400 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {inventory.map((inv, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3">
                                <div className="text-slate-700 font-bold">{inv.material_name}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">{inv.item_code}</div>
                              </td>
                              <td className="p-3 text-slate-900 text-right font-bold whitespace-nowrap">
                                {isWeightBased(inv.uom) ? parseFloat(inv.required_qty || 0).toFixed(3) : parseFloat(inv.required_qty || 0).toFixed(0)} 
                                <span className="ml-1 text-slate-400 font-normal">{inv.uom}</span>
                              </td>
                              <td className="p-3 text-slate-900 text-right font-bold whitespace-nowrap">
                                {isWeightBased(inv.uom) ? parseFloat(inv.issued_qty || 0).toFixed(3) : parseFloat(inv.issued_qty || 0).toFixed(0)}
                                <span className="ml-1 text-slate-400 font-normal">{inv.uom}</span>
                              </td>
                              <td className="p-3 text-slate-900 text-right">
                                <input 
                                  type="number"
                                  className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-right text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                  value={inv.consumed_qty || ''}
                                  step={isWeightBased(inv.uom) ? "0.001" : "1"}
                                  placeholder={isWeightBased(inv.uom) ? "0.000" : "0"}
                                  onChange={(e) => handleConsumptionChange(i, e.target.value)}
                                />
                              </td>
                              <td className="p-3 text-slate-900 text-right font-bold whitespace-nowrap">
                                <span className={`${parseFloat(inv.remaining_qty) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                  {isWeightBased(inv.uom) ? parseFloat(inv.remaining_qty || 0).toFixed(3) : parseFloat(inv.remaining_qty || 0).toFixed(0)}
                                </span>
                                <span className="ml-1 text-slate-400 font-normal">{inv.uom}</span>
                              </td>
                              <td className="p-3">
                                <span className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                                  <div className={`w-1.5 h-1.5 ${parseFloat(inv.issued_qty) >= parseFloat(inv.required_qty) ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full`} />
                                  <span className={parseFloat(inv.issued_qty) >= parseFloat(inv.required_qty) ? 'text-emerald-600' : 'text-amber-600'}>
                                    {parseFloat(inv.issued_qty) >= parseFloat(inv.required_qty) ? 'Ready' : 'Incomplete'}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  ) : (
                    <Card className="p-5 border-slate-200/60  border-dashed bg-slate-50/30 flex flex-col items-center justify-center text-center">
                      <div className="w-5 h-5 bg-white rounded  flex items-center justify-center mb-4  border border-slate-100">
                        <Search className="w-6 h-6 text-slate-300" />
                      </div>
                      <h3 className="text-sm  text-slate-600">Stock Requirements Empty</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-[300px]">
                        Associate a Bill of Materials (BOM) to generate the required material consumption list.
                      </p>
                    </Card>
                  )}

                  <div className="mt-2 bg-indigo-600 rounded  overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-12 -mr-12" />
                    <div className="p-2 relative flex items-center gap-6">
                      <div className="w-5 h-5 bg-white/10 rounded  flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 ">
                          <span className="text-xs  text-white  ">Inventory Advisory</span>
                        </div>
                        <p className="text-xs text-indigo-100 mt-1">
                          System tracks real-time material transfers. Ensure all raw materials are transferred from "Stores" to "Production" before consumption.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs  text-indigo-200  ">Transfer Status</span>
                          <div className="flex-1 h-1 bg-white/20 rounded  overflow-hidden">
                            <div className="h-full bg-white w-[0%]" />
                          </div>
                          <span className="text-xs  text-white">0%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 05 Daily Production History */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center ">
                        <History className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm  text-slate-800  ">05 Daily Production History</h2>
                    </div>
                    <button className="p-2 bg-indigo-600 text-white text-xs   rounded  hover:bg-indigo-700 transition-colors  ">
                      Export CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200/60 rounded ">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2  text-xs text-slate-400  ">DATE</th>
                          <th className="p-2  text-xs text-slate-400  ">SHIFT</th>
                          <th className="p-2  text-xs text-slate-400  ">OPERATOR</th>
                          <th className="p-2  text-xs text-slate-400  ">MINS</th>
                          <th className="p-2  text-xs text-slate-400  ">PRODUCED</th>
                          <th className="p-2  text-xs text-slate-400  ">ACCEPTED</th>
                          <th className="p-2  text-xs text-slate-400  ">REJECTED</th>
                          <th className="p-2  text-xs text-slate-400  ">SCRAP</th>
                          <th className="p-2  text-xs text-slate-400  ">DOWNTIME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedReport.length > 0 ? (
                          consolidatedReport.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <td className="p-2 text-slate-700">{row.date}</td>
                              <td className="p-2">
                                <span className="p-2 bg-slate-100 text-slate-600 rounded text-xs ">
                                  {row.shift}
                                </span>
                              </td>
                              <td className="p-2 text-slate-500">
                                {Array.from(row.operators).join(', ') || 'N/A'}
                              </td>
                              <td className="p-2 text-indigo-600">{row.mins}</td>
                              <td className="p-2  text-slate-900">{row.produced.toFixed(3)}</td>
                              <td className="p-2  text-emerald-600">{row.accepted.toFixed(3)}</td>
                              <td className="p-2  text-rose-600">{row.rejected.toFixed(3)}</td>
                              <td className="p-2  text-amber-600">{row.scrap.toFixed(3)}</td>
                              <td className="p-2 text-amber-600">
                                {row.downtime > 0 ? `${row.downtime} min` : '--'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="9" className="px-6 py-8 text-center text-slate-400 italic">
                              No production logs found for this work order yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-80 space-y-4 sticky top-0">
            {/* Efficiency Projection */}
            <Card className="border-slate-200/60  overflow-hidden relative">
              <div className="absolute -top-12 -right-12  bg-emerald-50 rounded " />
              <div className="relative">
                <div className="flex items-center gap-2  mb-4">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs  text-slate-400  ">Efficiency Projection</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl  text-slate-900">0%</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Predicted production efficiency based on workstation load.
                </p>
              </div>
            </Card>

            {/* Execution Pulse */}
            <div className="bg-slate-900 rounded  p-2 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded  animate-pulse" />
                  <span className="text-xs  text-indigo-400  ">Execution Pulse</span>
                  <span className="text-xs  text-slate-500 ml-2">{stats.completionRate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="text-xl  text-white tracking-tighter">{stats.actualHours.toFixed(1)}h</span>
              </div>
              <p className="text-xs  text-slate-500   mt-2">
                Cumulative machine hours logged against this order.
              </p>
            </div>

            {/* Execution Health */}
            <Card className="border-slate-200/60 ">
              <div className="flex items-center gap-2  mb-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="text-xs  text-slate-400  ">Execution Health</span>
              </div>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Completion Rate</p>
                  <div className="flex items-center gap-2 ">
                    <div className="w-12 h-1 bg-slate-100 rounded  overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${stats.completionRate}%` }} />
                    </div>
                    <span className="text-md  text-slate-900">{stats.completionRate.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-end gap-1">
                  {[4, 7, 3, 5, 8].map((h, i) => (
                    <div key={i} className="w-1.5 bg-slate-100 rounded-t-sm" style={{ height: `${h * 4}px` }} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Yield</p>
                  <p className="text-xs  text-slate-800">{stats.yieldRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs  text-slate-400   mb-1">Actual Hrs</p>
                  <p className="text-xs  text-slate-800">{stats.actualHours.toFixed(1)}h</p>
                </div>
              </div>
            </Card>

            {/* Panel Buttons */}
            <div className="space-y-2">
              <button className="w-full p-2 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-between group hover:bg-indigo-100 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white rounded  flex items-center justify-center ">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs   ">Operational Panel</span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </button>

              <button className="w-full p-2 bg-white border border-slate-200 text-slate-600 rounded  flex items-center justify-between group hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded  flex items-center justify-center">
                    <List className="w-4 h-4" />
                  </div>
                  <span className="text-xs   ">Commit Progress</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </button>

              <button className="w-full p-2 bg-slate-200  hover:text-white rounded  flex items-center justify-between group hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/10 rounded  flex items-center justify-center">
                    <Play className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-xs   ">Release job cards</span>
                </div>
                <div className="w-2 h-2 bg-amber-500 rounded  animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
              </button>
            </div>

            {/* Yield Note */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm mt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Yield Note</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    Yield loss is automatically calculated as the delta between transferred and consumed quantities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default WorkOrderForm;
