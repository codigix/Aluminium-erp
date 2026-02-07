import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Clock, CheckCircle2, X, Play, Package, 
  Settings, Activity, BarChart3, List, History, 
  Search, ShieldCheck, AlertCircle, ArrowRight, ExternalLink
} from 'lucide-react';
import { Card, FormControl, SearchableSelect } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

const WorkOrderForm = ({ workOrderId, onBack, onSuccess }) => {
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

  const isLocked = Boolean(formData.planId);

  useEffect(() => {
    fetchInitialData();
    const effectiveWorkOrderId = workOrderId || location.state?.workOrderId;
    if (effectiveWorkOrderId) {
      fetchWorkOrderDetails(effectiveWorkOrderId);
    } else {
      fetchNextWONumber();
    }
  }, [workOrderId, location.state?.workOrderId]);

  useEffect(() => {
    // Only fetch BOM details if NOT linked to a production plan
    // If linked to a plan, operations/materials are fetched via fetchPlanDetails
    if (formData.bomId && !formData.planId) {
      fetchBOMDetails(formData.bomId);
    } else if (!formData.bomId && !formData.planId) {
      setOperations([]);
      setInventory([]);
    }
  }, [formData.bomId, formData.planId]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const [soRes, bomRes, itemRes] = await Promise.all([
        fetch(`${API_BASE}/sales-orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/boms/approved`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/items`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (soRes.ok) setSalesOrders(await soRes.json());
      if (bomRes.ok) setBoms(await bomRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchBOMDetails = async (bomId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/boms/${bomId}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations || []);
        setInventory(data.materials || []);
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
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
        if (data.sales_order_id) {
          fetchSODetails(data.sales_order_id);
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
            setInventory(itemMats.map(m => ({
              item_code: m.item_code || m.itemCode,
              material_name: m.material_name || m.materialName,
              required_qty: m.required_qty || m.requiredQty,
              uom: m.uom,
              source_assembly: m.source_assembly || m.sourceAssembly
            })));
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-slate-900">
                  {workOrderId ? 'Edit Manufacturing Order' : 'Create Manufacturing Order'}
                </h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">
                  {formData.status?.toLowerCase()}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {formData.status === 'DRAFT' ? 'DRAFT-NEW' : formData.status} • {new Date().toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Close
            </button>
            <button 
              onClick={() => handleSubmit(formData.status === 'DRAFT' ? 'RELEASED' : formData.status)}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-sm ${
                formData.status === 'DRAFT' 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <Play className="w-4 h-4" />
              {saving ? 'Processing...' : (formData.status === 'DRAFT' ? 'Release to Production' : 'Update Work Order')}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 text-xs font-bold uppercase tracking-widest transition-all relative ${
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

            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg border border-slate-800 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Execution Pulse</span>
              </div>
              <div className="h-3 w-px bg-slate-700 mx-1" />
              <span className="text-[10px] font-bold text-indigo-400">0%</span>
              <Activity className="w-3 h-3 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Main Content Area */}
          <div className="flex-1 space-y-8">
            {activeTab === 'foundation' && (
              <div className="space-y-8">
                {/* 01 Foundation Setup */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                      <Settings className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">01 Foundation Setup</h2>
                  </div>
                  
                  <Card className="p-8 border-slate-200/60 shadow-sm">
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

                      <div className="grid grid-cols-2 gap-4">
                        <FormControl label="Quantity to Produce" required>
                          <div className="relative">
                            <input 
                              type="number"
                              className={`w-full pl-3 pr-12 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isLocked ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                              value={formData.quantity}
                              disabled={isLocked}
                              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">UNIT</span>
                          </div>
                        </FormControl>

                        <FormControl label="Priority Level">
                          <select 
                            className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none ${isLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
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
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                      <Clock className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">02 Production Timeline</h2>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <Card className="p-6 border-slate-200/60 shadow-sm">
                      <FormControl label="Planned Start Date" required>
                        <div className="relative">
                          <input 
                            type="date"
                            className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none ${isLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
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

                    <Card className="p-6 border-slate-200/60 shadow-sm">
                      <FormControl label="Planned Completion Date" required>
                        <div className="relative">
                          <input 
                            type="date"
                            className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none ${isLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                            value={formData.endDate}
                            disabled={isLocked}
                            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                            placeholder="dd-mm-yyyy"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Clock className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      </FormControl>
                    </Card>

                    <Card className="p-6 border-slate-200/60 shadow-sm">
                      <FormControl label="Delivery Commitment">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{formData.deliveryCommitment}</span>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded uppercase tracking-wider">Target</span>
                        </div>
                      </FormControl>
                    </Card>
                  </div>
                </section>

                {/* 03 Operation Sequence */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                      <List className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">03 Operation Sequence</h2>
                  </div>

                  {operations.length > 0 ? (
                    <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Step</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Operation</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Workstation</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-right">Base Time</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Source Item</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {operations.map((op, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-400">{(i + 1).toString().padStart(2, '0')}</td>
                              <td className="px-6 py-4 font-bold text-slate-700">{op.operation_name}</td>
                              <td className="px-6 py-4 text-slate-500">{op.workstation || 'Unassigned'}</td>
                              <td className="px-6 py-4 text-slate-900 font-bold text-right">{op.base_time} <span className="text-slate-400 font-medium">Hrs</span></td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                  {op.source_item || formData.item_code || 'Main Item'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  ) : (
                    <Card className="p-12 border-slate-200/60 shadow-sm border-dashed bg-slate-50/30 flex flex-col items-center justify-center text-center">
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
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                      <Package className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">04 Required Inventory</h2>
                  </div>

                  {inventory.length > 0 ? (
                    <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Material</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-right">Required Qty</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Source Assembly</th>
                            <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inventory.map((inv, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-700">{inv.material_name}</div>
                                <div className="text-[10px] text-slate-400">{inv.item_code}</div>
                              </td>
                              <td className="px-6 py-4 text-slate-900 font-bold text-right">
                                {inv.required_qty || (inv.qty_per_pc * formData.quantity).toFixed(2)} 
                                <span className="ml-1 text-slate-400 font-medium uppercase">{inv.uom}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-bold border border-rose-100">
                                  {inv.source_assembly || '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="flex items-center gap-1.5 text-slate-500">
                                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                  Available
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  ) : (
                    <Card className="p-12 border-slate-200/60 shadow-sm border-dashed bg-slate-50/30 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                        <Search className="w-6 h-6 text-slate-300" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-600">Stock Requirements Empty</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-[300px]">
                        Associate a Bill of Materials (BOM) to generate the required material consumption list.
                      </p>
                    </Card>
                  )}

                  <div className="mt-6 bg-indigo-600 rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-12 -mr-12" />
                    <div className="p-6 relative flex items-center gap-6">
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-widest">Inventory Advisory</span>
                        </div>
                        <p className="text-xs text-indigo-100 mt-1">
                          System tracks real-time material transfers. Ensure all raw materials are transferred from "Stores" to "Production" before consumption.
                        </p>
                        <div className="flex items-center gap-4 mt-4">
                          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Transfer Status</span>
                          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white w-[0%]" />
                          </div>
                          <span className="text-[10px] font-bold text-white">0%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 05 Daily Production History */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                        <History className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">05 Daily Production History</h2>
                    </div>
                    <button className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors uppercase tracking-widest">
                      Export CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200/60 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Shift</th>
                          <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Operator</th>
                          <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Produced</th>
                          <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-right">Downtime</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium italic">
                            No production logs found for this work order yet.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-[320px] space-y-4">
            {/* Efficiency Projection */}
            <Card className="p-6 border-slate-200/60 shadow-sm overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-50 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency Projection</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">0%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Predicted production efficiency based on workstation load.
                </p>
              </div>
            </Card>

            {/* Execution Pulse */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Execution Pulse</span>
                  <span className="text-[8px] font-bold text-slate-500 ml-2">0%</span>
                </div>
              </div>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white tracking-tighter">0.0h</span>
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                Cumulative machine hours logged against this order.
              </p>
            </div>

            {/* Execution Health */}
            <Card className="p-6 border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Health</span>
              </div>
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completion Rate</p>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 w-[0%]" />
                    </div>
                    <span className="text-lg font-bold text-slate-900">0%</span>
                  </div>
                </div>
                <div className="flex items-end gap-1">
                  {[4, 7, 3, 5, 8].map((h, i) => (
                    <div key={i} className="w-1.5 bg-slate-100 rounded-t-sm" style={{ height: `${h * 4}px` }} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Yield</p>
                  <p className="text-xs font-bold text-slate-800">0%</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Actual Hrs</p>
                  <p className="text-xs font-bold text-slate-800">0.0h</p>
                </div>
              </div>
            </Card>

            {/* Panel Buttons */}
            <div className="space-y-2">
              <button className="w-full p-4 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-between group hover:bg-indigo-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Operational Panel</span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </button>

              <button className="w-full p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl flex items-center justify-between group hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                    <List className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Commit Progress</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </button>

              <button className="w-full p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between group hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <Play className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Release job cards</span>
                </div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
              </button>
            </div>

            {/* Yield Note */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Yield Note</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Yield loss is automatically calculated as the delta between transferred and consumed quantities.
                  </p>
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
