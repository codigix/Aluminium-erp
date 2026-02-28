import React, { useState, useEffect, useRef } from 'react';
import { Card, DataTable, SearchableSelect } from '../components/ui.jsx';
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
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    message: '',
    attachPDF: true
  });
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
  const [showManualCreateModal, setShowManualCreateModal] = useState(false);
  const invoiceInputRef = useRef(null);
  const [uploadingPoId, setUploadingPoId] = useState(null);
  const [manualFormData, setManualFormData] = useState({
    id: null,
    vendorId: '',
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
      }
    } else {
      fetchPOs();
      fetchStats();
      fetchApprovedQuotations();
      fetchVendors();
      fetchStockItems();
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
        newItems[index].unit = selectedItem.unit || 'NOS';
        newItems[index].rate = selectedItem.valuation_rate || 0;
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
    if (!manualFormData.vendorId) return errorToast('Please select a vendor');
    if (manualFormData.items.length === 0) return errorToast('Please add at least one item');

    try {
      const token = localStorage.getItem('authToken');
      // Calculate totals for consistency
      const subtotal = manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      
      const payload = {
        vendorId: parseInt(manualFormData.vendorId),
        expectedDeliveryDate: manualFormData.expectedDeliveryDate || null,
        notes: manualFormData.notes || null,
        currency: manualFormData.currency?.split(' ')[0] || 'INR',
        total_amount: subtotal,
        status: manualFormData.id ? 'DRAFT' : undefined,
        items: manualFormData.items.map(item => ({
          id: item.id || undefined,
          item_code: item.item_code,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || 'NOS',
          rate: parseFloat(item.rate) || 0,
          amount: parseFloat(item.amount) || 0
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
      setShowManualCreateModal(false);
      setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
      fetchPOs();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to create PO');
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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingPoId) return;

    const formData = new FormData();
    formData.append('invoice', file);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${uploadingPoId}/invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        successToast('Invoice uploaded successfully');
        fetchPOs();
      } else {
        const errorData = await response.json();
        errorToast(errorData.message || 'Failed to upload invoice');
      }
    } catch (error) {
      console.error('Error uploading invoice:', error);
      errorToast('Error uploading invoice');
    } finally {
      setUploadingPoId(null);
      e.target.value = ''; // Reset input
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
        setQuotations(Array.isArray(data) ? data.filter(q => ['REVIEWED', 'RECEIVED'].includes(q.status)) : []);
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
            quantity: item.design_qty || item.quantity || 0,
            unit: item.unit || 'NOS',
            rate: item.unit_rate || item.rate || 0,
            amount: item.amount || ((item.design_qty || item.quantity) * (item.unit_rate || item.rate || 0))
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

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailData.to) return errorToast('Recipient email is required');

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
          <span className="font-bold text-blue-600 cursor-pointer hover:underline text-sm tracking-tight">
            {val || `PO-${String(row.id).padStart(4, '0')}`}
          </span>
          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
            <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
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
          <span className={`font-bold text-sm tracking-tight ${!val ? 'text-rose-500 italic' : 'text-slate-700'}`}>
            {val || 'Vendor Not Selected'}
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            {val ? 'Active Vendor' : 'Action Required'}
          </span>
        </div>
      )
    },
    {
      label: 'Order -- Expected',
      key: 'expected_delivery_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 font-bold shadow-sm">
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {formatDate(row.created_at)}
          </div>
          <svg className="w-4 h-4 text-emerald-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-600 font-bold shadow-sm">
            <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
          <span className="font-black text-slate-800 text-sm">{formatCurrency(val)}</span>
          <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Net Value</span>
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
            <div className="flex justify-between items-end text-[10px] mb-1.5">
              <span className="text-slate-500 font-black">{accepted}/{total}</span>
              <span className={`font-black ${percent === 100 ? 'text-emerald-500' : 'text-emerald-500'}`}>{percent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner border border-slate-50">
              <div 
                className={`h-full transition-all duration-700 ease-out shadow-sm bg-emerald-500`}
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
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border shadow-sm ${poStatusColors[val]?.badge} ${poStatusColors[val]?.border}`}>
          <div className={`p-0.5 rounded-full ${poStatusColors[val]?.text.replace('text-', 'bg-')} text-white`}>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d={poStatusColors[val]?.icon || 'M5 13l4 4L19 7'} />
            </svg>
          </div>
          <span className="uppercase tracking-tight">{poStatusColors[val]?.label}</span>
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
          {(row.status === 'DRAFT' || row.status === 'PO_REQUEST') && (
            <button
              onClick={() => handleApprovePO(row.id)}
              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all border border-emerald-50 shadow-sm active:scale-90"
              title="Approve PO"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => handleViewPODetail(row.id)}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all border border-blue-50 shadow-sm active:scale-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (row.invoice_url) {
                window.open(`${API_BASE}/${row.invoice_url}`, '_blank');
              } else {
                setUploadingPoId(row.id);
                invoiceInputRef.current?.click();
              }
            }}
            className={`p-2 rounded-xl transition-all border shadow-sm active:scale-90 ${row.invoice_url ? 'text-emerald-500 bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 border-slate-50'}`}
            title={row.invoice_url ? "View Invoice" : "Upload Invoice"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          {row.vendor_id && (
            <button
              onClick={() => openEmailModal(row)}
              className={`p-2 rounded-full transition-all border shadow-sm active:scale-90 ${row.status === 'SENT' ? 'text-emerald-500 bg-emerald-50 border-emerald-50' : 'text-blue-600 bg-blue-50 border-blue-50'}`}
              title={row.status === 'SENT' ? "Resend PO to Vendor" : "Send PO to Vendor"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => handleEditPO(row.id)}
            className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all border border-slate-50 shadow-sm active:scale-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDeletePO(row.id)}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-rose-50 shadow-sm active:scale-90"
            title="Delete PO"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const filteredPOs = pos.filter(po => {
    const matchesSearch = !searchTerm || 
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (viewMode === 'detail' && selectedPO) {
    return (
      <PurchaseOrderDetail 
        po={selectedPO} 
        onBack={() => setViewMode('list')} 
        onRefresh={() => {
          handleViewPODetail(selectedPO.id);
          fetchPOs();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-indigo-200 shadow-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Buying</span>
              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              <span>Procurement</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Orders</h1>
            <p className="text-xs text-slate-500 font-medium">Manage procurement cycles and supplier orders</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              KANBAN
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              LIST
            </button>
          </div>
          <button
            onClick={() => fetchPOs()}
            className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-slate-200 shadow-sm active:scale-95 bg-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button
            onClick={() => {
              setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
              setShowManualCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            Create Order
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {[
            { label: 'Total Orders', value: stats.total_pos, sub: `Total: ${formatCurrency(stats.total_value)}`, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'blue', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
            { label: 'Draft', value: stats.draft_pos, sub: 'Pending submission', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'orange', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
            { label: 'Submitted', value: stats.submitted_pos, sub: 'Active orders', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8', color: 'blue', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
            { label: 'To Receive', value: stats.to_receive_pos, sub: 'Awaiting delivery', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', color: 'indigo', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
            { label: 'Partial', value: stats.partial_pos, sub: 'Incomplete receipts', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'rose', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
            { label: 'Fulfilled', value: stats.fulfilled_pos, sub: 'Fully received', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'emerald', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          ].map((stat, idx) => (
            <div key={idx} className={`${stat.bg} border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
              {stat.bg !== 'bg-white' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <p className={`text-[10px] font-bold ${stat.bg === 'bg-white' ? 'text-slate-400' : 'text-blue-100'} uppercase tracking-wider`}>{stat.label}</p>
                  <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded-xl shadow-sm`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
                  </div>
                </div>
                <p className={`text-2xl font-black ${stat.text} tracking-tight`}>{stat.value || 0}</p>
                <p className={`text-[10px] ${stat.subText} mt-1 font-medium`}>{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Search PO # or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
          />
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <button
          onClick={() => fetchPOs()}
          className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-slate-200 shadow-sm active:scale-95 bg-slate-50/50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>

        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm font-bold text-blue-600 outline-none bg-transparent cursor-pointer"
          >
            <option value="ALL">All Orders</option>
            <option value="PO_REQUEST">Requests</option>
            <option value="DRAFT">Draft</option>
            <option value="ORDERED">Ordered</option>
            <option value="SENT">Sent</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RECEIVED">Received</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <button className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
        </button>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        <DataTable
          columns={columns}
          data={filteredPOs}
          loading={loading}
          hideHeader={true}
          className="border-none shadow-none rounded-none"
        />
      </div>

      {/* Manual Create PO Modal (New Design) */}
      {showManualCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-50">
              <h2 className="text-xl font-bold text-slate-800">{manualFormData.id ? 'Edit Purchase Order Request' : 'Create New Purchase Order'}</h2>
              <button 
                onClick={() => {
                  setShowManualCreateModal(false);
                  setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreateManualPO} className="p-6 space-y-6 max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar">
              {/* Basic Information Section */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Basic Information</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Supplier *</label>
                    <select
                      value={manualFormData.vendorId}
                      onChange={(e) => setManualFormData({ ...manualFormData, vendorId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    >
                      <option value="">Select Supplier</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.vendor_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Order Date *</label>
                    <input
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Expected Delivery *</label>
                    <input
                      type="date"
                      value={manualFormData.expectedDeliveryDate}
                      onChange={(e) => setManualFormData({ ...manualFormData, expectedDeliveryDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Purchase Order Items Section */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">Purchase Order Items</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddManualItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-50 transition-all shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Add Item
                  </button>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="px-4 py-3 text-left">Item Details</th>
                        <th className="px-4 py-3 text-center w-24">DESIGN QTY</th>
                        <th className="px-4 py-3 text-center w-24">UOM</th>
                        <th className="px-4 py-3 text-center w-32">RATE</th>
                        <th className="px-4 py-3 text-right w-32">AMOUNT</th>
                        <th className="px-4 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {manualFormData.items.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                          <td className="px-4 py-3">
                            <select
                              value={item.item_code}
                              onChange={(e) => handleManualItemChange(idx, 'item_code', e.target.value)}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                            >
                              <option value="">Select Item</option>
                              {stockItems.map(si => (
                                <option key={si.id} value={si.item_code}>
                                  {si.item_code} - {si.item_description || si.material_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleManualItemChange(idx, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.unit}
                              readOnly
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-center text-slate-400 outline-none uppercase"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleManualItemChange(idx, 'rate', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <button 
                              type="button"
                              onClick={() => handleRemoveManualItem(idx)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
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
                <div className="p-4 bg-slate-50/30 border-t border-slate-100 grid grid-cols-3 gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Items</span>
                    <span className="text-xl font-bold text-slate-800">{manualFormData.items.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Qty</span>
                    <span className="text-xl font-bold text-slate-800">
                      {manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Subtotal</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Tax & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">Tax & Currency</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Currency</label>
                      <select
                        value={manualFormData.currency}
                        onChange={(e) => setManualFormData({ ...manualFormData, currency: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                      >
                        <option>INR (Indian Rupee)</option>
                        <option>USD (US Dollar)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-blue-600 rounded-2xl p-1 shadow-lg shadow-blue-200 overflow-hidden flex flex-col">
                  <div className="flex-1 p-6 space-y-4">
                    <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-3">
                      <span className="text-sm font-medium">Subtotal</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-white/80 border-b border-white/10 pb-3">
                      <span className="text-sm font-medium">Tax Amount</span>
                      <span className="text-lg font-bold">{formatCurrency(0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualCreateModal(false);
                    setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
                  }}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Create PO from Quotation</h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setPoItems([]);
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-6 space-y-6 max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Select Approved Quotation *</label>
                  <select
                    value={formData.quotationId}
                    onChange={(e) => handleQuotationChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">PO Number *</label>
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
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
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
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                        required
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Expected Delivery Date *</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Project Name</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    readOnly
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 outline-none"
                  />
                </div>
              </div>

              {poItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">Quotation Items Preview</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-left">Material</th>
                          <th className="px-4 py-3 text-center">Design Qty</th>
                          <th className="px-4 py-3 text-right">Rate</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {poItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-700 text-xs">{item.description}</p>
                              {item.item_code && <p className="text-[10px] text-slate-400">{item.item_code}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">{item.material_name || '—'}</td>
                            <td className="px-4 py-3 text-center text-xs text-slate-600 font-bold">{Number(item.design_qty || item.quantity || 0).toFixed(3)} {item.unit || 'NOS'}</td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500">{formatCurrency(item.unit_rate)}</td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">{formatCurrency(item.total_amount || (item.quantity * item.unit_rate))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50">
                        <tr>
                          <td colSpan="4" className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</td>
                          <td className="px-4 py-3 text-right text-sm font-black text-blue-600">
                            {formatCurrency(poItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || (item.quantity * item.unit_rate)), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any special instructions or notes"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  rows="3"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-50">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Edit Purchase Order</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleUpdatePO} className="p-6 space-y-6">
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-sm space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">PO Number:</span>
                  <input
                    type="text"
                    value={selectedPO.po_number}
                    onChange={(e) => setSelectedPO({...selectedPO, po_number: e.target.value})}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-blue-600 font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor:</span>
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
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm font-bold text-slate-700">{selectedPO.vendor_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Amount:</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">{formatCurrency(selectedPO.total_amount)}</span>
                    <div className="flex gap-2 text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                      <span>Sub: {formatCurrency(poItems.reduce((sum, i) => sum + (parseFloat(i.amount) || (i.quantity * (i.unit_rate || i.rate || 0))), 0))}</span>
                      <span className="text-emerald-500">Tax: {formatCurrency(poItems.reduce((sum, i) => sum + (parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0)) || (i.quantity * (i.unit_rate || i.rate || 0) * 0.18), 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Items (Update Rates & Tax)</h3>
                  <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Default 18% GST Applied</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Rate</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {poItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">{item.material_name || item.description}</span>
                              <span className="text-[9px] text-slate-400 font-medium">{item.item_code}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-black text-slate-600">{item.quantity}</span>
                            <span className="text-[9px] text-slate-400 ml-1 uppercase">{item.unit || 'NOS'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative group max-w-[120px] mx-auto">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">₹</span>
                              <input
                                type="number"
                                value={item.unit_rate || item.rate || 0}
                                onChange={(e) => handleEditItemChange(idx, 'unit_rate', e.target.value)}
                                className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black text-slate-800">{formatCurrency(item.total_amount || (item.quantity * (item.unit_rate || item.rate || 0) * 1.18))}</span>
                              <span className="text-[9px] text-emerald-500 font-bold">+18% GST</span>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  >
                    <option value="">-- Select Status --</option>
                    {Object.keys(poStatusColors).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={editFormData.expectedDeliveryDate ? new Date(editFormData.expectedDeliveryDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditFormData({...editFormData, expectedDeliveryDate: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  rows="3"
                  placeholder="Add notes about this order"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Send PO to Vendor</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedPO.po_number} • {selectedPO.vendor_name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={emailData.to}
                    onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                    placeholder="vendor@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Subject</label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Message</label>
                  <textarea
                    value={emailData.message}
                    onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                    rows="5"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <div className="p-2 bg-emerald-500 text-white rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Attachment</p>
                    <p className="text-xs font-bold text-emerald-600">PurchaseOrder_{selectedPO.po_number}.pdf</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="attachPDF"
                      checked={emailData.attachPDF}
                      onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor="attachPDF" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Include</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      )}
      <input
        type="file"
        ref={invoiceInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default PurchaseOrders;

