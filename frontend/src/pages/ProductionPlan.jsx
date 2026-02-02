import React, { useState, useEffect, useMemo } from 'react';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  Eye, ArrowLeft, Settings, ClipboardList, Package, Save, 
  ChevronRight, Calendar, Info, CheckCircle2, AlertCircle,
  LayoutGrid, Activity
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

const ProductionPlan = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' or 'create'
  const [activeTab, setActiveTab] = useState('strategic'); // 'strategic', 'scope', 'material'
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [readyItems, setReadyItems] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [nextPlanCode, setNextPlanCode] = useState('');
  const [productionReadyOrders, setProductionReadyOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [approvedBOMs, setApprovedBOMs] = useState([]);
  const [selectedBOMId, setSelectedBOMId] = useState('');
  
  const [newPlan, setNewPlan] = useState({
    planCode: '',
    planDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    remarks: '',
    items: []
  });

  const planningPulse = useMemo(() => {
    let pulse = 0;
    if (selectedOrderId || selectedBOMId) pulse += 30;
    if (newPlan.items.length > 0) pulse += 40;
    if (newPlan && newPlan.items && newPlan.items.length > 0 && newPlan.items.every(i => i.plannedStartDate && i.plannedEndDate)) pulse += 30;
    return pulse;
  }, [selectedOrderId, selectedBOMId, newPlan.items]);

  const consolidatedMaterials = useMemo(() => {
    const totals = {};
    newPlan.items.forEach(item => {
      item.materials?.forEach(m => {
        const normalizedName = m.material_name?.trim().toUpperCase();
        const key = `${normalizedName}-${m.uom}`;
        if (!totals[key]) {
          totals[key] = { name: normalizedName || m.material_name, uom: m.uom, total: 0 };
        }
        totals[key].total += (m.qty_per_pc * item.plannedQty);
      });
    });
    return Object.values(totals);
  }, [newPlan.items]);

  const filteredBOMs = useMemo(() => {
    if (!selectedOrderId || !selectedOrderDetails) return approvedBOMs;
    
    const soItems = selectedOrderDetails.items || [];
    const soItemCodes = new Set(soItems.map(i => i.item_code).filter(Boolean));
    const soDrawings = new Set(soItems.map(i => (i.drawing_no || '').trim()).filter(Boolean));
    const clientName = selectedOrderDetails.company_name;

    const matching = approvedBOMs.filter(bom => {
      // 1. Only include Finished Goods or Sub-Assemblies for production planning
      const group = (bom.item_group || '').toLowerCase();
      const code = (bom.item_code || '').toUpperCase();
      
      const isFG = group.includes('fg') || group.includes('finished') || group.includes('sa') || group.includes('assembly') || group.includes('wip');
      const isRawMaterial = group.includes('raw') || code.startsWith('RM-') || code.startsWith('RW-');
      
      if (!isFG || isRawMaterial) return false;

      // 2. Client matching (Must be same client OR a Master Repository BOM)
      const isRelevantClient = bom.company_name === clientName || bom.company_name === 'Master';
      if (!isRelevantClient) return false;

      // 3. Match against items in the Sales Order by Item Code or Drawing Number
      const matchesItemCode = bom.item_code && soItemCodes.has(bom.item_code);
      const matchesDrawing = bom.drawing_no && soDrawings.has((bom.drawing_no || '').trim());
      const matchesSOId = bom.sales_order_id?.toString() === selectedOrderId;

      return matchesItemCode || matchesDrawing || matchesSOId;
    });

    // If no matching BOMs found for this SO, show all approved BOMs as fallback
    // But limit it to the client and FG items
    if (matching.length > 0) return matching;

    return approvedBOMs.filter(bom => {
      const group = (bom.item_group || '').toLowerCase();
      const code = (bom.item_code || '').toUpperCase();
      const isFG = group.includes('fg') || group.includes('finished') || group.includes('sa') || group.includes('assembly') || group.includes('wip');
      const isRawMaterial = group.includes('raw') || code.startsWith('RM-') || code.startsWith('RW-');
      
      return (bom.company_name === clientName || bom.company_name === 'Master') && isFG && !isRawMaterial;
    });
  }, [selectedOrderId, selectedOrderDetails, approvedBOMs]);

  const groupMaterials = (materials) => {
    const grouped = {};
    materials?.forEach(m => {
      const name = (m.material_name || '').trim().toUpperCase();
      const uom = (m.uom || 'Nos').trim().toUpperCase();
      const key = `${name}-${uom}`;
      if (!grouped[key]) {
        grouped[key] = { ...m, material_name: name || m.material_name, qty_per_pc: 0 };
      }
      grouped[key].qty_per_pc += parseFloat(m.qty_per_pc || 0);
    });
    return Object.values(grouped);
  };

  const groupComponents = (components) => {
    const grouped = {};
    components?.forEach(c => {
      const group = (c.item_group || '').toLowerCase().trim();
      const type = (c.material_type || '').toLowerCase().trim();
      const prodType = (c.product_type || '').toLowerCase().trim();
      const code = (c.component_code || c.componentCode || '').toLowerCase().trim();

      const isFG = group === 'fg' || prodType === 'fg' || group.includes('finished') || prodType.includes('finished') || type.includes('finished') ||
                   code.startsWith('fg-');
      
      // It's a Sub-Assembly if it's NOT an FG, OR if it's specifically marked as Sub-Assembly
      const isExplicitSubAssembly = 
        group.includes('sub assembly') || group.includes('sub-assembly') || group.includes('subassembly') || group === 'sa' || group.includes('semi-finished') || group.includes('wip') ||
        type.includes('sub assembly') || type.includes('sub-assembly') || type.includes('subassembly') || type === 'sa' || type.includes('semi-finished') || type.includes('wip') ||
        prodType.includes('sub assembly') || prodType.includes('sub-assembly') || prodType.includes('subassembly') || prodType === 'sa' || prodType.includes('semi-finished') || prodType.includes('wip') ||
        code.startsWith('sa-') || code.startsWith('wip-') || code.startsWith('sfg-');

      // Priority: If it is an FG, it stays in FG section UNLESS it has no FG markers and only SA markers
      if (isFG) return;

      const key = `${c.component_code || c.componentCode || c.material_name}-${c.uom}`;
      if (!grouped[key]) {
        grouped[key] = { ...c, quantity: 0 };
      }
      grouped[key].quantity += parseFloat(c.quantity || 0);
    });
    return Object.values(grouped);
  };

  const groupFinishedGoods = (components) => {
    const grouped = {};
    components?.forEach(c => {
      const group = (c.item_group || '').toLowerCase().trim();
      const type = (c.material_type || '').toLowerCase().trim();
      const prodType = (c.product_type || '').toLowerCase().trim();
      const code = (c.component_code || c.componentCode || '').toLowerCase().trim();

      const isFG = group === 'fg' || prodType === 'fg' || group.includes('finished') || prodType.includes('finished') || type.includes('finished') ||
                   code.startsWith('fg-');

      if (!isFG) return;

      const key = `${c.component_code || c.componentCode || c.material_name}-${c.uom}`;
      if (!grouped[key]) {
        grouped[key] = { ...c, quantity: 0 };
      }
      grouped[key].quantity += parseFloat(c.quantity || 0);
    });
    return Object.values(grouped);
  };

  useEffect(() => {
    fetchPlans();
    fetchWorkstations();
  }, []);

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
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

  const fetchReadyItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/ready-items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReadyItems(data);
      }
    } catch (error) {
      console.error('Error fetching ready items:', error);
    }
  };

  const fetchReadyOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/ready-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProductionReadyOrders(data);
      }
    } catch (error) {
      console.error('Error fetching ready orders:', error);
    }
  };

  const fetchNextCode = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/next-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNextPlanCode(data.planCode);
        setNewPlan(prev => ({ ...prev, planCode: data.planCode }));
      }
    } catch (error) {
      console.error('Error fetching next code:', error);
    }
  };

  const fetchApprovedBOMs = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApprovedBOMs(data);
      }
    } catch (error) {
      console.error('Error fetching approved BOMs:', error);
    }
  };

  const handleCreateNew = () => {
    fetchReadyItems();
    fetchReadyOrders();
    fetchApprovedBOMs();
    fetchNextCode();
    setSelectedOrderId('');
    setSelectedOrderDetails(null);
    setSelectedBOMId('');
    setNewPlan({
      planCode: '',
      planDate: new Date().toISOString().split('T')[0],
      startDate: '',
      endDate: '',
      remarks: '',
      items: []
    });
    setView('create');
    setActiveTab('strategic');
    setIsExpandedView(false);
  };

  const handleOrderSelect = async (orderId) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setSelectedOrderDetails(null);
      setIsExpandedView(false);
      return;
    }

    try {
      setSelectedBOMId(''); // Clear BOM if SO is selected
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/sales-order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedOrderDetails(data);
        setIsExpandedView(true);
        
        setNewPlan(prev => ({
          ...prev,
          items: []
        }));
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
      errorToast('Failed to fetch sales order details');
    }
  };

  const handleBOMSelect = async (bomId) => {
    setSelectedBOMId(bomId);
    if (!bomId) {
      setSelectedOrderDetails(null);
      setIsExpandedView(false);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const bom = approvedBOMs.find(b => b.id.toString() === bomId);
      if (!bom) return;

      const response = await fetch(`${API_BASE}/bom/items/${bomId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Transform BOM data to match selectedOrderDetails structure for consistent UI
        setSelectedOrderDetails({
          company_name: bom.company_name,
          project_name: bom.project_name,
          items: [{
            id: bom.id,
            item_code: bom.item_code,
            description: bom.description,
            quantity: bom.quantity || 1,
            already_planned_qty: 0,
            materials: data.materials || [],
            components: data.components || [],
            operations: data.operations || []
          }]
        });
        setIsExpandedView(true);
        setSelectedOrderId(''); // Clear SO if BOM is selected

        setNewPlan(prev => ({
          ...prev,
          items: []
        }));
      }
    } catch (error) {
      console.error('Error fetching BOM details:', error);
      errorToast('Failed to fetch BOM details');
    }
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(`${sectionId}-section`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveTab(sectionId);
  };

  const toggleItemSelection = (item) => {
    const exists = newPlan.items.find(i => i.salesOrderItemId === item.sales_order_item_id);
    if (exists) {
      setNewPlan(prev => ({
        ...prev,
        items: prev.items.filter(i => i.salesOrderItemId !== item.sales_order_item_id)
      }));
    } else {
      setNewPlan(prev => ({
        ...prev,
        items: [...prev.items, {
          salesOrderId: item.sales_order_id,
          salesOrderItemId: item.sales_order_item_id,
          projectName: item.project_name,
          itemCode: item.item_code,
          description: item.description,
          plannedQty: (item.total_qty || item.quantity) - (item.already_planned_qty || 0),
          totalQty: item.total_qty || item.quantity,
          alreadyPlannedQty: item.already_planned_qty || 0,
          workstationId: '',
          plannedStartDate: prev.startDate,
          plannedEndDate: prev.endDate,
          // Store additional details for display
          materials: item.materials || [],
          components: item.components || [],
          operations: item.operations || []
        }]
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...newPlan.items];
    updatedItems[index][field] = value;
    setNewPlan(prev => ({ ...prev, items: updatedItems }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPlan.items.length === 0) {
      errorToast('Please select at least one item');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPlan)
      });

      if (response.ok) {
        successToast('Production plan created successfully');
        setView('list');
        fetchPlans();
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to create production plan');
      }
    } catch (error) {
      errorToast('An unexpected error occurred');
    }
  };

  const columns = [
    {
      label: 'Plan Code',
      key: 'plan_code',
      sortable: true,
      render: (val) => <span className="font-medium text-slate-900">{val}</span>
    },
    {
      label: 'Plan Date',
      key: 'plan_date',
      sortable: true,
      render: (val) => new Date(val).toLocaleDateString()
    },
    {
      label: 'Period',
      key: 'id',
      render: (_, row) => (
        <span className="text-slate-600">
          {row.start_date ? new Date(row.start_date).toLocaleDateString() : 'N/A'} - 
          {row.end_date ? new Date(row.end_date).toLocaleDateString() : 'N/A'}
        </span>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Created By',
      key: 'creator_name',
      sortable: true
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (val) => (
        <button 
          className="text-indigo-600 hover:text-indigo-900 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {/* View logic */}}
        >
          View
        </button>
      )
    }
  ];

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl text-slate-900">Production Plan</h2>
            <p className="text-sm text-slate-500">Manage and schedule production activities</p>
          </div>
          <button 
            onClick={handleCreateNew}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            Create Production Plan
          </button>
        </div>

        <Card>
          <DataTable 
            columns={columns}
            data={plans}
            loading={loading}
            searchPlaceholder="Search plans..."
          />
        </Card>
      </div>
    );
  }

  // New Production Plan (Full Page)
  return (
    <div className="min-h-screen bg-slate-50/30 -m-4 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('list')}
              className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <span className="text-indigo-500">PP</span>
                <ChevronRight className="w-3 h-3" />
                <span>NEW PRODUCTION PLAN</span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Production Plan</h1>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                  draft
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('list')}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Discard Changes
            </button>
            <button 
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Save Strategic Plan
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Tabs and Pulse Indicator */}
        <div className="sticky top-4 z-30 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-white/90 backdrop-blur-sm p-2 rounded-2xl border border-slate-200 shadow-md">
          <div className="flex items-center gap-1">
            {[
              { id: 'strategic', label: 'STRATEGIC PARAMETERS', icon: Settings },
              { id: 'scope', label: 'PRODUCTION SCOPE', icon: LayoutGrid },
              { id: 'material', label: 'MATERIAL REQUIREMENTS', icon: Package },
              { id: 'operations', label: 'PLAN OPERATIONS', icon: Activity }
            ].filter(tab => {
              if (tab.id === 'scope') {
                return selectedOrderId || selectedBOMId;
              }
              if (tab.id === 'material' || tab.id === 'operations') {
                return newPlan.items.length > 0;
              }
              return true;
            }).map(tab => (
              <button
                key={tab.id}
                onClick={() => isExpandedView ? scrollToSection(tab.id) : setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-y-[-1px]' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-4 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Planning Pulse</span>
              <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${planningPulse}%` }} />
              </div>
              <span className="text-xs font-bold text-indigo-700">{planningPulse}%</span>
            </div>
            <Activity className={`w-4 h-4 ${planningPulse > 0 ? 'text-indigo-500 animate-pulse' : 'text-indigo-300'}`} />
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8 pb-20">
          {(activeTab === 'strategic' || isExpandedView) && (
            <div id="strategic-section" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 tracking-[0.2em]">01</span>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Strategic Parameters</h2>
                      </div>
                      <p className="text-xs text-slate-500">Core planning identities and source selection</p>
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
                    <Info className="w-4 h-4" />
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Plan Identity <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value="Auto Generated" 
                        disabled 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Naming Series</label>
                      <input 
                        type="text" 
                        value="PP" 
                        disabled
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Status</label>
                      <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600">
                        <option>Draft</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Source Sales Order <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect 
                        options={productionReadyOrders.map(so => ({
                          label: `${so.po_number || 'SO-' + so.id} - ${so.company_name}${so.project_name ? ` (${so.project_name})` : ''}`,
                          value: so.id.toString()
                        }))}
                        value={selectedOrderId}
                        onChange={(e) => handleOrderSelect(e.target.value)}
                        placeholder="Select Sales Order..."
                        allowCustom={false}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        BOM <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect 
                        options={filteredBOMs.map(bom => ({
                          label: `${bom.item_code}${bom.drawing_no ? ` (${bom.drawing_no})` : ''} [${bom.bom_type}${bom.assembly_id ? ': ' + bom.assembly_id : ''}] - ${bom.company_name}`,
                          value: bom.id.toString()
                        }))}
                        value={selectedBOMId}
                        onChange={(e) => handleBOMSelect(e.target.value)}
                        placeholder={selectedOrderId ? "Select matching BOM..." : "Select BOM..."}
                        allowCustom={false}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Name</label>
                      <input 
                        type="text" 
                        value={selectedOrderDetails?.company_name || '—'} 
                        disabled
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</label>
                      <input 
                        type="text" 
                        value={selectedOrderDetails?.project_name || '—'} 
                        disabled
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Target Quantity <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={selectedOrderDetails?.items?.reduce((sum, item) => sum + (item.quantity - (item.already_planned_qty || 0)), 0) || 1} 
                          disabled
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500">
                          UNIT
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'scope' || isExpandedView) && (selectedOrderId || selectedBOMId) && (
            <div id="scope-section" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                      <LayoutGrid className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 tracking-[0.2em]">02</span>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Production Scope</h2>
                      </div>
                      <p className="text-xs text-slate-500">Finished goods and target fulfillment</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">{newPlan.items.length} Items</span>
                  </div>
                </div>

                <div className="p-0 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finished Good</th>
                        <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Qty</th>
                        <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</th>
                        <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">BOM</th>
                        <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timeline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrderDetails ? selectedOrderDetails.items : []).map(item => {
                        const isSelected = newPlan.items.some(i => i.salesOrderItemId === item.id);
                        return (
                          <tr key={item.id} className={`group transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                            <td className="px-6 py-4">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItemSelection({
                                  ...item,
                                  sales_order_item_id: item.id,
                                  sales_order_id: item.sales_order_id,
                                  project_name: selectedOrderDetails?.project_name
                                })}
                                className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900">{item.item_code}</span>
                                <span className="text-xs text-slate-500 max-w-xs truncate">{item.description}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-bold text-slate-700">{item.quantity}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                                {item.quantity - (item.already_planned_qty || 0)} PENDING
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {(item.materials?.length > 0 || item.components?.length > 0 || item.operations?.length > 0) ? (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                                  EXPLODED
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                                  NO BOM
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="flex flex-col items-center">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">Start</span>
                                  <input 
                                    type="date" 
                                    value={newPlan.items.find(ni => ni.salesOrderItemId === item.id)?.plannedStartDate || ''}
                                    onChange={(e) => {
                                      const idx = newPlan.items.findIndex(ni => ni.salesOrderItemId === item.id);
                                      if (idx !== -1) handleItemChange(idx, 'plannedStartDate', e.target.value);
                                    }}
                                    className="text-[10px] border-none p-0 focus:ring-0 font-bold bg-transparent" 
                                  />
                                </div>
                                <div className="w-4 h-[1px] bg-slate-200" />
                                <div className="flex flex-col items-center">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">End</span>
                                  <input 
                                    type="date" 
                                    value={newPlan.items.find(ni => ni.salesOrderItemId === item.id)?.plannedEndDate || ''}
                                    onChange={(e) => {
                                      const idx = newPlan.items.findIndex(ni => ni.salesOrderItemId === item.id);
                                      if (idx !== -1) handleItemChange(idx, 'plannedEndDate', e.target.value);
                                    }}
                                    className="text-[10px] border-none p-0 focus:ring-0 font-bold bg-transparent" 
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedOrderDetails || selectedOrderDetails.items.length === 0) && (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-300" />
                              </div>
                              <p className="text-sm font-medium text-slate-400">No items selected. Select a Sales Order first.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'material' || isExpandedView) && (selectedOrderId || selectedBOMId) && newPlan.items.length > 0 && (
            <div id="material-section" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 tracking-[0.2em]">03</span>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Material Requirements</h2>
                      </div>
                      <p className="text-xs text-slate-500">Exploded bill of materials and inventory check</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 overflow-x-auto">
                  {consolidatedMaterials.length > 0 && (
                    <div className="mb-8 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center shadow-sm text-indigo-600">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Consolidated Material Demand</h4>
                          <p className="text-[10px] text-slate-500 font-medium">Total raw materials required for all planned items</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {consolidatedMaterials.map((m, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate" title={m.name}>{m.name}</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-black text-indigo-700">{m.total.toFixed(2)}</span>
                              <span className="text-[10px] font-bold text-indigo-400 uppercase">{m.uom}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOrderDetails?.items?.filter(item => newPlan.items.some(ni => ni.salesOrderItemId === item.id)).map(item => (
                    <div key={item.id} className="mb-8 last:mb-0">
                      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                          <LayoutGrid className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{item.item_code}</h4>
                          <p className="text-[10px] text-slate-500">{item.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="space-y-3">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            Raw Materials
                          </h5>
                          <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">Material</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Qty/Pc</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {groupMaterials(item.materials).map((m, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{m.material_name}</td>
                                    <td className="px-4 py-3 text-right text-slate-500">{m.qty_per_pc.toFixed(2)} {m.uom}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                      {(m.qty_per_pc * (newPlan.items.find(ni => ni.salesOrderItemId === item.id)?.plannedQty || 0)).toFixed(2)} {m.uom}
                                    </td>
                                  </tr>
                                ))}
                                {(!item.materials || item.materials.length === 0) && (
                                  <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400 italic">No materials defined in BOM</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            Sub-assemblies
                          </h5>
                          <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">Component</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Qty/Pc</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {groupComponents(item.components).map((c, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{c.component_code}</td>
                                    <td className="px-4 py-3 text-right text-slate-500">{c.quantity.toFixed(2)} {c.uom}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                      {(c.quantity * (newPlan.items.find(ni => ni.salesOrderItemId === item.id)?.plannedQty || 0)).toFixed(2)} {c.uom}
                                    </td>
                                  </tr>
                                ))}
                                {(!item.components || item.components.length === 0 || groupComponents(item.components).length === 0) && (
                                  <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400 italic">No sub-assemblies defined</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            Finished Goods Components
                          </h5>
                          <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">Item</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Qty/Pc</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {groupFinishedGoods(item.components).map((c, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{c.component_code}</td>
                                    <td className="px-4 py-3 text-right text-slate-500">{c.quantity.toFixed(2)} {c.uom}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                      {(c.quantity * (newPlan.items.find(ni => ni.salesOrderItemId === item.id)?.plannedQty || 0)).toFixed(2)} {c.uom}
                                    </td>
                                  </tr>
                                ))}
                                {groupFinishedGoods(item.components).length === 0 && (
                                  <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400 italic">No FG components defined</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            Manufacturing Operations
                          </h5>
                          <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">Operation</th>
                                  <th className="px-4 py-3 text-left font-bold text-slate-500">Workstation</th>
                                  <th className="px-4 py-3 text-right font-bold text-slate-500">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {item.operations?.map((op, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{op.operation_name}</td>
                                    <td className="px-4 py-3 text-slate-500">{op.workstation || 'N/A'}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                      {((op.cycle_time_min || 0) * (newPlan.items.find(ni => ni.salesOrderItemId === item.id)?.plannedQty || 0)).toFixed(0)} min
                                    </td>
                                  </tr>
                                ))}
                                {(!item.operations || item.operations.length === 0) && (
                                  <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-400 italic">No operations defined in BOM</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!newPlan.items || newPlan.items.length === 0) && (
                    <div className="p-12 text-center">
                      <div className="max-w-xs mx-auto space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto">
                          <Package className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-xs text-slate-500">Select items in Production Scope to see requirements.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'operations' || isExpandedView) && (selectedOrderId || selectedBOMId) && newPlan.items.length > 0 && (
            <div id="operations-section" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 tracking-[0.2em]">04</span>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Manufacturing Operations</h2>
                      </div>
                      <p className="text-xs text-slate-500">Planned workstation activities and time estimation</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {newPlan.items?.length > 0 ? (
                    <div className="space-y-8">
                      {newPlan.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="border border-slate-100 rounded-3xl p-6 bg-slate-50/20">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                              <LayoutGrid className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{item.itemCode}</h4>
                              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{item.description}</p>
                            </div>
                          </div>

                          <div className="overflow-hidden border border-slate-100 rounded-2xl bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-widest">Operation</th>
                                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-widest">Workstation</th>
                                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-widest">Cycle Time</th>
                                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-widest">Total Time</th>
                                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {item.operations?.length > 0 ? (
                                  item.operations.map((op, opIdx) => (
                                    <tr key={opIdx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                          <span className="font-bold text-slate-700">{op.operation_name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px]">
                                          {op.workstation || 'NOT ASSIGNED'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-right font-medium text-slate-500">
                                        {op.cycle_time_min || 0} min/pc
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-slate-900">
                                          {((op.cycle_time_min || 0) * item.plannedQty).toFixed(0)} min
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 font-bold text-[9px] border border-amber-100">
                                          READY
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center">
                                      <div className="flex flex-col items-center gap-2">
                                        <Activity className="w-6 h-6 text-slate-200" />
                                        <span className="text-slate-400 italic">No manufacturing operations defined for this item's BOM.</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                      <div className="max-w-xs mx-auto space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-white border border-slate-100 flex items-center justify-center mx-auto shadow-sm">
                          <Activity className="w-8 h-8 text-slate-200" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">No Items Planned</p>
                          <p className="text-[10px] text-slate-500 font-medium">Please select items in the Production Scope tab to generate the operation plan.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionPlan;

