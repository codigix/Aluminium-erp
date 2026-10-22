import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Search, Filter, RefreshCw, Eye, Edit2, Trash2, 
  Copy, Check, CheckCircle2, XCircle, CreditCard, Wallet, Landmark, 
  ArrowUpDown, ShieldCheck, ExternalLink, X, AlertCircle, Sparkles,
  Layers, ChevronRight, Hash, MapPin, User, FileText
} from 'lucide-react';
import { errorToast, successToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const POPULAR_BANKS = [
  'HDFC Bank',
  'State Bank of India',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'IndusInd Bank',
  'Union Bank of India'
];

const ACCOUNT_TYPES = [
  { value: 'CURRENT', label: 'Current Account', shortLabel: 'Current', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'SAVINGS', label: 'Savings Account', shortLabel: 'Savings', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'CASH_CREDIT', label: 'Cash Credit (CC)', shortLabel: 'Cash Credit', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'OD', label: 'Overdraft (OD)', shortLabel: 'OD', color: 'bg-amber-50 text-amber-700 border-amber-200' }
];

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const BankAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Form State
  const initialFormState = {
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'CURRENT',
    openingBalance: '0.00',
    isActive: true
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
        setAccounts(list);
      } else {
        const err = await res.json().catch(() => ({}));
        errorToast(err.error || 'Failed to load bank accounts');
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
      errorToast('Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const handleCopy = (text, fieldId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
    successToast(`Copied: ${text}`);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.bankName.trim()) errors.bankName = 'Bank name is required';
    if (!formData.accountHolderName.trim()) errors.accountHolderName = 'Account holder name is required';
    if (!formData.accountNumber.trim()) errors.accountNumber = 'Account number is required';
    if (!formData.ifscCode.trim()) {
      errors.ifscCode = 'IFSC code is required';
    } else if (formData.ifscCode.trim().length !== 11) {
      errors.ifscCode = 'IFSC code must be exactly 11 characters';
    }
    if (!formData.branchName.trim()) errors.branchName = 'Branch name is required';
    if (isNaN(parseFloat(formData.openingBalance))) {
      errors.openingBalance = 'Opening balance must be a valid number';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (account) => {
    setSelectedAccount(account);
    setFormData({
      bankName: account.bank_name || '',
      accountHolderName: account.account_holder_name || '',
      accountNumber: account.account_number || '',
      ifscCode: account.ifsc_code || '',
      branchName: account.branch_name || '',
      accountType: account.account_type || 'CURRENT',
      openingBalance: String(account.opening_balance ?? '0.00'),
      isActive: Boolean(account.is_active)
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleOpenView = async (account) => {
    setSelectedAccount(account);
    setIsViewModalOpen(true);
    // Optionally fetch extended details
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts/${account.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSelectedAccount(json.data);
        }
      }
    } catch (e) {
      console.error('Error fetching extended account details:', e);
    }
  };

  const handleOpenDelete = (account) => {
    setSelectedAccount(account);
    setIsDeleteModalOpen(true);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setFormSubmitting(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          branchName: formData.branchName,
          accountType: formData.accountType,
          openingBalance: parseFloat(formData.openingBalance) || 0,
          isActive: formData.isActive
        })
      });

      const json = await res.json();
      if (res.ok) {
        successToast(json.message || 'Bank account created successfully');
        setIsAddModalOpen(false);
        fetchBankAccounts();
      } else {
        errorToast(json.error || json.message || 'Failed to create bank account');
      }
    } catch (err) {
      console.error('Error saving bank account:', err);
      errorToast('Failed to save bank account');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !selectedAccount) return;

    try {
      setFormSubmitting(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          branchName: formData.branchName,
          accountType: formData.accountType,
          openingBalance: parseFloat(formData.openingBalance) || 0,
          isActive: formData.isActive
        })
      });

      const json = await res.json();
      if (res.ok) {
        successToast(json.message || 'Bank account updated successfully');
        setIsEditModalOpen(false);
        fetchBankAccounts();
      } else {
        errorToast(json.error || json.message || 'Failed to update bank account');
      }
    } catch (err) {
      console.error('Error updating bank account:', err);
      errorToast('Failed to update bank account');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (account) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts/${account.id}/toggle-status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok) {
        successToast(json.message || 'Status updated');
        fetchBankAccounts();
      } else {
        errorToast(json.error || json.message || 'Failed to toggle status');
      }
    } catch (err) {
      console.error('Error toggling status:', err);
      errorToast('Failed to toggle status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedAccount) return;
    try {
      setFormSubmitting(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/bank-accounts/${selectedAccount.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok) {
        successToast('Bank account deleted successfully');
        setIsDeleteModalOpen(false);
        fetchBankAccounts();
      } else {
        errorToast(json.error || json.message || 'Cannot delete bank account');
      }
    } catch (err) {
      console.error('Error deleting bank account:', err);
      errorToast('Failed to delete bank account');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filtered List
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Type Filter
      if (typeFilter !== 'ALL' && acc.account_type !== typeFilter) {
        return false;
      }
      // Status Filter
      if (statusFilter === 'ACTIVE' && !acc.is_active) return false;
      if (statusFilter === 'INACTIVE' && acc.is_active) return false;

      // Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const bName = (acc.bank_name || '').toLowerCase();
        const holder = (acc.account_holder_name || '').toLowerCase();
        const accNo = (acc.account_number || '').toLowerCase();
        const ifsc = (acc.ifsc_code || '').toLowerCase();
        const branch = (acc.branch_name || '').toLowerCase();
        return bName.includes(query) || holder.includes(query) || accNo.includes(query) || ifsc.includes(query) || branch.includes(query);
      }
      return true;
    });
  }, [accounts, typeFilter, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.is_active).length;
    const inactive = total - active;
    const totalOpeningBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.opening_balance) || 0), 0);
    const totalCredits = accounts.reduce((sum, a) => sum + (parseFloat(a.total_credits) || 0), 0);
    const totalDebits = accounts.reduce((sum, a) => sum + (parseFloat(a.total_debits) || 0), 0);
    const totalBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.current_balance ?? a.total_balance ?? a.opening_balance) || 0), 0);
    const currentCount = accounts.filter(a => a.account_type === 'CURRENT').length;
    const savingsCount = accounts.filter(a => a.account_type === 'SAVINGS').length;
    const ccCount = accounts.filter(a => a.account_type === 'CASH_CREDIT').length;
    const odCount = accounts.filter(a => a.account_type === 'OD').length;

    return { total, active, inactive, totalOpeningBalance, totalCredits, totalDebits, totalBalance, currentCount, savingsCount, ccCount, odCount };
  }, [accounts]);

  const getAccountTypeBadge = (type) => {
    const found = ACCOUNT_TYPES.find(t => t.value === type);
    return found || { label: type || 'Current', shortLabel: type || 'Current', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  return (
    <div className="space-y-5 p-1">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                Bank Accounts Master
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                ACCOUNTS & BANKING
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage company bank accounts, ledger balances, and banking configurations for invoices & payments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBankAccounts}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 shadow-2xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh bank accounts"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1.5 shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bank Account</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics Cards (Equal Width in One Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Bank Accounts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Accounts
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800 tracking-tight">
            {stats.total}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Active: <strong className="text-emerald-700 font-semibold">{stats.active}</strong></span>
            <span>Inactive: <strong className="text-slate-700 font-semibold">{stats.inactive}</strong></span>
          </div>
        </div>

        {/* Card 2: Total Balance */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Balance
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tracking-tight">
            {formatCurrency(stats.totalBalance)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-mono gap-1 whitespace-nowrap overflow-hidden">
            <span className="text-emerald-700 font-semibold whitespace-nowrap" title="Total Inflow across accounts">Cr: +{formatCurrency(stats.totalCredits)}</span>
            <span className="text-rose-700 font-semibold whitespace-nowrap" title="Total Outflow across accounts">Dr: -{formatCurrency(stats.totalDebits)}</span>
          </div>
        </div>

        {/* Card 3: Active Status Ratio */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Operational Status
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-800">{stats.active}</span>
            <span className="text-xs text-emerald-700 font-semibold">Active in ERP</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for receiving & vendor payouts</span>
          </div>
        </div>

        {/* Card 4: Account Types Breakdown */}
        <div className="bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 rounded-xl p-4 border-2 border-blue-600/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
              Account Types
            </span>
            <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="bg-white/80 p-1 rounded border border-blue-100 flex justify-between">
              <span className="text-slate-500">Current:</span>
              <span className="font-bold font-mono text-blue-700">{stats.currentCount}</span>
            </div>
            <div className="bg-white/80 p-1 rounded border border-blue-100 flex justify-between">
              <span className="text-slate-500">Savings:</span>
              <span className="font-bold font-mono text-emerald-700">{stats.savingsCount}</span>
            </div>
            <div className="bg-white/80 p-1 rounded border border-blue-100 flex justify-between">
              <span className="text-slate-500">CC:</span>
              <span className="font-bold font-mono text-purple-700">{stats.ccCount}</span>
            </div>
            <div className="bg-white/80 p-1 rounded border border-blue-100 flex justify-between">
              <span className="text-slate-500">OD:</span>
              <span className="font-bold font-mono text-amber-700">{stats.odCount}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-100 text-[10px] text-blue-700 font-semibold">
            All configured facilities
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by bank name, account #, holder, IFSC, branch..."
              className="w-full text-xs font-semibold py-2 pl-9 pr-3 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Filters & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Account Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Account Types</option>
              <option value="CURRENT">Current Account</option>
              <option value="SAVINGS">Savings Account</option>
              <option value="CASH_CREDIT">Cash Credit (CC)</option>
              <option value="OD">Overdraft (OD)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            {/* Clear Filters */}
            {(searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'card' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Cards View"
              >
                <CreditCard className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing <strong className="text-slate-800 font-semibold">{filteredAccounts.length}</strong> of {accounts.length} bank accounts</span>
          {loading && <span className="text-blue-600 font-semibold animate-pulse">Syncing accounts...</span>}
        </div>
      </div>

      {/* 4. Bank Accounts Presentation (Table or Card View) */}
      {filteredAccounts.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl border border-slate-200/90 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Landmark className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Bank Accounts Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No bank accounts match your search filters. Try clearing or relaxing your search query.'
              : 'No company bank accounts have been added yet. Click the button below to register your first bank account.'}
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bank Account</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Bank Name & Branch</th>
                  <th className="py-3 px-4">Account Holder</th>
                  <th className="py-3 px-4">Account Number & IFSC</th>
                  <th className="py-3 px-4">Account Type</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Inflow (Cr)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Outflow (Dr)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Total Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((account) => {
                  const typeBadge = getAccountTypeBadge(account.account_type);
                  return (
                    <tr key={account.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Bank Name & Branch */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
                            <Landmark className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block hover:text-blue-700 transition-colors cursor-pointer" onClick={() => handleOpenView(account)}>
                              {account.bank_name}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{account.branch_name || 'Main Branch'}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Account Holder Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {account.account_holder_name || '—'}
                        </div>
                        <span className="text-[10px] text-slate-400">Primary Beneficiary</span>
                      </td>

                      {/* Account Number & IFSC */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 tracking-wider">
                            {account.account_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(account.account_number, `acc-${account.id}`)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            title="Copy Account Number"
                          >
                            {copiedField === `acc-${account.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span>IFSC: <strong className="text-slate-700">{account.ifsc_code || '—'}</strong></span>
                          {account.ifsc_code && (
                            <button
                              type="button"
                              onClick={() => handleCopy(account.ifsc_code, `ifsc-${account.id}`)}
                              className="text-slate-400 hover:text-blue-600"
                              title="Copy IFSC Code"
                            >
                              {copiedField === `ifsc-${account.id}` ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Account Type */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${typeBadge.color}`}>
                          {typeBadge.shortLabel}
                        </span>
                      </td>

                      {/* Inflow (Cr) */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className="text-xs font-bold text-emerald-700 whitespace-nowrap inline-flex items-center justify-end">
                          +{formatCurrency(account.total_credits || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 block -mt-0.5 whitespace-nowrap">Total Inflow</span>
                      </td>

                      {/* Outflow (Dr) */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className="text-xs font-bold text-rose-700 whitespace-nowrap inline-flex items-center justify-end">
                          -{formatCurrency(account.total_debits || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 block -mt-0.5 whitespace-nowrap">Total Outflow</span>
                      </td>

                      {/* Total Balance */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-900 block whitespace-nowrap">
                          {formatCurrency(account.current_balance ?? account.total_balance ?? account.opening_balance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(account)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                            account.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                          }`}
                          title={`Click to ${account.is_active ? 'deactivate' : 'activate'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{account.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenView(account)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                            title="View Bank Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(account)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                            title="Edit Bank Account"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDelete(account)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                            title="Delete Bank Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => {
            const typeBadge = getAccountTypeBadge(account.account_type);
            return (
              <div 
                key={account.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all p-4 flex flex-col justify-between relative overflow-hidden"
              >
                {/* Top Strip */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {account.bank_name}
                        </h4>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{account.branch_name || 'Main Branch'}</span>
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeBadge.color}`}>
                      {typeBadge.shortLabel}
                    </span>
                  </div>

                  {/* Stylized Account Display */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Number</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(account.account_number, `card-acc-${account.id}`)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        {copiedField === `card-acc-${account.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 text-[10px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 tracking-wider">
                      {account.account_number}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500">IFSC: <strong className="font-mono text-slate-800">{account.ifsc_code || '—'}</strong></span>
                      <span className="text-slate-500 truncate max-w-[140px] text-right font-medium">
                        {account.account_holder_name}
                      </span>
                    </div>
                  </div>

                  {/* Balance & Status */}
                  <div className="flex items-center justify-between text-xs px-1 mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Balance</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {formatCurrency(account.current_balance ?? account.total_balance ?? account.opening_balance)}
                      </span>
                    </div>

                    <div className="text-right font-mono text-[10px] whitespace-nowrap">
                      <span className="text-emerald-700 block font-bold whitespace-nowrap">Cr: +{formatCurrency(account.total_credits || 0)}</span>
                      <span className="text-rose-700 block font-bold whitespace-nowrap">Dr: -{formatCurrency(account.total_debits || 0)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(account)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                        account.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{account.is_active ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenView(account)}
                    className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(account)}
                    className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(account)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Add Bank Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 flex items-center justify-between border-l-4 border-l-blue-600">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Add New Bank Account</h3>
                  <p className="text-xs text-slate-500">Configure company bank details for ledger & invoice receipts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              {/* Quick Select Bank Chips */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Popular Banks (Quick Select):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BANKS.slice(0, 6).map((bank) => (
                    <button
                      type="button"
                      key={bank}
                      onClick={() => setFormData(prev => ({ ...prev, bankName: bank }))}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                        formData.bankName === bank 
                          ? 'bg-blue-600 text-white border-blue-700 shadow-2xs' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Bank Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bankName}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="e.g. HDFC Bank, SBI..."
                    className={`w-full text-xs font-semibold py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs ${
                      formErrors.bankName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.bankName && <p className="text-[10px] text-rose-500">{formErrors.bankName}</p>}
                </div>

                {/* Account Holder Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Account Holder Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.accountHolderName}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                    placeholder="e.g. SP Techpioneer Private Limited"
                    className={`w-full text-xs font-semibold py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs ${
                      formErrors.accountHolderName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.accountHolderName && <p className="text-[10px] text-rose-500">{formErrors.accountHolderName}</p>}
                </div>

                {/* Bank Account Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Bank Account Number</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.accountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value.replace(/\s+/g, '') }))}
                    placeholder="e.g. 50200012345678"
                    className={`w-full text-xs font-mono font-bold py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs ${
                      formErrors.accountNumber ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.accountNumber && <p className="text-[10px] text-rose-500">{formErrors.accountNumber}</p>}
                </div>

                {/* IFSC Code */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>IFSC Code</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={formData.ifscCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                    placeholder="e.g. HDFC0001234 (11 characters)"
                    className={`w-full text-xs font-mono font-bold py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs ${
                      formErrors.ifscCode ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.ifscCode && <p className="text-[10px] text-rose-500">{formErrors.ifscCode}</p>}
                </div>

                {/* Branch Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Branch Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.branchName}
                    onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                    placeholder="e.g. Bhosari Industrial Area, Pune"
                    className={`w-full text-xs font-semibold py-2 px-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs ${
                      formErrors.branchName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.branchName && <p className="text-[10px] text-rose-500">{formErrors.branchName}</p>}
                </div>

                {/* Account Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Account Type</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value }))}
                    className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CASH_CREDIT">Cash Credit (CC)</option>
                    <option value="OD">Overdraft (OD)</option>
                  </select>
                </div>

                {/* Opening Balance */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Opening Balance (₹)</span>
                    <span className="text-slate-400 font-normal text-[11px]">(Ledger Carry-forward)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.openingBalance}
                      onChange={(e) => setFormData(prev => ({ ...prev, openingBalance: e.target.value }))}
                      placeholder="0.00"
                      className={`w-full text-xs font-mono font-bold py-2 pl-7 pr-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs ${
                        formErrors.openingBalance ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {formErrors.openingBalance && <p className="text-[10px] text-rose-500">{formErrors.openingBalance}</p>}
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Status</span>
                  </label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="isActive"
                        checked={formData.isActive === true}
                        onChange={() => setFormData(prev => ({ ...prev, isActive: true }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="isActive"
                        checked={formData.isActive === false}
                        onChange={() => setFormData(prev => ({ ...prev, isActive: false }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Inactive
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Account...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Bank Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Edit Bank Account Modal */}
      {isEditModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 flex items-center justify-between border-l-4 border-l-blue-600">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Edit Bank Account</h3>
                  <p className="text-xs text-slate-500">Update configuration for {selectedAccount.bank_name} ({selectedAccount.account_number})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Bank Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bankName}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                  />
                  {formErrors.bankName && <p className="text-[10px] text-rose-500">{formErrors.bankName}</p>}
                </div>

                {/* Account Holder Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Account Holder Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.accountHolderName}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                    className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                  />
                  {formErrors.accountHolderName && <p className="text-[10px] text-rose-500">{formErrors.accountHolderName}</p>}
                </div>

                {/* Bank Account Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Bank Account Number</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.accountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value.replace(/\s+/g, '') }))}
                    className="w-full text-xs font-mono font-bold py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                  />
                  {formErrors.accountNumber && <p className="text-[10px] text-rose-500">{formErrors.accountNumber}</p>}
                </div>

                {/* IFSC Code */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>IFSC Code</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={formData.ifscCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                    className="w-full text-xs font-mono font-bold py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                  />
                  {formErrors.ifscCode && <p className="text-[10px] text-rose-500">{formErrors.ifscCode}</p>}
                </div>

                {/* Branch Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Branch Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.branchName}
                    onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                    className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                  />
                  {formErrors.branchName && <p className="text-[10px] text-rose-500">{formErrors.branchName}</p>}
                </div>

                {/* Account Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Account Type</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value }))}
                    className="w-full text-xs font-semibold py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CASH_CREDIT">Cash Credit (CC)</option>
                    <option value="OD">Overdraft (OD)</option>
                  </select>
                </div>

                {/* Opening Balance */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Opening Balance (₹)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.openingBalance}
                      onChange={(e) => setFormData(prev => ({ ...prev, openingBalance: e.target.value }))}
                      className="w-full text-xs font-mono font-bold py-2 pl-7 pr-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                    />
                  </div>
                  {formErrors.openingBalance && <p className="text-[10px] text-rose-500">{formErrors.openingBalance}</p>}
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Status</span>
                  </label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="editIsActive"
                        checked={formData.isActive === true}
                        onChange={() => setFormData(prev => ({ ...prev, isActive: true }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="editIsActive"
                        checked={formData.isActive === false}
                        onChange={() => setFormData(prev => ({ ...prev, isActive: false }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Inactive
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Update Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. View Bank Details Modal */}
      {isViewModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 flex items-center justify-between border-l-4 border-l-blue-600">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Bank Account Details</h3>
                  <p className="text-xs text-slate-500">Complete banking credentials & ledger information</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Card Preview Banner */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white rounded-xl p-5 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between relative z-10 mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-blue-200 block">
                      {selectedAccount.bank_name}
                    </span>
                    <h4 className="text-base font-bold tracking-tight text-white mt-0.5">
                      {selectedAccount.branch_name || 'Main Branch'}
                    </h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs border border-white/20">
                    {getAccountTypeBadge(selectedAccount.account_type).shortLabel}
                  </span>
                </div>

                <div className="relative z-10 mb-3">
                  <span className="text-[10px] text-blue-200 block">Account Number</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-lg font-bold tracking-widest">
                      {selectedAccount.account_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedAccount.account_number, 'view-acc')}
                      className="p-1 rounded bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                      title="Copy Account Number"
                    >
                      {copiedField === 'view-acc' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs relative z-10 pt-2 border-t border-white/15">
                  <div>
                    <span className="text-[9px] text-blue-200 uppercase block">Account Holder</span>
                    <span className="font-semibold text-white">{selectedAccount.account_holder_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-blue-200 uppercase block">IFSC Code</span>
                    <span className="font-mono font-bold text-white">{selectedAccount.ifsc_code}</span>
                  </div>
                </div>
              </div>

              {/* Complete Specifications Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Balance</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                    {formatCurrency(selectedAccount.current_balance ?? selectedAccount.total_balance ?? selectedAccount.opening_balance)}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operational Status</span>
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-700">
                    <span className={`w-2 h-2 rounded-full ${selectedAccount.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {selectedAccount.is_active ? 'Active (Operational)' : 'Inactive'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Inflow (Credits)</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block whitespace-nowrap">
                    +{formatCurrency(selectedAccount.total_credits || selectedAccount.total_received || 0)}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outflow (Debits)</span>
                  <span className="font-mono font-bold text-rose-700 text-sm mt-0.5 block whitespace-nowrap">
                    -{formatCurrency(selectedAccount.total_debits || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* View Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">ID #{selectedAccount.id}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleOpenEdit(selectedAccount);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 text-center">Delete Bank Account?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to remove <strong className="text-slate-800">{selectedAccount.bank_name}</strong> ({selectedAccount.account_number})? This action cannot be undone.
            </p>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccounts;
