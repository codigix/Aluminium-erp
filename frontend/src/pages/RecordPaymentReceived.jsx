import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, Search, RefreshCw, Building2, Calendar, FileText, 
  CheckCircle2, Clock, AlertCircle, ChevronDown, Download, Check, 
  ArrowRight, ArrowLeft, DollarSign, Wallet, History, X, Filter,
  ArrowLeftRight, BookOpen, FileMinus, FilePlus, Layers, Receipt, Send, Plus, Trash2,
  ExternalLink, Eye, Package
} from 'lucide-react';
import { Button, DataTable, Card, SearchableSelect, Modal } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import PaymentReceivedModal from '../components/PaymentReceivedModal.jsx';
import ProcessPaymentModal from '../components/ProcessPaymentModal.jsx';
import DebitNoteEntry from '../components/DebitNoteEntry.jsx';
import CreditNoteEntry from '../components/CreditNoteEntry.jsx';
import { 
  LEDGER_GROUPS, 
  DEFAULT_CUSTOMER_LEDGER_GROUP, 
  DEFAULT_VENDOR_LEDGER_GROUP, 
  getLedgerGroupByName,
  LEDGER_PARTY_TYPES,
  getLedgerGroupType,
  getLedgerPartyMeta
} from '../constants/ledgerGroups.js';
import { getFileUrl } from '../utils/url';

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

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// Customer receipts come with unallocated_kind / unallocated_amount from the API (vendor payments don't)
const isReceiptRow = (row) => row?.unallocated_kind !== undefined;
const getUnallocatedAmount = (row) => (isReceiptRow(row) ? round2(row.unallocated_amount) : getOnAccountAmount(row));

// Part of a vendor payment recorded 'On Account' that is not yet tied to any bill
const getOnAccountAmount = (payment) => round2(
  (Array.isArray(payment?.allocations) ? payment.allocations : [])
    .filter(a => !a.po_id && !a.invoice_id && (a.allocation_type === 'On Account' || a.allocation_type === 'Advance'))
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
);

