import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, DataTable, StatusBadge, Button } from '../components/ui.jsx';
import { 
  Building2, 
  Plus, 
  RotateCw, 
  Download, 
  Eye, 
  Pencil, 
  Trash2, 
  Upload, 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  FileText, 
  PenTool, 
  MapPin, 
  Check, 
  Info,
  ShieldAlert
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast } from '../utils/toast';
import { getFileUrl } from '../utils/url';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const AdminCompanyMaster = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    companyAddress: '',
    gstin: '',
    pan: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    invoiceFooterNotes: '',
    status: 'ACTIVE'
  });

  // File Upload State
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [authorizedSignatureFile, setAuthorizedSignatureFile] = useState(null);
  
  // File Preview URL State (for local selection previews)
  const [logoPreview, setLogoPreview] = useState('');
  const [signaturePreview, setSignaturePreview] = useState('');

  // Fetch Companies
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/admin-company-master`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch company masters');
      const data = await response.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Stats derivation
  const totalCompanies = companies.length;
  const activeCompany = companies.find(c => c.status === 'ACTIVE') || null;
  const inactiveCompaniesCount = companies.filter(c => c.status === 'INACTIVE').length;

  // File Change Handlers
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCompanyLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSignatureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAuthorizedSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  // Reset Form
  const resetForm = () => {
    setFormData({
      companyName: '',
      companyAddress: '',
      gstin: '',
      pan: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
      invoiceFooterNotes: '',
      status: 'ACTIVE'
    });
    setCompanyLogoFile(null);
    setAuthorizedSignatureFile(null);
    setLogoPreview('');
    setSignaturePreview('');
    setViewOnly(false);
    setIsEditing(false);
    setSelectedCompany(null);
  };

  // Form Submit (Create / Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      errorToast('Company Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const apiFormData = new FormData();
      
      apiFormData.append('companyName', formData.companyName.trim());
      apiFormData.append('companyAddress', formData.companyAddress.trim());
      apiFormData.append('gstin', formData.gstin.trim());
      apiFormData.append('pan', formData.pan.trim());
      apiFormData.append('bankName', formData.bankName.trim());
      apiFormData.append('accountNumber', formData.accountNumber.trim());
      apiFormData.append('ifscCode', formData.ifscCode.trim());
      apiFormData.append('branchName', formData.branchName.trim());
      apiFormData.append('invoiceFooterNotes', formData.invoiceFooterNotes.trim());
      apiFormData.append('status', formData.status);

      if (companyLogoFile) {
        apiFormData.append('companyLogo', companyLogoFile);
      }
      if (authorizedSignatureFile) {
        apiFormData.append('authorizedSignature', authorizedSignatureFile);
      }

      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing 
        ? `${API_BASE}/admin-company-master/${selectedCompany.id}` 
        : `${API_BASE}/admin-company-master`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: apiFormData
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Operation failed');
      }

      successToast(isEditing ? 'Company master updated successfully' : 'Company master created successfully');
      setShowModal(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Actions
  const handleView = (company) => {
    setSelectedCompany(company);
    setFormData({
      companyName: company.company_name || '',
      companyAddress: company.company_address || '',
      gstin: company.gstin || '',
      pan: company.pan || '',
      bankName: company.bank_name || '',
      accountNumber: company.account_number || '',
      ifscCode: company.ifsc_code || '',
      branchName: company.branch_name || '',
      invoiceFooterNotes: company.invoice_footer_notes || '',
      status: company.status || 'ACTIVE'
    });
    setLogoPreview(company.company_logo ? getFileUrl(company.company_logo) : '');
    setSignaturePreview(company.authorized_signature ? getFileUrl(company.authorized_signature) : '');
    setViewOnly(true);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (company) => {
    setSelectedCompany(company);
    setFormData({
      companyName: company.company_name || '',
      companyAddress: company.company_address || '',
      gstin: company.gstin || '',
      pan: company.pan || '',
      bankName: company.bank_name || '',
      accountNumber: company.account_number || '',
      ifscCode: company.ifsc_code || '',
      branchName: company.branch_name || '',
      invoiceFooterNotes: company.invoice_footer_notes || '',
      status: company.status || 'ACTIVE'
    });
    setLogoPreview(company.company_logo ? getFileUrl(company.company_logo) : '');
    setSignaturePreview(company.authorized_signature ? getFileUrl(company.authorized_signature) : '');
    setViewOnly(false);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleToggleStatus = async (company) => {
    const nextStatus = company.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/admin-company-master/${company.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to toggle status');
      }
      successToast(`Company marked ${nextStatus.toLowerCase()}`);
      fetchCompanies();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDelete = async (company) => {
    const result = await Swal.fire({
      title: 'Delete Host Company?',
      text: `Are you sure you want to permanently delete "${company.company_name}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/admin-company-master/${company.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resultData = await response.json();
      if (!response.ok) throw new Error(resultData.error || 'Failed to delete company');

      successToast('Company deleted successfully');
      fetchCompanies();
    } catch (error) {
      errorToast(error.message);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (companies.length === 0) {
      warningToast('No data to export');
      return;
    }
    const headers = [
      'Company Name',
      'GSTIN',
      'PAN',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Branch Name',
      'Status',
      'Invoice Footer Notes'
    ];
    const rows = companies.map(c => [
      c.company_name || '',
      c.gstin || '',
      c.pan || '',
      c.bank_name || '',
      c.account_number || '',
      c.ifsc_code || '',
      c.branch_name || '',
      c.status || '',
      c.invoice_footer_notes || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `company_master_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    successToast('CSV Exported successfully');
  };

  // DataTable columns definition
  const columns = [
    {
      label: 'Logo',
      key: 'company_logo',
      width: '80px',
      render: (val, row) => (
        <div className="flex items-center justify-center">
          {val ? (
            <img 
              src={getFileUrl(val)} 
              alt="Logo" 
              className="h-10 w-10 object-contain rounded bg-slate-50 border border-slate-200/60 p-1"
              onError={(e) => {
                e.target.onerror = null; 
                e.target.src = '';
                e.target.className = 'hidden';
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
              {row.company_name ? row.company_name.charAt(0).toUpperCase() : 'C'}
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Company Name',
      key: 'company_name',
      sortable: true,
      render: (val) => <span className="font-semibold text-slate-900">{val}</span>
    },
    {
      label: 'GSTIN Number',
      key: 'gstin',
      sortable: true,
      render: (val) => <span className="text-slate-600 font-mono text-xs">{val || '—'}</span>
    },
    {
      label: 'PAN Number',
      key: 'pan',
      sortable: true,
      render: (val) => <span className="text-slate-600 font-mono text-xs uppercase">{val ? val.toUpperCase() : '—'}</span>
    },
    {
      label: 'Bank & Branch',
      key: 'bank_name',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-800 text-xs font-medium uppercase">{val ? val.toUpperCase() : '—'}</span>
          <span className="text-slate-500 text-[10px] uppercase">{row.branch_name ? row.branch_name.toUpperCase() : ''}</span>
        </div>
      )
    },
    {
      label: 'Account Details',
      key: 'account_number',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-800 text-xs font-mono">{val || '—'}</span>
          {row.ifsc_code && (
            <span className="text-slate-400 text-[10px] font-mono uppercase">IFSC: {row.ifsc_code.toUpperCase()}</span>
          )}
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      width: '120px',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={val} />
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1 rounded-full border transition-all ${
              val === 'ACTIVE' 
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
            }`}
            title={val === 'ACTIVE' ? 'Deactivate Company' : 'Set as Active Company'}
          >
            {val === 'ACTIVE' ? <XCircle size={14} /> : <CheckCircle size={14} />}
          </button>
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      width: '220px',
      render: (val, row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button 
            onClick={() => handleView(row)}
            className="flex items-center gap-1 p-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[11px] hover:bg-slate-100 hover:text-slate-900 transition-all font-medium"
          >
            <Eye size={13} />
            View
          </button>
          <button 
            onClick={() => handleEdit(row)}
            className="flex items-center gap-1 p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded text-[11px] hover:bg-indigo-100 hover:text-indigo-700 transition-all font-medium"
          >
            <Pencil size={13} />
            Edit
          </button>
          <button 
            onClick={() => handleDelete(row)}
            className="flex items-center gap-1 p-1.5 bg-red-50 border border-red-100 text-red-600 rounded text-[11px] hover:bg-red-100 hover:text-red-700 transition-all font-medium"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Title Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-500" />
            Company Master Management
          </h1>
          <p className="text-slate-500 text-xs mt-1">Configure and manage issuing host entity profiles for invoicing and orders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={fetchCompanies}
            icon={RotateCw}
            className="text-slate-600 hover:bg-slate-50"
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={exportToCSV}
            icon={Download}
            className="text-slate-600 hover:bg-slate-50"
          >
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            icon={Plus}
            className="bg-rose-500 hover:bg-rose-600 text-white border-none shadow-lg shadow-rose-200"
          >
            Add Company
          </Button>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3 border border-slate-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 rounded-lg">
              <Building2 className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Host Profiles</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{totalCompanies}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 border border-slate-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-300 col-span-1 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-lg flex-shrink-0">
              <Check className="w-4 h-4 text-emerald-500 font-bold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Currently Active Billing Profile</p>
              {activeCompany ? (
                <div className="flex items-center gap-2 flex-wrap mt-0.5 min-w-0">
                  <span className="text-sm font-bold text-slate-800 truncate">{activeCompany.company_name}</span>
                  <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">Active Document Header</span>
                  <span className="text-[10px] text-slate-500 font-mono truncate">GSTIN: {activeCompany.gstin || 'N/A'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5 text-amber-600 text-xs font-semibold">
                  <ShieldAlert size={14} />
                  <span>No active host profile selected! System falls back to default hardcoded SP TECHPIONEER details.</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border border-slate-100 rounded-xl bg-white shadow-sm p-0">
        <DataTable 
          columns={columns}
          data={companies}
          loading={loading}
          searchPlaceholder="Search by Company, GSTIN, PAN or Bank..."
          emptyMessage="No host company profiles found. Click Add Company to configure one."
        />
      </Card>

      {/* Add / Edit / View Modal */}
      <Modal
        isOpen={showModal}
        onClose={resetForm}
        title={viewOnly ? 'View Company Profile' : isEditing ? 'Edit Host Company' : 'Add Host Company'}
        size="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
          {/* Header Status Warning when activating */}
          {formData.status === 'ACTIVE' && !viewOnly && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg p-3 flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Billing Entity Active</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">This company profile is marked as ACTIVE. Its name, logo, signature, address, and bank credentials can be dynamically fetched in Sales Invoices, Purchase Orders, Sales Orders, and Quotation PDFs.</p>
              </div>
            </div>
          )}

          {/* Form Content layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Left Column: Basics & Address */}
            <div className="md:col-span-2 space-y-3.5">
              <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/50 space-y-3">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Company Identity</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormControl label="Company Name *">
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="e.g. SP Techpioneer Private Limited"
                      disabled={viewOnly}
                      required
                    />
                  </FormControl>

                  <FormControl label="GSTIN Number">
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({...formData, gstin: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 uppercase font-mono"
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      disabled={viewOnly}
                    />
                  </FormControl>

                  <FormControl label="PAN Number">
                    <input
                      type="text"
                      value={formData.pan}
                      onChange={(e) => setFormData({...formData, pan: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 uppercase font-mono"
                      placeholder="e.g. ABCDE1234F"
                      disabled={viewOnly}
                    />
                  </FormControl>

                  <FormControl label="Active Status">
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400"
                      disabled={viewOnly}
                    >
                      <option value="ACTIVE">Active (Primary Host Profile)</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </FormControl>
                </div>

                <FormControl label="Company Registered Address">
                  <textarea
                    value={formData.companyAddress}
                    onChange={(e) => setFormData({...formData, companyAddress: e.target.value})}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 min-h-[60px]"
                    placeholder="Enter full billing & mailing address"
                    disabled={viewOnly}
                  />
                </FormControl>
              </div>

              {/* Bank accounts subcard */}
              <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/50 space-y-3">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <CreditCard size={14} />
                  <p className="text-[10px] uppercase font-bold tracking-wider">Bank Credentials</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormControl label="Bank Name">
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="e.g. HDFC Bank"
                      disabled={viewOnly}
                    />
                  </FormControl>

                  <FormControl label="Account Number">
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 font-mono"
                      placeholder="Account number"
                      disabled={viewOnly}
                    />
                  </FormControl>

                  <FormControl label="IFSC Code">
                    <input
                      type="text"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({...formData, ifscCode: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 uppercase font-mono"
                      placeholder="IFSC Code"
                      disabled={viewOnly}
                    />
                  </FormControl>

                  <FormControl label="Branch Name">
                    <input
                      type="text"
                      value={formData.branchName}
                      onChange={(e) => setFormData({...formData, branchName: e.target.value})}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="e.g. Pune Main Branch"
                      disabled={viewOnly}
                    />
                  </FormControl>
                </div>
              </div>
            </div>

            {/* Right Column: Uploads and terms */}
            <div className="space-y-3.5">
              
              {/* Logo upload card */}
              <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/50 space-y-2 flex flex-col items-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider self-start">Company Logo</p>
                
                <div className="h-28 w-full border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-white p-2 overflow-hidden relative">
                  {logoPreview ? (
                    <div className="relative group w-full h-full flex items-center justify-center">
                      <img 
                        src={logoPreview} 
                        alt="Logo Preview" 
                        className="max-h-full max-w-full object-contain"
                      />
                      {!viewOnly && (
                        <button
                          type="button"
                          onClick={() => { setCompanyLogoFile(null); setLogoPreview(''); }}
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-opacity"
                        >
                          Remove / Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400 p-2 text-center">
                      <Building2 size={24} className="stroke-1" />
                      <span className="text-[10px]">No Logo Selected</span>
                    </div>
                  )}
                </div>

                {!viewOnly && (
                  <label className="w-full flex items-center justify-center gap-1.5 p-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 cursor-pointer transition text-xs font-semibold text-slate-600">
                    <Upload size={13} />
                    <span>Upload Logo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoChange} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* Signature upload card */}
              <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/50 space-y-2 flex flex-col items-center">
                <div className="flex items-center gap-1.5 self-start text-slate-400">
                  <PenTool size={13} />
                  <p className="text-[10px] uppercase font-bold tracking-wider">Authorized Signature</p>
                </div>
                
                <div className="h-28 w-full border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-white p-2 overflow-hidden relative">
                  {signaturePreview ? (
                    <div className="relative group w-full h-full flex items-center justify-center bg-slate-50 p-1">
                      <img 
                        src={signaturePreview} 
                        alt="Signature Preview" 
                        className="max-h-full max-w-full object-contain"
                      />
                      {!viewOnly && (
                        <button
                          type="button"
                          onClick={() => { setAuthorizedSignatureFile(null); setSignaturePreview(''); }}
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-opacity"
                        >
                          Remove / Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400 p-2 text-center">
                      <PenTool size={24} className="stroke-1" />
                      <span className="text-[10px]">No Signature Selected</span>
                    </div>
                  )}
                </div>

                {!viewOnly && (
                  <label className="w-full flex items-center justify-center gap-1.5 p-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 cursor-pointer transition text-xs font-semibold text-slate-600">
                    <Upload size={13} />
                    <span>Upload Signature</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSignatureChange} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* Invoice footer notes */}
              <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/50 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <FileText size={13} />
                  <p className="text-[10px] uppercase font-bold tracking-wider">Invoice Terms & Declaration</p>
                </div>
                <textarea
                  value={formData.invoiceFooterNotes}
                  onChange={(e) => setFormData({...formData, invoiceFooterNotes: e.target.value})}
                  className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400 min-h-[90px]"
                  placeholder="Enter declaration/terms displayed in PDF footer"
                  disabled={viewOnly}
                />
              </div>

            </div>
          </div>

          {/* Action buttons footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setShowModal(false); resetForm(); }}
              className="p-2 border border-slate-200 rounded text-xs text-slate-700 hover:bg-slate-50 transition-all font-semibold"
            >
              {viewOnly ? 'Close' : 'Cancel'}
            </button>
            {!viewOnly && (
              <button
                type="submit"
                disabled={submitting}
                className="p-2 bg-rose-500 text-white rounded text-xs hover:bg-rose-600 font-semibold shadow-lg shadow-rose-100 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {submitting ? 'Saving...' : isEditing ? 'Update Company' : 'Save Company'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminCompanyMaster;
