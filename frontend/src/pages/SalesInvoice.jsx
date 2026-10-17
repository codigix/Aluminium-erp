import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Calendar, CheckCircle2, Eye, Printer, Trash2,
  ArrowLeft, ArrowRight, Building, Hash, Layers, ShieldCheck, AlertCircle, ShoppingBag,
  Download, Clock, X, ChevronRight, Check, RefreshCw, AlertTriangle,
  Receipt, DollarSign, User, MapPin, Package, Send, Pencil, Filter, BarChart3, TrendingUp
} from 'lucide-react';
import Swal from 'sweetalert2';
import { SearchableSelect, Card } from '../components/ui.jsx';
import { getFileUrl } from '../utils/url';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

// Currency Formatter
const formatINR = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

// Date Formatter
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// Clean repeated words in address
const cleanAddressText = (raw) => {
  if (!raw || raw === '—') return '—';
  const parts = raw.split(/,\s*/);
  const seen = new Set();
  const deduped = [];
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      deduped.push(trimmed);
    }
  }
  return deduped.join(', ');
};

const INVOICE_COPY_TYPES = [
  { id: 'original', label: 'Original for Recipient', description: 'For recipient / customer receiving goods' },
  { id: 'duplicate', label: 'Duplicate for Transporter', description: 'To accompany the goods during transit' },
  { id: 'triplicate', label: 'Triplicate for Supplier', description: 'For supplier internal records & audit' },
  { id: 'additional', label: 'Additional Copy', description: 'Extra copy for administrative or filing use' }
];

