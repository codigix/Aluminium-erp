import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CreditCard, Calendar, Check, AlertCircle, RefreshCw, 
  Building2, FileText, Layers, ArrowRight, ArrowLeft, DollarSign, 
  SlidersHorizontal, CheckCircle2, History, ArrowLeftRight, FileMinus, FilePlus, BookOpen, AlertTriangle, Printer, X,
  Plus, Trash2, Search
} from 'lucide-react';
import { Modal, FormControl, SearchableSelect } from './ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import { LEDGER_GROUPS } from '../constants/ledgerGroups.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value, currency = 'INR') => {
  if (value === null || value === undefined || isNaN(value)) return '—';
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

const PaymentReceivedModal = ({
  isOpen,
  onClose,
  invoice,
  invoices,
  customerId,
  companyId,
  onSuccess,
  isPage = false,
  initialVoucherType = 'RECEIPT'
}) => {
  // Normalize incoming selection
  const selectedInvoices = useMemo(() => {
    if (Array.isArray(invoices) && invoices.length > 0) return invoices;
    if (invoice) return [invoice];
    return [];
  }, [invoices, invoice]);

  const isMultiMode = selectedInvoices.length > 1;
  const isSingleMode = selectedInvoices.length === 1;
  const singleInvoice = isSingleMode ? selectedInvoices[0] : (invoice || null);

  // ── 6 ACCOUNTING VOUCHER TYPES ──
  const voucherTypes = [
    { 
      id: 'PAYMENT', 
      name: 'Payment', 
      title: 'Payment Entry', 
      desc: 'Money paid to a vendor, supplier, or party for expenses / payables.',
      icon: <ArrowRight className="w-3.5 h-3.5" /> 
    },
    { 
      id: 'RECEIPT', 
      name: 'Receipt', 
      title: 'Receipt Entry', 
      desc: 'Money received from a customer or another party.',
      icon: <ArrowLeft className="w-3.5 h-3.5" /> 
    },
    { 
      id: 'JOURNAL', 
      name: 'Journal', 
      title: 'Journal Entry', 
      desc: 'Adjustment between accounts, depreciation, or non-cash transactions.',
      icon: <BookOpen className="w-3.5 h-3.5" /> 
    },
    { 
      id: 'CONTRA', 
      name: 'Contra', 
      title: 'Contra Entry', 
      desc: 'Internal fund transfer between cash and bank accounts.',
      icon: <ArrowLeftRight className="w-3.5 h-3.5" /> 
    },
    { 
      id: 'DEBIT_NOTE', 
      name: 'Debit Note', 
      title: 'Debit Note Entry', 
      desc: 'Debit note issued to a supplier / customer for returns, shortages, or rate adjustments.',
      icon: <FileMinus className="w-3.5 h-3.5" /> 
    },
    { 
      id: 'CREDIT_NOTE', 
      name: 'Credit Note', 
      title: 'Credit Note Entry', 
      desc: 'Credit note issued to a customer / supplier for sales returns, rebates, or price corrections.',
      icon: <FilePlus className="w-3.5 h-3.5" /> 
    },
  ];

  // Active Voucher Type State (Default to initialVoucherType or RECEIPT)
  const [voucherType, setVoucherType] = useState(initialVoucherType || 'RECEIPT');

  useEffect(() => {
    if (initialVoucherType) {
      setVoucherType(initialVoucherType);
    }
  }, [initialVoucherType]);
  const [previewVoucherData, setPreviewVoucherData] = useState(null);

  // Allocations mapping for company bills: { [invId]: stringAmount }
  const [allocations, setAllocations] = useState({});
  const [lumpSumAmount, setLumpSumAmount] = useState('');

  // + Add Agst Ref State (manual addition and bill removal)
  const [isAddAgstRefModalOpen, setIsAddAgstRefModalOpen] = useState(false);
  const [manuallyAddedInvoices, setManuallyAddedInvoices] = useState([]);
  const [removedBillIds, setRemovedBillIds] = useState(new Set());
  const [agstRefSearch, setAgstRefSearch] = useState('');
  const [activeAgstRefTab, setActiveAgstRefTab] = useState('existing'); // 'existing' | 'custom'
  const [customRefInput, setCustomRefInput] = useState({
    invoice_no: '',
    so_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    credit_days: 60,
    outstanding: '',
  });

  // Receipt / Existing Customer Payment Form State
  const [formData, setFormData] = useState({
    customerId: '',
    salesOrderId: '',
    invoiceId: null,
    soId: '',
    salesOrderSource: 'SALES_ORDER',
    paymentAmount: '',
    paymentDate: '',
    paymentMode: '',
    bankAccount: '',
    manualBankAccount: '',
    transactionRefNo: '',
    remarks: '',
    upiApp: '',
    upiTransactionId: '',
    chequeNumber: '',
    bankName: '',
    chequeDate: '',
    cardType: '',
    last4Digits: '',
    authorizationCode: '',
  });

  // Dedicated Accounting Voucher Forms State (Payment, Journal, Contra, Debit Note, Credit Note)
  const [voucherForm, setVoucherForm] = useState({
    date: new Date().toISOString().split('T')[0],
    narration: '',

    // Payment fields
    payee: '',
    paymentDebitLedger: 'Sundry Creditors (Vendors)',
    paymentCreditLedger: '',
    paymentAmount: '',
    paymentMode: 'BANK_TRANSFER',
    paymentBankAccount: '',
    paymentChequeRef: '',

    // Journal fields
    journalDebitLedger: 'Office Equipment',
    journalCreditLedger: 'Accumulated Depreciation',
    journalDebitAmount: '',
    journalCreditAmount: '',
    journalRefDoc: '',

    // Contra fields
    contraFromAccount: 'Cash in Hand',
    contraToAccount: '',
    contraAmount: '',
    contraRefNo: '',

    // Debit Note fields
    debitParty: '',
    debitAffectedLedger: 'Purchase Returns',
    debitRefDoc: '',
    debitAmount: '',
    debitReason: 'Purchase Return',

    // Credit Note fields
    creditParty: '',
    creditAffectedLedger: 'Sales Returns',
    creditRefDoc: '',
    creditAmount: '',
    creditReason: 'Sales Return',
  });

  const [errors, setErrors] = useState({});
  const [voucherErrors, setVoucherErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [customerSalesOrders, setCustomerSalesOrders] = useState([]);
  const [customerBalance, setCustomerBalance] = useState(null);
  const [fullSODetail, setFullSODetail] = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [installments, setInstallments] = useState([]);
  const [fetchingInstallments, setFetchingInstallments] = useState(false);
  const [lastFetchedCheque, setLastFetchedCheque] = useState(null);

  // Generate realistic voucher numbering
  const getVoucherNumber = (type) => {
    const year = new Date().getFullYear();
    switch (type) {
      case 'PAYMENT': return `PV-${year}-0185`;
      case 'RECEIPT': return `RCP-${year}-0428`;
      case 'JOURNAL': return `JV-${year}-0092`;
      case 'CONTRA': return `CV-${year}-0034`;
      case 'DEBIT_NOTE': return `DN-${year}-0067`;
      case 'CREDIT_NOTE': return `CN-${year}-0051`;
      default: return `VCH-${year}-0001`;
    }
  };

  // Auto-fetch customer's last cheque details if available
  const fetchCustomerLastCheque = async (customerId) => {
    if (!customerId) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/customer-payments?customerId=${customerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const payments = await res.json();
        if (Array.isArray(payments) && payments.length > 0) {
          const withCheque = payments.find(p => p.cheque_number);
          if (withCheque && withCheque.cheque_number) {
            setLastFetchedCheque(withCheque.cheque_number);
            setFormData(prev => {
              const updatedCheque = prev.chequeNumber || withCheque.cheque_number;
              const updatedBankName = prev.bankName || withCheque.cheque_bank_name || '';
              const bank = bankAccounts.find(b => String(b.id) === String(prev.bankAccount));
              const bankDesc = bank ? `Bank: ${bank.bank_name} (A/C: ${bank.account_number}, IFSC: ${bank.ifsc_code || '—'})` : '';
              const chqDesc = updatedCheque ? `Cheque No: ${updatedCheque}` : '';
              const autoDesc = [bankDesc, chqDesc].filter(Boolean).join(' | ');
              const shouldUpdate = !prev.remarks || prev.remarks.startsWith('Bank:') || prev.remarks.startsWith('Cheque:');
              return {
                ...prev,
                chequeNumber: updatedCheque,
                bankName: updatedBankName,
                remarks: shouldUpdate && autoDesc ? autoDesc : prev.remarks
              };
            });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching customer last cheque:', err);
    }
  };

  // Fetch customer ledger balance (for Up to: ₹... Dr/Cr)
  const fetchCustomerLedgerBalance = async (customerId) => {
    if (!customerId) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/customer-payments/customer/${customerId}/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerBalance(data);
      }
    } catch (err) {
      console.error('Error fetching customer balance:', err);
    }
  };

  // Fetch registered bank accounts
  const fetchBankAccounts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        setBankAccounts(list.filter(b => b.is_active !== false && b.is_active !== 0));
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
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
        setVendors(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchInstallmentHistory = async (soId, source, invId, custId) => {
    if (!soId && !invId && !custId) return;
    try {
      setFetchingInstallments(true);
      const token = localStorage.getItem('authToken');
      const param = custId
        ? `customerId=${custId}&status=CONFIRMED`
        : source === 'SALES_INVOICE'
        ? `invoiceId=${invId || soId}&salesOrderSource=${source}`
        : `salesOrderId=${soId}&salesOrderSource=${source}`;
      const response = await fetch(`${API_BASE}/customer-payments?${param}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setInstallments(Array.isArray(data) ? data : []);
      } else {
        setInstallments([]);
      }
    } catch (error) {
      console.error('Error fetching installments:', error);
      setInstallments([]);
    } finally {
      setFetchingInstallments(false);
    }
  };

  const fetchFullSODetail = async (soId, source = 'SALES_ORDER', invId) => {
    if (!soId && !invId) return;
    try {
      setFetchingDetail(true);
      const token = localStorage.getItem('authToken');
      const endpoint = source === 'SALES_INVOICE'
        ? `${API_BASE}/sales-invoices/${invId || soId}`
        : source === 'DIRECT_ORDER'
        ? `${API_BASE}/order/${soId}`
        : `${API_BASE}/sales-orders/${soId}`;
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFullSODetail(data);
      } else {
        setFullSODetail(null);
      }
    } catch (error) {
      console.error('Error fetching SO detail:', error);
      setFullSODetail(null);
    } finally {
      setFetchingDetail(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchCustomerInvoices = async (customerId) => {
    try {
      const token = localStorage.getItem('authToken');
      const url = customerId 
        ? `${API_BASE}/customer-payments/customer/${customerId}/outstanding`
        : `${API_BASE}/customer-payments/outstanding`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomerInvoices(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customer invoices:', error);
    }
  };

  const fetchCustomerSalesOrders = async (customerId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/customer/${customerId}/outstanding`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomerSalesOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customer sales orders:', error);
    }
  };

  // Customer switch handler (Top company selection)
  const handleCustomerChange = (newCustId) => {
    setFormData(prev => ({
      ...prev,
      customerId: newCustId,
      salesOrderId: '',
      invoiceId: null,
      soId: '',
      paymentAmount: ''
    }));
    setVoucherForm(prev => ({ ...prev, creditParty: newCustId }));
    setAllocations({});
    setLumpSumAmount('');
    setRemovedBillIds(new Set());
    setManuallyAddedInvoices([]);
    if (newCustId) {
      fetchCustomerInvoices(newCustId);
      fetchCustomerSalesOrders(newCustId);
      fetchCustomerLedgerBalance(newCustId);
      fetchCustomerLastCheque(newCustId);
      fetchInstallmentHistory(null, 'SALES_INVOICE', null, newCustId);
    } else {
      setCustomerInvoices([]);
      setCustomerBalance(null);
      setInstallments([]);
    }
  };

  // Initialize data on modal open
  useEffect(() => {
    if (isOpen) {
      setRemovedBillIds(new Set());
      setManuallyAddedInvoices([]);
      fetchBankAccounts();
      fetchCustomers();
      fetchVendors();

      const incomingCustId = customerId
        || companyId
        || selectedInvoices[0]?.customer_id 
        || selectedInvoices[0]?.company_id 
        || selectedInvoices[0]?.client_id 
        || singleInvoice?.customer_id 
        || singleInvoice?.company_id 
        || singleInvoice?.client_id 
        || '';

      if (incomingCustId) {
        fetchCustomerLastCheque(incomingCustId);
        fetchCustomerInvoices(incomingCustId);
        fetchCustomerLedgerBalance(incomingCustId);
        fetchInstallmentHistory(null, 'SALES_INVOICE', null, incomingCustId);
      }

      if (isMultiMode) {
        // Multi-invoice initialization
        const initialAlloc = {};
        let totalOut = 0;
        selectedInvoices.forEach(inv => {
          const out = parseFloat(inv.outstanding) || 0;
          initialAlloc[inv.id] = out > 0 ? out.toFixed(2) : '0.00';
          totalOut += out;
        });
        setAllocations(initialAlloc);
        setLumpSumAmount(totalOut > 0 ? totalOut.toFixed(2) : '');

        setFullSODetail(null);
        setFormData({
          customerId: incomingCustId,
          salesOrderId: '',
          invoiceId: null,
          soId: '',
          salesOrderSource: 'SALES_INVOICE',
          paymentAmount: totalOut > 0 ? totalOut.toFixed(2) : '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: '',
          bankAccount: '',
          manualBankAccount: '',
          transactionRefNo: '',
          remarks: '',
          upiApp: '',
          upiTransactionId: '',
          chequeNumber: '',
          bankName: '',
          chequeDate: '',
          cardType: '',
          last4Digits: '',
          authorizationCode: '',
        });
      } else if (singleInvoice) {
        // Single invoice mode
        const soId = singleInvoice.sales_order_id || singleInvoice.id || '';
        const source = singleInvoice.sales_order_source || singleInvoice.source || 'SALES_ORDER';
        const invId = singleInvoice.invoice_id || (source === 'SALES_INVOICE' ? singleInvoice.id : null);

        fetchFullSODetail(soId, source, invId);

        const outAmt = singleInvoice.outstanding 
          ? parseFloat(singleInvoice.outstanding).toFixed(2) 
          : (singleInvoice.total_amount ? parseFloat(singleInvoice.total_amount).toFixed(2) : '');

        setAllocations({ [singleInvoice.id]: outAmt });
        setLumpSumAmount(outAmt);

        setFormData({
          customerId: incomingCustId,
          salesOrderId: soId,
          invoiceId: invId,
          soId: singleInvoice.soId || (source && soId ? `${source}_${soId}` : ''),
          salesOrderSource: source,
          paymentAmount: outAmt,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: '',
          bankAccount: '',
          manualBankAccount: '',
          transactionRefNo: '',
          remarks: '',
          upiApp: '',
          upiTransactionId: '',
          chequeNumber: '',
          bankName: '',
          chequeDate: '',
          cardType: '',
          last4Digits: '',
          authorizationCode: '',
        });
      } else {
        // Freeform selection mode with incoming customer ID
        setFullSODetail(null);
        setInstallments([]);
        setAllocations({});
        setLumpSumAmount('');
        setFormData({
          customerId: incomingCustId,
          salesOrderId: '',
          invoiceId: null,
          soId: '',
          salesOrderSource: 'SALES_INVOICE',
          paymentAmount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: '',
          bankAccount: '',
          manualBankAccount: '',
          transactionRefNo: '',
          remarks: '',
          upiApp: '',
          upiTransactionId: '',
          chequeNumber: '',
          bankName: '',
          chequeDate: '',
          cardType: '',
          last4Digits: '',
          authorizationCode: '',
        });
      }

      setErrors({});
      setVoucherErrors({});
    }
  }, [isOpen, invoice, invoices]);

  useEffect(() => {
    if (formData.customerId && !singleInvoice && !isMultiMode && isOpen) {
      fetchCustomerInvoices(formData.customerId);
      fetchCustomerSalesOrders(formData.customerId);
      fetchCustomerLedgerBalance(formData.customerId);
    }
  }, [formData.customerId, singleInvoice, isMultiMode, isOpen]);

  // Combined list of bill references for the selected company (only explicitly selected or manually added references with outstanding > 0)
  const companyBillReferences = useMemo(() => {
    const map = new Map();

    // 1. Initial base list: start ONLY with selectedInvoices (invoices selected on main page or single invoice)
    (selectedInvoices || []).forEach(inv => {
      const out = parseFloat(inv?.outstanding) || 0;
      if (inv && inv.id && !removedBillIds.has(String(inv.id)) && out > 0) {
        if (!map.has(String(inv.id))) {
          map.set(String(inv.id), inv);
        } else {
          map.set(String(inv.id), { ...map.get(String(inv.id)), ...inv });
        }
      }
    });

    // 2. Add manually added invoices (via + Add Agst Ref modal) or custom references
    (manuallyAddedInvoices || []).forEach(inv => {
      if (inv && inv.id && !removedBillIds.has(String(inv.id))) {
        map.set(String(inv.id), inv);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.invoice_date || a.created_at || 0).getTime();
      const dateB = new Date(b.invoice_date || b.created_at || 0).getTime();
      return dateA - dateB;
    });
  }, [selectedInvoices, manuallyAddedInvoices, removedBillIds]);

  // List of available unadded invoices of this customer that user can add via + Add Agst Ref
  const unaddedCustomerInvoices = useMemo(() => {
    const currentIds = new Set(companyBillReferences.map(b => String(b.id)));
    return (customerInvoices || []).filter(inv => {
      if (!inv || !inv.id) return false;
      const out = parseFloat(inv.outstanding) || 0;
      if (out <= 0) return false; // Only pending invoices with outstanding balance
      if (currentIds.has(String(inv.id))) return false;
      if (agstRefSearch.trim()) {
        const q = agstRefSearch.toLowerCase();
        const num = (inv.invoice_no || '').toLowerCase();
        const so = (inv.so_number || '').toLowerCase();
        const po = (inv.customer_po_no || '').toLowerCase();
        return num.includes(q) || so.includes(q) || po.includes(q);
      }
      return true;
    });
  }, [customerInvoices, companyBillReferences, agstRefSearch]);

  // Handler to add a specific outstanding invoice into the allocation table
  const handleAddInvoiceToTable = (inv) => {
    const invCustId = inv.company_id || inv.customer_id || inv.client_id;
    if (invCustId) {
      setFormData(prev => ({ ...prev, customerId: String(invCustId) }));
      setVoucherForm(prev => ({ ...prev, creditParty: String(invCustId) }));
      fetchCustomerLedgerBalance(invCustId);
      fetchCustomerLastCheque(invCustId);
      fetchInstallmentHistory(null, 'SALES_INVOICE', null, invCustId);
    }

    setRemovedBillIds(prev => {
      const next = new Set(prev);
      next.delete(String(inv.id));
      return next;
    });

    const fullInv = {
      ...inv,
      customer_id: invCustId || inv.customer_id
    };

    setManuallyAddedInvoices(prev => {
      if (prev.some(b => String(b.id) === String(inv.id))) return prev;
      return [...prev, fullInv];
    });

    // Pre-allocate the newly added bill with its full due amount
    const out = parseFloat(inv.outstanding) || 0;
    setAllocations(prev => {
      const updated = { ...prev, [inv.id]: out > 0 ? out.toFixed(2) : '0.00' };
      const sum = Object.values(updated).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      setFormData(f => ({
        ...f,
        customerId: invCustId ? String(invCustId) : f.customerId,
        paymentAmount: sum > 0 ? sum.toFixed(2) : ''
      }));
      return updated;
    });
    successToast(`Added ${inv.invoice_no || inv.so_number || 'bill'} (${inv.company_name || 'Customer'})`);
  };

  // Handler to add all available outstanding invoices into the table
  const handleAddAllAvailableInvoices = () => {
    if (unaddedCustomerInvoices.length === 0) return;
    const firstCustId = unaddedCustomerInvoices[0]?.company_id || unaddedCustomerInvoices[0]?.customer_id || unaddedCustomerInvoices[0]?.client_id;
    if (firstCustId) {
      setFormData(prev => ({ ...prev, customerId: String(firstCustId) }));
      setVoucherForm(prev => ({ ...prev, creditParty: String(firstCustId) }));
      fetchCustomerLedgerBalance(firstCustId);
      fetchCustomerLastCheque(firstCustId);
      fetchInstallmentHistory(null, 'SALES_INVOICE', null, firstCustId);
    }

    setRemovedBillIds(prev => {
      const next = new Set(prev);
      unaddedCustomerInvoices.forEach(inv => next.delete(String(inv.id)));
      return next;
    });

    setManuallyAddedInvoices(prev => {
      const existingIds = new Set(prev.map(p => String(p.id)));
      const toAdd = unaddedCustomerInvoices
        .filter(inv => !existingIds.has(String(inv.id)))
        .map(inv => ({
          ...inv,
          customer_id: inv.company_id || inv.customer_id || firstCustId
        }));
      return [...prev, ...toAdd];
    });

    // Pre-allocate full amount
    setAllocations(prev => {
      const updated = { ...prev };
      unaddedCustomerInvoices.forEach(inv => {
        const out = parseFloat(inv.outstanding) || 0;
        updated[inv.id] = out > 0 ? out.toFixed(2) : '0.00';
      });
      const sum = Object.values(updated).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      setFormData(f => ({
        ...f,
        customerId: firstCustId ? String(firstCustId) : f.customerId,
        paymentAmount: sum > 0 ? sum.toFixed(2) : ''
      }));
      return updated;
    });
    successToast(`Added ${unaddedCustomerInvoices.length} outstanding invoice(s)`);
    setIsAddAgstRefModalOpen(false);
  };

  // Handler to remove a bill reference from the active table
  const handleRemoveBill = (invId) => {
    setRemovedBillIds(prev => new Set([...prev, String(invId)]));
    setAllocations(prev => {
      const next = { ...prev };
      delete next[invId];
      const sum = Object.values(next).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      setFormData(f => ({ ...f, paymentAmount: sum > 0 ? sum.toFixed(2) : '0.00' }));
      return next;
    });
  };

  // Handler to add a custom/manual reference into the table
  const handleAddCustomRef = () => {
    if (!customRefInput.invoice_no.trim()) {
      errorToast('Please enter an Invoice / Reference Number');
      return;
    }
    const outAmt = parseFloat(customRefInput.outstanding);
    if (isNaN(outAmt) || outAmt <= 0) {
      errorToast('Please enter a valid outstanding amount');
      return;
    }
    const customId = `custom-${Date.now()}`;
    const newRef = {
      id: customId,
      customer_id: formData.customerId || customerId || companyId,
      invoice_no: customRefInput.invoice_no.trim(),
      so_number: customRefInput.so_number.trim() || null,
      invoice_date: customRefInput.invoice_date || new Date().toISOString().split('T')[0],
      credit_days: parseInt(customRefInput.credit_days, 10) || 60,
      outstanding: outAmt.toFixed(2),
      total_amount: outAmt.toFixed(2),
      is_custom: true
    };
    setManuallyAddedInvoices(prev => [...prev, newRef]);
    setAllocations(prev => {
      const updated = { ...prev, [customId]: outAmt.toFixed(2) };
      const sum = Object.values(updated).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      setFormData(f => ({ ...f, paymentAmount: sum > 0 ? sum.toFixed(2) : '' }));
      return updated;
    });
    setCustomRefInput({
      invoice_no: '',
      so_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      credit_days: 60,
      outstanding: ''
    });
    setIsAddAgstRefModalOpen(false);
    successToast(`Added Agst Ref ${newRef.invoice_no}`);
  };

  const currentCustomerObj = customers.find(c => String(c.id) === String(formData.customerId));
  const customerName = currentCustomerObj?.company_name
    || selectedInvoices[0]?.company_name 
    || selectedInvoices[0]?.customer_name 
    || singleInvoice?.customer_name 
    || singleInvoice?.company_name 
    || customerInvoices[0]?.company_name 
    || 'Select Company / Customer';

  // Calculations for company bills
  const totalSelectedInvoiced = useMemo(() => {
    return companyBillReferences.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
  }, [companyBillReferences]);

  const totalSelectedOutstanding = useMemo(() => {
    return companyBillReferences.reduce((sum, inv) => sum + (parseFloat(inv.outstanding) || 0), 0);
  }, [companyBillReferences]);

  const totalAllocated = useMemo(() => {
    return companyBillReferences.reduce((sum, inv) => sum + (parseFloat(allocations[inv.id]) || 0), 0);
  }, [companyBillReferences, allocations]);

  // Dynamic Up To Balance (from Customer Ledger or Outstanding sum)
  const rawLedgerBalance = customerBalance?.outstanding !== undefined
    ? parseFloat(customerBalance.outstanding)
    : totalSelectedOutstanding;

  const upToAmount = Math.abs(rawLedgerBalance);
  const upToDrCr = rawLedgerBalance < 0 ? 'Cr' : 'Dr';

  // Allocation handlers with validation
  const handleAllocationChange = (invId, val) => {
    const inv = companyBillReferences.find(b => String(b.id) === String(invId));
    const out = inv ? (parseFloat(inv.outstanding) || 0) : 0;
    let numericVal = parseFloat(val);

    if (!isNaN(numericVal)) {
      if (numericVal < 0) {
        val = '0.00';
      } else if (out > 0 && numericVal > out) {
        errorToast(`Allocation cannot exceed invoice outstanding of ${formatCurrency(out)}`);
        val = out.toFixed(2);
      }
    }

    const updated = { ...allocations, [invId]: val };
    setAllocations(updated);
    const sum = companyBillReferences.reduce((s, b) => s + (parseFloat(updated[b.id]) || 0), 0);
    setFormData(prev => ({ ...prev, paymentAmount: sum > 0 ? sum.toFixed(2) : '' }));
  };

  // Automatic distribution when user enters receipt amount once
  const handleReceiptAmountChange = (rawVal) => {
    setFormData(prev => ({ ...prev, paymentAmount: rawVal }));

    const total = parseFloat(rawVal);
    if (isNaN(total) || total <= 0) {
      const emptyAlloc = {};
      companyBillReferences.forEach(inv => {
        emptyAlloc[inv.id] = '';
      });
      setAllocations(emptyAlloc);
      return;
    }

    // Sort companyBillReferences by oldest due invoice first (consistent order)
    const sorted = [...companyBillReferences].sort((a, b) => {
      const dateA = new Date(a.invoice_date || a.created_at || 0).getTime();
      const dateB = new Date(b.invoice_date || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    let remaining = total;
    const updated = {};

    sorted.forEach(inv => {
      const out = parseFloat(inv.outstanding) || 0;
      const alloc = Math.min(remaining, out);
      updated[inv.id] = alloc > 0 ? alloc.toFixed(2) : '';
      remaining = Math.max(0, remaining - alloc);
    });

    // If receipt amount exceeds total outstanding of all invoices, show informational toast
    if (remaining > 0 && sorted.length > 0) {
      // All bills fully allocated, remaining unallocated
    }

    setAllocations(updated);
  };

  const handleSetFullAllocation = (inv) => {
    const out = parseFloat(inv.outstanding) || 0;
    handleAllocationChange(inv.id, out.toFixed(2));
    if (voucherType === 'CREDIT_NOTE') {
      setVoucherForm(prev => ({ ...prev, creditRefDoc: inv.invoice_no || `INV-${inv.id}`, creditAmount: out.toFixed(2) }));
    }
  };

  const handleAllocateAllFull = () => {
    const updated = {};
    let sum = 0;
    companyBillReferences.forEach(inv => {
      const out = parseFloat(inv.outstanding) || 0;
      updated[inv.id] = out.toFixed(2);
      sum += out;
    });
    setAllocations(updated);
    setFormData(prev => ({ ...prev, paymentAmount: sum.toFixed(2) }));
  };

  const handleClearAllAllocations = () => {
    const updated = {};
    companyBillReferences.forEach(inv => {
      updated[inv.id] = '';
    });
    setAllocations(updated);
    setFormData(prev => ({ ...prev, paymentAmount: '' }));
  };

  const handleDistributeLumpSum = () => {
    const total = parseFloat(lumpSumAmount);
    if (isNaN(total) || total <= 0) {
      errorToast('Please enter a valid positive lump-sum amount');
      return;
    }
    handleReceiptAmountChange(lumpSumAmount);
    successToast(`Allocated ₹${total.toFixed(2)} across company bills`);
  };

  const paymentModes = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'CASH', label: 'Cash' }
  ];

  const upiApps = [
    { value: 'PHONEPE', label: 'PhonePe' },
    { value: 'GOOGLE_PAY', label: 'Google Pay' },
    { value: 'PAYTM', label: 'Paytm' }
  ];

  const handleInputChange = (field, value) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'salesOrderId' && value) {
      const selectedInv = customerInvoices.find(inv => inv.id.toString() === value.toString());
      if (selectedInv) {
        fetchInstallmentHistory(selectedInv.id, selectedInv.source);
      }
    }

    // Auto-reflect bank account details into remarks
    if (field === 'bankAccount' && value && value !== '__custom__') {
      const selectedBank = bankAccounts.find(b => String(b.id) === String(value));
      if (selectedBank) {
        const bankDesc = `Bank: ${selectedBank.bank_name} (A/C: ${selectedBank.account_number}, IFSC: ${selectedBank.ifsc_code || '—'})`;
        const chqDesc = formData.chequeNumber ? `Cheque No: ${formData.chequeNumber}` : '';
        const autoDesc = [bankDesc, chqDesc].filter(Boolean).join(' | ');
        setFormData(prev => {
          const shouldUpdate = !prev.remarks || prev.remarks.startsWith('Bank:') || prev.remarks.startsWith('Cheque:');
          return {
            ...prev,
            bankAccount: value,
            remarks: shouldUpdate ? autoDesc : prev.remarks
          };
        });
        return;
      }
    }

    if (field === 'chequeNumber' && value) {
      const bank = bankAccounts.find(b => String(b.id) === String(formData.bankAccount));
      const bankDesc = bank ? `Bank: ${bank.bank_name} (A/C: ${bank.account_number}, IFSC: ${bank.ifsc_code || '—'})` : '';
      const chqDesc = `Cheque No: ${value}`;
      const autoDesc = [bankDesc, chqDesc].filter(Boolean).join(' | ');
      setFormData(prev => {
        const shouldUpdate = !prev.remarks || prev.remarks.startsWith('Bank:') || prev.remarks.startsWith('Cheque:');
        return {
          ...prev,
          chequeNumber: value,
          remarks: shouldUpdate ? autoDesc : prev.remarks
        };
      });
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVoucherInputChange = (field, value) => {
    setVoucherForm(prev => ({ ...prev, [field]: value }));
    if (voucherErrors[field]) {
      setVoucherErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // Receipt Validation
  const validateReceiptForm = () => {
    const newErrors = {};

    const activeCustId = formData.customerId || customerId || companyId || singleInvoice?.customer_id;
    if (!activeCustId) {
      newErrors.customerId = 'Customer is required';
    }

    if (companyBillReferences.length > 0) {
      const sumAllocated = companyBillReferences.reduce((s, inv) => s + (parseFloat(allocations[inv.id]) || 0), 0);
      const enteredTotal = parseFloat(formData.paymentAmount) || 0;

      if (sumAllocated <= 0 && enteredTotal <= 0) {
        newErrors.paymentAmount = 'Please allocate an amount against at least one bill';
      }

      // 1. Validate each allocation does not exceed invoice outstanding
      for (const inv of companyBillReferences) {
        const out = parseFloat(inv.outstanding) || 0;
        const alloc = parseFloat(allocations[inv.id]) || 0;
        if (alloc > out + 0.01) {
          newErrors.paymentAmount = `Allocation for ${inv.invoice_no || ('INV-' + inv.id)} (${formatCurrency(alloc)}) cannot exceed outstanding amount (${formatCurrency(out)})`;
          break;
        }
      }

      // 2. Validate total allocated does not exceed entered receipt amount (when entered)
      if (!newErrors.paymentAmount && enteredTotal > 0 && sumAllocated > enteredTotal + 0.01) {
        newErrors.paymentAmount = `Total allocated amount (${formatCurrency(sumAllocated)}) exceeds entered receipt amount (${formatCurrency(enteredTotal)})`;
      }
    } else if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
      newErrors.paymentAmount = 'Valid payment amount is required';
    }

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (!formData.paymentMode) {
      newErrors.paymentMode = 'Payment mode is required';
    }

    if (['BANK_TRANSFER', 'CHEQUE'].includes(formData.paymentMode) && !formData.bankAccount) {
      newErrors.bankAccount = 'Bank account is required';
    }

    if (formData.bankAccount === '__custom__' && !formData.manualBankAccount) {
      newErrors.manualBankAccount = 'Please specify bank details';
    }

    if (formData.paymentMode === 'UPI') {
      if (!formData.upiApp) newErrors.upiApp = 'UPI app is required';
      if (!formData.upiTransactionId) newErrors.upiTransactionId = 'UPI Txn ID is required';
    }

    if (formData.paymentMode === 'CHEQUE') {
      if (!formData.chequeNumber) newErrors.chequeNumber = 'Cheque number is required';
      if (!formData.bankName) newErrors.bankName = 'Bank name is required';
      if (!formData.chequeDate) newErrors.chequeDate = 'Cheque date is required';
    }

    if (['CREDIT_CARD', 'DEBIT_CARD'].includes(formData.paymentMode)) {
      if (!formData.transactionRefNo) {
        newErrors.transactionRefNo = 'Transaction reference or authorization code is required';
      }
    }

    setErrors(newErrors);
    return newErrors;
  };

  // 1. Live Accounting Execution for RECEIPT
  const handleReceiptSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateReceiptForm();
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      errorToast(firstError);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const actualBank = formData.bankAccount === '__custom__' 
        ? (formData.manualBankAccount || 'Other Bank') 
        : formData.bankAccount;

      const activeInvoices = companyBillReferences.filter(inv => {
        const amt = parseFloat(allocations[inv.id]);
        return !isNaN(amt) && amt > 0;
      });

      if (activeInvoices.length > 0) {
        let recordedCount = 0;
        let totalRecordedAmt = 0;

        for (const inv of activeInvoices) {
          const allocAmt = parseFloat(allocations[inv.id]);
          const custId = inv.customer_id || inv.company_id || inv.client_id || formData.customerId || customerId || companyId;
          const isCustom = String(inv.id).startsWith('custom-') || inv.is_custom;
          const numId = parseInt(inv.id, 10);
          const validNumId = !isNaN(numId) && numId > 0 ? numId : null;

          const soId = isCustom ? null : (inv.sales_order_id ? parseInt(inv.sales_order_id, 10) : validNumId);
          const invId = isCustom ? null : (inv.invoice_id ? parseInt(inv.invoice_id, 10) : validNumId);

          const finalCustId = custId ? (parseInt(custId, 10) || custId) : null;

          const paymentPayload = {
            invoiceId: invId,
            salesOrderId: soId,
            salesOrderSource: isCustom ? 'DIRECT_ORDER' : (inv.sales_order_source || inv.source || 'SALES_INVOICE'),
            customerId: finalCustId,
            paymentAmount: allocAmt,
            paymentDate: formData.paymentDate,
            paymentMode: formData.paymentMode,
            transactionRefNo: formData.transactionRefNo,
            remarks: formData.remarks 
              ? `${formData.remarks} [Ref: ${inv.invoice_no || invId || 'Manual'}]` 
              : `Payment against ${inv.invoice_no || ('Ref #' + (invId || 'Manual'))}`,
            bankAccount: actualBank,
            upiApp: formData.upiApp,
            upiTransactionId: formData.upiTransactionId,
            chequeNumber: formData.chequeNumber,
            bankName: formData.bankName,
            chequeDate: formData.chequeDate,
            cardType: formData.cardType,
            last4Digits: formData.last4Digits,
            authorizationCode: formData.authorizationCode,
          };

          const response = await fetch(`${API_BASE}/customer-payments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentPayload)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to record payment for bill ${inv.invoice_no || invId}`);
          }

          recordedCount += 1;
          totalRecordedAmt += allocAmt;
        }

        successToast(`Successfully recorded ${formatCurrency(totalRecordedAmt)} across ${recordedCount} bill reference(s)`);
        onSuccess?.();
        onClose();
        return;
      }

      if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
        errorToast('Please enter an amount or allocate funds to at least one bill reference');
        setLoading(false);
        return;
      }

      const paymentPayload = {
        invoiceId: formData.invoiceId || (formData.salesOrderSource === 'SALES_INVOICE' ? (singleInvoice?.id || formData.salesOrderId) : formData.salesOrderId) || null,
        salesOrderId: formData.salesOrderId || null,
        salesOrderSource: formData.salesOrderSource,
        customerId: formData.customerId,
        paymentAmount: parseFloat(formData.paymentAmount),
        paymentDate: formData.paymentDate,
        paymentMode: formData.paymentMode,
        transactionRefNo: formData.transactionRefNo,
        remarks: formData.remarks,
        bankAccount: actualBank,
        upiApp: formData.upiApp,
        upiTransactionId: formData.upiTransactionId,
        chequeNumber: formData.chequeNumber,
        bankName: formData.bankName,
        chequeDate: formData.chequeDate,
        cardType: formData.cardType,
        last4Digits: formData.last4Digits,
        authorizationCode: formData.authorizationCode,
      };

      const response = await fetch(`${API_BASE}/customer-payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to record payment');
      }

      const result = await response.json();
      successToast('Payment received and recorded successfully');
      onSuccess?.(result);
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      errorToast(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  // 2. Interactive Preview Execution for other 5 Vouchers (Payment, Journal, Contra, Debit Note, Credit Note)
  const handleVoucherPreviewSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    const vNum = getVoucherNumber(voucherType);

    if (voucherType === 'PAYMENT') {
      if (!voucherForm.payee) newErrors.payee = 'Payee / Vendor name is required';
      if (!voucherForm.paymentAmount || parseFloat(voucherForm.paymentAmount) <= 0) newErrors.paymentAmount = 'Valid amount is required';
      if (!voucherForm.paymentBankAccount) newErrors.paymentBankAccount = 'Payment bank / cash account is required';
      if (!voucherForm.date) newErrors.date = 'Date is required';

      if (Object.keys(newErrors).length > 0) {
        setVoucherErrors(newErrors);
        return;
      }

      setPreviewVoucherData({
        type: 'PAYMENT',
        title: 'Payment Voucher',
        voucherNo: vNum,
        date: voucherForm.date,
        party: voucherForm.payee,
        debitLedger: voucherForm.paymentDebitLedger,
        creditLedger: voucherForm.paymentCreditLedger || voucherForm.paymentBankAccount,
        amount: parseFloat(voucherForm.paymentAmount),
        mode: voucherForm.paymentMode,
        ref: voucherForm.paymentChequeRef,
        narration: voucherForm.narration || `Payment made towards ${voucherForm.payee}`,
      });
      successToast(`[Preview Mode] Payment Voucher ${vNum} for ${formatCurrency(voucherForm.paymentAmount)} validated successfully.`);
      return;
    }

    if (voucherType === 'JOURNAL') {
      if (!voucherForm.journalDebitLedger) newErrors.journalDebitLedger = 'Debit ledger is required';
      if (!voucherForm.journalCreditLedger) newErrors.journalCreditLedger = 'Credit ledger is required';
      if (voucherForm.journalDebitLedger === voucherForm.journalCreditLedger) newErrors.journalCreditLedger = 'Debit and Credit ledgers must be distinct';
      
      const dr = parseFloat(voucherForm.journalDebitAmount);
      const cr = parseFloat(voucherForm.journalCreditAmount);
      if (isNaN(dr) || dr <= 0) newErrors.journalDebitAmount = 'Valid debit amount required';
      if (isNaN(cr) || cr <= 0) newErrors.journalCreditAmount = 'Valid credit amount required';
      if (!isNaN(dr) && !isNaN(cr) && Math.abs(dr - cr) > 0.001) {
        newErrors.journalCreditAmount = 'Debit and Credit amounts must be equal for double-entry balance';
      }
      if (!voucherForm.date) newErrors.date = 'Date is required';

      if (Object.keys(newErrors).length > 0) {
        setVoucherErrors(newErrors);
        return;
      }

      setPreviewVoucherData({
        type: 'JOURNAL',
        title: 'Journal Voucher',
        voucherNo: vNum,
        date: voucherForm.date,
        debitLedger: voucherForm.journalDebitLedger,
        creditLedger: voucherForm.journalCreditLedger,
        amount: dr,
        ref: voucherForm.journalRefDoc,
        narration: voucherForm.narration || 'Being journal adjustment entry passed',
      });
      successToast(`[Preview Mode] Journal Voucher ${vNum} balanced at ${formatCurrency(dr)} Dr / Cr.`);
      return;
    }

    if (voucherType === 'CONTRA') {
      if (!voucherForm.contraFromAccount) newErrors.contraFromAccount = 'Source account required';
      if (!voucherForm.contraToAccount) newErrors.contraToAccount = 'Destination account required';
      if (voucherForm.contraFromAccount && voucherForm.contraFromAccount === voucherForm.contraToAccount) {
        newErrors.contraToAccount = 'Source and destination accounts must be different';
      }
      if (!voucherForm.contraAmount || parseFloat(voucherForm.contraAmount) <= 0) {
        newErrors.contraAmount = 'Valid transfer amount required';
      }
      if (!voucherForm.date) newErrors.date = 'Date is required';

      if (Object.keys(newErrors).length > 0) {
        setVoucherErrors(newErrors);
        return;
      }

      setPreviewVoucherData({
        type: 'CONTRA',
        title: 'Contra Voucher',
        voucherNo: vNum,
        date: voucherForm.date,
        fromAccount: voucherForm.contraFromAccount,
        toAccount: voucherForm.contraToAccount,
        amount: parseFloat(voucherForm.contraAmount),
        ref: voucherForm.contraRefNo,
        narration: voucherForm.narration || `Transfer from ${voucherForm.contraFromAccount} to ${voucherForm.contraToAccount}`,
      });
      successToast(`[Preview Mode] Contra Voucher ${vNum} for ${formatCurrency(voucherForm.contraAmount)} validated successfully.`);
      return;
    }

    if (voucherType === 'DEBIT_NOTE') {
      if (!voucherForm.debitParty) newErrors.debitParty = 'Party (Vendor / Customer) is required';
      if (!voucherForm.debitAffectedLedger) newErrors.debitAffectedLedger = 'Affected ledger is required';
      if (!voucherForm.debitAmount || parseFloat(voucherForm.debitAmount) <= 0) newErrors.debitAmount = 'Valid amount is required';
      if (!voucherForm.date) newErrors.date = 'Date is required';

      if (Object.keys(newErrors).length > 0) {
        setVoucherErrors(newErrors);
        return;
      }

      setPreviewVoucherData({
        type: 'DEBIT_NOTE',
        title: 'Debit Note',
        voucherNo: vNum,
        date: voucherForm.date,
        party: voucherForm.debitParty,
        affectedLedger: voucherForm.debitAffectedLedger,
        ref: voucherForm.debitRefDoc,
        amount: parseFloat(voucherForm.debitAmount),
        reason: voucherForm.debitReason,
        narration: voucherForm.narration || `Debit note issued to ${voucherForm.debitParty} (${voucherForm.debitReason})`,
      });
      successToast(`[Preview Mode] Debit Note ${vNum} for ${formatCurrency(voucherForm.debitAmount)} previewed successfully.`);
      return;
    }

    if (voucherType === 'CREDIT_NOTE') {
      const party = voucherForm.creditParty || customerName;
      if (!party || party === 'Select Company / Customer') newErrors.creditParty = 'Party (Customer) is required';
      if (!voucherForm.creditAffectedLedger) newErrors.creditAffectedLedger = 'Affected ledger is required';
      if (!voucherForm.creditAmount || parseFloat(voucherForm.creditAmount) <= 0) newErrors.creditAmount = 'Valid amount is required';
      if (!voucherForm.date) newErrors.date = 'Date is required';

      if (Object.keys(newErrors).length > 0) {
        setVoucherErrors(newErrors);
        return;
      }

      setPreviewVoucherData({
        type: 'CREDIT_NOTE',
        title: 'Credit Note',
        voucherNo: vNum,
        date: voucherForm.date,
        party,
        affectedLedger: voucherForm.creditAffectedLedger,
        ref: voucherForm.creditRefDoc,
        amount: parseFloat(voucherForm.creditAmount),
        reason: voucherForm.creditReason,
        narration: voucherForm.narration || `Credit note issued to ${party} (${voucherForm.creditReason})`,
      });
      successToast(`[Preview Mode] Credit Note ${vNum} for ${formatCurrency(voucherForm.creditAmount)} previewed successfully.`);
      return;
    }
  };

  const alreadyReceived = installments.reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);
  const activeVoucherMeta = voucherTypes.find(v => v.id === voucherType) || voucherTypes[1];

  const modalContent = (
    <div className={isPage ? "bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" : ""}>
      {/* ── HEADER ── */}
      <div className={`sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-200 ${isPage ? 'bg-white shadow-2xs' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          {isPage && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-200 flex items-center gap-1.5 text-xs font-semibold mr-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
              <span>Back to Invoices</span>
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/25 shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Accounts — Voucher Entry & Settlement
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              SP TECHPIONEER ERP • Double-entry voucher accounting & bill-wise ledger allocation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shadow-2xs">
            {activeVoucherMeta.name} Voucher
          </span>
          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-mono shadow-2xs">
            {formatCurrency(totalSelectedOutstanding)} Due
          </span>
        </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-0 ${isPage ? '' : 'overflow-y-auto max-h-[78vh] custom-scrollbar'}`}>

        {/* ── LEFT PANEL: COMPANY-WISE BILL-WISE DETAILS (TALLY PRIME STANDARD) ── */}
        <div className="lg:col-span-7 border-r border-slate-200 p-5 space-y-4 bg-slate-50/50">

          {/* Contextual Double-Entry Impact banner for Journal & Contra */}
          {voucherType === 'JOURNAL' && (
            <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 pb-1 border-b border-blue-100">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Double-Entry Journal Impact Preview</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Ref: #{getVoucherNumber('JOURNAL')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Debit Account (Dr)</span>
                  <span className="font-bold text-slate-800 text-xs block truncate">{voucherForm.journalDebitLedger || 'Debit Ledger'}</span>
                  <span className="font-mono text-blue-800 font-extrabold mt-0.5 block">{formatCurrency(voucherForm.journalDebitAmount || 0)}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Credit Account (Cr)</span>
                  <span className="font-bold text-slate-800 text-xs block truncate">{voucherForm.journalCreditLedger || 'Credit Ledger'}</span>
                  <span className="font-mono text-slate-800 font-extrabold mt-0.5 block">{formatCurrency(voucherForm.journalCreditAmount || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {voucherType === 'CONTRA' && (
            <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 pb-1 border-b border-blue-100">
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>Internal Fund Transfer Flow (Contra)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Ref: #{getVoucherNumber('CONTRA')}</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200 gap-2">
                <div className="text-left min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">From Source Account (Cr)</span>
                  <span className="font-bold text-slate-800 text-xs truncate block">{voucherForm.contraFromAccount || 'Select Account'}</span>
                </div>
                <div className="flex flex-col items-center px-2">
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-mono font-bold text-blue-700">{formatCurrency(voucherForm.contraAmount || 0)}</span>
                </div>
                <div className="text-right min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">To Destination Account (Dr)</span>
                  <span className="font-bold text-slate-800 text-xs truncate block">{voucherForm.contraToAccount || 'Select Account'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Company / Customer Selection & Up To Balance Banner */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/20 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[260px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Company / Customer
                </span>
                {customers.length > 0 ? (
                  <select
                    value={formData.customerId || ''}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full max-w-md px-3 py-1.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="">Select Company / Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {customerName}
                  </h3>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Up to
                </span>
                <div className="text-base font-extrabold font-mono text-slate-900 flex items-center justify-end gap-1.5">
                  <span>{formatCurrency(upToAmount)}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.2 rounded border ${
                    upToDrCr === 'Cr'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {upToDrCr}
                  </span>
                </div>
              </div>
            </div>

            {/* Auto Distribute Toolbar */}
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="font-bold text-slate-700">Auto Distribute Lump Sum</span>
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={lumpSumAmount}
                    onChange={(e) => setLumpSumAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDistributeLumpSum}
                  className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-all shadow-xs cursor-pointer"
                >
                  Distribute
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAgstRefModalOpen(true);
                    setAgstRefSearch('');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Add specific outstanding invoices or custom references"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Agst Ref.</span>
                </button>
                <button
                  type="button"
                  onClick={handleAllocateAllFull}
                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  Allocate Full to All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllAllocations}
                  className="px-2 py-1 text-[11px] font-medium rounded text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Bill-wise Details Table (Automatic Bill Reference Linking) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wide">
                    <th className="py-2.5 px-3.5">Invoice Reference</th>
                    <th className="py-2.5 px-3.5">Due Date / Credit Days</th>
                    <th className="py-2.5 px-3.5 text-right w-36">Outstanding</th>
                    <th className="py-2.5 px-3.5 text-right w-44">Allocated Amount</th>
                    <th className="py-2.5 px-3.5 text-center w-16">Dr / Cr</th>
                    <th className="py-2.5 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium bg-white">
                  {companyBillReferences.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 bg-slate-50/50">
                        <div className="space-y-2.5 max-w-sm mx-auto">
                          <FilePlus className="w-8 h-8 text-blue-500 mx-auto opacity-75" />
                          <p className="text-xs font-bold text-slate-700">No invoice references added yet</p>
                          <p className="text-[11px] text-slate-500">
                            Add outstanding invoices of {customerName} to record payment against them.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddAgstRefModalOpen(true);
                              setAgstRefSearch('');
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Agst Ref. ({unaddedCustomerInvoices.length} Available)</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    companyBillReferences.map((inv, idx) => {
                      const out = parseFloat(inv.outstanding) || 0;
                      const currentAlloc = parseFloat(allocations[inv.id]) || 0;
                      const isFull = currentAlloc >= out && out > 0;
                      const invDate = inv.invoice_date || inv.created_at;
                      const creditDays = inv.credit_days || 60;

                      return (
                        <tr key={inv.id || idx} className={`hover:bg-slate-50/80 transition-colors ${currentAlloc > 0 ? 'bg-blue-50/20' : ''}`}>
                          {/* 1. Invoice Reference (Automatic Linking) */}
                          <td className="py-2.5 px-3.5 align-middle">
                            <span className="font-mono font-bold text-slate-900 text-xs block">
                              {inv.invoice_no || inv.so_number || `INV-${inv.id}`}
                            </span>
                            {inv.so_number && inv.invoice_no && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                SO: {inv.so_number}
                              </div>
                            )}
                          </td>

                          {/* 2. Due Date / Credit Days */}
                          <td className="py-2.5 px-3.5 align-middle text-slate-600">
                            <span className="font-medium text-slate-800">{formatDate(invDate)}</span>
                            <span className="text-slate-400 text-[11px] font-normal"> / {creditDays} Days</span>
                          </td>

                          {/* 3. Outstanding Amount */}
                          <td className="py-2.5 px-3.5 align-middle text-right">
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {formatCurrency(out)}
                            </span>
                          </td>

                          {/* 4. Allocated Amount + Full Option */}
                          <td className="py-2.5 px-3.5 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="relative w-28">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={out > 0 ? out : undefined}
                                  value={allocations[inv.id] !== undefined ? allocations[inv.id] : ''}
                                  onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                                  className={`w-full pl-5 pr-1.5 py-1 text-xs font-mono font-bold text-right border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white ${
                                    currentAlloc > 0 ? 'border-blue-400 text-blue-900 shadow-2xs' : 'border-slate-300 text-slate-800'
                                  }`}
                                  placeholder="0.00"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSetFullAllocation(inv)}
                                className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                  isFull
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                                title={`Allocate full bill amount ${formatCurrency(out)}`}
                              >
                                Full
                              </button>
                            </div>
                          </td>

                          {/* 5. Dr/Cr (Customer Receipt is a Credit Entry) */}
                          <td className="py-2.5 px-3.5 align-middle text-center">
                            <span className="font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title="Credit Entry">
                              Cr
                            </span>
                          </td>

                          {/* 6. Remove Bill from selection */}
                          <td className="py-2.5 px-2 align-middle text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBill(inv.id)}
                              className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Exclude from this receipt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Total Footer */}
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                    <td colSpan={2} className="py-3 px-3.5 text-left uppercase tracking-wider font-bold text-slate-800">
                      Total Allocated
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-xs text-slate-500">
                      Total Due: {formatCurrency(companyBillReferences.reduce((s, b) => s + (parseFloat(b.outstanding) || 0), 0))}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-sm text-blue-700 font-extrabold">
                      {formatCurrency(totalAllocated)}
                    </td>
                    <td className="py-3 px-3.5 text-center text-xs text-emerald-700 font-extrabold">
                      Cr
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Add Agst Ref Bar */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsAddAgstRefModalOpen(true);
                  setAgstRefSearch('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Add Agst Ref.</span>
              </button>
              <div className="text-[11px] text-slate-500 font-medium">
                <span>{companyBillReferences.length} reference(s) allocated</span>
                {unaddedCustomerInvoices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddAgstRefModalOpen(true);
                      setAgstRefSearch('');
                    }}
                    className="ml-2 text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    ({unaddedCustomerInvoices.length} more available to add)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Simple Minimal Receipts History Space */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-2xs">
            <div className="flex items-center justify-between text-slate-700 font-semibold mb-2 pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">Payment Receipt History</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({installments.length})
                </span>
              </div>
              {alreadyReceived > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 font-mono">
                  Total Received: {formatCurrency(alreadyReceived)}
                </span>
              )}
            </div>

            {fetchingInstallments ? (
              <p className="text-[11px] text-slate-400 py-2 text-center">Loading receipt history...</p>
            ) : installments.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-2 text-center">No prior payment receipts recorded for this company.</p>
            ) : (
              <div className="max-h-[105px] overflow-y-auto divide-y divide-slate-100">
                {installments.map((inst, idx) => (
                  <div key={inst.id || idx} className="py-1 flex items-center justify-between text-[11px] hover:bg-slate-50 px-1 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">{inst.payment_receipt_no || `REC-${inst.id}`}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">{formatDate(inst.payment_date)}</span>
                      <span className="text-slate-400">({inst.payment_mode?.replace('_', ' ') || 'Payment'})</span>
                      {inst.cheque_number && <span className="text-slate-400 font-mono">Chq: #{inst.cheque_number}</span>}
                    </div>
                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(inst.payment_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: VOUCHER TYPE SELECTOR & TRANSACTION ENTRY FORM ── */}
        <div className="lg:col-span-5 p-5 space-y-4 bg-white">
          
          {/* 1. Accounts — Voucher Entry Selection Header & Pills */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Accounts — Voucher Entry
                </span>
                <p className="text-xs font-bold text-slate-800">
                  Select the accounting transaction type
                </p>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wide">
                {activeVoucherMeta.name} Voucher
              </span>
            </div>

            {/* 6 Voucher Type Options */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Voucher Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {voucherTypes.map((vt) => {
                  const isActive = voucherType === vt.id;
                  return (
                    <button
                      key={vt.id}
                      type="button"
                      onClick={() => {
                        setVoucherType(vt.id);
                        setVoucherErrors({});
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {vt.icon}
                      <span>{vt.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Voucher Summary Banner */}
            <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-start gap-2.5 shadow-2xs">
              <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
                {activeVoucherMeta.icon}
              </div>
              <div className="text-xs flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="font-bold text-slate-900 leading-tight">
                    {activeVoucherMeta.title}
                  </h4>
                  <span className="text-[10px] font-mono font-semibold text-slate-500">
                    Ref: #{getVoucherNumber(voucherType)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {activeVoucherMeta.desc}
                </p>
                {voucherType !== 'RECEIPT' && (
                  <span className="inline-block mt-1 text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                    Interactive UI concept only • Selecting previews intended entry
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. DYNAMIC FORM BODY PER VOUCHER TYPE ── */}

          {/* A. RECEIPT VOUCHER (Active ERP Payment Received Workflow) */}
          {voucherType === 'RECEIPT' && (
            <div className="space-y-3.5">
              {/* Payment Amount (Enter once, auto-distributes oldest first) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Amount Received *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.paymentAmount}
                    onChange={(e) => handleReceiptAmountChange(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 transition-all ${
                      errors.paymentAmount
                        ? 'border-rose-500 bg-rose-50 focus:ring-rose-500/30'
                        : 'border-slate-300 bg-white focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Enter total receipt amount to automatically allocate across oldest due invoices first, or manually adjust allocations on the left.
                </p>
                {errors.paymentAmount && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentAmount}</span>}
              </div>

              {/* Date + Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 transition-all ${
                      errors.paymentDate ? 'border-rose-500 bg-rose-50 focus:ring-rose-500/30' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {errors.paymentDate && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentDate}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Receipt Mode *</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => handleInputChange('paymentMode', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 transition-all cursor-pointer bg-white ${
                      errors.paymentMode ? 'border-rose-500 bg-rose-50 focus:ring-rose-500/30' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  >
                    <option value="">Select Mode</option>
                    {paymentModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  {errors.paymentMode && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentMode}</span>}
                </div>
              </div>

              {/* Bank Account */}
              {(['BANK_TRANSFER', 'CHEQUE'].includes(formData.paymentMode)) && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                    {formData.paymentMode === 'CHEQUE' ? 'Deposit Into Bank Account *' : 'Bank Account *'}
                  </label>
                  {bankAccounts.length > 0 ? (
                    <select
                      value={formData.bankAccount}
                      onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                        errors.bankAccount ? 'border-rose-500 bg-rose-50 focus:ring-rose-500/30' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    >
                      <option value="">Select Company Bank Account</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} {b.account_number ? `(${b.account_number})` : ''} {b.branch_name || b.branch ? `• ${b.branch_name || b.branch}` : ''}
                        </option>
                      ))}
                      <option value="__custom__">Manual / Other Bank Details...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.bankAccount}
                      onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 transition-all ${
                        errors.bankAccount ? 'border-rose-500 bg-rose-50 focus:ring-rose-500/30' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                      placeholder="Enter bank name or account details"
                    />
                  )}
                  {formData.bankAccount === '__custom__' && (
                    <input
                      type="text"
                      value={formData.manualBankAccount || ''}
                      onChange={(e) => handleInputChange('manualBankAccount', e.target.value)}
                      className={`mt-2 w-full px-3 py-2 border rounded-xl text-xs ${errors.manualBankAccount ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                      placeholder="Type bank account name / details"
                    />
                  )}
                  {errors.bankAccount && <span className="text-xs text-rose-600 mt-1 block">{errors.bankAccount}</span>}
                </div>
              )}

              {/* UPI Details */}
              {formData.paymentMode === 'UPI' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">UPI App *</label>
                    <select
                      value={formData.upiApp}
                      onChange={(e) => handleInputChange('upiApp', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select App</option>
                      {upiApps.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    {errors.upiApp && <span className="text-xs text-rose-600 mt-1 block">{errors.upiApp}</span>}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">UPI Txn ID *</label>
                    <input
                      type="text"
                      value={formData.upiTransactionId}
                      onChange={(e) => handleInputChange('upiTransactionId', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="UPI Txn ID"
                    />
                    {errors.upiTransactionId && <span className="text-xs text-rose-600 mt-1 block">{errors.upiTransactionId}</span>}
                  </div>
                </div>
              )}

              {/* Cheque Details */}
              {formData.paymentMode === 'CHEQUE' && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1 border-b border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cheque Details</span>
                    </div>
                    {lastFetchedCheque && (
                      <span className="text-[9px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shadow-2xs">
                        Auto-fetched: #{lastFetchedCheque}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block mb-0.5">Cheque No *</label>
                      <input
                        type="text"
                        value={formData.chequeNumber}
                        onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 ${
                          errors.chequeNumber ? 'border-rose-500 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                        placeholder="Cheque #"
                      />
                      {errors.chequeNumber && <span className="text-[10px] text-rose-600 mt-0.5 block">{errors.chequeNumber}</span>}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block mb-0.5">Customer's Bank *</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => handleInputChange('bankName', e.target.value)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 ${
                          errors.bankName ? 'border-rose-500 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                        placeholder="Issuing bank"
                      />
                      {errors.bankName && <span className="text-[10px] text-rose-600 mt-0.5 block">{errors.bankName}</span>}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block mb-0.5">Cheque Date *</label>
                      <input
                        type="date"
                        value={formData.chequeDate}
                        onChange={(e) => handleInputChange('chequeDate', e.target.value)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 ${
                          errors.chequeDate ? 'border-rose-500 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                      />
                      {errors.chequeDate && <span className="text-[10px] text-rose-600 mt-0.5 block">{errors.chequeDate}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks / Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Narration / Remarks
                  </label>
                  {(formData.bankAccount || formData.chequeNumber) && (
                    <button
                      type="button"
                      onClick={() => {
                        const bank = bankAccounts.find(b => String(b.id) === String(formData.bankAccount));
                        const parts = [];
                        if (bank) parts.push(`Bank: ${bank.bank_name} (A/C: ${bank.account_number}, IFSC: ${bank.ifsc_code || '—'})`);
                        if (formData.chequeNumber) parts.push(`Cheque No: ${formData.chequeNumber}`);
                        if (formData.transactionRefNo) parts.push(`Ref: ${formData.transactionRefNo}`);
                        handleInputChange('remarks', parts.join(' | '));
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      Auto-fill Bank & Cheque
                    </button>
                  )}
                </div>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none bg-white"
                  rows="2"
                  placeholder="Enter receipt narration or auto-fill details"
                />
              </div>

              {/* Receipt Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReceiptSubmit}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Receipt...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>
                        Record Payment Received ({companyBillReferences.filter(i => (parseFloat(allocations[i.id]) || 0) > 0).length} Bills)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* B. PAYMENT VOUCHER */}
          {voucherType === 'PAYMENT' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Date *</label>
                  <input
                    type="date"
                    value={voucherForm.date}
                    onChange={(e) => handleVoucherInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {voucherErrors.date && <span className="text-[10px] text-rose-600">{voucherErrors.date}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Voucher Number</label>
                  <input
                    type="text"
                    readOnly
                    value={getVoucherNumber('PAYMENT')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Payee (Vendor / Supplier) *</label>
                {vendors.length > 0 ? (
                  <select
                    value={voucherForm.payee}
                    onChange={(e) => handleVoucherInputChange('payee', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Payee / Vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.vendor_name || v.name}>{v.vendor_name || v.name}</option>
                    ))}
                    <option value="__custom__">Custom Payee...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={voucherForm.payee}
                    onChange={(e) => handleVoucherInputChange('payee', e.target.value)}
                    placeholder="Enter vendor or payee name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                )}
                {voucherForm.payee === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Type custom payee name"
                    onChange={(e) => handleVoucherInputChange('payee', e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                )}
                {voucherErrors.payee && <span className="text-[10px] text-rose-600">{voucherErrors.payee}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Debit Ledger *</label>
                  <select
                    value={voucherForm.paymentDebitLedger}
                    onChange={(e) => handleVoucherInputChange('paymentDebitLedger', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="Sundry Creditors (Vendors)">Sundry Creditors (Vendors)</option>
                    <option value="Purchase Account">Purchase Account</option>
                    <option value="Raw Material Consumption">Raw Material Consumption</option>
                    <option value="Freight & Transport">Freight & Transport</option>
                    <option value="Factory Electricity / Power">Factory Electricity / Power</option>
                    <option value="Office & Administrative">Office & Administrative</option>
                    <optgroup label="57 Master Ledger Groups">
                      {LEDGER_GROUPS.map(g => (
                        <option key={g.id} value={g.name}>{g.id}. {g.name} ({g.category})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Payment Mode *</label>
                  <select
                    value={voucherForm.paymentMode}
                    onChange={(e) => handleVoucherInputChange('paymentMode', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="CASH">Cash in Hand</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Bank / Cash Account *</label>
                  <select
                    value={voucherForm.paymentBankAccount}
                    onChange={(e) => handleVoucherInputChange('paymentBankAccount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="">Select Account</option>
                    <option value="Cash in Hand">Cash in Hand</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={`${b.bank_name} - ${b.account_number}`}>
                        {b.bank_name} ({b.account_number})
                      </option>
                    ))}
                  </select>
                  {voucherErrors.paymentBankAccount && <span className="text-[10px] text-rose-600">{voucherErrors.paymentBankAccount}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherForm.paymentAmount}
                      onChange={(e) => handleVoucherInputChange('paymentAmount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  {voucherErrors.paymentAmount && <span className="text-[10px] text-rose-600">{voucherErrors.paymentAmount}</span>}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Cheque / Ref No</label>
                <input
                  type="text"
                  value={voucherForm.paymentChequeRef}
                  onChange={(e) => handleVoucherInputChange('paymentChequeRef', e.target.value)}
                  placeholder="Cheque # or UTR / NEFT reference"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Narration</label>
                <textarea
                  value={voucherForm.narration}
                  onChange={(e) => handleVoucherInputChange('narration', e.target.value)}
                  placeholder="Being payment made towards..."
                  rows="2"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs resize-none"
                />
              </div>

              {/* Action */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoucherPreviewSubmit}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Preview Payment Voucher (PV)</span>
                </button>
              </div>
            </div>
          )}

          {/* C. JOURNAL VOUCHER */}
          {voucherType === 'JOURNAL' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Date *</label>
                  <input
                    type="date"
                    value={voucherForm.date}
                    onChange={(e) => handleVoucherInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  {voucherErrors.date && <span className="text-[10px] text-rose-600">{voucherErrors.date}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Voucher Number</label>
                  <input
                    type="text"
                    readOnly
                    value={getVoucherNumber('JOURNAL')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Reference / Document No</label>
                <input
                  type="text"
                  value={voucherForm.journalRefDoc}
                  onChange={(e) => handleVoucherInputChange('journalRefDoc', e.target.value)}
                  placeholder="Supporting bill # or internal memo #"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Debit Ledger (Dr) *</label>
                  <span className="text-[10px] font-bold text-blue-600">Account Debited</span>
                </div>
                <select
                  value={voucherForm.journalDebitLedger}
                  onChange={(e) => handleVoucherInputChange('journalDebitLedger', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                >
                  <option value="Office Equipment">Office Equipment (Assets)</option>
                  <option value="Plant & Machinery">Plant & Machinery (Assets)</option>
                  <option value="Depreciation Account">Depreciation Account (Expenses)</option>
                  <option value="Bad Debts Written Off">Bad Debts Written Off (Expenses)</option>
                  <option value="Sundry Debtors (Customers)">Sundry Debtors (Customers)</option>
                  <option value="Discount Allowed">Discount Allowed</option>
                  <option value="TDS Receivable">TDS Receivable</option>
                  <optgroup label="57 Master Ledger Groups">
                    {LEDGER_GROUPS.map(g => (
                      <option key={g.id} value={g.name}>{g.id}. {g.name} ({g.category})</option>
                    ))}
                  </optgroup>
                </select>
                {voucherErrors.journalDebitLedger && <span className="text-[10px] text-rose-600">{voucherErrors.journalDebitLedger}</span>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Credit Ledger (Cr) *</label>
                  <span className="text-[10px] font-bold text-slate-500">Account Credited</span>
                </div>
                <select
                  value={voucherForm.journalCreditLedger}
                  onChange={(e) => handleVoucherInputChange('journalCreditLedger', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                >
                  <option value="Accumulated Depreciation">Accumulated Depreciation (Provision)</option>
                  <option value="Sundry Debtors (Customers)">Sundry Debtors (Customers)</option>
                  <option value="Sundry Creditors (Vendors)">Sundry Creditors (Vendors)</option>
                  <option value="Discount Received">Discount Received (Income)</option>
                  <option value="TDS Payable">TDS Payable (Liability)</option>
                  <option value="Provision for Audit Fees">Provision for Audit Fees</option>
                  <optgroup label="57 Master Ledger Groups">
                    {LEDGER_GROUPS.map(g => (
                      <option key={g.id} value={g.name}>{g.id}. {g.name} ({g.category})</option>
                    ))}
                  </optgroup>
                </select>
                {voucherErrors.journalCreditLedger && <span className="text-[10px] text-rose-600">{voucherErrors.journalCreditLedger}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Debit Amount (Dr) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={voucherForm.journalDebitAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleVoucherInputChange('journalDebitAmount', val);
                      if (!voucherForm.journalCreditAmount) {
                        handleVoucherInputChange('journalCreditAmount', val);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                  {voucherErrors.journalDebitAmount && <span className="text-[10px] text-rose-600">{voucherErrors.journalDebitAmount}</span>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Credit Amount (Cr) *</label>
                    {voucherForm.journalDebitAmount && (
                      <button
                        type="button"
                        onClick={() => handleVoucherInputChange('journalCreditAmount', voucherForm.journalDebitAmount)}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        = Dr
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={voucherForm.journalCreditAmount}
                    onChange={(e) => handleVoucherInputChange('journalCreditAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                  {voucherErrors.journalCreditAmount && <span className="text-[10px] text-rose-600">{voucherErrors.journalCreditAmount}</span>}
                </div>
              </div>

              {/* Double Entry Equality Check */}
              <div className="px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between bg-slate-50 border-slate-200">
                <span className="text-slate-500 text-[11px]">Accounting Equation:</span>
                {voucherForm.journalDebitAmount && voucherForm.journalCreditAmount && parseFloat(voucherForm.journalDebitAmount) === parseFloat(voucherForm.journalCreditAmount) ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Balanced (Debit = Credit)</span>
                  </span>
                ) : (
                  <span className="font-semibold text-amber-700 flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Difference: ₹{Math.abs((parseFloat(voucherForm.journalDebitAmount) || 0) - (parseFloat(voucherForm.journalCreditAmount) || 0)).toFixed(2)}</span>
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Narration</label>
                <textarea
                  value={voucherForm.narration}
                  onChange={(e) => handleVoucherInputChange('narration', e.target.value)}
                  placeholder="Being adjustment entry passed for..."
                  rows="2"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs resize-none"
                />
              </div>

              {/* Action */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoucherPreviewSubmit}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Preview Journal Voucher (JV)</span>
                </button>
              </div>
            </div>
          )}

          {/* D. CONTRA VOUCHER */}
          {voucherType === 'CONTRA' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Date *</label>
                  <input
                    type="date"
                    value={voucherForm.date}
                    onChange={(e) => handleVoucherInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  {voucherErrors.date && <span className="text-[10px] text-rose-600">{voucherErrors.date}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Voucher Number</label>
                  <input
                    type="text"
                    readOnly
                    value={getVoucherNumber('CONTRA')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              {/* Quick Template Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const firstBank = bankAccounts[0]?.bank_name || 'Bank Account';
                    handleVoucherInputChange('contraFromAccount', 'Cash in Hand');
                    handleVoucherInputChange('contraToAccount', firstBank);
                    handleVoucherInputChange('narration', 'Cash deposited into bank account');
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                >
                  Deposit Cash to Bank
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstBank = bankAccounts[0]?.bank_name || 'Bank Account';
                    handleVoucherInputChange('contraFromAccount', firstBank);
                    handleVoucherInputChange('contraToAccount', 'Cash in Hand');
                    handleVoucherInputChange('narration', 'Cash withdrawn for petty expenses');
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                >
                  Withdraw for Petty Cash
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Transfer From (Source) *</label>
                  <select
                    value={voucherForm.contraFromAccount}
                    onChange={(e) => handleVoucherInputChange('contraFromAccount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="">Select Account</option>
                    <option value="Cash in Hand">Cash in Hand</option>
                    <option value="Petty Cash Account">Petty Cash Account</option>
                    {bankAccounts.map(b => (
                      <option key={`from_${b.id}`} value={`${b.bank_name} (${b.account_number})`}>
                        {b.bank_name} ({b.account_number})
                      </option>
                    ))}
                  </select>
                  {voucherErrors.contraFromAccount && <span className="text-[10px] text-rose-600">{voucherErrors.contraFromAccount}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Transfer To (Destination) *</label>
                  <select
                    value={voucherForm.contraToAccount}
                    onChange={(e) => handleVoucherInputChange('contraToAccount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="">Select Account</option>
                    <option value="Cash in Hand">Cash in Hand</option>
                    <option value="Petty Cash Account">Petty Cash Account</option>
                    {bankAccounts.map(b => (
                      <option key={`to_${b.id}`} value={`${b.bank_name} (${b.account_number})`}>
                        {b.bank_name} ({b.account_number})
                      </option>
                    ))}
                  </select>
                  {voucherErrors.contraToAccount && <span className="text-[10px] text-rose-600">{voucherErrors.contraToAccount}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Transfer Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherForm.contraAmount}
                      onChange={(e) => handleVoucherInputChange('contraAmount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  {voucherErrors.contraAmount && <span className="text-[10px] text-rose-600">{voucherErrors.contraAmount}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Slip / Cheque / Ref No</label>
                  <input
                    type="text"
                    value={voucherForm.contraRefNo}
                    onChange={(e) => handleVoucherInputChange('contraRefNo', e.target.value)}
                    placeholder="Chq # or deposit slip #"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Narration</label>
                <textarea
                  value={voucherForm.narration}
                  onChange={(e) => handleVoucherInputChange('narration', e.target.value)}
                  placeholder="Being cash transferred..."
                  rows="2"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs resize-none"
                />
              </div>

              {/* Action */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoucherPreviewSubmit}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Preview Contra Voucher (CV)</span>
                </button>
              </div>
            </div>
          )}

          {/* E. DEBIT NOTE */}
          {voucherType === 'DEBIT_NOTE' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Date *</label>
                  <input
                    type="date"
                    value={voucherForm.date}
                    onChange={(e) => handleVoucherInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  {voucherErrors.date && <span className="text-[10px] text-rose-600">{voucherErrors.date}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Voucher Number</label>
                  <input
                    type="text"
                    readOnly
                    value={getVoucherNumber('DEBIT_NOTE')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Party (Vendor / Supplier) *</label>
                <input
                  type="text"
                  value={voucherForm.debitParty}
                  onChange={(e) => handleVoucherInputChange('debitParty', e.target.value)}
                  placeholder="Enter vendor or supplier name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
                {voucherErrors.debitParty && <span className="text-[10px] text-rose-600">{voucherErrors.debitParty}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Affected Ledger *</label>
                  <select
                    value={voucherForm.debitAffectedLedger}
                    onChange={(e) => handleVoucherInputChange('debitAffectedLedger', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="Purchase Returns">Purchase Returns</option>
                    <option value="Sundry Creditors">Sundry Creditors</option>
                    <option value="Price Escalation / Rate Diff">Price Escalation / Rate Diff</option>
                    <option value="Material Rejection / Scrap">Material Rejection / Scrap</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Original Invoice / PO Ref</label>
                  <input
                    type="text"
                    value={voucherForm.debitRefDoc}
                    onChange={(e) => handleVoucherInputChange('debitRefDoc', e.target.value)}
                    placeholder="e.g. PO-0012 or INV-992"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Debit Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherForm.debitAmount}
                      onChange={(e) => handleVoucherInputChange('debitAmount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  {voucherErrors.debitAmount && <span className="text-[10px] text-rose-600">{voucherErrors.debitAmount}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Reason *</label>
                  <select
                    value={voucherForm.debitReason}
                    onChange={(e) => handleVoucherInputChange('debitReason', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="Purchase Return">Purchase Return</option>
                    <option value="Shortage / Rejection">Shortage / Rejection</option>
                    <option value="Rate Difference">Rate Difference</option>
                    <option value="Discount Disallowed">Discount Disallowed</option>
                    <option value="Other">Other Adjustment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Narration</label>
                <textarea
                  value={voucherForm.narration}
                  onChange={(e) => handleVoucherInputChange('narration', e.target.value)}
                  placeholder="Being debit note issued for..."
                  rows="2"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs resize-none"
                />
              </div>

              {/* Action */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoucherPreviewSubmit}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileMinus className="w-4 h-4" />
                  <span>Preview Debit Note (DN)</span>
                </button>
              </div>
            </div>
          )}

          {/* F. CREDIT NOTE */}
          {voucherType === 'CREDIT_NOTE' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Date *</label>
                  <input
                    type="date"
                    value={voucherForm.date}
                    onChange={(e) => handleVoucherInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                  />
                  {voucherErrors.date && <span className="text-[10px] text-rose-600">{voucherErrors.date}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Voucher Number</label>
                  <input
                    type="text"
                    readOnly
                    value={getVoucherNumber('CREDIT_NOTE')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Party (Customer / Client) *</label>
                <input
                  type="text"
                  value={voucherForm.creditParty || customerName}
                  onChange={(e) => handleVoucherInputChange('creditParty', e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
                {voucherErrors.creditParty && <span className="text-[10px] text-rose-600">{voucherErrors.creditParty}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Affected Ledger *</label>
                  <select
                    value={voucherForm.creditAffectedLedger}
                    onChange={(e) => handleVoucherInputChange('creditAffectedLedger', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="Sales Returns">Sales Returns</option>
                    <option value="Sundry Debtors">Sundry Debtors</option>
                    <option value="Discount Allowed / Rebate">Discount Allowed / Rebate</option>
                    <option value="Billing Error Adjustment">Billing Error Adjustment</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Reference Invoice / Bill</label>
                  <input
                    type="text"
                    value={voucherForm.creditRefDoc}
                    onChange={(e) => handleVoucherInputChange('creditRefDoc', e.target.value)}
                    placeholder="Click bill on left or type invoice #"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Credit Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherForm.creditAmount}
                      onChange={(e) => handleVoucherInputChange('creditAmount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  {voucherErrors.creditAmount && <span className="text-[10px] text-rose-600">{voucherErrors.creditAmount}</span>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Reason *</label>
                  <select
                    value={voucherForm.creditReason}
                    onChange={(e) => handleVoucherInputChange('creditReason', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="Sales Return">Sales Return</option>
                    <option value="Quality Rejection / Rebate">Quality Rejection / Rebate</option>
                    <option value="Volume Discount">Volume Discount</option>
                    <option value="Rate Correction">Rate Correction</option>
                    <option value="Other">Other Adjustment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">Narration</label>
                <textarea
                  value={voucherForm.narration}
                  onChange={(e) => handleVoucherInputChange('narration', e.target.value)}
                  placeholder="Being credit note issued towards..."
                  rows="2"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs resize-none"
                />
              </div>

              {/* Action */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoucherPreviewSubmit}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>Preview Credit Note (CN)</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── INTERACTIVE VOUCHER PREVIEW MODAL ── */}
      {previewVoucherData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    {previewVoucherData.title} Preview
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    SP TECHPIONEER ERP • Standard Double-Entry Voucher
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVoucherData(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voucher Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Voucher No</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900">{previewVoucherData.voucherNo}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
                  <span className="font-semibold text-slate-800">{formatDate(previewVoucherData.date)}</span>
                </div>
              </div>

              {/* Accounting details */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {previewVoucherData.party && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-white">
                    <span className="text-slate-500 font-medium">Party / Payee:</span>
                    <strong className="text-slate-900 font-bold">{previewVoucherData.party}</strong>
                  </div>
                )}
                {previewVoucherData.debitLedger && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Debit Ledger (Dr):</span>
                    <strong className="text-blue-700 font-bold">{previewVoucherData.debitLedger}</strong>
                  </div>
                )}
                {previewVoucherData.creditLedger && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-white">
                    <span className="text-slate-500 font-medium">Credit Ledger (Cr):</span>
                    <strong className="text-slate-800 font-bold">{previewVoucherData.creditLedger}</strong>
                  </div>
                )}
                {previewVoucherData.fromAccount && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-white">
                    <span className="text-slate-500 font-medium">Transfer From:</span>
                    <strong className="text-slate-800 font-bold">{previewVoucherData.fromAccount}</strong>
                  </div>
                )}
                {previewVoucherData.toAccount && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/50">
                    <span className="text-slate-500 font-medium">Transfer To:</span>
                    <strong className="text-blue-700 font-bold">{previewVoucherData.toAccount}</strong>
                  </div>
                )}
                {previewVoucherData.ref && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-white">
                    <span className="text-slate-500 font-medium">Reference Doc:</span>
                    <span className="font-mono text-slate-700">{previewVoucherData.ref}</span>
                  </div>
                )}
                {previewVoucherData.reason && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-white">
                    <span className="text-slate-500 font-medium">Reason:</span>
                    <span className="font-semibold text-slate-800">{previewVoucherData.reason}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-50/40 border-t border-blue-200">
                  <span className="text-slate-700 font-bold uppercase tracking-wider text-[11px]">Voucher Total Amount:</span>
                  <span className="font-mono font-extrabold text-sm text-blue-900">{formatCurrency(previewVoucherData.amount)}</span>
                </div>
              </div>

              {previewVoucherData.narration && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Narration</span>
                  <p className="text-slate-700 italic">{previewVoucherData.narration}</p>
                </div>
              )}

              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Accounting validation passed. Ready for general ledger posting.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium">Interactive Preview Concept</span>
              <button
                type="button"
                onClick={() => setPreviewVoucherData(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD AGST REF MODAL ── */}
      {isAddAgstRefModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <FilePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Add Agst Ref — Bill-wise Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add specific outstanding invoices for <strong className="text-slate-800">{customerName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAgstRefModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selector: Existing Invoices vs Custom Reference */}
            <div className="px-5 pt-3 bg-white border-b border-slate-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveAgstRefTab('existing')}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeAgstRefTab === 'existing'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Outstanding Invoices</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {unaddedCustomerInvoices.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAgstRefTab('custom')}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeAgstRefTab === 'custom'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>+ Custom Reference</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              
              {/* TAB 1: EXISTING OUTSTANDING INVOICES */}
              {activeAgstRefTab === 'existing' && (
                <div className="space-y-3">
                  {/* Search Bar & Add All Button */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by Invoice No, SO No, PO..."
                        value={agstRefSearch}
                        onChange={(e) => setAgstRefSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium"
                      />
                    </div>
                    {unaddedCustomerInvoices.length > 1 && (
                      <button
                        type="button"
                        onClick={handleAddAllAvailableInvoices}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Add All ({unaddedCustomerInvoices.length})
                      </button>
                    )}
                  </div>

                  {/* Invoices List */}
                  {unaddedCustomerInvoices.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="text-xs font-semibold text-slate-700">
                        {customerInvoices.length === 0
                          ? `No open outstanding invoices found for ${customerName}.`
                          : `All available outstanding invoices for ${customerName} are already in the allocation table.`}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Use the "Custom Reference" tab if you need to record a manual or offline reference.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {unaddedCustomerInvoices.map((inv) => {
                        const out = parseFloat(inv.outstanding) || 0;
                        const invDate = inv.invoice_date || inv.created_at;
                        const creditDays = inv.credit_days || 60;

                        return (
                          <div
                            key={inv.id}
                            className="p-3 bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 rounded-xl transition-all flex items-center justify-between gap-3 shadow-2xs group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  Agst Ref
                                </span>
                                <span className="font-mono font-bold text-xs text-slate-900 truncate">
                                  {inv.invoice_no || inv.so_number || `INV-${inv.id}`}
                                </span>
                                {inv.so_number && inv.invoice_no && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    (SO: {inv.so_number})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                                <span>Date: <strong className="text-slate-700 font-medium">{formatDate(invDate)}</strong></span>
                                <span>•</span>
                                <span>Credit: <strong className="text-slate-700 font-medium">{creditDays} Days</strong></span>
                                {inv.customer_po_no && (
                                  <>
                                    <span>•</span>
                                    <span>PO: <strong className="text-slate-700 font-mono font-medium">{inv.customer_po_no}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-right flex items-center gap-3">
                              <div>
                                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Due Amount</span>
                                <span className="font-mono text-xs font-bold text-slate-900">{formatCurrency(out)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddInvoiceToTable(inv)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CUSTOM MANUAL REFERENCE */}
              {activeAgstRefTab === 'custom' && (
                <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                        Invoice / Reference Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INV-2026-0045 or BILL-889"
                        value={customRefInput.invoice_no}
                        onChange={(e) => setCustomRefInput(prev => ({ ...prev, invoice_no: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                        Sales Order # (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SO-2026-012"
                        value={customRefInput.so_number}
                        onChange={(e) => setCustomRefInput(prev => ({ ...prev, so_number: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                        Invoice Date
                      </label>
                      <input
                        type="date"
                        value={customRefInput.invoice_date}
                        onChange={(e) => setCustomRefInput(prev => ({ ...prev, invoice_date: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                        Credit Days
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customRefInput.credit_days}
                        onChange={(e) => setCustomRefInput(prev => ({ ...prev, credit_days: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                        Due Amount (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={customRefInput.outstanding}
                          onChange={(e) => setCustomRefInput(prev => ({ ...prev, outstanding: e.target.value }))}
                          className="w-full pl-6 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddCustomRef}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Reference</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Currently <strong>{companyBillReferences.length}</strong> bill reference(s) in allocation table
              </span>
              <button
                type="button"
                onClick={() => setIsAddAgstRefModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isPage) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300 pb-12 max-w-7xl mx-auto">
        {modalContent}
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={null} size="6xl">
      {modalContent}
    </Modal>
  );
};

export default PaymentReceivedModal;
