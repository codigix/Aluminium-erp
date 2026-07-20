import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, Tabs, Button, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import ItemsMaster from './ItemsMaster.jsx';
import {
  Eye, BarChart2, Settings, Send, Edit2, FileText, Trash2,
  Search, Filter, Plus, Zap, CheckCircle2, FileJson,
  MoreVertical, Activity, Layers, Target, Clock, AlertCircle, X,
  ArrowLeft, Save, RefreshCw, Package
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProductionPlan = ({ salesOrderId: propSalesOrderId }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

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
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedPlanConfig, setSelectedPlanConfig] = useState(null);
  const [activeConfigTab, setActiveConfigTab] = useState('ops');
  const [initiatingProduction, setInitiatingProduction] = useState(false);
  const [mrItems, setMrItems] = useState([]);
  const [mrPlanDetails, setMrPlanDetails] = useState(null);
  const [transmittingMr, setTransmittingMr] = useState(false);
  const [allStockItems, setAllStockItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedNewItem, setSelectedNewItem] = useState(null);
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemDesignQty, setNewItemDesignQty] = useState('');
  const [newItemRemarks, setNewItemRemarks] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [itemSelectionModalOpen, setItemSelectionModalOpen] = useState(false);
  const [selectedMasterItem, setSelectedMasterItem] = useState(null);
  const [enterQtyModalOpen, setEnterQtyModalOpen] = useState(false);
  const [shapes, setShapes] = useState([]);
  const [newItemItemGroup, setNewItemItemGroup] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [newItemMaterialType, setNewItemMaterialType] = useState('');
  const [newItemShapeType, setNewItemShapeType] = useState('');
  const [newItemLength, setNewItemLength] = useState('');
  const [newItemWidth, setNewItemWidth] = useState('');
  const [newItemThickness, setNewItemThickness] = useState('');
  const [newItemDiameter, setNewItemDiameter] = useState('');
  const [newItemOuterDiameter, setNewItemOuterDiameter] = useState('');
  const [newItemRate, setNewItemRate] = useState('');
  const [itemGroups, setItemGroups] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [newItemMaterialId, setNewItemMaterialId] = useState('');
  const [newItemShapeId, setNewItemShapeId] = useState('');
  const [newItemDensity, setNewItemDensity] = useState(0);

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

  const isWeightBased = (uom) => {
    const u = (uom || '').toLowerCase();
    return u === 'kg' || u === 'kg.' || u === 'kilogram' || u === 'litre' || u === 'ltr' || u === 'meter' || u === 'mtr';
  };

  useEffect(() => {
    fetchPlans();
    fetchWorkstations();
    // Fetch shapes, groups, and materials for selector
    const fetchMasterData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        // 1. Shapes
        const shapesRes = await fetch(`${API_BASE}/shapes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (shapesRes.ok) {
          const shapesData = await shapesRes.json();
          setShapes(shapesData);
        }

        // 2. Groups
        const groupsRes = await fetch(`${API_BASE}/stock/groups`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          setItemGroups(groupsData);
        }

        // 3. Materials
        const materialsRes = await fetch(`${API_BASE}/materials`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          setMaterials(materialsData);
        }
      } catch (e) {
        console.error('Failed to fetch master data:', e);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    const sId = propSalesOrderId || location.state?.salesOrderId;
    if (sId) {
      handleCreateNew();
      handleOrderSelect(sId.toString());
    }
  }, [propSalesOrderId, location.state?.salesOrderId]);

  // Auto-calculate Weight per Unit for Material Request Item
  useEffect(() => {
    if (!newItemShapeType) return;
    const shape = newItemShapeType.toLowerCase();
    const density = parseFloat(newItemDensity) || 0;
    let calculatedWeight = 0;

    if (density > 0) {
      if (shape === 'plate') {
        const l = parseFloat(newItemLength) || 0;
        const w = parseFloat(newItemWidth) || 0;
        const t = parseFloat(newItemThickness) || 0;
        calculatedWeight = (l * w * t * density) / 1000000;
      } else if (shape === 'round') {
        const d = parseFloat(newItemDiameter) || 0;
        const l = parseFloat(newItemLength) || 0;
        calculatedWeight = (Math.PI * Math.pow(d, 2) / 4 * l * density) / 1000000;
      } else if (shape === 'pipe') {
        const od = parseFloat(newItemOuterDiameter) || 0;
        const t = parseFloat(newItemThickness) || 0;
        const l = parseFloat(newItemLength) || 0;
        const id = od - (2 * t);
        if (id >= 0) {
          calculatedWeight = (Math.PI * (Math.pow(od, 2) - Math.pow(id, 2)) / 4 * l * density) / 1000000;
        }
      } else if (shape.includes('square tube')) {
        const a = parseFloat(newItemWidth) || 0;
        const t = parseFloat(newItemThickness) || 0;
        const l = parseFloat(newItemLength) || 0;
        calculatedWeight = ((a * a - Math.pow(a - 2 * t, 2)) * l * density) / 1000000;
      } else if (shape.includes('rectangular tube')) {
        const b = parseFloat(newItemWidth) || 0;
        const h = parseFloat(newItemOuterDiameter) || 0;
        const t = parseFloat(newItemThickness) || 0;
        const l = parseFloat(newItemLength) || 0;
        calculatedWeight = ((b * h - (b - 2 * t) * (h - 2 * t)) * l * density) / 1000000;
      } else if (shape === 'hexagonal bar') {
        const af = parseFloat(newItemWidth) || 0;
        const l = parseFloat(newItemLength) || 0;
        calculatedWeight = ((Math.sqrt(3) / 2) * af * af * l * density) / 1000000;
      }
    }

    if (calculatedWeight > 0) {
      setNewItemWeight(parseFloat(calculatedWeight.toFixed(3)));
    }
  }, [
    newItemLength,
    newItemWidth,
    newItemThickness,
    newItemDiameter,
    newItemOuterDiameter,
    newItemDensity,
    newItemShapeType
  ]);

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

  useEffect(() => {
    const path = location.pathname;
    if (path.endsWith('/production-plan/new')) {
      if (!isCreating || isViewing) {
        initializeNewPlan();
      }
    } else if (path.includes('/production-plan/view/')) {
      const planId = path.split('/').pop();
      if (planId && (!isViewing || newPlan.id?.toString() !== planId)) {
        loadPlanDetails(planId);
      }
    } else if (path.includes('/production-plan/edit/')) {
      const planId = path.split('/').pop();
      if (planId && (isViewing || !isCreating || newPlan.id?.toString() !== planId)) {
        loadPlanForEdit(planId);
      }
    } else if (path.endsWith('/production-plan')) {
      if (isCreating || isViewing) {
        setIsCreating(false);
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
      }
    }
  }, [location.pathname]);

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
          title: 'text-md  text-slate-900',
          content: 'text-xs text-slate-600',
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

  const renderDimensions = (dims) => {
    const formatted = formatDimensions(dims);
    if (!formatted) return null;
    return (
      <div className="flex flex-wrap items-center gap-1 mt-0.5 text-xs text-slate-500">
        <span>{formatted}</span>
      </div>
    );
  };

  const handleOpenConfig = async (plan) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/${plan.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPlanConfig({ ...data, wo_count: plan.wo_count });
        setConfigModalOpen(true);
        setActiveConfigTab('ops');
      } else {
        errorToast('Failed to fetch plan configuration');
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      errorToast('Failed to load configuration details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkOrders = async (planId) => {
    try {
      const result = await Swal.fire({
        title: 'Create Work Orders?',
        text: "This will generate work orders for all assemblies and parts in this plan.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, create them!',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        setInitiatingProduction(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/work-orders/create-from-plan/${planId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          successToast(data.message || 'Work orders created successfully');
          setConfigModalOpen(false);
          // Navigate to the work order list
          navigate(`${deptPrefix}/work-order`);
        } else {
          const error = await response.json();
          errorToast(error.error || 'Failed to create work orders');
        }
      }
    } catch (error) {
      console.error('Error creating work orders:', error);
      errorToast('An unexpected error occurred');
    } finally {
      setInitiatingProduction(false);
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
        const items = data.items || [];
        const filtered = items.filter(item => {
          const code = (item.item_code || '').toUpperCase().trim();
          return !code.startsWith('ASSEMBLY');
        });
        setMrItems(filtered);
        setMrPlanDetails({
          id: planId,
          planCode: data.plan_code,
          startDate: data.start_date,
          mrId: data.mr_id,
          mrStatus: data.mr_status
        });
        setShowAddItem(false);
        setSelectedNewItem(null);
        setNewItemQty(1);
        setMrModalOpen(true);
        fetchAllStockItems();
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

      // Send all items that haven't been requested yet (including IN STOCK items for MR visibility)
      const itemsToRequest = mrItems
        .filter(item => !item.request_exists)
        .map(item => ({
          ...item,
          // If quantity is 0 (e.g. IN STOCK item added manually), fall back to design_qty or 1
          quantity: (Number(item.quantity) > 0)
            ? item.quantity
            : (Number(item.design_qty) > 0 ? item.design_qty : 1)
        }));

      if (itemsToRequest.length === 0) {
        errorToast('No new items found to request');
        return;
      }

      const response = await fetch(`${API_BASE}/production-plans/transmit-mr/${mrPlanDetails.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: itemsToRequest })
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

  const fetchAllStockItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance?includeAll=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllStockItems(data);
      }
    } catch (error) {
      console.error('Error fetching stock items:', error);
    }
  };

  const handleAddNewMrItem = () => {
    if (!selectedNewItem || newItemQty <= 0) return;

    // The stock API object uses item_name and item_code
    const itemCode = selectedNewItem.item_code;
    const itemName = selectedNewItem.item_name || selectedNewItem.material_name;

    // Build a dimension signature for the incoming item
    const incomingDimSig = [
      selectedNewItem.length || '',
      selectedNewItem.width || '',
      selectedNewItem.thickness || '',
      selectedNewItem.diameter || '',
      selectedNewItem.outer_diameter || ''
    ].join('|');

    // Allow same material code but different dimensions. Block only exact duplicates.
    const exists = mrItems.some(item => {
      if (item.item_code !== itemCode && item.material_name !== itemName) return false;
      const d = item.dimensions || {};
      const existingSig = [
        d.length || '',
        d.width || '',
        d.thickness || '',
        d.diameter || '',
        d.outer_diameter || ''
      ].join('|');
      return existingSig === incomingDimSig;
    });

    if (exists) {
      errorToast('This item with the same dimensions already exists in the request list');
      return;
    }

    // Assign a unique localId so deletion is always precise
    const newItem = {
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      item_code: itemCode,
      material_name: itemName,
      quantity: Number(newItemQty),
      design_qty: newItemDesignQty !== '' ? parseFloat(newItemDesignQty) : null,
      remarks: newItemRemarks || null,
      uom: newItemUnit || selectedNewItem.unit || selectedNewItem.uom || 'Nos',
      inventory: selectedNewItem.current_balance || 0,
      is_fulfilled: false,
      request_exists: false,
      is_manual: true,
      dimensions: {
        length: selectedNewItem.length,
        width: selectedNewItem.width,
        thickness: selectedNewItem.thickness,
        diameter: selectedNewItem.diameter,
        outer_diameter: selectedNewItem.outer_diameter
      }
    };

    setMrItems(prev => [...prev, newItem]);
    setShowAddItem(false);
    setSelectedNewItem(null);
    setNewItemQty(1);
    setNewItemDesignQty('');
    setNewItemRemarks('');
    setNewItemUnit('');
    successToast('Item added to material request');
  };

  const initializeNewPlan = () => {
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

  const loadPlanDetails = async (id) => {
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

        if (data.sales_order_id) {
          fetchOrderDetails(data.sales_order_id, data.bom_no?.toString());
        } else if (data.items && data.items.length > 0) {
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

  const loadPlanForEdit = async (id) => {
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
        if (data.sales_order_id) {
          fetchOrderDetails(data.sales_order_id, data.bom_no?.toString());
        }
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

  const handleEditPlan = (id) => {
    navigate(`${deptPrefix}/production-plan/edit/${id}`);
  };

  const handleCreateNew = () => {
    navigate(`${deptPrefix}/production-plan/new`);
  };

  const handleViewPlan = async (id) => {
    navigate(`${deptPrefix}/production-plan/view/${id}`);
  };

  const fetchOrderDetails = async (orderId, targetBomIdToSelect = null) => {
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
        // Filter to ensure we only show BOMs for this specific order and avoid duplicates by identity
        const rawItems = (data.items && data.items.length > 0) ? data.items : (designData || []);
        const seen = new Set();
        const filteredBoms = rawItems.filter(item => {
          if (!item) return false;

          // Ensure item belongs to the selected order (some fallback items might not)
          const itemOrderId = item.order_id || item.sales_order_id;
          if (itemOrderId && String(itemOrderId) !== String(orderId)) return false;

          // 1. Exclude Child Parts (parent_bom_id must be null or undefined)
          if (item.parent_bom_id !== null && item.parent_bom_id !== undefined) return false;

          // 2. Exclude "No Code" / placeholder BOMs (e.g. XXX, No Code, or null/empty item code)
          const code = (item.item_code || '').toUpperCase().trim();
          const desc = (item.description || '').toUpperCase().trim();
          if (!code || code === 'XXX' || code === 'NO CODE' || code.includes('NO CODE') || desc.includes('NO CODE') || code.startsWith('XXX-') || code.includes('NO_CODE')) return false;

          // 3. Prevent duplicate PART BOMs by keeping track of uniqueness
          const identityKey = `${code}-${(item.drawing_no || '').trim()}`;
          if (seen.has(identityKey)) return false;
          seen.add(identityKey);

          return true;
        });
        setAvailableBoms(filteredBoms);

        if (targetBomIdToSelect) {
          setSelectedBomId(targetBomIdToSelect);
          const itemInReady = (filteredBoms || []).find(item => {
            if (!item) return false;
            const itemId = (item.id || item.sales_order_item_id || item.order_item_id)?.toString();
            const itemDrawing = (item.drawing_no || item.bom_no)?.toString();
            const isMatch = itemId === String(targetBomIdToSelect) || itemDrawing === String(targetBomIdToSelect);
            if (orderId && isMatch) {
              const itemOrderId = item.sales_order_id || item.order_id;
              return String(itemOrderId) === String(orderId);
            }
            return isMatch;
          }) || (readyItems || []).find(item => {
            if (!item) return false;
            const itemId = (item.id || item.sales_order_item_id || item.order_item_id)?.toString();
            const itemDrawing = (item.drawing_no || item.bom_no)?.toString();
            const isMatch = itemId === String(targetBomIdToSelect) || itemDrawing === String(targetBomIdToSelect);
            if (orderId && isMatch) {
              const itemOrderId = item.sales_order_id || item.order_id;
              return String(itemOrderId) === String(orderId);
            }
            return isMatch;
          });

          if (itemInReady) {
            const designItem = designData.find(d =>
              String(d.item_code).trim() === String(itemInReady.item_code).trim() &&
              (String(d.drawing_no || '').trim() === String(itemInReady.drawing_no || '').trim())
            );

            const designQty = designItem ? parseFloat(designItem.qty || 0) : parseFloat(itemInReady.total_qty || itemInReady.quantity || 1);
            const salesOrderItemId = itemInReady.id || itemInReady.sales_order_item_id || itemInReady.order_item_id;
            const orderNo = itemInReady.order_no || data.order_no;
            const projectName = itemInReady.project_name || data.project_name;

            let bomDetails = { materials: [], components: [], operations: [] };
            try {
              const bomResp = await fetch(`${API_BASE}/production-plans/item-bom/${salesOrderItemId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (bomResp.ok) {
                const bomData = await bomResp.json();
                if (bomData) bomDetails = bomData;
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
          }
        } else if (filteredBoms.length === 1 && filteredBoms[0]) {
          const firstBom = filteredBoms[0];
          const singleBomId = firstBom.drawing_no || firstBom.bom_no || (firstBom.id || firstBom.sales_order_item_id || firstBom.order_item_id)?.toString();
          if (singleBomId) {
            setSelectedBomId(singleBomId);
            handleBomSelect(singleBomId, filteredBoms, designData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
      errorToast('Failed to fetch sales order details');
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
      setNewPlan(prev => ({
        ...prev,
        targetQuantity: 0,
        items: []
      }));
      return;
    }

    await fetchOrderDetails(orderId);
  };

  const handleBomSelect = (bomId, itemsOverride = null, designItemsOverride = null) => {
    const finalBomId = bomId?.toString();
    setSelectedBomId(finalBomId);
    setIsViewing(false);
    if (!finalBomId) {
      setNewPlan(prev => ({
        ...prev,
        targetQuantity: 0,
        items: []
      }));
      return;
    }

    // When a BOM is selected, find the item in designOrderItems or selectedOrderDetails and select it
    // The user wants STRICT behavior: only this item should be in the plan
    const itemsToSearch = itemsOverride || selectedOrderDetails?.items || readyItems || [];
    const itemInReady = itemsToSearch.find(item => {
      if (!item) return false;
      const itemId = (item.id || item.sales_order_item_id || item.order_item_id)?.toString();
      const itemDrawing = (item.drawing_no || item.bom_no)?.toString();
      const isMatch = itemId === finalBomId || itemDrawing === finalBomId;
      if (selectedOrderId && isMatch) {
        const itemOrderId = item.sales_order_id || item.order_id;
        return String(itemOrderId) === String(selectedOrderId);
      }
      return isMatch;
    });

    if (itemInReady) {
      const itemOrderId = itemInReady.sales_order_id;
      if (!selectedOrderId && itemOrderId && String(itemOrderId) !== String(selectedOrderId)) {
        // User selected the Drawing first: perform bidirectional sync
        setSelectedOrderId(String(itemOrderId));
        fetchOrderDetails(itemOrderId, finalBomId);
        return;
      }

      const designItemsToSearch = designItemsOverride || designOrderItems;
      // Find matching design order item to get quantity
      const designItem = designItemsToSearch.find(d =>
        String(d.item_code).trim() === String(itemInReady.item_code).trim() &&
        (String(d.drawing_no || '').trim() === String(itemInReady.drawing_no || '').trim())
      );

      const designQty = designItem ? parseFloat(designItem.qty || 0) : parseFloat(itemInReady.total_qty || itemInReady.quantity || 1);

      // Clear existing items and only add this one
      const salesOrderItemId = itemInReady.id || itemInReady.sales_order_item_id || itemInReady.order_item_id;
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
    const salesOrderItemId = item.id || item.sales_order_item_id || item.order_item_id;
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

  const planDetails = useMemo(() => {
    // 1. Collect all materials
    const consolidatedMaterialsMap = new Map();
    const processedMaterialSOItems = new Set();

    newPlan.items.forEach(item => {
      const soItemId = item.salesOrderItemId;

      (item.materials || []).forEach(mat => {
        const itemCode = mat.item_code || mat.material_code || mat.itemCode || '';
        const matName = mat.description || mat.material_name || mat.materialName || mat.item || '';
        const matCat = mat.material_category || ((mat.depth <= 1) ? 'CORE' : 'EXPLODED');

        const weightMultiplier = mat.is_kg_material ? (parseFloat(mat.total_wt) || 1) : 1;
        const baseQty = parseFloat(mat.qty_per_pc || mat.required_qty || 0) * weightMultiplier;
        const itemPlannedQty = parseFloat(item.plannedQty || newPlan.targetQuantity || 1);
        const plannedQty = baseQty * itemPlannedQty;

        // Use a key that represents the material identity - de-duplicate by name, unit, and dimensions
        const len = Number(mat.length || (mat.dimensions && mat.dimensions.length)) || 0;
        const wid = Number(mat.width || (mat.dimensions && mat.dimensions.width)) || 0;
        const thk = Number(mat.thickness || (mat.dimensions && mat.dimensions.thickness)) || 0;
        const dia = Number(mat.diameter || (mat.dimensions && mat.dimensions.diameter)) || 0;
        const od = Number(mat.outer_diameter || (mat.dimensions && mat.dimensions.outer_diameter)) || 0;
        const mKey = `${matName.toLowerCase().trim()}-${(mat.uom || mat.unit || '').toLowerCase().trim()}-${len}-${wid}-${thk}-${dia}-${od}`;

        // If this is a material and we've already processed this identity from this SO Item,
        // we might be double-counting if the recursion hits it multiple times.
        const soItemMaterialKey = `${soItemId}-${mKey}`;

        if (consolidatedMaterialsMap.has(mKey)) {
          const existing = consolidatedMaterialsMap.get(mKey);

          // Sum up quantities for the same material
          existing.totalPlannedQty += plannedQty;
          existing.required_qty = (parseFloat(existing.required_qty) || 0) + plannedQty;

          if (matCat === 'CORE') existing.material_category = 'CORE';
        } else {
          consolidatedMaterialsMap.set(mKey, {
            ...mat,
            item_code: itemCode,
            material_name: matName,
            material_category: matCat,
            totalDesignQty: newPlan.targetQuantity || 0,
            totalPlannedQty: plannedQty,
            required_qty: plannedQty,
            bomQty: baseQty,
            bom_no: mat.bom_no || mat.bom_ref || item.bom_no || 'BOM-REF',
            source_fg: item.description || item.itemCode
          });
        }
        processedMaterialSOItems.add(soItemMaterialKey);
      });
    });
    const allMaterials = Array.from(consolidatedMaterialsMap.values());

    // 2. Collect all potential sub-assemblies (components)
    const consolidatedComponentsMap = new Map();
    if (isViewing) {
      (newPlan.subAssemblies || []).forEach(sa => {
        const key = sa.item_code || sa.itemCode;
        consolidatedComponentsMap.set(key, sa);
      });
    } else {
      newPlan.items.forEach(item => {
        (item.components || []).forEach(comp => {
          const uom = (comp.unit || comp.uom || '').toUpperCase();
          const isKg = uom === 'KG';
          const weight = parseFloat(comp.weight_per_unit || 0);
          const weightMultiplier = (isKg && weight > 0) ? weight : 1;

          const baseQty = parseFloat(comp.quantity || 0) * weightMultiplier;
          const itemPlannedQty = parseFloat(item.plannedQty || newPlan.targetQuantity || 1);
          const totalQty = baseQty * itemPlannedQty;
          const itemCode = comp.item_code || comp.component_code;
          const key = itemCode;

          if (consolidatedComponentsMap.has(key)) {
            const existing = consolidatedComponentsMap.get(key);
            existing.plannedQty += totalQty;
            existing.requiredQty += totalQty;
            existing.required_qty += totalQty;
            existing.bomQty = baseQty;
          } else {
            consolidatedComponentsMap.set(key, {
              ...comp,
              itemCode: itemCode,
              item_code: itemCode,
              bomNo: comp.bom_no || 'BOM-SUB',
              designQty: itemPlannedQty,
              plannedQty: totalQty,
              parentDesignQty: itemPlannedQty,
              parentPlannedQty: itemPlannedQty,
              requiredQty: totalQty,
              required_qty: totalQty,
              bomQty: baseQty,
              source_fg: item.description || item.itemCode,
              is_kg_material: isKg,
              total_wt: weight
            });
          }
        });
      });
    }
    const rawComponents = Array.from(consolidatedComponentsMap.values());

    // 3. Separate real Sub-Assemblies from Consumables (Item Code starts with CON-)
    const subAssembliesToDisplay = rawComponents.filter(c => {
      const code = (c.itemCode || c.item_code || '').toUpperCase();
      return !code.startsWith('CON-');
    });

    const componentsAsMaterials = rawComponents.filter(c => {
      const code = (c.itemCode || c.item_code || '').toUpperCase();
      return code.startsWith('CON-');
    }).map(c => {
      const uom = (c.unit || c.uom || '').toUpperCase();
      const isKg = uom === 'KG' || c.is_kg_material;

      return {
        material_name: c.description || c.item_name || 'Consumable',
        description: c.description || 'Consumable item from BOM',
        required_qty: isViewing ? (c.required_qty || c.plannedQty) : c.plannedQty,
        design_qty: isViewing ? (c.design_qty || c.designQty) : c.designQty,
        uom: c.unit || c.uom || 'Nos',
        warehouse: c.targetWarehouse || c.warehouse || 'Store - NC',
        material_category: 'EXPLODED',
        bom_ref: c.bomNo || c.bom_no || '-',
        item_code: c.itemCode || c.item_code,
        totalDesignQty: c.designQty || 0,
        totalPlannedQty: isViewing ? (c.required_qty || c.plannedQty) : c.plannedQty,
        bom_no: c.bomNo || '-',
        bomQty: c.bomQty,
        source_fg: c.source_fg || '-',
        dimensions: c.dimensions || null,
        is_kg_material: isKg,
        total_wt: c.total_wt || c.weight_per_unit || 0
      };
    });

    // 4. Combine into final Material list
    let materialsToDisplay = isViewing ? (newPlan.materials || []).map(m => ({
      ...m,
      bomQty: m.bom_qty || (parseFloat(m.design_qty || newPlan.targetQuantity || 1) > 0 ? parseFloat(m.required_qty || 0) / parseFloat(m.design_qty || newPlan.targetQuantity || 1) : 0)
    })) : allMaterials;

    // Merge consumables from components into materials if not already present
    componentsAsMaterials.forEach(cam => {
      const codeMatch = (m) => (m.item_code || m.itemCode) === cam.item_code;
      if (!materialsToDisplay.some(codeMatch)) {
        materialsToDisplay.push(cam);
      }
    });

    const coreMaterials = materialsToDisplay.filter(m => m.material_category === 'CORE');
    const explodedMaterials = materialsToDisplay.filter(m => m.material_category === 'EXPLODED');

    const operationsToDisplay = (isViewing
      ? (newPlan.operations || []).map(op => ({
        ...op,
        operation_name: op.operation_name || op.name,
        workstation: op.workstation || op.workstation_name,
        base_hour: op.base_hour ?? op.base_time ?? op.cycle_time_min ?? 0,
        itemCode: (op.itemCode || op.source_item || '').toString().trim()
      }))
      : newPlan.items.flatMap(item => (item.operations || []).map(op => ({
        ...op,
        itemCode: (op.source_item || op.itemCode || item.itemCode || item.item_code || '').toString().trim(),
        operation_name: op.operation_name || op.name,
        workstation: op.workstation || op.workstation_name,
        base_hour: op.base_hour ?? op.base_time ?? op.cycle_time_min ?? 0,
        source_fg: item.itemCode
      })))).sort((a, b) => {
        const typeA = (a.item_type || a.itemType || 'FG').toUpperCase();
        const typeB = (b.item_type || b.itemType || 'FG').toUpperCase();
        const isA_SA = typeA === 'SUB ASSEMBLY' || typeA === 'SA';
        const isB_SA = typeB === 'SUB ASSEMBLY' || typeB === 'SA';
        if (isA_SA && !isB_SA) return -1;
        if (!isA_SA && isB_SA) return 1;
        return (a.step_no || a.step || 0) - (b.step_no || b.step || 0);
      });

    return {
      materialsToDisplay,
      subAssembliesToDisplay,
      operationsToDisplay,
      coreMaterials,
      explodedMaterials,
      totalMaterialCount: materialsToDisplay.length
    };
  }, [newPlan.items, newPlan.targetQuantity, isViewing, newPlan.materials, newPlan.subAssemblies, newPlan.operations]);

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderOperationsAccordion = (itemCode, allOperations) => {
    const targetCode = String(itemCode || '').trim().toUpperCase();

    const filteredOps = allOperations.filter(op => {
      const opCode = String(op.itemCode || op.item_code || op.source_item || op.sourceItem || '').trim().toUpperCase();
      return opCode === targetCode;
    });

    if (filteredOps.length === 0) {
      return (
        <div className="p-4 text-center text-slate-400 italic bg-slate-50/30">
          No operations defined for this item.
        </div>
      );
    }

    return (
      <div className="bg-slate-50/50 p-4 border-t border-slate-100 shadow-inner">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs  text-slate-700  ">Manufacturing Operations</h4>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {filteredOps.map((op, i) => {
            const cycleTime = parseFloat(op.cycle_time_min || op.base_time || 0);
            const setupTime = parseFloat(op.setup_time_min || 0);
            const hourlyRate = parseFloat(op.hourly_rate || op.rate || 0);
            const totalHours = (cycleTime + setupTime) / 60;
            const totalCost = totalHours * hourlyRate;

            return (
              <div key={i} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-indigo-50 text-indigo-600  flex items-center justify-center text-xs  ">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs  text-slate-800">{op.operation_name}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs  text-slate-500 ">
                      <span className="flex items-center gap-1">
                        <Settings className="w-3 h-3" /> {op.workstation || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" /> {op.process_type || op.operation_type || 'In-House'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs  text-slate-400  er">Cycle / Setup</div>
                    <div className="text-xs  text-slate-700">{cycleTime}m / {setupTime}m</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs  text-slate-400  er">Rate / Hr</div>
                    <div className="text-xs  text-slate-700">₹{hourlyRate.toFixed(2)}</div>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <div className="text-xs  text-slate-400  er">Total Cost</div>
                    <div className="text-xs  text-emerald-600">₹{totalCost.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCreateForm = () => {
    const {
      materialsToDisplay,
      subAssembliesToDisplay,
      operationsToDisplay,
      coreMaterials,
      explodedMaterials
    } = planDetails;

    const totalMaterialCount = materialsToDisplay.length;

    const fgColumns = [
      {
        label: 'No.',
        key: 'no',
        width: '50px',
        render: (_, __, idx) => idx + 1
      },
      {
        label: 'Item Code',
        key: 'itemCode',
        render: (_, item) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-blue-600 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-800 text-xs ">{item.itemCode || item.item_code}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{item.description}</div>
            </div>
          </div>
        )
      },
      {
        label: 'BOM No',
        key: 'bom_no',
        className: 'text-center',
        render: (val, item) => (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-indigo-600 text-[10px] rounded border border-slate-100">
            <FileText className="w-3 h-3" />
            {val || 'BOM-' + (item.salesOrderItemId || 'REF')}
          </span>
        )
      },
      {
        label: 'Design Qty',
        key: 'designQty',
        className: 'text-center',
        render: (val, item) => Number(val || item.totalQty || item.quantity || 0).toFixed(3)
      },
      {
        label: 'Planned Qty',
        key: 'plannedQty',
        className: 'text-center text-indigo-600 ',
        render: (val) => val
      },
      {
        label: 'UOM',
        key: 'uom',
        className: 'text-center text-slate-400',
        render: () => 'Nos'
      },
      {
        label: 'Finished Goods Warehouse',
        key: 'warehouse',
        render: () => (
          <div className="flex items-center gap-2 text-slate-600">
            <Package className="w-3 h-3 text-slate-300" />
            <span className="text-[10px]">Finished Goods - NC</span>
          </div>
        )
      },
      {
        label: 'Planned Start Date',
        key: 'plannedStartDate',
        render: (val) => (
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-3 h-3 text-slate-300" />
            <span className="text-[10px]">{val || '2026-02-04'}</span>
          </div>
        )
      },
      {
        label: 'Action',
        key: 'action',
        className: 'text-center',
        render: (_, item, idx) => {
          const rowId = `fg-${item.id || item.itemCode}-${idx}`;
          const isExpanded = expandedRows.has(rowId);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRow(rowId);
              }}
              className={`flex items-center gap-1 mx-auto px-2 py-1 rounded transition-all text-[10px] ${isExpanded ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100'}`}
            >
              <Activity className="w-3 h-3" />
              {isExpanded ? 'Hide Ops' : 'Operations'}
            </button>
          );
        }
      }
    ];

    const saColumns = [
      {
        label: 'No.',
        key: 'no',
        width: '50px',
        render: (_, __, idx) => idx + 1
      },
      {
        label: 'Sub Assembly Item Code',
        key: 'itemCode',
        render: (_, sa) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-50 rounded flex items-center justify-center text-rose-600 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-800 text-xs ">{sa.itemCode || sa.item_code}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{sa.description || 'Sub-Assembly'}</div>
            </div>
          </div>
        )
      },
      {
        label: 'Target Warehouse',
        key: 'targetWarehouse',
        render: (val, sa) => (
          <div className="flex items-center gap-2 text-slate-600">
            <Package className="w-4 h-4 text-slate-300" />
            <span className="text-[10px]">{val || sa.target_warehouse || 'Work In Progress - NC'}</span>
          </div>
        )
      },
      {
        label: 'Scheduled Date',
        key: 'scheduledDate',
        render: (val, sa) => (
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4 text-slate-300" />
            <span className="text-[10px]">{isViewing ? (sa.scheduled_date ? sa.scheduled_date.split('T')[0] : '-') : (val || '2026-02-04')}</span>
          </div>
        )
      },
      {
        label: 'Design Qty',
        key: 'designQty',
        className: 'text-center',
        render: (val, sa) => Number(isViewing ? (sa.design_qty || sa.required_qty) : (val || 0)).toFixed(0)
      },
      {
        label: 'Planned Qty',
        key: 'plannedQty',
        className: 'text-center',
        render: (val, sa) => (
          <div>
            <div className="text-rose-600 ">{Number(isViewing ? sa.required_qty : (val || 0)).toFixed(3)}</div>
            <div className="text-[8px] text-slate-400 uppercase">Nos</div>
          </div>
        )
      },
      {
        label: 'Bom No',
        key: 'bomNo',
        render: (val, sa) => (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-rose-600 text-[10px] rounded border border-slate-100">
            <FileText className="w-3 h-3" />
            {val || sa.bom_no}
          </span>
        )
      },
      {
        label: 'Source FG',
        key: 'sourceFg',
        render: (val, sa) => <span className="text-[10px] text-slate-500">{val || sa.source_fg || '-'}</span>
      },
      {
        label: 'Manufacturing Type',
        key: 'manufacturingType',
        className: 'text-center',
        render: (val, sa) => (
          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] rounded border border-rose-100">
            {val || sa.manufacturing_type || 'In House'}
          </span>
        )
      },
      {
        label: 'Action',
        key: 'action',
        className: 'text-center',
        render: (_, sa, idx) => {
          const rowId = `sa-${sa.id || (sa.itemCode || sa.item_code)}-${idx}`;
          const isExpanded = expandedRows.has(rowId);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRow(rowId);
              }}
              className={`flex items-center gap-1 mx-auto px-2 py-1 rounded transition-all text-[10px] ${isExpanded ? 'bg-rose-600 text-white shadow-md shadow-rose-200' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100'}`}
            >
              <Activity className="w-3 h-3" />
              {isExpanded ? 'Hide Ops' : 'Operations'}
            </button>
          );
        }
      }
    ];

    const coreMatColumns = [
      {
        label: 'Item',
        key: 'material_name',
        render: (val, mat) => (
          <div>
            <div className="text-slate-800 text-xs ">{val}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {renderDimensions(mat) || (mat.description || mat.item_code || mat.itemCode || 'Direct Material')}
            </div>
          </div>
        )
      },
      {
        label: 'Design Qty',
        key: 'design_qty',
        className: 'text-right',
        render: (val, mat) => Number(isViewing ? (val || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(0)
      },
      {
        label: 'Planned Qty',
        key: 'required_qty',
        className: 'text-right',
        render: (val, mat) => (
          <div>
            <div className="text-amber-600 ">
              {Number(isViewing ? val : mat.totalPlannedQty).toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-400">
              {mat.uom || mat.unit || 'Nos'}
              {isWeightBased(mat.uom || mat.unit) && (
                <span className="ml-1 text-slate-300">
                  ({Number(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(0)} × {Number((parseFloat(val || mat.totalPlannedQty) || 0) / (parseFloat(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty) || 1)).toFixed(3)})
                </span>
              )}
            </div>
          </div>
        )
      },
      {
        label: 'Warehouse',
        key: 'warehouse',
        render: (val) => <span className="text-[10px] text-slate-600">{val || 'Store - NC'}</span>
      },
      {
        label: 'BOM Ref',
        key: 'bom_ref',
        render: (val, mat) => <span className="text-[10px] text-slate-400">{isViewing ? val : mat.bom_no}</span>
      },
      {
        label: 'Status',
        key: 'status',
        className: 'text-center',
        render: (val) => (
          <span className={`px-2 py-0.5 rounded text-[10px] border ${val === 'FULFILLED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
            val === 'SUBMITTED' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
              'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
            {isViewing ? (val === 'FULFILLED' ? '✅ FULFILLED' : val) : '--'}
          </span>
        )
      }
    ];

    const explodedMatColumns = [
      {
        label: 'Component Specification',
        key: 'material_name',
        render: (val, mat) => (
          <div>
            <div className="text-slate-800 text-xs ">{val || mat.materialName}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {mat.dimensions ? (
                <div className="flex flex-wrap gap-1">
                  {mat.dimensions.length > 0 && <span>L: {mat.dimensions.length}</span>}
                  {mat.dimensions.width > 0 && <span>W: {mat.dimensions.width}</span>}
                  {mat.dimensions.thickness > 0 && <span>T: {mat.dimensions.thickness}</span>}
                  {mat.dimensions.diameter > 0 && <span>D: {mat.dimensions.diameter}</span>}
                </div>
              ) : (mat.description || 'Consumable / Component')}
            </div>
          </div>
        )
      },
      {
        label: 'Design Qty',
        key: 'design_qty',
        className: 'text-right',
        render: (val, mat) => Number(isViewing ? (val || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(3)
      },
      {
        label: 'Planned Qty',
        key: 'required_qty',
        className: 'text-right',
        render: (val, mat) => (
          <div>
            <div className="text-rose-600 ">
              {Number(isViewing ? val : mat.totalPlannedQty).toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-400">{mat.uom || mat.unit || 'Nos'}</div>
          </div>
        )
      },
      {
        label: 'Source Assembly',
        key: 'source_fg',
        render: (val, mat) => <span className="text-[10px] text-slate-500">{val || mat.sourceFg || '-'}</span>
      },
      {
        label: 'BOM Ref',
        key: 'bom_ref',
        render: (val, mat) => <span className="text-[10px] text-slate-400">{isViewing ? val : mat.bom_no}</span>
      }
    ];

    return (
      <div className="space-y-2 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 bg-white border border-slate-200 rounded sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate(`${deptPrefix}/production-plan`)}
              icon={ArrowLeft}
            />
            <div className="flex items-center gap-3">

              <div>
                <h1 className="text-xl  text-slate-900 leading-tight">
                  {isViewing ? `Plan: ${newPlan.planCode}` : 'New Production Plan'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`p-1 text-xs       ${newPlan.operationalStatus === 'Draft' ? ' text-amber-600 ' : ' text-emerald-600 '
                    }`}>
                    {isViewing ? newPlan.operationalStatus : 'Draft'}
                  </span>
                  <span className="text-xs text-slate-400 ">Production Strategy</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`${deptPrefix}/production-plan`)}
            >
              {isViewing ? 'Close' : 'Discard'}
            </Button>
            {!isViewing && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                icon={Save}
              >
                Save Strategy
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation & Content Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto p-2 space-y-2">
            {/* Tab Navigation */}


            {/* Section 01: Strategic Parameters */}
            <Card className="bg-white border border-slate-200  rounded  ">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2 ">
                      <span className="text-xs  text-indigo-600">01</span>
                      <h2 className="text-sm  text-slate-800">STRATEGIC PARAMETERS</h2>
                    </div>
                    <p className="text-xs text-slate-400">Core planning identities and source selection</p>
                  </div>
                  <button className="ml-auto p-1 hover:bg-slate-50 rounded text-indigo-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <FormControl label="Source Sales Order *">
                    <div className="relative">
                      {(() => {
                        const soOptions = [...productionReadyOrders];
                        if (selectedOrderId && !soOptions.some(so => String(so.id) === String(selectedOrderId))) {
                          let orderNo = selectedOrderDetails?.order_no || selectedOrderDetails?.orderNo;
                          let companyName = selectedOrderDetails?.company_name || selectedOrderDetails?.client_name || selectedOrderDetails?.companyName;

                          if (!orderNo || !companyName) {
                            const matchedItem = (readyItems || []).find(item => String(item.sales_order_id || item.order_id) === String(selectedOrderId));
                            if (matchedItem) {
                              orderNo = matchedItem.order_no;
                              companyName = matchedItem.company_name || matchedItem.client_name;
                            }
                          }

                          if (orderNo) {
                            soOptions.push({
                              id: selectedOrderId,
                              order_no: orderNo,
                              company_name: companyName || 'Active Order'
                            });
                          }
                        }
                        return (
                          <SearchableSelect
                            options={soOptions.map(so => ({
                              label: `${so.order_no} - ${so.company_name || 'No Client'}`,
                              value: so.id.toString(),
                              order_no: so.order_no
                            }))}
                            value={selectedOrderId}
                            onChange={(e) => handleOrderSelect(e.target.value)}
                            placeholder="Search and select sales order..."
                            allowCustom={false}
                            disabled={isViewing}
                          />
                        );
                      })()}
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
                  <FormControl label="Drawing No. / Part No. *">
                    <div className="relative">
                      {(() => {
                        const bomOptions = [...(selectedOrderId ? (availableBoms || []) : (readyItems || []))].filter(bom => {
                          if (!bom) return false;
                          const code = (bom.item_code || bom.itemCode || '').toUpperCase().trim();
                          const desc = (bom.description || '').toUpperCase().trim();
                          if (!code || code === 'XXX' || code === 'NO CODE' || code.includes('NO CODE') || desc.includes('NO CODE')) return false;
                          return true;
                        });

                        // If a drawing is selected, but not found in the list (e.g., loading or already planned),
                        // append it dynamically using details from newPlan.items[0]
                        if (selectedBomId && !bomOptions.some(bom => String(bom.id || bom.sales_order_item_id || bom.order_item_id) === String(selectedBomId))) {
                          const activeItem = newPlan.items?.[0];
                          if (activeItem) {
                            bomOptions.push({
                              id: activeItem.salesOrderItemId,
                              bom_no: activeItem.bom_no || selectedBomId,
                              drawing_no: activeItem.bom_no || selectedBomId,
                              description: activeItem.description || 'Selected Drawing'
                            });
                          }
                        }

                        return (
                          <SearchableSelect
                            options={bomOptions.map((bom, idx) => {
                              const id = (bom.id || bom.sales_order_item_id || bom.order_item_id || idx)?.toString();
                              const optionValue = id;
                              const drawingNo = bom.drawing_no || bom.bom_no || bom.item_code || bom.itemCode || 'No Code';
                              const orderNoVal = bom.order_no || selectedOrderDetails?.order_no || 'No Order';
                              return {
                                label: `${drawingNo} - ${bom.description || 'No Description'} (${orderNoVal})`,
                                value: optionValue
                              };
                            })}
                            value={selectedBomId}
                            onChange={(e) => handleBomSelect(e.target.value)}
                            placeholder={selectedOrderId ? (availableBoms.length === 0 ? 'No Drawing No. / Part No. Available' : 'Search & Select Drawing No. / Part No...') : (readyItems.length === 0 ? 'No Drawing No. / Part No. Available' : 'Search & Select Drawing No. / Part No...')}
                            allowCustom={false}
                            disabled={isViewing}
                          />
                        );
                      })()}
                      {selectedBomId && !isViewing && (
                        <button
                          onClick={() => handleBomSelect('')}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </FormControl>
                  <FormControl label="Target Quantity *">
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={newPlan.targetQuantity === 0 ? '' : newPlan.targetQuantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPlan(prev => ({
                            ...prev,
                            targetQuantity: val === '' ? '' : (parseFloat(val) || 0)
                          }));
                        }}
                        className="flex-1 p-2 .5 bg-white border border-slate-200 rounded-l-lg text-xs  focus:outline-none transition-all"
                      />
                      <span className="p-2 .5 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg text-xs  text-slate-400">UNIT</span>
                    </div>
                    <p className="text-xs text-indigo-600 mt-1 ">Quantity fetched from Design Order</p>
                  </FormControl>
                </div>
              </div>
            </Card>

            {/* Section 02: Finished Goods */}
            <Card className="bg-white border border-slate-200  rounded  ">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-6">

                  <div>
                    <div className="flex items-center gap-2 ">
                      <span className="text-xs  text-blue-600">02</span>
                      <h2 className="text-sm  text-slate-800">ASSEMBLY</h2>
                      <span className="p-1  bg-blue-50 text-blue-600 text-xs   rounded  ml-2  ">{newPlan.items.length} ITEMS</span>
                    </div>
                    <p className="text-xs text-slate-400">Assembly items and target fulfillment</p>
                  </div>
                  <button className="ml-auto p-1 hover:bg-slate-50 rounded text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                  </button>
                </div>

                <div className="">
                  <DataTable
                    columns={fgColumns}
                    data={newPlan.items.map((item, idx) => ({ ...item, rowId: `fg-${item.id || item.itemCode}-${idx}` }))}
                    renderExpanded={(item) => renderOperationsAccordion(item.itemCode || item.item_code, operationsToDisplay)}
                    expandedRows={expandedRows}
                    onExpandedChange={setExpandedRows}
                    rowId="rowId"
                    hideHeader
                  />
                  {newPlan.items.length === 0 && (
                    <div className="px-4 py-8 text-center text-slate-400 italic text-xs border border-slate-100 rounded-b">
                      No assemblies selected. Please select a sales order and BOM.
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Section 04: Sub Assemblies */}
            <Card className="bg-white border border-slate-200  rounded  ">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-6">

                  <div>
                    <div className="flex items-center gap-2 ">
                      <span className="text-xs  text-rose-600">04</span>
                      <h2 className="text-sm  text-slate-800">PART</h2>
                      <span className="p-1  bg-rose-50 text-rose-600 text-xs   rounded  ml-2  ">{subAssembliesToDisplay.length} ITEMS</span>
                    </div>
                    <p className="text-xs text-slate-400">Manufacturing breakdown of intermediate parts</p>
                    <p className="text-xs text-rose-600 mt-1   ">Target Quantity: {newPlan.targetQuantity} UNIT (Quantity fetched from Design Order)</p>
                  </div>
                  <button className="ml-auto p-1 hover:bg-slate-50 rounded text-rose-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded ">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/50">
                      <tr className="text-lefttext-xs   text-slate-400  ">
                        <th className="p-2  ">No.</th>
                        <th className="p-2  ">Part Item Code</th>
                        <th className="p-2  ">Target Warehouse</th>
                        <th className="p-2  ">Scheduled Date</th>
                        <th className="p-2   text-center">Design Qty</th>
                        <th className="p-2   text-center">Planned Qty</th>
                        <th className="p-2  ">Bom No</th>
                        <th className="p-2  ">Source FG</th>
                        <th className="p-2   text-center">Manufacturing Type</th>
                        <th className="p-2   text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subAssembliesToDisplay.map((sa, idx) => {
                        const rowId = `sa-${sa.id || (sa.itemCode || sa.item_code)}-${idx}`;
                        const isExpanded = expandedRows.has(rowId);
                        return (
                          <React.Fragment key={idx}>
                            <tr className="group hover:bg-slate-50/50 transition-colors">
                              <td className="p-2  text-slate-400 ">{idx + 1}</td>
                              <td className="p-2 ">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-rose-50 rounded flex items-center justify-center text-rose-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                  </div>
                                  <div>
                                    <div className=" text-slate-800 text-xs">{sa.itemCode || sa.item_code}</div>
                                    <div className="text-xs text-slate-400">{sa.description || 'PART'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 ">
                                <div className="flex items-center gap-2  text-slate-600">
                                  <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                  <span className="text-xs ">{sa.targetWarehouse || sa.target_warehouse || 'Work In Progress - NC'}</span>
                                </div>
                              </td>
                              <td className="p-2 ">
                                <div className="flex items-center gap-2  text-slate-600">
                                  <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                                  <span className="text-xs ">{isViewing ? (sa.scheduled_date ? sa.scheduled_date.split('T')[0] : '-') : '2026-02-04'}</span>
                                </div>
                              </td>
                              <td className="p-2  text-center  text-slate-700">
                                {Number(isViewing ? (sa.design_qty || sa.required_qty) : (sa.designQty || 0)).toFixed(0)}
                              </td>
                              <td className="p-2  text-center">
                                <div className=" text-rose-600">{Number(isViewing ? sa.required_qty : (sa.plannedQty || 0)).toFixed(3)}</div>
                                <div className="text-[8px] text-slate-400   ">NOS</div>
                              </td>
                              <td className="p-2 ">
                                <span className="inline-flex items-center gap-1.5 p-1  bg-slate-50 text-rose-600text-xs   rounded border border-slate-100">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  {sa.bomNo || sa.bom_no}
                                </span>
                              </td>
                              <td className="p-2 ">
                                <span className="text-xs text-slate-500 ">
                                  {sa.sourceFg || sa.source_fg || '-'}
                                </span>
                              </td>
                              <td className="p-2  text-center">
                                <span className="p-1  bg-rose-50 text-rose-600text-xs   rounded  border border-rose-100">{sa.manufacturingType || sa.manufacturing_type || 'In House'}</span>
                              </td>
                              <td className="p-2  text-center">
                                <button
                                  onClick={() => toggleRow(rowId)}
                                  className={`flex items-center gap-1 mx-auto px-2 py-1 rounded transition-all text-xs     ${isExpanded ? 'bg-rose-600 text-white shadow-md shadow-rose-200' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100'}`}
                                >
                                  <Activity className="w-3 h-3" />
                                  {isExpanded ? 'Hide Ops' : 'Operations'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan="10" className="p-0 border-none overflow-hidden">
                                  {renderOperationsAccordion(sa.itemCode || sa.item_code, operationsToDisplay)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {subAssembliesToDisplay.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-4 p-2 text-center text-slate-400 italic text-xs">
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
            <Card className="bg-white border border-slate-200  rounded  ">
              <div className="p-2">
                <div className="flex items-center gap-2 mb-4">

                  <div>
                    <div className="flex items-center gap-2 ">
                      <span className="text-xs  text-amber-600">03</span>
                      <h2 className="text-sm  text-slate-800">Materials</h2>
                      <span className="p-1  bg-amber-50 text-amber-600 text-xs   rounded  ml-2  ">{totalMaterialCount} ITEMS</span>
                    </div>
                    <p className="text-xs text-slate-400">Consolidated material explosion across all levels</p>
                    <p className="text-xs text-amber-600 mt-1   ">Target Quantity: {newPlan.targetQuantity} UNIT (Quantity fetched from Design Order)</p>
                  </div>
                  <button className="ml-auto p-1 hover:bg-slate-50 rounded text-amber-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                  </button>
                </div>

                {/* Core Materials */}
                <div className="mb-8">
                  <div className="flex items-center gap-2  mb-4">
                    <div className="w-2 h-2 bg-amber-500 rounded "></div>
                    <h3 className="text-xs  text-amber-600  ">Core Materials</h3>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
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
                              <div className=" text-slate-800 text-xs ">{mat.description || mat.material_name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                                {renderDimensions(mat) || (
                                  <span>{mat.description || mat.item_code || mat.itemCode || 'Direct Material'}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2  text-right  text-slate-700">
                              {Number(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(0)}
                            </td>
                            <td className="p-2  text-right">
                              <div className=" text-amber-600 ">
                                {Number(isViewing ? mat.required_qty : mat.totalPlannedQty).toFixed(3)}
                              </div>
                              <div className="text-xs text-slate-400 ">
                                {mat.uom || mat.unit || 'Nos'}
                                {isWeightBased(mat.uom || mat.unit) && (
                                  <span className="ml-1 text-slate-300">
                                    ({Number(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(0)} × {Number((parseFloat(mat.required_qty || mat.totalPlannedQty) || 0) / (parseFloat(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty) || 1)).toFixed(3)})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 ">
                              <div className="text-xs text-slate-600 ">{mat.warehouse || 'Store - NC'}</div>
                            </td>
                            <td className="p-2 ">
                              <span className="text-xs text-slate-400 ">{isViewing ? mat.bom_ref : mat.bom_no}</span>
                            </td>
                            <td className="p-2  text-center">
                              <span className={`p-1 rounded text-xs   border
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

                {/* Exploded Components / Consumables */}
                <div>
                  <div className="flex items-center gap-2  mb-4">
                    <div className="w-2 h-2 bg-rose-500 rounded "></div>
                    <h3 className="text-xs  text-rose-600   ">Exploded Components</h3>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="text-lefttext-xs  text-slate-400   border-b border-slate-100">
                        <tr>
                          <th className="p-2  ">Component Specification</th>
                          <th className="p-2   text-right">Design Qty</th>
                          <th className="p-2   text-right">Planned Qty</th>
                          <th className="p-2  ">Source Assembly</th>
                          <th className="p-2  ">BOM Ref</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(isViewing ? materialsToDisplay.filter(m => m.material_category === 'EXPLODED') : explodedMaterials).map((mat, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 ">
                              <div className=" text-slate-800 text-xs ">{mat.description || mat.material_name || mat.materialName}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                                {renderDimensions(mat) || (
                                  <span>{mat.item_code || mat.itemCode}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2  text-right  text-slate-700">
                              {Number(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(0)}
                            </td>
                            <td className="p-2  text-right">
                              <div className=" text-rose-600 ">
                                {Number(isViewing ? mat.required_qty : mat.totalPlannedQty).toFixed(3)}
                              </div>
                              <div className="text-xs text-slate-400 ">
                                {mat.uom || mat.unit || 'Nos'}
                                {isWeightBased(mat.uom || mat.unit) && (
                                  <span className="ml-1 text-slate-300">
                                    ({Number(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty).toFixed(0)} × {Number((parseFloat(mat.required_qty || mat.totalPlannedQty) || 0) / (parseFloat(isViewing ? (mat.design_qty || newPlan.targetQuantity) : mat.totalDesignQty) || 1)).toFixed(3)})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 ">
                              <div className="text-xs text-slate-500 ">{mat.source_assembly || mat.sourceFg || '-'}</div>
                            </td>
                            <td className="p-2 ">
                              <span className="text-xs text-slate-400 ">{isViewing ? mat.bom_ref : mat.bom_no}</span>
                            </td>
                          </tr>
                        ))}
                        {(isViewing ? materialsToDisplay.filter(m => m.material_category === 'EXPLODED') : explodedMaterials).length === 0 && (
                          <tr>
                            <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic text-xs">No exploded components available</td>
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
        <Card className="bg-white border border-slate-200  rounded  ">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-4 h-4 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 ">
                  <span className="text-xs  text-indigo-600">05</span>
                  <h2 className="text-sm  text-slate-800">Operations</h2>
                  <span className="p-1  bg-indigo-50 text-indigo-600 text-xs   rounded  ml-2  ">{operationsToDisplay.length} OPERATIONS</span>
                </div>
                <p className="text-xs text-slate-400">Sequential manufacturing steps and workstation routing</p>
              </div>
              <button className="ml-auto p-1 hover:bg-slate-50 rounded text-indigo-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded ">
              <table className="w-full text-xs">
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
                      <td className="p-2  text-slate-400 ">0{idx + 1}</td>
                      <td className="p-2 ">
                        <div className=" text-slate-800 text-xs">{op.operation_name}</div>
                        <div className="text-xs text-slate-400">Standard manufacturing process</div>
                      </td>
                      <td className="p-2 ">
                        <div className="flex items-center gap-2  text-slate-600">
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span className="text-xs ">{op.workstation || 'General Workstation'}</span>
                        </div>
                      </td>
                      <td className="p-2  text-center">
                        <div className=" text-indigo-600">{op.base_hour || '1.0'}</div>
                        <div className="text-[8px] text-slate-400   ">HRS</div>
                      </td>
                      <td className="p-2 ">
                        <span className="inline-flex items-center gap-1.5 p-1  bg-slate-50 text-indigo-600 text-xs   rounded border border-slate-100">
                          {op.itemCode || op.source_item}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!newPlan.items.some(item => item.operations?.length > 0)) && (
                    <tr>
                      <td colSpan="5" className="px-4 p-2 text-center text-slate-400 italic text-xs">
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

          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="bg-white border-t border-slate-200 p-2 flex items-center justify-between z-20 flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-xs  text-slate-400   block mb-0.5">Plan Status</span>
              <div className="flex items-center gap-2 ">
                <span className="p-1 bg-slate-100 text-slate-600 text-xs   rounded border border-slate-200">{isViewing ? newPlan.operationalStatus : 'draft'}</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-100"></div>
            <div>
              <span className="text-xs  text-slate-400   block mb-0.5">Calculated Materials</span>
              <span className="text-xs  text-slate-700 ">{totalMaterialCount} Items Identified</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCreateWorkOrders(newPlan.id)}
              className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 text-xs  transition-all border border-emerald-200/50 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Generate Work Orders
            </button>
            <button className="flex items-center gap-2 p-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 text-xs  transition-all border border-indigo-200/50 shadow-sm">
              <Zap className="w-4 h-4" />
              Transmit MR
            </button>
            {!isViewing && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded hover:bg-slate-800 text-xs  transition-all shadow-lg shadow-slate-200"
              >
                <CheckCircle2 className="w-4 h-4" />
                {newPlan.id ? 'Update Strategic Plan' : 'Commit Strategy'}
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

    if (!newPlan.id && selectedOrderId && selectedBomId) {
      const duplicateExists = plans.some(plan =>
        String(plan.sales_order_id) === String(selectedOrderId) &&
        String(plan.bom_no).trim().toLowerCase() === String(selectedBomId).trim().toLowerCase()
      );

      if (duplicateExists) {
        errorToast('Production Plan already exists for the selected Sales Order and Drawing. Duplicate Production Plans are not allowed.');
        return;
      }
    }

    try {
      const token = localStorage.getItem('authToken');
      const today = new Date().toISOString().split('T')[0];

      // Calculate latest details to ensure sub-assemblies and materials are included
      const {
        materialsToDisplay,
        subAssembliesToDisplay,
        operationsToDisplay
      } = planDetails;

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
          sourceItem: op.itemCode || op.source_item || null,
          cycle_time_min: op.cycle_time_min || op.cycleTimeMin || 0,
          setup_time_min: op.setup_time_min || op.setupTimeMin || 0
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
        navigate(`${deptPrefix}/production-plan`);
        fetchPlans();
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to create production plan');
      }
    } catch (error) {
      errorToast('An unexpected error occurred');
    }
  };

  const filteredPlans = plans.filter(plan =>
    plan.plan_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.order_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mrColumns = [
    {
      label: 'Material Name',
      key: 'material_name',
      render: (val, row) => (
        <span className="text-xs font-semibold text-slate-800">{val || row.itemName || '—'}</span>
      )
    },
    {
      label: 'Item Code',
      key: 'item_code',
      render: (val) => (
        <span className="text-[10px] text-slate-500 font-mono font-medium uppercase">{val || '—'}</span>
      )
    },
    {
      label: 'Dimensions',
      key: 'dimensions',
      render: (_, row) => renderDimensions(row)
    },
    {
      label: 'Design Qty',
      key: 'design_qty',
      className: 'text-center',
      render: (val, row) => (
        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold text-slate-800">
            {val !== undefined && val !== null ? Number(val).toFixed(0) : '—'}
          </span>
          <span className="text-[9px] text-slate-400 uppercase">Nos</span>
        </div>
      )
    },
    {
      label: 'Required Qty',
      key: 'quantity',
      className: 'text-center',
      render: (val, row) => (
        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold text-indigo-600">
            {Number(val || 0).toFixed(2)}
          </span>
          <span className="text-[9px] text-slate-400 uppercase">{row.uom || row.unit || 'Nos'}</span>
        </div>
      )
    },
    {
      label: 'Issued Qty',
      key: 'inventory',
      className: 'text-center',
      render: (val, row) => (
        <div className="flex flex-col items-center">
          <span className={`text-xs font-semibold ${parseFloat(val || 0) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {Number(val || 0).toFixed(2)}
          </span>
          <span className="text-[9px] text-slate-400 uppercase">{row.uom || row.unit || 'Nos'}</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'request_exists',
      render: (val, row) => {
        const inv = parseFloat(row.inventory || 0);
        const req = parseFloat(row.quantity || 0);

        if (val) {
          if (inv >= req) {
            return (
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-100 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                FULFILLED
              </div>
            );
          } else if (inv > 0) {
            return (
              <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-100 font-medium">
                <Clock className="w-3 h-3" />
                PARTIALLY FULFILLED
              </div>
            );
          } else {
            return (
              <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100 font-medium">
                <Clock className="w-3 h-3" />
                REQUESTED
              </div>
            );
          }
        }

        if (inv >= req) {
          return (
            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100">
              <Package className="w-3 h-3" />
              IN STOCK
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-100">
            <Clock className="w-3 h-3" />
            PENDING
          </div>
        );
      }
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-center',
      render: (_, row) => row.is_manual && !row.request_exists && (
        <button
          onClick={async () => {
            if (row.ppm_id) {
              try {
                const token = localStorage.getItem('authToken');
                const res = await fetch(`${API_BASE}/production-plans/${mrPlanDetails?.id}/materials/${row.ppm_id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) {
                  errorToast('Failed to remove item');
                  return;
                }
              } catch (e) {
                errorToast('Failed to remove item');
                return;
              }
            }
            // Use localId for newly added items, ppm_id for DB items.
            // Never filter by item_code alone — multiple rows can share the same code (different dimensions).
            setMrItems(prev => prev.filter(item => {
              if (row.localId) return item.localId !== row.localId;
              return item.ppm_id !== row.ppm_id;
            }));
          }}
          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      )
    }
  ];

  const columns = [
    {
      label: 'Production Plan',
      key: 'plan_code',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{val}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">
            {row.plan_date ? new Date(row.plan_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </span>
        </div>
      )
    },
    {
      label: 'Sales Order',
      key: 'order_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{val || 'Direct Order'}</span>
          {row.project_id && (
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
              {row.project_id}
            </span>
          )}
          <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[180px]">
            {row.company_name || row.project_name || '—'}
          </span>
        </div>
      )
    },
    {
      label: 'Drawing / Finished Good',
      key: 'bom_no',
      sortable: true,
      render: (val, row) => {
        // Show drawing_no if available, fallback to item_code (if non-numeric), and then finally bom_no.
        const displayDrawing = row.drawing_no || ((row.item_code && isNaN(row.item_code)) ? row.item_code : (val || 'No Drawing'));
        return (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-indigo-600">{displayDrawing}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 max-w-[220px]">
              {row.item_description || row.description || '—'}
            </span>
          </div>
        );
      }
    },
    {
      label: 'Qty',
      key: 'target_qty',
      render: (val, row) => {
        const target = parseFloat(val || 0);
        const totalOps = row.total_ops || 0;
        const completedOps = row.completed_ops || 0;
        const ratio = totalOps > 0 ? (completedOps / totalOps) : (row.status === 'Completed' ? 1 : 0);
        const produced = Math.round(target * ratio);
        const balance = Math.max(0, target - produced);
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-800">Planned: {target}</span>
            <div className="text-[10px] text-slate-400 mt-0.5 space-x-1.5">
              <span className="text-emerald-600 font-medium">Produced: {produced}</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-medium">Balance: {balance}</span>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Status',
      key: 'status',
      render: (val, row) => {
        const statusColor = val === 'Draft' ? 'text-amber-600 bg-amber-50 border-amber-100' :
          val === 'Completed' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
            'text-indigo-600 bg-indigo-50 border-indigo-100';
        const mrColor = row.mr_status === 'Completed' ? 'text-emerald-600' : 'text-slate-400';
        const mrLabel = row.mr_status === 'Completed' ? 'MR: Fulfilled' : (row.mr_status ? `MR: ${row.mr_status}` : 'MR: Pending');
        return (
          <div className="flex flex-col items-start gap-1">
            <span className={`px-2 py-0.5 rounded text-[10px] border font-medium ${statusColor}`}>
              {val}
            </span>
            <span className={`text-[10px] font-medium ${mrColor}`}>
              {mrLabel}
            </span>
          </div>
        );
      }
    },
    {
      label: 'Progress',
      key: 'completed_ops',
      render: (_, row) => {
        const total = row.total_ops || 0;
        const completed = row.completed_ops || 0;
        const status = (row.status || '').toUpperCase();
        let progress = 0;
        if (total > 0) progress = Math.round((completed / total) * 100);
        else if (status === 'COMPLETED') progress = 100;

        return (
          <div className="w-28 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-slate-700">{progress}%</span>
              <span className="text-[10px] text-slate-400">{completed} / {total} WO</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => handleViewPlan(row.id)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="View Details">
            <Eye className="w-3 h-3" />
          </button>
          <button onClick={() => handleOpenConfig(row)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Settings">
            <Settings className="w-3 h-3" />
          </button>
          <button onClick={() => handleTransmitMR(row.id)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Transmit">
            <Send className="w-3 h-3" />
          </button>
          <button onClick={() => handleEditPlan(row.id)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Edit Strategy">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={() => handleDeletePlan(row.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all" title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )
    }
  ];

  if (isCreating) {
    return renderCreateForm();
  }

  return (
    <div className="space-y-2 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">

          <div>
            <h1 className="text-xl  text-slate-900 ">Production Plans</h1>
            <p className="text-xs text-slate-500 ">Manage manufacturing strategies and resource allocation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchPlans}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
          <Button
            variant="primary"
            onClick={handleCreateNew}
            icon={Plus}
          >
            New Production Plan
          </Button>
        </div>
      </div>

      {/* SEARCH & FILTER SECTION */}


      {/* Content Section */}
      <div className="">
        <DataTable
          columns={columns}
          data={filteredPlans}
          loading={loading}
          searchPlaceholder="Search strategic formulations..."
          searchKey="plan_code"
        />

        {/* Summary Footer */}
        <div className="p-2 border-t border-slate-100 flex items-center justify-between bg-white/30">
          <div className="text-xs  text-slate-400   flex items-center gap-2 ">
            Showing {filteredPlans.length} of {plans.length} strategic formulations
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500  animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs   text-slate-900  ">Neural Link Active</span>
          </div>
        </div>
      </div>

      {/* Material Request Preview Modal */}
      <Modal
        isOpen={mrModalOpen}
        onClose={() => !transmittingMr && setMrModalOpen(false)}
        title={
          <div className="flex items-center gap-2">

            <div>
              <h2 className="text-lg  text-slate-800 ">Material Request</h2>
              <div className="flex items-center gap-1 text-xs text-indigo-500   ">
                <Activity className="w-3 h-3" />
                Resource Acquisition Phase
              </div>
            </div>
          </div>
        }
        size="4xl"
      >
        <div className="space-y-2">
          {/* MR Header Info */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-slate-50/50 rounded  border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">Request Identifier</label>
              <div className="text-xs  text-slate-800">{mrPlanDetails?.planCode || '---'}</div>
            </div>
            <div className="p-2 bg-slate-50/50 rounded  border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">Originating Dept</label>
              <div className="text-xs  text-slate-800">Production</div>
            </div>
            <div className="p-2 bg-slate-50/50 rounded  border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">SLA Target Date</label>
              <div className="text-xs  text-slate-800">
                {mrPlanDetails?.startDate ? new Date(mrPlanDetails.startDate).toLocaleDateString() : '---'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 pb-0">
            <Tabs
              tabs={[
                { id: 'pending', label: 'Pending Request', value: 'pending', icon: Clock },
                { id: 'complete', label: 'Complete Request', value: 'complete', icon: CheckCircle2 }
              ]}
              activeTab={activeTab === 'Pending Request' || activeTab === 'pending' ? 'pending' : 'complete'}
              onTabChange={(val) => setActiveTab(val)}
              className="border-none px-0"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-500 rounded" />
                <span className="text-xs   text-slate-700">Items to Request ({mrItems.filter(item => !item.request_exists && (parseFloat(item.inventory || 0) < parseFloat(item.quantity) || item.is_manual)).length})</span>
              </div>
              <button
                onClick={() => setShowAddItem(!showAddItem)}
                className="flex items-center gap-1.5 p-1.5 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all text-xs  shadow-sm"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>
          </div>

          {/* Items to Request Section */}
          <div className="flex-1 flex flex-col min-h-0">
            {showAddItem && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded mb-4 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h5 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded"></span>
                    Add Material Request Item
                  </h5>
                </div>

                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-4 space-y-1">
                    <label className="text-xs text-slate-500 ml-1 block font-medium">Material Selection <span className="text-rose-500">*</span></label>
                    <SearchableSelect
                      placeholder="Select material..."
                      onFocus={fetchAllStockItems}
                      options={allStockItems.map(item => {
                        const dims = formatDimensions(item);

                        return {
                          label: item.material_name || '',
                          value: item.item_code || '',
                          subLabel: `${dims ? `${dims}\n` : ''}${item.item_code || ''}${item.drawing_no && item.drawing_no !== 'N/A' ? ` [Drg: ${item.drawing_no}]` : ''}`
                        };
                      })}
                      value={selectedNewItem?.item_code || ''}
                      onChange={(e) => {
                        const item = allStockItems.find(i => i.item_code === e.target.value);
                        setSelectedNewItem(item || null);
                        if (item) {
                          setNewItemQty(1);
                          setNewItemUnit(item.unit || item.uom || 'Nos');
                          
                          // Group mapping
                          const ig = (item.material_type || item.item_group || "").toLowerCase().replace(/_/g, ' ').trim();
                          const matchingGroup = itemGroups.find(g => {
                            const gName = g.name.toLowerCase().replace(/_/g, ' ').trim();
                            return gName === ig || ig.includes(gName) || gName.includes(ig);
                          });
                          setNewItemItemGroup(matchingGroup ? matchingGroup.name : item.material_type || item.item_group || '');

                          setNewItemWeight(parseFloat(item.weight_per_unit || 0));
                          
                          // Material Type
                          const materialObj = materials.find(m => String(m.id) === String(item.material_id));
                          setNewItemMaterialId(item.material_id || '');
                          setNewItemMaterialType(materialObj ? materialObj.name : item.material_grade || '');
                          setNewItemDensity(materialObj ? parseFloat(materialObj.density) : parseFloat(item.density || 0));
                          
                          // Shape Type
                          const shapeObj = shapes.find(s => String(s.id) === String(item.shape_id));
                          setNewItemShapeId(item.shape_id || '');
                          setNewItemShapeType(shapeObj ? shapeObj.name : '');

                          setNewItemLength('');
                          setNewItemWidth('');
                          setNewItemThickness('');
                          setNewItemDiameter('');
                          setNewItemOuterDiameter('');
                          setNewItemRate(item.valuation_rate || 0);
                        } else {
                          setNewItemQty(1);
                          setNewItemUnit('');
                          setNewItemItemGroup('');
                          setNewItemWeight('');
                          setNewItemMaterialId('');
                          setNewItemMaterialType('');
                          setNewItemDensity(0);
                          setNewItemShapeId('');
                          setNewItemShapeType('');
                          setNewItemLength('');
                          setNewItemWidth('');
                          setNewItemThickness('');
                          setNewItemDiameter('');
                          setNewItemOuterDiameter('');
                          setNewItemRate('');
                        }
                      }}
                      subLabelField="subLabel"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 ml-1 block font-medium">Quantity <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0.00"
                      step="any"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 ml-1 block font-medium">UOM</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                    >
                      {['NOS', 'KG', 'MTR', 'SET', 'LTR', 'SQM', 'GM', 'TON'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4 space-y-1">
                    <label className="text-xs text-slate-500 ml-1 block font-medium">Item Group</label>
                    <select
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newItemItemGroup}
                      onChange={(e) => setNewItemItemGroup(e.target.value)}
                    >
                      <option value="">Select Group</option>
                      {itemGroups.map(group => (
                        <option key={group.id} value={group.name}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newItemUnit.toUpperCase() === 'KG' && (
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5 space-y-1">
                      <label className="text-xs text-slate-500 ml-1 block font-medium font-semibold">Select Material Type</label>
                      <select
                        className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={newItemMaterialId || ''}
                        onChange={(e) => {
                          const mId = e.target.value;
                          const selectedMat = materials.find(m => String(m.id) === String(mId));
                          setNewItemMaterialId(mId);
                          setNewItemMaterialType(selectedMat ? selectedMat.name : '');
                          setNewItemDensity(selectedMat ? parseFloat(selectedMat.density) : 0);
                        }}
                      >
                        <option value="">Select Material</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.density ? `[Density = ${parseFloat(m.density).toFixed(4)} ${m.density_unit || 'g/cm³'}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-5 space-y-1">
                      <label className="text-xs text-slate-500 ml-1 block font-medium font-semibold">Select Shape Type</label>
                      <select
                        className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={newItemShapeId || ''}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const selectedShp = shapes.find(s => String(s.id) === String(sId));
                          setNewItemShapeId(sId);
                          setNewItemShapeType(selectedShp ? selectedShp.name : '');
                          // Clear dimension values on shape change to start fresh
                          setNewItemLength('');
                          setNewItemWidth('');
                          setNewItemThickness('');
                          setNewItemDiameter('');
                          setNewItemOuterDiameter('');
                        }}
                      >
                        <option value="">Select Shape</option>
                        {shapes.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label className="text-xs text-slate-500 ml-1 block font-medium font-semibold">Weight/Unit (Kg)</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500 outline-none"
                        value={newItemWeight ? parseFloat(newItemWeight).toFixed(3) : ''}
                        disabled
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                )}

                {newItemUnit.toUpperCase() === 'KG' && newItemShapeType && (
                  <div className="p-3 bg-white rounded border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold">
                      <div className="w-1.5 h-1.5 rounded bg-indigo-500"></div>
                      {newItemShapeType} Dimensions (All in mm)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      {newItemShapeType.toLowerCase() === 'plate' && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Length (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Width (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemWidth}
                              onChange={(e) => setNewItemWidth(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Thickness (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemThickness}
                              onChange={(e) => setNewItemThickness(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {newItemShapeType.toLowerCase() === 'round' && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Diameter (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemDiameter}
                              onChange={(e) => setNewItemDiameter(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Length (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {newItemShapeType.toLowerCase() === 'pipe' && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Outer Diameter (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemOuterDiameter}
                              onChange={(e) => setNewItemOuterDiameter(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Thickness (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemThickness}
                              onChange={(e) => setNewItemThickness(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Length (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {newItemShapeType.toLowerCase().includes('square tube') && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Outside Side (A) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemWidth}
                              onChange={(e) => setNewItemWidth(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Wall Thickness (T) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemThickness}
                              onChange={(e) => setNewItemThickness(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Length (L) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {newItemShapeType.toLowerCase().includes('rectangular tube') && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Width (B) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemWidth}
                              onChange={(e) => setNewItemWidth(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Height (H) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemOuterDiameter}
                              onChange={(e) => setNewItemOuterDiameter(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Wall Thickness (T) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemThickness}
                              onChange={(e) => setNewItemThickness(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Length (L) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {newItemShapeType.toLowerCase() === 'hexagonal bar' && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Across Flats (AF) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemWidth}
                              onChange={(e) => setNewItemWidth(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-medium">Length (L) (mm)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-9 space-y-1">
                    <label className="text-xs text-slate-500 ml-1 block font-medium">Remarks (Optional)</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Enter remarks..."
                      value={newItemRemarks}
                      onChange={(e) => setNewItemRemarks(e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 flex gap-2">
                    <button
                      onClick={async () => {
                        if (!selectedNewItem || newItemQty <= 0) return;
                        const itemCode = selectedNewItem.item_code;
                        const itemName = selectedNewItem.material_name || selectedNewItem.itemName;

                        const isKg = newItemUnit.toUpperCase() === 'KG';

                        const exists = mrItems.some(item => {
                          if (item.item_code !== itemCode) return false;
                          if (isKg) {
                            return String(item.length || '') === String(newItemLength || '') &&
                                   String(item.width || '') === String(newItemWidth || '') &&
                                   String(item.thickness || '') === String(newItemThickness || '') &&
                                   String(item.diameter || '') === String(newItemDiameter || '') &&
                                   String(item.outer_diameter || '') === String(newItemOuterDiameter || '');
                          }
                          return true;
                        });

                        if (exists) {
                          errorToast('Item with same code and dimensions already exists in the request list');
                          return;
                        }

                        let finalLen = 0;
                        let finalWid = 0;
                        let finalThk = 0;
                        let finalDia = 0;
                        let finalOd = 0;

                        if (isKg) {
                          const shape = (newItemShapeType || '').toLowerCase().trim();
                          if (shape === 'plate') {
                            finalLen = parseFloat(newItemLength) || 0;
                            finalWid = parseFloat(newItemWidth) || 0;
                            finalThk = parseFloat(newItemThickness) || 0;
                          } else if (shape === 'round') {
                            finalLen = parseFloat(newItemLength) || 0;
                            finalDia = parseFloat(newItemDiameter) || 0;
                          } else if (shape === 'pipe') {
                            finalLen = parseFloat(newItemLength) || 0;
                            finalThk = parseFloat(newItemThickness) || 0;
                            finalOd = parseFloat(newItemOuterDiameter) || 0;
                          } else if (shape.includes('square tube')) {
                            finalLen = parseFloat(newItemLength) || 0;
                            finalWid = parseFloat(newItemWidth) || 0;
                            finalThk = parseFloat(newItemThickness) || 0;
                          } else if (shape.includes('rectangular tube')) {
                            finalLen = parseFloat(newItemLength) || 0;
                            finalWid = parseFloat(newItemWidth) || 0;
                            finalThk = parseFloat(newItemThickness) || 0;
                            finalOd = parseFloat(newItemOuterDiameter) || 0;
                          } else if (shape === 'hexagonal bar') {
                            finalLen = parseFloat(newItemLength) || 0;
                            finalWid = parseFloat(newItemWidth) || 0;
                          }
                        }

                        const payload = {
                          item_code: itemCode,
                          material_name: itemName,
                          quantity: isKg ? (parseFloat(newItemWeight || 0) * Number(newItemQty)) : Number(newItemQty),
                          design_qty: Number(newItemQty),
                          remarks: newItemRemarks || null,
                          uom: newItemUnit || selectedNewItem.unit || selectedNewItem.uom || 'Nos',
                          rate: newItemRate || selectedNewItem.valuation_rate || 0,
                          warehouse: 'Consumables Store',
                          is_manual: true,
                          shape_type: isKg ? (newItemShapeType || '') : '',
                          weight_per_unit: isKg ? parseFloat(newItemWeight || 0) : 0,
                          density: isKg ? parseFloat(newItemDensity || 0) : 0,
                          length: finalLen,
                          width: finalWid,
                          thickness: finalThk,
                          diameter: finalDia,
                          outer_diameter: finalOd
                        };

                        try {
                          const token = localStorage.getItem('authToken');
                          const saveRes = await fetch(`${API_BASE}/production-plans/${mrPlanDetails.id}/materials`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                          });

                          if (!saveRes.ok) {
                            const err = await saveRes.json();
                            errorToast(err.message || 'Failed to save material');
                            return;
                          }

                          // Refresh items from server so manual item persists
                          const refreshRes = await fetch(`${API_BASE}/production-plans/material-request-items/${mrPlanDetails.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          if (refreshRes.ok) {
                            const data = await refreshRes.json();
                            const items = (data.items || []).filter(item => {
                              const code = (item.item_code || '').toUpperCase().trim();
                              return !code.startsWith('ASSEMBLY');
                            });
                            setMrItems(items);
                          }
                        } catch (e) {
                          errorToast('Failed to save material');
                          return;
                        }

                        setShowAddItem(false);
                        setSelectedNewItem(null);
                        setNewItemQty(1);
                        setNewItemRemarks('');
                        setNewItemUnit('');
                        setNewItemItemGroup('');
                        setNewItemWeight('');
                        setNewItemMaterialType('');
                        setNewItemShapeType('');
                        setNewItemLength('');
                        setNewItemWidth('');
                        setNewItemThickness('');
                        setNewItemDiameter('');
                        setNewItemOuterDiameter('');
                        setNewItemRate('');
                      }}
                      disabled={!selectedNewItem || !newItemQty || newItemQty <= 0}
                      className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm transition-all"
                    >
                      + Add Material
                    </button>

                    <button
                      onClick={() => setShowAddItem(false)}
                      className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-[400px]">
              <DataTable
                columns={mrColumns}
                data={mrItems}
                searchPlaceholder="Search request items..."
                searchKey="material_name"
                pageSize={100}
                className="border border-slate-100 rounded overflow-hidden"
              />
            </div>
          </div>
          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-6 border-t border-slate-100">
            <button
              onClick={() => setMrModalOpen(false)}
              disabled={transmittingMr}
              className="p-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Close
            </button>
            {mrItems.length > 0 && mrItems.some(item => !item.request_exists) && (
              <button
                onClick={confirmTransmitMR}
                disabled={transmittingMr}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded  hover:bg-slate-800 transition-all text-xs  shadow-lg shadow-slate-200 disabled:opacity-50"
              >
                {transmittingMr ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded animate-spin" />
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



      {/* Configure Work Order Modal */}
      <Modal
        isOpen={configModalOpen}
        onClose={() => !initiatingProduction && setConfigModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg text-slate-800  ">Configure Work Order</h2>
              <div className="flex items-center gap-1 text-xs text-indigo-500   ">
                <Activity className="w-3 h-3" />
                Strategy Implementation Phase
              </div>
            </div>
          </div>
        }
        size="5xl"
      >
        <div className="space-y-6">
          {/* Header Info Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">Item Code</label>
              <div className="text-sm  text-slate-800 truncate">{selectedPlanConfig?.item_code || '---'}</div>
            </div>
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">BOM Reference</label>
              <div className="text-sm  text-slate-800 truncate">{selectedPlanConfig?.bom_no || '---'}</div>
            </div>
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">Target Qty</label>
              <div className="text-sm  text-slate-800">{selectedPlanConfig?.target_qty || 0} Units</div>
            </div>
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <label className="text-xs text-slate-400    block mb-1">Priority</label>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-amber-500 " />
                <span className="text-xs  text-amber-600 ">Medium</span>
              </div>
            </div>
          </div>

          {/* Configuration Tabs */}
          <div className="space-y-4">
            <div className="flex items-center gap-8 border-b border-slate-100">
              <button
                onClick={() => setActiveConfigTab('ops')}
                className={`pb-3 text-xs    transition-all relative ${activeConfigTab === 'ops' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Operational Sequence ({selectedPlanConfig?.operations?.length || 0})
                {activeConfigTab === 'ops' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 " />}
              </button>
              <button
                onClick={() => setActiveConfigTab('mats')}
                className={`pb-3 text-xs    transition-all relative ${activeConfigTab === 'mats' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Resource Allocation ({selectedPlanConfig?.materials?.length || 0})
                {activeConfigTab === 'mats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 " />}
              </button>
            </div>

            <div className="min-h-[300px] max-h-[450px] overflow-y-auto custom-scrollbar">
              {activeConfigTab === 'ops' ? (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-2  text-slate-400  ">Item / Operation</th>
                      <th className="py-3 px-2  text-slate-400  ">Workstation</th>
                      <th className="py-3 px-2  text-slate-400  ">Process Type</th>
                      <th className="py-3 px-2  text-slate-400   text-right">Net Time (M/U)</th>
                      <th className="py-3 px-2  text-slate-400   text-right text-indigo-500">Execution Time</th>
                      <th className="py-3 px-2  text-slate-400   text-right">Rate/Hr</th>
                      <th className="py-3 px-2  text-slate-400   text-right text-emerald-600">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 ">
                    {selectedPlanConfig?.operations?.length > 0 ? (
                      selectedPlanConfig.operations.map((op, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-indigo-400 " />
                              <div>
                                <span className="text-slate-700 ">{op.operation_name}</span>
                                <div className="text-xs  text-slate-400 font-normal  flex items-center gap-1">
                                  {(() => {
                                    const itemCodeStr = (op.source_item || op.itemCode || '').toUpperCase();
                                    const displayType = itemCodeStr.startsWith('ASSEMBLY-')
                                      ? 'ASSEMBLY'
                                      : (itemCodeStr.startsWith('PART-')
                                        ? 'PART'
                                        : (op.item_type === 'FG' ? 'ASSEMBLY' : 'PART')
                                      );
                                    const isAssembly = displayType === 'ASSEMBLY';
                                    return (
                                      <span className={isAssembly ? 'text-indigo-500' : 'text-rose-500'}>
                                        {displayType}:
                                      </span>
                                    );
                                  })()}
                                  <span className="text-slate-500">{op.source_item || op.itemCode || 'Main Item'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-slate-500">{op.workstation || 'Unassigned'}</td>
                          <td className="py-4 px-2 text-slate-500">
                            <span className={`p-1  text-xs    ${(op.process_type || op.operation_type || 'In-House') === 'Sub-Contract'
                              ? 'bg-amber-50 text-amber-600 border border-amber-100'
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                              }`}>
                              {op.process_type || op.operation_type || 'In-House'}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right text-slate-400 ">{parseFloat(op.cycle_time_min) || Math.round(parseFloat(op.net_time || op.base_time || 0) * 60)} min</td>
                          <td className="py-4 px-2 text-right text-indigo-600 font-semibold ">
                            {Math.round(
                              ((parseFloat(op.cycle_time_min) || (parseFloat(op.net_time || op.base_time || 0) * 60)) * (selectedPlanConfig.target_qty || 1)) +
                              parseFloat(op.setup_time_min || 0)
                            )} min
                          </td>
                          <td className="py-4 px-2 text-right text-slate-400">₹{op.hourly_rate || 0}</td>
                          <td className="py-4 px-2 text-right  text-emerald-600">₹{(parseFloat(op.base_time || 0) * (selectedPlanConfig.target_qty || 1) * parseFloat(op.hourly_rate || 0)).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400 italic">No manufacturing operations defined</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-2  text-slate-400  ">Component</th>
                      <th className="py-3 px-2  text-slate-400   text-right">Required</th>
                      <th className="py-3 px-2  text-slate-400   text-right">Available</th>
                      <th className="py-3 px-2  text-slate-400   text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 ">
                    {selectedPlanConfig?.materials?.length > 0 ? (
                      selectedPlanConfig.materials.map((mat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-2">
                            <div className=" text-slate-700">{mat.item_code}</div>
                            <div className="text-xs text-slate-400   mt-0.5">{mat.material_name}</div>
                          </td>
                          <td className="py-4 px-2 text-right  text-slate-900">{mat.required_qty} <span className="text-slate-400 font-normal">{mat.uom}</span></td>
                          <td className="py-4 px-2 text-right  text-slate-500">0.00 <span className="text-slate-400 font-normal">{mat.uom}</span></td>
                          <td className="py-4 px-2 text-center">
                            <div className="w-4 h-4 bg-rose-50 text-rose-500  flex items-center justify-center mx-auto border border-rose-100">
                              <AlertCircle className="w-3 h-3" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-400 italic">No material allocations defined</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600  border border-emerald-100 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs   ">All Stocks Verified</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfigModalOpen(false)}
                className="p-2 text-xs  text-slate-400 hover:text-slate-600 transition-colors  "
              >
                Discard
              </button>
              {selectedPlanConfig?.wo_count === 0 && (
                <button
                  onClick={() => handleCreateWorkOrders(selectedPlanConfig.id)}
                  disabled={initiatingProduction}
                  className="flex items-center gap-2 p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-all text-xs  shadow-sm shadow-indigo-100 disabled:opacity-50"
                >
                  {initiatingProduction ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Work Order
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductionPlan;