export default function SalesInvoice() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create'
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [salesOrders, setSalesOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [removedItems, setRemovedItems] = useState([]);
  const [sendingId, setSendingId] = useState(null);
  const [poFilterDate, setPoFilterDate] = useState('');
  const [activeItemTab, setActiveItemTab] = useState('invoiceable'); // 'invoiceable' | 'dispatched_history'
  const [orderAllItems, setOrderAllItems] = useState([]);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyInvoiceFilter, setHistoryInvoiceFilter] = useState('ALL'); // 'ALL' | 'INVOICED' | 'PENDING' | specific invoiceNo
  const [invoiceHistoryModal, setInvoiceHistoryModal] = useState(null);

  // Host Company Billing Entity State
  const [hostCompanies, setHostCompanies] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedHostCompany, setSelectedHostCompany] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  // Invoice Copy Type Modal State
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyModalInvoice, setCopyModalInvoice] = useState(null);
  const [copyModalAction, setCopyModalAction] = useState('download'); // 'download' | 'print'
  const [selectedCopyType, setSelectedCopyType] = useState('Original for Recipient');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    orderId: '',
    orderNo: '',
    clientId: '',
    clientName: '',
    customerPoNo: '',
    projectName: '',
    gstin: '',
    billingAddress: '',
    shippingAddress: '',
    contactPerson: '',
    contactEmail: '',
    contactMobile: '',
    paymentTerms: 'Payment within 30 days',
    notes: 'Thank you for your business!',
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 0,
    isInterstate: false,
    summary: {
      totalOrderedQty: 0,
      totalDispatchedQty: 0,
      totalAlreadyInvoicedQty: 0,
      totalInvoiceableQty: 0
    },
    items: []
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // 1. Fetch Invoices List
  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const res = await fetch(`${API_BASE}/sales-invoices`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // 2. Fetch Available Sales Orders
  const fetchAvailableOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_BASE}/sales-invoices/available-orders`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSalesOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching available sales orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // 3. Fetch Host Billing Companies
  const fetchHostCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin-company-master`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setHostCompanies(list);
        if (!selectedHostId) {
          const active = list.find(c => c.status === 'ACTIVE') || list[0];
          if (active) {
            setSelectedHostId(String(active.id));
            setSelectedHostCompany(active);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching host companies:', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchAvailableOrders();
    fetchHostCompanies();
  }, []);

  // Open Create Form & Preload Next Invoice No
  const handleOpenCreate = async () => {
    try {
      setEditingInvoiceId(null);
      const res = await fetch(`${API_BASE}/sales-invoices/next-number`, {
        headers: getAuthHeaders()
      });
      const data = res.ok ? await res.json() : { invoiceNo: `INV-${new Date().getFullYear()}-0001` };

      // Reset to globally active host company if available
      const active = hostCompanies.find(c => c.status === 'ACTIVE') || hostCompanies[0];
      if (active) {
        setSelectedHostId(String(active.id));
        setSelectedHostCompany(active);
      }

      setFormData({
        invoiceNo: data.invoiceNo,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        orderId: '',
        orderNo: '',
        clientId: '',
        clientName: '',
        customerPoNo: '',
        projectName: '',
        gstin: '',
        billingAddress: '',
        shippingAddress: '',
        contactPerson: '',
        contactEmail: '',
        contactMobile: '',
        paymentTerms: 'Net 30 Days',
        notes: 'Subject to company jurisdiction. All taxes as applicable.',
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        isInterstate: false,
        summary: {
          totalOrderedQty: 0,
          totalDispatchedQty: 0,
          totalAlreadyInvoicedQty: 0,
          totalInvoiceableQty: 0
        },
        items: []
      });
      setPoFilterDate('');
      setOrderAllItems([]);
      setActiveItemTab('invoiceable');
      setViewMode('create');
    } catch (err) {
      console.error('Error loading next invoice no:', err);
      setViewMode('create');
    }
  };

  // Handle Sales Order Selection
  const handleSelectSalesOrder = async (orderId) => {
    if (!orderId) {
      setFormData(prev => ({
        ...prev,
        orderId: '',
        orderNo: '',
        clientId: '',
        clientName: '',
        customerPoNo: '',
        projectName: '',
        gstin: '',
        billingAddress: '',
        shippingAddress: '',
        contactPerson: '',
        contactEmail: '',
        contactMobile: '',
        summary: {
          totalOrderedQty: 0,
          totalDispatchedQty: 0,
          totalAlreadyInvoicedQty: 0,
          totalInvoiceableQty: 0
        },
        items: []
      }));
      setOrderAllItems([]);
      return;
    }

    setLoadingOrderDetails(true);
    try {
      const res = await fetch(`${API_BASE}/sales-invoices/order-details/${orderId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Failed to load order details');
      }
      const data = await res.json();

      const isInterstate = data.isInterstate !== undefined
        ? Boolean(data.isInterstate)
        : Boolean(data.igstRate > 0);

      const cgstRate = isInterstate ? 0 : (data.cgstRate !== undefined ? Number(data.cgstRate) : 9);
      const sgstRate = isInterstate ? 0 : (data.sgstRate !== undefined ? Number(data.sgstRate) : 9);
      const igstRate = isInterstate ? (data.igstRate !== undefined && Number(data.igstRate) > 0 ? Number(data.igstRate) : 18) : 0;

      // Auto-filter items with 0 invoiceable balance so zero-qty items are not shown on new invoice
      const validItems = (data.items || []).filter(it => (parseFloat(it.invoiceableQty) || 0) > 0);
      const zeroItems = (data.items || []).filter(it => (parseFloat(it.invoiceableQty) || 0) <= 0);
      setRemovedItems(zeroItems);
      setOrderAllItems(data.items || []);

      // Auto-select host company from Sales Order if present
      if (data.hostCompanyId) {
        const matchingHost = hostCompanies.find(h => String(h.id) === String(data.hostCompanyId));
        if (matchingHost) {
          setSelectedHostId(String(matchingHost.id));
          setSelectedHostCompany(matchingHost);
        }
      }

      setFormData(prev => ({
        ...prev,
        orderId: data.orderId,
        orderNo: data.orderNo,
        clientId: data.clientId,
        clientName: data.clientName,
        customerPoNo: data.customerPoNo,
        projectName: data.projectName,
        gstin: data.gstin,
        billingAddress: cleanAddressText(data.billingAddress),
        shippingAddress: cleanAddressText(data.shippingAddress),
        contactPerson: data.contactPerson,
        contactEmail: data.contactEmail,
        contactMobile: data.contactMobile,
        summary: data.summary,
        cgstRate,
        sgstRate,
        igstRate,
        isInterstate,
        items: validItems.map(it => ({
          ...it,
          invoiceQty: it.invoiceableQty,
          amount: it.invoiceableQty * (parseFloat(it.unitRate) || 0)
        }))
      }));
    } catch (err) {
      console.error('Error fetching order details:', err);
      Swal.fire({
        icon: 'error',
        title: 'Fetch Failed',
        text: 'Unable to retrieve Sales Order details. Please try again.'
      });
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Quantity input change handler
  const handleQuantityChange = (orderItemId, newQty) => {
    const qtyVal = parseFloat(newQty);
    setFormData(prev => {
      const updatedItems = prev.items.map(it => {
        if (it.orderItemId === orderItemId) {
          const maxAllowed = it.invoiceableQty;
          let safeQty = isNaN(qtyVal) ? 0 : qtyVal;
          if (safeQty > maxAllowed) {
            safeQty = maxAllowed;
            Swal.fire({
              icon: 'warning',
              title: 'Exceeds Balance',
              text: `Invoice quantity cannot exceed remaining invoiceable balance of ${maxAllowed}.`,
              timer: 1800,
              showConfirmButton: false
            });
          }
          if (safeQty < 0) safeQty = 0;
          return {
            ...it,
            invoiceQty: safeQty,
            amount: safeQty * (parseFloat(it.unitRate) || 0)
          };
        }
        return it;
      });
      return { ...prev, items: updatedItems };
    });
  };

  // Remove Item from Invoice
  const handleRemoveItem = (orderItemId) => {
    setFormData(prev => {
      const removed = prev.items.find(it => it.orderItemId === orderItemId);
      if (removed) {
        setRemovedItems(r => [...r, removed]);
      }
      return {
        ...prev,
        items: prev.items.filter(it => it.orderItemId !== orderItemId)
      };
    });
  };

  // Restore All Removed Items
  const handleRestoreAllItems = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        ...removedItems.map(it => {
          const qty = it.invoiceQty !== undefined ? it.invoiceQty : (it.invoiceableQty || 0);
          return {
            ...it,
            invoiceQty: qty,
            amount: qty * (parseFloat(it.unitRate) || 0)
          };
        })
      ]
    }));
    setRemovedItems([]);
  };

  // Calculated Totals
  const calculation = useMemo(() => {
    const subtotal = formData.items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
    const totalQty = formData.items.reduce((sum, it) => sum + (parseFloat(it.invoiceQty) || 0), 0);
    const cgst = (subtotal * (parseFloat(formData.cgstRate) || 0)) / 100;
    const sgst = (subtotal * (parseFloat(formData.sgstRate) || 0)) / 100;
    const igst = (subtotal * (parseFloat(formData.igstRate) || 0)) / 100;
    const total = subtotal + cgst + sgst + igst;
    return { subtotal, cgst, sgst, igst, total, totalQty };
  }, [formData.items, formData.cgstRate, formData.sgstRate, formData.igstRate]);

  // Unique invoices across items for this order
  const uniqueInvoicesForOrder = useMemo(() => {
    const items = orderAllItems.length > 0 ? orderAllItems : formData.items;
    const invMap = new Map();
    items.forEach(it => {
      (it.invoiceHistory || []).forEach(h => {
        if (h.invoiceNo && !invMap.has(h.invoiceNo)) {
          invMap.set(h.invoiceNo, h);
        }
      });
    });
    return Array.from(invMap.values());
  }, [orderAllItems, formData.items]);

  // Comprehensive analysis metrics for Dispatched Items & Invoice History
  const historyAnalysis = useMemo(() => {
    const items = orderAllItems.length > 0 ? orderAllItems : formData.items;
    let totalOrdered = 0;
    let totalDispatched = 0;
    let totalInvoicedQty = 0;
    let totalInvoicedAmount = 0;
    let totalRemainingQty = 0;
    let totalRemainingAmount = 0;
    let fullyInvoicedCount = 0;
    let partialInvoicedCount = 0;
    let pendingCount = 0;

    items.forEach(it => {
      const ord = parseFloat(it.orderedQty) || 0;
      const disp = parseFloat(it.dispatchedQty ?? it.orderedQty) || 0;
      const inv = parseFloat(it.previouslyInvoicedQty) || 0;
      const rem = parseFloat(it.invoiceableQty) || 0;
      const rate = parseFloat(it.unitRate) || 0;

      totalOrdered += ord;
      totalDispatched += disp;
      totalInvoicedQty += inv;
      totalInvoicedAmount += (inv * rate);
      totalRemainingQty += rem;
      totalRemainingAmount += (rem * rate);

      if (rem <= 0 && inv > 0) {
        fullyInvoicedCount++;
      } else if (inv > 0 && rem > 0) {
        partialInvoicedCount++;
      } else {
        pendingCount++;
      }
    });

    const invoiceProgressPct = totalDispatched > 0 
      ? Math.min(100, Math.round((totalInvoicedQty / totalDispatched) * 100)) 
      : 0;

    return {
      totalItems: items.length,
      totalOrdered,
      totalDispatched,
      totalInvoicedQty,
      totalInvoicedAmount,
      totalRemainingQty,
      totalRemainingAmount,
      fullyInvoicedCount,
      partialInvoicedCount,
      pendingCount,
      invoiceProgressPct,
      uniqueInvoicesCount: uniqueInvoicesForOrder.length
    };
  }, [orderAllItems, formData.items, uniqueInvoicesForOrder]);

  // Search & Filtered items for Dispatched Items & Invoice History tab
  const filteredHistoryItems = useMemo(() => {
    const items = orderAllItems.length > 0 ? orderAllItems : formData.items;
    return items.filter(item => {
      const prevInvoiced = parseFloat(item.previouslyInvoicedQty) || 0;
      const invBalance = parseFloat(item.invoiceableQty) || 0;

      // 1. Invoice filter
      if (historyInvoiceFilter === 'INVOICED') {
        if (prevInvoiced <= 0) return false;
      } else if (historyInvoiceFilter === 'PENDING') {
        if (invBalance <= 0) return false;
      } else if (historyInvoiceFilter !== 'ALL') {
        const hasInv = (item.invoiceHistory || []).some(h => h.invoiceNo === historyInvoiceFilter) ||
          (item.invoiceNumbers && item.invoiceNumbers.includes(historyInvoiceFilter));
        if (!hasInv) return false;
      }

      // 2. Search filter (item code, description, invoice no)
      if (historySearchTerm.trim()) {
        const q = historySearchTerm.toLowerCase().trim();
        const codeMatch = String(item.itemCode || item.drawingNo || '').toLowerCase().includes(q);
        const nameMatch = String(item.description || item.itemName || '').toLowerCase().includes(q);
        const invMatch = (item.invoiceHistory || []).some(h => String(h.invoiceNo || '').toLowerCase().includes(q)) ||
          String(item.invoiceNumbers || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !invMatch) return false;
      }

      return true;
    });
  }, [orderAllItems, formData.items, historyInvoiceFilter, historySearchTerm]);

  // Active filtered invoice number (from dropdown/chip or invoice search term)
  const activeFilteredInvoiceNo = useMemo(() => {
    if (historyInvoiceFilter && !['ALL', 'INVOICED', 'PENDING'].includes(historyInvoiceFilter)) {
      return historyInvoiceFilter.trim();
    }
    const q = (historySearchTerm || '').trim().toLowerCase();
    if (q) {
      const found = uniqueInvoicesForOrder.find(inv => 
        inv.invoiceNo && (
          inv.invoiceNo.toLowerCase() === q ||
          inv.invoiceNo.toLowerCase().includes(q)
        )
      );
      if (found) {
        return found.invoiceNo;
      }
    }
    return null;
  }, [historyInvoiceFilter, historySearchTerm, uniqueInvoicesForOrder]);

  // Save Invoice (Create or Update)
  const handleSaveInvoice = async () => {
    if (!formData.orderId) {
      Swal.fire({ icon: 'warning', title: 'Sales Order Required', text: 'Please select a Sales Order before saving.' });
      return;
    }
    if (calculation.totalQty <= 0) {
      Swal.fire({ icon: 'warning', title: 'Quantity Required', text: 'Please enter an invoice quantity greater than 0 for at least one item.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoiceNo: formData.invoiceNo,
        orderId: formData.orderId,
        clientId: formData.clientId,
        host_company_id: selectedHostId ? parseInt(selectedHostId, 10) : null,
        customerPoNo: formData.customerPoNo,
        projectName: formData.projectName,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || null,
        billingAddress: formData.billingAddress,
        shippingAddress: formData.shippingAddress,
        gstin: formData.gstin,
        paymentTerms: formData.paymentTerms,
        notes: formData.notes,
        cgstRate: formData.cgstRate,
        sgstRate: formData.sgstRate,
        igstRate: formData.igstRate,
        items: formData.items.filter(it => (parseFloat(it.invoiceQty) || 0) > 0)
      };

      const isEditing = Boolean(editingInvoiceId);
      const url = isEditing ? `${API_BASE}/sales-invoices/${editingInvoiceId}` : `${API_BASE}/sales-invoices`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${isEditing ? 'update' : 'save'} invoice`);
      }

      const updatedInvNo = data.data?.invoiceNo || formData.invoiceNo;
      await Swal.fire({
        icon: 'success',
        title: isEditing ? 'Invoice Updated!' : 'Invoice Created!',
        text: `Sales Invoice ${updatedInvNo} has been ${isEditing ? 'updated' : 'generated'} successfully.`,
        timer: 1800,
        showConfirmButton: false
      });

      setEditingInvoiceId(null);
      await fetchInvoices();
      await fetchAvailableOrders();
      setViewMode('list');
    } catch (err) {
      console.error('Error saving invoice:', err);
      Swal.fire({
        icon: 'error',
        title: editingInvoiceId ? 'Update Failed' : 'Creation Failed',
        text: err.message || 'An error occurred while saving the sales invoice.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Edit Invoice (Load into form)
  const handleEditInvoice = async (invoice) => {
    if (invoice.status === 'Paid') {
      Swal.fire({
        icon: 'info',
        title: 'Paid Invoice',
        text: 'This invoice has already been paid and cannot be edited.'
      });
      return;
    }

    try {
      setLoadingOrderDetails(true);
      // 1. Fetch complete invoice details
      const resInv = await fetch(`${API_BASE}/sales-invoices/${invoice.id}`, {
        headers: getAuthHeaders()
      });
      if (!resInv.ok) throw new Error('Failed to load invoice details');
      const invData = await resInv.json();

      // 2. Fetch order details excluding this invoice
      const resOrd = await fetch(`${API_BASE}/sales-invoices/order-details/${invData.order_id}?excludeInvoiceId=${invData.id}`, {
        headers: getAuthHeaders()
      });
      let orderData = null;
      if (resOrd.ok) {
        orderData = await resOrd.json();
      }

      // 3. Map items: take order items with their remaining invoiceable balance, and fill invoiceQty from existing invoice
      const invItemsMap = {};
      (invData.items || []).forEach(it => {
        if (it.order_item_id) invItemsMap[it.order_item_id] = it;
        else if (it.item_code) invItemsMap[it.item_code] = it;
      });

      // 3. Map items: in Edit mode, ONLY load items that belong to THIS invoice (invoice_qty > 0)
      let mergedItems = [];
      if (orderData && Array.isArray(orderData.items) && orderData.items.length > 0) {
        mergedItems = orderData.items
          .filter(ordIt => {
            const existingIt = invItemsMap[ordIt.orderItemId] || invItemsMap[ordIt.itemCode];
            return existingIt && (parseFloat(existingIt.invoice_qty) || 0) > 0;
          })
          .map(ordIt => {
            const existingIt = invItemsMap[ordIt.orderItemId] || invItemsMap[ordIt.itemCode];
            const currentQty = parseFloat(existingIt.invoice_qty) || 0;
            return {
              ...ordIt,
              invoiceQty: currentQty,
              amount: currentQty * (parseFloat(ordIt.unitRate) || 0)
            };
          });
      }
      
      // Fallback directly to existing invoice items if not matched in orderData
      if (mergedItems.length === 0 && Array.isArray(invData.items)) {
        mergedItems = (invData.items || []).map(it => ({
          orderItemId: it.order_item_id,
          itemCode: it.item_code || '',
          drawingNo: it.drawing_no || '',
          description: it.description || '',
          hsnCode: it.hsn_code || '84779000',
          uom: it.uom || 'Nos',
          orderedQty: parseFloat(it.ordered_qty) || 0,
          dispatchedQty: parseFloat(it.dispatched_qty) || 0,
          previouslyInvoicedQty: parseFloat(it.previously_invoiced_qty) || 0,
          invoiceableQty: parseFloat(it.invoice_qty) || 0,
          invoiceQty: parseFloat(it.invoice_qty) || 0,
          unitRate: parseFloat(it.unit_rate) || 0,
          amount: (parseFloat(it.invoice_qty) || 0) * (parseFloat(it.unit_rate) || 0)
        }));
      }

      setActiveItemTab('invoiceable');

      const isInterstate = parseFloat(invData.igst_rate) > 0;

      setEditingInvoiceId(invData.id);

      const targetHostId = invData.host_company_id ? String(invData.host_company_id) : '';
      setSelectedHostId(targetHostId);
      if (targetHostId) {
        const foundHost = hostCompanies.find(h => String(h.id) === targetHostId);
        if (foundHost) setSelectedHostCompany(foundHost);
      }

      setFormData({
        invoiceNo: invData.invoice_no,
        invoiceDate: invData.invoice_date ? invData.invoice_date.split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: invData.due_date ? invData.due_date.split('T')[0] : '',
        orderId: invData.order_id,
        orderNo: invData.order_no,
        clientId: invData.client_id,
        clientName: invData.client_name,
        customerPoNo: invData.customer_po_no || '',
        projectName: invData.project_name || '',
        gstin: invData.gstin || '',
        billingAddress: invData.billing_address || '',
        shippingAddress: invData.shipping_address || '',
        contactPerson: invData.contact_person || '',
        contactEmail: invData.contact_email || '',
        contactMobile: invData.contact_mobile || '',
        paymentTerms: invData.payment_terms || 'Payment within 30 days',
        notes: invData.notes || 'Thank you for your business!',
        cgstRate: isInterstate ? 0 : (parseFloat(invData.cgst_rate) || 9),
        sgstRate: isInterstate ? 0 : (parseFloat(invData.sgst_rate) || 9),
        igstRate: isInterstate ? (parseFloat(invData.igst_rate) || 18) : 0,
        isInterstate: isInterstate,
        summary: orderData?.summary || {
          totalOrderedQty: invData.total_qty || 0,
          totalDispatchedQty: invData.total_qty || 0,
          totalAlreadyInvoicedQty: 0,
          totalInvoiceableQty: invData.total_qty || 0
        },
        items: mergedItems
      });

      setRemovedItems([]);
      setViewMode('create');
    } catch (err) {
      console.error('Error loading invoice for edit:', err);
      Swal.fire({
        icon: 'error',
        title: 'Edit Failed',
        text: err.message || 'Could not load invoice details.'
      });
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (invoice) => {
    const confirm = await Swal.fire({
      title: `Delete ${invoice.invoice_no}?`,
      text: 'This will delete the invoice and restore the invoiceable balance to the sales order.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_BASE}/sales-invoices/${invoice.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          Swal.fire({ icon: 'success', title: 'Deleted', text: 'Invoice has been removed.', timer: 1500, showConfirmButton: false });
          fetchInvoices();
          fetchAvailableOrders();
        } else {
          throw new Error('Failed to delete invoice');
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
      }
    }
  };

  // View / Print Modal
  const handleViewInvoice = async (invoice) => {
    try {
      const res = await fetch(`${API_BASE}/sales-invoices/${invoice.id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const fullData = await res.json();
        setSelectedInvoice(fullData);
      } else {
        setSelectedInvoice(invoice);
      }
    } catch {
      setSelectedInvoice(invoice);
    }
  };

  // Download Invoice PDF with chosen copy type
  const handleDownloadInvoice = async (invoiceId, invoiceNo = '', copyType = 'Original for Recipient') => {
    try {
      setDownloadingPdf(true);
      const res = await fetch(`${API_BASE}/sales-invoices/${invoiceId}/pdf?copyType=${encodeURIComponent(copyType)}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Failed to generate Tax Invoice PDF');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      
      const link = document.createElement('a');
      link.href = url;
      const cleanNo = (invoiceNo || `Invoice-${invoiceId}`).replace(/[/\\?%*:|"<>]/g, '-');
      const cleanCopy = (copyType || 'Original').replace(/\s+/g, '_');
      link.download = `${cleanNo}_${cleanCopy}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.open(url, '_blank');

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 15000);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: err.message || 'Unable to download Tax Invoice PDF.'
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Print Invoice PDF directly (generates official multi-page PDF & launches print preview)
  const handlePrintInvoice = async (invoice, copyType = 'Original for Recipient') => {
    if (!invoice?.id) return;
    try {
      setPrintingPdf(true);
      Swal.fire({
        title: 'Preparing Print...',
        text: `Loading Tax Invoice PDF (${copyType})...`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const res = await fetch(`${API_BASE}/sales-invoices/${invoice.id}/pdf?copyType=${encodeURIComponent(copyType)}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error('Failed to generate Tax Invoice PDF for printing');
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      Swal.close();

      // Open PDF in print tab / trigger print dialog
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
        printWindow.onload = () => {
          try {
            printWindow.print();
          } catch (e) {
            console.log('PDF print handled by browser viewer', e);
          }
        };
      } else {
        // Fallback for pop-up blocker: hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            } catch (e) {
              console.error(e);
            }
          }, 400);
        };
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (err) {
      console.error('Error printing invoice:', err);
      Swal.fire({
        icon: 'error',
        title: 'Print Failed',
        text: err.message || 'Unable to print Tax Invoice PDF.'
      });
    } finally {
      setPrintingPdf(false);
    }
  };

  // Open copy type popup modal
  const handleOpenCopyModal = (invoice, action = 'download') => {
    setCopyModalInvoice(invoice);
    setCopyModalAction(action);
    setSelectedCopyType('Original for Recipient'); // Default Copy Selection
    setCopyModalOpen(true);
  };

  // Trigger download from modal
  const handleConfirmDownloadPdf = async () => {
    if (!copyModalInvoice) return;
    const inv = copyModalInvoice;
    const copy = selectedCopyType;
    setCopyModalOpen(false); // Close modal after download is triggered
    await handleDownloadInvoice(inv.id, inv.invoice_no, copy);
  };

  // Transfer Sales Invoice to Accounts (Customer Receivables)
  const handleSendToAccounts = async (invoice) => {
    const result = await Swal.fire({
      title: 'Send to Accounts?',
      html: `Transfer <b>${invoice.invoice_no}</b> (Amount: <b>${formatINR(invoice.total_amount)}</b>) to <b>Customer Receivables</b> in Accounts?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Send to Accounts',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        setSendingId(invoice.id);
        const res = await fetch(`${API_BASE}/sales-invoices/${invoice.id}/send-to-accounts`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to transfer invoice to Accounts');
        }
        Swal.fire({
          icon: 'success',
          title: 'Sent to Accounts!',
          text: `Invoice ${invoice.invoice_no} has been transferred to Customer Receivables.`,
          timer: 2000,
          showConfirmButton: false
        });
        fetchInvoices();
      } catch (err) {
        console.error('Error sending invoice to accounts:', err);
        Swal.fire({
          icon: 'error',
          title: 'Transfer Failed',
          text: err.message || 'Unable to transfer invoice to Accounts.'
        });
      } finally {
        setSendingId(null);
      }
    }
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = searchTerm === '' ||
        (inv.invoice_no && inv.invoice_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.order_no && inv.order_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.client_name && inv.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.customer_po_no && inv.customer_po_no.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = invoices.length;
    const totalValue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
    const paid = invoices.filter(inv => inv.status === 'Paid').length;
    const created = invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Cancelled').length;
    return { total, totalValue, paid, created };
  }, [invoices]);

  // Filter available orders by poFilterDate (matches either order_date or customer_po_date)
  const filteredSalesOrders = useMemo(() => {
    if (!poFilterDate) return salesOrders;
    return salesOrders.filter(order => {
      const oDate = order.order_date ? (typeof order.order_date === 'string' ? order.order_date.split('T')[0] : new Date(order.order_date).toISOString().split('T')[0]) : '';
      const pDate = order.customer_po_date ? (typeof order.customer_po_date === 'string' ? order.customer_po_date.split('T')[0] : new Date(order.customer_po_date).toISOString().split('T')[0]) : '';
      return oDate === poFilterDate || pDate === poFilterDate;
    });
  }, [salesOrders, poFilterDate]);

  // Options for SearchableSelect
  const searchableOrderOptions = useMemo(() => {
    const list = filteredSalesOrders.map(order => {
      const oDateFormatted = order.order_date ? new Date(order.order_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const pDateFormatted = order.customer_po_date ? new Date(order.customer_po_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      return {
        value: order.id,
        label: `${order.order_no}${order.customer_po_no ? ` | PO: ${order.customer_po_no}` : ''} — ${order.client_name}`,
        sublabel: `PO: ${order.customer_po_no || '—'} | PO Date: ${pDateFormatted || oDateFormatted || '-'} | Order Date: ${oDateFormatted || '-'} | ${order.ordered_qty} Qty Ordered ${order.is_fully_invoiced ? '(Fully Invoiced)' : ''}`,
        customer_po_no: order.customer_po_no || '',
        order_no: order.order_no || '',
        client_name: order.client_name || ''
      };
    });

    if (formData.orderId && !list.some(o => String(o.value) === String(formData.orderId))) {
      list.unshift({
        value: formData.orderId,
        label: `${formData.orderNo}${formData.customerPoNo ? ` | PO: ${formData.customerPoNo}` : ''} — ${formData.clientName}`,
        sublabel: `PO: ${formData.customerPoNo || '—'} | Client: ${formData.clientName}`,
        customer_po_no: formData.customerPoNo || '',
        order_no: formData.orderNo || '',
        client_name: formData.clientName || ''
      });
    }

    return list;
  }, [filteredSalesOrders, formData.orderId, formData.orderNo, formData.customerPoNo, formData.clientName]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-4 md:p-6 font-sans">
      {/* ─────────────────────────────────────────────────────────────
          MODE: LIST VIEW (Clean, ERP-matched styling)
      ────────────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="space-y-4 max-w-7xl mx-auto">
          {/* Header Bar matching Sales Orders reference */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
                <Receipt size={22} className="text-slate-700" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Sales Invoices</h1>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {stats.total} Total
                  </span>
                  <span className="text-xs text-amber-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {stats.created} Invoiced
                  </span>
                  <span className="text-xs text-emerald-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {stats.paid} Paid
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { fetchInvoices(); fetchAvailableOrders(); }}
                disabled={loadingInvoices}
                className="p-2 bg-white text-sky-600 hover:text-sky-700 border border-sky-300 rounded-lg shadow-sm hover:bg-sky-50 transition"
                title="Refresh Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInvoices ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Sales Invoice</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search by Invoice #, customer, SO #, PO #..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 transition-all font-medium placeholder-slate-400"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'Created', 'Sent to Accounts'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    statusFilter === st
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Invoice Details</th>
                    <th className="py-2.5 px-3">Sales Order #</th>
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">Invoice Date</th>
                    <th className="py-2.5 px-3 text-right">Items / Qty</th>
                    <th className="py-2.5 px-3 text-right">Invoice Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loadingInvoices ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                        <span>Loading sales invoices...</span>
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <Receipt className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                        <p className="font-medium text-slate-600 text-xs">No Sales Invoices Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Click "Create Sales Invoice" to generate your first invoice.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                            {inv.invoice_no}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-xs">
                          {inv.order_no || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          <div>
                            <span>{inv.client_name || '—'}</span>
                            {inv.customer_po_no && (
                              <div className="text-[10px] text-slate-400 font-normal">PO: {inv.customer_po_no}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {formatDate(inv.invoice_date)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          <span className="font-medium">{inv.item_count || 1} items</span>
                          <span className="text-[10px] text-slate-400 block font-mono">({inv.total_qty || 0} Nos)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatINR(inv.total_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : inv.status === 'Cancelled'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : (inv.sent_to_accounts || inv.status === 'Sent to Accounts')
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {inv.status || 'Created'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => handleViewInvoice(inv)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="View Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditInvoice(inv)}
                              disabled={inv.status === 'Paid'}
                              className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              title={inv.status === 'Paid' ? 'Paid invoices cannot be edited' : 'Edit Sales Invoice'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Send to Accounts Button / Sent Badge */}
                            {inv.sent_to_accounts || inv.status === 'Sent to Accounts' || inv.status === 'Paid' ? (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                                title={`Transferred to Accounts on ${formatDate(inv.sent_to_accounts_at || inv.updated_at)}`}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Sent</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendToAccounts(inv)}
                                disabled={sendingId === inv.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 text-[11px] font-semibold transition shadow-2xs group cursor-pointer disabled:opacity-50"
                                title="Send to Accounts (Customer Receivables)"
                              >
                                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                <span>Send</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenCopyModal(inv, 'print')}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                              title="Print Tax Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenCopyModal(inv, 'download')}
                              className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                              title="Download Tax Invoice PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv)}
                              className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE: CREATE SALES INVOICE VIEW (Compact, ERP styled, SearchableSelect)
      ────────────────────────────────────────────────────────────── */}
      {viewMode === 'create' && (
        <div className="space-y-3.5 max-w-6xl mx-auto">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setEditingInvoiceId(null); setViewMode('list'); }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{editingInvoiceId ? 'Edit Sales Invoice' : 'Create Sales Invoice'}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-xs font-mono font-semibold">
                    {formData.invoiceNo}
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500">
                  {editingInvoiceId ? 'Modify billing profile, invoice dates, quantities, and tax configuration' : 'Auto-populated from real sales order & dispatched quantities'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setEditingInvoiceId(null); setViewMode('list'); }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={saving || loadingOrderDetails || !formData.orderId || calculation.totalQty <= 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{editingInvoiceId ? 'Updating...' : 'Generating...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingInvoiceId ? 'Update Sales Invoice' : 'Save & Generate Invoice'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Host Company Billing Profile Details Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-100 pb-3">
              <div className="w-full md:max-w-md">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Select Issuing Billing Profile *
                </label>
                <select
                  className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white text-slate-900 font-medium"
                  value={selectedHostId}
                  onChange={(e) => {
                    const host = hostCompanies.find(h => String(h.id) === String(e.target.value));
                    setSelectedHostId(e.target.value);
                    setSelectedHostCompany(host || null);
                  }}
                >
                  <option value="">Select billing profile...</option>
                  {hostCompanies.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedHostCompany && selectedHostCompany.status !== 'ACTIVE' && (
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs border border-rose-200 text-rose-600 hover:bg-rose-50 rounded font-medium transition cursor-pointer"
                  onClick={async () => {
                    const confirm = await Swal.fire({
                      title: 'Set as Active Host Company?',
                      text: `Do you want to make "${selectedHostCompany.company_name}" the active host company globally?`,
                      icon: 'question',
                      showCancelButton: true,
                      confirmButtonText: 'Yes, Set Active'
                    });
                    if (confirm.isConfirmed) {
                      try {
                        const res = await fetch(`${API_BASE}/admin-company-master/${selectedHostCompany.id}`, {
                          method: 'PUT',
                          headers: getAuthHeaders(),
                          body: JSON.stringify({ status: 'ACTIVE' })
                        });
                        if (res.ok) {
                          Swal.fire({ icon: 'success', title: 'Updated', text: 'Billing profile activated globally', timer: 1500, showConfirmButton: false });
                          fetchHostCompanies();
                        }
                      } catch (err) {
                        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
                      }
                    }
                  }}
                >
                  Activate Globally
                </button>
              )}
            </div>

            {selectedHostCompany ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
                <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  {selectedHostCompany.company_logo ? (
                    <img
                      src={getFileUrl(selectedHostCompany.company_logo)}
                      alt="Logo"
                      className="h-16 max-w-full object-contain mb-2 bg-white border border-slate-200 p-1.5 rounded shadow-xs"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-lg mb-2">
                      {selectedHostCompany.company_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 leading-tight truncate w-full">{selectedHostCompany.company_name}</span>
                  <span className={`text-[9px] mt-1.5 px-2 py-0.5 rounded-full font-semibold border ${
                    selectedHostCompany.status === 'ACTIVE'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                      : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}>
                    {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 p-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Office Details</p>
                  <div className="space-y-1 text-slate-600 text-xs">
                    <div className="flex gap-1.5 items-start">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{selectedHostCompany.company_address || '—'}</span>
                    </div>
                    <div className="pt-1 flex flex-col gap-1">
                      <p className="font-mono text-[10px]">GSTIN: <span className="font-bold text-slate-700">{selectedHostCompany.gstin || '—'}</span></p>
                      <p className="font-mono text-[10px]">PAN: <span className="font-bold text-slate-700">{selectedHostCompany.pan || '—'}</span></p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Credentials</p>
                  <div className="space-y-1.5 text-slate-600 text-xs font-mono">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Bank Name</p>
                      <p className="font-bold text-slate-700 font-sans text-xs truncate">{selectedHostCompany.bank_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-sans">Account & IFSC</p>
                      <p className="font-semibold text-slate-800 text-xs">{selectedHostCompany.account_number || '—'}</p>
                      {selectedHostCompany.ifsc_code && (
                        <p className="text-[10px] text-slate-400">IFSC: {selectedHostCompany.ifsc_code.toUpperCase()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                Select a host company profile above to preview its billing and banking credentials
              </div>
            )}
          </div>

          {/* Section 1: Invoice Information with SearchableSelect */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Invoice Information</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Invoice Number */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Invoice No. *
                </label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={e => setFormData({ ...formData, invoiceNo: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Date Filter (Order / PO Date) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                  <span>Filter by Date</span>
                  {poFilterDate && (
                    <button
                      type="button"
                      onClick={() => setPoFilterDate('')}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <input
                  type="date"
                  value={poFilterDate}
                  onChange={e => setPoFilterDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  title="Filter PO records by Order or PO Date"
                />
              </div>

              {/* Select Customer PO / Sales Order with SearchableSelect */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                  <span>Search Customer PO / Order *</span>
                  {loadingOrders && <span className="text-[10px] text-emerald-600 animate-pulse">Loading orders...</span>}
                </label>
                <SearchableSelect
                  options={searchableOrderOptions}
                  value={formData.orderId}
                  onChange={e => handleSelectSalesOrder(e.target.value)}
                  placeholder="Search Customer PO #, SO #..."
                  className="w-full text-xs"
                  allowCustom={false}
                />
              </div>
            </div>

            {/* Empty results message when date filter is active and no records match */}
            {poFilterDate && searchableOrderOptions.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between animate-in fade-in">
                <span>
                  No Customer PO or Sales Order records found matching date <strong className="font-mono">{poFilterDate}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => setPoFilterDate('')}
                  className="text-xs text-amber-900 underline font-semibold ml-2 hover:text-amber-950"
                >
                  Show All Dates
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Customer Details & Dispatch Summary (Shown When Order is Selected) */}
          {loadingOrderDetails ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-1.5 text-emerald-600" />
              <p className="font-medium text-slate-600 text-xs">Fetching Sales Order Details & Balances...</p>
            </div>
          ) : formData.orderId ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
              {/* Customer Profile Card with 3-Line Clamped Address */}
              <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Customer Details</span>
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Customer</span>
                    <span className="text-xs font-bold text-slate-800 block truncate" title={formData.clientName}>{formData.clientName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Customer PO #</span>
                    <span className="text-xs font-bold font-mono text-slate-800 block truncate">{formData.customerPoNo || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Project Name</span>
                    <span className="text-xs font-medium text-slate-800 block truncate" title={formData.projectName}>{formData.projectName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">GSTIN</span>
                    <span className="text-xs font-bold font-mono text-slate-800 block truncate">{formData.gstin || '—'}</span>
                  </div>
                </div>

                {/* 3-Line Small Addresses */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 text-[11px] block mb-0.5">Billing Address:</span>
                    <div
                      className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-3 leading-snug max-h-[58px] overflow-hidden"
                      title={formData.billingAddress}
                    >
                      {formData.billingAddress || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 text-[11px] block mb-0.5">Shipping Address:</span>
                    <div
                      className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-3 leading-snug max-h-[58px] overflow-hidden"
                      title={formData.shippingAddress}
                    >
                      {formData.shippingAddress || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispatch & Fulfillment KPI Summary */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Dispatch Summary</span>
                </h2>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Ordered Qty</span>
                    <span className="font-bold text-slate-800 font-mono">{formData.summary.totalOrderedQty}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Dispatched Qty</span>
                    <span className="font-bold text-slate-800 font-mono">{formData.summary.totalDispatchedQty}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Already Invoiced</span>
                    <span className="font-bold text-slate-800 font-mono">{formData.summary.totalAlreadyInvoicedQty}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-emerald-800 bg-emerald-50 p-2 rounded-lg font-medium">
                    <span className="font-bold">Remaining Invoiceable</span>
                    <span className="text-base font-extrabold font-mono text-emerald-700">{formData.summary.totalInvoiceableQty}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Section 3: Items to Invoice (Only when Order is selected) */}
          {formData.orderId && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              {/* Tab Navigation */}
              {!editingInvoiceId ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveItemTab('invoiceable')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                        activeItemTab === 'invoiceable'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeItemTab === 'invoiceable' ? 'bg-white' : 'bg-slate-400'}`}></span>
                      <span>Items to Invoice</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        activeItemTab === 'invoiceable' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {formData.items.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveItemTab('dispatched_history')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                        activeItemTab === 'dispatched_history'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeItemTab === 'dispatched_history' ? 'bg-white' : 'bg-slate-400'}`}></span>
                      <span>Dispatched Items & Invoice History</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        activeItemTab === 'dispatched_history' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {(orderAllItems.length > 0 ? orderAllItems : formData.items).length}
                      </span>
                    </button>
                  </div>

                  {activeItemTab === 'invoiceable' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400">Showing only dispatchable/invoiceable balance</span>
                      {removedItems.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreAllItems}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Restore ({removedItems.length}) removed item{removedItems.length > 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span>Summary of dispatch & prior billing per item</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white shadow-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      <span>Items to Invoice</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-600 text-white">
                        {formData.items.length}
                      </span>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Items billed on this invoice (Invoice quantity is fixed in edit mode)</span>
                </div>
              )}

              {/* Tab 1: Items to Invoice (Untouched logic) */}
              {(activeItemTab === 'invoiceable' || editingInvoiceId) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2 px-3">Item Code & Drawing</th>
                        <th className="py-2 px-3">Item Name / Description</th>
                        <th className="py-2 px-3 text-center">HSN</th>
                        <th className="py-2 px-3 text-center">Dispatch</th>
                        <th className="py-2 px-3 text-center">Invoiced</th>
                        <th className="py-2 px-3 text-center">Invoice Qty</th>
                        <th className="py-2 px-3 text-right">Rate (₹)</th>
                        <th className="py-2 px-3 text-right">Amount (₹)</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {formData.items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-400">
                            No items remaining to invoice.
                          </td>
                        </tr>
                      ) : (
                        formData.items.map((item) => (
                          <tr key={item.orderItemId} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-mono font-medium text-slate-800 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                {item.itemCode || item.drawingNo || '—'}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800 text-xs">
                              {item.description || item.itemName || '—'}
                            </td>
                            <td className="py-2 px-3 text-center text-[11px] font-mono text-slate-500">
                              {item.hsnCode || '84779000'}
                            </td>
                            <td className="py-2 px-3 text-center font-semibold text-slate-700 font-mono">
                              {item.dispatchedQty}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500 font-mono">
                              {item.previouslyInvoicedQty}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={editingInvoiceId ? item.invoiceQty : item.invoiceableQty}
                                  step="1"
                                  value={item.invoiceQty}
                                  onChange={e => handleQuantityChange(item.orderItemId, e.target.value)}
                                  disabled={Boolean(editingInvoiceId) || item.invoiceableQty <= 0}
                                  readOnly={Boolean(editingInvoiceId)}
                                  className={`w-16 px-1.5 py-0.5 text-center font-bold text-slate-800 border rounded text-xs font-mono ${
                                    editingInvoiceId
                                      ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed select-none'
                                      : 'bg-white border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500'
                                  }`}
                                  title={editingInvoiceId ? "Invoice quantity cannot be changed in edit mode" : undefined}
                                />
                                {!editingInvoiceId && (
                                  <span className="text-[10px] text-slate-400 font-mono">/ {item.invoiceableQty}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-800 font-mono text-xs">
                              {formatINR(item.unitRate)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono text-xs">
                              {formatINR(item.amount)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {!editingInvoiceId ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.orderItemId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-md transition shadow-2xs cursor-pointer"
                                  title="Remove item from this invoice"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove</span>
                                </button>
                              ) : (
                                <span className="text-[10.5px] font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                                  Billed
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Dispatched Items & Invoice History */}
              {activeItemTab === 'dispatched_history' && (
                <div className="space-y-3">
                  {/* Search & Invoice Filters Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      {/* Searchable input */}
                      <div className="relative min-w-[200px] flex-1 max-w-xs">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={historySearchTerm}
                          onChange={e => setHistorySearchTerm(e.target.value)}
                          placeholder="Search Invoice No, Item, Drawing..."
                          className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {historySearchTerm && (
                          <button
                            type="button"
                            onClick={() => setHistorySearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Filter by Invoice Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <select
                          value={historyInvoiceFilter}
                          onChange={e => setHistoryInvoiceFilter(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="ALL">All Invoices & Items ({historyAnalysis.totalItems})</option>
                          <option value="INVOICED">Only Invoiced Items ({historyAnalysis.fullyInvoicedCount + historyAnalysis.partialInvoicedCount})</option>
                          <option value="PENDING">Only Pending Items ({historyAnalysis.pendingCount + historyAnalysis.partialInvoicedCount})</option>
                          {uniqueInvoicesForOrder.length > 0 && (
                            <optgroup label="Filter by Invoice No.">
                              {uniqueInvoicesForOrder.map((inv, idx) => (
                                <option key={idx} value={inv.invoiceNo}>
                                  {inv.invoiceNo} {inv.invoiceDate ? `(${formatDate(inv.invoiceDate)})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Quick Invoice Filter Chips */}
                      {uniqueInvoicesForOrder.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[11px]">
                          <span className="text-slate-400 text-[10px] uppercase font-bold mr-0.5">Filter:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryInvoiceFilter('ALL');
                              setHistorySearchTerm('');
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                              !activeFilteredInvoiceNo && historyInvoiceFilter === 'ALL'
                                ? 'bg-slate-800 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            All ({historyAnalysis.totalItems})
                          </button>
                          {uniqueInvoicesForOrder.map((inv, idx) => {
                            const isChipActive = activeFilteredInvoiceNo && activeFilteredInvoiceNo.toLowerCase() === inv.invoiceNo.toLowerCase();
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isChipActive) {
                                    setHistoryInvoiceFilter('ALL');
                                    setHistorySearchTerm('');
                                  } else {
                                    setHistoryInvoiceFilter(inv.invoiceNo);
                                    setHistorySearchTerm('');
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isChipActive
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                }`}
                              >
                                <FileText className="w-2.5 h-2.5" />
                                <span>{inv.invoiceNo}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 font-medium shrink-0">
                      Showing <strong className="text-slate-700 font-mono">{filteredHistoryItems.length}</strong> of {historyAnalysis.totalItems} items
                    </div>
                  </div>

                  {/* Table fitted 100% without horizontal slider */}
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2 px-2.5">Item Code & Drawing</th>
                        <th className="py-2 px-2.5">Item Name / Description</th>
                        <th className="py-2 px-2 text-center">HSN</th>
                        <th className="py-2 px-2 text-center">Dispatch</th>
                        <th className="py-2 px-2 text-center">Invoiced</th>
                        <th className="py-2 px-2 text-center">Remaining</th>
                        <th className="py-2 px-2 text-center">Invoice No.</th>
                        <th className="py-2 px-2 text-right">Rate (₹)</th>
                        <th className="py-2 px-2 text-right">Invoiced Amt (₹)</th>
                        <th className="py-2 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredHistoryItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400">
                            No items match the current search or invoice filter.
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryItems.map((item) => {
                          const prevInvoiced = parseFloat(item.previouslyInvoicedQty) || 0;
                          const invBalance = parseFloat(item.invoiceableQty) || 0;
                          const isFullyInvoiced = invBalance <= 0 && prevInvoiced > 0;
                          const isPartiallyInvoiced = prevInvoiced > 0 && invBalance > 0;
                          const isNotInvoiced = prevInvoiced === 0;

                          const invoicedAmt = prevInvoiced * (parseFloat(item.unitRate) || 0);

                          return (
                            <tr key={item.orderItemId || item.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-2 px-2.5 font-mono font-medium text-slate-800 text-[11px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {item.itemCode || item.drawingNo || '—'}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 font-medium text-slate-800 text-xs">
                                {item.description || item.itemName || '—'}
                              </td>
                              <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-500">
                                {item.hsnCode || '84779000'}
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-slate-800 font-mono">
                                {item.dispatchedQty ?? item.orderedQty ?? 0}
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-emerald-700 font-mono">
                                {item.previouslyInvoicedQty ?? 0}
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-amber-700 font-mono">
                                {item.invoiceableQty ?? 0}
                              </td>
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {(() => {
                                  // 1. If item has structured invoiceHistory objects
                                  if (item.invoiceHistory && item.invoiceHistory.length > 0) {
                                    // When a particular invoice is filtered, find THAT specific invoice
                                    const matchingHist = activeFilteredInvoiceNo
                                      ? item.invoiceHistory.find(h => h.invoiceNo && h.invoiceNo.toLowerCase() === activeFilteredInvoiceNo.toLowerCase())
                                      : null;
                                    const displayHist = matchingHist || item.invoiceHistory[0];
                                    // When filtering by a particular invoice, show NO "+ more" button!
                                    const showMoreBtn = !activeFilteredInvoiceNo && item.invoiceHistory.length > 1;

                                    return (
                                      <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setInvoiceHistoryModal({
                                            itemCode: item.itemCode,
                                            drawingNo: item.drawingNo,
                                            description: item.description || item.itemName,
                                            previouslyInvoicedQty: item.previouslyInvoicedQty,
                                            unitRate: item.unitRate,
                                            invoices: item.invoiceHistory
                                          })}
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold whitespace-nowrap transition cursor-pointer ${
                                            matchingHist
                                              ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 ring-1 ring-blue-400/40 shadow-xs'
                                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs'
                                          }`}
                                          title={`Invoice: ${displayHist.invoiceNo} | Qty: ${displayHist.invoiceQty} | Click to view details`}
                                        >
                                          <FileText className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                          <span>{displayHist.invoiceNo}</span>
                                          <span className="text-slate-400 font-normal">({displayHist.invoiceQty})</span>
                                        </button>

                                        {/* +more button ONLY shown when NOT filtering by a specific invoice */}
                                        {showMoreBtn && (
                                          <button
                                            type="button"
                                            onClick={() => setInvoiceHistoryModal({
                                              itemCode: item.itemCode,
                                              drawingNo: item.drawingNo,
                                              description: item.description || item.itemName,
                                              previouslyInvoicedQty: item.previouslyInvoicedQty,
                                              unitRate: item.unitRate,
                                              invoices: item.invoiceHistory
                                            })}
                                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 transition shadow-2xs cursor-pointer inline-flex items-center whitespace-nowrap active:scale-95"
                                            title={`Item invoiced across ${item.invoiceHistory.length} invoices. Click to view all.`}
                                          >
                                            +{item.invoiceHistory.length - 1} more
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }

                                  // 2. Fallback when only comma-separated invoiceNumbers string is present
                                  if (item.invoiceNumbers && item.invoiceNumbers !== '—') {
                                    const rawInvoices = item.invoiceNumbers.split(',').map(s => s.trim()).filter(Boolean);
                                    const matchingRaw = activeFilteredInvoiceNo
                                      ? rawInvoices.find(inv => inv.toLowerCase() === activeFilteredInvoiceNo.toLowerCase())
                                      : null;
                                    const displayRaw = matchingRaw || rawInvoices[0];
                                    const showRawMoreBtn = !activeFilteredInvoiceNo && rawInvoices.length > 1;

                                    return (
                                      <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold whitespace-nowrap ${
                                          matchingRaw
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300 ring-1 ring-blue-400/40'
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>
                                          <FileText className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                          <span>{displayRaw}</span>
                                        </span>
                                        {showRawMoreBtn && (
                                          <button
                                            type="button"
                                            onClick={() => setInvoiceHistoryModal({
                                              itemCode: item.itemCode,
                                              drawingNo: item.drawingNo,
                                              description: item.description || item.itemName,
                                              previouslyInvoicedQty: item.previouslyInvoicedQty,
                                              unitRate: item.unitRate,
                                              invoices: rawInvoices.map(invNo => ({
                                                invoiceNo: invNo,
                                                invoiceQty: '—',
                                                invoiceDate: null,
                                                amount: 0
                                              }))
                                            })}
                                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 transition shadow-2xs cursor-pointer inline-flex items-center whitespace-nowrap"
                                            title="Click to view all invoices"
                                          >
                                            +{rawInvoices.length - 1} more
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }

                                  return <span className="text-[11px] text-slate-400 italic">Not Invoiced</span>;
                                })()}
                              </td>
                              <td className="py-2 px-2 text-right font-medium text-slate-800 font-mono text-xs">
                                {formatINR(item.unitRate)}
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-slate-900 font-mono text-xs">
                                {formatINR(invoicedAmt)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {isFullyInvoiced && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                    Fully Invoiced
                                  </span>
                                )}
                                {isPartiallyInvoiced && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                    Partially Invoiced
                                  </span>
                                )}
                                {isNotInvoiced && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Taxation & Financial Summary Grid */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Payment Terms & Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formData.paymentTerms}
                    onChange={e => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    placeholder="Enter payment conditions, dispatch notes, etc."
                  />
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                  {/* Tax Type 2 options toggle - EXACT match to Sales Order */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs text-slate-700 font-semibold">Tax Type:</span>
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isInterstate: false, cgstRate: 9, sgstRate: 9, igstRate: 0 }))}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                          !formData.isInterstate ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Intra (CGST+SGST)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isInterstate: true, igstRate: 18, cgstRate: 0, sgstRate: 0 }))}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                          formData.isInterstate ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Inter (IGST)
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Tax Rate Inputs */}
                  {formData.isInterstate ? (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <label className="text-[11px] font-semibold text-slate-600">IGST Rate (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-24 p-1.5 border border-slate-200 rounded text-xs text-slate-900 bg-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                        value={formData.igstRate}
                        onChange={(e) => setFormData({ ...formData, igstRate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 py-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">CGST (%):</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-16 p-1.5 border border-slate-200 rounded text-xs text-slate-900 bg-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                          value={formData.cgstRate}
                          onChange={(e) => setFormData({ ...formData, cgstRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">SGST (%):</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-16 p-1.5 border border-slate-200 rounded text-xs text-slate-900 bg-white font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                          value={formData.sgstRate}
                          onChange={(e) => setFormData({ ...formData, sgstRate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Financial Breakdown */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Items Subtotal:</span>
                      <span className="font-mono font-bold text-slate-800">{formatINR(calculation.subtotal)}</span>
                    </div>

                    {formData.isInterstate ? (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Tax (IGST {Number(formData.igstRate || 0)}%):</span>
                        <span className="font-mono font-semibold text-slate-800">{formatINR(calculation.igst)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Tax (CGST {Number(formData.cgstRate || 0)}%):</span>
                          <span className="font-mono font-semibold text-slate-800">{formatINR(calculation.cgst)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Tax (SGST {Number(formData.sgstRate || 0)}%):</span>
                          <span className="font-mono font-semibold text-slate-800">{formatINR(calculation.sgst)}</span>
                        </div>
                      </>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-slate-900 text-sm font-extrabold">
                      <span>TOTAL AMOUNT:</span>
                      <span className="text-base font-mono text-emerald-700">{formatINR(calculation.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: INVOICE DETAIL & TAX PRINT PREVIEW
      ────────────────────────────────────────────────────────────── */}
      {selectedInvoice && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6"
          onClick={() => setSelectedInvoice(null)}
        >
          <div 
            className="bg-white w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Actions Header - Always sticky and visible at the top */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-10 print:hidden">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-700" />
                <span>Tax Invoice Preview ({selectedInvoice.invoice_no})</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenCopyModal(selectedInvoice)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Download Tax Invoice PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Tax Invoice Document - Smoothly scrollable content body */}
            <div className="overflow-y-auto flex-1 p-6 md:p-8 space-y-4 bg-white text-slate-900 text-xs font-sans" id="printable-invoice">
              {/* Header with Company Logo & Title */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-900">{selectedInvoice.host_company_name || 'SP TECHPIONEER PRIVATE LIMITED'}</h1>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">Engineering & Better Tomorrow</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Plot No. 12, Industrial Area, Chakan, Pune – 410501, Maharashtra, INDIA</p>
                  <p className="text-[11px] text-slate-600">GSTIN: <span className="font-mono font-bold">27AAHCS1234F1Z9</span> | State Code: 27</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-0.5 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded">
                    TAX INVOICE
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600">
                    <div>Invoice No: <span className="font-mono font-bold text-slate-900">{selectedInvoice.invoice_no}</span></div>
                    <div>Invoice Date: <span className="font-semibold text-slate-900">{formatDate(selectedInvoice.invoice_date)}</span></div>
                  </div>
                </div>
              </div>

              {/* Order & Client Information */}
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-200 pb-4">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Billed To (Customer):</span>
                  <p className="font-bold text-xs text-slate-900">{selectedInvoice.client_name}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-3">{cleanAddressText(selectedInvoice.billing_address)}</p>
                  <p className="text-slate-700 mt-1 font-semibold text-[11px]">GSTIN: <span className="font-mono">{selectedInvoice.gstin || '—'}</span></p>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Order Details:</span>
                  <div className="space-y-0.5 text-[11px]">
                    <div>Sales Order #: <span className="font-mono font-bold text-slate-800">{selectedInvoice.order_no || '—'}</span></div>
                    <div>Customer PO #: <span className="font-mono font-bold text-slate-800">{selectedInvoice.customer_po_no || '—'}</span></div>
                    <div>Project: <span className="font-medium text-slate-800">{selectedInvoice.project_name || '—'}</span></div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-2.5 border-r border-slate-300 w-8 text-center">#</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Drawing # / Description</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">HSN</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Qty</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-right">Rate (₹)</th>
                    <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedInvoice.items || []).map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300">
                        <span className="font-mono font-bold text-xs">{it.drawing_no || it.item_code}</span>
                        <span className="block text-[10px] text-slate-500">{it.description}</span>
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-mono text-[11px]">{it.hsn_code || '84779000'}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-center font-bold font-mono">{it.invoice_qty}</td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono text-xs">{formatINR(it.unit_rate)}</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-xs">{formatINR(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="text-[11px] space-y-1.5">
                  <p className="font-semibold text-slate-600">Amount in Words:</p>
                  <p className="font-bold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 italic text-xs">
                    {selectedInvoice.amountInWords || 'Indian Rupees Only'}
                  </p>
                  <p className="text-[10px] text-slate-500 pt-1">
                    Terms: {selectedInvoice.payment_terms || 'Payment within 30 days.'}
                  </p>
                </div>

                <div className="text-xs space-y-1 text-right font-mono">
                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-bold">{formatINR(selectedInvoice.subtotal)}</span>
                  </div>
                  {parseFloat(selectedInvoice.igst_amount) > 0 ? (
                    <div className="flex justify-between py-0.5 border-b border-slate-100">
                      <span className="text-slate-500">IGST ({selectedInvoice.igst_rate}%):</span>
                      <span className="font-bold">{formatINR(selectedInvoice.igst_amount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between py-0.5 border-b border-slate-100">
                        <span className="text-slate-500">CGST ({selectedInvoice.cgst_rate}%):</span>
                        <span className="font-bold">{formatINR(selectedInvoice.cgst_amount)}</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-100">
                        <span className="text-slate-500">SGST ({selectedInvoice.sgst_rate}%):</span>
                        <span className="font-bold">{formatINR(selectedInvoice.sgst_amount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-1.5 border-t border-slate-800 text-sm font-extrabold text-slate-900">
                    <span>GRAND TOTAL:</span>
                    <span>{formatINR(selectedInvoice.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Signatory Footer */}
              <div className="pt-8 flex justify-between items-end text-[11px] text-slate-500">
                <div>
                  <p>Customer Seal & Signature</p>
                </div>
                <div className="text-right space-y-8">
                  <p className="font-bold text-slate-900">For {selectedInvoice.host_company_name || 'SP TECHPIONEER PRIVATE LIMITED'}</p>
                  <p>Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SELECT INVOICE COPY TYPE
      ────────────────────────────────────────────────────────────── */}
      {copyModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-150"
          onClick={() => setCopyModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${copyModalAction === 'print' ? 'bg-slate-200 text-slate-800' : 'bg-emerald-100 text-emerald-700'}`}>
                  {copyModalAction === 'print' ? <Printer className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    {copyModalAction === 'print' ? 'Print Tax Invoice (Select Copy)' : 'Select Invoice Copy Type'}
                  </h3>
                  {copyModalInvoice?.invoice_no && (
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Invoice: <span className="font-semibold text-slate-700 font-mono">{copyModalInvoice.invoice_no}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">
                Choose the copy type to {copyModalAction === 'print' ? 'print' : 'download'}:
              </p>
              {INVOICE_COPY_TYPES.map((type) => {
                const isSelected = selectedCopyType === type.label;
                return (
                  <label
                    key={type.id}
                    onClick={() => setSelectedCopyType(type.label)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invoiceCopyType"
                      value={type.label}
                      checked={isSelected}
                      onChange={() => setSelectedCopyType(type.label)}
                      className="mt-0.5 h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                        {type.label}
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">
                        {type.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const inv = copyModalInvoice;
                  const copy = selectedCopyType;
                  setCopyModalOpen(false);
                  handlePrintInvoice(inv, copy);
                }}
                disabled={printingPdf || downloadingPdf}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer ${
                  copyModalAction === 'print'
                    ? 'bg-slate-900 hover:bg-black ring-2 ring-slate-900/20'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
                title="Print chosen copy"
              >
                {printingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleConfirmDownloadPdf}
                disabled={printingPdf || downloadingPdf}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer ${
                  copyModalAction === 'download'
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 ring-2 ring-emerald-600/20'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
                title="Download PDF"
              >
                {downloadingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Multiple Invoices Modal */}
      {invoiceHistoryModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setInvoiceHistoryModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Dispatched Invoice History
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Invoices generated for this dispatched item
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {invoiceHistoryModal.itemCode || invoiceHistoryModal.drawingNo || '—'}
                  </span>
                  <span className="text-xs text-slate-600 truncate max-w-xs font-medium">
                    {invoiceHistoryModal.description || invoiceHistoryModal.itemName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceHistoryModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Invoices List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                <span>Invoices ({invoiceHistoryModal.invoices.length})</span>
                <span>Total Invoiced: <strong className="text-slate-800 font-mono">{invoiceHistoryModal.previouslyInvoicedQty} Nos</strong></span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-72 overflow-y-auto">
                {invoiceHistoryModal.invoices.map((inv, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between bg-white hover:bg-slate-50 transition gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200">
                          {inv.invoiceNo}
                        </span>
                        {inv.status && (
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                            {inv.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Date: {formatDate(inv.invoiceDate)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-extrabold text-slate-800 font-mono text-xs">
                          {inv.invoiceQty} Nos
                        </div>
                        <div className="text-[11px] text-emerald-700 font-mono font-semibold">
                          {formatINR(inv.amount || (inv.invoiceQty * (invoiceHistoryModal.unitRate || 0)))}
                        </div>
                      </div>
                      
                      {/* Action buttons: View Preview & Download PDF */}
                      {inv.invoiceId && (
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleViewInvoice({ id: inv.invoiceId, invoice_no: inv.invoiceNo });
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="View Invoice Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadInvoice(inv.invoiceId, inv.invoiceNo);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title="Download Tax Invoice PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] text-slate-400">
                Click preview or download icons to access invoice copy
              </span>
              <button
                type="button"
                onClick={() => setInvoiceHistoryModal(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
