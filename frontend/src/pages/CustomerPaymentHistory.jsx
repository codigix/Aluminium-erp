import React, { useState, useEffect, useMemo } from 'react';
import { History, RefreshCw, Download, Send, Calendar, User, FileText, Building2, Filter, X, CheckCircle2, Eye, Printer, FileCheck, Wallet } from 'lucide-react';
import { DataTable, Button } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import SendEmailModal from '../components/SendEmailModal.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getBankName = (row) => {
  if (row.bank_name) {
    return /^\d+$/.test(String(row.bank_name).trim()) 
      ? `A/C ${row.bank_name}` 
      : row.bank_name;
  }
  if (row.cheque_bank_name) return row.cheque_bank_name;
  if (row.manual_bank_account) {
    return /^\d+$/.test(String(row.manual_bank_account).trim()) 
      ? `A/C ${row.manual_bank_account}` 
      : row.manual_bank_account;
  }
  const fromRemarks = row.remarks?.match(/Bank:\s*([^|,;\[\]\n]+)/i)?.[1]?.trim();
  if (fromRemarks) return fromRemarks;
  const fromChqBank = row.remarks?.match(/Cheque Bank:\s*([^|,;\[\]\n]+)/i)?.[1]?.trim();
  if (fromChqBank) return fromChqBank;
  return null;
};

const getChequeNo = (row) => {
  return row.cheque_number || row.remarks?.match(/Cheque No:\s*([^\s,|;\[\]]+)/i)?.[1]?.trim();
};

const getRefNo = (row) => {
  return row.transaction_ref_no || row.remarks?.match(/Ref:\s*([^\s,|;\[\]]+)/i)?.[1]?.trim();
};

const CustomerPaymentHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [emailData, setEmailData] = useState({ to: '', subject: '', message: '' });

  // Filter states: Customer-wise, Bank-wise, Date-wise, Status-wise
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allRegisteredBanks, setAllRegisteredBanks] = useState([]);

  // Monthly Period Balance Statement states
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  useEffect(() => {
    fetchPaymentHistory();
    fetchRegisteredBanks();
  }, []);

  const fetchRegisteredBanks = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllRegisteredBanks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching registered banks:', err);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments?status=CONFIRMED`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch payment history');
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching history:', error);
      errorToast('Failed to fetch payment history');
    } finally {
      setLoading(false);
    }
  };

  // Distinct Customer Options (name + id)
  const customerOptions = useMemo(() => {
    const map = new Map();
    history.forEach(p => {
      const name = p.customer_name;
      const id = p.customer_id;
      if (name && !map.has(name)) {
        map.set(name, { id, name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  // Active Customer for Statement (explicitly selected or first available customer)
  const activeCustomer = useMemo(() => {
    if (selectedCustomer) {
      return customerOptions.find(c => c.name.toLowerCase() === selectedCustomer.toLowerCase()) || null;
    }
    return customerOptions[0] || null;
  }, [selectedCustomer, customerOptions]);

  // Fetch Period Statement Balance
  const fetchMonthlySummary = async (custId, customFrom, customTo) => {
    if (!custId) {
      setMonthlySummary(null);
      return;
    }
    try {
      setMonthlyLoading(true);
      const token = localStorage.getItem('authToken');
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      let url = `${API_BASE}/customer-payments/customer/${custId}/monthly-summary?year=${currentYear}&month=${currentMonth}`;
      if (customFrom && customTo) {
        url += `&startDate=${customFrom}&endDate=${customTo}`;
      } else {
        const pad = (n) => String(n).padStart(2, '0');
        const defaultStart = `${currentYear}-${pad(currentMonth)}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        const defaultEnd = `${currentYear}-${pad(currentMonth)}-${pad(lastDay)}`;
        url += `&startDate=${defaultStart}&endDate=${defaultEnd}`;
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

  useEffect(() => {
    if (activeCustomer?.id) {
      fetchMonthlySummary(activeCustomer.id, startDate, endDate);
    } else {
      setMonthlySummary(null);
    }
  }, [activeCustomer?.id, startDate, endDate]);

  // Distinct Bank Options (combining registered bank accounts + history records)
  const bankOptions = useMemo(() => {
    const set = new Set();
    allRegisteredBanks.forEach(b => {
      if (b.bank_name) set.add(b.bank_name);
    });
    history.forEach(p => {
      const bank = getBankName(p);
      if (bank) set.add(bank);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history, allRegisteredBanks]);

  // Date Range Quick Presets
  const applyDatePreset = (preset) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'All Time') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'Today') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'This Month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    } else if (preset === 'Last 30 Days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === 'This Year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    }
  };

  const isFiltered = Boolean(selectedCustomer || selectedBank || startDate || endDate);

  const handleResetFilters = () => {
    setSelectedCustomer('');
    setSelectedBank('');
    setStartDate('');
    setEndDate('');
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter(row => {
      // 1. Customer Filter
      if (selectedCustomer) {
        const rowCust = (row.customer_name || '').toLowerCase();
        if (rowCust !== selectedCustomer.toLowerCase()) return false;
      }

      // 2. Bank Filter
      if (selectedBank) {
        const rowBank = (getBankName(row) || '').toLowerCase();
        const searchBank = selectedBank.toLowerCase();
        if (!rowBank.includes(searchBank)) return false;
      }

      // 3. Date Filter (From Date)
      if (startDate) {
        const rowDate = row.payment_date ? row.payment_date.split('T')[0] : null;
        if (rowDate && rowDate < startDate) return false;
      }

      // 4. Date Filter (To Date)
      if (endDate) {
        const rowDate = row.payment_date ? row.payment_date.split('T')[0] : null;
        if (rowDate && rowDate > endDate) return false;
      }

      return true;
    });
  }, [history, selectedCustomer, selectedBank, startDate, endDate]);

  const downloadReceipt = async (paymentId, receiptNo) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/${paymentId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to download receipt');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${receiptNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      errorToast('Failed to download receipt');
    }
  };

  const handleDownloadInvoice = async (row) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!row.sales_order_id) {
        errorToast('Invoice reference ID not found');
        return;
      }
      
      const endpoint = row.sales_order_source === 'SALES_ORDER' 
        ? `${API_BASE}/sales-orders/${row.sales_order_id}/pdf` 
        : `${API_BASE}/order/${row.sales_order_id}/pdf`;

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Invoice_${row.so_number || row.sales_order_id}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      errorToast('Failed to download invoice');
    }
  };

  const openEmailModal = (payment) => {
    setSelectedPayment(payment);
    setEmailData({
      to: payment.customer_email || '',
      subject: `Payment Receipt: ${payment.payment_receipt_no}`,
      message: `Dear ${payment.customer_name || 'Customer'},\n\nThank you for your payment. Please find attached the payment receipt ${payment.payment_receipt_no} for the amount received on ${new Date(payment.payment_date).toLocaleDateString()}.\n\nAmount Received: INR ${parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nRegards,\nAccounts Department\nSPTECHPIONEER PVT LTD`,
      attachPDF: true
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async (data) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/${selectedPayment.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to send email');
      }

      successToast('Payment receipt sent to customer email');
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
      throw error;
    }
  };

  const columns = [
    {
      label: 'Receipt Details',
      key: 'payment_receipt_no',
      sortable: true,
      render: (val, row) => {
        const billRef = row.so_number 
          || (row.invoice_id ? `INV-#${row.invoice_id}` : null) 
          || row.remarks?.match(/\[(?:Ref|Bill):\s*([^\]]+)\]/i)?.[1]?.trim();
        return (
          <div className="flex flex-col py-1">
            <button
              type="button"
              onClick={() => setViewingReceipt(row)}
              className="text-rose-600 hover:text-rose-800 font-mono font-bold text-xs hover:underline flex items-center gap-1 text-left cursor-pointer transition-colors"
              title="Click to view Receipt Voucher"
            >
              <span>{val || `RCP-${row.id}`}</span>
            </button>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-slate-600 font-mono px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 truncate max-w-[150px]">
                {billRef ? (billRef.startsWith('SO:') || billRef.startsWith('INV') ? billRef : `Ref: ${billRef}`) : 'Direct Receipt'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Customer',
      key: 'customer_name',
      sortable: true,
      render: (val, row) => {
        const bankName = getBankName(row);
        const mode = row.payment_mode ? row.payment_mode.replace('_', ' ') : 'N/A';
        return (
          <div className="flex items-center gap-2.5 py-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs shadow-2xs shrink-0">
              {val ? val.substring(0, 2).toUpperCase() : 'CU'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 text-xs leading-tight truncate">{val || 'Unnamed Customer'}</span>
              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="font-medium text-slate-600">Mode: {mode}</span>
                {bankName && (
                  <span className="text-blue-700 font-semibold truncate max-w-[160px] flex items-center gap-1 bg-blue-50/80 px-1 py-0.2 rounded border border-blue-100" title={bankName}>
                    <Building2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                    <span>{bankName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Bank Transfer / Mode',
      key: 'payment_mode',
      sortable: true,
      render: (val, row) => {
        const bankName = getBankName(row);
        const chequeNo = getChequeNo(row);
        const refNo = getRefNo(row);
        const mode = (val || 'CASH').replace('_', ' ');

        return (
          <div className="flex flex-col gap-1 items-start py-1">
            {/* Prominent Bank Name display */}
            {bankName ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[210px]" title={bankName}>{bankName}</span>
                {row.account_number && (
                  <span className="text-[10px] text-blue-600 font-mono font-normal">
                    (••{String(row.account_number).slice(-4)})
                  </span>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                <Building2 className="w-3 h-3 text-slate-300" />
                <span>No bank specified</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                {mode}
              </span>
              {row.upi_app && (
                <span className="text-[9.5px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                  {row.upi_app}
                </span>
              )}
              {chequeNo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                  Chq #{chequeNo}
                </span>
              )}
              {!chequeNo && refNo && (
                <span className="text-[9.5px] text-slate-500 font-mono">
                  Ref: {refNo}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      label: 'Payment Date',
      key: 'payment_date',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium">{formatDate(val)}</span>
        </div>
      )
    },
    {
      label: 'Amount Received',
      key: 'payment_amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <span className="font-bold text-slate-900 font-mono text-xs">
            {formatCurrency(val)}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">
            Payment Confirmed
          </span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase shadow-2xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {val || 'CONFIRMED'}
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            Payment Settled
          </span>
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end items-center gap-1.5">
          <button
            onClick={() => setViewingReceipt(row)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="View Receipt Voucher"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => downloadReceipt(row.id, row.payment_receipt_no || `REC-${row.id}`)}
            className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-600 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Download Payment Receipt PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openEmailModal(row)}
            className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Email Receipt to Customer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          {row.sales_order_id && (
            <button
              onClick={() => handleDownloadInvoice(row)}
              className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-600 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
              title="Download Invoice Copy"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const totalTransactions = filteredHistory.length;
  const totalReceived = filteredHistory.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Payment History</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                {totalTransactions} {totalTransactions === 1 ? 'Transaction' : 'Transactions'}
                {isFiltered && ` (Filtered from ${history.length})`}
              </span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-emerald-500" />
                {formatCurrency(totalReceived)} Total Collected
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchPaymentHistory}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
            title="Refresh Data"
          />
        </div>
      </div>

      {/* Payment History Filter Bar: Customer-wise, Bank-wise, Date-wise */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Filter Payments</span>
            {isFiltered && (
              <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                Active Filters
              </span>
            )}
          </div>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Customer-wise Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" /> Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800"
            >
              <option value="">All Customers</option>
              {customerOptions.map(c => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Bank-wise Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" /> Bank / Account
            </label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800"
            >
              <option value="">All Banks</option>
              {bankOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* 3. From Date Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800 font-mono"
            />
          </div>

          {/* 4. To Date Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800 font-mono"
            />
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[10.5px] font-medium text-slate-400">Quick Range:</span>
          {['All Time', 'Today', 'This Month', 'Last 30 Days', 'This Year'].map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => applyDatePreset(preset)}
              className="text-[10.5px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Period Balance Statement Card */}
      {monthlySummary && (
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
                {activeCustomer?.name && (
                  <span className="text-[10.5px] font-semibold text-slate-600">
                    • {activeCustomer.name}
                  </span>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Statement Period: <strong className="text-slate-800 font-semibold">{monthlySummary.startDate} to {monthlySummary.endDate}</strong>
              </span>
              <button
                type="button"
                onClick={() => fetchMonthlySummary(activeCustomer?.id, startDate, endDate)}
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
                Statement period reconciliation from <strong className="text-slate-700 font-medium">{monthlySummary.startDate}</strong> to <strong className="text-slate-700 font-medium">{monthlySummary.endDate}</strong>.
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
                    ({monthlySummary?.monthName?.split(' ')[0] || 'Period'} Received)
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
                      : Math.max(0, (monthlySummary?.openingBalance || 0) + (monthlySummary?.currentMonthInvoices || 0) - (monthlySummary?.currentMonthPayments || 0))
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden my-4">
        <DataTable
          columns={columns}
          data={filteredHistory}
          loading={loading}
          searchPlaceholder="Search by receipt, SO or customer..."
          className="border-none"
        />
      </div>

      {/* View Receipt Voucher Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide uppercase">Payment Receipt Voucher</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{viewingReceipt.payment_receipt_no || `RCP-${viewingReceipt.id}`}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Receipt Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block">Total Amount Received</span>
                  <span className="text-xl font-extrabold text-emerald-600 font-mono">
                    {formatCurrency(viewingReceipt.payment_amount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {viewingReceipt.status || 'CONFIRMED'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                    {formatDate(viewingReceipt.payment_date)}
                  </span>
                </div>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Received From</span>
                  <span className="font-bold text-slate-800 block truncate" title={viewingReceipt.customer_name}>
                    {viewingReceipt.customer_name || 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Payment Mode</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {(viewingReceipt.payment_mode || 'CASH').replace('_', ' ')}
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Deposited To Bank</span>
                  <span className="font-bold text-blue-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{getBankName(viewingReceipt) || 'Primary Account'}</span>
                  </span>
                  {viewingReceipt.account_number && (
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      A/C: ••••{String(viewingReceipt.account_number).slice(-4)}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Against Bill / Reference</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {viewingReceipt.so_number || (viewingReceipt.invoice_id ? `INV-#${viewingReceipt.invoice_id}` : (viewingReceipt.remarks?.match(/\[(?:Ref|Bill):\s*([^\]]+)\]/i)?.[1] || 'Direct Receipt'))}
                  </span>
                </div>
              </div>

              {/* Cheque / Ref / Remarks */}
              {viewingReceipt.remarks && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Transaction Notes / Reference</span>
                  <p className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap">{viewingReceipt.remarks}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEmailModal(viewingReceipt)}
                  className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Email Receipt
                </button>
                <button
                  type="button"
                  onClick={() => downloadReceipt(viewingReceipt.id, viewingReceipt.payment_receipt_no || `REC-${viewingReceipt.id}`)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleSendEmail}
        data={emailData}
        title="Send Receipt to Customer"
        subTitle={`${selectedPayment?.payment_receipt_no} • ${selectedPayment?.customer_name}`}
        attachmentName={`Receipt-${selectedPayment?.payment_receipt_no}.pdf`}
      />
    </div>
  );
};

export default CustomerPaymentHistory;