const RecordPaymentReceived = ({ initialVoucherType = 'RECEIPT' }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerCreditNotes, setCustomerCreditNotes] = useState([]);

  // Vendor State (for Payment Voucher / Sundry Creditors)
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [vendorInvoicesLoading, setVendorInvoicesLoading] = useState(false);
  const [vendorPaymentHistory, setVendorPaymentHistory] = useState([]);
  // On Account payment currently being allocated against bills (Edit Allocation dialog)
  const [allocateTarget, setAllocateTarget] = useState(null);
  const [allocateAmounts, setAllocateAmounts] = useState({});
  const [allocateSaving, setAllocateSaving] = useState(false);
  const [vendorHistoryLoading, setVendorHistoryLoading] = useState(false);
  const [vendorDebitNotes, setVendorDebitNotes] = useState([]);
  const [isProcessPaymentModalOpen, setIsProcessPaymentModalOpen] = useState(false);
  const [selectedVendorInvoice, setSelectedVendorInvoice] = useState(null);

  // Bill / PO Details Modal State
  const [selectedBillForDetail, setSelectedBillForDetail] = useState(null);
  const [billDetailLoading, setBillDetailLoading] = useState(false);
  const [billDetailData, setBillDetailData] = useState(null);

  // Bank Accounts State for Payment Ledger
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);

  // Tally-Style Payment Voucher Entry Screen State
  const [isVoucherEntryOpen, setIsVoucherEntryOpen] = useState(false);
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [paymentMode, setPaymentMode] = useState('NEFT');
  const [transactionRefNo, setTransactionRefNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [narration, setNarration] = useState('');
  const [voucherAllocations, setVoucherAllocations] = useState([]);
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);

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

  // Active View Tab: 'history' (Default) | 'invoices'
  const [activeViewTab, setActiveViewTab] = useState('history');

  // Step 1: Voucher Selection State
  const [selectedVoucherType, setSelectedVoucherType] = useState(initialVoucherType);

  // Step 2: Ledger Group Selection State (57 Official Ledger Groups)
  const [selectedLedgerGroup, setSelectedLedgerGroup] = useState(
    initialVoucherType === 'PAYMENT' ? DEFAULT_VENDOR_LEDGER_GROUP : DEFAULT_CUSTOMER_LEDGER_GROUP
  );

  // Cash and General Ledger Selection States
  const [selectedCashAccountId, setSelectedCashAccountId] = useState('');
  const [selectedGeneralLedgerId, setSelectedGeneralLedgerId] = useState('');

  // Journal Voucher Register State
  const [journalVouchersList, setJournalVouchersList] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);

  // Contra Voucher Register State
  const [contraVouchersList, setContraVouchersList] = useState([]);
  const [contraLoading, setContraLoading] = useState(false);

  // Dynamic Party / Entity Mapping based on selectedLedgerGroup
  const activePartyMeta = useMemo(() => {
    if (selectedLedgerGroup === 'ALL') {
      return selectedVoucherType === 'PAYMENT'
        ? getLedgerPartyMeta('Sundry Creditors')
        : getLedgerPartyMeta('Sundry Debtors');
    }
    return getLedgerPartyMeta(selectedLedgerGroup);
  }, [selectedLedgerGroup, selectedVoucherType]);

  const activePartyType = activePartyMeta.type;

  // Mode is payment/vendor if ledger group is SUPPLIER or voucher is PAYMENT
  const isPaymentMode = activePartyType === LEDGER_PARTY_TYPES.SUPPLIER || 
    (selectedVoucherType === 'PAYMENT' && activePartyType !== LEDGER_PARTY_TYPES.CUSTOMER);

  // ── 6 ACCOUNTING VOUCHERS ──
  const VOUCHER_OPTIONS = [
    {
      id: 'PAYMENT',
      name: 'Payment',
      shortcut: 'F5',
      icon: <Send className="w-4 h-4" />,
      desc: 'Vendor & supplier payments, operational...'
    },
    {
      id: 'RECEIPT',
      name: 'Receipt',
      shortcut: 'F6',
      icon: <ArrowLeft className="w-4 h-4" />,
      desc: 'Customer receipts against outstanding...'
    },
    {
      id: 'JOURNAL',
      name: 'Journal',
      shortcut: 'F7',
      icon: <BookOpen className="w-4 h-4" />,
      desc: 'General journal adjustments, depreciation...'
    },
    {
      id: 'CONTRA',
      name: 'Contra',
      shortcut: 'F4',
      icon: <ArrowLeftRight className="w-4 h-4" />,
      desc: 'Internal fund transfers between cash & bank...'
    },
    {
      id: 'DEBIT_NOTE',
      name: 'Debit Note',
      shortcut: 'Alt+F9',
      icon: <FileText className="w-4 h-4" />,
      desc: 'Debit notes for purchase returns, shortages...'
    },
    {
      id: 'CREDIT_NOTE',
      name: 'Credit Note',
      shortcut: 'Alt+F8',
      icon: <FilePlus className="w-4 h-4" />,
      desc: 'Credit notes for customer sales returns, rebates...'
    }
  ];

  // 1. Fetch Companies / Vendors / Bank Accounts on Load or when mode toggles
  useEffect(() => {
    fetchBankAccounts();
    fetchJournalVouchers();
    fetchContraVouchers();
    if (isPaymentMode) {
      fetchVendors();
    } else {
      fetchCompanies();
    }
  }, [isPaymentMode]);

  const fetchJournalVouchers = async () => {
    try {
      setJournalLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/payments/journal`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJournalVouchersList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching journal vouchers:', err);
    } finally {
      setJournalLoading(false);
    }
  };

  const fetchContraVouchers = async () => {
    try {
      setContraLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/payments/contra`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContraVouchersList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching contra vouchers:', err);
    } finally {
      setContraLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      setBankAccountsLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        const activeList = list.filter(b => b.is_active !== false && b.is_active !== 0);
        setBankAccounts(activeList);
        if (activeList.length > 0) {
          setSelectedBankAccountId(prev => prev || String(activeList[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    } finally {
      setBankAccountsLoading(false);
    }
  };

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

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  // 2. Fetch Invoices, Balance, and History when Customer or Month changes
  useEffect(() => {
    setSelectedInvoiceIds(new Set());
    if (!isPaymentMode) {
      if (selectedCompanyId) {
        const found = companies.find(c => String(c.id) === String(selectedCompanyId));
        setSelectedCompany(found || null);
        fetchCustomerInvoices(selectedCompanyId);
        fetchCustomerBalance(selectedCompanyId);
        fetchCustomerPaymentHistory(selectedCompanyId);
        fetchCustomerCreditNotes(selectedCompanyId);
        fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
      } else {
        setSelectedCompany(null);
        setInvoices([]);
        setBalanceData(null);
        setPaymentHistory([]);
        setCustomerCreditNotes([]);
        setMonthlySummary(null);
      }
    }
  }, [selectedCompanyId, companies, isPaymentMode]);

  // 3. Fetch Invoices and Payment History when Vendor changes (Payment Mode)
  useEffect(() => {
    setSelectedInvoiceIds(new Set());
    if (isPaymentMode) {
      if (selectedVendorId) {
        const found = vendors.find(v => String(v.id) === String(selectedVendorId));
        setSelectedVendor(found || null);
        fetchVendorInvoices(selectedVendorId);
        fetchVendorPayments(selectedVendorId);
        fetchVendorDebitNotes(selectedVendorId);
      } else {
        setSelectedVendor(null);
        setVendorInvoices([]);
        setVendorPaymentHistory([]);
        setVendorDebitNotes([]);
      }
    }
  }, [selectedVendorId, vendors, isPaymentMode]);

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

  const fetchCustomerCreditNotes = async (customerId) => {
    if (!customerId) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/customer-payments/credit-notes?customerId=${customerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerCreditNotes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching customer credit notes:', err);
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

  const fetchVendorInvoices = async (vendorId) => {
    if (!vendorId) return;
    try {
      setVendorInvoicesLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/vendor-invoices?vendorId=${vendorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendorInvoices(Array.isArray(data) ? data : []);
      } else {
        setVendorInvoices([]);
      }
    } catch (err) {
      console.error('Error fetching vendor invoices:', err);
      errorToast('Failed to load vendor invoices');
      setVendorInvoices([]);
    } finally {
      setVendorInvoicesLoading(false);
    }
  };

  const fetchVendorPayments = async (vendorId) => {
    if (!vendorId) return;
    try {
      setVendorHistoryLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/payments?vendorId=${vendorId}&status=CONFIRMED`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendorPaymentHistory(Array.isArray(data) ? data : []);
      } else {
        setVendorPaymentHistory([]);
      }
    } catch (err) {
      console.error('Error fetching vendor payment history:', err);
      setVendorPaymentHistory([]);
    } finally {
      setVendorHistoryLoading(false);
    }
  };

  const fetchVendorDebitNotes = async (vendorId) => {
    if (!vendorId) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/payments/debit-notes?vendorId=${vendorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendorDebitNotes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching vendor debit notes:', err);
    }
  };

  const openAllocateModal = (row) => {
    setAllocateAmounts({});
    setAllocateTarget(row);
  };

  const closeAllocateModal = () => {
    if (allocateSaving) return;
    setAllocateTarget(null);
    setAllocateAmounts({});
  };

  // "Full" toggles: fills as much of the bill as the unallocated amount allows; click again to clear
  const toggleFullAllocation = (bill) => {
    const others = round2(Object.entries(allocateAmounts)
      .filter(([id]) => String(id) !== String(bill.id))
      .reduce((sum, [, v]) => sum + (parseFloat(v) || 0), 0));
    const cap = round2(Math.min(round2(bill.outstanding), getUnallocatedAmount(allocateTarget) - others));
    if (cap <= 0) return;
    setAllocateAmounts(prev => (
      Math.abs((parseFloat(prev[bill.id]) || 0) - cap) < 0.005
        ? { ...prev, [bill.id]: '' }
        : { ...prev, [bill.id]: cap.toFixed(2) }
    ));
  };

  const handleSaveAllocation = async () => {
    if (!allocateTarget) return;
    const allocations = Object.entries(allocateAmounts)
      .map(([invoiceId, amount]) => ({ invoiceId: Number(invoiceId), amount: parseFloat(amount) || 0 }))
      .filter(a => a.amount > 0);
    if (allocations.length === 0) {
      errorToast('Enter an amount against at least one bill');
      return;
    }
    try {
      setAllocateSaving(true);
      const token = localStorage.getItem('authToken');
      const isReceipt = isReceiptRow(allocateTarget);
      const res = await fetch(`${API_BASE}/${isReceipt ? 'customer-payments' : 'payments'}/${allocateTarget.id}/allocate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to allocate payment');
      successToast(`${allocateTarget.payment_voucher_no || allocateTarget.payment_receipt_no} allocated: ${formatCurrency(data.data?.allocated)}`);
      setAllocateTarget(null);
      setAllocateAmounts({});
      if (isReceipt) {
        await Promise.all([
          fetchCustomerPaymentHistory(selectedCompanyId),
          fetchCustomerInvoices(selectedCompanyId),
          fetchCustomerBalance(selectedCompanyId),
          fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate)
        ]);
      } else {
        await Promise.all([fetchVendorPayments(selectedVendorId), fetchVendorInvoices(selectedVendorId)]);
      }
    } catch (err) {
      errorToast(err.message || 'Failed to allocate payment');
    } finally {
      setAllocateSaving(false);
    }
  };

  const handleLedgerGroupChange = (newGroupName) => {
    const oldType = activePartyType;
    const newType = (newGroupName === 'ALL')
      ? (selectedVoucherType === 'PAYMENT' ? LEDGER_PARTY_TYPES.SUPPLIER : LEDGER_PARTY_TYPES.CUSTOMER)
      : getLedgerGroupType(newGroupName);

    setSelectedLedgerGroup(newGroupName);

    // When the ledger group changes, clear the previous incompatible selection!
    if (oldType !== newType) {
      if (oldType === LEDGER_PARTY_TYPES.CUSTOMER || newType !== LEDGER_PARTY_TYPES.CUSTOMER) {
        setSelectedCompanyId('');
        setSelectedCompany(null);
        setInvoices([]);
        setBalanceData(null);
        setPaymentHistory([]);
        setSelectedInvoiceIds(new Set());
      }
      if (oldType === LEDGER_PARTY_TYPES.SUPPLIER || newType !== LEDGER_PARTY_TYPES.SUPPLIER) {
        setSelectedVendorId('');
        setSelectedVendor(null);
        setVendorInvoices([]);
        setVendorPaymentHistory([]);
      }
      if (oldType === LEDGER_PARTY_TYPES.BANK || newType !== LEDGER_PARTY_TYPES.BANK) {
        setSelectedBankAccountId('');
      }
      if (oldType === LEDGER_PARTY_TYPES.CASH || newType !== LEDGER_PARTY_TYPES.CASH) {
        setSelectedCashAccountId('');
      }
      if (oldType === LEDGER_PARTY_TYPES.GENERAL || newType !== LEDGER_PARTY_TYPES.GENERAL) {
        setSelectedGeneralLedgerId('');
      }

      // Pre-fetch data for the newly selected type
      if (newType === LEDGER_PARTY_TYPES.SUPPLIER) {
        if (vendors.length === 0) fetchVendors();
      } else if (newType === LEDGER_PARTY_TYPES.CUSTOMER) {
        if (companies.length === 0) fetchCompanies();
      } else if (newType === LEDGER_PARTY_TYPES.BANK) {
        if (bankAccounts.length === 0) fetchBankAccounts();
      }
    }
  };

  const handleSelectVoucherType = (typeId) => {
    setSelectedVoucherType(typeId);
    setSelectedInvoiceIds(new Set());
    if (typeId === 'PAYMENT') {
      handleLedgerGroupChange(DEFAULT_VENDOR_LEDGER_GROUP);
      if (vendors.length === 0) fetchVendors();
    } else if (typeId === 'RECEIPT') {
      handleLedgerGroupChange(DEFAULT_CUSTOMER_LEDGER_GROUP);
      if (companies.length === 0) fetchCompanies();
    } else if (typeId === 'CONTRA') {
      handleLedgerGroupChange('Bank Accounts');
      if (bankAccounts.length === 0) fetchBankAccounts();
      fetchContraVouchers();
    }
  };

  // Synchronize initialVoucherType prop when navigation/route changes
  useEffect(() => {
    if (initialVoucherType) {
      handleSelectVoucherType(initialVoucherType);
    }
  }, [initialVoucherType]);

  // Keyboard shortcut listener for Accounting Voucher types (F5, F6, F7, F4, Alt+F9, Alt+F8)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        handleSelectVoucherType('PAYMENT');
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleSelectVoucherType('RECEIPT');
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleSelectVoucherType('JOURNAL');
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleSelectVoucherType('CONTRA');
      } else if (e.altKey && (e.key === 'F9' || e.key === 'f9')) {
        e.preventDefault();
        handleSelectVoucherType('DEBIT_NOTE');
      } else if (e.altKey && (e.key === 'F8' || e.key === 'f8')) {
        e.preventDefault();
        handleSelectVoucherType('CREDIT_NOTE');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefreshAll = () => {
    fetchBankAccounts();
    fetchJournalVouchers();
    fetchContraVouchers();
    if (isPaymentMode) {
      fetchVendors();
      if (selectedVendorId) {
        fetchVendorInvoices(selectedVendorId);
        fetchVendorPayments(selectedVendorId);
        fetchVendorDebitNotes(selectedVendorId);
      }
    } else {
      fetchCompanies();
      if (selectedCompanyId) {
        fetchCustomerInvoices(selectedCompanyId);
        fetchCustomerBalance(selectedCompanyId);
        fetchCustomerPaymentHistory(selectedCompanyId);
        fetchCustomerCreditNotes(selectedCompanyId);
        fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
      }
    }
  };

  // Temporarily restricted to 3 options: 1. Sundry Creditors, 2. Bank Accounts, 3. Sundry Debtors
  const ledgerGroupOptions = useMemo(() => {
    const allowed = ['Sundry Creditors', 'Bank Accounts', 'Sundry Debtors'];
    const orderMap = { 'Sundry Creditors': 1, 'Bank Accounts': 2, 'Sundry Debtors': 3 };

    return LEDGER_GROUPS
      .filter(g => allowed.includes(g.name))
      .sort((a, b) => (orderMap[a.name] || 99) - (orderMap[b.name] || 99))
      .map(g => ({
        value: g.name,
        label: `${g.id}. ${g.name}`,
        sublabel: `Category: ${g.category}`
      }));
  }, []);

  // Options for SearchableSelect
  const companyOptions = useMemo(() => {
    return companies.map(c => ({
      value: String(c.id),
      label: c.company_name || 'Unnamed Company',
      sublabel: [c.gstin ? `GSTIN: ${c.gstin}` : '', c.city].filter(Boolean).join(' • ')
    }));
  }, [companies]);

  // Vendor Options for SearchableSelect
  const vendorOptions = useMemo(() => {
    return vendors.map(v => ({
      value: String(v.id),
      label: v.vendor_name || 'Unnamed Vendor',
      sublabel: [v.vendor_code ? `Code: ${v.vendor_code}` : '', v.location, v.gstin ? `GST: ${v.gstin}` : ''].filter(Boolean).join(' • ')
    }));
  }, [vendors]);

  // Bank Account Options
  const bankAccountOptions = useMemo(() => {
    if (bankAccounts.length === 0) {
      return [
        { value: 'SBI_CURRENT', label: 'SBI Current Account', sublabel: 'A/c: 38291048291 • State Bank of India' },
        { value: 'HDFC_CURRENT', label: 'HDFC Bank Current Account', sublabel: 'A/c: 50200029381 • HDFC Bank' },
        { value: 'ICICI_CURRENT', label: 'ICICI Bank Current A/c', sublabel: 'A/c: 00120501829 • ICICI Bank' },
      ];
    }
    return bankAccounts.map(b => ({
      value: String(b.id),
      label: b.bank_name ? `${b.bank_name} - ${b.account_type || 'Current'}` : (b.account_name || 'Bank Account'),
      sublabel: [
        b.account_number ? `A/c: ${b.account_number}` : '',
        `Bal: ${formatCurrency(b.current_balance ?? b.total_balance ?? b.opening_balance)}`,
        b.total_credits ? `Cr: +${formatCurrency(b.total_credits)}` : '',
        b.total_debits ? `Dr: -${formatCurrency(b.total_debits)}` : ''
      ].filter(Boolean).join(' • ')
    }));
  }, [bankAccounts]);

  // Cash Account Options
  const cashAccountOptions = useMemo(() => [
    { value: 'CASH_MAIN', label: 'Cash in Hand (Main Till)', sublabel: 'Ledger: Cash Account • Assets' },
    { value: 'PETTY_CASH', label: 'Petty Cash Ledger', sublabel: 'Ledger: Daily Office & Workshop Petty Cash' },
    { value: 'CASH_REGISTER_1', label: 'Counter Cash Register', sublabel: 'Ledger: Front Office Cash' },
  ], []);

  // General Ledger Options (57 Master Chart of Accounts Groups)
  const generalLedgerOptions = useMemo(() => {
    return LEDGER_GROUPS.map(g => ({
      value: String(g.id),
      label: `${g.id}. ${g.name}`,
      sublabel: `Category: ${g.category} • Chart of Accounts`
    }));
  }, []);

  // Filter for Vendor Bills (ALL / PENDING / PAID)
  const [billFilterStatus, setBillFilterStatus] = useState('ALL');

  const pendingBillsCount = useMemo(() => {
    return vendorInvoices.filter(inv => parseFloat(inv.outstanding || 0) > 0).length;
  }, [vendorInvoices]);

  const paidBillsCount = useMemo(() => {
    return vendorInvoices.filter(inv => parseFloat(inv.outstanding || 0) <= 0).length;
  }, [vendorInvoices]);

  // Displayed Vendor Invoices (supports Status and Date-wise filter)
  const displayedVendorInvoices = useMemo(() => {
    let list = vendorInvoices;
    if (billFilterStatus === 'PENDING') {
      list = list.filter(inv => parseFloat(inv.outstanding || 0) > 0);
    } else if (billFilterStatus === 'PAID') {
      list = list.filter(inv => parseFloat(inv.outstanding || 0) <= 0);
    }

    if (!applyDateFilterToTable || !fromDate || !toDate) {
      return list;
    }
    return list.filter(inv => {
      const d = (inv.bill_date || inv.invoice_date || inv.po_date || inv.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }, [vendorInvoices, billFilterStatus, applyDateFilterToTable, fromDate, toDate]);

  // Vendor-specific Journal Rows to display in payment history table
  const vendorJournalRows = useMemo(() => {
    if (!selectedVendor) return [];
    const vName = (selectedVendor.vendor_name || '').toLowerCase();
    const vId = String(selectedVendor.id || '');

    return journalVouchersList
      .filter(jv => {
        const items = Array.isArray(jv.items) ? jv.items : [];
        const hasVendor = items.some(it => {
          const acc = (it.ledger_account || '').toLowerCase();
          return acc.includes(vName) || acc.includes(`vendor:${vId}`) || (jv.narration && jv.narration.toLowerCase().includes(vName));
        });
        return hasVendor;
      })
      .map(jv => {
        const items = Array.isArray(jv.items) ? jv.items : [];
        const vendorItem = items.find(it => {
          const acc = (it.ledger_account || '').toLowerCase();
          return acc.includes(vName) || acc.includes(`vendor:${vId}`);
        }) || items[0] || {};

        const drAmt = parseFloat(jv.total_debit) || parseFloat(vendorItem.debit_amount) || 959.82;
        const crAmt = parseFloat(jv.total_credit) || 959.82;

        return {
          id: `jv_${jv.id}`,
          is_journal: true,
          voucher_type: 'JOURNAL',
          entry_type: 'JOURNAL',
          payment_date: (jv.voucher_date || jv.created_at || '').slice(0, 10),
          voucher_date: (jv.voucher_date || jv.created_at || '').slice(0, 10),
          created_at: jv.created_at,
          payment_voucher_no: jv.voucher_no,
          voucher_no: jv.voucher_no,
          particulars_title: `${selectedVendor.vendor_name} – Discount Adjustment`,
          narration: jv.narration && jv.narration !== 'okk' ? jv.narration : 'Discount Adjustment',
          payment_amount: drAmt,
          debit_amount: drAmt,
          credit_amount: crAmt,
          total_debit: drAmt,
          total_credit: crAmt,
          items: jv.items
        };
      });
  }, [journalVouchersList, selectedVendor]);

  // Combined Vendor Payment History (Preserves existing payments, adds journal vouchers)
  const combinedVendorPaymentHistory = useMemo(() => {
    const payments = (vendorPaymentHistory || []).map(p => ({
      ...p,
      is_journal: false,
      voucher_type: 'PAYMENT'
    }));

    // Posted debit notes reduce the supplier payable (supplier account debited)
    const debitNoteRows = vendorDebitNotes
      .filter(dn => dn.status === 'POSTED')
      .map(dn => ({
        id: `dn_${dn.id}`,
        is_debit_note: true,
        voucher_type: 'DEBIT_NOTE',
        payment_date: String(dn.voucher_date || dn.created_at || '').slice(0, 10),
        voucher_date: String(dn.voucher_date || dn.created_at || '').slice(0, 10),
        created_at: dn.created_at,
        voucher_no: dn.voucher_no,
        payment_voucher_no: dn.voucher_no,
        particulars_title: `${dn.vendor_name} – ${dn.reason_label || 'Debit Note'}`,
        reference_invoice_no: dn.reference_invoice_no,
        narration: dn.narration,
        payment_amount: parseFloat(dn.total_amount) || 0,
        debit_amount: parseFloat(dn.total_amount) || 0
      }));

    return [...payments, ...vendorJournalRows, ...debitNoteRows];
  }, [vendorPaymentHistory, vendorJournalRows, vendorDebitNotes]);

  // Displayed Vendor Payment History
  const displayedVendorPaymentHistory = useMemo(() => {
    if (historyFilterMode === 'all' || !fromDate || !toDate) {
      return combinedVendorPaymentHistory;
    }
    return combinedVendorPaymentHistory.filter(p => {
      const d = (p.payment_date || p.voucher_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }, [combinedVendorPaymentHistory, historyFilterMode, fromDate, toDate]);

  const vendorHistoryPeriodCount = useMemo(() => {
    if (!fromDate || !toDate) return combinedVendorPaymentHistory.length;
    return combinedVendorPaymentHistory.filter(p => {
      const d = (p.payment_date || p.voucher_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    }).length;
  }, [combinedVendorPaymentHistory, fromDate, toDate]);


  // Calculate vendor-specific Journal Debit adjustments (e.g. discounts received)
  const vendorJournalDebit = useMemo(() => {
    if (!selectedVendor) return 0;
    const vName = (selectedVendor.vendor_name || '').toLowerCase();
    const vId = String(selectedVendor.id);
    return journalVouchersList.reduce((sum, jv) => {
      const items = Array.isArray(jv.items) ? jv.items : [];
      const match = items.find(it => {
        const acc = (it.ledger_account || '').toLowerCase();
        return (acc.includes(vName) || acc.includes(`vendor:${vId}`)) && parseFloat(it.debit_amount) > 0;
      });
      return sum + (match ? parseFloat(match.debit_amount) : 0);
    }, 0);
  }, [journalVouchersList, selectedVendor]);

  // Vendor aggregate stats
  const vendorStats = useMemo(() => {
    const totalInvoiced = vendorInvoices.reduce((sum, inv) => {
      const bAmt = parseFloat(inv.bill_amount) || (parseFloat(inv.invoice_amount) > 0 ? parseFloat(inv.invoice_amount) : parseFloat(inv.po_amount)) || 0;
      return sum + bAmt;
    }, 0);
    const totalReceived = vendorInvoices.reduce((sum, inv) => sum + (parseFloat(inv.already_paid) || 0), 0);
    // Posted debit notes against these bills also reduce the payable
    const totalDebitNotes = vendorInvoices.reduce((sum, inv) => sum + (parseFloat(inv.debit_note_amount) || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalReceived - vendorJournalDebit - totalDebitNotes);
    const pendingCount = vendorInvoices.filter(inv => {
      const out = (parseFloat(inv.outstanding) || 0) - vendorJournalDebit;
      return out > 0;
    }).length;
    const progress = totalInvoiced > 0 ? Math.round(((totalReceived + vendorJournalDebit) / totalInvoiced) * 100) : 0;
    return {
      totalInvoiced,
      totalReceived,
      totalOutstanding,
      pendingCount,
      allCount: vendorInvoices.length,
      progress,
      vendorJournalDebit
    };
  }, [vendorInvoices, vendorJournalDebit]);

  // Vendor Monthly Reconciliation Summary
  const vendorMonthlySummary = useMemo(() => {
    if (!selectedVendorId) return null;
    const getBillAmt = (inv) => parseFloat(inv.bill_amount) || (parseFloat(inv.invoice_amount) > 0 ? parseFloat(inv.invoice_amount) : parseFloat(inv.po_amount)) || 0;

    const priorBills = vendorInvoices
      .filter(inv => (inv.bill_date || inv.invoice_date || inv.po_date || inv.created_at || '').slice(0, 10) < fromDate)
      .reduce((sum, inv) => sum + getBillAmt(inv), 0);
    const priorPaid = vendorPaymentHistory
      .filter(p => (p.payment_date || p.created_at || '').slice(0, 10) < fromDate)
      .reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);
    const openingBalance = Math.max(0, priorBills - priorPaid);

    const curBills = vendorInvoices
      .filter(inv => {
        const d = (inv.bill_date || inv.invoice_date || inv.po_date || inv.created_at || '').slice(0, 10);
        return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      })
      .reduce((sum, inv) => sum + getBillAmt(inv), 0);

    const curPaid = vendorPaymentHistory
      .filter(p => {
        const d = (p.payment_date || p.created_at || '').slice(0, 10);
        return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      })
      .reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

    const closingBalance = Math.max(0, openingBalance + curBills - curPaid - vendorJournalDebit);

    let formattedMonth = 'October 2026';
    if (selectedMonth) {
      try {
        const [y, m] = selectedMonth.split('-');
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        formattedMonth = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } catch {
        formattedMonth = selectedMonth;
      }
    }

    return {
      openingBalance,
      currentMonthInvoices: curBills,
      currentMonthPayments: curPaid,
      closingBalance,
      vendorJournalDebit,
      monthName: formattedMonth
    };
  }, [vendorInvoices, vendorPaymentHistory, selectedVendorId, fromDate, toDate, selectedMonth, vendorJournalDebit]);

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

  // Customer receipts + posted credit notes (credit notes also reduce the customer receivable)
  // Journal vouchers that credit the selected customer (e.g. Discount Allowed). Ledger lines are
  // stored as 'Sundry Debtors (Customers) (<customer name>)'.
  const customerJournalRows = useMemo(() => {
    const cName = (selectedCompany?.company_name || '').trim().toLowerCase();
    if (!cName) return [];
    return journalVouchersList.flatMap(jv => {
      const items = Array.isArray(jv.items) ? jv.items : [];
      const partyLine = items.find(it => {
        const acc = (it.ledger_account || '').toLowerCase();
        return (acc.includes('sundry debtors') || acc.includes('customer')) && acc.includes(cName);
      });
      if (!partyLine) return [];
      const amount = (parseFloat(partyLine.credit_amount) || 0) - (parseFloat(partyLine.debit_amount) || 0);
      if (amount <= 0) return [];
      const discountLine = items.find(it => it !== partyLine && /discount/i.test(it.ledger_account || ''));
      return [{
        id: `jv_${jv.id}`,
        is_journal: true,
        payment_date: String(jv.voucher_date || jv.created_at || '').slice(0, 10),
        created_at: jv.created_at,
        receipt_number: jv.voucher_no,
        bank_name: discountLine?.ledger_account || 'Discount Allowed (Expenses)',
        payment_mode: 'JOURNAL_ENTRY',
        payment_amount: amount,
        remarks: jv.narration && jv.narration !== 'okk' ? jv.narration : 'Discount Adjustment',
        raw: jv
      }];
    });
  }, [journalVouchersList, selectedCompany]);

  // Discount journals dated inside the statement period (listed under Current Total)
  const periodJournalRows = useMemo(() => customerJournalRows.filter(r =>
    (!fromDate || r.payment_date >= fromDate) && (!toDate || r.payment_date <= toDate)
  ), [customerJournalRows, fromDate, toDate]);

  const combinedPaymentHistory = useMemo(() => {
    const creditNoteRows = customerCreditNotes
      .filter(cn => cn.status === 'POSTED')
      .map(cn => ({
        id: `cn_${cn.id}`,
        is_credit_note: true,
        payment_date: String(cn.voucher_date || cn.created_at || '').slice(0, 10),
        created_at: cn.created_at,
        receipt_number: cn.voucher_no,
        bank_name: `Credit Note – ${cn.reason_label || 'Sales Return'}`,
        payment_mode: 'CREDIT_NOTE',
        invoice_no: cn.reference_invoice_no || 'On Account',
        payment_amount: cn.total_amount,
        remarks: cn.narration,
        raw: cn
      }));
    return [...paymentHistory, ...creditNoteRows, ...customerJournalRows].sort((a, b) => {
      const da = String(a.payment_date || a.created_at || '');
      const db = String(b.payment_date || b.created_at || '');
      if (db !== da) return db.localeCompare(da);
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }, [paymentHistory, customerCreditNotes, customerJournalRows]);

  // Displayed Payment History (by default applies active month/period filter, e.g. Oct 2026)
  const displayedPaymentHistory = useMemo(() => {
    if (historyFilterMode === 'all' || !fromDate || !toDate) {
      return combinedPaymentHistory;
    }
    return combinedPaymentHistory.filter(p => {
      const d = (p.payment_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    });
  }, [combinedPaymentHistory, historyFilterMode, fromDate, toDate]);

  const historyPeriodCount = useMemo(() => {
    if (!fromDate || !toDate) return combinedPaymentHistory.length;
    return combinedPaymentHistory.filter(p => {
      const d = (p.payment_date || p.created_at || '').slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    }).length;
  }, [combinedPaymentHistory, fromDate, toDate]);

  // Aggregate stats for selected customer
  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
    const totalReceived = invoices.reduce((sum, inv) => sum + (parseFloat(inv.paid_amount) || 0), 0);
    // Invoice outstanding already deducts posted credit notes; credited = total − received − outstanding
    const totalCreditNotes = invoices.reduce((sum, inv) => {
      const credited = (parseFloat(inv.total_amount) || 0) - (parseFloat(inv.paid_amount) || 0) - (parseFloat(inv.outstanding) || 0);
      return sum + Math.max(0, credited);
    }, 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalReceived - totalCreditNotes);
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
    customer_po_no: row.customer_po_no || row.po_no || row.po_number || row.client_po_no || '',
    po_number: row.customer_po_no || row.po_no || row.po_number || row.client_po_no || row.invoice_no || row.so_number,
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
    if (isPaymentMode || selectedVendorId) {
      handleProceedToVendorPayment(null);
      return;
    }
    if (selectedInvoiceIds.size > 0) {
      const formattedList = displayedInvoices
        .filter(inv => selectedInvoiceIds.has(inv.id))
        .map(formatInvoiceForModal);
      setSelectedInvoicesForModal(formattedList);
      setSelectedInvoice(formattedList.length === 1 ? formattedList[0] : null);
    } else if (selectedCompanyId) {
      // If 0 invoices were checked, automatically populate all pending invoices of the company
      const pendingInvoices = displayedInvoices
        .filter(inv => (parseFloat(inv.outstanding) || 0) > 0)
        .map(formatInvoiceForModal);
      const listToLoad = pendingInvoices.length > 0 ? pendingInvoices : displayedInvoices.map(formatInvoiceForModal);
      setSelectedInvoicesForModal(listToLoad);
      setSelectedInvoice(listToLoad.length === 1 ? listToLoad[0] : null);
    } else {
      setSelectedInvoicesForModal([]);
      setSelectedInvoice(null);
    }
    setIsPaymentModalOpen(true);
  };

  // Format vendor bill payload for PaymentReceivedModal
  const formatVendorBillForModal = (row) => {
    const totalAmt = parseFloat(row.bill_amount) || (parseFloat(row.invoice_amount) > 0 ? parseFloat(row.invoice_amount) : parseFloat(row.po_amount)) || (parseFloat(row.total_amount) || 0);
    const outAmt = parseFloat(row.outstanding) > 0 ? parseFloat(row.outstanding) : totalAmt;
    const invNo = row.display_invoice_no || row.vendor_invoice_no || row.po_number || (row.id ? `BILL-${row.id}` : 'BILL');
    const poNo = row.po_number || '';
    return {
      ...row,
      id: row.id,
      vendor_id: row.vendor_id || selectedVendorId,
      vendor_name: row.vendor_name || selectedVendor?.vendor_name,
      company_name: row.vendor_name || selectedVendor?.vendor_name,
      customer_name: row.vendor_name || selectedVendor?.vendor_name,
      invoice_no: invNo,
      display_invoice_no: invNo,
      customer_po_no: poNo,
      po_number: poNo,
      invoice_date: row.bill_date || row.invoice_date || row.po_date || row.created_at,
      due_date: row.due_date || row.bill_date || row.invoice_date,
      outstanding: outAmt,
      total_amount: totalAmt,
      paid_amount: Math.max(0, totalAmt - outAmt),
      dr_cr: 'Cr'
    };
  };

  // Open full modal for Vendor Payment / Journal voucher
  const handleProceedToVendorPayment = (singleRow = null) => {
    if (!selectedVendorId) {
      errorToast('Please select a vendor first');
      return;
    }
    if (selectedVoucherType === 'RECEIPT') {
      setSelectedVoucherType('PAYMENT');
    }
    let listToLoad = [];
    if (singleRow) {
      listToLoad = [formatVendorBillForModal(singleRow)];
    } else {
      // All bills, including fully paid ones (shown with 0 outstanding)
      listToLoad = displayedVendorInvoices.map(formatVendorBillForModal);
    }
    setSelectedInvoicesForModal(listToLoad);
    setSelectedInvoice(listToLoad.length === 1 ? listToLoad[0] : null);
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

  // Customer Payment History Columns (Standard Clean Tally Voucher Register Format)
  const historyColumns = [
    {
      label: 'Voucher Date',
      key: 'payment_date',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 text-slate-700 whitespace-nowrap text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(val)}</span>
        </div>
      )
    },
    {
      label: 'Particulars',
      key: 'particulars',
      sortable: true,
      render: (_, row) => {
        const chequeNo = row.cheque_number || (row.remarks?.match(/Cheque No:\s*([^\s,;\]]+)/i)?.[1]);
        const chequeBank = row.cheque_bank_name || (row.remarks?.match(/Cheque Bank:\s*([^|,;\[\]\n]+)/i)?.[1]?.trim());
        const bankName = row.bank_name 
          || row.manual_bank_account 
          || row.remarks?.match(/Bank:\s*([^|,;\[\]\n]+)/i)?.[1]?.trim()
          || (row.payment_mode === 'CASH' ? 'Cash Account' : 'Bank Account');
        const refNo = row.transaction_ref_no;
        const invNo = row.invoice_no || row.so_number || (row.remarks?.match(/\[Agst Ref:\s*([^\]]+)\]/i)?.[1]) || (row.remarks?.match(/\[Bill:\s*([^\]]+)\]/i)?.[1]);

        // Clean user remarks: remove redundant auto-generated "Cheque No: 12345" and "[Bill: ...]" strings
        let cleanRemarks = (row.remarks || '').trim();
        if (chequeNo) {
          cleanRemarks = cleanRemarks.replace(new RegExp(`Cheque No:\\s*${chequeNo}(\\s*\\([^)]*\\))?`, 'ig'), '').trim();
        }
        cleanRemarks = cleanRemarks.replace(/\[(Bill|Ref|Agst Ref):[^\]]+\]/ig, '').trim();
        cleanRemarks = cleanRemarks.replace(/^Payment against[^\n]*/i, '').trim();
        cleanRemarks = cleanRemarks.replace(/^[,;.\-\s]+|[,;.\-\s]+$/g, '').trim();

        return (
          <div className="flex flex-col gap-1 py-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-xs">
                {bankName}
              </span>
              {row.payment_mode && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 uppercase tracking-wide">
                  {row.payment_mode.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              {invNo && (
                <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                  Agst Ref: {invNo}
                </span>
              )}
              {chequeNo && (
                <span className="font-mono text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Chq #{chequeNo}{chequeBank ? ` (${chequeBank})` : ''}
                </span>
              )}
              {!chequeNo && refNo && (
                <span className="font-mono text-slate-600 text-[10.5px] bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200">
                  Ref: {refNo}
                </span>
              )}
              {cleanRemarks && (
                <span className="text-[10.5px] text-slate-500 italic max-w-md truncate" title={cleanRemarks}>
                  {cleanRemarks}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      label: 'Voucher Type',
      key: 'voucher_type',
      sortable: true,
      render: (_, row) => (
        row.is_credit_note ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs">
            Credit Note
          </span>
        ) : row.is_journal ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
            Journal
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            Receipt
          </span>
        )
      )
    },
    {
      label: 'Voucher No.',
      key: 'receipt_number',
      sortable: true,
      render: (val, row) => {
        const vNo = row.receipt_number || val || `PR-${row.id}`;
        return (
          <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100/70 px-2 py-0.5 rounded border border-slate-200/80">
            {vNo}
          </span>
        );
      }
    },
    {
      label: 'Debit (₹)',
      key: 'debit',
      sortable: true,
      className: 'text-right',
      render: (_, row) => (
        (row.is_credit_note || row.is_journal) ? (
          <div className="text-right whitespace-nowrap">
            <span className="font-mono text-xs font-bold text-rose-700">
              {formatCurrency(parseFloat(row.payment_amount) || 0)}
            </span>
            <span className="text-[10px] text-rose-600 font-semibold ml-1">Dr</span>
          </div>
        ) : (
          <div className="text-right whitespace-nowrap text-slate-400 font-mono text-xs font-medium">
            —
          </div>
        )
      )
    },
    {
      label: 'Credit (₹)',
      key: 'credit',
      sortable: true,
      className: 'text-right',
      render: (_, row) => {
        if (row.is_credit_note || row.is_journal) {
          return (
            <div className="text-right whitespace-nowrap text-slate-400 font-mono text-xs font-medium">
              —
            </div>
          );
        }
        const amt = parseFloat(row.payment_amount) || 0;
        return (
          <div className="text-right whitespace-nowrap">
            <span className="font-mono text-xs font-bold text-emerald-700">
              {formatCurrency(amt)}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold ml-1">Cr</span>
          </div>
        );
      }
    },
    {
      label: 'Action',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        row.is_credit_note ? (
          <span className="text-[10px] text-slate-400 font-semibold pr-1.5">Print in Credit Note</span>
        ) : row.is_journal ? (
          <span className="text-[10px] text-slate-400 font-semibold pr-1.5">Journal Voucher</span>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {getUnallocatedAmount(row) > 0 && (
              <button
                type="button"
                onClick={() => openAllocateModal(row)}
                className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                title={`${formatCurrency(getUnallocatedAmount(row))} is ${row.unallocated_kind} – allocate it against an invoice`}
              >
                Edit Allocation
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDownloadReceipt(row.id, row.receipt_number)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              title="Download Receipt PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )
      )
    }
  ];

  // Total allocated amount across all bill references
  const totalVoucherAmount = useMemo(() => {
    return voucherAllocations.reduce((sum, item) => sum + (parseFloat(item.settlement_amount) || 0), 0);
  }, [voucherAllocations]);

  // Handle opening Tally-style vendor payment voucher entry screen
  const handleOpenVendorPayment = (row = null) => {
    if (!selectedVendorId) {
      errorToast('Please select a vendor first');
      return;
    }

    const yr = new Date().getFullYear();
    const count = (vendorPaymentHistory.length || 0) + 1;
    setVoucherNo(`PAY-${yr}-${String(count).padStart(4, '0')}`);
    setVoucherDate(new Date().toISOString().split('T')[0]);
    if (bankAccounts.length > 0 && !selectedBankAccountId) {
      setSelectedBankAccountId(bankAccounts[0].id);
    }
    setNarration('');
    setTransactionRefNo('');
    setChequeDate('');
    setPaymentMode('NEFT');

    if (row) {
      const bAmt = parseFloat(row.bill_amount) || (parseFloat(row.invoice_amount) > 0 ? parseFloat(row.invoice_amount) : parseFloat(row.po_amount)) || 0;
      const pAmt = parseFloat(row.outstanding) > 0 ? parseFloat(row.outstanding) : bAmt;
      const refNo = row.display_invoice_no || row.vendor_invoice_no || row.po_number || (row.id ? `BILL-${row.id}` : 'Bill');

      setVoucherAllocations([
        {
          id: Date.now(),
          type: 'Agst Ref',
          bill_id: row.id,
          po_id: row.po_id || row.id,
          ref_no: refNo,
          bill_date: (row.bill_date || row.invoice_date || row.po_date || new Date().toISOString()).slice(0, 10),
          bill_amount: bAmt,
          pending_amount: pAmt,
          settlement_amount: pAmt
        }
      ]);
    } else {
      const pendingBills = vendorInvoices.filter(b => parseFloat(b.outstanding || 0) > 0);
      const firstBill = pendingBills.length > 0 ? pendingBills[0] : vendorInvoices[0];

      if (firstBill) {
        const bAmt = parseFloat(firstBill.bill_amount) || (parseFloat(firstBill.invoice_amount) > 0 ? parseFloat(firstBill.invoice_amount) : parseFloat(firstBill.po_amount)) || 0;
        const pAmt = parseFloat(firstBill.outstanding) > 0 ? parseFloat(firstBill.outstanding) : bAmt;
        const refNo = firstBill.display_invoice_no || firstBill.vendor_invoice_no || firstBill.po_number || `BILL-${firstBill.id}`;

        setVoucherAllocations([
          {
            id: Date.now(),
            type: 'Agst Ref',
            bill_id: firstBill.id,
            po_id: firstBill.po_id || firstBill.id,
            ref_no: refNo,
            bill_date: (firstBill.bill_date || firstBill.invoice_date || firstBill.po_date || new Date().toISOString()).slice(0, 10),
            bill_amount: bAmt,
            pending_amount: pAmt,
            settlement_amount: pAmt
          }
        ]);
      } else {
        setVoucherAllocations([
          {
            id: Date.now(),
            type: 'On Account',
            bill_id: null,
            po_id: null,
            ref_no: 'On Account',
            bill_date: new Date().toISOString().split('T')[0],
            bill_amount: 0,
            pending_amount: 0,
            settlement_amount: 0
          }
        ]);
      }
    }

    setIsVoucherEntryOpen(true);
  };

  // Add a new reference row in voucher entry
  const handleAddAllocationRow = () => {
    const allocatedBillIds = new Set(voucherAllocations.map(a => a.bill_id).filter(Boolean));
    const nextUnallocatedBill = vendorInvoices.find(b => !allocatedBillIds.has(b.id) && parseFloat(b.outstanding || 0) > 0);

    if (nextUnallocatedBill) {
      const bAmt = parseFloat(nextUnallocatedBill.bill_amount) || (parseFloat(nextUnallocatedBill.invoice_amount) > 0 ? parseFloat(nextUnallocatedBill.invoice_amount) : parseFloat(nextUnallocatedBill.po_amount)) || 0;
      const pAmt = parseFloat(nextUnallocatedBill.outstanding) > 0 ? parseFloat(nextUnallocatedBill.outstanding) : bAmt;
      const refNo = nextUnallocatedBill.display_invoice_no || nextUnallocatedBill.vendor_invoice_no || nextUnallocatedBill.po_number || `BILL-${nextUnallocatedBill.id}`;

      setVoucherAllocations(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: 'Agst Ref',
          bill_id: nextUnallocatedBill.id,
          po_id: nextUnallocatedBill.po_id || nextUnallocatedBill.id,
          ref_no: refNo,
          bill_date: (nextUnallocatedBill.bill_date || nextUnallocatedBill.invoice_date || nextUnallocatedBill.po_date || new Date().toISOString()).slice(0, 10),
          bill_amount: bAmt,
          pending_amount: pAmt,
          settlement_amount: pAmt
        }
      ]);
    } else {
      setVoucherAllocations(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: 'New Ref',
          bill_id: null,
          po_id: null,
          ref_no: `NEW-REF-${Date.now().toString().slice(-4)}`,
          bill_date: new Date().toISOString().split('T')[0],
          bill_amount: 0,
          pending_amount: 0,
          settlement_amount: 0
        }
      ]);
    }
  };

  // Remove a reference row
  const handleRemoveAllocationRow = (rowId) => {
    if (voucherAllocations.length <= 1) {
      errorToast('At least one reference row is required');
      return;
    }
    setVoucherAllocations(prev => prev.filter(r => r.id !== rowId));
  };

  // Change reference type
  const handleAllocationTypeChange = (rowId, newType) => {
    setVoucherAllocations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (newType === 'Agst Ref') {
        const firstBill = vendorInvoices.find(b => parseFloat(b.outstanding || 0) > 0) || vendorInvoices[0];
        const bAmt = parseFloat(firstBill?.bill_amount) || (parseFloat(firstBill?.invoice_amount) > 0 ? parseFloat(firstBill?.invoice_amount) : parseFloat(firstBill?.po_amount)) || 0;
        const pAmt = parseFloat(firstBill?.outstanding) > 0 ? parseFloat(firstBill?.outstanding) : bAmt;
        const refNo = firstBill?.display_invoice_no || firstBill?.vendor_invoice_no || firstBill?.po_number || '';
        return {
          ...row,
          type: newType,
          bill_id: firstBill?.id || null,
          po_id: firstBill?.po_id || null,
          ref_no: refNo,
          bill_date: (firstBill?.bill_date || firstBill?.invoice_date || new Date().toISOString()).slice(0, 10),
          bill_amount: bAmt,
          pending_amount: pAmt,
          settlement_amount: pAmt
        };
      } else {
        return {
          ...row,
          type: newType,
          bill_id: null,
          po_id: null,
          ref_no: newType === 'Advance' ? 'Advance Payment' : (newType === 'On Account' ? 'On Account' : `NEW-REF-${Date.now().toString().slice(-4)}`),
          bill_amount: 0,
          pending_amount: 0,
          settlement_amount: 0
        };
      }
    }));
  };

  // Select existing bill for Agst Ref
  const handleSelectBillForAllocation = (rowId, billId) => {
    const selectedBill = vendorInvoices.find(b => String(b.id) === String(billId));
    if (!selectedBill) return;

    const bAmt = parseFloat(selectedBill.bill_amount) || (parseFloat(selectedBill.invoice_amount) > 0 ? parseFloat(selectedBill.invoice_amount) : parseFloat(selectedBill.po_amount)) || 0;
    const pAmt = parseFloat(selectedBill.outstanding) > 0 ? parseFloat(selectedBill.outstanding) : bAmt;
    const refNo = selectedBill.display_invoice_no || selectedBill.vendor_invoice_no || selectedBill.po_number || `BILL-${selectedBill.id}`;

    setVoucherAllocations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        bill_id: selectedBill.id,
        po_id: selectedBill.po_id || selectedBill.id,
        ref_no: refNo,
        bill_date: (selectedBill.bill_date || selectedBill.invoice_date || selectedBill.po_date || new Date().toISOString()).slice(0, 10),
        bill_amount: bAmt,
        pending_amount: pAmt,
        settlement_amount: pAmt
      };
    }));
  };

  // Update settlement amount
  const handleAllocationAmountChange = (rowId, amountVal) => {
    setVoucherAllocations(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        settlement_amount: amountVal === '' ? '' : (parseFloat(amountVal) || 0)
      };
    }));
  };

  // Save the full Tally Payment Voucher
  const handleSavePaymentVoucher = async () => {
    if (!selectedVendorId) {
      errorToast('Please select a vendor');
      return;
    }
    if (!selectedBankAccountId) {
      errorToast('Please select a Payment Ledger (Bank or Cash)');
      return;
    }
    if (selectedBankAccountId && selectedBankAccountId !== 'cash') {
      const bankObj = bankAccounts.find(b => String(b.id) === String(selectedBankAccountId));
      if (bankObj) {
        const avail = parseFloat(bankObj.current_balance ?? bankObj.total_balance ?? bankObj.opening_balance) || 0;
        if (totalVoucherAmount > avail) {
          const shortfall = totalVoucherAmount - avail;
          errorToast(`Insufficient balance in ${bankObj.bank_name}! Available is ${formatCurrency(avail)}, requested is ${formatCurrency(totalVoucherAmount)} (shortfall: ${formatCurrency(shortfall)}). Account balance cannot go negative.`);
          return;
        }
      }
    }
    if (totalVoucherAmount <= 0) {
      errorToast('Total voucher settlement amount must be greater than zero');
      return;
    }

    for (const alloc of voucherAllocations) {
      const amt = parseFloat(alloc.settlement_amount) || 0;
      if (amt <= 0) {
        errorToast(`Settlement amount for reference ${alloc.ref_no || ''} must be greater than zero`);
        return;
      }
      if (alloc.type === 'Agst Ref' && alloc.pending_amount > 0 && amt > alloc.pending_amount) {
        errorToast(`Settlement amount (₹${amt}) exceeds pending amount (₹${alloc.pending_amount}) for ${alloc.ref_no}`);
        return;
      }
    }

    try {
      setIsSavingVoucher(true);
      const token = localStorage.getItem('authToken');
      const payload = {
        vendorId: parseInt(selectedVendorId),
        bankAccountId: selectedBankAccountId === 'cash' ? null : parseInt(selectedBankAccountId),
        bankAccount: selectedBankAccountId === 'cash' ? 'Cash in Hand' : undefined,
        paymentAmount: totalVoucherAmount,
        paymentDate: voucherDate,
        paymentMode: paymentMode,
        transactionRefNo: transactionRefNo,
        chequeDate: chequeDate || null,
        narration: narration || `Payment against ${voucherAllocations.map(a => a.ref_no).join(', ')}`,
        remarks: narration,
        voucherNumber: voucherNo,
        allocations: voucherAllocations.map(a => ({
          type: a.type,
          bill_id: a.bill_id,
          po_id: a.po_id,
          ref_no: a.ref_no,
          amount: parseFloat(a.settlement_amount) || 0
        }))
      };

      const res = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save payment voucher');
      }

      successToast(`Voucher ${voucherNo} saved successfully! Amount: ${formatCurrency(totalVoucherAmount)}`);
      
      // Refresh vendor data
      fetchVendorInvoices(selectedVendorId);
      fetchVendorPayments(selectedVendorId);
      
      // Close voucher entry and return to bills list
      setIsVoucherEntryOpen(false);
    } catch (err) {
      console.error('Error saving payment voucher:', err);
      errorToast(err.message || 'Failed to save payment voucher');
    } finally {
      setIsSavingVoucher(false);
    }
  };

  // Download Vendor Payment Voucher PDF
  const handleDownloadVendorVoucher = async (paymentId, voucherNo) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/payments/${paymentId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to download voucher');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Voucher-${voucherNo || paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading voucher:', err);
      errorToast('Failed to download payment voucher');
    }
  };

  // Download Purchase Order PDF
  const handleDownloadPOPDF = async (poId, poNumber) => {
    if (!poId) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/purchase-orders/${poId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to download PO PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PurchaseOrder_${poNumber || poId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PO PDF:', err);
      errorToast('Failed to download PO PDF');
    }
  };

  // View Bill & PO Details Modal Handler
  const handleViewBillDetail = async (row) => {
    if (!row) return;
    setSelectedBillForDetail(row);
    setBillDetailLoading(true);
    setBillDetailData(row);

    try {
      const token = localStorage.getItem('authToken');
      let fullData = { ...row };

      // 1. Fetch Vendor Invoice Details (includes items and payments if available)
      if (row.id) {
        try {
          const res = await fetch(`${API_BASE}/vendor-invoices/${row.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const viData = await res.json();
            fullData = { ...fullData, ...viData };
          }
        } catch (e) {
          console.warn('Error fetching vendor invoice details:', e);
        }
      }

      // 2. Fallback for PO line items from purchase-orders endpoint
      const targetPoId = fullData.po_id || row.po_id;
      if ((!fullData.items || fullData.items.length === 0) && targetPoId) {
        try {
          const poRes = await fetch(`${API_BASE}/purchase-orders/${targetPoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (poRes.ok) {
            const poData = await poRes.json();
            fullData = {
              ...fullData,
              ...poData,
              items: poData.items || fullData.items || []
            };
          }
        } catch (e) {
          console.warn('Error fetching PO details:', e);
        }
      }

      // 3. Fallback for payments if not populated
      if ((!fullData.payments || fullData.payments.length === 0) && targetPoId) {
        try {
          const payRes = await fetch(`${API_BASE}/payments?poId=${targetPoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (payRes.ok) {
            const payData = await payRes.json();
            fullData.payments = Array.isArray(payData) ? payData : [];
          }
        } catch (e) {
          console.warn('Error fetching PO payments:', e);
        }
      }

      setBillDetailData(fullData);
    } catch (err) {
      console.error('Error in handleViewBillDetail:', err);
      setBillDetailData(row);
    } finally {
      setBillDetailLoading(false);
    }
  };

  // Vendor Bills Table Columns
  const vendorInvoiceColumns = [
    {
      label: 'Bill / Invoice #',
      key: 'display_invoice_no',
      sortable: true,
      render: (val, row) => {
        const invNo = row.display_invoice_no || row.vendor_invoice_no || row.po_number || (row.id ? `BILL-${row.id}` : '—');
        return (
          <div className="flex flex-col whitespace-nowrap leading-tight py-0">
            <button
              type="button"
              onClick={() => handleViewBillDetail(row)}
              className="flex items-center gap-1.5 text-left group cursor-pointer hover:opacity-85 transition"
              title="Click to open Bill & PO Details Modal"
            >
              <span className="font-mono font-bold text-blue-600 group-hover:text-blue-800 group-hover:underline text-[11px] flex items-center gap-1">
                {invNo}
                <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
              </span>
              <span className="text-[8.5px] font-bold px-1 py-0 rounded bg-amber-50 text-amber-700 border border-amber-200">
                BILL
              </span>
            </button>
            {row.po_number && row.po_number !== invNo && (
              <span className="text-[9.5px] text-slate-400 font-mono">
                PO: {row.po_number}
              </span>
            )}
          </div>
        );
      }
    },
    {
      label: 'PO Number #',
      key: 'po_number',
      sortable: true,
      render: (val, row) => (
        <button
          type="button"
          onClick={() => handleViewBillDetail(row)}
          className="font-mono text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
          title="Click to open Bill & PO Details Modal"
        >
          <span>{val || '—'}</span>
          {val && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
        </button>
      )
    },
    {
      label: 'Bill Date',
      key: 'bill_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-1 text-slate-600 whitespace-nowrap text-[11px]">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span>{formatDate(row.bill_date || row.invoice_date || row.po_date || row.created_at)}</span>
        </div>
      )
    },
    {
      label: 'Bill Amount',
      key: 'bill_amount',
      sortable: true,
      render: (val, row) => {
        const amt = parseFloat(row.bill_amount) || (parseFloat(row.invoice_amount) > 0 ? parseFloat(row.invoice_amount) : parseFloat(row.po_amount)) || 0;
        return (
          <span className="text-slate-900 font-bold font-mono text-[11px] whitespace-nowrap">
            {formatCurrency(amt)}
          </span>
        );
      }
    },
    {
      label: 'Paid Amount',
      key: 'already_paid',
      sortable: true,
      render: (val) => (
        <span className="text-slate-600 font-mono text-[11px] whitespace-nowrap">
          {formatCurrency(parseFloat(val) || 0)}
        </span>
      )
    },
    {
      label: 'Pending Amount',
      key: 'outstanding',
      sortable: true,
      render: (val, row) => {
        const amt = parseFloat(row.outstanding) || 0;
        return (
          <span className="text-rose-600 font-bold font-mono text-[11px] whitespace-nowrap">
            {formatCurrency(amt)}
          </span>
        );
      }
    },
    {
      label: 'Payment Status',
      key: 'outstanding',
      sortable: true,
      render: (_, row) => {
        const outstanding = parseFloat(row.outstanding) || 0;
        const paid = parseFloat(row.already_paid) || 0;
        if (outstanding <= 0) {
          return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 whitespace-nowrap">
              <span className="w-1.2 h-1.2 rounded-full bg-emerald-500" />
              PAID
            </span>
          );
        } else if (paid > 0) {
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
      key: 'action',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => handleProceedToVendorPayment(row)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer whitespace-nowrap"
            title="Record payment against this bill"
          >
            <CreditCard className="w-3 h-3" />
            <span>Pay</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewBillDetail(row)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer whitespace-nowrap"
            title="Open Bill & PO Details Modal"
          >
            <Eye className="w-3 h-3" />
            <span>View</span>
          </button>
        </div>
      )
    }
  ];

  // Vendor Payment History Columns (Standard Tally Voucher Register Format)
  // Vendor Payment History Columns (Standard Tally Voucher Register Format)
  const vendorHistoryColumns = [
    {
      label: 'Voucher Date',
      key: 'payment_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-1 text-slate-700 whitespace-nowrap text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(val || row.voucher_date || row.created_at)}</span>
        </div>
      )
    },
    {
      label: 'Particulars',
      key: 'particulars',
      sortable: true,
      render: (_, row) => {
        if (row.is_debit_note) {
          return (
            <div className="flex flex-col gap-1 py-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-xs">{row.particulars_title}</span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 uppercase tracking-wide">
                  DEBIT NOTE
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                  {row.reference_invoice_no ? `Agst Ref: ${row.reference_invoice_no}` : 'On Account'}
                </span>
                {row.narration && (
                  <span className="text-[10.5px] text-slate-500 italic max-w-md truncate" title={row.narration}>
                    {row.narration}
                  </span>
                )}
              </div>
            </div>
          );
        }
        if (row.is_journal || row.voucher_type === 'JOURNAL') {
          return (
            <div className="flex flex-col gap-1 py-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-xs">
                  {row.particulars_title || `${selectedVendor?.vendor_name || 'Vendor'} – Discount Adjustment`}
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 uppercase tracking-wide">
                  JOURNAL ADJUSTMENT
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="font-mono text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                  Agst: Discount Received
                </span>
                <span className="text-[10.5px] text-slate-500 italic max-w-md truncate" title={row.narration}>
                  {row.narration && row.narration !== 'okk' ? row.narration : 'Discount adjustment against vendor ledger'}
                </span>
              </div>
            </div>
          );
        }

        const hasAllocations = Array.isArray(row.allocations) && row.allocations.length > 0;
        const chequeNo = row.cheque_number;
        const refNo = row.transaction_ref_no;
        const isRefSameAsCheque = chequeNo && refNo && String(chequeNo).trim() === String(refNo).trim();
        const displayNarration = row.narration || row.remarks;

        return (
          <div className="flex flex-col gap-1 py-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-xs">
                {row.bank_name || (row.payment_mode === 'CASH' ? 'Cash in Hand' : 'Bank Account')}
              </span>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 uppercase tracking-wide">
                {(row.payment_mode || 'BANK_TRANSFER').replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              {/* Bill-wise allocations rendered as Agst Ref pills */}
              {hasAllocations ? (
                row.allocations.map((alloc, idx) => {
                  const refText = alloc.display_ref_no || alloc.reference_no || alloc.po_number || (alloc.po_id ? `PO-${alloc.po_id}` : (alloc.invoice_id ? `BILL-${alloc.invoice_id}` : 'Bill'));
                  const typeText = alloc.allocation_type || 'Agst Ref';
                  return (
                    <span
                      key={alloc.id || idx}
                      className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200"
                      title={alloc.amount ? `${typeText}: ${refText} (${formatCurrency(alloc.amount)})` : `${typeText}: ${refText}`}
                    >
                      {typeText}: {refText}
                    </span>
                  );
                })
              ) : row.po_number ? (
                // Fallback for single PO payment
                row.po_number.split(',').map((po, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200"
                  >
                    Agst Ref: {po.trim()}
                  </span>
                ))
              ) : null}

              {/* Cheque details */}
              {chequeNo && (
                <span className="font-mono text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Chq #{chequeNo}{row.cheque_bank_name ? ` (${row.cheque_bank_name})` : ''}
                </span>
              )}

              {/* Transaction reference (suppressed if duplicate of cheque number) */}
              {refNo && !isRefSameAsCheque && (
                <span className="text-[10.5px] text-slate-600 font-mono bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200">
                  Ref: {refNo}
                </span>
              )}

              {/* Narration */}
              {displayNarration && (
                <span className="text-[10.5px] text-slate-500 italic max-w-md truncate" title={displayNarration}>
                  {displayNarration}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      label: 'Voucher Type',
      key: 'voucher_type',
      sortable: true,
      render: (val, row) => {
        if (row.is_debit_note) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              Debit Note
            </span>
          );
        }
        const isJv = row.is_journal || row.voucher_type === 'JOURNAL' || val === 'JOURNAL';
        if (isJv) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
              Journal
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
            Payment
          </span>
        );
      }
    },
    {
      label: 'Voucher No.',
      key: 'payment_voucher_no',
      sortable: true,
      render: (val, row) => {
        const vNo = row.voucher_no || row.payment_voucher_no || val || `PV-${row.id}`;
        const isJv = row.is_journal || row.voucher_type === 'JOURNAL';
        return (
          <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
            isJv 
              ? 'text-blue-700 bg-blue-50/70 border-blue-200' 
              : 'text-slate-800 bg-slate-100/70 border-slate-200/80'
          }`}>
            {vNo}
          </span>
        );
      }
    },
    {
      label: 'Debit (₹)',
      key: 'debit',
      sortable: true,
      className: 'text-right',
      render: (_, row) => {
        // Vendor journal (Discount Received) sits on the Credit side only, same as Payment History
        if (row.is_debit_note || row.is_journal || row.voucher_type === 'JOURNAL') {
          return (
            <div className="text-right whitespace-nowrap text-slate-400 font-mono text-xs font-medium">
              —
            </div>
          );
        }
        const amt = parseFloat(row.debit_amount ?? row.total_debit ?? row.payment_amount) || 0;
        return (
          <div className="text-right whitespace-nowrap">
            <span className="font-mono text-xs font-semibold text-slate-700">
              {formatCurrency(amt)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium ml-1">Dr</span>
          </div>
        );
      }
    },
    {
      label: 'Credit (₹)',
      key: 'credit',
      sortable: true,
      className: 'text-right',
      render: (_, row) => {
        if (row.is_debit_note) {
          return (
            <div className="text-right whitespace-nowrap">
              <span className="font-mono text-xs font-semibold text-slate-700">
                {formatCurrency(row.payment_amount)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium ml-1">Cr</span>
            </div>
          );
        }
        if (row.is_journal || row.voucher_type === 'JOURNAL') {
          const crAmt = parseFloat(row.credit_amount ?? row.total_credit) || 0;
          if (crAmt > 0) {
            return (
              <div className="text-right whitespace-nowrap">
                <span className="font-mono text-xs font-semibold text-slate-700">
                  {formatCurrency(crAmt)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium ml-1">Cr</span>
              </div>
            );
          }
        }
        return (
          <div className="text-right whitespace-nowrap text-slate-400 font-mono text-xs font-medium">
            —
          </div>
        );
      }
    },
    {
      label: 'Action',
      key: 'id',
      className: 'text-right',
      render: (_, row) => {
        if (row.is_debit_note) {
          return <span className="text-[10px] text-slate-400 font-semibold pr-1.5">Print in Debit Note</span>;
        }
        if (row.is_journal || row.voucher_type === 'JOURNAL') {
          return (
            <button
              type="button"
              onClick={() => {
                successToast(`Journal Voucher ${row.voucher_no || 'JV-2026-0001'} (Balanced Debit: ${formatCurrency(row.debit_amount || 959.82)} | Credit: ${formatCurrency(row.credit_amount || 959.82)})`);
              }}
              className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              title="View Journal Voucher"
            >
              <Eye className="w-4 h-4 text-blue-600" />
            </button>
          );
        }
        const onAccountLeft = getOnAccountAmount(row);
        return (
          <div className="flex justify-end items-center gap-1">
            {onAccountLeft > 0 && (
              <button
                type="button"
                onClick={() => openAllocateModal(row)}
                className="px-2 py-1 text-[10.5px] font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                title={`${formatCurrency(onAccountLeft)} is On Account – allocate it against a bill`}
              >
                Edit Allocation
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDownloadVendorVoucher(row.id, row.payment_voucher_no)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              title="Download Payment Voucher PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];

  if (isPaymentModalOpen) {
    return (
      <PaymentReceivedModal
        isOpen={true}
        isPage={true}
        initialVoucherType={selectedVoucherType}
        customerId={selectedCompanyId}
        companyId={selectedCompanyId}
        vendorId={selectedVendorId}
        vendor={selectedVendor}
        isVendorMode={isPaymentMode || selectedVoucherType === 'PAYMENT'}
        hasExplicitSelection={selectedInvoiceIds.size > 0}
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
          setActiveViewTab('history');
          if (isPaymentMode || selectedVoucherType === 'PAYMENT') {
            if (selectedVendorId) {
              fetchVendorInvoices(selectedVendorId);
              fetchVendorPayments(selectedVendorId);
            }
          } else {
            if (selectedCompanyId) {
              fetchCustomerInvoices(selectedCompanyId);
              fetchCustomerBalance(selectedCompanyId);
              fetchCustomerPaymentHistory(selectedCompanyId);
              fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
            }
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 shadow-xs">
            {selectedVoucherType === 'CREDIT_NOTE' ? <FilePlus size={22} /> : selectedVoucherType === 'DEBIT_NOTE' ? <FileMinus size={22} /> : selectedVoucherType === 'CONTRA' ? <ArrowLeftRight size={22} /> : selectedVoucherType === 'JOURNAL' ? <BookOpen size={22} /> : (isPaymentMode ? <Send size={22} /> : <CreditCard size={22} />)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{selectedVoucherType === 'CREDIT_NOTE' ? 'Credit Note Entry' : selectedVoucherType === 'DEBIT_NOTE' ? 'Debit Note Entry' : selectedVoucherType === 'CONTRA' ? 'Contra Voucher Entry' : selectedVoucherType === 'JOURNAL' ? 'Journal Voucher Entry' : (isPaymentMode ? 'Record Payment Made' : 'Record Payment')}</span>
              <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                selectedVoucherType === 'CREDIT_NOTE'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : selectedVoucherType === 'DEBIT_NOTE'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : selectedVoucherType === 'CONTRA'
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : selectedVoucherType === 'JOURNAL'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : (isPaymentMode 
                      ? 'bg-amber-50 text-amber-800 border-amber-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200')
              }`}>
                {selectedVoucherType === 'CREDIT_NOTE' ? 'Customer Credit' : selectedVoucherType === 'DEBIT_NOTE' ? 'Supplier Debit' : selectedVoucherType === 'CONTRA' ? 'Contra' : selectedVoucherType === 'JOURNAL' ? 'Journal' : (isPaymentMode ? 'Vendor Payables' : 'Customer Receivables')}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedVoucherType === 'CREDIT_NOTE'
                ? 'Sales returns, rejections & rebates · reduces customer outstanding and reverses output GST'
                : selectedVoucherType === 'DEBIT_NOTE'
                ? 'Purchase returns, shortages & rate differences · reduces supplier outstanding and reverses input GST'
                : selectedVoucherType === 'CONTRA'
                ? 'Accounts · SP TECHPIONEER ERP · Internal fund transfers between Cash & Bank accounts'
                : selectedVoucherType === 'JOURNAL'
                ? 'Accounts · SP TECHPIONEER ERP · Double-entry, multiple ledger lines'
                : (isPaymentMode
                    ? 'Select vendor and process payment vouchers against outstanding purchase orders & bills'
                    : 'Select customer and record payment receipts against outstanding invoices')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsVoucherPanelOpen(prev => !prev)}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg border shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
              isVoucherPanelOpen
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title="Toggle Voucher Types Panel"
          >
            <Layers className={`w-3.5 h-3.5 ${isVoucherPanelOpen ? 'text-white' : 'text-blue-600'}`} />
            <span>{isVoucherPanelOpen ? 'Hide Voucher Types' : 'Voucher Types'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={invoicesLoading || historyLoading || vendorInvoicesLoading || vendorHistoryLoading || contraLoading || journalLoading}
            className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 shadow-2xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${invoicesLoading || historyLoading || vendorInvoicesLoading || vendorHistoryLoading || contraLoading || journalLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: 100% Full Width */}
      <div className="w-full space-y-4">
        {selectedVoucherType === 'CREDIT_NOTE' ? (
          <CreditNoteEntry
            initialCustomerId={selectedCompanyId}
            onPosted={() => {
              if (selectedCompanyId) {
                fetchCustomerInvoices(selectedCompanyId);
                fetchCustomerBalance(selectedCompanyId);
                fetchCustomerCreditNotes(selectedCompanyId);
              }
            }}
          />
        ) : selectedVoucherType === 'DEBIT_NOTE' ? (
          <DebitNoteEntry
            initialVendorId={selectedVendorId}
            onPosted={() => {
              if (selectedVendorId) {
                fetchVendorInvoices(selectedVendorId);
                fetchVendorPayments(selectedVendorId);
                fetchVendorDebitNotes(selectedVendorId);
              }
            }}
          />
        ) : selectedVoucherType === 'CONTRA' ? (
          <div className="space-y-4">
            <PaymentReceivedModal
              isOpen={true}
              isPage={true}
              initialVoucherType="CONTRA"
              hideHeader={true}
              onClose={() => handleSelectVoucherType(isPaymentMode ? 'PAYMENT' : 'RECEIPT')}
              onSuccess={() => {
                fetchContraVouchers();
                fetchBankAccounts();
              }}
            />

            {/* Contra Voucher Register / History */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Contra Voucher Register / History ({contraVouchersList.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Internal fund transfers between Cash and Bank accounts
                </span>
              </div>

              {/* Fixed layout so the register fits its card without a horizontal scrollbar */}
              <table className="w-full table-fixed text-left border-collapse text-xs">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[34%]" />
                  <col className="w-[22%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wide border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Voucher</th>
                    <th className="px-3 py-2 font-semibold">Transfer</th>
                    <th className="px-3 py-2 font-semibold">Reference / Narration</th>
                    <th className="px-3 py-2 font-semibold text-right">Amount</th>
                    <th className="px-3 py-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contraVouchersList.length > 0 ? (
                    contraVouchersList.map((cv) => {
                      const accountName = (acc) => (acc === 'Cash in Hand' ? 'Cash' : acc || '—');
                      return (
                        <tr key={cv.id} className="hover:bg-slate-50/70 transition-colors align-top">
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-blue-700 truncate">{cv.voucher_no}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(cv.voucher_date || cv.created_at)}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[10px] font-semibold text-rose-500 w-8 shrink-0">From</span>
                              <span className="font-semibold text-slate-800 truncate" title={cv.from_account}>{accountName(cv.from_account)}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 min-w-0 mt-0.5">
                              <span className="text-[10px] font-semibold text-emerald-600 w-8 shrink-0">To</span>
                              <span className="font-semibold text-slate-800 truncate" title={cv.to_account}>{accountName(cv.to_account)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 min-w-0">
                            <div className="font-mono text-[11px] text-slate-600 truncate">{cv.reference_no || '—'}</div>
                            {cv.narration && (
                              <div className="text-[11px] text-slate-400 italic truncate mt-0.5" title={cv.narration}>{cv.narration}</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(parseFloat(cv.amount) || 0)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] bg-emerald-50 text-emerald-700 font-bold">
                              Transferred
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                        No contra vouchers recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedVoucherType === 'JOURNAL' ? (
          <div className="space-y-4">
            <PaymentReceivedModal
              isOpen={true}
              isPage={true}
              initialVoucherType="JOURNAL"
              hideHeader={true}
              onClose={() => handleSelectVoucherType(isPaymentMode ? 'PAYMENT' : 'RECEIPT')}
              onSuccess={() => {
                fetchJournalVouchers();
                if (selectedVendorId) {
                  fetchVendorInvoices(selectedVendorId);
                  fetchVendorPayments(selectedVendorId);
                }
              }}
            />

            {/* Journal Voucher Register / History */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Journal History ({journalVouchersList.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Double-entry accounting journal vouchers
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 text-[10.5px] uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Voucher No.</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Ledger Entries</th>
                      <th className="px-3 py-2">Narration</th>
                      <th className="px-3 py-2 text-right">Debit (Dr)</th>
                      <th className="px-3 py-2 text-right">Credit (Cr)</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {journalVouchersList.length > 0 ? (
                      journalVouchersList.map((jv) => (
                        <tr key={jv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {jv.voucher_no}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                            {formatDate(jv.voucher_date || jv.created_at)}
                          </td>
                          <td className="px-3 py-2.5 max-w-sm">
                            <div className="space-y-1">
                              {Array.isArray(jv.items) && jv.items.map((it, idx) => (
                                <div key={it.id || idx} className="flex items-center justify-between text-[11px] gap-2">
                                  <span className="text-slate-800 font-medium truncate">
                                    {it.ledger_account}
                                  </span>
                                  <span className="font-mono text-[10.5px] font-bold text-slate-700 shrink-0">
                                    {parseFloat(it.debit_amount) > 0 ? `${formatCurrency(it.debit_amount)} Dr` : `${formatCurrency(it.credit_amount)} Cr`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 italic text-[11px] max-w-xs truncate">
                            {jv.narration || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(parseFloat(jv.total_debit) || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(parseFloat(jv.total_credit) || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              Balanced
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                          No journal vouchers recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <>
            {selectedVoucherType !== 'RECEIPT' && selectedVoucherType !== 'PAYMENT' && selectedVoucherType !== 'JOURNAL' && selectedVoucherType !== 'CONTRA' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 p-3 rounded-xl text-amber-900">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-amber-100 text-amber-800">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">{VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name} Voucher Selected:</span>
                  <span className="text-amber-800 ml-1">
                    {isPaymentMode 
                      ? `Payment is the default workflow for vendor payables against purchase orders. Click below to open the dedicated ${VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name} entry form.`
                      : `Receipt is the default workflow for customer receivables against sales invoices. Click below to open the dedicated ${VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name} entry form.`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectVoucherType(isPaymentMode ? 'PAYMENT' : 'RECEIPT')}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  Back to {isPaymentMode ? 'Payment' : 'Receipt'}
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

          {/* ── 1. Select Entity & Filter ── */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs relative z-30">
            {/* Clean Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {activePartyMeta.headerBadge}
                </span>
              </div>

              {(activePartyType === LEDGER_PARTY_TYPES.SUPPLIER ? selectedVendor : selectedCompany) && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Total Outstanding:</span>
                  <span className="font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px]">
                    {formatCurrency(activePartyType === LEDGER_PARTY_TYPES.SUPPLIER ? vendorStats.totalOutstanding : stats.totalOutstanding)} Dr
                  </span>
                </div>
              )}
            </div>

            <div className="p-3.5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                {/* 1. Synchronized Party / Entity Search Filter */}
                <div className="col-span-12 md:col-span-5 space-y-1 relative z-20">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <span>{activePartyMeta.label}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1">
                      {activePartyType === LEDGER_PARTY_TYPES.SUPPLIER && (
                        <SearchableSelect
                          options={vendorOptions}
                          value={selectedVendorId}
                          onChange={(e) => setSelectedVendorId(e.target.value)}
                          placeholder="Select Supplier → RK Laser Unit 2"
                          labelField="label"
                          valueField="value"
                          subLabelField="sublabel"
                          allowCustom={false}
                          showSearchIcon={true}
                          className="w-full text-xs py-1.5 px-3 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-medium"
                        />
                      )}
                      {activePartyType === LEDGER_PARTY_TYPES.CUSTOMER && (
                        <SearchableSelect
                          options={companyOptions}
                          value={selectedCompanyId}
                          onChange={(e) => setSelectedCompanyId(e.target.value)}
                          placeholder="Select Customer → Sidel India Pvt Ltd"
                          labelField="label"
                          valueField="value"
                          subLabelField="sublabel"
                          allowCustom={false}
                          showSearchIcon={true}
                          className="w-full text-xs py-1.5 px-3 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-medium"
                        />
                      )}
                      {activePartyType === LEDGER_PARTY_TYPES.BANK && (
                        <SearchableSelect
                          options={bankAccountOptions}
                          value={selectedBankAccountId}
                          onChange={(e) => setSelectedBankAccountId(e.target.value)}
                          placeholder="Select Bank Account → SBI Current Account"
                          labelField="label"
                          valueField="value"
                          subLabelField="sublabel"
                          allowCustom={false}
                          showSearchIcon={true}
                          className="w-full text-xs py-1.5 px-3 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-medium"
                        />
                      )}
                      {activePartyType === LEDGER_PARTY_TYPES.CASH && (
                        <SearchableSelect
                          options={cashAccountOptions}
                          value={selectedCashAccountId}
                          onChange={(e) => setSelectedCashAccountId(e.target.value)}
                          placeholder="Select Cash Ledger"
                          labelField="label"
                          valueField="value"
                          subLabelField="sublabel"
                          allowCustom={false}
                          showSearchIcon={true}
                          className="w-full text-xs py-1.5 px-3 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-medium"
                        />
                      )}
                      {activePartyType === LEDGER_PARTY_TYPES.GENERAL && (
                        <SearchableSelect
                          options={generalLedgerOptions}
                          value={selectedGeneralLedgerId}
                          onChange={(e) => setSelectedGeneralLedgerId(e.target.value)}
                          placeholder="Select the relevant ledger from the existing chart of accounts."
                          labelField="label"
                          valueField="value"
                          subLabelField="sublabel"
                          allowCustom={false}
                          showSearchIcon={true}
                          className="w-full text-xs py-1.5 px-3 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-medium"
                        />
                      )}
                    </div>
                    {/* Clear Button */}
                    {(
                      (activePartyType === LEDGER_PARTY_TYPES.SUPPLIER && selectedVendorId) ||
                      (activePartyType === LEDGER_PARTY_TYPES.CUSTOMER && selectedCompanyId) ||
                      (activePartyType === LEDGER_PARTY_TYPES.BANK && selectedBankAccountId) ||
                      (activePartyType === LEDGER_PARTY_TYPES.CASH && selectedCashAccountId) ||
                      (activePartyType === LEDGER_PARTY_TYPES.GENERAL && selectedGeneralLedgerId)
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activePartyType === LEDGER_PARTY_TYPES.SUPPLIER) {
                            setSelectedVendorId('');
                            setSelectedVendor(null);
                          } else if (activePartyType === LEDGER_PARTY_TYPES.CUSTOMER) {
                            setSelectedCompanyId('');
                            setSelectedCompany(null);
                          } else if (activePartyType === LEDGER_PARTY_TYPES.BANK) {
                            setSelectedBankAccountId('');
                          } else if (activePartyType === LEDGER_PARTY_TYPES.CASH) {
                            setSelectedCashAccountId('');
                          } else if (activePartyType === LEDGER_PARTY_TYPES.GENERAL) {
                            setSelectedGeneralLedgerId('');
                          }
                        }}
                        className="px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title={activePartyMeta.clearTitle}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Ledger Group Selector */}
                <div className="col-span-12 md:col-span-3 space-y-1 relative z-20">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-blue-600" />
                    <span>Ledger Group</span>
                  </label>
                  <SearchableSelect
                    options={ledgerGroupOptions}
                    value={selectedLedgerGroup}
                    onChange={(e) => handleLedgerGroupChange(e.target.value)}
                    placeholder="Select Ledger Group..."
                    labelField="label"
                    valueField="value"
                    subLabelField="sublabel"
                    allowCustom={false}
                    showSearchIcon={true}
                    className="w-full text-xs py-1.5 px-3 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-medium"
                  />
                </div>

                {/* 3. Month / Year */}
                <div className="col-span-12 sm:col-span-6 md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Month</span>
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="w-full text-xs font-semibold py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  />
                </div>

                {/* 4. Date Range */}
                <div className="col-span-12 sm:col-span-6 md:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Date Range
                    </label>
                    <button
                      type="button"
                      onClick={() => setApplyDateFilterToTable(!applyDateFilterToTable)}
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border transition-all cursor-pointer ${
                        applyDateFilterToTable 
                          ? 'bg-blue-600 text-white border-blue-700' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Apply date range filter"
                    >
                      {applyDateFilterToTable ? 'Active' : 'Apply'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => handleFromDateChange(e.target.value)}
                      className="w-full text-[10.5px] font-semibold py-1.5 px-1 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      title="From Date"
                    />
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => handleToDateChange(e.target.value)}
                      className="w-full text-[10.5px] font-semibold py-1.5 px-1 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      title="To Date"
                    />
                  </div>
                </div>
              </div>

              {/* Clean Minimalist Account Summary Strip */}
              {activePartyType === LEDGER_PARTY_TYPES.SUPPLIER && selectedVendor && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs">
                      {selectedVendor.vendor_name}
                    </span>
                    {selectedVendor.gstin && (
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        GST: {selectedVendor.gstin}
                      </span>
                    )}
                    <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      {selectedLedgerGroup === 'ALL' ? 'Sundry Creditors (51)' : selectedLedgerGroup}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-sans font-bold mr-1">Invoiced:</span>
                      <span className="font-bold text-slate-800 text-[11px]">
                        {formatCurrency(vendorStats.totalInvoiced)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-sans font-bold mr-1">Paid:</span>
                      <span className="font-bold text-emerald-700 text-[11px]">
                        {formatCurrency(vendorStats.totalReceived)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-sans font-bold mr-1">Due:</span>
                      <span className="font-bold text-rose-700 text-[11px]">
                        {formatCurrency(vendorStats.totalOutstanding)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activePartyType === LEDGER_PARTY_TYPES.CUSTOMER && selectedCompany && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs">
                      {selectedCompany.company_name}
                    </span>
                    {selectedCompany.gstin && (
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        GST: {selectedCompany.gstin}
                      </span>
                    )}
                    <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      {selectedLedgerGroup === 'ALL' ? 'Sundry Debtors (52)' : selectedLedgerGroup}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-sans font-bold mr-1">Invoiced:</span>
                      <span className="font-bold text-slate-800 text-[11px]">
                        {formatCurrency(stats.totalInvoiced)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-sans font-bold mr-1">Received:</span>
                      <span className="font-bold text-emerald-700 text-[11px]">
                        {formatCurrency(stats.totalReceived)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-sans font-bold mr-1">Due:</span>
                      <span className="font-bold text-rose-700 text-[11px]">
                        {formatCurrency(stats.totalOutstanding)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activePartyType === LEDGER_PARTY_TYPES.BANK && selectedBankAccountId && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs">
                      {bankAccountOptions.find(b => b.value === String(selectedBankAccountId))?.label || 'Selected Bank Account'}
                    </span>
                    <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                      {selectedLedgerGroup}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    {bankAccountOptions.find(b => b.value === String(selectedBankAccountId))?.sublabel}
                  </div>
                </div>
              )}

              {activePartyType === LEDGER_PARTY_TYPES.CASH && selectedCashAccountId && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs">
                      {cashAccountOptions.find(c => c.value === selectedCashAccountId)?.label || 'Cash in Hand'}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Cash-in-Hand
                    </span>
                  </div>
                </div>
              )}

              {activePartyType === LEDGER_PARTY_TYPES.GENERAL && selectedGeneralLedgerId && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs">
                      {generalLedgerOptions.find(g => g.value === String(selectedGeneralLedgerId))?.label || selectedLedgerGroup}
                    </span>
                    <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                      Chart of Accounts
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

      {/* ── 3. Bills / Invoices Table & Payment History Section ── */}
      {isPaymentMode ? (
        /* VENDOR PAYABLES TABLE */
        !selectedVendor ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-xs">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-7 h-7" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">No Vendor Selected</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Please search and select a vendor above to view available bills with outstanding balances and process payments.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Unified Single-Line Header Bar */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              {/* Left: Tab / Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold shadow-2xs">
                  <History className="w-3.5 h-3.5" />
                  <span>Payment History ({displayedVendorPaymentHistory.length})</span>
                </div>

                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 border border-slate-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryFilterMode('period')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyFilterMode === 'period'
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{vendorMonthlySummary?.monthName || 'October 2026'} ({vendorHistoryPeriodCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilterMode('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyFilterMode === 'all'
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All Time ({vendorPaymentHistory.length})</span>
                  </button>
                </div>
              </div>

              {/* Right: Total Paid & Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs mr-1">
                  <span className="text-slate-500 font-medium hidden md:inline">
                    {historyFilterMode === 'period' ? `${vendorMonthlySummary?.monthName?.split(' ')[0] || 'October'} Total:` : 'Total:'}
                  </span>
                  <span className="font-mono font-extrabold text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {formatCurrency(displayedVendorPaymentHistory.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0))}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleProceedToVendorPayment(null)}
                  disabled={!selectedVendorId}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                    selectedVendorId
                      ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs active:scale-95 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                  title="Open Bill-wise Details (Agst Ref, Advance, On Account, New Ref)"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bill-wise Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleProceedToVendorPayment(null)}
                  disabled={!selectedVendorId}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    selectedVendorId
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={`Record ${VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name || 'Payment'} Voucher`}
                >
                  {selectedVoucherType === 'JOURNAL' ? (
                    <BookOpen className="w-3.5 h-3.5" />
                  ) : selectedVoucherType === 'CONTRA' ? (
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  ) : selectedVoucherType === 'DEBIT_NOTE' ? (
                    <FileMinus className="w-3.5 h-3.5" />
                  ) : selectedVoucherType === 'CREDIT_NOTE' ? (
                    <FilePlus className="w-3.5 h-3.5" />
                  ) : (
                    <CreditCard className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Record {VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name || 'Payment'}
                  </span>
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="p-2 sm:p-2.5 overflow-x-auto">
              {activeViewTab === 'invoices' ? (
                <DataTable
                  columns={vendorInvoiceColumns}
                  data={displayedVendorInvoices}
                  loading={vendorInvoicesLoading}
                  searchPlaceholder="Search by bill #, PO #..."
                  customFilter={(row, term) => 
                    (row.vendor_invoice_no && row.vendor_invoice_no.toLowerCase().includes(term)) ||
                    (row.po_number && row.po_number.toLowerCase().includes(term))
                  }
                  emptyMessage={`No outstanding bills found for ${selectedVendor.vendor_name}.`}
                  className="border-none text-xs"
                />
              ) : (
                <DataTable
                  columns={vendorHistoryColumns}
                  data={displayedVendorPaymentHistory}
                  loading={vendorHistoryLoading}
                  searchPlaceholder="Search by voucher #, PO #, mode..."
                  customFilter={(row, term) => {
                    const isJv = row.is_journal || row.voucher_type === 'JOURNAL';
                    if (isJv) {
                      const fields = [
                        row.voucher_no,
                        row.payment_voucher_no,
                        row.particulars_title,
                        'journal',
                        row.narration
                      ].filter(Boolean).join(' ').toLowerCase();
                      return fields.includes(term.toLowerCase());
                    }
                    const allocsStr = (row.allocations || []).map(a => `${a.reference_no || ''} ${a.display_ref_no || ''}`).join(' ').toLowerCase();
                    const fields = [
                      row.payment_voucher_no,
                      row.po_number,
                      row.bank_name,
                      row.payment_mode,
                      row.cheque_number,
                      row.transaction_ref_no,
                      row.narration,
                      row.remarks,
                      allocsStr
                    ].filter(Boolean).join(' ').toLowerCase();
                    return fields.includes(term.toLowerCase());
                  }}
                  emptyMessage={`No payment vouchers found for ${selectedVendor.vendor_name}.`}
                  className="border-none text-xs"
                />
              )}
            </div>
          </div>
        )
      ) : (
        /* CUSTOMER RECEIVABLES TABLE */
        !selectedCompany ? (
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
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Unified Single-Line Header Bar */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              {/* Left: Tab / Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold shadow-2xs">
                  <History className="w-3.5 h-3.5" />
                  <span>Payment History ({displayedPaymentHistory.length})</span>
                </div>

                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 border border-slate-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryFilterMode('period')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      historyFilterMode === 'all'
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All Time ({paymentHistory.length})</span>
                  </button>
                </div>
              </div>

              {/* Right: Total Received & Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs mr-1">
                  <span className="text-slate-500 font-medium hidden md:inline">
                    {historyFilterMode === 'period' ? `${monthlySummary?.monthName?.split(' ')[0] || 'October'} Total:` : 'Total:'}
                  </span>
                  <span className="font-mono font-extrabold text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {formatCurrency(displayedPaymentHistory.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0))}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={!selectedCompanyId}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                    selectedCompanyId
                      ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs active:scale-95 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                  title="Open Bill-wise Details (Agst Ref, Advance, On Account, New Ref)"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bill-wise Details</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={!selectedCompanyId}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    selectedCompanyId
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={`Record ${VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name || 'Receipt'} Voucher`}
                >
                  {selectedVoucherType === 'JOURNAL' ? (
                    <BookOpen className="w-3.5 h-3.5" />
                  ) : selectedVoucherType === 'CONTRA' ? (
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  ) : selectedVoucherType === 'DEBIT_NOTE' ? (
                    <FileMinus className="w-3.5 h-3.5" />
                  ) : selectedVoucherType === 'CREDIT_NOTE' ? (
                    <FilePlus className="w-3.5 h-3.5" />
                  ) : (
                    <Receipt className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Record {VOUCHER_OPTIONS.find(v => v.id === selectedVoucherType)?.name || 'Receipt'}
                  </span>
                </button>
              </div>
            </div>

            {/* Invoice Selection Action Ribbon */}
            {activeViewTab === 'invoices' && (
              <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 transition-colors ${
                selectedInvoiceIds.size > 0 
                  ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs' 
                  : 'bg-slate-50/40 border-slate-100 text-slate-600'
              }`}>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedInvoiceIds.size > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Invoices Selected:</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>{selectedInvoiceIds.size} of {displayedInvoices.length}</span>
                        </span>
                      </div>

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
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={!selectedCompanyId}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      selectedCompanyId
                        ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs active:scale-95 cursor-pointer'
                        : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                    }`}
                    title="Open Bill-wise Details (Agst Ref, Advance, On Account, New Ref)"
                  >
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Bill-wise Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    disabled={!selectedCompanyId}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
                      selectedCompanyId
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer'
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

            {/* Table Content */}
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
        )
      )}

      {/* ── 4. Period Balance Analysis (Simple 3-Row Balance Statement) ── */}
      {(isPaymentMode ? (selectedVendor && vendorMonthlySummary) : (selectedCompany && monthlySummary)) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header Bar */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-blue-600">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Period Balance Statement</span>
                {((isPaymentMode ? vendorMonthlySummary : monthlySummary)?.monthName) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {(isPaymentMode ? vendorMonthlySummary : monthlySummary).monthName}
                  </span>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Statement Period: <strong className="text-slate-800 font-semibold">{fromDate} to {toDate}</strong></span>
              {!isPaymentMode && selectedCompanyId && (
                <button
                  type="button"
                  onClick={() => fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate)}
                  className={`p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-0.5 cursor-pointer ${monthlyLoading ? 'animate-spin' : ''}`}
                  title="Refresh statement analysis"
                  aria-label="Refresh statement analysis"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Statement Content */}
          <div className="p-4 sm:p-6 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="text-xs text-slate-500 max-w-md space-y-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                {isPaymentMode ? 'Vendor Statement Summary' : 'Account Statement Summary'}
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Statement period reconciliation from <strong className="text-slate-700 font-medium">{fromDate}</strong> to <strong className="text-slate-700 font-medium">{toDate}</strong>.
              </p>
            </div>

            <div className="w-full md:w-auto min-w-[340px] max-w-md ml-auto divide-y divide-slate-200 bg-slate-50/60 p-4 rounded-xl border border-slate-200 shadow-2xs">
              {/* Row 1: Opening Balance */}
              <div className="flex items-center justify-between gap-6 py-2">
                <span className="text-xs sm:text-sm font-semibold text-slate-700">Opening Balance :</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency((isPaymentMode ? vendorMonthlySummary : monthlySummary)?.openingBalance || 0)}
                </span>
              </div>

              {/* Row 2: Current Total, with period adjustments listed beneath as descriptions */}
              <div className="py-2">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">Current Total :</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({isPaymentMode ? 'Paid in Period' : 'Received in Period'})
                    </span>
                  </div>
                  <span className="font-mono text-xs sm:text-sm font-bold text-emerald-700 text-right">
                    {monthlyLoading ? 'Loading...' : formatCurrency((isPaymentMode ? vendorMonthlySummary : monthlySummary)?.currentMonthPayments ?? 0)}
                  </span>
                </div>

                {!isPaymentMode && periodJournalRows.map(jv => (
                  <div key={jv.id} className="flex items-start justify-between gap-6 mt-1.5 pl-3 border-l-2 border-indigo-200">
                    <div className="text-[11px] leading-tight">
                      <div className="text-slate-600">
                        <span className="text-slate-400">Description:</span> <span className="font-semibold text-indigo-800">Discount Allowed</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Journal Voucher ({jv.receipt_number}) · {formatCurrency(jv.payment_amount)}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-indigo-700 whitespace-nowrap">
                      − {formatCurrency(jv.payment_amount)}
                    </span>
                  </div>
                ))}

                {isPaymentMode && (vendorMonthlySummary?.vendorJournalDebit > 0) && (
                  <div className="flex items-start justify-between gap-6 mt-1.5 pl-3 border-l-2 border-emerald-200">
                    <div className="text-[11px] leading-tight">
                      <div className="text-slate-600">
                        <span className="text-slate-400">Description:</span> <span className="font-semibold text-emerald-800">Discount Received</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Journal Voucher (JV) · {formatCurrency(vendorMonthlySummary.vendorJournalDebit)}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                      − {formatCurrency(vendorMonthlySummary.vendorJournalDebit)}
                    </span>
                  </div>
                )}

                {!isPaymentMode && (monthlySummary?.currentMonthCreditNotes > 0) && (
                  <div className="flex items-start justify-between gap-6 mt-1.5 pl-3 border-l-2 border-teal-200">
                    <div className="text-[11px] leading-tight text-slate-600">
                      <span className="text-slate-400">Description:</span> <span className="font-semibold text-teal-800">Credit Notes</span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-teal-700 whitespace-nowrap">
                      − {formatCurrency(monthlySummary.currentMonthCreditNotes)}
                    </span>
                  </div>
                )}
              </div>


              {/* Row 3: Closing Balance */}
              <div className="flex items-center justify-between gap-6 py-2.5 bg-blue-50/50 px-3 rounded-lg border border-blue-200 mt-1">
                <span className="text-xs sm:text-sm font-bold text-slate-900">Outstanding Balance :</span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency((isPaymentMode ? vendorMonthlySummary : monthlySummary)?.closingBalance ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
          </>
        )}

      </div>

      {/* ── Edit Allocation: allocate an On Account vendor payment against bills ── */}
      {allocateTarget && (() => {
        const isReceipt = isReceiptRow(allocateTarget);
        const onAccountLeft = getUnallocatedAmount(allocateTarget);
        const unallocatedLabel = isReceipt
          ? allocateTarget.unallocated_kind
          : ((allocateTarget.allocations || []).some(a => !a.po_id && !a.invoice_id && a.allocation_type === 'Advance') ? 'Advance' : 'On Account');
        const bills = (isReceipt ? invoices : vendorInvoices).filter(b => (parseFloat(b.outstanding) || 0) > 0.005);
        const allocatedTotal = round2(Object.values(allocateAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0));
        const remaining = round2(onAccountLeft - allocatedTotal);
        const overBill = bills.find(b => (parseFloat(allocateAmounts[b.id]) || 0) > round2(b.outstanding) + 0.005);
        const problem = remaining < -0.005
          ? `Allocated ${formatCurrency(allocatedTotal)} is more than the ${unallocatedLabel} amount ${formatCurrency(onAccountLeft)}`
          : overBill
            ? `${overBill.display_invoice_no || overBill.invoice_no}: amount is more than its outstanding ${formatCurrency(overBill.outstanding)}`
            : '';
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeAllocateModal}>
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Edit Allocation</h3>
                  <p className="text-[11px] text-slate-500">
                    Voucher <span className="font-mono font-semibold text-slate-700">{allocateTarget.payment_voucher_no || allocateTarget.payment_receipt_no}</span>
                    {(isReceipt ? selectedCompany?.company_name : selectedVendor?.vendor_name) ? ` · ${isReceipt ? selectedCompany?.company_name : selectedVendor?.vendor_name}` : ''}
                  </p>
                </div>
                <button type="button" onClick={closeAllocateModal} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-slate-100 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{isReceipt ? 'Receipt Amount' : 'Payment Amount'}</div>
                  <div className="font-mono font-bold text-slate-800">{formatCurrency(allocateTarget.payment_amount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                    {unallocatedLabel} (Unallocated)
                  </div>
                  <div className="font-mono font-bold text-amber-700">{formatCurrency(onAccountLeft)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Left After Allocation</div>
                  <div className={`font-mono font-bold ${remaining < -0.005 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(remaining)}</div>
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {bills.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">
                    {isReceipt
                      ? `No unpaid invoices for this customer. The receipt stays ${unallocatedLabel} until an invoice is available.`
                      : 'No unpaid bills for this vendor. The payment stays unallocated until a bill is available.'}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[10.5px] uppercase text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">{isReceipt ? 'Invoice' : 'Bill / PO'}</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-4 py-2 text-right w-44">Allocate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bills.map(b => {
                        const value = allocateAmounts[b.id] ?? '';
                        const isFull = (parseFloat(value) || 0) > 0 && (parseFloat(value) || 0) >= Math.min(round2(b.outstanding), onAccountLeft) - 0.005;
                        const overThis = (parseFloat(value) || 0) > round2(b.outstanding) + 0.005;
                        return (
                          <tr key={b.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 font-mono font-bold text-blue-700">{b.display_invoice_no || b.invoice_no}</td>
                            <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(b.bill_date || b.invoice_date)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{formatCurrency(b.outstanding)}</td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={value}
                                  onChange={(e) => setAllocateAmounts(prev => ({ ...prev, [b.id]: e.target.value }))}
                                  placeholder="0.00"
                                  className={`w-24 text-right font-mono font-semibold border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${overThis ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300'}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleFullAllocation(b)}
                                  className={`px-1.5 py-1 text-[9.5px] font-bold rounded border transition-colors cursor-pointer ${isFull ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}
                                  title={isFull ? 'Click again to clear' : 'Allocate the most this bill can take'}
                                >
                                  Full
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                <div className="text-[11px]">
                  {problem
                    ? <span className="text-rose-600 font-semibold">{problem}</span>
                    : <span className="text-slate-500">Allocating <strong className="font-mono text-slate-800">{formatCurrency(allocatedTotal)}</strong>; the rest stays {unallocatedLabel}.</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={closeAllocateModal} disabled={allocateSaving}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg cursor-pointer disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveAllocation}
                    disabled={allocateSaving || allocatedTotal <= 0 || Boolean(problem)}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                    {allocateSaving ? 'Saving…' : 'Save Allocation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Slide-Over Drawer: Voucher Types (F5/F6/F7...) ── */}
      {isVoucherPanelOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsVoucherPanelOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-sm bg-white shadow-2xl p-5 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 border-l border-slate-200">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold tracking-wider uppercase text-slate-800">
                        Voucher Type
                      </h3>
                      <p className="text-[10.5px] text-slate-400">Select an accounting voucher</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVoucherPanelOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close Drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Vertical list of 6 voucher types */}
                <div className="space-y-2.5">
                  {VOUCHER_OPTIONS.map((v) => {
                    const isSelected = selectedVoucherType === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          handleSelectVoucherType(v.id);
                          setIsVoucherPanelOpen(false);
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-50/70 border-2 border-blue-600 shadow-sm ring-2 ring-blue-500/10'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {v.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                                {v.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {v.desc}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => setIsVoucherPanelOpen(false)}
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Modals Integration ── */}
      {/* Customer / Vendor Modal Fallback */}
      <PaymentReceivedModal
        isOpen={isPaymentModalOpen}
        initialVoucherType={selectedVoucherType}
        customerId={selectedCompanyId}
        companyId={selectedCompanyId}
        vendorId={selectedVendorId}
        vendor={selectedVendor}
        isVendorMode={isPaymentMode || selectedVoucherType === 'PAYMENT'}
        hasExplicitSelection={selectedInvoiceIds.size > 0}
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
          setActiveViewTab('history');
          if (isPaymentMode || selectedVoucherType === 'PAYMENT') {
            if (selectedVendorId) {
              fetchVendorInvoices(selectedVendorId);
              fetchVendorPayments(selectedVendorId);
            }
          } else {
            if (selectedCompanyId) {
              fetchCustomerInvoices(selectedCompanyId);
              fetchCustomerBalance(selectedCompanyId);
              fetchCustomerPaymentHistory(selectedCompanyId);
              fetchMonthlySummary(selectedCompanyId, selectedMonth, fromDate, toDate);
            }
          }
        }}
      />

      {/* ── Vendor Bill & PO Details Modal ── */}
      {selectedBillForDetail && (
        <Modal
          isOpen={Boolean(selectedBillForDetail)}
          onClose={() => {
            setSelectedBillForDetail(null);
            setBillDetailData(null);
          }}
          title={
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm md:text-base">
                Bill & PO Details:
              </span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs md:text-sm">
                {selectedBillForDetail.display_invoice_no || selectedBillForDetail.vendor_invoice_no || selectedBillForDetail.po_number || `BILL-${selectedBillForDetail.id}`}
              </span>
            </div>
          }
          size="5xl"
        >
          <div className="space-y-4 p-1">
            {/* Modal Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-800">
                      {billDetailData?.vendor_name || selectedVendor?.vendor_name || 'Vendor Details'}
                    </span>
                    {/* Status Badge */}
                    {(() => {
                      const outstanding = parseFloat(billDetailData?.outstanding ?? selectedBillForDetail.outstanding ?? 0);
                      const paid = parseFloat(billDetailData?.already_paid ?? selectedBillForDetail.already_paid ?? 0);
                      if (outstanding <= 0) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            PAID
                          </span>
                        );
                      } else if (paid > 0) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            PARTIALLY PAID
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 font-bold border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            PENDING PAYMENT
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    PO Number: <strong className="text-blue-700 font-mono">{selectedBillForDetail.po_number || billDetailData?.po_number || '—'}</strong>
                    {selectedBillForDetail.po_date && (
                      <span className="ml-2 text-slate-400">| Dated: {formatDate(selectedBillForDetail.po_date)}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Quick action buttons in top header */}
              <div className="flex items-center gap-2">
                {(billDetailData?.po_id || selectedBillForDetail.po_id) && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPOPDF(billDetailData?.po_id || selectedBillForDetail.po_id, selectedBillForDetail.po_number)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    title="Download Purchase Order PDF"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download PO PDF</span>
                  </button>
                )}

                {billDetailData?.invoice_pdf_path && (
                  <a
                    href={getFileUrl(billDetailData.invoice_pdf_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                    title="View / Download Uploaded Bill PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View Bill PDF</span>
                  </a>
                )}
              </div>
            </div>

            {/* 4 Financial Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="text-[11px] text-slate-500 font-medium">Total Bill Amount</div>
                <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                  {formatCurrency(parseFloat(billDetailData?.bill_amount || billDetailData?.invoice_amount || billDetailData?.po_amount || selectedBillForDetail.bill_amount || selectedBillForDetail.po_amount || 0))}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Bill Date: {formatDate(billDetailData?.bill_date || billDetailData?.invoice_date || selectedBillForDetail.bill_date)}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                <div className="text-[11px] text-emerald-700 font-medium">Already Paid</div>
                <div className="text-base font-extrabold font-mono text-emerald-800 mt-0.5">
                  {formatCurrency(parseFloat(billDetailData?.already_paid ?? selectedBillForDetail.already_paid ?? 0))}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5">
                  Settled via Vouchers
                </div>
              </div>

              <div className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-xl">
                <div className="text-[11px] text-rose-700 font-medium">Pending Balance</div>
                <div className="text-base font-extrabold font-mono text-rose-800 mt-0.5">
                  {formatCurrency(parseFloat(billDetailData?.outstanding ?? selectedBillForDetail.outstanding ?? 0))}
                </div>
                <div className="text-[10px] text-rose-600 mt-0.5">
                  Outstanding Due
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                <div className="text-[11px] text-blue-700 font-medium">Purchase Order Date</div>
                <div className="text-xs font-bold text-blue-900 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{formatDate(billDetailData?.po_date || selectedBillForDetail.po_date)}</span>
                </div>
                <div className="text-[10px] text-blue-600 mt-0.5 font-mono">
                  PO: {billDetailData?.po_number || selectedBillForDetail.po_number || '—'}
                </div>
              </div>
            </div>

            {/* Bill & PO Metadata Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Vendor Information</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500">Name:</span>
                  <span className="col-span-2 font-semibold text-slate-800">{billDetailData?.vendor_name || selectedVendor?.vendor_name || '—'}</span>
                  <span className="text-slate-500">Location:</span>
                  <span className="col-span-2 text-slate-700">{selectedVendor?.location || billDetailData?.vendor_location || '—'}</span>
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="col-span-2 font-mono text-slate-700">{selectedVendor?.gstin || billDetailData?.vendor_gstin || '—'}</span>
                  <span className="text-slate-500">Email:</span>
                  <span className="col-span-2 text-slate-700">{billDetailData?.vendor_email || selectedVendor?.email || '—'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Order & Terms Specifications</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500">Project:</span>
                  <span className="col-span-2 text-slate-800 font-medium">{billDetailData?.project_name || '—'}</span>
                  <span className="text-slate-500">MR Number:</span>
                  <span className="col-span-2 font-mono text-slate-700">{billDetailData?.mr_number || '—'}</span>
                  <span className="text-slate-500">Drawing No:</span>
                  <span className="col-span-2 font-mono text-slate-700">{billDetailData?.drawing_no || '—'}</span>
                  <span className="text-slate-500">Payment Terms:</span>
                  <span className="col-span-2 text-slate-700 font-medium">{billDetailData?.payment_terms || 'Standard Terms'}</span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Purchase Order Line Items ({billDetailData?.items?.length || 0})
                  </h3>
                </div>
                {billDetailLoading && (
                  <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Loading items...
                  </span>
                )}
              </div>

              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 text-[10.5px] uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">#</th>
                      <th className="px-3 py-2">Item Code & Name</th>
                      <th className="px-3 py-2">Description / Specs</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-center">Unit</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">GST</th>
                      <th className="px-3 py-2 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billDetailData?.items && billDetailData.items.length > 0 ? (
                      billDetailData.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-800 font-mono text-[11px]">{item.item_code || '—'}</div>
                            <div className="text-[10px] text-slate-500">{item.material_name || item.material_type || ''}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-xs truncate text-[11px]">
                            {item.description || item.drawing_no || '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 text-[11px]">
                            {item.quantity ?? item.design_qty ?? 0}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-500 text-[10.5px]">
                            {item.unit || item.uom || 'NOS'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 text-[11px]">
                            {formatCurrency(parseFloat(item.unit_rate || item.rate || 0))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500 text-[10.5px]">
                            {parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0) > 0 
                              ? formatCurrency(parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0)) 
                              : (item.gst_rate ? `${item.gst_rate}%` : '0%')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 text-[11px]">
                            {formatCurrency(parseFloat(item.total_amount || item.amount || 0))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-slate-400 italic">
                          {billDetailLoading ? 'Loading line items...' : 'No item breakdown found for this purchase order / bill.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Associated Payment Vouchers / History for this Bill */}
            {billDetailData?.payments && billDetailData.payments.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50/70 px-4 py-2 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                      Payments Settled Against This Bill ({billDetailData.payments.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700">
                    Total Settled: {formatCurrency(billDetailData.payments.reduce((s, p) => s + (parseFloat(p.payment_amount) || 0), 0))}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 text-slate-600 text-[10.5px] uppercase">
                      <tr>
                        <th className="px-3 py-1.5">Voucher #</th>
                        <th className="px-3 py-1.5">Payment Date</th>
                        <th className="px-3 py-1.5">Mode</th>
                        <th className="px-3 py-1.5">Ref / Bank</th>
                        <th className="px-3 py-1.5 text-right">Amount Paid</th>
                        <th className="px-3 py-1.5 text-center">Status</th>
                        <th className="px-3 py-1.5 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {billDetailData.payments.map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-slate-50/80">
                          <td className="px-3 py-1.5 font-mono font-bold text-slate-800 text-[11px]">
                            {p.payment_voucher_no || `PV-${p.id}`}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600 text-[11px]">
                            {formatDate(p.payment_date || p.created_at)}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 uppercase">
                              {p.payment_mode || 'BANK'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-slate-500 font-mono text-[10.5px]">
                            {p.transaction_ref_no || p.cheque_number || p.bank_name || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700 text-[11px]">
                            {formatCurrency(p.payment_amount)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              {p.status || 'CONFIRMED'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDownloadVendorVoucher(p.id, p.payment_voucher_no)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition cursor-pointer"
                              title="Download Voucher PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedBillForDetail(null);
                  setBillDetailData(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>

              {parseFloat(billDetailData?.outstanding ?? selectedBillForDetail.outstanding ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const billToPay = selectedBillForDetail;
                    setSelectedBillForDetail(null);
                    setBillDetailData(null);
                    handleOpenVendorPayment(billToPay);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Record Payment for this Bill ({formatCurrency(parseFloat(billDetailData?.outstanding ?? selectedBillForDetail.outstanding ?? 0))})</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <Check className="w-4 h-4" />
                  <span>This Bill is Fully Paid</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Vendor Process Payment Modal */}
      <ProcessPaymentModal
        isOpen={isProcessPaymentModalOpen}
        invoice={selectedVendorInvoice}
        onClose={() => {
          setIsProcessPaymentModalOpen(false);
          setSelectedVendorInvoice(null);
        }}
        onSuccess={() => {
          setIsProcessPaymentModalOpen(false);
          setSelectedVendorInvoice(null);
          if (selectedVendorId) {
            fetchVendorInvoices(selectedVendorId);
            fetchVendorPayments(selectedVendorId);
          }
        }}
      />
    </div>
  );
};

export default RecordPaymentReceived;
