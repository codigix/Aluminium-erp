import React, { useState, useEffect, useRef } from 'react';
import { Card, DataTable, SearchableSelect } from '../components/ui.jsx';
import { 
  Package, 
  Search, 
  Plus, 
  RefreshCw, 
  Filter, 
  Download, 
  ChevronRight, 
  FileEdit, 
  ClipboardList, 
  Send, 
  CheckCircle2, 
  Inbox, 
  XCircle, 
  AlertCircle,
  Loader2,
  Eye,
  Trash2,
  Check,
  Mail,
  FileUp,
  FileText,
  File,
  Clock,
  ArrowRight,
  LayoutGrid,
  List,
  X,
  Info,
  CreditCard,
  Building2,
  CheckCircle
} from 'lucide-react';
import PurchaseOrderDetail from './PurchaseOrderDetail.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700', label: 'draft', icon: FileEdit },
  PO_REQUEST: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700', label: 'po request', icon: ClipboardList },
  ORDERED: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700', label: 'ordered', icon: Send },
  'Sent ': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700', label: 'sent', icon: Send },
  ACKNOWLEDGED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-50 text-cyan-700', label: 'acknowledged', icon: CheckCircle2 },
  RECEIVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'received', icon: Inbox },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-50 text-slate-700', label: 'closed', icon: XCircle },
  FULFILLED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'fulfilled', icon: CheckCircle2 },
  COMPLETED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: 'completed', icon: CheckCircle2 },
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
          <span className=" text-blue-600 cursor-pointer hover:underline text-sm tracking-tight">
            {val || `PO-${String(row.id).padStart(4, '0')}`}
          </span>
          <span className="text-[10px] text-slate-400  flex items-center gap-1 mt-0.5">
            <File className="w-3 h-3 opacity-50" />
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
          <span className={` text-sm tracking-tight ${!val ? 'text-rose-500 italic' : 'text-slate-700'}`}>
            {val || 'Vendor Not Selected'}
          </span>
          <span className="text-[10px] text-slate-400   tracking-widest mt-0.5">
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
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs  text-slate-500  ">
            <Clock className="w-3 h-3 text-slate-400" />
            {formatDate(row.created_at)}
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-400 opacity-50" />
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-100 rounded text-xs  text-amber-600  ">
            <Clock className="w-3 h-3 text-amber-400" />
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
          <span className="text-[10px] text-emerald-500 font-black  tracking-widest mt-0.5">Net Value</span>
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
            <div className="flex justify-between items-endtext-xs  mb-1.5">
              <span className="text-slate-500 font-black">{accepted}/{total}</span>
              <span className={`font-black ${percent === 100 ? 'text-emerald-500' : 'text-emerald-500'}`}>{percent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded  h-2.5 overflow-hidden shadow-inner border border-slate-50">
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
      render: (val) => {
        const Icon = poStatusColors[val]?.icon || AlertCircle;
        return (
          <span className={`inline-flex items-center gap-1.5 p-2  rounded text-xs  font-extrabold border  ${poStatusColors[val]?.badge} ${poStatusColors[val]?.border}`}>
            <div className={`p-0.5 rounded  ${poStatusColors[val]?.text.replace('text-', 'bg-')} text-white`}>
              <Icon className="w-2.5 h-2.5" />
            </div>
            <span className=" tracking-tight">{poStatusColors[val]?.label}</span>
          </span>
        );
      }
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-center gap-2" onClick={e => e.stopPropagation()}>
          {(row.status === 'DRAFT' || row.status === 'PO_REQUEST') && (
            <button
              onClick={() => handleApprovePO(row.id)}
              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded  transition-all border border-emerald-50  active:scale-90"
              title="Approve PO"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleViewPODetail(row.id)}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded  transition-all border border-blue-50  active:scale-90"
          >
            <Eye className="w-4 h-4" />
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
            className={`p-2 rounded  transition-all border  active:scale-90 ${row.invoice_url ? 'text-emerald-500 bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 border-slate-50'}`}
            title={row.invoice_url ? "View Invoice" : "Upload Invoice"}
          >
            <FileUp className="w-4 h-4" />
          </button>
          {row.vendor_id && (
            <button
              onClick={() => openEmailModal(row)}
              className={`p-2 rounded  transition-all border  active:scale-90 ${row.status === 'Sent ' ? 'text-emerald-500 bg-emerald-50 border-emerald-50' : 'text-blue-600 bg-blue-50 border-blue-50'}`}
              title={row.status === 'Sent ' ? "Resend PO to Vendor" : "Send PO to Vendor"}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleEditPO(row.id)}
            className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded  transition-all border border-slate-50  active:scale-90"
          >
            <FileEdit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeletePO(row.id)}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded  transition-all border border-rose-50  active:scale-90"
            title="Delete PO"
          >
            <Trash2 className="w-4 h-4" />
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
          <div className="p-3 bg-indigo-600 rounded  text-white shadow-indigo-200 shadow-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs  text-slate-400   tracking-widest">
              <span>Buying</span>
              <ChevronRight className="w-2 h-2" />
              <span>Procurement</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Orders</h1>
            <p className="text-xs text-slate-500 ">Manage procurement cycles and supplier orders</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded  border border-slate-200">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2  p-2  rounded text-xs  font-black transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900  border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              KANBAN
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2  p-2  rounded text-xs  font-black transition-all ${viewMode === 'list' ? 'bg-white text-slate-900  border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-3.5 h-3.5" />
              LIST
            </button>
          </div>
          <button
            onClick={() => fetchPOs()}
            className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded  transition-all border border-slate-200  active:scale-95 bg-white"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
              setShowManualCreateModal(true);
            }}
            className="flex items-center gap-2  px-5 py-2.5 bg-blue-600 text-white rounded  text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Order
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {[
            { label: 'Total Orders', value: stats.total_pos, sub: `Total: ${formatCurrency(stats.total_value)}`, icon: ClipboardList, color: 'blue', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
            { label: 'Draft', value: stats.draft_pos, sub: 'Pending submission', icon: FileEdit, color: 'orange', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
            { label: 'Submitted', value: stats.submitted_pos, sub: 'Active orders', icon: Send, color: 'blue', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
            { label: 'To Receive', value: stats.to_receive_pos, sub: 'Awaiting delivery', icon: Inbox, color: 'indigo', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
            { label: 'Partial', value: stats.partial_pos, sub: 'Incomplete receipts', icon: AlertCircle, color: 'rose', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
            { label: 'Fulfilled', value: stats.fulfilled_pos, sub: 'Fully received', icon: CheckCircle2, color: 'emerald', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className={`${stat.bg} border border-slate-200 rounded  p-4  hover:shadow-md transition-all relative overflow-hidden group`}>
                {stat.bg !== 'bg-white' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded  -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>}
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <p className={`text-[10px]  ${stat.bg === 'bg-white' ? 'text-slate-400' : 'text-blue-100'}  `}>{stat.label}</p>
                    <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded  `}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className={`text-2xl font-black ${stat.text} tracking-tight`}>{stat.value || 0}</p>
                  <p className={`text-[10px] ${stat.subText} mt-1 `}>{stat.sub}</p>
                </div>
              </div>
            );
          })}
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
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded  text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all "
          />
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          onClick={() => fetchPOs()}
          className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded  transition-all border border-slate-200  active:scale-95 bg-slate-50/50"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2  p-2  bg-white border border-slate-200 rounded  ">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400   ">Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm  text-blue-600 outline-none bg-transparent cursor-pointer"
          >
            <option value="ALL">All Orders</option>
            <option value="PO_REQUEST">Requests</option>
            <option value="DRAFT">Draft</option>
            <option value="ORDERED">Ordered</option>
            <option value="Sent ">Sent</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RECEIVED">Received</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <button className="p-2.5 bg-emerald-500 text-white rounded  hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded  border border-slate-200  overflow-hidden">
        
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
              <h2 className="text-xl  text-slate-800">{manualFormData.id ? 'Edit Purchase Order Request' : 'Create New Purchase Order'}</h2>
              <button 
                onClick={() => {
                  setShowManualCreateModal(false);
                  setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
                }}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateManualPO} className="p-6 space-y-6 max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar">
              {/* Basic Information Section */}
              <div className="bg-white border border-slate-200 rounded  overflow-hidden ">
                <div className="bg-slate-50/50 p-2  border-b border-slate-100 flex items-center gap-2 ">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                    <Info className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm  text-slate-700">Basic Information</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px]  text-slate-400   ml-1">Supplier *</label>
                    <select
                      value={manualFormData.vendorId}
                      onChange={(e) => setManualFormData({ ...manualFormData, vendorId: e.target.value })}
                      className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    >
                      <option value="">Select Supplier</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.vendor_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px]  text-slate-400   ml-1">Order Date *</label>
                    <input
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px]  text-slate-400   ml-1">Expected Delivery *</label>
                    <input
                      type="date"
                      value={manualFormData.expectedDeliveryDate}
                      onChange={(e) => setManualFormData({ ...manualFormData, expectedDeliveryDate: e.target.value })}
                      className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Purchase Order Items Section */}
              <div className="bg-white border border-slate-200 rounded  overflow-hidden ">
                <div className="bg-slate-50/50 p-2  border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 ">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                      <Package className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm  text-slate-700">Purchase Order Items</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddManualItem}
                    className="flex items-center gap-1.5 p-2 .5 bg-white border border-blue-200 text-blue-600 rounded text-xs   hover:bg-blue-50 transition-all "
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px]  text-slate-400   border-b border-slate-100">
                        <th className="p-2  text-left">Item Details</th>
                        <th className="p-2  text-center w-24">DESIGN QTY</th>
                        <th className="p-2  text-center w-24">UOM</th>
                        <th className="p-2  text-center w-32">RATE</th>
                        <th className="p-2  text-right w-32">AMOUNT</th>
                        <th className="p-2  text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {manualFormData.items.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                          <td className="p-2 ">
                            <select
                              value={item.item_code}
                              onChange={(e) => handleManualItemChange(idx, 'item_code', e.target.value)}
                              className="w-full p-2  bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                            >
                              <option value="">Select Item</option>
                              {stockItems.map(si => (
                                <option key={si.id} value={si.item_code}>
                                  {si.item_code} - {si.item_description || si.material_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 ">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleManualItemChange(idx, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                          </td>
                          <td className="p-2 ">
                            <input
                              type="text"
                              value={item.unit}
                              readOnly
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs  font-black text-center text-slate-400 outline-none "
                            />
                          </td>
                          <td className="p-2 ">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleManualItemChange(idx, 'rate', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded  text-xs  text-center focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                          </td>
                          <td className="p-2  text-right  text-slate-700">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="p-2 ">
                            <button 
                              type="button"
                              onClick={() => handleRemoveManualItem(idx)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded  transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {manualFormData.items.length === 0 && (
                    <div className="p-2 text-center text-slate-400 italic text-xs">
                      No items added yet. Click 'Add Item' to start.
                    </div>
                  )}
                </div>
                <div className="p-4 bg-slate-50/30 border-t border-slate-100 grid grid-cols-3 gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px]  text-slate-400  ">Total Items</span>
                    <span className="text-xl  text-slate-800">{manualFormData.items.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px]  text-slate-400  ">Total Qty</span>
                    <span className="text-xl  text-slate-800">
                      {manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px]  text-slate-400  ">Item Subtotal</span>
                    <span className="text-xl  text-blue-600">
                      {formatCurrency(manualFormData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Tax & Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded  overflow-hidden ">
                  <div className="bg-slate-50/50 p-2  border-b border-slate-100 flex items-center gap-2 ">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm  text-slate-700">Tax & Currency</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px]  text-slate-400   ml-1">Currency</label>
                      <select
                        value={manualFormData.currency}
                        onChange={(e) => setManualFormData({ ...manualFormData, currency: e.target.value })}
                        className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm outline-none"
                      >
                        <option>INR (Indian Rupee)</option>
                        <option>USD (US Dollar)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-blue-600 rounded  p-1 shadow-lg shadow-blue-200 overflow-hidden flex flex-col">
                  <div className="flex-1 p-6 space-y-4">
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
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualCreateModal(false);
                    setManualFormData({ id: null, vendorId: '', expectedDeliveryDate: '', notes: '', currency: 'INR (Indian Rupee)', items: [] });
                  }}
                  className="p-2.5 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2  p-2.5 bg-blue-600 text-white rounded  text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
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
              <h2 className="text-xl  text-slate-800">Create PO from Quotation</h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setPoItems([]);
                }}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-6 space-y-6 max-h-[calc(90vh-100px)] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Select Approved Quotation *</label>
                  <select
                    value={formData.quotationId}
                    onChange={(e) => handleQuotationChange(e.target.value)}
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                  <label className="text-[10px]  text-slate-400   ml-1">PO Number *</label>
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
                      className="flex-1 p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all  "
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
                        className="flex-1 p-2 .5 bg-white border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all  "
                        required
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Expected Delivery Date *</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Project Name</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    readOnly
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm text-slate-500 outline-none"
                  />
                </div>
              </div>

              {poItems.length > 0 && (
                <div className="bg-white border border-slate-200 rounded  overflow-hidden ">
                  <div className="bg-slate-50/50 p-2  border-b border-slate-100 flex items-center gap-2 ">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded ">
                      <Package className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm  text-slate-700">Quotation Items Preview</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px]  text-slate-400   border-b border-slate-100">
                          <th className="p-2  text-left">Description</th>
                          <th className="p-2  text-left">Material</th>
                          <th className="p-2  text-center">Design Qty</th>
                          <th className="p-2  text-right">Rate</th>
                          <th className="p-2  text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {poItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                            <td className="p-2 ">
                              <p className=" text-slate-700 text-xs">{item.description}</p>
                              {item.item_code && <p className="text-[10px] text-slate-400">{item.item_code}</p>}
                            </td>
                            <td className="p-2  text-xs text-slate-500">{item.material_name || '—'}</td>
                            <td className="p-2  text-center text-xs text-slate-600 ">{Number(item.design_qty || item.quantity || 0).toFixed(3)} {item.unit || 'NOS'}</td>
                            <td className="p-2  text-right text-xs text-slate-500">{formatCurrency(item.unit_rate)}</td>
                            <td className="p-2  text-right text-xs  text-slate-800">{formatCurrency(item.total_amount || (item.quantity * item.unit_rate))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50">
                        <tr>
                          <td colSpan="4" className="p-2  text-righttext-xs   text-slate-400  ">Total Amount</td>
                          <td className="p-2  text-right text-sm font-black text-blue-600">
                            {formatCurrency(poItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || (item.quantity * item.unit_rate)), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px]  text-slate-400   ml-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any special instructions or notes"
                  className="w-full p-2  bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  rows="3"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-2.5 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2  p-2.5 bg-emerald-600 text-white rounded  text-sm  hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
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
              <h2 className="text-xl  text-slate-800 tracking-tight">Edit Purchase Order</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdatePO} className="p-6 space-y-6">
              <div className="bg-slate-50/50 p-4 rounded  border border-slate-100 text-sm space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-[10px]  text-slate-400   w-24">PO Number:</span>
                  <input
                    type="text"
                    value={selectedPO.po_number}
                    onChange={(e) => setSelectedPO({...selectedPO, po_number: e.target.value})}
                    className="flex-1 bg-white border border-slate-200 rounded  p-2 .5 text-blue-600  outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px]  text-slate-400  ">Vendor:</span>
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
                      className="w-full bg-white border border-slate-200 rounded  p-2 .5 text-sm  text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
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
                <div className="flex items-center gap-4">
                  <span className="text-[10px]  text-slate-400   w-24">Amount:</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">{formatCurrency(selectedPO.total_amount)}</span>
                    <div className="flex gap-2 text-[8px] text-slate-400   tracking-tighter">
                      <span>Sub: {formatCurrency(poItems.reduce((sum, i) => sum + (parseFloat(i.amount) || (i.quantity * (i.unit_rate || i.rate || 0))), 0))}</span>
                      <span className="text-emerald-500">Tax: {formatCurrency(poItems.reduce((sum, i) => sum + (parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0)) || (i.quantity * (i.unit_rate || i.rate || 0) * 0.18), 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-slate-400  tracking-widest">Order Items (Update Rates & Tax)</h3>
                  <span className="text-[9px]  text-emerald-500 bg-emerald-50 p-1  rounded ">Default 18% GST Applied</span>
                </div>
                <div className="bg-white border border-slate-200 rounded  overflow-hidden ">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2  text-[9px] font-black text-slate-400  tracking-widest">Item</th>
                        <th className="p-2  text-[9px] font-black text-slate-400  tracking-widest text-center">Qty</th>
                        <th className="p-2  text-[9px] font-black text-slate-400  tracking-widest text-center">Rate</th>
                        <th className="p-2  text-[9px] font-black text-slate-400  tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {poItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 ">
                            <div className="flex flex-col">
                              <span className="text-xs  text-slate-700">{item.material_name || item.description}</span>
                              <span className="text-[9px] text-slate-400 ">{item.item_code}</span>
                            </div>
                          </td>
                          <td className="p-2  text-center">
                            <span className="text-xs font-black text-slate-600">{item.quantity}</span>
                            <span className="text-[9px] text-slate-400 ml-1 ">{item.unit || 'NOS'}</span>
                          </td>
                          <td className="p-2 ">
                            <div className="relative group max-w-[120px] mx-auto">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400text-xs  ">₹</span>
                              <input
                                type="number"
                                value={item.unit_rate || item.rate || 0}
                                onChange={(e) => handleEditItemChange(idx, 'unit_rate', e.target.value)}
                                className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded  text-xs font-black text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-center"
                              />
                            </div>
                          </td>
                          <td className="p-2  text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black text-slate-800">{formatCurrency(item.total_amount || (item.quantity * (item.unit_rate || item.rate || 0) * 1.18))}</span>
                              <span className="text-[9px] text-emerald-500 ">+18% GST</span>
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
                  <label className="text-[10px]  text-slate-400   ml-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  >
                    <option value="">-- Select Status --</option>
                    {Object.keys(poStatusColors).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={editFormData.expectedDeliveryDate ? new Date(editFormData.expectedDeliveryDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditFormData({...editFormData, expectedDeliveryDate: e.target.value})}
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px]  text-slate-400   ml-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  className="w-full p-2  bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  rows="3"
                  placeholder="Add notes about this order"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-2.5 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2  p-2.5 bg-blue-600 text-white rounded  text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  <Check className="w-4 h-4" />
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
                <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl  text-slate-800 tracking-tight">Send PO to Vendor</h2>
                  <p className="text-[10px] text-slate-400   tracking-widest">{selectedPO.po_number} • {selectedPO.vendor_name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Recipient Email *</label>
                  <input
                    type="email"
                    value={emailData.to}
                    onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                    placeholder="vendor@example.com"
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Subject</label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px]  text-slate-400   ml-1">Message</label>
                  <textarea
                    value={emailData.message}
                    onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                    rows="5"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded ">
                  <div className="p-2 bg-emerald-500 text-white rounded ">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-700  ">Attachment</p>
                    <p className="text-xs  text-emerald-600">PurchaseOrder_{selectedPO.po_number}.pdf</p>
                  </div>
                  <div className="flex items-center gap-2 ">
                    <input
                      type="checkbox"
                      id="attachPDF"
                      checked={emailData.attachPDF}
                      onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor="attachPDF" className="text-[10px]  text-slate-500  ">Include</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="p-2.5 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2  px-8 py-2.5 bg-blue-600 text-white rounded  text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 text-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
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

