import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Calendar, CheckCircle2, Eye, Printer, Trash2,
  ArrowLeft, ArrowRight, Building, Hash, Layers, ShieldCheck, AlertCircle, ShoppingBag,
  Download, Clock, X, ChevronRight, Check, RefreshCw, AlertTriangle,
  Receipt, DollarSign, User, MapPin, Package, Send
} from 'lucide-react';
import Swal from 'sweetalert2';
import { SearchableSelect, Card } from '../components/ui.jsx';

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

  // Invoice Copy Type Modal State
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyModalInvoice, setCopyModalInvoice] = useState(null);
  const [selectedCopyType, setSelectedCopyType] = useState('Original for Recipient');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  useEffect(() => {
    fetchInvoices();
    fetchAvailableOrders();
  }, []);

  // Open Create Form & Preload Next Invoice No
  const handleOpenCreate = async () => {
    try {
      const res = await fetch(`${API_BASE}/sales-invoices/next-number`, {
        headers: getAuthHeaders()
      });
      const data = res.ok ? await res.json() : { invoiceNo: `INV-${new Date().getFullYear()}-0001` };

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
        : Boolean(data.gstin && !data.gstin.startsWith('27') && data.gstin !== '—');

      const cgstRate = data.cgstRate !== undefined ? Number(data.cgstRate) : (isInterstate ? 0 : 9);
      const sgstRate = data.sgstRate !== undefined ? Number(data.sgstRate) : (isInterstate ? 0 : 9);
      const igstRate = data.igstRate !== undefined ? Number(data.igstRate) : (isInterstate ? 18 : 0);

      // Auto-filter items with 0 invoiceable balance so zero-qty items are not shown on new invoice
      const validItems = (data.items || []).filter(it => (parseFloat(it.invoiceableQty) || 0) > 0);
      const zeroItems = (data.items || []).filter(it => (parseFloat(it.invoiceableQty) || 0) <= 0);
      setRemovedItems(zeroItems);

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

  // Save Invoice
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

      const res = await fetch(`${API_BASE}/sales-invoices`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save invoice');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Invoice Created!',
        text: `Sales Invoice ${formData.invoiceNo} has been generated successfully.`,
        timer: 1800,
        showConfirmButton: false
      });

      await fetchInvoices();
      await fetchAvailableOrders();
      setViewMode('list');
    } catch (err) {
      console.error('Error saving invoice:', err);
      Swal.fire({
        icon: 'error',
        title: 'Creation Failed',
        text: err.message || 'An error occurred while generating the sales invoice.'
      });
    } finally {
      setSaving(false);
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

  // Open copy type popup modal
  const handleOpenCopyModal = (invoice) => {
    setCopyModalInvoice(invoice);
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
    return filteredSalesOrders.map(order => {
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
  }, [filteredSalesOrders]);

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
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="View Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
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
                              onClick={() => handleOpenCopyModal(inv)}
                              className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                              title="Download Tax Invoice PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv)}
                              className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
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
                onClick={() => setViewMode('list')}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Create Sales Invoice</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-xs font-mono font-semibold">
                    {formData.invoiceNo}
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500">Auto-populated from real sales order & dispatched quantities</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={saving || loadingOrderDetails || !formData.orderId || calculation.totalQty <= 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Generate Invoice</span>
                  </>
                )}
              </button>
            </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Items to Invoice</span>
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">Showing only dispatchable/invoiceable balance</span>
                  {removedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreAllItems}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Restore ({removedItems.length}) removed item{removedItems.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>

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
                                max={item.invoiceableQty}
                                step="1"
                                value={item.invoiceQty}
                                onChange={e => handleQuantityChange(item.orderItemId, e.target.value)}
                                disabled={item.invoiceableQty <= 0}
                                className="w-16 px-1.5 py-0.5 text-center font-bold text-slate-800 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono"
                              />
                              <span className="text-[10px] text-slate-400 font-mono">/ {item.invoiceableQty}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-800 font-mono text-xs">
                            {formatINR(item.unitRate)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono text-xs">
                            {formatINR(item.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.orderItemId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-md transition shadow-2xs cursor-pointer"
                              title="Remove item from this invoice"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Items Subtotal:</span>
                    <span className="font-mono font-bold text-slate-800">{formatINR(calculation.subtotal)}</span>
                  </div>

                  {formData.isInterstate ? (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>IGST {formData.igstRate || 18}%:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatINR(calculation.igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>CGST {formData.cgstRate || 9}%:</span>
                        <span className="font-mono font-semibold text-slate-800">{formatINR(calculation.cgst)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>SGST {formData.sgstRate || 9}%:</span>
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
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: INVOICE DETAIL & TAX PRINT PREVIEW
      ────────────────────────────────────────────────────────────── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Actions Header */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-700" />
                <span>Tax Invoice Preview ({selectedInvoice.invoice_no})</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenCopyModal(selectedInvoice)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                  title="Download Tax Invoice PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Tax Invoice Document */}
            <div className="p-6 md:p-8 space-y-4 bg-white text-slate-900 text-xs font-sans" id="printable-invoice">
              {/* Header with Company Logo & Title */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-900">SP TECHPIONEER PRIVATE LIMITED</h1>
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
                  <p className="font-bold text-slate-900">For SP TECHPIONEER PRIVATE LIMITED</p>
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
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Select Invoice Copy Type</h3>
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">
                Choose the copy type to print on top:
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
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer"
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
    </div>
  );
}
