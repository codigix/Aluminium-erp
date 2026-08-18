import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, Package, Clock, CheckCircle2,
  AlertCircle, Truck, FileText, LayoutGrid, List, Filter, GitMerge
} from 'lucide-react';
import { Card, DataTable, SearchableSelect, Button, Tabs } from '../components/ui.jsx';
import PurchaseOrderDetail from './PurchaseOrderDetail.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700', label: 'draft', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  PO_REQUEST: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700', label: 'po request', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ORDERED: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700', label: 'ordered', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700', label: 'sent', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
  ACKNOWLEDGED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-50 text-cyan-700', label: 'acknowledged', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  RECEIVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'received', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
  PARTIALLY_RECEIVED: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700', label: 'partially received', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
  APPROVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'approved', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  PENDING_PAYMENT: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700', label: 'pending payment', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  PAID: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'paid', icon: 'M5 13l4 4L19 7' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-50 text-slate-700', label: 'closed', icon: 'M5 13l4 4L19 7' },
  FULFILLED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'fulfilled', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  COMPLETED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'completed', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  MERGED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-50 text-purple-700', label: 'merged', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  if (value === 0) return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(0);
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const PurchaseOrders = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [pos, setPos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    const path = location.pathname;

    if (path === `${deptPrefix}/purchase-orders/add`) {
      if (!showCreateModal) {
        setFormData({
          quotationId: '',
          projectName: '',
          quoteNumber: '',
          poNumber: '',
          vendorName: '',
          expectedDeliveryDate: '',
          notes: ''
        });
        setShowCreateModal(true);
        setShowManualCreateModal(false);
        setViewMode('list');
      }
    } else if (path === `${deptPrefix}/purchase-orders/manual-add`) {
      if (!showManualCreateModal) {
        setManualFormData({ id: null, vendorId: '', quotationId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
        setShowManualCreateModal(true);
        setShowCreateModal(false);
        setViewMode('list');
      }
    } else if (path.startsWith(`${deptPrefix}/purchase-orders/edit-manual/`)) {
      const id = path.split('/').pop();
      const po = pos.find(p => p.id.toString() === id);
      if (po && po.status === 'PO_REQUEST') {
        if (!showManualCreateModal || manualFormData.id !== po.id) {
          handleEditPO(po.id);
          setShowManualCreateModal(true);
          setShowCreateModal(false);
          setViewMode('list');
        }
      }
    } else if (path.startsWith(`${deptPrefix}/purchase-orders/view/`)) {
      const id = path.split('/').pop();
      if (id && (viewMode !== 'detail' || selectedPO?.id?.toString() !== id.toString())) {
        handleViewPODetail(id);
        setShowCreateModal(false);
        setShowManualCreateModal(false);
      }
    } else if (path === `${deptPrefix}/purchase-orders`) {
      if (showCreateModal) {
        setShowCreateModal(false);
        setPoItems([]);
      }
      if (showManualCreateModal) {
        setShowManualCreateModal(false);
        setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
      }
      if (viewMode === 'detail') {
        setViewMode('list');
        setSelectedPO(null);
      }
    }
  }, [location.pathname, pos, deptPrefix]);

  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    message: '',
    attachPDF: true
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [poSuggestions, setPoSuggestions] = useState([]);
  const [isManualPo, setIsManualPo] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    quotationId: '',
    projectName: '',
    quoteNumber: '',
    poNumber: '',
    vendorName: '',
    expectedDeliveryDate: '',
    notes: ''
  });
  const [editFormData, setEditFormData] = useState({
    expectedDeliveryDate: '',
    notes: '',
    status: '',
    vendorId: ''
  });

  const [vendors, setVendors] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [showManualCreateModal, setShowManualCreateModal] = useState(false);
  const invoiceInputRef = useRef(null);
  const [uploadingPoId, setUploadingPoId] = useState(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedPoForAttachment, setSelectedPoForAttachment] = useState(null);
  const [selectedAttachmentFiles, setSelectedAttachmentFiles] = useState([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    id: null,
    vendorId: '',
    quotationId: '',
    expectedDeliveryDate: '',
    notes: '',
    currency: 'INR (Indian Rupee)',
    discountType: 'AMOUNT',
    discountValue: 0,
    items: []
  });

  // Merge PO Wizard State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeStep, setMergeStep] = useState(1);
  const [mergeSupplierId, setMergeSupplierId] = useState('');
  const [eligiblePOs, setEligiblePOs] = useState([]);
  const [selectedPoIdsForMerge, setSelectedPoIdsForMerge] = useState([]);
  const [mergedItems, setMergedItems] = useState([]);
  const [mergeNotes, setMergeNotes] = useState('');
  const [mergeExpectedDeliveryDate, setMergeExpectedDeliveryDate] = useState('');
  const [mergeSearchTerm, setMergeSearchTerm] = useState('');


  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.department_code === 'ADMIN' || parsedUser.department_code === 'PROCUREMENT' || parsedUser.department_code === 'INVENTORY' || parsedUser.department_code === 'SALES') {
        fetchPOs();
        fetchStats();
        fetchApprovedQuotations();
        fetchVendors();
        fetchStockItems();
        fetchMaterialRequests();
      }
    } else {
      fetchPOs();
      fetchStats();
      fetchApprovedQuotations();
      fetchVendors();
      fetchStockItems();
      fetchMaterialRequests();
    }
  }, []);

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchStockItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const filteredData = (Array.isArray(data) ? data : []).filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
        setStockItems(filteredData);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const handleManualQuotationChange = async (quotationId) => {
    if (!quotationId) {
      setManualFormData(prev => ({ ...prev, quotationId: '', vendorId: '', items: [] }));
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const quotationData = await response.json();
        const quoteItems = (quotationData.items || [])
          .filter(item => {
            const type = (item.material_type || '').toUpperCase();
            return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
          })
          .map(item => ({
            item_code: item.item_code,
            description: item.item_name || item.description || item.item_code,
            material_name: item.material_name,
            quantity: item.quantity || 0,
            unit: item.uom || item.unit || 'NOS',
            rate: item.unit_rate || item.rate || 0,
            amount: (item.quantity || 0) * (item.unit_rate || item.rate || 0),
            length: item.length || 0,
            width: item.width || 0,
            thickness: item.thickness || 0,
            diameter: item.diameter || 0,
            outer_diameter: item.outer_diameter || 0,
            density: item.density || 0,
            weight_per_unit: item.weight_per_unit || 0
          }));

        setManualFormData(prev => ({
          ...prev,
          quotationId: quotationId,
          vendorId: quotationData.vendor_id || '',
          items: quoteItems,
          notes: quotationData.notes || prev.notes
        }));
      }
    } catch (error) {
      console.error('Error fetching Quotation details:', error);
      errorToast('Failed to load Quotation details');
    }
  };

  const handleAddManualItem = () => {
    setManualFormData({
      ...manualFormData,
      items: [
        ...manualFormData.items,
        { item_code: '', description: '', quantity: 0, unit: 'NOS', rate: 0, amount: 0 }
      ]
    });
  };

  const handleManualItemChange = (index, field, value) => {
    const newItems = [...manualFormData.items];
    newItems[index][field] = value;

    if (field === 'item_code') {
      const selectedItem = stockItems.find(i => String(i.item_code) === String(value));
      if (selectedItem) {
        newItems[index].description = selectedItem.item_description || selectedItem.material_name || selectedItem.description;
        newItems[index].material_name = selectedItem.material_name;
        newItems[index].unit = selectedItem.unit || 'NOS';
        newItems[index].rate = selectedItem.valuation_rate || 0;
        newItems[index].length = selectedItem.length || 0;
        newItems[index].width = selectedItem.width || 0;
        newItems[index].thickness = selectedItem.thickness || 0;
        newItems[index].diameter = selectedItem.diameter || 0;
        newItems[index].outer_diameter = selectedItem.outer_diameter || 0;
        newItems[index].density = selectedItem.density || 0;
        newItems[index].weight_per_unit = selectedItem.weight_per_unit || 0;
      }
    }

    // Always recalculate amount on any change to quantity or rate
    const qty = parseFloat(newItems[index].quantity) || 0;
    const rate = parseFloat(newItems[index].rate) || 0;
    newItems[index].amount = qty * rate;

    setManualFormData({ ...manualFormData, items: newItems });
  };

  const handleRemoveManualItem = (index) => {
    const newItems = manualFormData.items.filter((_, i) => i !== index);
    setManualFormData({ ...manualFormData, items: newItems });
  };

  const handleOpenMergeModal = () => {
    setMergeStep(1);
    setMergeSupplierId('');
    setEligiblePOs([]);
    setSelectedPoIdsForMerge([]);
    setMergedItems([]);
    setMergeNotes('');
    setMergeExpectedDeliveryDate('');
    setShowMergeModal(true);
  };

  const handleSupplierChangeForMerge = async (vendorId) => {
    setMergeSupplierId(vendorId);
    setSelectedPoIdsForMerge([]);
    setEligiblePOs([]);
    if (!vendorId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders?vendorId=${vendorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Keep only DRAFT and PO_REQUEST status POs
        const draftOrRequest = data.filter(p => ['DRAFT', 'PO_REQUEST'].includes(p.status));
        setEligiblePOs(draftOrRequest);
      }
    } catch (error) {
      console.error(error);
      errorToast('Failed to fetch eligible Purchase Orders');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePoSelectionForMerge = (poId) => {
    setSelectedPoIdsForMerge(prev =>
      prev.includes(poId) ? prev.filter(id => id !== poId) : [...prev, poId]
    );
  };

  const handleProceedToMergeForm = async () => {
    if (selectedPoIdsForMerge.length === 0) {
      return errorToast('Please select at least one Purchase Order to merge');
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      // Fetch details of each selected PO to get its line items
      const poDetails = await Promise.all(
        selectedPoIdsForMerge.map(async (poId) => {
          const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error(`Failed to load details for PO ID: ${poId}`);
          return response.json();
        })
      );

      // Consolidate all items
      let consolidated = [];
      poDetails.forEach(po => {
        const items = po.items || [];
        items.forEach(item => {
          consolidated.push({
            ...item,
            source_po_id: po.id,
            source_po_item_id: item.id,
            sales_order_id: po.sales_order_id,
            mr_id: po.mr_id,
            project_name: po.project_name || '—',
            rate: parseFloat(item.unit_rate || item.rate || 0),
            unit_rate: parseFloat(item.unit_rate || item.rate || 0)
          });
        });
      });

      setMergedItems(consolidated);
      setMergeStep(3);
    } catch (error) {
      console.error(error);
      errorToast(error.message || 'Failed to prepare merged items list');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMergedPO = async () => {
    if (mergedItems.length === 0) {
      return errorToast('No items to merge. Please add or restore items');
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: mergeSupplierId,
          sourcePoIds: selectedPoIdsForMerge,
          items: mergedItems,
          notes: mergeNotes,
          expectedDeliveryDate: mergeExpectedDeliveryDate || null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to merge POs');
      }

      successToast('Purchase Orders merged successfully');
      setShowMergeModal(false);
      fetchPOs(false);
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to merge Purchase Orders');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMergedItem = (idxToRemove) => {
    setMergedItems(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleMergedItemChange = (idx, field, val) => {
    setMergedItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleCreateManualPO = async (e) => {
    e.preventDefault();
    if (!manualFormData.quotationId) return errorToast('Please select an approved quote');
    if (!manualFormData.vendorId) return errorToast('Please select a vendor');
    if (manualFormData.items.length === 0) return errorToast('Please add at least one item');

    try {
      const token = localStorage.getItem('authToken');
      // Calculate totals for consistency
      const subtotal = manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const discVal = parseFloat(manualFormData.discountValue) || 0;
      let discAmt = 0;
      if (discVal > 0) {
        if (manualFormData.discountType === 'PERCENTAGE') {
          discAmt = (subtotal * discVal) / 100;
        } else {
          discAmt = Math.min(discVal, subtotal);
        }
      }

      const payload = {
        vendorId: parseInt(manualFormData.vendorId),
        quotationId: manualFormData.quotationId ? parseInt(manualFormData.quotationId) : null,
        expectedDeliveryDate: manualFormData.expectedDeliveryDate || null,
        notes: manualFormData.notes || null,
        currency: manualFormData.currency?.split(' ')[0] || 'INR',
        discount_type: manualFormData.discountType || 'AMOUNT',
        discount_value: discVal,
        discount_amount: discAmt,
        total_amount: Math.max(0, subtotal - discAmt) * 1.18,
        status: manualFormData.id ? 'DRAFT' : undefined,
        items: manualFormData.items.map(item => ({
          id: item.id || undefined,
          item_code: item.item_code,
          description: item.description,
          material_name: item.material_name,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || 'NOS',
          rate: parseFloat(item.rate) || 0,
          amount: parseFloat(item.amount) || 0,
          length: item.length || 0,
          width: item.width || 0,
          thickness: item.thickness || 0,
          diameter: item.diameter || 0,
          outer_diameter: item.outer_diameter || 0,
          density: item.density || 0,
          weight_per_unit: item.weight_per_unit || 0
        }))
      };

      const url = manualFormData.id
        ? `${API_BASE}/purchase-orders/${manualFormData.id}`
        : `${API_BASE}/purchase-orders`;
      const method = manualFormData.id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${manualFormData.id ? 'update' : 'create'} PO`);
      }

      successToast(`Purchase Order ${manualFormData.id ? 'updated' : 'created'} successfully`);
      navigate(`${deptPrefix}/purchase-orders`);
      fetchPOs(false);
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to create PO');
    }
  };

  const fetchMaterialRequests = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Only show relevant MRs (not fulfilled or already created as PO)
        setMaterialRequests((Array.isArray(data) ? data : []).filter(mr =>
          !['FULFILLED', 'PO_CREATED', 'CANCELLED', 'REJECTED'].includes((mr.status || '').toUpperCase())
        ));
      }
    } catch (error) {
      console.error('Error fetching MRs:', error);
    }
  };

  const fetchPOs = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch POs');
      const data = await response.json();
      setPos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching POs:', error);
      setPos([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleAttachmentModalFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setSelectedAttachmentFiles(prev => [...prev, ...selected]);
    e.target.value = ''; // Reset input so same files can be re-selected
  };

  const handleRemoveStagedFile = (index) => {
    setSelectedAttachmentFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadPoAttachments = async () => {
    if (!selectedPoForAttachment) return;

    setIsUploadingAttachments(true);
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();

      // Append new files
      selectedAttachmentFiles.forEach(file => {
        formData.append('invoice', file);
      });

      // Keep existing files
      const existing = (selectedPoForAttachment.invoice_url || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .join(',');

      formData.append('existing_attachments', existing);

      const response = await fetch(`${API_BASE}/purchase-orders/${selectedPoForAttachment.id}/invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const resData = await response.json();
        successToast('Attachments uploaded successfully');

        // Update selected PO attachments state locally
        const updatedPo = { ...selectedPoForAttachment, invoice_url: resData.paths.join(',') };
        setSelectedPoForAttachment(updatedPo);
        setSelectedAttachmentFiles([]);

        // Refresh PO lists
        fetchPOs(false);
        fetchStats();
      } else {
        const err = await response.json();
        errorToast(err.message || 'Failed to upload attachments');
      }
    } catch (error) {
      console.error(error);
      errorToast('Error uploading attachments');
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleDeletePoAttachment = async (filePathToDelete) => {
    if (!selectedPoForAttachment) return;

    const result = await Swal.fire({
      title: 'Remove attachment?',
      text: 'This will permanently remove the attachment from the PO record.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    setIsUploadingAttachments(true);
    try {
      const token = localStorage.getItem('authToken');

      // Filter out the file path
      const remaining = (selectedPoForAttachment.invoice_url || '')
        .split(',')
        .map(p => p.trim())
        .filter(p => p !== filePathToDelete && p.length > 0)
        .join(',');

      const formData = new FormData();
      formData.append('existing_attachments', remaining);

      // Call the API with no new files, just remaining existing attachments
      const response = await fetch(`${API_BASE}/purchase-orders/${selectedPoForAttachment.id}/invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const resData = await response.json();
        successToast('Attachment removed successfully');

        // Update selected PO attachments state locally
        const updatedPo = { ...selectedPoForAttachment, invoice_url: resData.paths.join(',') };
        setSelectedPoForAttachment(updatedPo);

        // Refresh PO lists
        fetchPOs(false);
        fetchStats();
      } else {
        const err = await response.json();
        errorToast(err.message || 'Failed to remove attachment');
      }
    } catch (error) {
      console.error(error);
      errorToast('Error removing attachment');
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchApprovedQuotations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setQuotations(Array.isArray(data) ? data.filter(q => q.status === 'REVIEWED') : []);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    }
  };

  const handleQuotationChange = async (quotationId) => {
    const selected = quotations.find(q => String(q.id) === String(quotationId));
    if (selected) {
      setFormData({
        ...formData,
        quotationId,
        vendorName: selected.vendor_name || 'Unknown Vendor'
      });

      // Fetch preview and quotation details to get suggested PO number and items
      try {
        const token = localStorage.getItem('authToken');
        const [previewRes, quotationRes] = await Promise.all([
          fetch(`${API_BASE}/purchase-orders/preview/${quotationId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch(`${API_BASE}/quotations/${quotationId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          })
        ]);

        if (previewRes.ok && quotationRes.ok) {
          const preview = await previewRes.json();
          const detailedQuotation = await quotationRes.json();

          const suggestions = [preview.poNumber];
          if (selected.quote_number && selected.quote_number !== preview.poNumber) {
            suggestions.push(selected.quote_number);
          }

          setPoSuggestions(suggestions);
          setIsManualPo(false);
          const filteredItems = (detailedQuotation.items || []).filter(item => {
            const type = (item.material_type || '').toUpperCase();
            return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
          });
          setPoItems(filteredItems);
          setFormData(prev => ({
            ...prev,
            quotationId,
            vendorName: selected.vendor_name || 'Unknown Vendor',
            poNumber: suggestions[0],
            projectName: preview.projectName || '',
            expectedDeliveryDate: preview.expectedDeliveryDate || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching PO preview or quotation:', error);
      }
    } else {
      setFormData({
        ...formData,
        quotationId: '',
        vendorName: '',
        poNumber: '',
        projectName: '',
        expectedDeliveryDate: ''
      });
      setPoSuggestions([]);
    }
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();

    if (!formData.poNumber) {
      errorToast('Please enter a PO Number');
      return;
    }

    if (!formData.quotationId) {
      errorToast('Please select a quotation');
      return;
    }

    if (!formData.expectedDeliveryDate) {
      errorToast('Please select an expected delivery date');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quotationId: parseInt(formData.quotationId),
          expectedDeliveryDate: formData.expectedDeliveryDate || null,
          notes: formData.notes || null,
          poNumber: formData.poNumber || null
        })
      });

      if (!response.ok) throw new Error('Failed to create PO');

      successToast('Purchase Order created successfully');
      setShowCreateModal(false);
      setPoItems([]);
      setFormData({ quotationId: '', projectName: '', quoteNumber: '', poNumber: '', vendorName: '', expectedDeliveryDate: '', notes: '' });
      fetchPOs(false);
      fetchStats();
      fetchApprovedQuotations();
    } catch (error) {
      errorToast(error.message || 'Failed to create PO');
    }
  };

  const handleViewPODetail = async (poId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');
      const data = await response.json();
      setSelectedPO(data);
      setViewMode('detail');
    } catch (error) {
      errorToast(error.message || 'Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPO = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');
      const data = await response.json();

      if (data.status === 'PO_REQUEST') {
        setManualFormData({
          id: data.id,
          vendorId: data.vendor_id || '',
          quotationId: data.quotation_id || '',
          expectedDeliveryDate: data.expected_delivery_date ? data.expected_delivery_date.split('T')[0] : '',
          notes: data.notes || '',
          currency: data.currency ? `${data.currency} (${data.currency === 'INR' ? 'Indian Rupee' : 'US Dollar'})` : 'INR (Indian Rupee)',
          discountType: data.discount_type || 'AMOUNT',
          discountValue: data.discount_value || 0,
          discountAmount: data.discount_amount || 0,
          items: (data.items || [])
            .filter(item => {
              const type = (item.material_type || '').toUpperCase();
              return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
            })
            .map(item => ({
              id: item.id,
              item_code: item.item_code || '',
              description: item.description || '',
              quantity: item.quantity || 0,
              unit: item.unit || 'NOS',
              rate: item.unit_rate || item.rate || 0,
              amount: item.amount || ((item.quantity || 0) * (item.unit_rate || item.rate || 0))
            }))
        });
        setShowManualCreateModal(true);
      } else {
        setSelectedPO(data);
        const filteredItems = (data.items || []).filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
        setPoItems(filteredItems);
        setEditFormData({
          expectedDeliveryDate: data.expected_delivery_date ? data.expected_delivery_date.split('T')[0] : '',
          notes: data.notes || '',
          status: data.status || '',
          vendorId: data.vendor_id || '',
          discountType: data.discount_type || 'AMOUNT',
          discountValue: data.discount_value || 0,
          discountAmount: data.discount_amount || 0
        });
        setShowEditModal(true);
      }
    } catch (error) {
      errorToast(error.message || 'Failed to load PO details');
    }
  };

  const handleEditItemChange = (index, field, value) => {
    const updatedItems = [...poItems];
    updatedItems[index][field] = value;

    if (field === 'item_code') {
      const selectedItem = stockItems.find(i => String(i.item_code) === String(value));
      if (selectedItem) {
        updatedItems[index].description = selectedItem.item_description || selectedItem.material_name || selectedItem.description;
        updatedItems[index].material_name = selectedItem.material_name;
        updatedItems[index].material_type = selectedItem.material_type;
        updatedItems[index].unit = selectedItem.unit || 'NOS';
        updatedItems[index].unit_rate = selectedItem.valuation_rate || 0;
        updatedItems[index].length = selectedItem.length || 0;
        updatedItems[index].width = selectedItem.width || 0;
        updatedItems[index].thickness = selectedItem.thickness || 0;
        updatedItems[index].diameter = selectedItem.diameter || 0;
        updatedItems[index].outer_diameter = selectedItem.outer_diameter || 0;
        updatedItems[index].density = selectedItem.density || 0;
        updatedItems[index].weight_per_unit = selectedItem.weight_per_unit || 0;
      }
    }

    // Always recalculate amount on any change to quantity or rate
    const qty = parseFloat(updatedItems[index].quantity) || 0;
    const rate = parseFloat(updatedItems[index].unit_rate) || 0;
    const amount = qty * rate;

    const cgstPercent = updatedItems[index].cgst_percent || 9;
    const sgstPercent = updatedItems[index].sgst_percent || 9;
    const cgstAmount = (amount * cgstPercent) / 100;
    const sgstAmount = (amount * sgstPercent) / 100;

    updatedItems[index].amount = amount;
    updatedItems[index].cgst_amount = cgstAmount;
    updatedItems[index].sgst_amount = sgstAmount;
    updatedItems[index].total_amount = amount + cgstAmount + sgstAmount;

    setPoItems(updatedItems);

    // Recalculate grand total for the selected PO
    const newGrandTotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
    setSelectedPO({ ...selectedPO, total_amount: newGrandTotal });
  };

  const handleAddEditItem = () => {
    const newItem = {
      item_code: '',
      description: '',
      material_name: '',
      quantity: 1,
      design_qty: 1,
      planned_qty: 1,
      unit: 'NOS',
      unit_rate: 0,
      amount: 0,
      cgst_percent: 9,
      cgst_amount: 0,
      sgst_percent: 9,
      sgst_amount: 0,
      total_amount: 0
    };
    setPoItems([...poItems, newItem]);
  };

  const handleRemoveEditItem = (index) => {
    const updatedItems = poItems.filter((_, idx) => idx !== index);
    setPoItems(updatedItems);
    // Recalculate grand total
    const newGrandTotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
    setSelectedPO({ ...selectedPO, total_amount: newGrandTotal });
  };

  const handleUpdatePO = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const subtotal = poItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const discVal = parseFloat(editFormData.discountValue) || 0;
      let discAmt = 0;
      if (discVal > 0) {
        if (editFormData.discountType === 'PERCENTAGE') {
          discAmt = (subtotal * discVal) / 100;
        } else {
          discAmt = Math.min(discVal, subtotal);
        }
      }

      const response = await fetch(`${API_BASE}/purchase-orders/${selectedPO.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: editFormData.status,
          poNumber: selectedPO.po_number,
          expectedDeliveryDate: editFormData.expectedDeliveryDate || null,
          notes: editFormData.notes,
          vendorId: editFormData.vendorId || null,
          discount_type: editFormData.discountType || 'AMOUNT',
          discount_value: discVal,
          discount_amount: discAmt,
          items: poItems
        })
      });

      if (!response.ok) throw new Error('Failed to update PO');

      successToast('Purchase Order updated successfully');
      setShowEditModal(false);
      fetchPOs();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update PO');
    }
  };

  const handleDeletePO = async (poId) => {
    const result = await Swal.fire({
      title: 'Delete PO?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    // Save previous POs list in case we need to roll back
    const previousPos = [...pos];

    // Optimistically update the list by removing the deleted PO
    setPos(prev => prev.filter(po => po.id !== poId));

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete PO');
      }

      successToast('Purchase Order deleted successfully');
      fetchPOs(false);
      fetchStats();
    } catch (error) {
      // Revert frontend state on failure
      setPos(previousPos);
      errorToast(error.message || 'Failed to delete PO');
    }
  };

  const handleDownloadPOInvoice = async (po) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments/vendor-invoice/${po.id}/pdf?type=PO`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate Tax Invoice PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tax_Invoice_${po.po_number || po.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      errorToast('Failed to download invoice');
    }
  };

  const handleSendToAccounts = async (po) => {
    const result = await Swal.fire({
      title: 'Send to Accounts?',
      html: `
        <div class="text-sm text-slate-600 space-y-3">
          <p>Are you sure you want to forward Purchase Order <strong>${po.po_number}</strong> to Accounts?</p>
          <p class="text-xs text-slate-500">This will automatically create a Vendor Invoice.</p>
          <hr class="my-3 border-slate-200" />
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">📄 Preview Invoice</span>
            <button id="swal-download-invoice-btn" type="button" class="px-2.5 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded transition-all">
              Download Invoice
            </button>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Send',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4f46e5',
      didOpen: () => {
        const dlBtn = document.getElementById('swal-download-invoice-btn');
        if (dlBtn) {
          dlBtn.addEventListener('click', () => {
            handleDownloadPOInvoice(po);
          });
        }
      }
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/purchase-orders/${po.id}/send-to-accounts`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to forward to Accounts');
        }

        successToast('Purchase Order has been forwarded to Accounts successfully.');
        fetchPOs(false);
        fetchStats();
      } catch (error) {
        console.error('Send to Accounts Error:', error);
        errorToast(error.message || 'Failed to forward to Accounts');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleApprovePO = async (poId) => {
    const po = pos.find(p => p.id === poId);
    if (po && po.status === 'PO_REQUEST' && !po.vendor_id) {
      // If it's a request without a vendor, open the edit flow instead of approving
      return handleEditPO(poId);
    }

    try {
      const result = await Swal.fire({
        title: 'Approve Purchase Order?',
        text: 'This will confirm the order and allow material receipts.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Approve It!'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/purchase-orders/${poId}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          successToast("Purchase Order approved successfully");
          fetchPOs(false);
          fetchStats();
        } else {
          const error = await response.json();
          errorToast(error.message || "Failed to approve PO");
        }
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPDF = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        errorToast('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast('Network error');
    }
  };

  const openEmailModal = async (po) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors/${po.vendor_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const vendor = response.ok ? await response.json() : null;

      setSelectedPO(po);
      setEmailData({
        to: vendor?.email || '',
        cc: '',
        bcc: '',
        subject: `Purchase Order: ${po.po_number}`,
        message: `Dear ${vendor?.vendor_name || 'Vendor'},\n\nPlease find attached our Purchase Order ${po.po_number}.\n\nRegards,\nSPTECHPIONEER Procurement Team`,
        attachPDF: true
      });
      setShowEmailModal(true);
    } catch (error) {
      console.error('Error:', error);
      errorToast('Failed to load vendor details');
    }
  };

  const handleSendEmail = (e) => {
    e.preventDefault();
    if (!emailData.to) return errorToast('Recipient email is required');
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${selectedPO.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        successToast('Purchase Order sent to vendor');
        setShowEmailModal(false);
        fetchPOs(false);
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast('Network error');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      label: 'PO Details',
      key: 'po_number',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className=" text-blue-600 cursor-pointer hover:underline text-xs ">
            {val || `PO-${String(row.id).padStart(4, '0')}`}
          </span>
          {row.is_merged ? (
            <span className="p-1 bg-purple-50 text-purple-600 rounded text-[9px] font-bold border border-purple-100 w-fit mt-1">
              MERGED PO
            </span>
          ) : null}
          <span className="text-xs text-slate-400  flex items-center gap-1 mt-0.5">
            {row.mr_number || (row.quotation_id ? `QT-${row.quotation_id}` : `ID-${row.id}`)}
          </span>
        </div>
      )
    },
    {
      label: 'Supplier',
      key: 'vendor_name',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col">
          <span className={` text-xs  ${!val ? 'text-rose-500 italic' : 'text-slate-700'}`}>
            {val || 'Vendor Not Selected'}
          </span>
          <span className="text-xs text-slate-400">
            {val ? 'Active Vendor' : 'Action Required'}
          </span>
        </div>
      )
    },
    {
      label: 'Drawing',
      key: 'drawing_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-[#111827] leading-[16px]">
            {row.drawing_no || '—'}
          </span>
          {row.finished_good && (
            <span className="text-[10px] text-[#6B7280] leading-[14px] mt-0.5">
              {row.finished_good}
            </span>
          )}
        </div>
      )
    },
    {
      label: 'Project / Customer',
      key: 'project_name',
      sortable: true,
      render: (val, row) => {
        if (row.project_count > 1) {
          return (
            <div className="flex flex-col py-1 min-w-[260px] max-w-[380px]">
              <div className="flex flex-col">
                <span className="text-slate-900 font-semibold text-[13px] leading-tight">
                  {row.project_count} Projects
                </span>
                <span className="text-[11px] text-slate-500 italic mt-0.5 break-words" title={row.merged_project_names}>
                  {row.merged_project_names}
                </span>
              </div>
            </div>
          );
        }
        if (!val) return '—';
        // Intelligent split: break at " for " to keep drawing numbers on top line
        const parts = val.split(/\s+for\s+/i);
        return (
          <div className="flex flex-col py-1 min-w-[260px] max-w-[380px]">
            <div className="flex flex-col">
              <span className="text-slate-900  text-[13px] leading-tight break-words">
                {parts[0]}
              </span>
              {parts.length > 1 && (
                <span className="text-[11px] text-slate-600  leading-relaxed mt-0.5 break-words">
                  for {parts.slice(1).join(' for ')}
                </span>
              )}
            </div>
            {row.company_name && (
              <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-100/80">
                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px]  rounded border border-indigo-100 shrink-0 uppercase tracking-wider">
                  Client
                </span>
                <span className="text-[11px] text-slate-500  italic truncate" title={row.company_name}>
                  {row.company_name}
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      label: 'Order -- Expected',
      key: 'expected_delivery_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5  text-xs text-slate-500 ">
            <svg className="w-2 h-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {formatDate(row.created_at)}
          </div>
          <svg className="w-2 h-2 text-emerald-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {formatDate(val)}
          </div>
        </div>
      )
    },
    {
      label: 'Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col">
          <span className=" text-slate-800 text-xs">{formatCurrency(val)}</span>
          <span className="text-xs text-emerald-500    mt-0.5">Net Value</span>
        </div>
      )
    },
    {
      label: 'Fulfillment',
      key: 'total_quantity',
      render: (_, row) => {
        const items = row.items || [];
        let totalOrderedQty = 0;
        let totalReceivedQty = 0;

        if (items.length > 0) {
          items.forEach(it => {
            const desQty = parseFloat(it.design_qty || 0);
            const ordQty = desQty > 0 ? desQty : parseFloat(it.quantity || 0);
            const recQty = parseFloat(it.received_qty || 0);
            totalOrderedQty += ordQty;
            totalReceivedQty += recQty;
          });
        } else {
          totalOrderedQty = parseFloat(row.accepted_quantity > 0 ? (row.items_count || 0) : (row.total_quantity || 0));
          totalReceivedQty = parseFloat(row.accepted_quantity || 0);
        }

        const percent = totalOrderedQty > 0 ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100)) : 0;
        const formatNum = (v) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

        return (
          <div className="w-48">
            <div className="flex justify-between items-end text-xs mb-1.5 font-mono">
              <span className="text-slate-600 font-medium">{formatNum(totalReceivedQty)} / {formatNum(totalOrderedQty)} NOS</span>
              <span className={`font-semibold ${percent === 100 ? 'text-emerald-600' : 'text-emerald-600'}`}>{percent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden border border-slate-100">
              <div
                className="h-full transition-all duration-700 ease-out bg-emerald-500 rounded"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center gap-1.5 p-1  text-xs  ${poStatusColors[val]?.badge} ${poStatusColors[val]?.border}`}>
          <div className={` rounded ${poStatusColors[val]?.text.replace('text-', 'bg-')} text-white`}>
            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d={poStatusColors[val]?.icon || 'M5 13l4 4L19 7'} />
            </svg>
          </div>
          <span className=" ">{poStatusColors[val]?.label}</span>
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => {
        const isSent = !['DRAFT', 'PO_REQUEST'].includes(row.status);
        return (
          <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
            {(row.status === 'DRAFT' || row.status === 'PO_REQUEST') && (
              <button
                onClick={() => handleApprovePO(row.id)}
                className="p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded transition-all border border-emerald-100 hover:border-emerald-200 active:scale-90 flex items-center justify-center"
                title="Approve PO"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            <button
              onClick={() => navigate(`${deptPrefix}/purchase-orders/view/${row.id}`)}
              className="p-1 text-blue-500 hover:bg-blue-50 rounded  transition-all active:scale-90"
              title="View PO Details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (row.status === 'PO_REQUEST') {
                  navigate(`${deptPrefix}/purchase-orders/edit-manual/${row.id}`);
                } else {
                  handleEditPO(row.id);
                }
              }}
              className=" text-slate-400 hover:bg-slate-50 hover:text-slate-600   transition-all   active:scale-90"
              title="Edit PO"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {isSent && (
              <button
                onClick={() => {
                  setSelectedPoForAttachment(row);
                  setSelectedAttachmentFiles([]);
                  setShowAttachmentModal(true);
                }}
                className={`p-1.5 rounded transition-all active:scale-90 flex items-center justify-center gap-1 ${row.invoice_url && row.invoice_url.trim().length > 0
                  ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                title="Manage Attachments"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {row.invoice_url && row.invoice_url.trim().length > 0 && (
                  <span className="text-[10px] font-bold px-1 bg-emerald-600 text-white rounded-full leading-none min-w-[14px] h-[14px] flex items-center justify-center">
                    {row.invoice_url.split(',').filter(Boolean).length}
                  </span>
                )}
              </button>
            )}
            {row.vendor_id && (
              <button
                onClick={() => openEmailModal(row)}
                className={`rounded transition-all active:scale-90 p-1 ${isSent ? 'text-emerald-500 hover:bg-emerald-50' : 'text-blue-600 hover:bg-blue-50'}`}
                title={isSent ? "Resend PO / Sent Mail History" : "Send PO to Vendor"}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
                </svg>
              </button>
            )}
            {row.forwarded_to_accounts === 1 ? (
              <button
                disabled
                className="p-1 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded cursor-default"
                title="Forwarded to Accounts"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            ) : (
              ['APPROVED', 'ORDERED', 'SENT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'FULFILLED', 'PAID'].includes(row.status) && (
                <button
                  onClick={() => handleSendToAccounts(row)}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-200 rounded transition-all active:scale-90"
                  title="Send to Accounts"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )
            )}
            <button
              onClick={() => handleDeletePO(row.id)}
              className="text-rose-500 hover:bg-rose-50 transition-all active:scale-90 p-1 rounded"
              title="Delete PO"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        );
      }
    }
  ];

  const filteredPOs = pos.filter(po => {
    const matchesSearch = !searchTerm ||
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.drawing_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.finished_good?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.project_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (viewMode === 'detail' && selectedPO) {
    return (
      <PurchaseOrderDetail
        po={selectedPO}
        onBack={() => navigate(`${deptPrefix}/purchase-orders`)}
        onRefresh={() => {
          handleViewPODetail(selectedPO.id);
          fetchPOs();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-xl   text-slate-900 ">Purchase Orders</h1>
            <p className="text-sm text-slate-500 ">Manage procurement cycles and supplier orders</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs  transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <LayoutGrid size={14} />
              KANBAN
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs  transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <List size={14} />
              LIST
            </button>
          </div>
          <Button
            variant="secondary"
            onClick={() => fetchPOs()}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
          <Button
            variant="secondary"
            onClick={handleOpenMergeModal}
            icon={GitMerge}
          >
            Merge PO
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`${deptPrefix}/purchase-orders/manual-add`)}
            icon={Plus}
          >
            Create Order
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          {[
            { label: 'Total Orders', value: stats.total_pos, sub: `Total: ${formatCurrency(stats.total_value)}`, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'blue', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
            { label: 'Draft', value: stats.draft_pos, sub: 'Pending submission', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'orange', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
            { label: 'Submitted', value: stats.submitted_pos, sub: 'Active orders', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8', color: 'blue', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
            { label: 'To Receive', value: stats.to_receive_pos, sub: 'Awaiting delivery', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', color: 'indigo', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
            { label: 'Partial', value: stats.partial_pos, sub: 'Incomplete receipts', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'rose', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
            { label: 'Fulfilled', value: stats.fulfilled_pos, sub: 'Fully received', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'emerald', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          ].map((stat, idx) => (
            <div key={idx} className={`${stat.bg} border border-slate-200 rounded p-2  hover: transition-all relative overflow-hidden group`}>
              {stat.bg !== 'bg-white' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <p className={`text-xs  ${stat.bg === 'bg-white' ? 'text-slate-400' : 'text-blue-100'}  `}>{stat.label}</p>
                  <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded  `}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
                  </div>
                </div>
                <p className={`text-xl   ${stat.text} `}>{stat.value || 0}</p>
                <p className={`text-xs ${stat.subText} mt-1 `}>{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter Bar */}
      <Card className="p-2 border-slate-100 bg-white">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by PO #, supplier, drawing or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            <Tabs
              tabs={[
                { id: 'ALL', label: 'All', icon: List },
                { id: 'PO_REQUEST', label: 'Requests', icon: Clock },
                { id: 'DRAFT', label: 'Draft', icon: FileText },
                { id: 'SENT', label: 'Sent', icon: Truck },
                { id: 'RECEIVED', label: 'Received', icon: CheckCircle2 },
                { id: 'FULFILLED', label: 'Fulfilled', icon: Package }
              ]}
              activeTab={statusFilter}
              onTabChange={setStatusFilter}
            />
          </div>
        </div>
      </Card>

      {/* Main Table Section */}
      <div className="bg-white rounded border border-slate-200  overflow-hidden">

        <DataTable
          columns={columns}
          data={filteredPOs}
          loading={loading}
          pageSize={5}
          hideHeader={true}
          className="border-none shadow-none rounded-none"
        />
      </div>

      {/* Manual Create PO Modal (New Design) */}
      {showManualCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-2 border-b border-slate-50">
              <h2 className="text-xl  text-slate-800">{manualFormData.id ? 'Edit Purchase Order Request' : 'Create New Purchase Order'}</h2>
              <button
                onClick={() => navigate(`${deptPrefix}/purchase-orders`)}
                className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreateManualPO} className="p-2 space-y-2 max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar">
              {/* Basic Information Section */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden ">
                <div className="bg-slate-50/50 px-4 p-2 border-b border-slate-100 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <h3 className="text-sm  text-slate-700">Basic Information</h3>
                </div>
                <div className="p-3 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 ml-1">Select Drawing *</label>
                      <SearchableSelect
                        options={quotations.filter(q => q.drawing_no).map(q => ({
                          label: `${q.drawing_no} - ${q.finished_good || 'No description'}`,
                          value: q.id
                        }))}
                        value={manualFormData.quotationId || ''}
                        onChange={(e) => handleManualQuotationChange(e.target.value)}
                        placeholder="Search & Select Drawing..."
                        allowCustom={false}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 ml-1">Supplier *</label>
                      <select
                        value={manualFormData.vendorId}
                        onChange={(e) => setManualFormData({ ...manualFormData, vendorId: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        required
                        disabled={!!manualFormData.quotationId}
                      >
                        <option value="">Select Supplier</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const selectedQuoteDetails = quotations.find(q => String(q.id) === String(manualFormData.quotationId));
                    if (!selectedQuoteDetails) return null;
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in duration-300">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Project No.</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedQuoteDetails.project_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Approved RFQ No.</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedQuoteDetails.quote_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Supplier</span>
                          <span className="text-xs font-bold text-slate-700">{selectedQuoteDetails.vendor_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Finished Good</span>
                          <span className="text-xs text-slate-600 truncate block" title={selectedQuoteDetails.finished_good}>{selectedQuoteDetails.finished_good || '—'}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 ml-1">Order Date *</label>
                      <input
                        type="date"
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 ml-1">Expected Delivery *</label>
                      <input
                        type="date"
                        value={manualFormData.expectedDeliveryDate}
                        onChange={(e) => setManualFormData({ ...manualFormData, expectedDeliveryDate: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Order Items Section */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden ">
                <div className="bg-slate-50/50 px-4 p-2 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <h3 className="text-sm  text-slate-700">Purchase Order Items</h3>
                  </div>
                  {/* <button
                    type="button"
                    onClick={handleAddManualItem}
                    className="flex items-center gap-1.5 p-1.5 bg-white border border-blue-200 text-blue-600 rounded  text-xs  hover:bg-blue-50 transition-all "
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Add Item
                  </button> */}
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="px-4 p-2 text-left">Item ID</th>
                        <th className="px-4 p-2 text-left">Material Name & Dimensions</th>
                        <th className="px-4 p-2 text-center w-24">Design Qty</th>
                        <th className="px-4 p-2 text-center w-24">UOM</th>
                        <th className="px-4 p-2 text-center w-32">Rate</th>
                        <th className="px-4 p-2 text-right w-32">Amount</th>
                        <th className="px-4 p-2 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {manualFormData.items.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                          <td className="px-4 p-2 w-[220px]">
                            <div className="flex flex-col gap-1">
                              <select
                                value={item.item_code}
                                onChange={(e) => handleManualItemChange(idx, 'item_code', e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer font-semibold"
                              >
                                <option value="">Select Item</option>
                                {stockItems.map(si => (
                                  <option key={si.id} value={si.item_code}>
                                    {si.item_code}
                                  </option>
                                ))}
                              </select>
                              {item.description && (
                                <span className="text-[10px] text-slate-400 font-medium px-1 leading-normal break-words max-w-[210px] block">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 p-2">
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                value={item.material_name || item.description || ''}
                                onChange={(e) => handleManualItemChange(idx, 'material_name', e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="Material Name"
                              />
                              {formatDimensions(item) && (
                                <div className="px-1 text-[10px] text-slate-400">
                                  {formatDimensions(item)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 p-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleManualItemChange(idx, 'quantity', e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 p-2">
                            <input
                              type="text"
                              value={item.unit}
                              readOnly
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded  text-xs  text-center text-slate-400 outline-none "
                            />
                          </td>
                          <td className="px-4 p-2">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleManualItemChange(idx, 'rate', e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 p-2 text-right  text-slate-700">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="px-4 p-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveManualItem(idx)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded  transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {manualFormData.items.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-xs">
                      No items added yet. Click 'Add Item' to start.
                    </div>
                  )}
                </div>
                <div className="p-2 bg-slate-50/30 border-t border-slate-100 grid grid-cols-3 gap-8">
                  <div className="flex flex-col">
                    <span className="text-xs  text-slate-400  ">Total Items</span>
                    <span className="text-xl  text-slate-800">{manualFormData.items.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs  text-slate-400  ">Total Qty</span>
                    <span className="text-xl  text-slate-800">
                      {manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs  text-slate-400  ">Item Subtotal</span>
                    <span className="text-xl  text-blue-600">
                      {formatCurrency(manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Tax & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded overflow-hidden ">
                  <div className="bg-slate-50/50 px-4 p-2 border-b border-slate-100 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <h3 className="text-sm  text-slate-700">Tax & Currency</h3>
                  </div>
                  <div className="p-2 space-y-2">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 ml-1">Currency</label>
                      <select
                        value={manualFormData.currency}
                        onChange={(e) => setManualFormData({ ...manualFormData, currency: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none"
                      >
                        <option>INR (Indian Rupee)</option>
                        <option>USD (US Dollar)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500 font-semibold mb-1 block">Discount Type</label>
                          <select
                            value={manualFormData.discountType || 'AMOUNT'}
                            onChange={(e) => setManualFormData({ ...manualFormData, discountType: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none font-medium"
                          >
                            <option value="AMOUNT">Fixed Amount (₹)</option>
                            <option value="PERCENTAGE">Percentage (%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 font-semibold mb-1 block">Discount Value</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={manualFormData.discountValue !== undefined ? manualFormData.discountValue : ''}
                            onChange={(e) => setManualFormData({ ...manualFormData, discountValue: e.target.value })}
                            className="w-full p-2 bg-white border border-slate-300 rounded text-xs outline-none font-bold text-slate-800"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-blue-600 rounded p-3 shadow-lg shadow-blue-200 overflow-hidden flex flex-col text-white">
                  <div className="flex-1 space-y-2">
                    {(() => {
                      const subtotal = manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
                      const discVal = parseFloat(manualFormData.discountValue) || 0;
                      const discType = manualFormData.discountType || 'AMOUNT';
                      const discAmt = discVal > 0 ? (discType === 'PERCENTAGE' ? (subtotal * discVal) / 100 : Math.min(discVal, subtotal)) : 0;
                      const taxable = Math.max(0, subtotal - discAmt);
                      const cgst = taxable * 0.09;
                      const sgst = taxable * 0.09;
                      const grandTotal = taxable + cgst + sgst;

                      return (
                        <>
                          <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                            <span>Subtotal</span>
                            <span className="font-semibold">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                            <span>Discount {discType === 'PERCENTAGE' && discVal > 0 ? `(${discVal}%)` : ''}</span>
                            <span className="font-semibold text-rose-200">- {formatCurrency(discAmt)}</span>
                          </div>
                          <div className="flex justify-between items-center text-white/90 border-b border-white/10 pb-1.5 text-xs font-bold">
                            <span>Taxable Amount</span>
                            <span>{formatCurrency(taxable)}</span>
                          </div>
                          <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                            <span>CGST (9%)</span>
                            <span>+ {formatCurrency(cgst)}</span>
                          </div>
                          <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                            <span>SGST (9%)</span>
                            <span>+ {formatCurrency(sgst)}</span>
                          </div>
                          <div className="flex justify-between items-center text-white pt-1 text-sm font-bold">
                            <span>Grand Total</span>
                            <span className="text-base">{formatCurrency(grandTotal)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`${deptPrefix}/purchase-orders`);
                  }}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {manualFormData.id ? 'Save Changes' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-2 border-b border-slate-50">
              <h2 className="text-xl  text-slate-800">Create PO from Quotation</h2>
              <button
                onClick={() => {
                  navigate(`${deptPrefix}/purchase-orders`);
                }}
                className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-2 space-y-2 max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Select Approved Quotation *</label>
                  <select
                    value={formData.quotationId}
                    onChange={(e) => handleQuotationChange(e.target.value)}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    required
                  >
                    <option value="">-- Select a Quotation --</option>
                    {quotations.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.quote_number} - {formatCurrency(q.total_amount)} - {q.vendor_name || 'Vendor'} ({q.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">PO Number *</label>
                  <div className="flex gap-2">
                    <select
                      value={isManualPo ? 'MANUAL' : formData.poNumber}
                      onChange={(e) => {
                        if (e.target.value === 'MANUAL') {
                          setIsManualPo(true);
                          setFormData({ ...formData, poNumber: '' });
                        } else {
                          setIsManualPo(false);
                          setFormData({ ...formData, poNumber: e.target.value });
                        }
                      }}
                      className="flex-1 p-2  bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                      required
                      disabled={!formData.quotationId}
                    >
                      {!formData.quotationId ? (
                        <option value="">-- Select Quotation First --</option>
                      ) : (
                        <>
                          <option value="">-- Select PO Number --</option>
                          {poSuggestions.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </>
                      )}
                      <option value="MANUAL">Enter Manually...</option>
                    </select>
                    {isManualPo && (
                      <input
                        type="text"
                        value={formData.poNumber}
                        onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                        placeholder="Enter PO Number"
                        className="flex-1 p-2  bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                        required
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Expected Delivery Date *</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Project Name</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    readOnly
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 outline-none"
                  />
                </div>
              </div>

              {poItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded overflow-hidden ">
                  <div className="bg-slate-50/50 px-4 p-2 border-b border-slate-100 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <h3 className="text-sm  text-slate-700">Quotation Items Preview</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs  text-slate-400   border-b border-slate-100">
                          <th className="px-4 p-2 text-left">Description</th>
                          <th className="px-4 p-2 text-left">Material</th>
                          <th className="px-4 p-2 text-center">Design Qty</th>
                          <th className="px-4 p-2 text-center">Required</th>
                          <th className="px-4 p-2 text-right">Rate</th>
                          <th className="px-4 p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {poItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-4 p-2">
                              <p className=" text-slate-700 text-xs">{item.description}</p>
                              {item.item_code && <p className="text-xs text-slate-400">{item.item_code}</p>}
                            </td>
                            <td className="px-4 p-2 text-xs text-slate-500">{item.material_name || '—'}</td>
                            <td className="px-4 p-2 text-center text-xs text-slate-400 ">{Number(item.planned_qty || item.design_qty || 0).toFixed(3)} NOS</td>
                            <td className="px-4 p-2 text-center text-xs text-slate-600 ">{Number(item.quantity || 0).toFixed(3)} {item.unit || 'NOS'}</td>
                            <td className="px-4 p-2 text-right text-xs text-slate-500">{formatCurrency(item.unit_rate)}</td>
                            <td className="px-4 p-2 text-right text-xs  text-slate-800">{formatCurrency(item.total_amount || (item.quantity * item.unit_rate))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50">
                        <tr>
                          <td colSpan="5" className="px-4 p-2 text-right text-xs  text-slate-400  ">Total Amount</td>
                          <td className="px-4 p-2 text-right text-sm  text-blue-600">
                            {formatCurrency(poItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || (item.quantity * item.unit_rate)), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs  text-slate-400   ml-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any special instructions or notes"
                  className="w-full px-4 p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  rows="3"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(`${deptPrefix}/purchase-orders`)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded text-xs  hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedPO && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-2 border-b border-slate-50">
              <h2 className="text-xl  text-slate-800 ">Edit Purchase Order</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleUpdatePO} className="p-2 space-y-2">
              <div className="bg-slate-50/50 p-2 rounded border border-slate-100 text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs  text-slate-400   w-24">PO Number:</span>
                  <input
                    type="text"
                    value={selectedPO.po_number}
                    onChange={(e) => setSelectedPO({ ...selectedPO, po_number: e.target.value })}
                    className="flex-1 bg-white border border-slate-200 rounded  p-1.5 text-blue-600  outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs  text-slate-400  ">Vendor:</span>
                  {selectedPO.status === 'PO_REQUEST' ? (
                    <select
                      value={editFormData.vendorId}
                      onChange={(e) => {
                        const newVendorId = e.target.value;
                        setEditFormData({
                          ...editFormData,
                          vendorId: newVendorId,
                          status: newVendorId ? 'DRAFT' : 'PO_REQUEST'
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded  p-1.5 text-sm  text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm  text-slate-700">{selectedPO.vendor_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs  text-slate-400   w-24">Amount:</span>
                  <div className="flex flex-col">
                    <span className="text-sm  text-slate-800">{formatCurrency(selectedPO.total_amount)}</span>
                    <div className="flex gap-2 text-[8px] text-slate-400   er">
                      <span>Sub: {formatCurrency(poItems.reduce((sum, i) => sum + (parseFloat(i.amount) || (i.quantity * (i.unit_rate || i.rate || 0))), 0))}</span>
                      <span className="text-emerald-500">Tax: {formatCurrency(poItems.reduce((sum, i) => sum + (parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0)) || (i.quantity * (i.unit_rate || i.rate || 0) * 0.18), 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs  text-slate-400  ">Order Items (Update Rates & Tax)</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddEditItem}
                      className="flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50/20 rounded text-xs font-semibold text-blue-600 transition-all active:scale-95 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                    <span className="text-xs  text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">Default 18% GST Applied</span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded overflow-visible ">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2 text-xs  text-slate-400  ">Drawing No</th>
                        <th className="p-2 text-xs  text-slate-400  ">Item</th>
                        <th className="p-2 text-xs  text-slate-400   text-center">Design Qty</th>
                        <th className="p-2 text-xs  text-slate-400   text-center">Required Qty</th>
                        <th className="p-2 text-xs  text-slate-400   text-center">Rate</th>
                        <th className="p-2 text-xs  text-slate-400   text-right">Amount</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {poItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-2 p-2">
                            <input
                              type="text"
                              value={item.drawing_no || ''}
                              placeholder="Drawing No"
                              onChange={(e) => handleEditItemChange(idx, 'drawing_no', e.target.value)}
                              className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 p-2">
                            {item.id ? (
                              <div className="flex flex-col">
                                <span className="text-xs  text-slate-700">{item.material_name || item.description}</span>
                                <span className="text-xs text-slate-400 ">{item.item_code}</span>
                              </div>
                            ) : (
                              <div className="min-w-[200px]">
                                <SearchableSelect
                                  options={stockItems}
                                  value={item.item_code}
                                  onChange={(e) => handleEditItemChange(idx, 'item_code', e.target.value)}
                                  placeholder="Select Item"
                                  labelField="material_name"
                                  valueField="item_code"
                                  subLabelField="item_code"
                                  allowCustom={false}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 p-2 text-center">
                            <div className="relative group max-w-[100px] mx-auto flex flex-col items-center gap-1">
                              <input
                                type="number"
                                step="0.001"
                                value={(item.planned_qty === 0 || item.design_qty === 0) ? 0 : (item.planned_qty || item.design_qty || '')}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                  handleEditItemChange(idx, 'planned_qty', val);
                                  handleEditItemChange(idx, 'design_qty', val);
                                }}
                                className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center"
                              />
                              <span className="text-[10px] text-slate-400">NOS</span>
                            </div>
                          </td>
                          <td className="px-4 p-2 text-center">
                            {(() => {
                              const isBoughtOut = (item.material_type || item.item_type || '').toUpperCase().trim().includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
                              if (isBoughtOut) {
                                return (
                                  <div className="relative group max-w-[140px] mx-auto flex flex-col items-center gap-1">
                                    <input
                                      type="text"
                                      value=""
                                      placeholder="—"
                                      disabled={true}
                                      readOnly={true}
                                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-400 text-center cursor-not-allowed"
                                    />
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">NOS</span>
                                  </div>
                                );
                              }
                              return (
                                <div className="relative group max-w-[140px] mx-auto flex flex-col items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={item.quantity === 0 || item.quantity === '0' ? '0' : (item.quantity || '')}
                                    onChange={(e) => handleEditItemChange(idx, 'quantity', e.target.value)}
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center"
                                  />
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.unit || item.uom || 'NOS'}</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 p-2">
                            <div className="relative group max-w-[150px] mx-auto">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs ">₹</span>
                              <input
                                type="number"
                                value={item.unit_rate === 0 || item.unit_rate === '0' ? '0' : (item.unit_rate || '')}
                                onChange={(e) => handleEditItemChange(idx, 'unit_rate', e.target.value)}
                                className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center"
                              />
                            </div>
                          </td>
                          <td className="px-4 p-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs  text-slate-800">{formatCurrency(item.total_amount || (item.quantity * (item.unit_rate || item.rate || 0) * 1.18))}</span>
                              <span className="text-xs text-emerald-500 ">+18% GST</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveEditItem(idx)}
                              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                              title="Delete Item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  >
                    <option value="">-- Select Status --</option>
                    {Object.keys(poStatusColors).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={editFormData.expectedDeliveryDate ? new Date(editFormData.expectedDeliveryDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditFormData({ ...editFormData, expectedDeliveryDate: e.target.value })}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="bg-slate-50/30 p-3 rounded border border-slate-100/50 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">Discount Type</label>
                    <select
                      value={editFormData.discountType || 'AMOUNT'}
                      onChange={(e) => setEditFormData({ ...editFormData, discountType: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none font-medium"
                    >
                      <option value="AMOUNT">Fixed Amount (₹)</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold mb-1 block">Discount Value</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFormData.discountValue !== undefined ? editFormData.discountValue : ''}
                      onChange={(e) => setEditFormData({ ...editFormData, discountValue: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none font-bold text-slate-800"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-600 rounded p-3 shadow-lg shadow-blue-200 overflow-hidden flex flex-col text-white my-3">
                <div className="flex-1 space-y-2">
                  {(() => {
                    const subtotal = poItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
                    const discVal = parseFloat(editFormData.discountValue) || 0;
                    const discType = editFormData.discountType || 'AMOUNT';
                    const discAmt = discVal > 0 ? (discType === 'PERCENTAGE' ? (subtotal * discVal) / 100 : Math.min(discVal, subtotal)) : 0;
                    const taxable = Math.max(0, subtotal - discAmt);
                    const cgst = taxable * 0.09;
                    const sgst = taxable * 0.09;
                    const grandTotal = taxable + cgst + sgst;

                    return (
                      <>
                        <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                          <span>Subtotal</span>
                          <span className="font-semibold">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                          <span>Discount {discType === 'PERCENTAGE' && discVal > 0 ? `(${discVal}%)` : ''}</span>
                          <span className="font-semibold text-rose-200">- {formatCurrency(discAmt)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/90 border-b border-white/10 pb-1.5 text-xs font-bold">
                          <span>Taxable Amount</span>
                          <span>{formatCurrency(taxable)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                          <span>CGST (9%)</span>
                          <span>+ {formatCurrency(cgst)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-1.5 text-xs">
                          <span>SGST (9%)</span>
                          <span>+ {formatCurrency(sgst)}</span>
                        </div>
                        <div className="flex justify-between items-center text-white pt-1 text-sm font-bold">
                          <span>Grand Total</span>
                          <span className="text-base">{formatCurrency(grandTotal)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs  text-slate-400   ml-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-4 p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  rows="3"
                  placeholder="Add notes about this order"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && selectedPO && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-2 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl  text-slate-800 ">Send PO to Vendor</h2>
                  <p className="text-xs text-slate-400   ">{selectedPO.po_number} • {selectedPO.vendor_name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-slate-100 rounded transition-colors text-slate-400"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-5">
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={emailData.to}
                    onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                    placeholder="vendor@example.com"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">CC Email (Optional)</label>
                  <input
                    type="text"
                    value={emailData.cc}
                    onChange={(e) => setEmailData({ ...emailData, cc: e.target.value })}
                    placeholder="cc@example.com"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">BCC Email (Optional)</label>
                  <input
                    type="text"
                    value={emailData.bcc}
                    onChange={(e) => setEmailData({ ...emailData, bcc: e.target.value })}
                    placeholder="bcc@example.com"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Subject</label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Message</label>
                  <textarea
                    value={emailData.message}
                    onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                    rows="5"
                    className="w-full px-4 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 p-2 bg-emerald-50/50 border border-emerald-100 rounded">
                  <div className="p-2 bg-emerald-500 text-white rounded ">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs  text-emerald-700  ">Attachment</p>
                    <p className="text-xs  text-emerald-600">PurchaseOrder_{selectedPO.po_number}.pdf</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="attachPDF"
                      checked={emailData.attachPDF}
                      onChange={(e) => setEmailData({ ...emailData, attachPDF: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor="attachPDF" className="text-xs  text-slate-500  ">Include</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" /></svg>
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          {showConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-150 border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm Send Email</h3>
                <p className="text-sm text-slate-600 mb-6">
                  Are you sure you want to send this purchase order email to the selected recipient(s)?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-sm hover:bg-slate-50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSend}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-all font-medium shadow-md shadow-blue-100"
                  >
                    Yes, Send Email
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {showAttachmentModal && selectedPoForAttachment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">PO Attachments & Documents</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedPoForAttachment.po_number}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAttachmentModal(false);
                  setSelectedPoForAttachment(null);
                  setSelectedAttachmentFiles([]);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
              {/* Existing Documents Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Currently Attached Invoices/Receipts</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                  {selectedPoForAttachment.invoice_url && selectedPoForAttachment.invoice_url.trim().length > 0 ? (
                    <div className="divide-y divide-slate-100 bg-white">
                      {selectedPoForAttachment.invoice_url.split(',').filter(Boolean).map((filePath, idx) => {
                        const fileName = filePath.split('/').pop() || `document_${idx + 1}.pdf`;
                        return (
                          <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 transition-all group">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-105 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate max-w-[340px]" title={fileName}>{fileName}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ready for review</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => window.open(`${API_BASE}/${filePath}`, '_blank')}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                title="Download Document"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePoAttachment(filePath)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Document"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-white">
                      <div className="inline-flex p-3 bg-slate-50 text-slate-400 rounded-full mb-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">No attachments uploaded yet</p>
                      <p className="text-[10px] text-slate-400 mt-1">Upload vendor invoices below to attach them to this order</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Dropzone Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Upload New Documents</h4>
                <div
                  onClick={() => document.getElementById('poAttachmentsInput').click()}
                  className="border-2 border-dashed border-slate-200 hover:border-rose-400 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-6 text-center cursor-pointer transition-all group"
                >
                  <input
                    type="file"
                    id="poAttachmentsInput"
                    multiple
                    accept="application/pdf"
                    onChange={handleAttachmentModalFileChange}
                    className="hidden"
                  />
                  <div className="inline-flex p-3 bg-white text-slate-500 group-hover:text-rose-500 rounded-lg shadow-sm border border-slate-100 group-hover:scale-105 transition-all mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Drag & drop or click to upload</p>
                  <p className="text-[10px] text-slate-400 mt-1">Supports PDF invoices and receipts up to 10MB each</p>
                </div>
              </div>

              {/* Staged New Files Section */}
              {selectedAttachmentFiles.length > 0 && (
                <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Files Selected for Upload</h4>
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{selectedAttachmentFiles.length} Staged</span>
                  </div>
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-white divide-y divide-slate-100">
                    {selectedAttachmentFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate max-w-[340px]">{file.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedFile(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Remove File"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentModal(false);
                  setSelectedPoForAttachment(null);
                  setSelectedAttachmentFiles([]);
                }}
                className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUploadPoAttachments}
                disabled={selectedAttachmentFiles.length === 0 || isUploadingAttachments}
                className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-rose-200 active:scale-98"
              >
                {isUploadingAttachments ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Attachments</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Purchase Order Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Merge Purchase Orders</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Consolidate multiple orders for a single vendor</p>
                </div>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Steps Progress Indicator */}
            <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-center gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mergeStep >= 1 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</span>
                <span className={mergeStep === 1 ? 'text-purple-600 font-bold' : ''}>Select Vendor</span>
              </div>
              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <div className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mergeStep >= 2 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
                <span className={mergeStep === 2 ? 'text-purple-600 font-bold' : ''}>Select Draft Orders</span>
              </div>
              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <div className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mergeStep >= 3 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</span>
                <span className={mergeStep === 3 ? 'text-purple-600 font-bold' : ''}>Review Merged Form</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              {/* STEP 1: Select Supplier */}
              {mergeStep === 1 && (
                <div className="space-y-4 max-w-md mx-auto py-8">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Supplier / Vendor *</label>
                    <SearchableSelect
                      options={vendors}
                      value={mergeSupplierId}
                      onChange={(e) => handleSupplierChangeForMerge(e.target.value)}
                      placeholder="Choose Supplier"
                      labelField="vendor_name"
                      valueField="id"
                      allowCustom={false}
                      openUpwards={true}
                    />
                  </div>

                  {mergeSupplierId && (
                    <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl text-xs text-purple-700 animate-in fade-in duration-300">
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Checking for eligible Draft POs...
                        </span>
                      ) : (
                        <span>Found <b>{eligiblePOs.length}</b> pending/draft Purchase Orders for this supplier.</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Select Purchase Orders */}
              {mergeStep === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Eligible Purchase Orders</h3>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search PO no, project, drawing..."
                          value={mergeSearchTerm}
                          onChange={(e) => setMergeSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {selectedPoIdsForMerge.length} Selected
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const searchLower = mergeSearchTerm.toLowerCase();
                    const filteredPOs = eligiblePOs.filter(po =>
                      String(po.po_number || '').toLowerCase().includes(searchLower) ||
                      String(po.project_name || '').toLowerCase().includes(searchLower) ||
                      String(po.drawing_no || '').toLowerCase().includes(searchLower)
                    );

                    if (filteredPOs.length === 0) {
                      return (
                        <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="text-xs text-slate-500 font-semibold">No pending or draft Purchase Orders found</p>
                          <p className="text-[10px] text-slate-400 mt-1">Try adjusting your search criteria.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-3 w-12 text-center">Select</th>
                              <th className="p-3">PO No</th>
                              <th className="p-3">Project</th>
                              <th className="p-3">Drawing</th>
                              <th className="p-3 text-right">Items</th>
                              <th className="p-3 text-right">Amount</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredPOs.map(po => {
                              const isChecked = selectedPoIdsForMerge.includes(po.id);
                              return (
                                <tr key={po.id} className="hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => handleTogglePoSelectionForMerge(po.id)}>
                                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePoSelectionForMerge(po.id)}
                                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500/20"
                                    />
                                  </td>
                                  <td className="p-3 font-semibold text-slate-700">{po.po_number}</td>
                                  <td className="p-3 text-slate-600">{po.project_name || '—'}</td>
                                  <td className="p-3 text-slate-600 font-mono">{po.drawing_no || '—'}</td>
                                  <td className="p-3 text-right text-slate-500 font-bold">{po.total_quantity || 0}</td>
                                  <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(po.total_amount)}</td>
                                  <td className="p-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${poStatusColors[po.status]?.badge}`}>
                                      {poStatusColors[po.status]?.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STEP 3: Merge PO Form */}
              {mergeStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Supplier and Project Header info */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Supplier</span>
                      <span className="text-xs font-black text-slate-700">{vendors.find(v => String(v.id) === String(mergeSupplierId))?.vendor_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Consolidated Projects</span>
                      <span className="text-xs font-semibold text-slate-600">
                        {Array.from(new Set(mergedItems.map(i => i.project_name))).filter(p => p && p !== '—').join(', ') || 'Internal / Stock'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Original POs Count</span>
                      <span className="text-xs font-semibold text-slate-600">{selectedPoIdsForMerge.length} Purchase Orders</span>
                    </div>
                  </div>

                  {/* Expected Delivery and Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 block">Expected Delivery Date *</label>
                      <input
                        type="date"
                        value={mergeExpectedDeliveryDate}
                        onChange={(e) => setMergeExpectedDeliveryDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 block">Merge Notes / Remarks</label>
                      <input
                        type="text"
                        value={mergeNotes}
                        onChange={(e) => setMergeNotes(e.target.value)}
                        placeholder="e.g. Consolidated order for upcoming projects"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Consolidated Line Items Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Consolidated Line Items</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-3">Project</th>
                            <th className="p-3">Drawing</th>
                            <th className="p-3">Material</th>
                            <th className="p-3 text-center w-24">Qty</th>
                            <th className="p-3 text-center w-28">Rate (₹)</th>
                            <th className="p-3 text-right">Tax (GST)</th>
                            <th className="p-3 text-right w-32">Total (₹)</th>
                            <th className="p-3 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mergedItems.map((item, idx) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const rate = parseFloat(item.rate || item.unit_rate) || 0;
                            const amt = qty * rate;
                            const cgst = parseFloat(item.cgst_percent || 9);
                            const sgst = parseFloat(item.sgst_percent || 9);
                            const taxAmt = (amt * (cgst + sgst)) / 100;
                            const total = amt + taxAmt;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                                <td className="p-3 font-semibold text-indigo-600">{item.project_name || '—'}</td>
                                <td className="p-3 font-mono text-slate-600">{item.drawing_no || '—'}</td>
                                <td className="p-3 text-slate-700 font-semibold">{item.material_name || item.description || '—'}</td>
                                <td className="p-3">
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleMergedItemChange(idx, 'quantity', e.target.value)}
                                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center focus:bg-white outline-none"
                                  />
                                </td>
                                <td className="p-3">
                                  <input
                                    type="number"
                                    value={item.rate}
                                    onChange={(e) => handleMergedItemChange(idx, 'rate', e.target.value)}
                                    className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center focus:bg-white outline-none"
                                  />
                                </td>
                                <td className="p-3 text-right text-slate-500">
                                  {item.cgst_percent + item.sgst_percent}% ({formatCurrency(taxAmt)})
                                </td>
                                <td className="p-3 text-right font-black text-slate-800">
                                  {formatCurrency(total)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMergedItem(idx)}
                                    className="text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-all"
                                    title="Remove item"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 w-72 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-500 font-semibold">
                        <span>Subtotal:</span>
                        <span>
                          {formatCurrency(
                            mergedItems.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.rate || i.unit_rate || 0)), 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 font-semibold">
                        <span>GST:</span>
                        <span>
                          {formatCurrency(
                            mergedItems.reduce((sum, i) => {
                              const amt = parseFloat(i.quantity || 0) * parseFloat(i.rate || i.unit_rate || 0);
                              return sum + (amt * (parseFloat(i.cgst_percent || 9) + parseFloat(i.sgst_percent || 9))) / 100;
                            }, 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-800 font-bold border-t border-slate-200/80 pt-2 text-sm">
                        <span>Grand Total:</span>
                        <span className="text-purple-600">
                          {formatCurrency(
                            mergedItems.reduce((sum, i) => {
                              const amt = parseFloat(i.quantity || 0) * parseFloat(i.rate || i.unit_rate || 0);
                              const tax = (parseFloat(i.cgst_percent || 9) + parseFloat(i.sgst_percent || 9));
                              return sum + amt + (amt * tax) / 100;
                            }, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div>
                {mergeStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setMergeStep(prev => prev - 1)}
                    className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all active:scale-98"
                  >
                    Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>

                {mergeStep === 1 && (
                  <button
                    type="button"
                    disabled={!mergeSupplierId || loading}
                    onClick={() => setMergeStep(2)}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200 active:scale-98"
                  >
                    Next
                  </button>
                )}

                {mergeStep === 2 && (
                  <button
                    type="button"
                    disabled={selectedPoIdsForMerge.length === 0 || loading}
                    onClick={handleProceedToMergeForm}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200 active:scale-98"
                  >
                    Next
                  </button>
                )}

                {mergeStep === 3 && (
                  <button
                    type="button"
                    disabled={loading || !mergeExpectedDeliveryDate}
                    onClick={handleCreateMergedPO}
                    className="flex items-center gap-1.5 px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200 active:scale-98"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Merging...</span>
                      </>
                    ) : (
                      <>
                        <GitMerge className="w-4 h-4" />
                        <span>Create Merged PO</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;

