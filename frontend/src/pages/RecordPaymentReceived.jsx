import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Search, RefreshCw, Building2, Calendar, FileText, 
  CheckCircle2, Clock, AlertCircle, ChevronDown, Download, Check, 
  ArrowRight, DollarSign, Wallet, History, X, Filter
} from 'lucide-react';
import { Button, DataTable, Card, SearchableSelect } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import PaymentReceivedModal from '../components/PaymentReceivedModal.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const RecordPaymentReceived = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Monthly & Date-wise Filter State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [applyDateFilterToTable, setApplyDateFilterToTable] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Active View Tab: 'invoices' | 'history'
  const [activeViewTab, setActiveViewTab] = useState('invoices');

  // 1. Fetch Companies on Load
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  // 2. Fetch Invoices, Balance, and History when Customer or Month changes
  useEffect(() => {
    if (selectedCompanyId) {
      const found = companies.find(c => String(c.id) === String(selectedCompanyId));
      setSelectedCompany(found || null);
      fetchCustomerInvoices(selectedCompanyId);
      fetchCustomerBalance(selectedCompanyId);
      fetchCustomerPaymentHistory(selectedCompanyId);
      fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
    } else {
      setSelectedCompany(null);
      setInvoices([]);
      setBalanceData(null);
      setPaymentHistory([]);
      setMonthlySummary(null);
    }
  }, [selectedCompanyId, companies]);

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
    if (newMonth) {
      const [y, m] = newMonth.split('-');
      const year = parseInt(y, 10);
      const month = parseInt(m, 10);
      const lastDay = new Date(year, month, 0).getDate();
      const newFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const newTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFromDate(newFrom);
      setToDate(newTo);
      if (selectedCompanyId) {
        fetchMonthlySummary(selectedCompanyId, newMonth, newFrom, newTo);
      }
    }
  };

  const handleFromDateChange = (val) => {
    setFromDate(val);
    if (selectedCompanyId && val && toDate) {
      fetchMonthlySummary(selectedCompanyId, selectedMonth, val, toDate);
    }
  };

  const handleToDateChange = (val) => {
    setToDate(val);
    if (selectedCompanyId && fromDate && val) {
      fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, val);
    }
  };

  const fetchCustomerInvoices = async (customerId) => {
    if (!customerId) return;
    try {
      setInvoicesLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/customer-payments/customer/${customerId}/outstanding`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error('Error fetching customer invoices:', err);
      errorToast('Failed to load customer invoices');
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchCustomerBalance = async (customerId) => {
    if (!customerId) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/customer-payments/customer/${customerId}/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalanceData(data);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const fetchCustomerPaymentHistory = async (customerId) => {
    if (!customerId) return;
    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/customer-payments?customerId=${customerId}&status=CONFIRMED`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchMonthlySummary = async (customerId, monthStr, customFrom, customTo) => {
    if (!customerId) {
      setMonthlySummary(null);
      return;
    }
    try {
      setMonthlyLoading(true);
      const targetMonthStr = monthStr || selectedMonth;
      const [year, month] = targetMonthStr.split('-');
      const token = localStorage.getItem('authToken');
      const start = customFrom !== undefined ? customFrom : fromDate;
      const end = customTo !== undefined ? customTo : toDate;
      let url = `${API_BASE}/customer-payments/customer/${customerId}/monthly-summary?year=${year}&month=${parseInt(month, 10)}`;
      if (start && end) {
        url += `&startDate=${start}&endDate=${end}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMonthlySummary(data);
      } else {
        setMonthlySummary(null);
      }
    } catch (err) {
      console.error('Error fetching monthly summary:', err);
      setMonthlySummary(null);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const handleRefreshAll = () => {
    fetchCompanies();
    if (selectedCompanyId) {
      fetchCustomerInvoices(selectedCompanyId);
      fetchCustomerBalance(selectedCompanyId);
      fetchCustomerPaymentHistory(selectedCompanyId);
      fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
    }
  };

  // Options for SearchableSelect
  const companyOptions = useMemo(() => {
    return companies.map(c => ({
      value: String(c.id),
      label: c.company_name || 'Unnamed Company',
      sublabel: [c.gstin ? `GSTIN: ${c.gstin}` : '', c.city].filter(Boolean).join(' • ')
    }));
  }, [companies]);

  // All Invoices with outstanding balances
  const allOutstandingInvoices = useMemo(() => {
    return invoices.filter(inv => parseFloat(inv.outstanding || 0) > 0);
  }, [invoices]);

  // Displayed Invoices (supports date-wise filter)
  const displayedInvoices = useMemo(() => {
    if (!applyDateFilterToTable || !fromDate || !toDate) {
      return allOutstandingInvoices;
    }
    return allOutstandingInvoices.filter(inv => {
      const d = (inv.invoice_date || inv.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }, [allOutstandingInvoices, applyDateFilterToTable, fromDate, toDate]);

  // Displayed Payment History (supports date-wise filter)
  const displayedPaymentHistory = useMemo(() => {
    if (!applyDateFilterToTable || !fromDate || !toDate) {
      return paymentHistory;
    }
    return paymentHistory.filter(p => {
      const d = (p.payment_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }, [paymentHistory, applyDateFilterToTable, fromDate, toDate]);

  // Aggregate stats for selected customer
  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
    const totalReceived = invoices.reduce((sum, inv) => sum + (parseFloat(inv.paid_amount) || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalReceived);
    const pendingCount = invoices.filter(inv => parseFloat(inv.outstanding || 0) > 0).length;
    const progress = totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0;

    return {
      totalInvoiced,
      totalReceived,
      totalOutstanding,
      pendingCount,
      allCount: invoices.length,
      progress
    };
  }, [invoices]);

  // Open modal for a specific invoice
  const handleOpenRecordPayment = (row) => {
    setSelectedInvoice({
      ...row,
      customer_id: row.company_id || selectedCompanyId,
      customer_name: row.company_name || selectedCompany?.company_name,
      sales_order_id: row.source === 'SALES_INVOICE' ? (row.sales_order_id || row.order_id) : row.id,
      invoice_id: row.invoice_id || (row.source === 'SALES_INVOICE' ? row.id : null),
      sales_order_source: row.source || 'SALES_INVOICE',
      po_number: row.invoice_no || row.so_number,
      outstanding: row.outstanding,
      already_paid: row.paid_amount,
      total_amount: row.total_amount
    });
    setIsPaymentModalOpen(true);
  };

  // Download Receipt PDF
  const handleDownloadReceipt = async (paymentId, receiptNo) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/${paymentId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to download receipt');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${receiptNo || paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading receipt:', err);
      errorToast('Failed to download receipt');
    }
  };

  // Invoices Table Columns
  const invoiceColumns = [
    {
      label: 'Invoice #',
      key: 'invoice_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-0.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-indigo-700 text-xs">
              {row.invoice_no || val || '—'}
            </span>
            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              INV
            </span>
          </div>
          {row.customer_po_no && (
            <span className="text-[10px] text-slate-500 font-mono">
              PO: {row.customer_po_no}
            </span>
          )}
        </div>
      )
    },
    {
      label: 'Sales Order #',
      key: 'so_number',
      sortable: true,
      render: (val) => (
        <span className="font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
          {val || '—'}
        </span>
      )
    },
    {
      label: 'Invoice Date',
      key: 'invoice_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs">{formatDate(val || row.created_at)}</span>
        </div>
      )
    },
    {
      label: 'Invoice Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <span className="text-slate-900 font-semibold font-mono text-xs whitespace-nowrap">
          {formatCurrency(val)}
        </span>
      )
    },
    {
      label: 'Payment Status',
      key: 'outstanding',
      sortable: true,
      render: (_, row) => {
        const outstanding = parseFloat(row.outstanding) || 0;
        const received = parseFloat(row.paid_amount) || 0;
        if (outstanding <= 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              PAID
            </span>
          );
        } else if (received > 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700 font-semibold border border-amber-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              PARTIAL
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-700 font-semibold border border-rose-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              PENDING
            </span>
          );
        }
      }
    },
    {
      label: 'Action',
      key: 'id',
      className: 'text-right',
      render: (_, row) => {
        const outstanding = parseFloat(row.outstanding) || 0;
        const isPaid = outstanding <= 0;

        return (
          <div className="flex justify-end items-center">
            <button
              onClick={() => handleOpenRecordPayment(row)}
              disabled={isPaid}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shadow-xs ${
                isPaid 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md active:scale-95'
              }`}
              title={isPaid ? 'Invoice is fully paid' : 'Record payment for this invoice'}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          </div>
        );
      }
    }
  ];

  // Customer Payment History Columns
  const historyColumns = [
    {
      label: 'Receipt #',
      key: 'receipt_number',
      sortable: true,
      render: (val, row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {row.receipt_number || val || `RCP-${row.id}`}
        </span>
      )
    },
    {
      label: 'Payment Date',
      key: 'payment_date',
      sortable: true,
      render: (val) => (
        <span className="text-xs text-slate-600">{formatDate(val)}</span>
      )
    },
    {
      label: 'Reference Invoice / SO',
      key: 'invoice_no',
      sortable: true,
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800 font-mono">
            {row.invoice_no || row.so_number || '—'}
          </span>
          {row.project_name && (
            <span className="text-[10px] text-slate-400 italic">{row.project_name}</span>
          )}
        </div>
      )
    },
    {
      label: 'Payment Mode',
      key: 'payment_mode',
      sortable: true,
      render: (val) => (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {val || 'CASH'}
        </span>
      )
    },
    {
      label: 'Received Amount',
      key: 'payment_amount',
      sortable: true,
      render: (val) => (
        <span className="font-mono text-xs font-bold text-emerald-600">
          {formatCurrency(val)}
        </span>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          {val || 'CONFIRMED'}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <button
          onClick={() => handleDownloadReceipt(row.id, row.receipt_number)}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
          title="Download Receipt PDF"
        >
          <Download className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 shadow-xs">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Record Payment Received</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Accounts
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Select customer and record payment receipts against outstanding invoices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${invoicesLoading || historyLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Customer Selection Form Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs relative z-20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between border-l-4 border-l-blue-600">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Payment Entry & Receivables Filter</span>
          </div>
          {selectedCompany && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Outstanding:</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-xs shadow-xs">
                {formatCurrency(stats.totalOutstanding)}
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Property 1: Customer Search Filter */}
            <div className="col-span-12 md:col-span-4 lg:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>Select Customer / Company</span>
                <span className="text-blue-600 font-bold">*</span>
              </label>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={companyOptions}
                    value={selectedCompanyId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCompanyId(val);
                    }}
                    placeholder="Type to search customer..."
                    labelField="label"
                    valueField="value"
                    subLabelField="sublabel"
                    allowCustom={false}
                    showSearchIcon={true}
                    className="w-full text-xs py-2 px-3 border-slate-300 focus:border-blue-600 focus:ring-blue-500/20 rounded-lg font-medium"
                  />
                </div>

                {selectedCompanyId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompanyId('');
                      setSelectedCompany(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    title="Clear selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Property 2: Month / Year Page Filter */}
            <div className="col-span-12 md:col-span-3 lg:col-span-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Month / Year</span>
                </label>
                {monthlySummary?.monthName && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded truncate max-w-[120px]">
                    {monthlySummary.monthName}
                  </span>
                )}
              </div>

              <div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs cursor-pointer"
                />
              </div>
            </div>

            {/* Property 3: Date-wise Filter (Last Property) */}
            <div className="col-span-12 md:col-span-5 lg:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Date-wise Filter</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setApplyDateFilterToTable(!applyDateFilterToTable)}
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
                      applyDateFilterToTable 
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                    }`}
                    title="Toggle filtering invoice and payment list by this date range"
                  >
                    {applyDateFilterToTable ? 'List Filtered ✓' : 'Filter List'}
                  </button>
                  {selectedCompanyId && (
                    <button
                      type="button"
                      onClick={() => fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate)}
                      className={`p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer ${monthlyLoading ? 'animate-spin' : ''}`}
                      title="Refresh date-wise balance"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase pointer-events-none">From</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => handleFromDateChange(e.target.value)}
                    className="w-full text-xs font-semibold py-2 pr-2 pl-12 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs cursor-pointer"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase pointer-events-none">To</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => handleToDateChange(e.target.value)}
                    className="w-full text-xs font-semibold py-2 pr-2 pl-8 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Compact Customer Metadata Ribbon (Clean, Light Blue Backdrop) */}
          {selectedCompany && (
            <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/50 text-slate-700 -mx-5 -mb-5 px-5 py-3 rounded-b-xl border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">Customer:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedCompany.company_name}</span>
                </div>
                {selectedCompany.gstin && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">GSTIN:</span>
                    <span className="font-mono text-slate-800 bg-white px-2 py-0.5 rounded text-[11px] border border-slate-200 font-medium">{selectedCompany.gstin}</span>
                  </div>
                )}
                {selectedCompany.city && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">City:</span>
                    <span className="text-slate-800 text-[11px] font-medium">{selectedCompany.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-[11px]">Period:</span>
                  <span className="font-mono font-semibold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded text-[11px]">{fromDate} to {toDate}</span>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div>
                  <span className="text-slate-500 text-[11px] block">Total Invoiced</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">{formatCurrency(stats.totalInvoiced)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Received</span>
                  <span className="font-mono font-bold text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded block">{formatCurrency(stats.totalReceived)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Outstanding</span>
                  <span className="font-mono font-bold text-blue-700 text-xs bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded block shadow-xs">{formatCurrency(stats.totalOutstanding)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* 3. Invoices Table & Payment History Section */}
      {!selectedCompany ? (
        /* Empty State: Prompt customer selection */
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">No Customer Selected</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Please search and select a customer above to view available invoices with outstanding payment balances and record payments.
          </p>
        </div>
      ) : (
        /* Customer Selected: Show Available Invoices & Payment History */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header Controls & Tabs */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setActiveViewTab('invoices')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeViewTab === 'invoices' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Available Invoices ({displayedInvoices.length})</span>
                </button>

                <button
                  onClick={() => setActiveViewTab('history')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeViewTab === 'history' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Payment History ({displayedPaymentHistory.length})</span>
                </button>
              </div>

              {applyDateFilterToTable && (
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md font-bold shadow-xs">
                  <span>Filtered ({fromDate} to {toDate})</span>
                  <button 
                    onClick={() => setApplyDateFilterToTable(false)}
                    className="hover:text-blue-900 ml-0.5 text-xs font-bold leading-none cursor-pointer"
                    title="Remove date filter and show all"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Showing {activeViewTab === 'invoices' ? `${displayedInvoices.length} invoices` : `${displayedPaymentHistory.length} receipts`} for <span className="font-semibold text-slate-800">{selectedCompany.company_name}</span>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-4">
            {activeViewTab === 'invoices' ? (
              <DataTable
                columns={invoiceColumns}
                data={displayedInvoices}
                loading={invoicesLoading}
                searchPlaceholder="Search by invoice #, SO #, PO #..."
                customFilter={(row, term) => 
                  (row.invoice_no && row.invoice_no.toLowerCase().includes(term)) ||
                  (row.so_number && row.so_number.toLowerCase().includes(term)) ||
                  (row.customer_po_no && row.customer_po_no.toLowerCase().includes(term))
                }
                emptyMessage={`No outstanding invoices found for ${selectedCompany.company_name}.`}
                className="border-none"
              />
            ) : (
              <DataTable
                columns={historyColumns}
                data={displayedPaymentHistory}
                loading={historyLoading}
                searchPlaceholder="Search by receipt #, reference, mode..."
                emptyMessage={`No payment receipts found for ${selectedCompany.company_name}.`}
                className="border-none"
              />
            )}
          </div>
        </div>
      )}

      {/* 4. Monthly Balance Summary Section (3 Equal-Width Cards in a Single Horizontal Row) */}
      {selectedCompany && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Compact Header Bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-blue-600">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-200">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Monthly Balance Summary
              </h3>
              {monthlySummary?.monthName && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                  {monthlySummary.monthName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Statement Period: <strong className="text-slate-800 font-semibold">{monthlySummary?.monthName || selectedMonth}</strong></span>
              <button
                type="button"
                onClick={() => fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate)}
                className={`p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-0.5 cursor-pointer ${monthlyLoading ? 'animate-spin' : ''}`}
                title="Refresh monthly balance summary"
                aria-label="Refresh monthly balance summary"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Exactly 3 Equal-Width Summary Cards in a Single Horizontal Row */}
          <div className="p-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
              {/* 1) Opening Balance */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      1) Opening Balance
                    </span>
                    <span className="p-1 rounded-md bg-white text-slate-600 border border-slate-200 shadow-2xs">
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-800 tracking-tight">
                    {monthlyLoading ? (
                      <span className="text-xs font-normal text-slate-400">Loading...</span>
                    ) : (
                      formatCurrency(monthlySummary?.openingBalance || 0)
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    Previous month carry-forward
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400">
                  As of 01 {monthlySummary?.monthName || 'selected month'}
                </div>
              </div>

              {/* 2) Current Balance */}
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-emerald-300 transition-all shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      2) Current Balance
                    </span>
                    <span className="p-1 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-700 tracking-tight">
                    {monthlyLoading ? (
                      <span className="text-xs font-normal text-slate-400">Loading...</span>
                    ) : (
                      formatCurrency(monthlySummary?.currentMonthPayments || 0)
                    )}
                  </div>
                  <p className="text-[10px] text-emerald-700/80 mt-0.5 font-medium">
                    Payments received this month
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[10px] text-emerald-800 flex items-center justify-between font-medium">
                  <span>Invoices raised:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(monthlySummary?.currentMonthInvoices || 0)}</span>
                </div>
              </div>

              {/* 3) Closing Balance */}
              <div className="bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 border-2 border-blue-600 rounded-xl p-3.5 flex flex-col justify-between hover:shadow-sm transition-all shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100/40 rounded-full blur-xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                      3) Closing Balance
                    </span>
                    <span className="p-1 rounded-md bg-blue-600 text-white shadow-xs">
                      <Wallet className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-blue-700 tracking-tight">
                    {monthlyLoading ? (
                      <span className="text-xs font-normal text-slate-400">Loading...</span>
                    ) : (
                      formatCurrency(monthlySummary?.closingBalance || 0)
                    )}
                  </div>
                  <p className="text-[10px] text-blue-600 mt-0.5 font-medium">
                    Month-end outstanding
                  </p>
                </div>
                <div className="relative z-10 mt-2.5 pt-2 border-t border-blue-100 text-[10px] text-blue-700/90 font-medium">
                  Opening + Invoices − Payments
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Existing Record Payment Modal Integration */}
      <PaymentReceivedModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          successToast('Payment recorded successfully');
          if (selectedCompanyId) {
            fetchCustomerInvoices(selectedCompanyId);
            fetchCustomerBalance(selectedCompanyId);
            fetchCustomerPaymentHistory(selectedCompanyId);
            fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
          }
        }}
      />
    </div>
  );
};

export default RecordPaymentReceived;
