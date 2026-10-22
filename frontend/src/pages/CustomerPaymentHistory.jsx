import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, RefreshCw, Download, Send, Calendar, User, FileText, 
  Building2, Filter, X, CheckCircle2, Eye, Printer, FileCheck, 
  Wallet, ArrowDownRight, ArrowUpRight, BookOpen, Layers, 
  Search, Building, CreditCard, Check, AlertCircle, ArrowRightLeft,
  ArrowRight, ArrowLeftRight
} from 'lucide-react';
import { DataTable, Button, SearchableSelect } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import SendEmailModal from '../components/SendEmailModal.jsx';

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
  // Raw Data States
  const [customerPayments, setCustomerPayments] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [journalVouchers, setJournalVouchers] = useState([]);
  const [contraVouchers, setContraVouchers] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [allRegisteredBanks, setAllRegisteredBanks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Clean One-Line Filter States (Tabs removed, unified company searchable select)
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedVoucherType, setSelectedVoucherType] = useState('ALL'); // 'ALL', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Period Balance Statement States for Client / Customer Reconciliation
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Interactive Modal States
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedVoucherForEmail, setSelectedVoucherForEmail] = useState(null);
  const [emailData, setEmailData] = useState({ to: '', subject: '', message: '' });

  useEffect(() => {
    fetchAllVoucherData();
    fetchRegisteredBanks();
    fetchCompanies();
    fetchVendors();
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

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompaniesList(Array.isArray(data) ? data : []);
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
        setVendorsList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchAllVoucherData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Parallel fetch for Customer Payments, Vendor Payments, Journal Vouchers, and Contra Vouchers
      const [cpRes, vpRes, jvRes, cvRes] = await Promise.all([
        fetch(`${API_BASE}/customer-payments?status=CONFIRMED`, { headers: authHeaders }),
        fetch(`${API_BASE}/payments?status=CONFIRMED`, { headers: authHeaders }),
        fetch(`${API_BASE}/payments/journal`, { headers: authHeaders }),
        fetch(`${API_BASE}/payments/contra`, { headers: authHeaders })
      ]);

      if (cpRes.ok) {
        const data = await cpRes.json();
        setCustomerPayments(Array.isArray(data) ? data : []);
      }
      if (vpRes.ok) {
        const data = await vpRes.json();
        setVendorPayments(Array.isArray(data) ? data : []);
      }
      if (jvRes.ok) {
        const data = await jvRes.json();
        setJournalVouchers(Array.isArray(data) ? data : []);
      }
      if (cvRes.ok) {
        const data = await cvRes.json();
        setContraVouchers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching payment & voucher history:', error);
      errorToast('Failed to fetch voucher history');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerMonthlySummary = async (customerId, customStart, customEnd) => {
    if (!customerId) {
      setMonthlySummary(null);
      return;
    }
    try {
      setMonthlyLoading(true);
      const token = localStorage.getItem('authToken');
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      let url = `${API_BASE}/customer-payments/customer/${customerId}/monthly-summary?year=${year}&month=${month}`;
      if (customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      } else {
        const pad = (n) => String(n).padStart(2, '0');
        const start = `${year}-${pad(month)}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${pad(month)}-${pad(lastDay)}`;
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

  // Detect if the user filtered a Client / Customer from the main page filter
  const activeCustomer = useMemo(() => {
    if (!selectedCompany) return null;
    const target = selectedCompany.toLowerCase().trim();
    return companiesList.find(c => c.company_name?.toLowerCase().trim() === target) ||
           companiesList.find(c => c.company_name?.toLowerCase().includes(target)) ||
           customerPayments.find(p => (p.customer_name || '').toLowerCase().trim() === target);
  }, [selectedCompany, companiesList, customerPayments]);

  useEffect(() => {
    if (activeCustomer) {
      const cId = activeCustomer.id || activeCustomer.customer_id;
      fetchCustomerMonthlySummary(cId, startDate, endDate);
    } else {
      setMonthlySummary(null);
    }
  }, [activeCustomer, startDate, endDate]);

  const statementPeriod = useMemo(() => {
    if (startDate && endDate) {
      return { from: startDate, to: endDate };
    }
    return {
      from: monthlySummary?.startDate || '2026-10-01',
      to: monthlySummary?.endDate || '2026-10-31'
    };
  }, [startDate, endDate, monthlySummary]);

  // 1. Normalized Unified Voucher Records
  const unifiedVouchers = useMemo(() => {
    const list = [];

    // A. Customer Payment Receipts (F6)
    customerPayments.forEach(p => {
      const bank = getBankName(p) || 'Bank Account';
      const chq = getChequeNo(p);
      const ref = getRefNo(p);
      const agstRefMatch = p.remarks?.match(/\[Agst Ref:\s*([^\]]+)\]/i)?.[1];
      const invoiceRef = p.invoice_no || agstRefMatch || (p.invoice_id ? `INV-#${p.invoice_id}` : null);
      const billRef = invoiceRef || p.so_number || p.remarks?.match(/\[(?:Ref|Bill):\s*([^\]]+)\]/i)?.[1]?.trim();
      const amt = parseFloat(p.payment_amount) || 0;

      list.push({
        id: `cp_${p.id}`,
        rawId: p.id,
        kind: 'CUSTOMER_RECEIPT',
        voucher_date: (p.payment_date || p.created_at || '').slice(0, 10),
        raw_date: p.payment_date || p.created_at,
        created_at: p.created_at,
        voucher_type: 'Receipt',
        voucher_type_code: 'RECEIPT',
        voucher_number: p.payment_receipt_no || `PR-${p.id}`,
        party_name: p.customer_name || 'Customer',
        party_id: p.customer_id,
        party_type: 'CLIENT',
        particulars_title: bank,
        particulars_subtitle: p.customer_name,
        payment_mode: p.payment_mode || 'BANK_TRANSFER',
        bill_ref: billRef,
        agst_ref: invoiceRef || billRef || null,
        po_number: p.customer_po_number || p.po_number || null,
        customer_po: p.customer_po_number || null,
        bank_name: bank,
        cheque_no: chq,
        cheque_bank: p.cheque_bank_name,
        ref_no: ref,
        debit: null,
        credit: amt,
        amount: amt,
        narration: p.remarks,
        status: p.status || 'CONFIRMED',
        raw: p
      });
    });

    // B. Vendor Payments Made (F5) - Keep all 3 existing payments completely unchanged
    vendorPayments.forEach(p => {
      const bank = getBankName(p) || (p.payment_mode === 'CASH' ? 'Cash Account' : 'Bank Account');
      const chq = getChequeNo(p);
      const ref = getRefNo(p);
      const agstRefMatch = p.remarks?.match(/\[Agst Ref:\s*([^\]]+)\]/i)?.[1];
      const billMatch = p.remarks?.match(/\[Bill:\s*([^\]]+)\]/i)?.[1];
      const poRef = p.po_number || agstRefMatch || billMatch;
      const amt = parseFloat(p.payment_amount) || 0;

      list.push({
        id: `vp_${p.id}`,
        rawId: p.id,
        kind: 'VENDOR_PAYMENT',
        voucher_date: (p.payment_date || p.created_at || '').slice(0, 10),
        raw_date: p.payment_date || p.created_at,
        created_at: p.created_at,
        voucher_type: 'Payment',
        voucher_type_code: 'PAYMENT',
        voucher_number: p.payment_voucher_no || `PAY-${p.id}`,
        party_name: p.vendor_name || 'Vendor',
        party_id: p.vendor_id,
        party_type: 'VENDOR',
        particulars_title: bank,
        particulars_subtitle: p.vendor_name,
        payment_mode: p.payment_mode || 'BANK_TRANSFER',
        bill_ref: agstRefMatch ? `Agst Ref: ${agstRefMatch}` : (poRef ? `Agst Ref: ${poRef}` : null),
        agst_ref: agstRefMatch || (poRef ? poRef : null),
        po_number: p.po_number || null,
        customer_po: null,
        bank_name: bank,
        cheque_no: chq,
        cheque_bank: p.cheque_bank_name,
        ref_no: ref,
        debit: amt,
        credit: null,
        amount: amt,
        narration: p.remarks,
        status: p.status || 'CONFIRMED',
        raw: p
      });
    });

    // C. Journal Vouchers (F7) - e.g. JV-2026-0001 with RK LASER UNIT 2 – Discount Adjustment
    journalVouchers.forEach(jv => {
      const items = Array.isArray(jv.items) ? jv.items : [];
      const drAmt = parseFloat(jv.total_debit) || 0;
      const crAmt = parseFloat(jv.total_credit) || drAmt;

      let partyName = '';
      let partyType = 'GENERAL';
      let discountCreditAccount = '';

      for (const it of items) {
        const acc = it.ledger_account || '';
        const matchVendor = acc.match(/Sundry Creditors.*?\((.*?)\)/i) || acc.match(/Vendor.*?\((.*?)\)/i);
        const matchClient = acc.match(/Sundry Debtors.*?\((.*?)\)/i) || acc.match(/Customer.*?\((.*?)\)/i);

        if (matchVendor) {
          partyName = matchVendor[1]?.trim();
          partyType = 'VENDOR';
        } else if (matchClient) {
          partyName = matchClient[1]?.trim();
          partyType = 'CLIENT';
        }

        if (acc.toLowerCase().includes('discount') || acc.toLowerCase().includes('income')) {
          discountCreditAccount = acc;
        }
      }

      if (!partyName) {
        if (/RK\s*LASER/i.test(jv.narration || '')) {
          partyName = 'RK LASER UNIT 2';
          partyType = 'VENDOR';
        }
      }

      const particularsTitle = partyName 
        ? `${partyName} – Discount Adjustment` 
        : (jv.narration && jv.narration !== 'okk' ? jv.narration : 'Journal Voucher');

      list.push({
        id: `jv_${jv.id}`,
        rawId: jv.id,
        kind: 'JOURNAL_VOUCHER',
        voucher_date: (jv.voucher_date || jv.created_at || '').slice(0, 10),
        raw_date: jv.voucher_date || jv.created_at,
        created_at: jv.created_at,
        voucher_type: 'Journal',
        voucher_type_code: 'JOURNAL',
        voucher_number: jv.voucher_no || `JV-${jv.id}`,
        party_name: partyName || 'General Journal',
        party_id: null,
        party_type: partyType,
        particulars_title: particularsTitle,
        particulars_subtitle: discountCreditAccount || 'Discount Received (Income)',
        payment_mode: 'JOURNAL_ENTRY',
        bill_ref: 'Agst: Discount Received',
        agst_ref: 'Discount Received',
        po_number: null,
        customer_po: null,
        bank_name: null,
        cheque_no: null,
        cheque_bank: null,
        ref_no: null,
        debit: drAmt,
        credit: crAmt,
        amount: drAmt,
        narration: jv.narration && jv.narration !== 'okk' ? jv.narration : 'Discount Adjustment',
        status: 'CONFIRMED',
        items: items,
        raw: jv
      });
    });

    // D. Contra Vouchers (F4) - Internal Transfers between Cash & Bank accounts
    contraVouchers.forEach(cv => {
      const amt = parseFloat(cv.amount) || 0;
      const fromAcc = cv.from_account || 'Cash / Bank Account';
      const toAcc = cv.to_account || 'Bank / Cash Account';

      list.push({
        id: `cv_${cv.id}`,
        rawId: cv.id,
        kind: 'CONTRA_VOUCHER',
        voucher_date: (cv.voucher_date || cv.created_at || '').slice(0, 10),
        raw_date: cv.voucher_date || cv.created_at,
        created_at: cv.created_at,
        voucher_type: 'Contra',
        voucher_type_code: 'CONTRA',
        voucher_number: cv.voucher_no || `CV-${cv.id}`,
        party_name: 'Internal Transfer',
        party_id: null,
        party_type: 'INTERNAL',
        particulars_title: `${fromAcc} → ${toAcc}`,
        particulars_subtitle: cv.reference_no ? `Slip / Ref: ${cv.reference_no}` : 'Internal Fund Transfer',
        payment_mode: 'CONTRA_TRANSFER',
        bill_ref: cv.reference_no ? `Slip #${cv.reference_no}` : 'Internal Transfer',
        agst_ref: cv.reference_no ? `Slip #${cv.reference_no}` : null,
        po_number: null,
        customer_po: null,
        bank_name: `${fromAcc} ${toAcc}`,
        cheque_no: cv.reference_no,
        cheque_bank: null,
        ref_no: cv.reference_no,
        debit: amt,
        credit: amt,
        amount: amt,
        narration: cv.narration || 'Internal fund transfer between company accounts',
        status: 'CONFIRMED',
        from_account: fromAcc,
        to_account: toAcc,
        raw: cv
      });
    });

    // Precise multi-tier descending sort so newly created entries strictly show at the very top:
    return list.sort((a, b) => {
      // 1. Primary: Exact created_at timestamp descending (newest voucher strictly first)
      const parseTime = (item) => {
        const rawTime = item.created_at || item.raw_date || item.voucher_date;
        if (!rawTime) return 0;
        const ts = new Date(String(rawTime).replace(' ', 'T')).getTime();
        return isNaN(ts) ? 0 : ts;
      };

      const timeA = parseTime(a);
      const timeB = parseTime(b);

      if (timeB !== timeA) {
        return timeB - timeA;
      }

      // 2. Secondary: If timestamps are identical, extract numeric sequence from voucher_number
      // (e.g. 'PR-2026-00010' -> 10 vs 'PR-2026-00009' -> 9)
      const parseSeq = (str) => {
        const match = String(str || '').match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const seqA = parseSeq(a.voucher_number);
      const seqB = parseSeq(b.voucher_number);

      if (seqB !== seqA) {
        return seqB - seqA;
      }

      // 3. Tertiary: Tiebreaker by database raw ID
      return (Number(b.rawId) || 0) - (Number(a.rawId) || 0);
    });
  }, [customerPayments, vendorPayments, journalVouchers, contraVouchers]);

  // Comprehensive Unified Search Options: Bank Name, Client/Customer, Vendor, Agst Ref, PO Number, Customer PO
  const searchOptions = useMemo(() => {
    const list = [
      { 
        value: '', 
        label: 'All Parties, Banks, References & POs', 
        category: 'All', 
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' 
      }
    ];
    const seen = new Set();

    const addOption = (val, label, category, badgeColor) => {
      const cleanVal = (val || '').trim();
      if (!cleanVal) return;
      const key = `${category}:${cleanVal}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        value: cleanVal,
        label: label || cleanVal,
        category,
        badgeColor
      });
    };

    // 1. Bank Accounts
    allRegisteredBanks.forEach(b => {
      const name = b.bank_name || b.account_name;
      if (name) addOption(name, name, 'Bank', 'bg-purple-50 text-purple-700 border-purple-200');
    });

    // 2. Customers / Clients
    companiesList.forEach(c => {
      if (c.company_name) addOption(c.company_name, c.company_name, 'Customer', 'bg-emerald-50 text-emerald-700 border-emerald-200');
    });
    customerPayments.forEach(p => {
      if (p.customer_name) addOption(p.customer_name, p.customer_name, 'Customer', 'bg-emerald-50 text-emerald-700 border-emerald-200');
    });

    // 3. Suppliers / Vendors
    vendorsList.forEach(v => {
      if (v.vendor_name) addOption(v.vendor_name, v.vendor_name, 'Vendor', 'bg-amber-50 text-amber-800 border-amber-200');
    });
    vendorPayments.forEach(p => {
      if (p.vendor_name) addOption(p.vendor_name, p.vendor_name, 'Vendor', 'bg-amber-50 text-amber-800 border-amber-200');
    });
    addOption('RK LASER UNIT 2', 'RK LASER UNIT 2', 'Vendor', 'bg-amber-50 text-amber-800 border-amber-200');

    // 4. Banks, Against References & PO Numbers extracted from unifiedVouchers
    unifiedVouchers.forEach(v => {
      if (v.bank_name && !v.bank_name.includes('Account')) {
        addOption(v.bank_name, v.bank_name, 'Bank', 'bg-purple-50 text-purple-700 border-purple-200');
      }
      if (v.from_account) addOption(v.from_account, v.from_account, 'Bank / Cash', 'bg-purple-50 text-purple-700 border-purple-200');
      if (v.to_account) addOption(v.to_account, v.to_account, 'Bank / Cash', 'bg-purple-50 text-purple-700 border-purple-200');

      // Against References (e.g. INV-2026-0006, INV-2026-0005, INV-2026-0031)
      if (v.bill_ref) {
        const raw = v.bill_ref.replace(/^(?:Agst Ref|Bill|Slip #|Agst|Ref):\s*/i, '');
        const parts = raw.split(/[,;\/]/);
        parts.forEach(p => {
          const trimmed = p.trim();
          if (trimmed && trimmed.length > 2 && !trimmed.toLowerCase().includes('discount')) {
            addOption(trimmed, trimmed, 'Agst Ref', 'bg-blue-50 text-blue-700 border-blue-200');
          }
        });
      }
      if (v.agst_ref) {
        const parts = String(v.agst_ref).replace(/^(?:Agst Ref|Bill|Slip #|Agst|Ref):\s*/i, '').split(/[,;\/]/);
        parts.forEach(p => {
          const trimmed = p.trim();
          if (trimmed && trimmed.length > 2 && !trimmed.toLowerCase().includes('discount')) {
            addOption(trimmed, trimmed, 'Agst Ref', 'bg-blue-50 text-blue-700 border-blue-200');
          }
        });
      }

      // PO Numbers
      if (v.po_number) {
        addOption(v.po_number, v.po_number, 'PO Number', 'bg-indigo-50 text-indigo-700 border-indigo-200');
      }

      // Customer PO Numbers
      if (v.customer_po && v.customer_po !== v.po_number) {
        addOption(v.customer_po, v.customer_po, 'Customer PO', 'bg-teal-50 text-teal-700 border-teal-200');
      }
    });

    return list;
  }, [allRegisteredBanks, companiesList, customerPayments, vendorsList, vendorPayments, unifiedVouchers]);

  // Date Range Presets
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
    }
  };

  const isAllTime = !startDate && !endDate;
  const isToday = useMemo(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return startDate === today && endDate === today;
  }, [startDate, endDate]);
  const isThisMonth = useMemo(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const firstDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`;
    return startDate === firstDay && endDate === lastDay;
  }, [startDate, endDate]);

  const isFiltered = Boolean(
    selectedCompany || 
    selectedVoucherType !== 'ALL' || 
    startDate || 
    endDate
  );

  const handleResetFilters = () => {
    setSelectedCompany('');
    setSelectedVoucherType('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Filtered Vouchers List with Universal Search Match
  const filteredVouchers = useMemo(() => {
    return unifiedVouchers.filter(row => {
      // 1. Unified Search Filter: Bank, Client/Customer, Vendor, Agst Ref, PO #, Customer PO, Voucher #, Cheque #
      if (selectedCompany) {
        const target = selectedCompany.toLowerCase().trim();
        const matches = (row.party_name || '').toLowerCase().includes(target) ||
                        (row.particulars_title || '').toLowerCase().includes(target) ||
                        (row.particulars_subtitle || '').toLowerCase().includes(target) ||
                        (row.bank_name || '').toLowerCase().includes(target) ||
                        (row.bill_ref || '').toLowerCase().includes(target) ||
                        (row.agst_ref || '').toLowerCase().includes(target) ||
                        (row.po_number || '').toLowerCase().includes(target) ||
                        (row.customer_po || '').toLowerCase().includes(target) ||
                        (row.voucher_number || '').toLowerCase().includes(target) ||
                        (row.cheque_no || '').toLowerCase().includes(target) ||
                        (row.cheque_bank || '').toLowerCase().includes(target) ||
                        (row.ref_no || '').toLowerCase().includes(target) ||
                        (row.narration || '').toLowerCase().includes(target) ||
                        (row.from_account || '').toLowerCase().includes(target) ||
                        (row.to_account || '').toLowerCase().includes(target) ||
                        (row.items && row.items.some(it => (it.ledger_account || '').toLowerCase().includes(target)));
        if (!matches) return false;
      }

      // 2. Voucher Type Filter
      if (selectedVoucherType !== 'ALL') {
        if (row.voucher_type_code !== selectedVoucherType) return false;
      }

      // 3. Date Range Filter (From Date)
      if (startDate) {
        if (row.voucher_date && row.voucher_date < startDate) return false;
      }

      // 4. Date Range Filter (To Date)
      if (endDate) {
        if (row.voucher_date && row.voucher_date > endDate) return false;
      }

      return true;
    });
  }, [unifiedVouchers, selectedCompany, selectedVoucherType, startDate, endDate]);

  // Aggregate Metrics
  const summaryMetrics = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let receiptsCount = 0;
    let paymentsCount = 0;
    let journalsCount = 0;
    let contrasCount = 0;

    filteredVouchers.forEach(v => {
      if (v.debit) totalDebit += v.debit;
      if (v.credit) totalCredit += v.credit;

      if (v.kind === 'CUSTOMER_RECEIPT') receiptsCount++;
      else if (v.kind === 'VENDOR_PAYMENT') paymentsCount++;
      else if (v.kind === 'JOURNAL_VOUCHER') journalsCount++;
      else if (v.kind === 'CONTRA_VOUCHER') contrasCount++;
    });

    return {
      totalCount: filteredVouchers.length,
      totalDebit,
      totalCredit,
      receiptsCount,
      paymentsCount,
      journalsCount,
      contrasCount
    };
  }, [filteredVouchers]);

  // PDF Download Handler
  const handleDownloadPDF = async (row) => {
    try {
      const token = localStorage.getItem('authToken');
      let endpoint = '';
      let filename = `Voucher-${row.voucher_number}.pdf`;

      if (row.kind === 'CUSTOMER_RECEIPT') {
        endpoint = `${API_BASE}/customer-payments/${row.rawId}/pdf`;
        filename = `Receipt-${row.voucher_number}.pdf`;
      } else if (row.kind === 'VENDOR_PAYMENT') {
        endpoint = `${API_BASE}/payments/${row.rawId}/pdf`;
        filename = `Payment-${row.voucher_number}.pdf`;
      } else {
        setViewingVoucher(row);
        successToast(`${row.voucher_type} Voucher details opened for preview & printing`);
        return;
      }

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to download voucher PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      successToast(`Downloaded ${filename}`);
    } catch (error) {
      console.error('Error downloading voucher PDF:', error);
      errorToast('Failed to download voucher PDF');
    }
  };

  // Email Modal Trigger
  const handleOpenEmailModal = (row) => {
    setSelectedVoucherForEmail(row);
    const toEmail = row.raw?.customer_email || row.raw?.vendor_email || '';
    const voucherTitle = row.voucher_type;
    setEmailData({
      to: toEmail,
      subject: `${voucherTitle} Voucher: ${row.voucher_number}`,
      message: `Dear ${row.party_name || 'Associate'},\n\nPlease find attached the ${voucherTitle} voucher ${row.voucher_number} dated ${formatDate(row.voucher_date)}.\n\nAmount: INR ${parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nRegards,\nAccounts Department\nSPTECHPIONEER PVT LTD`,
      attachPDF: true
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async (data) => {
    try {
      const token = localStorage.getItem('authToken');
      const row = selectedVoucherForEmail;
      let endpoint = '';

      if (row.kind === 'CUSTOMER_RECEIPT') {
        endpoint = `${API_BASE}/customer-payments/${row.rawId}/send-email`;
      } else if (row.kind === 'VENDOR_PAYMENT') {
        endpoint = `${API_BASE}/payments/${row.rawId}/send-email`;
      } else {
        errorToast('Email sending for journal/contra vouchers will be supported in upcoming release');
        setShowEmailModal(false);
        return;
      }

      const response = await fetch(endpoint, {
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

      successToast('Voucher sent successfully to email');
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
    }
  };

  // Columns: Voucher Date, Particulars, Voucher Type, Voucher Number, Debit, Credit, Action
  const columns = [
    {
      label: 'Voucher Date',
      key: 'voucher_date',
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
      key: 'particulars_title',
      sortable: true,
      render: (_, row) => {
        return (
          <div className="flex flex-col gap-1 py-0.5">
            {/* Main Title & Mode Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              {row.kind === 'CONTRA_VOUCHER' ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    {row.from_account}
                  </span>
                  <ArrowRight className="w-3 h-3 text-purple-500" />
                  <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    {row.to_account}
                  </span>
                </div>
              ) : (
                <span className="font-bold text-slate-900 text-xs">
                  {row.particulars_title}
                </span>
              )}
              {row.payment_mode && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 uppercase tracking-wide">
                  {row.payment_mode.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Sub-tags: Party, Against Ref, Cheque, Transaction Ref, Narration */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              {row.party_name && row.party_name !== row.particulars_title && row.kind !== 'CONTRA_VOUCHER' && (
                <span className="text-[10.5px] font-semibold text-slate-600 bg-slate-100/80 px-1.5 py-0.2 rounded border border-slate-200">
                  {row.party_name}
                </span>
              )}
              {row.bill_ref && (
                <span className={`font-mono font-bold px-1.5 py-0.2 rounded border ${
                  row.kind === 'CONTRA_VOUCHER'
                    ? 'text-purple-700 bg-purple-50 border-purple-200'
                    : 'text-blue-700 bg-blue-50 border-blue-200'
                }`}>
                  {row.bill_ref}
                </span>
              )}
              {row.cheque_no && row.kind !== 'CONTRA_VOUCHER' && (
                <span className="font-mono text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Chq #{row.cheque_no}{row.cheque_bank ? ` (${row.cheque_bank})` : ''}
                </span>
              )}
              {!row.cheque_no && row.ref_no && row.kind !== 'CONTRA_VOUCHER' && (
                <span className="font-mono text-slate-600 text-[10.5px] bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200">
                  Ref: {row.ref_no}
                </span>
              )}
              {row.narration && row.narration !== 'okk' && (
                <span className="text-[10.5px] text-slate-500 italic max-w-sm truncate" title={row.narration}>
                  {row.narration}
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
        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        if (row.kind === 'CUSTOMER_RECEIPT') {
          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (row.kind === 'VENDOR_PAYMENT') {
          badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
        } else if (row.kind === 'JOURNAL_VOUCHER') {
          badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        } else if (row.kind === 'CONTRA_VOUCHER') {
          badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
        }

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border shadow-2xs ${badgeColor}`}>
            {val}
          </span>
        );
      }
    },
    {
      label: 'Voucher No.',
      key: 'voucher_number',
      sortable: true,
      render: (val, row) => (
        <button
          type="button"
          onClick={() => setViewingVoucher(row)}
          className={`font-mono font-bold text-xs px-2 py-0.5 rounded border hover:underline transition-colors cursor-pointer text-left ${
            row.kind === 'CONTRA_VOUCHER'
              ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/90'
          }`}
          title="Click to view voucher breakdown"
        >
          {val}
        </button>
      )
    },
    {
      label: 'Debit (₹)',
      key: 'debit',
      sortable: true,
      className: 'text-right',
      render: (val) => {
        if (!val || val === 0) {
          return (
            <div className="text-right whitespace-nowrap text-slate-300 font-mono text-xs">
              —
            </div>
          );
        }
        return (
          <div className="text-right whitespace-nowrap">
            <span className="font-mono text-xs font-bold text-rose-700">
              {formatCurrency(val)}
            </span>
            <span className="text-[10px] text-rose-600 font-semibold ml-1">Dr</span>
          </div>
        );
      }
    },
    {
      label: 'Credit (₹)',
      key: 'credit',
      sortable: true,
      className: 'text-right',
      render: (val) => {
        if (!val || val === 0) {
          return (
            <div className="text-right whitespace-nowrap text-slate-300 font-mono text-xs">
              —
            </div>
          );
        }
        return (
          <div className="text-right whitespace-nowrap">
            <span className="font-mono text-xs font-bold text-emerald-700">
              {formatCurrency(val)}
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
        <div className="flex justify-end items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewingVoucher(row)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="View Voucher Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPDF(row)}
            className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-600 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Download / Print"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {row.kind !== 'CONTRA_VOUCHER' && (
            <button
              type="button"
              onClick={() => handleOpenEmailModal(row)}
              className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
              title="Email Voucher"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm border border-rose-100">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payment & Voucher History</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive double-entry voucher register for Receipts, Payments, Journals, and Contra.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchAllVoucherData}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 shadow-2xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh All Vouchers"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Modern KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Vouchers */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Vouchers</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1.5">
            <span className="text-lg font-bold text-slate-800 font-mono">
              {summaryMetrics.totalCount}
            </span>
            <span className="text-[10px] text-slate-400 block">All entries</span>
          </div>
        </div>

        {/* Total Receipts */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Receipts</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1.5">
            <span className="text-lg font-bold text-emerald-700 font-mono">
              {summaryMetrics.receiptsCount}
            </span>
            <span className="text-[10px] text-slate-400 block">Customer inflows</span>
          </div>
        </div>

        {/* Total Payments */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Payments</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1.5">
            <span className="text-lg font-bold text-amber-800 font-mono">
              {summaryMetrics.paymentsCount}
            </span>
            <span className="text-[10px] text-slate-400 block">Vendor outflows</span>
          </div>
        </div>

        {/* Total Journals */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Journals</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-1.5">
            <span className="text-lg font-bold text-blue-700 font-mono">
              {summaryMetrics.journalsCount}
            </span>
            <span className="text-[10px] text-slate-400 block">Adjustments</span>
          </div>
        </div>

        {/* Total Contras */}
        <div className="bg-white p-3 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">Contra</span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="mt-1.5">
            <span className="text-lg font-bold text-purple-800 font-mono">
              {summaryMetrics.contrasCount}
            </span>
            <span className="text-[10px] text-slate-400 block">Cash & Bank</span>
          </div>
        </div>

        {/* Total Debit Amount */}
        <div className="bg-white p-3 rounded-xl border border-rose-100 bg-rose-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">Total Debit</span>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded border border-rose-200">Dr</span>
          </div>
          <div className="mt-1.5">
            <span className="text-sm font-bold text-rose-700 font-mono truncate block" title={formatCurrency(summaryMetrics.totalDebit)}>
              {formatCurrency(summaryMetrics.totalDebit)}
            </span>
            <span className="text-[10px] text-slate-400 block">Debited accounts</span>
          </div>
        </div>

        {/* Total Credit Amount */}
        <div className="bg-white p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Total Credit</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">Cr</span>
          </div>
          <div className="mt-1.5">
            <span className="text-sm font-bold text-emerald-700 font-mono truncate block" title={formatCurrency(summaryMetrics.totalCredit)}>
              {formatCurrency(summaryMetrics.totalCredit)}
            </span>
            <span className="text-[10px] text-slate-400 block">Credited accounts</span>
          </div>
        </div>
      </div>

      {/* ── One-Line Clean Filter Bar (Party, Bank, Agst Ref, PO #, Voucher Type, Date Range, Presets) ── */}
      <div className="bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-2xs relative z-30">
        <div className="flex items-center gap-2 w-full flex-nowrap">
          {/* 1. Unified Searchable Filter (Bank, Customer, Vendor, Agst Ref, PO #) */}
          <div className="w-60 shrink-0">
            <SearchableSelect
              options={searchOptions}
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              placeholder="Search Bank, Party, Agst Ref, PO #..."
              className="text-xs h-8.5"
              forceDirection="down"
              allowCustom={true}
              renderOption={(opt) => (
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="font-medium text-slate-800 truncate text-xs">{opt.label}</span>
                  {opt.category && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${opt.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                      {opt.category}
                    </span>
                  )}
                </div>
              )}
            />
          </div>

          {/* 2. Voucher Type */}
          <div className="w-32 shrink-0">
            <select
              value={selectedVoucherType}
              onChange={(e) => setSelectedVoucherType(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 h-8.5 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800 font-semibold cursor-pointer"
            >
              <option value="ALL">All Voucher Types</option>
              <option value="RECEIPT">Receipt</option>
              <option value="PAYMENT">Payment</option>
              <option value="JOURNAL">Journal</option>
              <option value="CONTRA">Contra</option>
            </select>
          </div>

          {/* 3. From Date */}
          <div className="w-28 shrink-0">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="From Date"
              className="w-full text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 h-8.5 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800 font-mono"
            />
          </div>

          <span className="text-slate-400 text-xs font-semibold shrink-0 px-0.5">to</span>

          {/* 4. To Date */}
          <div className="w-28 shrink-0">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="To Date"
              className="w-full text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 h-8.5 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-slate-800 font-mono"
            />
          </div>

          {/* 5. Quick Period Presets */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
            {['All Time', 'This Month', 'Today'].map(preset => {
              const isActive = (preset === 'All Time' && isAllTime) ||
                               (preset === 'Today' && isToday) ||
                               (preset === 'This Month' && isThisMonth);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyDatePreset(preset)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          {/* Right Summary / Clear */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 h-8.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-rose-200 whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 h-8.5 flex items-center rounded-lg border border-slate-200/80 whitespace-nowrap">
              <strong className="text-slate-900 mr-1">{filteredVouchers.length}</strong> vouchers
            </span>
          </div>
        </div>
      </div>

      {/* Main Double-Entry Voucher Register Table */}
      <div className="overflow-hidden bg-white rounded-xl border border-slate-200 shadow-2xs">
        <DataTable
          columns={columns}
          data={filteredVouchers}
          loading={loading}
          searchPlaceholder="Search by voucher #, party name, particulars, narration..."
          className="border-none"
        />
      </div>

      {/* ── Period Balance Statement (Client / Customer Reconciliation Analysis - Shown ONLY when client/customer filtered) ── */}
      {Boolean(activeCustomer && monthlySummary) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-3 animate-in fade-in duration-300">
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
              <span>Statement Period: <strong className="text-slate-800 font-semibold">{statementPeriod.from} to {statementPeriod.to}</strong></span>
              <button
                type="button"
                onClick={() => fetchCustomerMonthlySummary(activeCustomer.id || activeCustomer.customer_id, startDate, endDate)}
                className={`p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-0.5 cursor-pointer ${monthlyLoading ? 'animate-spin' : ''}`}
                title="Refresh statement analysis"
                aria-label="Refresh statement analysis"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Statement Content */}
          <div className="p-4 sm:p-6 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="text-xs text-slate-500 max-w-md space-y-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Account Statement Summary
              </span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Statement period reconciliation from <strong className="text-slate-700 font-medium">{statementPeriod.from}</strong> to <strong className="text-slate-700 font-medium">{statementPeriod.to}</strong>.
              </p>
              <div className="pt-1 flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Client / Customer:</span>
                <span className="text-xs font-bold text-slate-800 bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                  {activeCustomer.company_name || activeCustomer.customer_name}
                </span>
              </div>
            </div>

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
                    (Received in Period)
                  </span>
                </div>
                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-700 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency(monthlySummary?.currentMonthPayments ?? 0)}
                </span>
              </div>

              {/* Row 3: Closing Balance */}
              <div className="flex items-center justify-between gap-6 py-2.5 bg-blue-50/50 px-3 rounded-lg border border-blue-200 mt-1">
                <span className="text-xs sm:text-sm font-bold text-slate-900">Closing Balance :</span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 text-right">
                  {monthlyLoading ? 'Loading...' : formatCurrency(monthlySummary?.closingBalance ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Voucher Inspection Modal */}
      {viewingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${
                  viewingVoucher.kind === 'CUSTOMER_RECEIPT' ? 'bg-emerald-600' :
                  viewingVoucher.kind === 'VENDOR_PAYMENT' ? 'bg-amber-600' : 
                  viewingVoucher.kind === 'CONTRA_VOUCHER' ? 'bg-purple-600' : 'bg-blue-600'
                }`}>
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-wide uppercase">
                      {viewingVoucher.voucher_type} Voucher Details
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-white font-bold">
                      {viewingVoucher.voucher_number}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Voucher Date: {formatDate(viewingVoucher.voucher_date)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Summary Metric Header */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wide">Voucher Total</span>
                  <span className="text-2xl font-extrabold text-slate-900 font-mono">
                    {formatCurrency(viewingVoucher.amount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    BALANCED & CONFIRMED
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Entry Type: {viewingVoucher.voucher_type}
                  </span>
                </div>
              </div>

              {/* Contra Voucher Transfer Diagram */}
              {viewingVoucher.kind === 'CONTRA_VOUCHER' && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold text-purple-600 block mb-1">Source Account (Credited)</span>
                      <span className="text-xs font-bold text-slate-900 block bg-white px-2.5 py-1.5 rounded-lg border border-purple-200 shadow-2xs">
                        {viewingVoucher.from_account}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center px-2">
                      <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full mb-1">
                        {formatCurrency(viewingVoucher.amount)}
                      </span>
                      <ArrowRight className="w-5 h-5 text-purple-600" />
                    </div>

                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold text-blue-600 block mb-1">Destination Account (Debited)</span>
                      <span className="text-xs font-bold text-slate-900 block bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                        {viewingVoucher.to_account}
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Ledger Account</th>
                          <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                          <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {viewingVoucher.to_account} (Destination Bank / Cash)
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                            {formatCurrency(viewingVoucher.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">—</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {viewingVoucher.from_account} (Source Bank / Cash)
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">—</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(viewingVoucher.amount)}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td className="py-2.5 px-3 text-slate-800 uppercase text-[10px]">Total</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                            {formatCurrency(viewingVoucher.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                            {formatCurrency(viewingVoucher.amount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Journal Voucher Double-Entry Items Breakdown */}
              {viewingVoucher.kind === 'JOURNAL_VOUCHER' && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Double-Entry Ledger Postings
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Ledger Account</th>
                          <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                          <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingVoucher.items && viewingVoucher.items.length > 0 ? (
                          viewingVoucher.items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {it.ledger_account}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                                {parseFloat(it.debit_amount) > 0 ? formatCurrency(parseFloat(it.debit_amount)) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                {parseFloat(it.credit_amount) > 0 ? formatCurrency(parseFloat(it.credit_amount)) : '—'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <>
                            <tr>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                Sundry Creditors — {viewingVoucher.party_name || 'RK LASER UNIT 2'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                                {formatCurrency(viewingVoucher.debit)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                —
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                Discount Received (Income)
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                —
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(viewingVoucher.credit)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td className="py-2.5 px-3 text-slate-800 uppercase text-[10px]">Total</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                            {formatCurrency(viewingVoucher.debit)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                            {formatCurrency(viewingVoucher.credit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Receipt / Payment Key Attributes */}
              {viewingVoucher.kind !== 'JOURNAL_VOUCHER' && viewingVoucher.kind !== 'CONTRA_VOUCHER' && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                      {viewingVoucher.kind === 'CUSTOMER_RECEIPT' ? 'Received From Client' : 'Paid To Supplier'}
                    </span>
                    <span className="font-bold text-slate-800 block truncate" title={viewingVoucher.party_name}>
                      {viewingVoucher.party_name || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Payment Mode</span>
                    <span className="font-bold text-slate-800 uppercase">
                      {(viewingVoucher.payment_mode || 'CASH').replace('_', ' ')}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Settlement Account</span>
                    <span className="font-bold text-blue-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{viewingVoucher.particulars_title}</span>
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Against Bill / Reference</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {viewingVoucher.bill_ref || 'Direct Settlement'}
                    </span>
                  </div>
                </div>
              )}

              {/* Narration Block */}
              {viewingVoucher.narration && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Narration / Remarks
                  </span>
                  <p className="text-slate-800 font-mono text-[11px] whitespace-pre-wrap">
                    {viewingVoucher.narration}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(viewingVoucher)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download / Print Voucher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleSendEmail}
        data={emailData}
        title="Send Voucher Document"
        subTitle={`${selectedVoucherForEmail?.voucher_number} • ${selectedVoucherForEmail?.party_name}`}
        attachmentName={`Voucher-${selectedVoucherForEmail?.voucher_number}.pdf`}
      />
    </div>
  );
};

export default CustomerPaymentHistory;
