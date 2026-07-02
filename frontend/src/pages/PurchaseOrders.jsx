import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, RefreshCw, Package, Clock, CheckCircle2, 
  AlertCircle, Truck, FileText, LayoutGrid, List, Filter
} from 'lucide-react';
import { Card, DataTable, SearchableSelect, Button, Tabs } from '../components/ui.jsx';
import PurchaseOrderDetail from './PurchaseOrderDetail.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

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
    items: []
  });

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

  const handleCreateManualPO = async (e) => {
    e.preventDefault();
    if (!manualFormData.quotationId) return errorToast('Please select an approved quote');
    if (!manualFormData.vendorId) return errorToast('Please select a vendor');
    if (manualFormData.items.length === 0) return errorToast('Please add at least one item');

    try {
      const token = localStorage.getItem('authToken');
      // Calculate totals for consistency
      const subtotal = manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      
      const payload = {
        vendorId: parseInt(manualFormData.vendorId),
        quotationId: manualFormData.quotationId ? parseInt(manualFormData.quotationId) : null,
        expectedDeliveryDate: manualFormData.expectedDeliveryDate || null,
        notes: manualFormData.notes || null,
        currency: manualFormData.currency?.split(' ')[0] || 'INR',
        total_amount: subtotal,
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
      fetchPOs();
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

  const fetchPOs = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
        fetchPOs();
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
        fetchPOs();
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
      fetchPOs();
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
          vendorId: data.vendor_id || ''
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

    if (field === 'unit_rate' || field === 'quantity') {
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
    }

    setPoItems(updatedItems);
    
    // Recalculate grand total for the selected PO
    const newGrandTotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
    setSelectedPO({ ...selectedPO, total_amount: newGrandTotal });
  };

  const handleUpdatePO = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
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

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete PO');

      successToast('Purchase Order deleted successfully');
      fetchPOs();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete PO');
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
          fetchPOs();
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
        fetchPOs();
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
        const total = parseFloat(row.total_quantity) || 0;
        const accepted = parseFloat(row.accepted_quantity) || 0;
        const percent = total > 0 ? Math.min(100, Math.round((accepted / total) * 100)) : 0;
        return (
          <div className="w-48">
            <div className="flex justify-between items-end text-xs mb-1.5">
              <span className="text-slate-500 ">{accepted}/{total}</span>
              <span className={` ${percent === 100 ? 'text-emerald-500' : 'text-emerald-500'}`}>{percent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded h-1 overflow-hidden  border border-slate-50">
              <div 
                className={`h-full transition-all duration-700 ease-out  bg-emerald-500`}
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
                className={`p-1.5 rounded transition-all active:scale-90 flex items-center justify-center gap-1 ${
                  row.invoice_url && row.invoice_url.trim().length > 0
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
            {!isSent && (
              <button
                onClick={() => handleDeletePO(row.id)}
                className="text-rose-500 hover:bg-rose-50 transition-all active:scale-90 p-1 rounded"
                title="Delete PO"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs  transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid size={14} />
              KANBAN
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs  transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
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
                  <button 
                    type="button"
                    onClick={handleAddManualItem}
                    className="flex items-center gap-1.5 p-1.5 bg-white border border-blue-200 text-blue-600 rounded  text-xs  hover:bg-blue-50 transition-all "
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Add Item
                  </button>
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
                              {(item.length > 0 || item.width > 0 || item.thickness > 0 || item.diameter > 0) && (
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 px-1 text-[10px] text-slate-400">
                                  {item.length > 0 && <span>L: {item.length}</span>}
                                  {item.width > 0 && <span>W: {item.width}</span>}
                                  {item.thickness > 0 && <span>T: {item.thickness}</span>}
                                  {item.diameter > 0 && <span>Dia: {item.diameter}</span>}
                                  {item.outer_diameter > 0 && <span>OD: {item.outer_diameter}</span>}
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
                      <label className="text-xs  text-slate-400   ml-1">Currency</label>
                      <select
                        value={manualFormData.currency}
                        onChange={(e) => setManualFormData({ ...manualFormData, currency: e.target.value })}
                        className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs outline-none"
                      >
                        <option>INR (Indian Rupee)</option>
                        <option>USD (US Dollar)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-blue-600 rounded p-1 shadow-lg shadow-blue-200 overflow-hidden flex flex-col">
                  <div className="flex-1 p-2 space-y-2">
                    <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-3">
                      <span className="text-sm ">Subtotal</span>
                      <span className="text-lg ">
                        {formatCurrency(manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-3">
                      <span className="text-sm ">Tax Amount</span>
                      <span className="text-lg ">{formatCurrency(0)}</span>
                    </div>
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
                          setFormData({...formData, poNumber: ''});
                        } else {
                          setIsManualPo(false);
                          setFormData({...formData, poNumber: e.target.value});
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
                        onChange={(e) => setFormData({...formData, poNumber: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
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
                            <td className="px-4 p-2 text-center text-xs text-slate-400 ">{Number(item.planned_qty || item.design_qty || 0).toFixed(3)} {item.unit || 'NOS'}</td>
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
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
          <div className="bg-white rounded shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
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
                    onChange={(e) => setSelectedPO({...selectedPO, po_number: e.target.value})}
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
                  <span className="text-xs  text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">Default 18% GST Applied</span>
                </div>
                <div className="bg-white border border-slate-200 rounded overflow-hidden ">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2 text-xs  text-slate-400  ">Item</th>
                        <th className="p-2 text-xs  text-slate-400   text-center">Design Qty</th>
                        <th className="p-2 text-xs  text-slate-400   text-center">Required Qty</th>
                        <th className="p-2 text-xs  text-slate-400   text-center">Rate</th>
                        <th className="p-2 text-xs  text-slate-400   text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {poItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 p-2">
                            <div className="flex flex-col">
                              <span className="text-xs  text-slate-700">{item.material_name || item.description}</span>
                              <span className="text-xs text-slate-400 ">{item.item_code}</span>
                            </div>
                          </td>
                          <td className="px-4 p-2 text-center">
                            <span className="text-xs  text-slate-400">{Number(item.planned_qty || item.design_qty || 0).toFixed(3)}</span>
                            <span className="text-xs text-slate-400 ml-1 ">{item.unit || item.uom || 'NOS'}</span>
                          </td>
                          <td className="px-4 p-2 text-center">
                            <div className="relative group max-w-[100px] mx-auto">
                              <input
                                type="number"
                                step="0.001"
                                value={item.quantity || 0}
                                onChange={(e) => handleEditItemChange(idx, 'quantity', e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center"
                              />
                            </div>
                          </td>
                          <td className="px-4 p-2">
                            <div className="relative group max-w-[120px] mx-auto">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs ">₹</span>
                              <input
                                type="number"
                                value={item.unit_rate || item.rate || 0}
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
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
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
                    onChange={(e) => setEditFormData({...editFormData, expectedDeliveryDate: e.target.value})}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs  text-slate-400   ml-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
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
                    onChange={(e) => setEmailData({...emailData, to: e.target.value})}
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
                    onChange={(e) => setEmailData({...emailData, cc: e.target.value})}
                    placeholder="cc@example.com"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">BCC Email (Optional)</label>
                  <input
                    type="text"
                    value={emailData.bcc}
                    onChange={(e) => setEmailData({...emailData, bcc: e.target.value})}
                    placeholder="bcc@example.com"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Subject</label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-400   ml-1">Message</label>
                  <textarea
                    value={emailData.message}
                    onChange={(e) => setEmailData({...emailData, message: e.target.value})}
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
                      onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
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
    </div>
  );
};

export default PurchaseOrders;

