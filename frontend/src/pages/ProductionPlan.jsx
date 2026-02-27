import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  Eye, BarChart2, Settings, Send, Edit2, FileText, Trash2, 
  Search, Filter, Plus, Zap, CheckCircle2, FileJson, 
  MoreVertical, Activity, Layers, Target, Clock, AlertCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProductionPlan = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [activeTab, setActiveTab] = useState('Basic Info');
  const [readyItems, setReadyItems] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [nextPlanCode, setNextPlanCode] = useState('');
  const [productionReadyOrders, setProductionReadyOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [designOrderItems, setDesignOrderItems] = useState([]);
  const [availableBoms, setAvailableBoms] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [mrModalOpen, setMrModalOpen] = useState(false);
  const [mrItems, setMrItems] = useState([]);
  const [mrPlanDetails, setMrPlanDetails] = useState(null);
  const [transmittingMr, setTransmittingMr] = useState(false);

  const [newPlan, setNewPlan] = useState({
    planCode: '',
    planDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    remarks: '',
    namingSeries: 'PP',
    operationalStatus: 'Draft',
    targetQuantity: 0,
    items: []
  });

  useEffect(() => {
    fetchPlans();
    fetchWorkstations();
  }, []);

  // Sync item quantities with header target quantity
  useEffect(() => {
    if (newPlan.targetQuantity > 0) {
      setNewPlan(prev => ({
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          plannedQty: prev.targetQuantity
        }))
      }));
    }
  }, [newPlan.targetQuantity]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
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

  const handleDeletePlan = async (id) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Production Plan?',
        text: "This action cannot be undone and will delete all associated data.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        background: '#ffffff',
        customClass: {
          title: 'text-lg  text-slate-900',
          content: 'text-sm text-slate-600',
          confirmButton: 'p-2  text-xs   ',
          cancelButton: 'p-2  text-xs   '
        }
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/production-plans/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast('Plan deleted successfully');
          fetchPlans();
        } else {
          const error = await response.json();
          errorToast(error.message || 'Failed to delete plan');
        }
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      errorToast('An unexpected error occurred');
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

  const handleCreateWorkOrders = async (planId) => {
    try {
      const result = await Swal.fire({
        title: 'Create Work Orders?',
        text: "This will generate work orders for all finished goods and sub-assemblies in this plan.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, create them!',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/work-orders/create-from-plan/${planId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          successToast(data.message || 'Work orders created successfully');
          
          // Navigate to the work order list
          navigate('/work-order');
        } else {
          const error = await response.json();
          errorToast(error.error || 'Failed to create work orders');
        }
      }
    } catch (error) {
      console.error('Error creating work orders:', error);
      errorToast('An unexpected error occurred');
    }
  };

  const handleTransmitMR = async (planId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/material-request-items/${planId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMrItems(data.items || []);
        setMrPlanDetails({
          id: planId,
          planCode: data.plan_code,
          startDate: data.start_date
        });
        setMrModalOpen(true);
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to fetch items for Material Request');
      }
    } catch (error) {
      console.error('Error fetching MR items:', error);
      errorToast('Failed to load items for transmission');
    } finally {
      setLoading(false);
    }
  };

  const confirmTransmitMR = async () => {
    if (!mrPlanDetails) return;
    
    try {
      setTransmittingMr(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/transmit-mr/${mrPlanDetails.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        successToast(data.message || 'Material Request created successfully');
        setMrModalOpen(false);
        fetchPlans();
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to transmit Material Request');
      }
    } catch (error) {
      console.error('Error transmitting MR:', error);
      errorToast('An unexpected error occurred');
    } finally {
      setTransmittingMr(false);
    }
  };

  const handleCreateNew = () => {
    fetchReadyItems();
    fetchReadyOrders();
    fetchNextCode();
    setSelectedOrderId('');
    setSelectedOrderDetails(null);
    setDesignOrderItems([]);
    setAvailableBoms([]);
    setSelectedBomId('');
    setIsViewing(false);
    setNewPlan({
      planCode: '',
      planDate: new Date().toISOString().split('T')[0],
      startDate: '',
      endDate: '',
      remarks: '',
      namingSeries: 'PP',
      operationalStatus: 'Draft',
      targetQuantity: 0,
      items: []
    });
    setIsCreating(true);
  };

  const handleViewPlan = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        
        // Fetch BOM details for each item to support explosion in UI
        const itemsWithBom = await Promise.all(data.items.map(async item => {
          let bomDetails = { materials: [], components: [], operations: [] };
          try {
            const bomResp = await fetch(`${API_BASE}/production-plans/item-bom/${item.sales_order_item_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (bomResp.ok) {
              bomDetails = await bomResp.json();
            }
          } catch (_e) {
            console.error('Error fetching BOM for item:', item.item_code);
          }

          return {
            salesOrderId: item.sales_order_id,
            salesOrderItemId: item.sales_order_item_id,
            projectName: item.project_name,
            orderNo: item.order_no,
            itemCode: item.item_code,
            description: item.description,
            plannedQty: item.planned_qty,
            totalQty: item.design_qty,
            designQty: item.design_qty,
            alreadyPlannedQty: 0,
            workstationId: item.workstation_id,
            plannedStartDate: item.planned_start_date,
            plannedEndDate: item.planned_end_date,
            materials: bomDetails.materials || [],
            components: bomDetails.components || [],
            operations: bomDetails.operations || []
          };
        }));

        setNewPlan({
          id: data.id,
          planCode: data.plan_code,
          planDate: data.plan_date?.split('T')[0],
          startDate: data.start_date?.split('T')[0],
          endDate: data.end_date?.split('T')[0],
          remarks: data.remarks || '',
          namingSeries: data.naming_series || 'PP',
          operationalStatus: data.status,
          targetQuantity: data.target_qty,
          items: itemsWithBom,
          subAssemblies: data.subAssemblies,
          materials: data.materials,
          operations: data.operations
        });
        
        setSelectedOrderId(data.sales_order_id?.toString() || '');
        setSelectedBomId(data.bom_no?.toString() || '');

        if (data.items && data.items.length > 0) {
          const boms = data.items.map(item => ({
            id: item.sales_order_item_id,
            item_code: item.item_code,
            description: item.description
          }));
          setAvailableBoms(boms);
        }

        setIsViewing(true);
        setIsCreating(true);
      }
    } catch (error) {
      console.error('Error fetching plan details:', error);
      errorToast('Failed to fetch plan details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        
        // Fetch BOM details for each item to support explosion in UI
        const itemsWithBom = await Promise.all(data.items.map(async item => {
          let bomDetails = { materials: [], components: [], operations: [] };
          try {
            const bomResp = await fetch(`${API_BASE}/production-plans/item-bom/${item.sales_order_item_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (bomResp.ok) {
              bomDetails = await bomResp.json();
            }
          } catch (_e) {
            console.error('Error fetching BOM for item:', item.item_code);
          }

          return {
            salesOrderId: item.sales_order_id,
            salesOrderItemId: item.sales_order_item_id,
            projectName: item.project_name,
            orderNo: item.order_no,
            itemCode: item.item_code,
            description: item.description,
            plannedQty: item.planned_qty,
            totalQty: item.design_qty,
            designQty: item.design_qty,
            alreadyPlannedQty: 0,
            workstationId: item.workstation_id,
            plannedStartDate: item.planned_start_date,
            plannedEndDate: item.planned_end_date,
            materials: bomDetails.materials || [],
            components: bomDetails.components || [],
            operations: bomDetails.operations || []
          };
        }));

        setNewPlan({
          id: data.id,
          planCode: data.plan_code,
          planDate: data.plan_date?.split('T')[0],
          startDate: data.start_date?.split('T')[0],
          endDate: data.end_date?.split('T')[0],
          remarks: data.remarks || '',
          namingSeries: data.naming_series || 'PP',
          operationalStatus: data.status,
          targetQuantity: data.target_qty,
          items: itemsWithBom,
          subAssemblies: data.subAssemblies,
          materials: data.materials,
          operations: data.operations
        });
        
        setSelectedOrderId(data.sales_order_id?.toString() || '');
        setSelectedBomId(data.bom_no?.toString() || '');
        setIsViewing(false);
        setIsCreating(true);
      }
    } catch (error) {
      console.error('Error fetching plan details:', error);
      errorToast('Failed to fetch plan details');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelect = async (orderId) => {
    setSelectedOrderId(orderId);
    setSelectedBomId('');
    setAvailableBoms([]);
    setDesignOrderItems([]);
    setIsViewing(false);
    
    if (!orderId) {
      setSelectedOrderDetails(null);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      // Fetch Design Order Items
      let designData = [];
      const designResp = await fetch(`${API_BASE}/design-orders/by-sales-order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (designResp.ok) {
        designData = await designResp.json();
        setDesignOrderItems(designData);
      }

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
          handleBomSelect(singleBomId, boms, designData);
        }
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
      errorToast('Failed to fetch sales order details');
    }
  };

  const handleBomSelect = (bomId, itemsOverride = null, designItemsOverride = null) => {
    setSelectedBomId(bomId);
    setIsViewing(false);
    if (!bomId) {
      setNewPlan(prev => ({ ...prev, items: [] }));
      return;
    }

    // When a BOM is selected, find the item in designOrderItems or selectedOrderDetails and select it
    // The user wants STRICT behavior: only this item should be in the plan
    const itemsToSearch = itemsOverride || selectedOrderDetails?.items || readyItems;
    const itemInReady = itemsToSearch.find(item => (item.id || item.sales_order_item_id).toString() === bomId.toString());
    
    if (itemInReady) {
      const designItemsToSearch = designItemsOverride || designOrderItems;
      // Find matching design order item to get quantity
      const designItem = designItemsToSearch.find(d => 
        String(d.item_code).trim() === String(itemInReady.item_code).trim() && 
        (String(d.drawing_no || '').trim() === String(itemInReady.drawing_no || '').trim())
      );
      
      const designQty = designItem ? parseFloat(designItem.qty || 0) : parseFloat(itemInReady.total_qty || itemInReady.quantity || 1);

      // Clear existing items and only add this one
      const salesOrderItemId = itemInReady.id || itemInReady.sales_order_item_id;
      const orderNo = itemInReady.order_no || selectedOrderDetails?.order_no;
      const projectName = itemInReady.project_name || selectedOrderDetails?.project_name;
      
      const fetchAndSetItem = async () => {
        let bomDetails = { materials: [], components: [], operations: [] };
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_BASE}/production-plans/item-bom/${salesOrderItemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data) {
              bomDetails = data;
            }
          }
        } catch (error) {
          console.error('Error fetching BOM details:', error);
        }

        setNewPlan(prev => ({
          ...prev,
          targetQuantity: designQty,
          items: [{
            salesOrderId: itemInReady.sales_order_id,
            salesOrderItemId: salesOrderItemId,
            projectName: projectName,
            orderNo: orderNo,
            itemCode: itemInReady.item_code,
            description: itemInReady.description,
            plannedQty: designQty,
            totalQty: parseFloat(itemInReady.total_qty || itemInReady.quantity || 0),
            designQty: designQty,
            alreadyPlannedQty: parseFloat(itemInReady.already_planned_qty || 0),
            bom_no: itemInReady.drawing_no || itemInReady.bom_no || 'BOM-' + (salesOrderItemId || 'REF'),
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

  const toggleItemSelection = async (item, designItemsOverride = null) => {
    const itemsToUse = designItemsOverride || designOrderItems;
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

      // Find matching design order item to get quantity
      const designItem = itemsToUse.find(d => 
        String(d.item_code).trim() === String(item.item_code).trim() && 
        (String(d.drawing_no || '').trim() === String(item.drawing_no || '').trim())
      );
      
      const designQty = designItem ? parseFloat(designItem.qty || 0) : parseFloat(item.total_qty || item.quantity || 1);

      setNewPlan(prev => ({
        ...prev,
        targetQuantity: designQty,
        items: [...prev.items, {
          salesOrderId: item.sales_order_id,
          salesOrderItemId: salesOrderItemId,
          projectName: item.project_name,
          orderNo: item.order_no,
          itemCode: item.item_code,
          description: item.description,
          plannedQty: designQty,
          totalQty: parseFloat(item.total_qty || item.quantity || 0),
          designQty: designQty,
          alreadyPlannedQty: parseFloat(item.already_planned_qty || 0),
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

  const calculatePlanDetails = () => {
    // Collect all materials from all items (already exploded from backend)
    const allMaterials = newPlan.items.flatMap(item => 
      (item.materials || []).map(mat => {
        // The backend returns required_qty per unit if called with multiplier 1
        const baseQty = parseFloat(mat.required_qty || mat.qty_per_pc || 0);
        return {
          ...mat,
          totalDesignQty: newPlan.targetQuantity || 0,
          totalPlannedQty: baseQty * (newPlan.targetQuantity || 1),
          bom_no: mat.bom_no || mat.bom_ref || item.bom_no || 'BOM-REF',
          source_fg: item.itemCode
        };
      })
    );

    // Filter by category for display sections
    const coreMaterials = allMaterials.filter(m => m.material_category === 'CORE');
    const explodedMaterials = allMaterials.filter(m => m.material_category === 'EXPLODED');

    const subAssembliesToDisplay = isViewing 
      ? (newPlan.subAssemblies || []) 
      : newPlan.items.flatMap(item => (item.components || []).map(comp => {
          const baseQty = parseFloat(comp.quantity || 0);
          const totalQty = baseQty * (newPlan.targetQuantity || 1);
          return {
            ...comp,
            itemCode: comp.item_code || comp.component_code,
            bomNo: comp.bom_no || 'BOM-SUB',
            designQty: newPlan.targetQuantity || 0,
            plannedQty: totalQty,
            parentDesignQty: newPlan.targetQuantity || 1,
            parentPlannedQty: newPlan.targetQuantity || 1,
            requiredQty: totalQty,
            source_fg: item.itemCode
          };
        }));

    const operationsToDisplay = isViewing 
      ? (newPlan.operations || []).map(op => ({
          ...op,
          operation_name: op.operation_name || op.name,
          workstation: op.workstation || op.workstation_name,
          base_hour: op.base_hour ?? op.base_time ?? op.cycle_time_min ?? 0,
          itemCode: op.itemCode || op.source_item
        }))
      : newPlan.items.flatMap(item => (item.operations || []).map(op => ({ 
          ...op, 
          itemCode: op.source_item || op.itemCode || item.itemCode || item.item_code,
          operation_name: op.operation_name || op.name,
          workstation: op.workstation || op.workstation_name,
          base_hour: op.base_hour ?? op.base_time ?? op.cycle_time_min ?? 0,
          source_fg: item.itemCode
        })));

    const materialsToDisplay = isViewing ? (newPlan.materials || []) : allMaterials;

    return { 
      materialsToDisplay, 
      subAssembliesToDisplay, 
      operationsToDisplay,
      coreMaterials,
      explodedMaterials,
      totalMaterialCount: materialsToDisplay.length
    };
  };

  const renderCreateForm = () => {
    const { 
      materialsToDisplay, 
      subAssembliesToDisplay, 
      operationsToDisplay,
      coreMaterials,
      explodedMaterials
    } = calculatePlanDetails();

    const totalMaterialCount = materialsToDisplay.length;
    
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
        {/* Header Section */}
        <div className="flex items-center justify-between bg-white p-4 rounded  border border-slate-200  sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-100 rounded  transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2 ">
                <span className="text-xs  text-slate-400">PP /</span>
                <h1 className="text-lg font-semibold text-slate-900">{isViewing ? `VIEW PLAN: ${newPlan.planCode}` : 'NEW PRODUCTION PLAN'}</h1>
              </div>
              <span className="p-1  bg-slate-100 text-slate-600text-xs   rounded capitalize">{isViewing ? newPlan.operationalStatus : 'draft'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCreating(false)}
              className="p-2  text-slate-600 hover:bg-slate-50 text-sm  transition-colors"
            >
              {isViewing ? 'Close' : 'Discard Changes'}
            </button>
            {!isViewing && (
              <button 
                onClick={handleSubmit}
                className="p-2  bg-slate-900 text-white rounded  hover:bg-slate-800 text-sm  transition-colors "
              >
                Save Strategic Plan
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2  border-b border-slate-200 pb-px">
          {['Basic Info', 'Finished Goods', 'Materials', 'Sub Assemblies'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm  transition-all relative ${
                activeTab === tab 
                  ? 'text-indigo-600' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 ">
                {tab}
                {(tab === 'Sub Assemblies' || tab === 'Materials') && (
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded "></span>
                )}
              </div>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded " />
              )}
            </button>
          ))}
          <div className="ml-auto flex gap-3">
            {isViewing && newPlan.operationalStatus !== 'Completed' && (
              <button 
                onClick={() => handleCreateWorkOrders(newPlan.id)}
                className="flex items-center gap-2  p-2  bg-indigo-600 text-white rounded  hover:bg-indigo-700 text-xs font-semibold transition-colors "
              >
                <Plus className="w-4 h-4" />
                Work Orders
              </button>
            )}
            <button className="flex items-center gap-2  p-2  bg-rose-500 text-white rounded  hover:bg-rose-600 text-xs font-semibold transition-colors ">
              Production Progress
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            </button>
          </div>
        </div>

        {/* Section 01: Strategic Parameters */}
        <Card className="bg-white border border-slate-200  rounded  overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 ">
                  <span className="text-sm  text-indigo-600">01</span>
                  <h2 className="text-base  text-slate-800">STRATEGIC PARAMETERS</h2>
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
                  className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm text-slate-500  cursor-not-allowed"
                />
              </FormControl>
              <FormControl label="Naming Series">
                <input 
                  type="text" 
                  value={newPlan.namingSeries} 
                  onChange={(e) => setNewPlan(prev => ({ ...prev, namingSeries: e.target.value }))}
                  disabled={isViewing}
                  className={`w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${isViewing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                />
              </FormControl>
              <FormControl label="Operational Status">
                <select 
                  value={newPlan.operationalStatus}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, operationalStatus: e.target.value }))}
                  disabled={isViewing}
                  className={`w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none ${isViewing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
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
                    disabled={isViewing}
                  />
                  {selectedOrderId && !isViewing && (
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
                    className={`w-full p-2 .5 bg-white border border-slate-200 rounded  text-sm  focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none ${isViewing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={selectedBomId}
                    onChange={(e) => handleBomSelect(e.target.value)}
                    disabled={isViewing}
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
                    className="flex-1 p-2 .5 bg-slate-50 border border-slate-200 rounded-l-lg text-sm  focus:outline-none cursor-not-allowed transition-all"
                    readOnly
                  />
                  <span className="p-2 .5 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg text-xs font-semibold text-slate-400">UNIT</span>
                </div>
                <p className="text-[10px] text-indigo-600 mt-1 ">Quantity fetched from Design Order</p>
              </FormControl>
            </div>
          </div>
        </Card>

        {/* Section 02: Finished Goods */}
        <Card className="bg-white border border-slate-200  rounded  overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded  flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 ">
                  <span className="text-sm  text-blue-600">02</span>
                  <h2 className="text-base  text-slate-800">Finished Goods</h2>
                  <span className="p-1  bg-blue-50 text-blue-600text-xs   rounded  ml-2  tracking-tight">{newPlan.items.length} ITEMS</span>
                </div>
                <p className="text-xs text-slate-400">Finished goods and target fulfillment</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded ">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="text-lefttext-xs   text-slate-400  ">
                    <th className="p-2  ">No.</th>
                    <th className="p-2  ">Item Code</th>
                    <th className="p-2   text-center">BOM No</th>
                    <th className="p-2   text-center">Design Qty</th>
                    <th className="p-2   text-center">Planned Qty</th>
                    <th className="p-2   text-center">UOM</th>
                    <th className="p-2  ">Finished Goods Warehouse</th>
                    <th className="p-2  ">Planned Start Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newPlan.items.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 ">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-blue-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                          </div>
                          <div>
                            <div className=" text-slate-800 text-xs">{item.itemCode}</div>
                            <div className="text-[10px] text-slate-400">{item.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-indigo-600text-xs   rounded-md border border-slate-100">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {item.bom_no || 'BOM-' + (item.salesOrderItemId || 'REF')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center  text-slate-700">
                        {Number(item.designQty || item.totalQty || item.quantity || 0).toFixed(3)}
                      </td>
                      <td className="px-4 py-4 text-center  text-indigo-600">{item.plannedQty}</td>
                      <td className="px-4 py-4 text-center text-slate-400 text-xs">Nos</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2  text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs ">Finished Goods - NC</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2  text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-xs ">{item.plannedStartDate || '2026-02-04'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {newPlan.items.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-4 p-2 text-center text-slate-400 italic text-sm">
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
        <Card className="bg-white border border-slate-200  rounded  overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded  flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 ">
                  <span className="text-sm  text-rose-600">04</span>
                  <h2 className="text-base  text-slate-800">Sub Assemblies</h2>
                  <span className="p-1  bg-rose-50 text-rose-600text-xs   rounded  ml-2  tracking-tight">{subAssembliesToDisplay.length} ITEMS</span>
                </div>
                <p className="text-xs text-slate-400">Manufacturing breakdown of intermediate components</p>
                <p className="text-[10px] text-rose-600 mt-1   tracking-tight">Target Quantity: {newPlan.targetQuantity} UNIT (Quantity fetched from Design Order)</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-rose-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded ">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="text-lefttext-xs   text-slate-400  ">
                    <th className="p-2  ">No.</th>
                    <th className="p-2  ">Sub Assembly Item Code</th>
                    <th className="p-2  ">Target Warehouse</th>
                    <th className="p-2  ">Scheduled Date</th>
                    <th className="p-2   text-center">Design Qty</th>
                    <th className="p-2   text-center">Planned Qty</th>
                    <th className="p-2  ">Bom No</th>
                    <th className="p-2  ">Source FG</th>
                    <th className="p-2   text-center">Manufacturing Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subAssembliesToDisplay.map((sa, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 ">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-rose-50 rounded flex items-center justify-center text-rose-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          </div>
                          <div>
                            <div className=" text-slate-800 text-xs">{sa.itemCode || sa.item_code}</div>
                            <div className="text-[10px] text-slate-400">{sa.description || 'Sub-Assembly'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2  text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs ">{sa.targetWarehouse || sa.target_warehouse || 'Work In Progress - NC'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2  text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                          <span className="text-xs ">{isViewing ? (sa.scheduled_date ? sa.scheduled_date.split('T')[0] : '-') : '2026-02-04'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center  text-slate-700">
                        {Number(isViewing ? (sa.design_qty || sa.required_qty) : (sa.designQty || 0)).toFixed(3)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className=" text-rose-600">{Number(isViewing ? sa.required_qty : (sa.plannedQty || 0)).toFixed(3)}</div>
                        <div className="text-[8px] text-slate-400   tracking-tighter">NOS</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 p-1  bg-slate-50 text-rose-600text-xs   rounded border border-slate-100">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {sa.bomNo || sa.bom_no}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[10px] text-slate-500 ">
                          {sa.sourceFg || sa.source_fg || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="p-1  bg-rose-50 text-rose-600text-xs   rounded  border border-rose-100">{sa.manufacturingType || sa.manufacturing_type || 'In House'}</span>
                      </td>
                    </tr>
                  ))}
                  {subAssembliesToDisplay.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-4 p-2 text-center text-slate-400 italic text-sm">
                        No sub assemblies required.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Section 03: Materials */}
        <Card className="bg-white border border-slate-200  rounded  overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded  flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 ">
                  <span className="text-sm  text-amber-600">03</span>
                  <h2 className="text-base  text-slate-800">Materials</h2>
                  <span className="p-1  bg-amber-50 text-amber-600text-xs   rounded  ml-2  tracking-tight">{totalMaterialCount} ITEMS</span>
                </div>
                <p className="text-xs text-slate-400">Consolidated material explosion across all levels</p>
                <p className="text-[10px] text-amber-600 mt-1   tracking-tight">Target Quantity: {newPlan.targetQuantity} UNIT (Quantity fetched from Design Order)</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-amber-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            {/* Core Materials */}
            <div className="mb-8">
              <div className="flex items-center gap-2  mb-4">
                <div className="w-2 h-2 bg-amber-500 rounded "></div>
                <h3 className="text-[10px]  text-amber-600  tracking-widest">Core Materials</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-lefttext-xs  text-slate-400   border-b border-slate-100">
                    <tr>
                      <th className="p-2  ">Item</th>
                      <th className="p-2   text-right">Design Qty</th>
                      <th className="p-2   text-right">Planned Qty</th>
                      <th className="p-2  ">Warehouse</th>
                      <th className="p-2  ">BOM Ref</th>
                      <th className="p-2   text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(isViewing ? materialsToDisplay.filter(m => m.material_category === 'CORE') : coreMaterials).map((mat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2 ">
                          <div className=" text-slate-800 text-xs">{mat.material_name}</div>
                          <div className="text-[10px] text-slate-400">{mat.description || 'Direct Material'}</div>
                        </td>
                        <td className="p-2  text-right  text-slate-700">
                          {Number(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(3)}
                        </td>
                        <td className="p-2  text-right">
                          <div className=" text-amber-600">
                            {Number(isViewing ? mat.required_qty : mat.totalPlannedQty).toFixed(3)}
                          </div>
                          <div className="text-[9px] text-slate-400  ">{isViewing ? mat.uom : mat.unit}</div>
                        </td>
                        <td className="p-2 ">
                          <div className="text-xs text-slate-600 ">{mat.warehouse || 'Store - NC'}</div>
                        </td>
                        <td className="p-2 ">
                          <span className="text-[10px] text-slate-400 ">{isViewing ? mat.bom_ref : mat.bom_no}</span>
                        </td>
                        <td className="p-2  text-center">
                          <span className={`p-1 rounded text-[10px] font-black tracking-tighter border
                            ${mat.status === 'FULFILLED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                              mat.status === 'SUBMITTED' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                              'bg-slate-100 text-slate-500 border-slate-200'}`}
                          >
                            {isViewing ? (mat.status === 'FULFILLED' ? '✅ FULFILLED' : mat.status) : '--'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(isViewing ? materialsToDisplay.filter(m => m.material_category === 'CORE') : coreMaterials).length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic text-xs">No core materials required</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>



          </div>
        </Card>

        {/* Section 05: Operations (Hidden) */}
        {/*
        <Card className="bg-white border border-slate-200  rounded  overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 ">
                  <span className="text-sm  text-indigo-600">05</span>
                  <h2 className="text-base  text-slate-800">Operations</h2>
                  <span className="p-1  bg-indigo-50 text-indigo-600text-xs   rounded  ml-2  tracking-tight">{operationsToDisplay.length} OPERATIONS</span>
                </div>
                <p className="text-xs text-slate-400">Sequential manufacturing steps and workstation routing</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded ">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50">
                  <tr className="text-lefttext-xs   text-slate-400  ">
                    <th className="p-2  ">Step</th>
                    <th className="p-2  ">Operation Name</th>
                    <th className="p-2  ">Workstation</th>
                    <th className="p-2   text-center">Base Time</th>
                    <th className="p-2  ">Source Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operationsToDisplay.map((op, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 ">0{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className=" text-slate-800 text-xs">{op.operation_name}</div>
                        <div className="text-[10px] text-slate-400">Standard manufacturing process</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2  text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs ">{op.workstation || 'General Workstation'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className=" text-indigo-600">{op.base_hour || '1.0'}</div>
                        <div className="text-[8px] text-slate-400   tracking-tighter">HRS</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 p-1  bg-slate-50 text-indigo-600text-xs   rounded border border-slate-100">
                          {op.itemCode || op.source_item}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!newPlan.items.some(item => item.operations?.length > 0)) && (
                    <tr>
                      <td colSpan="5" className="px-4 p-2 text-center text-slate-400 italic text-sm">
                        No operations defined for the selected items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
        */}

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-8 ml-64">
            <div>
              <span className="text-[10px] text-slate-400   tracking-widest block mb-0.5">Plan Status</span>
              <div className="flex items-center gap-2 ">
                <span className="p-1  bg-slate-100 text-slate-600text-xs   rounded">draft</span>
                <span className="text-xs  text-slate-400 tracking-tight">Draft</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <span className="text-[10px] text-slate-400   tracking-widest block mb-0.5">Materials</span>
              <span className="text-xs  text-slate-800 tracking-tight">{totalMaterialCount} Items Calculated</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mr-4">
            <button 
              onClick={() => handleCreateWorkOrders(newPlan.id)}
              className="flex items-center gap-2  p-2  bg-emerald-50 text-emerald-600 rounded  hover:bg-emerald-100 text-xs  transition-all border border-emerald-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Work Orders
            </button>
            <button className="flex items-center gap-2  p-2  bg-indigo-50 text-indigo-600 rounded  hover:bg-indigo-100 text-xs  transition-all border border-indigo-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Material Request
            </button>
            {!isViewing && (
              <button 
                onClick={handleSubmit}
                className="flex items-center gap-2  p-2 bg-slate-900 text-white rounded  hover:bg-slate-800 text-xs  transition-all shadow-lg shadow-slate-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                {newPlan.id ? 'Update Strategic Plan' : 'Save Strategic Plan'}
              </button>
            )}
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
      const today = new Date().toISOString().split('T')[0];
      
      // Calculate latest details to ensure sub-assemblies and materials are included
      const { 
        materialsToDisplay, 
        subAssembliesToDisplay, 
        operationsToDisplay 
      } = calculatePlanDetails();

      const payload = {
        ...newPlan,
        targetQty: newPlan.targetQuantity || 0,
        planDate: newPlan.planDate || today,
        startDate: newPlan.startDate || null,
        endDate: newPlan.endDate || null,
        salesOrderId: selectedOrderId,
        bomNo: selectedBomId,
        finishedGoods: newPlan.items.map(item => ({
          ...item,
          designQty: item.designQty || item.totalQty || item.quantity || 0,
          uom: item.uom || 'Nos',
          plannedStartDate: item.plannedStartDate || newPlan.startDate || today
        })),
        items: newPlan.items.map(item => ({
          ...item,
          designQty: item.designQty || item.totalQty || item.quantity || 0,
          uom: item.uom || 'Nos',
          plannedStartDate: item.plannedStartDate || newPlan.startDate || today
        })),
        subAssemblies: subAssembliesToDisplay.map(sa => ({
          ...sa,
          description: sa.description || sa.item_description || sa.item_name || null,
          designQty: newPlan.targetQuantity || 0,
          requiredQty: parseFloat(sa.quantity || 0) * (sa.parentPlannedQty || 1),
          bomNo: sa.bomNo || sa.bom_no || null,
          itemCode: sa.itemCode || sa.subAssemblyItemCode || null,
          scheduledDate: sa.scheduledDate || sa.scheduled_date || newPlan.startDate || today
        })),
        materials: materialsToDisplay.map(m => ({
          ...m,
          itemCode: m.material_code || m.item_code || m.item || null,
          materialName: m.material_name || m.item || null,
          designQty: newPlan.targetQuantity || 0,
          requiredQty: m.totalPlannedQty || m.required_qty || 0,
          bomRef: m.bom_ref || m.bom_no || null,
          sourceAssembly: m.source_assembly || null,
          category: m.material_category || null
        })),
        operations: operationsToDisplay.map((op, idx) => ({
          ...op,
          step: (idx + 1).toString().padStart(2, '0'),
          operationName: op.operation_name || null,
          baseTime: op.base_hour ?? op.baseTime ?? 0,
          sourceItem: op.itemCode || op.source_item || null
        }))
      };
      
      const url = newPlan.id 
        ? `${API_BASE}/production-plans/${newPlan.id}`
        : `${API_BASE}/production-plans`;
        
      const response = await fetch(url, {
        method: newPlan.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast(`Production plan ${newPlan.id ? 'updated' : 'created'} successfully`);
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
      render: (val) => <span className=" text-slate-900">{val}</span>
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
          className="text-indigo-600 hover:text-indigo-900  opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {/* View logic */}}
        >
          View
        </button>
      )
    }
  ];

  const filteredPlans = plans.filter(plan => 
    plan.plan_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.order_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isCreating) {
    return renderCreateForm();
  }

  return (
    <div className="p-1 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 text-white rounded  flex items-center justify-center shadow-lg shadow-slate-200">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl  text-slate-900 tracking-tight flex items-center gap-2 ">
              Production <span className="text-indigo-600">Intelligence</span>
            </h1>
            <div className="flex items-center gap-2  text-xs text-slate-400 ">
              <Activity className="w-3 h-3 text-indigo-500" />
              <span>Planning & Strategy Center</span>
              <span className="w-1 h-1 bg-slate-300 rounded " />
              <Clock className="w-3 h-3" />
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {/* Reset logic if needed */}}
            className="flex items-center gap-2  p-2  text-rose-600 hover:bg-rose-50 rounded  text-xs  transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Reset System
          </button>
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2  px-5 py-2.5 bg-slate-900 text-white rounded  hover:bg-slate-800 transition-all text-sm  shadow-xl shadow-slate-200"
          >
            <Plus className="w-4 h-4" />
            New Strategic Plan
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Active Strategies', value: plans.filter(p => p.status !== 'Draft').length, icon: Layers, color: 'indigo', sub: 'Total registered plans' },
          { label: 'Execution Phase', value: '0', icon: Zap, color: 'blue', sub: 'Plans in active production' },
          { label: 'Optimization Complete', value: '0', icon: CheckCircle2, color: 'emerald', sub: 'Successfully closed plans' },
          { label: 'Draft Formulation', value: plans.filter(p => p.status === 'Draft').length, icon: FileText, color: 'slate', sub: 'Pending validation' }
        ].map((stat, i) => (
          <Card key={i} className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-none bg-white  ring-1 ring-slate-100">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded  bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                </div>
              </div>
              <div>
                <div className="text-xs  text-slate-500   mb-1">{stat.label}</div>
                <div className="text-[10px] text-slate-400 ">{stat.sub}</div>
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-${stat.color}-500/10 group-hover:bg-${stat.color}-500 transition-colors`} />
          </Card>
        ))}
      </div>

      {/* Content Section */}
      <Card className="border-none  ring-1 ring-slate-100 bg-white rounded  overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm  text-slate-800 tracking-tight ">Strategy Pipeline</h2>
                <p className="text-[11px] text-slate-400 ">Manage and monitor manufacturing execution</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="SEARCH STRATEGIES..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded text-xs   tracking-widest text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none w-64 transition-all"
                />
              </div>
              <button className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded  border border-slate-100 transition-all">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-4text-xs   text-slate-400  tracking-widest px-2">Plan ID</th>
                  <th className="pb-4text-xs   text-slate-400  tracking-widest px-4">Origin & Status</th>
                  <th className="pb-4text-xs   text-slate-400  tracking-widest px-4">Timeline</th>
                  <th className="pb-4text-xs   text-slate-400  tracking-widest px-4">Production Progress</th>
                  <th className="pb-4text-xs   text-slate-400  tracking-widest px-4">Operations</th>
                  <th className="pb-4text-xs   text-slate-400  tracking-widest px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-2 text-center text-slate-400 text-xs italic ">Loading strategic intelligence...</td>
                  </tr>
                ) : filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-2 text-center text-slate-400 text-xs italic ">No plans matching search criteria</td>
                  </tr>
                ) : filteredPlans.map((plan) => (
                  <tr key={plan.id} className="group hover:bg-slate-50/50 transition-all duration-200">
                    <td className="py-5 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-900 text-white rounded  flex items-center justify-center shadow-md shadow-slate-200">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[11px] font-black text-slate-800 tracking-tight">{plan.plan_code}</div>
                          <div className="text-[10px] text-slate-400 ">
                            {plan.item_code ? `${plan.item_code} - ${plan.item_description}` : (plan.project_name || 'Global Manufacturing')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 ">
                          <div className="w-4 h-4 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
                            <Layers className="w-2.5 h-2.5" />
                          </div>
                          <span className="text-[10px]  text-slate-600">{plan.order_no || 'N/A'}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <span className={`p-1  rounded  text-[9px] font-black  tracking-tighter border flex items-center gap-1
                            ${plan.status === 'Draft' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                              plan.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                              'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
                          >
                            <span className={`w-1 h-1 rounded  ${plan.status === 'Draft' ? 'bg-amber-400' : plan.status === 'Completed' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                            {plan.status}
                          </span>
                          {plan.mr_status && (
                            <span className={`p-1 rounded text-[9px] font-black tracking-tighter border flex items-center gap-1
                              ${plan.mr_status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                plan.mr_status === 'DRAFT' ? 'bg-slate-50 text-slate-600 border-slate-100' : 
                                'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
                            >
                               {plan.mr_status === 'COMPLETED' ? '✅ FULFILLED' : `MR: ${plan.mr_status}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex items-center gap-2  group/time">
                        <div className="w-8 h-8 rounded  border border-slate-100 bg-white flex items-center justify-center text-slate-400 group-hover/time:border-indigo-100 group-hover/time:text-indigo-500 transition-colors">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px]  text-slate-600  tracking-tighter">
                            {plan.start_date ? new Date(plan.start_date).toLocaleDateString() : '-'}
                          </div>
                          <div className="text-[9px] text-slate-400 ">
                            {plan.wo_count > 0 ? `${plan.wo_count} Active Work Orders` : 'No work orders'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="w-48">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-black text-slate-400  tracking-widest">
                            {(() => {
                              const total = plan.total_ops || 0;
                              const woCount = plan.wo_count || 0;
                              const status = (plan.status || '').toUpperCase();
                              
                              if (total > 0) return 100;
                              if (woCount > 0) return 80;
                              if (status === 'COMPLETED') return 50;
                              return 0;
                            })()}% Complete
                          </span>
                          <span className="text-[9px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded  tracking-tighter">
                            {plan.completed_ops}/{plan.total_ops} OPS
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded  overflow-hidden p-0.5">
                          <div 
                            className="h-full bg-indigo-500 rounded  transition-all duration-500" 
                            style={{ 
                              width: `${(() => {
                                const total = plan.total_ops || 0;
                                const woCount = plan.wo_count || 0;
                                const status = (plan.status || '').toUpperCase();
                                
                                if (total > 0) return 100;
                                if (woCount > 0) return 80;
                                if (status === 'COMPLETED') return 50;
                                return 0;
                              })()}%` 
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          <span className="text-[9px] text-indigo-600   tracking-tighter">
                            {plan.wo_count > 0 ? `${plan.wo_count} Linked Orders` : 'No work orders'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex items-center -space-x-2">
                        <div className="w-8 h-8 rounded  border-2 border-white bg-indigo-50 flex items-center justify-center text-indigo-600text-xs  font-black  ring-1 ring-indigo-100 relative group/op">
                          {plan.total_ops}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[8px]  rounded opacity-0 group-hover/op:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Total Operations
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex items-center justify-end gap-1 transition-all duration-200">
                        <button 
                          onClick={() => handleViewPlan(plan.id)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" 
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" title="Analytics">
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" title="Settings">
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleTransmitMR(plan.id)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" 
                          title="Transmit"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditPlan(plan.id)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" 
                          title="Edit Strategy"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" title="Documents">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded  transition-all" 
                          title="Archive Strategy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Section */}
          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
            <div className="text-[10px]  text-slate-400  tracking-widest flex items-center gap-2 ">
              Showing {filteredPlans.length} of {plans.length} strategic formulations
            </div>
            <div className="flex items-center gap-2 ">
              <div className="w-2 h-2 bg-emerald-500 rounded  animate-pulse" />
              <span className="text-[10px] font-black text-slate-900  tracking-tighter">Neural Link Active</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Material Request Preview Modal */}
      <Modal
        isOpen={mrModalOpen}
        onClose={() => !transmittingMr && setMrModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Material Request</h2>
              <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold uppercase tracking-widest">
                <Activity className="w-3 h-3" />
                Resource Acquisition Phase
              </div>
            </div>
          </div>
        }
        size="4xl"
      >
        <div className="space-y-6">
          {/* MR Header Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Request Identifier</label>
              <div className="text-sm font-black text-slate-800">{mrPlanDetails?.planCode || '---'}</div>
            </div>
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Originating Dept</label>
              <div className="text-sm font-black text-slate-800">Production</div>
            </div>
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">SLA Target Date</label>
              <div className="text-sm font-black text-slate-800">
                {mrPlanDetails?.startDate ? new Date(mrPlanDetails.startDate).toLocaleDateString() : '---'}
              </div>
            </div>
          </div>

          {/* Tabs and Items Count */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex gap-6">
              <button className="flex items-center gap-2 pb-2 border-b-2 border-rose-500 text-rose-600">
                <span className="text-xs font-black">Pending Request</span>
                <span className="px-1.5 py-0.5 bg-rose-50 rounded text-[10px] font-black">
                  {mrItems.filter(item => !item.is_fulfilled && item.inventory < item.quantity).length}
                </span>
              </button>
              <button className="flex items-center gap-2 pb-2 text-slate-400 hover:text-slate-600">
                <span className="text-xs font-black">Complete Request</span>
                <span className="px-1.5 py-0.5 bg-slate-50 rounded text-[10px] font-black">
                  {mrItems.filter(item => item.is_fulfilled || item.inventory >= item.quantity).length}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
              <span className="text-[11px] font-black text-slate-700">Items to Request ({mrItems.length})</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Component Intelligence</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Required</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Inventory</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mrItems.map((item, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-4">
                      <div className="text-xs font-black text-slate-700">{item.material_name}</div>
                      <div className="text-[10px] text-slate-400">({item.item_code})</div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs font-black text-slate-800">{Number(item.quantity).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">{item.uom}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="text-xs font-black text-slate-800">{Number(item.inventory || 0).toFixed(2)}</div>
                    </td>
                    <td className="py-4 text-right">
                      {item.is_fulfilled || item.inventory >= item.quantity ? (
                        <div className="flex items-center justify-end gap-1.5 text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-tight">
                            {item.is_fulfilled ? 'Fulfilled' : 'In Stock'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 text-rose-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-tight">
                            {item.inventory <= 0 ? 'Zero Stock' : 'Shortage'}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              onClick={() => setMrModalOpen(false)}
              disabled={transmittingMr}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Abort Request
            </button>
            {mrItems.length > 0 && mrItems.some(item => !item.request_exists && item.inventory < item.quantity) && (
              <button
                onClick={confirmTransmitMR}
                disabled={transmittingMr}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-xs font-black shadow-lg shadow-slate-200 disabled:opacity-50"
              >
                {transmittingMr ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Transmitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Material Request
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductionPlan;

