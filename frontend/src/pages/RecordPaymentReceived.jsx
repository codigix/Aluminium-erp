import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Search, RefreshCw, Building2, Calendar, FileText, 
  CheckCircle2, Clock, AlertCircle, ChevronDown, Download, Check, 
  ArrowRight, ArrowLeft, DollarSign, Wallet, History, X, Filter,
  ArrowLeftRight, BookOpen, FileMinus, FilePlus, Layers, Receipt
} from 'lucide-react';
import { Button, DataTable, Card, SearchableSelect } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import PaymentReceivedModal from '../components/PaymentReceivedModal.jsx';
import { LEDGER_GROUPS, DEFAULT_CUSTOMER_LEDGER_GROUP, getLedgerGroupByName } from '../constants/ledgerGroups.js';

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
  const [historyFilterMode, setHistoryFilterMode] = useState('period'); // 'period' | 'all'
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(new Set());
  const [selectedInvoicesForModal, setSelectedInvoicesForModal] = useState([]);

  // Active View Tab: 'invoices' | 'history'
  const [activeViewTab, setActiveViewTab] = useState('invoices');

  // Step 1: Voucher Selection State: Default to 'RECEIPT' to preserve current workflow
  const [selectedVoucherType, setSelectedVoucherType] = useState('RECEIPT');

  // Step 2: Ledger Group Selection State (57 Official Ledger Groups)
  const [selectedLedgerGroup, setSelectedLedgerGroup] = useState(DEFAULT_CUSTOMER_LEDGER_GROUP);

  // ── 6 ACCOUNTING VOUCHERS ──
  const VOUCHER_OPTIONS = [
    {
      id: 'RECEIPT',
      name: 'Receipt',
      shortcut: 'F6',
      badge: 'Receivables',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      activeColor: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20',
      icon: <ArrowLeft className="w-4 h-4" />,
      desc: 'Customer receipts against outstanding invoices & sales orders'
    },
    {
      id: 'PAYMENT',
      name: 'Payment',
      shortcut: 'F5',
      badge: 'Payables',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      activeColor: 'bg-slate-900 text-white border-slate-900 shadow-md',
      icon: <ArrowRight className="w-4 h-4" />,
      desc: 'Vendor & supplier payments, operational expenses'
    },
    {
      id: 'JOURNAL',
      name: 'Journal',
      shortcut: 'F7',
      badge: 'Adjustments',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      activeColor: 'bg-purple-700 text-white border-purple-700 shadow-md',
      icon: <BookOpen className="w-4 h-4" />,
      desc: 'General journal adjustments, depreciation & non-cash entries'
    },
    {
      id: 'CONTRA',
      name: 'Contra',
      shortcut: 'F4',
      badge: 'Banking',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      activeColor: 'bg-indigo-700 text-white border-indigo-700 shadow-md',
      icon: <ArrowLeftRight className="w-4 h-4" />,
      desc: 'Internal fund transfers between cash & bank accounts'
    },
    {
      id: 'DEBIT_NOTE',
      name: 'Debit Note',
      shortcut: 'Alt+F9',
      badge: 'Returns / Dr',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      activeColor: 'bg-amber-700 text-white border-amber-700 shadow-md',
      icon: <FileMinus className="w-4 h-4" />,
      desc: 'Debit notes for purchase returns, shortages & supplier rate revisions'
    },
    {
      id: 'CREDIT_NOTE',
      name: 'Credit Note',
      shortcut: 'Alt+F8',
      badge: 'Credits / Cr',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      activeColor: 'bg-teal-700 text-white border-teal-700 shadow-md',
      icon: <FilePlus className="w-4 h-4" />,
      desc: 'Credit notes for customer sales returns, rebates & discounts'
    }
  ];

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
    setSelectedInvoiceIds(new Set());
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
    setSelectedInvoiceIds(new Set());
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
    setSelectedInvoiceIds(new Set());
    if (selectedCompanyId && val && toDate) {
      fetchMonthlySummary(selectedCompanyId, selectedMonth, val, toDate);
    }
  };

  const handleToDateChange = (val) => {
    setToDate(val);
    setSelectedInvoiceIds(new Set());
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

  // 57 Ledger Groups Options for Step 2 SearchableSelect
  const ledgerGroupOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Ledger Groups', sublabel: 'View all 57 groups' },
      ...LEDGER_GROUPS.map(g => ({
        value: g.name,
        label: `${g.id}. ${g.name}`,
        sublabel: `Category: ${g.category}`
      }))
    ];
  }, []);

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

  // Displayed Payment History (by default applies active month/period filter, e.g. Oct 2026)
  const displayedPaymentHistory = useMemo(() => {
    if (historyFilterMode === 'all' || !fromDate || !toDate) {
      return paymentHistory;
    }
    return paymentHistory.filter(p => {
      const d = (p.payment_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }, [paymentHistory, historyFilterMode, fromDate, toDate]);

  const historyPeriodCount = useMemo(() => {
    if (!fromDate || !toDate) return paymentHistory.length;
    return paymentHistory.filter(p => {
      const d = (p.payment_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    }).length;
  }, [paymentHistory, fromDate, toDate]);

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

  // Format invoice payload for modal
  const formatInvoiceForModal = (row) => ({
    ...row,
    id: row.id,
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

  // Selected invoices derived list and total outstanding
  const selectedInvoicesList = useMemo(() => {
    return displayedInvoices.filter(inv => selectedInvoiceIds.has(inv.id));
  }, [displayedInvoices, selectedInvoiceIds]);

  const selectedTotalOutstanding = useMemo(() => {
    return selectedInvoicesList.reduce((sum, inv) => sum + (parseFloat(inv.outstanding) || 0), 0);
  }, [selectedInvoicesList]);

  // Open modal for a specific single invoice row
  const handleOpenRecordPayment = (row) => {
    const formatted = formatInvoiceForModal(row);
    setSelectedInvoice(formatted);
    setSelectedInvoicesForModal([formatted]);
    setIsPaymentModalOpen(true);
  };

  // Open modal for all selected invoices (or all company bill references if none checked)
  const handleProceedToPayment = () => {
    if (selectedInvoiceIds.size > 0) {
      const formattedList = displayedInvoices
        .filter(inv => selectedInvoiceIds.has(inv.id))
        .map(formatInvoiceForModal);
      setSelectedInvoicesForModal(formattedList);
      setSelectedInvoice(formattedList.length === 1 ? formattedList[0] : null);
    } else if (selectedCompanyId) {
      // If 0 invoices were checked, start with empty list so user can add desired references via Add Agst Ref in modal
      setSelectedInvoicesForModal([]);
      setSelectedInvoice(null);
    } else {
      return;
    }
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

  // Invoices Table Columns (Compact Space-Efficient Layout)
  const invoiceColumns = [
    {
      label: 'Invoice #',
      key: 'invoice_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col whitespace-nowrap leading-tight py-0">
          <div className="flex items-center gap-1">
            <span className="font-mono font-bold text-slate-900 text-[11px]">
              {row.invoice_no || val || '—'}
            </span>
            <span className="text-[8.5px] font-bold px-1 py-0 rounded bg-slate-100 text-slate-600 border border-slate-200">
              INV
            </span>
          </div>
          {row.customer_po_no && (
            <span className="text-[9.5px] text-slate-400 font-mono">
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
        <span className="font-mono text-[11px] font-medium text-slate-700 whitespace-nowrap">
          {val || '—'}
        </span>
      )
    },
    {
      label: 'Invoice Date',
      key: 'invoice_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-1 text-slate-600 whitespace-nowrap text-[11px]">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span>{formatDate(val || row.created_at)}</span>
        </div>
      )
    },
    {
      label: 'Invoice Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <span className="text-slate-900 font-bold font-mono text-[11px] whitespace-nowrap">
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
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 whitespace-nowrap">
              <span className="w-1.2 h-1.2 rounded-full bg-emerald-500" />
              PAID
            </span>
          );
        } else if (received > 0) {
          return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] bg-amber-50 text-amber-700 font-bold border border-amber-200 whitespace-nowrap">
              <span className="w-1.2 h-1.2 rounded-full bg-amber-500" />
              PARTIAL
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] bg-rose-50 text-rose-700 font-bold border border-rose-200 whitespace-nowrap">
              <span className="w-1.2 h-1.2 rounded-full bg-rose-500" />
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
              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition-all whitespace-nowrap shadow-2xs ${
                isPaid 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 cursor-pointer shadow-xs'
              }`}
              title={isPaid ? 'Invoice is fully paid' : 'Record payment for this invoice'}
            >
              <CreditCard className="w-3 h-3" />
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
      label: 'Payment Mode & Bank / Cheque',
      key: 'payment_mode',
      sortable: true,
      render: (val, row) => {
        const chequeNo = row.cheque_number || (row.remarks?.match(/Cheque No:\s*([^\s,;\]]+)/i)?.[1]);
        const chequeBank = row.cheque_bank_name || (row.remarks?.match(/Cheque Bank:\s*([^|,;\[\]\n]+)/i)?.[1]?.trim());
        const bankName = row.bank_name 
          || row.manual_bank_account 
          || row.remarks?.match(/Bank:\s*([^|,;\[\]\n]+)/i)?.[1]?.trim();
        const refNo = row.transaction_ref_no;

        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
              {val || 'CASH'}
            </span>

            {/* Bank details if available */}
            {bankName ? (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[180px]" title={bankName}>{bankName}</span>
                {row.account_number && (
                  <span className="text-[10px] text-blue-600 font-mono">
                    (••{String(row.account_number).slice(-4)})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic">No bank specified</span>
            )}

            {/* Cheque Number & Cheque Bank Name */}
            {chequeNo && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shadow-2xs">
                <span>Chq #{chequeNo}</span>
                {chequeBank && <span className="text-amber-700 font-normal">({chequeBank})</span>}
              </div>
            )}

            {/* Ref/UTR No if present and no cheque */}
            {!chequeNo && refNo && (
              <span className="text-[10px] text-slate-500 font-mono">
                Ref: {refNo}
              </span>
            )}
          </div>
        );
      }
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

  if (isPaymentModalOpen) {
    return (
      <PaymentReceivedModal
        isOpen={true}
        isPage={true}
        initialVoucherType={selectedVoucherType}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          setSelectedInvoicesForModal([]);
        }}
        invoice={selectedInvoice}
        invoices={selectedInvoicesForModal}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          setSelectedInvoicesForModal([]);
          setSelectedInvoiceIds(new Set());
          if (selectedCompanyId) {
            fetchCustomerInvoices(selectedCompanyId);
            fetchCustomerBalance(selectedCompanyId);
            fetchCustomerPaymentHistory(selectedCompanyId);
            fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
          }
        }}
      />
    );
  }

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

      {/* ── 1. Select Voucher Type (Step 1 of 5) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-blue-600">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-600 text-white">
              Step 1
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Select Accounting Voucher Type
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Current Selection:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name || 'Receipt'} Voucher
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {VOUCHER_OPTIONS.map((v) => {
              const isSelected = selectedVoucherType === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVoucherType(v.id)}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    isSelected 
                      ? `${v.activeColor} ring-2 ring-blue-500/20`
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {v.icon}
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {v.shortcut}
                      </span>
                    </div>
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>{v.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 ml-1" />}
                    </div>
                  </div>
                  <div className={`text-[10px] mt-1.5 line-clamp-2 leading-tight ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    {v.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Contextual notice if a non-Receipt voucher is selected */}
          {selectedVoucherType !== 'RECEIPT' && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 p-3 rounded-xl text-amber-900">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-amber-100 text-amber-800">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">{VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name} Voucher Selected:</span>
                  <span className="text-amber-800 ml-1">
                    Receipt is the default workflow for customer receivables against sales invoices. Click below to open the dedicated {VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name} entry form.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedVoucherType('RECEIPT')}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  Back to Receipt
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-800 hover:bg-amber-900 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open {VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name} Form</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Select Customer / Company & Receivables Filter (Step 2 of 5) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs relative z-30">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between border-l-4 border-l-blue-600 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-600 text-white">
              Step 2
            </span>
            <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Select Customer / Company & Receivables Filter</span>
          </div>
          {selectedCompany && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Outstanding:</span>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs shadow-xs">
                {formatCurrency(stats.totalOutstanding)}
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Property 1: Ledger Group Selector (57 Ledger Groups) */}
            <div className="col-span-12 md:col-span-3 lg:col-span-3 space-y-1.5 relative z-20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ledger Group</span>
                </label>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                  57 Groups
                </span>
              </div>

              <div>
                <SearchableSelect
                  options={ledgerGroupOptions}
                  value={selectedLedgerGroup}
                  onChange={(e) => setSelectedLedgerGroup(e.target.value)}
                  placeholder="Select Ledger Group..."
                  labelField="label"
                  valueField="value"
                  subLabelField="sublabel"
                  allowCustom={false}
                  showSearchIcon={true}
                  className="w-full text-xs py-2 px-3 border-slate-300 focus:border-blue-600 focus:ring-blue-500/20 rounded-lg font-medium"
                />
              </div>
            </div>

            {/* Property 2: Customer Search Filter */}
            <div className="col-span-12 md:col-span-4 lg:col-span-4 space-y-1.5 relative z-20">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>Select Customer / Company</span>
                <span className="text-rose-600 font-bold">*</span>
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
                    className="w-full text-xs py-2 px-3 border-slate-300 focus:border-rose-600 focus:ring-rose-500/20 rounded-lg font-medium"
                  />
                </div>

                {selectedCompanyId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompanyId('');
                      setSelectedCompany(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    title="Clear selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Property 3: Month / Year Page Filter */}
            <div className="col-span-12 md:col-span-2 lg:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                  <span>Month / Year</span>
                </label>
              </div>

              <div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 shadow-xs cursor-pointer"
                />
              </div>
            </div>

            {/* Property 4: Date-wise Filter */}
            <div className="col-span-12 md:col-span-3 lg:col-span-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-600" />
                  <span>Date-wise Filter</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setApplyDateFilterToTable(!applyDateFilterToTable)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                      applyDateFilterToTable 
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs' 
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                    }`}
                    title="Toggle filtering invoice and payment list by this date range"
                  >
                    {applyDateFilterToTable ? 'Filtered ✓' : 'Filter'}
                  </button>
                  {selectedCompanyId && (
                    <button
                      type="button"
                      onClick={() => fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate)}
                      className={`p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer ${monthlyLoading ? 'animate-spin' : ''}`}
                      title="Refresh date-wise balance"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">Fr</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => handleFromDateChange(e.target.value)}
                    className="w-full text-xs font-semibold py-2 pr-1 pl-7 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 shadow-xs cursor-pointer"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase pointer-events-none">To</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => handleToDateChange(e.target.value)}
                    className="w-full text-xs font-semibold py-2 pr-1 pl-7 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 shadow-xs cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ultra-Compact 1-Line Customer Metadata & Balance Ribbon (No Slider / No Scrollbar) */}
          {selectedCompany && (
            <div className="mt-3 pt-2 border-t border-slate-200 -mx-5 -mb-5 px-4 py-1.5 rounded-b-xl bg-slate-50/90 text-slate-700 border-b border-slate-200 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 overflow-hidden text-[10px]">
              {/* Left Details */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Customer:</span>
                  <span className="font-bold text-slate-900 text-[11px] truncate max-w-[180px]" title={selectedCompany.company_name}>
                    {selectedCompany.company_name}
                  </span>
                </div>

                <span className="text-slate-300">|</span>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Ledger:</span>
                  <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded text-[9.5px]">
                    {selectedLedgerGroup === 'ALL' ? 'Sundry Debtors (52)' : `${selectedLedgerGroup} (${getLedgerGroupByName(selectedLedgerGroup)?.id || 52})`}
                  </span>
                </div>

                {selectedCompany.gstin && (
                  <>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">GSTIN:</span>
                      <span className="font-mono text-slate-700 bg-white px-1 py-0.2 rounded border border-slate-200 font-medium text-[9.5px]">{selectedCompany.gstin}</span>
                    </div>
                  </>
                )}

                <span className="text-slate-300">|</span>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Period:</span>
                  <span className="font-mono font-medium text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded text-[9.5px]">{fromDate} to {toDate}</span>
                </div>
              </div>

              {/* Right Totals in 1-line */}
              <div className="flex items-center gap-2.5 shrink-0 pl-2 lg:border-l border-slate-200">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Invoiced:</span>
                  <span className="font-mono font-bold text-slate-800 text-[10.5px]">{formatCurrency(stats.totalInvoiced)}</span>
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Received:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded text-[10.5px]">{formatCurrency(stats.totalReceived)}</span>
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Outstanding:</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[10.5px]">{formatCurrency(stats.totalOutstanding)}</span>
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

              {historyFilterMode === 'period' && (
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-md font-bold shadow-xs">
                  <span>Filtered ({fromDate} to {toDate})</span>
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Showing {activeViewTab === 'invoices' ? `${displayedInvoices.length} invoices` : `${displayedPaymentHistory.length} receipts`} for <span className="font-semibold text-slate-800">{selectedCompany.company_name}</span>
              {activeViewTab === 'history' && historyFilterMode === 'period' && (
                <span className="text-blue-600 font-semibold ml-1">
                  ({monthlySummary?.monthName || 'October 2026'})
                </span>
              )}
            </div>
          </div>

          {/* Payment History Period Filter Ribbon */}
          {activeViewTab === 'history' && (
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Receipts Filter:
                </span>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 border border-slate-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryFilterMode('period')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyFilterMode === 'period'
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{monthlySummary?.monthName || 'October 2026'} ({historyPeriodCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilterMode('all')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyFilterMode === 'all'
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All Time ({paymentHistory.length})</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  {historyFilterMode === 'period' ? `${monthlySummary?.monthName?.split(' ')[0] || 'October'} Total Received:` : 'All Time Received:'}
                </span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm">
                  {formatCurrency(displayedPaymentHistory.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0))}
                </span>
              </div>
            </div>
          )}

          {/* Invoice Selection Action Ribbon */}
          {activeViewTab === 'invoices' && (
            <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 transition-colors ${
              selectedInvoiceIds.size > 0 
                ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs' 
                : 'bg-slate-50/40 border-slate-100 text-slate-600'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Invoices Selected:</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedInvoiceIds.size > 0 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {selectedInvoiceIds.size > 0 && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{selectedInvoiceIds.size} of {displayedInvoices.length}</span>
                  </span>
                </div>

                {selectedInvoiceIds.size > 0 && (
                  <div className="flex items-center gap-3 border-l border-blue-200 pl-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 font-medium">Selected Outstanding:</span>
                      <span className="font-mono font-bold text-blue-700 text-sm">
                        {formatCurrency(selectedTotalOutstanding)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceIds(new Set())}
                      className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 underline cursor-pointer ml-1"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={!selectedCompanyId}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
                    selectedCompanyId
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={selectedInvoiceIds.size === 0 ? 'Open Bill-wise Details for all company bills' : 'Record receipt for selected invoices'}
                >
                  <Receipt className="w-4 h-4" />
                  <span>{selectedVoucherType === 'RECEIPT' ? 'Record Receipt' : `Record ${VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name || 'Voucher'}`}</span>
                  {selectedInvoiceIds.size > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 bg-white/25 rounded-full text-[10px] font-extrabold">
                      {selectedInvoiceIds.size}
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Table Content (Compact Space-Saving Padding) */}
          <div className="p-2 sm:p-2.5 overflow-x-auto">
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
                className="border-none text-xs"
                selectable={true}
                selectionColor="blue"
                selectedRows={selectedInvoiceIds}
                onSelectionChange={setSelectedInvoiceIds}
                rowId="id"
                isRowSelectable={(row) => (parseFloat(row.outstanding) || 0) > 0}
              />
            ) : (
              <DataTable
                columns={historyColumns}
                data={displayedPaymentHistory}
                loading={historyLoading}
                searchPlaceholder="Search by receipt #, reference, mode..."
                emptyMessage={`No payment receipts found for ${selectedCompany.company_name}.`}
                className="border-none text-xs"
              />
            )}
          </div>
        </div>
      )}

      {/* 4. Period Balance Analysis (Simple 3-Row Balance Statement) */}
      {selectedCompany && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header Bar */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-blue-600">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Period Balance Statement</span>
                {monthlySummary?.monthName && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {monthlySummary.monthName}
                  </span>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Statement Period: <strong className="text-slate-800 font-semibold">{fromDate} to {toDate}</strong></span>
              <button
                type="button"
                onClick={() => fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate)}
                className={`p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-0.5 cursor-pointer ${monthlyLoading ? 'animate-spin' : ''}`}
                title="Refresh statement analysis"
                aria-label="Refresh statement analysis"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Statement Content: Statement info on left, 3 Balance Rows aligned on right */}
          <div className="p-4 sm:p-6 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Left Context / Description */}
            <div className="text-xs text-slate-500 max-w-md space-y-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Account Statement Summary
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Statement period reconciliation from <strong className="text-slate-700 font-medium">{fromDate}</strong> to <strong className="text-slate-700 font-medium">{toDate}</strong>.
              </p>
            </div>

            {/* Right Summary Block: Both label and value together on the right side */}
            <div className="w-full md:w-auto min-w-[340px] max-w-md ml-auto divide-y divide-slate-200 bg-slate-50/60 p-4 rounded-xl border border-slate-200 shadow-2xs">
              {/* Row 1: Opening Balance */}
              <div className="flex items-center justify-between gap-6 py-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-700">Opening Balance :</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency(monthlySummary?.openingBalance || 0)}
                </span>
              </div>

              {/* Row 2: Current Total */}
              <div className="flex items-center justify-between gap-6 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">Current Total :</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({monthlySummary?.monthName?.split(' ')[0] || 'Oct'} Received)
                  </span>
                </div>
                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-700 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency(monthlySummary?.currentMonthPayments ?? 0)}
                </span>
              </div>

              {/* Row 3: Closing Balance (Highlighted & Bold) */}
              <div className="flex items-center justify-between gap-6 py-2.5 bg-blue-50/50 px-3 rounded-lg border border-blue-200 mt-1">
                <span className="text-xs sm:text-sm font-bold text-slate-900">Closing Balance :</span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency(
                    monthlySummary?.closingBalance !== undefined && monthlySummary?.closingBalance !== null
                      ? monthlySummary.closingBalance
                      : Math.max(0, (monthlySummary?.openingBalance || 0) + (monthlySummary?.currentMonthInvoices ?? stats.totalInvoiced ?? 0) - (monthlySummary?.currentMonthPayments || 0))
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Existing Record Payment Modal Integration */}
      <PaymentReceivedModal
        isOpen={isPaymentModalOpen}
        initialVoucherType={selectedVoucherType}
        customerId={selectedCompanyId}
        companyId={selectedCompanyId}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          setSelectedInvoicesForModal([]);
        }}
        invoice={selectedInvoice}
        invoices={selectedInvoicesForModal}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          setSelectedInvoicesForModal([]);
          setSelectedInvoiceIds(new Set());
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
