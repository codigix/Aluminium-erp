import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

const ProductionPlan = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('Basic Info');
  const [readyItems, setReadyItems] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [nextPlanCode, setNextPlanCode] = useState('');
  const [productionReadyOrders, setProductionReadyOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [availableBoms, setAvailableBoms] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  
  const [newPlan, setNewPlan] = useState({
    planCode: '',
    planDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    remarks: '',
    namingSeries: 'PP',
    operationalStatus: 'Draft',
    targetQuantity: 1,
    items: []
  });

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

  const handleCreateNew = () => {
    fetchReadyItems();
    fetchReadyOrders();
    fetchNextCode();
    setSelectedOrderId('');
    setSelectedOrderDetails(null);
    setAvailableBoms([]);
    setSelectedBomId('');
    setNewPlan({
      planCode: '',
      planDate: new Date().toISOString().split('T')[0],
      startDate: '',
      endDate: '',
      remarks: '',
      namingSeries: 'PP',
      operationalStatus: 'Draft',
      targetQuantity: 1,
      items: []
    });
    setIsCreating(true);
  };

  const handleOrderSelect = async (orderId) => {
    setSelectedOrderId(orderId);
    setSelectedBomId('');
    setAvailableBoms([]);
    
    if (!orderId) {
      setSelectedOrderDetails(null);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/sales-order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedOrderDetails(data);
        
        // Populate available BOMs from SO items
        const boms = data.items || [];
        setAvailableBoms(boms);
        
        // If only one BOM, auto-select it
        if (boms.length === 1) {
          const singleBomId = boms[0].id.toString();
          setSelectedBomId(singleBomId);
          // Auto-select the item for production if it's in readyItems
          const itemInReady = readyItems.find(ri => ri.sales_order_item_id === parseInt(singleBomId));
          if (itemInReady) {
            toggleItemSelection(itemInReady);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
      errorToast('Failed to fetch sales order details');
    }
  };

  const handleBomSelect = (bomId) => {
    setSelectedBomId(bomId);
    if (!bomId) {
      setNewPlan(prev => ({ ...prev, items: [] }));
      return;
    }

    // When a BOM is selected, find the item in readyItems and select it
    // The user wants STRICT behavior: only this item should be in the plan
    const itemsToSearch = selectedOrderDetails ? selectedOrderDetails.items : readyItems;
    const itemInReady = itemsToSearch.find(item => (item.id || item.sales_order_item_id).toString() === bomId.toString());
    
    if (itemInReady) {
      // Clear existing items and only add this one
      const salesOrderItemId = itemInReady.id || itemInReady.sales_order_item_id;
      const orderNo = itemInReady.order_no || selectedOrderDetails?.order_no;
      const projectName = itemInReady.project_name || selectedOrderDetails?.project_name;
      
      // We call toggleItemSelection but we need to ensure it's the ONLY one.
      // Actually, it's better to manually set it to ensure "checked" state and "ONE ROW ONLY".
      
      const fetchAndSetItem = async () => {
        let bomDetails = { materials: [], components: [], operations: [] };
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_BASE}/production-plans/item-bom/${salesOrderItemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            bomDetails = await response.json();
          }
        } catch (error) {
          console.error('Error fetching BOM details:', error);
        }

        setNewPlan(prev => ({
          ...prev,
          items: [{
            salesOrderId: itemInReady.sales_order_id,
            salesOrderItemId: salesOrderItemId,
            projectName: projectName,
            orderNo: orderNo,
            itemCode: itemInReady.item_code,
            description: itemInReady.description,
            plannedQty: (itemInReady.total_qty || itemInReady.quantity) - (itemInReady.already_planned_qty || 0),
            totalQty: itemInReady.total_qty || itemInReady.quantity,
            alreadyPlannedQty: itemInReady.already_planned_qty || 0,
            workstationId: '',
            plannedStartDate: prev.startDate,
            plannedEndDate: prev.endDate,
            materials: bomDetails.materials || [],
            components: bomDetails.components || [],
            operations: bomDetails.operations || []
          }]
        }));
      };
      
      fetchAndSetItem();
    }
  };

  const toggleItemSelection = async (item) => {
    const salesOrderItemId = item.id || item.sales_order_item_id;
    const exists = newPlan.items.find(i => i.salesOrderItemId === salesOrderItemId);
    
    if (exists) {
      setNewPlan(prev => ({
        ...prev,
        items: prev.items.filter(i => i.salesOrderItemId !== salesOrderItemId)
      }));
    } else {
      // Fetch BOM details for this item
      let bomDetails = { materials: [], components: [], operations: [] };
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/production-plans/item-bom/${salesOrderItemId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          bomDetails = await response.json();
        }
      } catch (error) {
        console.error('Error fetching BOM details:', error);
      }

      setNewPlan(prev => ({
        ...prev,
        items: [...prev.items, {
          salesOrderId: item.sales_order_id,
          salesOrderItemId: salesOrderItemId,
          projectName: item.project_name,
          orderNo: item.order_no,
          itemCode: item.item_code,
          description: item.description,
          plannedQty: (item.total_qty || item.quantity) - (item.already_planned_qty || 0),
          totalQty: item.total_qty || item.quantity,
          alreadyPlannedQty: item.already_planned_qty || 0,
          workstationId: '',
          plannedStartDate: prev.startDate,
          plannedEndDate: prev.endDate,
          // Store fetched BOM details
          materials: bomDetails.materials || [],
          components: bomDetails.components || [],
          operations: bomDetails.operations || []
        }]
      }));
    }
  };

  const renderCreateForm = () => {
    // Calculate materials explosion
    const coreMaterials = newPlan.items.flatMap(item => 
      (item.materials || []).map(mat => ({
        ...mat,
        totalRequiredQty: mat.qty_per_pc * (item.plannedQty || 1),
        bom_no: item.bom_no || 'BOM-' + (item.salesOrderItemId || 'REF')
      }))
    );

    const getExplodedMaterials = () => {
      const exploded = [];
      const traverse = (components, parentPlannedQty = 1) => {
        components.forEach(comp => {
          const currentCompQty = comp.quantity * parentPlannedQty;
          if (comp.materials && comp.materials.length > 0) {
            comp.materials.forEach(mat => {
              exploded.push({
                ...mat,
                source_assembly: comp.component_code || comp.item_code,
                bom_no: comp.bom_no || 'BOM-SUB',
                totalRequiredQty: mat.qty_per_pc * currentCompQty
              });
            });
          }
          if (comp.components && comp.components.length > 0) {
            traverse(comp.components, currentCompQty);
          }
        });
      };
      newPlan.items.forEach(item => {
        if (item.components) {
          traverse(item.components, item.plannedQty || 1);
        }
      });
      return exploded;
    };

    const explodedMaterials = getExplodedMaterials();
    const totalMaterialCount = coreMaterials.length + explodedMaterials.length;

    return (
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header Section */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">PP /</span>
                <h1 className="text-lg font-semibold text-slate-900">NEW PRODUCTION PLAN</h1>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded capitalize">draft</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Discard Changes
            </button>
            <button 
              onClick={handleSubmit}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors shadow-sm"
            >
              Save Strategic Plan
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
          {['Basic Info', 'Finished Goods', 'Materials', 'Sub Assemblies', 'Operations'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-all relative ${
                activeTab === tab 
                  ? 'text-indigo-600' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {tab}
                {(tab === 'Sub Assemblies' || tab === 'Materials' || tab === 'Operations') && (
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                )}
              </div>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          ))}
          <div className="ml-auto">
            <button className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 text-xs font-semibold transition-colors shadow-sm">
              Production Progress
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            </button>
          </div>
        </div>

        {/* Section 01: Strategic Parameters */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-indigo-600">01</span>
                  <h2 className="text-base font-bold text-slate-800">STRATEGIC PARAMETERS</h2>
                </div>
                <p className="text-xs text-slate-400">Core planning identities and source selection</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
              <FormControl label="Plan Identity *">
                <input 
                  type="text" 
                  value="Auto Generated" 
                  disabled 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 font-medium cursor-not-allowed"
                />
              </FormControl>
              <FormControl label="Naming Series">
                <input 
                  type="text" 
                  value={newPlan.namingSeries} 
                  onChange={(e) => setNewPlan(prev => ({ ...prev, namingSeries: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </FormControl>
              <FormControl label="Operational Status">
                <select 
                  value={newPlan.operationalStatus}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, operationalStatus: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none"
                >
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </FormControl>
              <FormControl label="Source Sales Order *">
                <div className="relative">
                  <SearchableSelect 
                    options={productionReadyOrders.map(so => ({
                      label: `${so.order_no} - ${so.company_name} ${so.project_name ? `(${so.project_name})` : ''}`,
                      value: so.id.toString(),
                      order_no: so.order_no
                    }))}
                    value={selectedOrderId}
                    onChange={(e) => handleOrderSelect(e.target.value)}
                    placeholder="Search and select sales order..."
                    allowCustom={false}
                  />
                  {selectedOrderId && (
                    <button 
                      onClick={() => handleOrderSelect('')}
                      className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </FormControl>
              <FormControl label="Select BOM">
                <div className="relative">
                  <select
                    className={`w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none ${availableBoms.length <= 1 && selectedOrderId ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={selectedBomId}
                    onChange={(e) => handleBomSelect(e.target.value)}
                    disabled={availableBoms.length <= 1 && selectedOrderId}
                  >
                    <option value="">{availableBoms.length === 0 ? (selectedOrderId ? 'No BOMs Available' : 'Select Order First') : 'Select BOM...'}</option>
                    {availableBoms.map(bom => (
                      <option key={bom.id} value={bom.id}>
                        {bom.item_code} - {bom.description}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </FormControl>
              <FormControl label="Target Quantity *">
                <div className="flex items-center">
                  <input 
                    type="number" 
                    value={newPlan.targetQuantity}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, targetQuantity: parseFloat(e.target.value) }))}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-l-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                  <span className="px-4 py-2.5 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg text-xs font-semibold text-slate-400">UNIT</span>
                </div>
              </FormControl>
            </div>
          </div>
        </Card>

        {/* Section 02: Finished Goods */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">02</span>
                  <h2 className="text-base font-bold text-slate-800">Finished Goods</h2>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full ml-2 uppercase tracking-tight">{newPlan.items.length} ITEMS</span>
                </div>
                <p className="text-xs text-slate-400">Finished goods and target fulfillment</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Item Code</th>
                    <th className="px-4 py-3 font-medium text-center">BOM No</th>
                    <th className="px-4 py-3 font-medium text-center">Planned Qty</th>
                    <th className="px-4 py-3 font-medium text-center">UOM</th>
                    <th className="px-4 py-3 font-medium">Finished Goods Warehouse</th>
                    <th className="px-4 py-3 font-medium">Planned Start Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newPlan.items.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-blue-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{item.itemCode}</div>
                            <div className="text-[10px] text-slate-400">{item.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-indigo-600 text-[10px] font-bold rounded-md border border-slate-100">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {item.bom_no || 'BOM-' + (item.salesOrderItemId || 'REF')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-indigo-600">{item.plannedQty}</td>
                      <td className="px-4 py-4 text-center text-slate-400 text-xs">Nos</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs font-medium">Finished Goods - NC</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-xs font-medium">{item.plannedStartDate || '2026-02-04'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {newPlan.items.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center text-slate-400 italic text-sm">
                        No finished goods selected. Please select a sales order and BOM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Section 04: Sub Assemblies */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-rose-600">04</span>
                  <h2 className="text-base font-bold text-slate-800">Sub Assemblies</h2>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-full ml-2 uppercase tracking-tight">{newPlan.items.reduce((acc, item) => acc + (item.components?.length || 0), 0)} ITEMS</span>
                </div>
                <p className="text-xs text-slate-400">Manufacturing breakdown of intermediate components</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-rose-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Sub Assembly Item Code</th>
                    <th className="px-4 py-3 font-medium">Target Warehouse</th>
                    <th className="px-4 py-3 font-medium">Scheduled Date</th>
                    <th className="px-4 py-3 font-medium text-center">Required Qty</th>
                    <th className="px-4 py-3 font-medium">Bom No</th>
                    <th className="px-4 py-3 font-medium">Raw Materials</th>
                    <th className="px-4 py-3 font-medium text-center">Manufacturing Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newPlan.items.flatMap(item => (item.components || []).map(comp => ({ ...comp, parentPlannedQty: item.plannedQty || 1 }))).map((comp, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-rose-50 rounded flex items-center justify-center text-rose-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{comp.component_code}</div>
                            <div className="text-[10px] text-slate-400">{comp.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs font-medium">Work In Progress - NC</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-xs font-medium">2026-02-04</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="font-bold text-rose-600">{(comp.quantity * comp.parentPlannedQty).toFixed(0)}</div>
                        <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">NOS</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-rose-600 text-[10px] font-bold rounded border border-slate-100">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {comp.bom_no || 'BOM-SUB-' + idx}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {comp.materials?.map((mat, mIdx) => (
                            <div key={mIdx} className="flex items-center gap-2 text-[10px]">
                              <span className="w-1 h-1 bg-amber-400 rounded-full"></span>
                              <span className="font-medium text-slate-700">{mat.material_name}:</span>
                              <span className="text-slate-500">{(mat.qty_per_pc * comp.quantity * comp.parentPlannedQty).toFixed(3)} {mat.uom}</span>
                            </div>
                          ))}
                          {(!comp.materials || comp.materials.length === 0) && (
                            <span className="text-[10px] text-slate-400 italic">No direct materials</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-full border border-rose-100">In House</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Section 03: Materials */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-600">03</span>
                  <h2 className="text-base font-bold text-slate-800">Materials</h2>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full ml-2 uppercase tracking-tight">{totalMaterialCount} ITEMS</span>
                </div>
                <p className="text-xs text-slate-400">Consolidated material explosion across all levels</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-amber-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            {/* Core Materials */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Core Materials</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 font-medium">Item</th>
                      <th className="px-4 py-2 font-medium text-right">Required Qty</th>
                      <th className="px-4 py-2 font-medium">Warehouse</th>
                      <th className="px-4 py-2 font-medium">BOM Ref</th>
                      <th className="px-4 py-2 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {coreMaterials.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 text-xs">{mat.material_name}</div>
                          <div className="text-[10px] text-slate-400">{mat.description || 'Direct Material'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-amber-600">{mat.totalRequiredQty.toFixed(2)}</div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase">{mat.uom}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-slate-400 italic">
                            <svg className="w-4 h-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            <span className="text-[10px]">{mat.warehouse || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-indigo-600 text-[10px] font-bold rounded border border-slate-100">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {mat.bom_no}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-300">--</td>
                      </tr>
                    ))}
                    {coreMaterials.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic text-xs">No core materials required</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exploded Components */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                <h3 className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Exploded Components</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 font-medium">Component Specification</th>
                      <th className="px-4 py-2 font-medium text-right">Required Qty</th>
                      <th className="px-4 py-2 font-medium">Source Assembly</th>
                      <th className="px-4 py-2 font-medium">BOM Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {explodedMaterials.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 text-xs uppercase tracking-tight">{mat.material_name}</div>
                          <div className="text-[10px] text-slate-400 italic font-medium">{mat.description || 'Raw Material'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-rose-600">{mat.totalRequiredQty.toFixed(2)}</div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase">{mat.uom}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 text-[9px] font-bold rounded-lg border border-rose-100">
                            <svg className="w-3 h-3 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            {mat.source_assembly}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-indigo-600 text-[10px] font-bold rounded border border-slate-100">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {mat.bom_no}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {explodedMaterials.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-slate-400 italic text-xs">No exploded components available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </Card>

        {/* Section 05: Operations */}
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-indigo-600">05</span>
                  <h2 className="text-base font-bold text-slate-800">Operations</h2>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full ml-2 uppercase tracking-tight">{newPlan.items.reduce((acc, item) => acc + (item.operations?.length || 0), 0)} OPERATIONS</span>
                </div>
                <p className="text-xs text-slate-400">Sequential manufacturing steps and workstation routing</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Step</th>
                    <th className="px-4 py-3 font-medium">Operation Name</th>
                    <th className="px-4 py-3 font-medium">Workstation</th>
                    <th className="px-4 py-3 font-medium text-center">Base Time</th>
                    <th className="px-4 py-3 font-medium">Source Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newPlan.items.flatMap(item => (item.operations || []).map(op => ({ ...op, itemCode: item.itemCode }))).map((op, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 font-medium">0{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800 text-xs">{op.operation_name}</div>
                        <div className="text-[10px] text-slate-400">Standard manufacturing process</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs font-medium">{op.workstation || 'General Workstation'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="font-bold text-indigo-600">{op.base_hour || '1.0'}</div>
                        <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">HRS</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-indigo-600 text-[10px] font-bold rounded border border-slate-100">
                          {op.itemCode}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!newPlan.items.some(item => item.operations?.length > 0)) && (
                    <tr>
                      <td colSpan="5" className="px-4 py-12 text-center text-slate-400 italic text-sm">
                        No operations defined for the selected items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-8 ml-64">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Plan Status</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">draft</span>
                <span className="text-xs font-bold text-slate-400 tracking-tight">Draft</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">Materials</span>
              <span className="text-xs font-bold text-slate-800 tracking-tight">{totalMaterialCount} Items Calculated</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mr-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 text-xs font-bold transition-all border border-emerald-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Work Orders
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-xs font-bold transition-all border border-indigo-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Material Request
            </button>
            <button 
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-xs font-bold transition-all shadow-lg shadow-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Save Strategic Plan
            </button>
          </div>
        </div>
      </div>
    );
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
        setIsCreating(false);
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

  if (isCreating) {
    return renderCreateForm();
  }

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
};

export default ProductionPlan;

