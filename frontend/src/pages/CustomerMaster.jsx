import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, Save, Users, ChevronLeft, ChevronRight, Loader2, UserRound
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const PAGE_SIZE = 10;

const emptyContact = () => ({ contactName: '', mobile: '', email: '' });
const emptyForm = () => ({
  customerName: '',
  gstNo: '',
  pincode: '',
  address: '',
  email: '',
  status: 'ACTIVE',
  contacts: [emptyContact()]
});

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

const request = async (path, options = {}) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
};

// Mirrors the backend checks so mistakes are shown before saving
const validateForm = (form) => {
  if (!form.customerName.trim()) return 'Customer Name is required';
  const gst = form.gstNo.trim().toUpperCase();
  if (gst && !GSTIN_PATTERN.test(gst)) return 'Enter a valid 15-character GST No. (e.g. 27AAACA1234A1Z5)';
  if (!form.pincode.trim()) return 'Pincode is required';
  if (!PINCODE_PATTERN.test(form.pincode.trim())) return 'Enter a valid 6-digit Pincode';
  if (!form.address.trim()) return 'Address is required';
  if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) return 'Enter a valid customer Email ID';
  for (let i = 0; i < form.contacts.length; i++) {
    const c = form.contacts[i];
    const hasAny = c.contactName.trim() || c.mobile.trim() || c.email.trim();
    if (!hasAny) continue;
    if (!c.contactName.trim()) return `Contact ${i + 1}: Contact Person name is required`;
    if (c.email.trim() && !EMAIL_PATTERN.test(c.email.trim())) return `Contact ${i + 1}: enter a valid Email ID`;
  }
  return '';
};

const CustomerMaster = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async (term, status) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (term.trim()) params.set('search', term.trim());
      if (status !== 'ALL') params.set('status', status);
      const data = await request(`/customer-master${params.toString() ? `?${params}` : ''}`);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      errorToast(err.message || 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search is applied on the server (name, GST No., contact person); debounced while typing
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchCustomers(search, statusFilter);
    }, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter, fetchCustomers]);

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [customers, currentPage]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setPanelOpen(true);
  };

  const openEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      customerName: customer.customer_name || '',
      gstNo: customer.gst_no || '',
      pincode: customer.pincode || '',
      address: customer.address || '',
      email: customer.email || '',
      status: customer.status || 'ACTIVE',
      contacts: (customer.contacts || []).length
        ? customer.contacts.map(c => ({ contactName: c.contact_name || '', mobile: c.mobile || '', email: c.email || '' }))
        : [emptyContact()]
    });
    setFormError('');
    setPanelOpen(true);
  };

  const closePanel = () => {
    if (saving) return;
    setPanelOpen(false);
  };

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const setContactField = (index, field, value) => setForm(prev => ({
    ...prev,
    contacts: prev.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c))
  }));
  const addContact = () => setForm(prev => ({ ...prev, contacts: [...prev.contacts, emptyContact()] }));
  const removeContact = (index) => setForm(prev => ({
    ...prev,
    contacts: prev.contacts.length > 1 ? prev.contacts.filter((_, i) => i !== index) : [emptyContact()]
  }));

  const handleSave = async (e) => {
    e.preventDefault();
    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError('');
    try {
      setSaving(true);
      const payload = { ...form, gstNo: form.gstNo.trim().toUpperCase() };
      const res = editingId
        ? await request(`/customer-master/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await request('/customer-master', { method: 'POST', body: JSON.stringify(payload) });
      successToast(res.message || 'Customer saved');
      setPanelOpen(false);
      fetchCustomers(search, statusFilter);
    } catch (err) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (customer) => {
    const next = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await request(`/customer-master/${customer.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      successToast(res.message || 'Status updated');
      fetchCustomers(search, statusFilter);
    } catch (err) {
      errorToast(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (customer) => {
    const result = await Swal.fire({
      title: 'Delete Customer?',
      text: `Are you sure you want to permanently delete "${customer.customer_name}" and its contact persons? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await request(`/customer-master/${customer.id}`, { method: 'DELETE' });
      successToast(res.message || 'Customer deleted');
      fetchCustomers(search, statusFilter);
    } catch (err) {
      errorToast(err.message || 'Failed to delete customer');
    }
  };

  const contactSummary = (contacts = []) => {
    if (!contacts.length) return '—';
    return contacts.length > 1 ? `${contacts[0].contact_name} (+${contacts.length - 1})` : contacts[0].contact_name;
  };

  const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Customer Master</h1>
          <nav className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span>Sales</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-rose-600 font-medium">Customer Master</span>
          </nav>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Listing */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 sm:max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Customer Name, GST No., Contact Person..."
              className={`${inputClass} pr-9`}
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${inputClass} sm:w-44`}
          >
            <option value="ACTIVE">Status: Active</option>
            <option value="INACTIVE">Status: Inactive</option>
            <option value="ALL">Status: All</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-2.5 w-10">#</th>
                <th className="px-3 py-2.5">Customer Name</th>
                <th className="px-3 py-2.5">GST No.</th>
                <th className="px-3 py-2.5">Contact Person(s)</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Address</th>
                <th className="px-3 py-2.5">Pincode</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading customers...
                  </td>
                </tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <Users className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    {search ? 'No customers match your search.' : 'No customers found. Click "Add Customer" to register one.'}
                  </td>
                </tr>
              )}
              {!loading && pageRows.map((c, idx) => (
                <tr key={c.id} className="hover:bg-slate-50/70 align-top">
                  <td className="px-3 py-3 text-slate-500">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800 min-w-[140px]">{c.customer_name}</td>
                  <td className="px-3 py-3 font-mono text-slate-700 whitespace-nowrap">{c.gst_no || '—'}</td>
                  <td className="px-3 py-3 text-slate-700 min-w-[120px]" title={(c.contacts || []).map(ct => ct.contact_name).join(', ')}>
                    {contactSummary(c.contacts)}
                  </td>
                  <td className="px-3 py-3 text-slate-700 break-all min-w-[140px]">{c.email || c.contacts?.[0]?.email || '—'}</td>
                  <td className="px-3 py-3 text-slate-600 min-w-[160px] max-w-[240px]">
                    <span className="line-clamp-2" title={c.address}>{c.address}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-700">{c.pincode}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(c)}
                      title={`Click to mark ${c.status === 'ACTIVE' ? 'Inactive' : 'Active'}`}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${c.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                    >
                      {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => openEdit(c)} className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50" title="Edit customer" aria-label="Edit customer">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(c)} className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50" title="Delete customer" aria-label="Delete customer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-3 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {customers.length === 0
              ? 'Showing 0 entries'
              : `Showing ${(currentPage - 1) * PAGE_SIZE + 1} to ${Math.min(currentPage * PAGE_SIZE, customers.length)} of ${customers.length} entries`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="p-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), Math.max(0, currentPage - 3) + 5).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`min-w-[30px] px-2 py-1 rounded-md border text-xs font-semibold ${n === currentPage ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="p-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit side panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30" onClick={closePanel} />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <button type="button" onClick={closePanel} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Customer Name <span className="text-rose-500">*</span></label>
                <input type="text" value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} placeholder="Enter customer name" className={inputClass} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-sm font-semibold text-slate-700">GST No.</label>
                  <input type="text" value={form.gstNo} onChange={(e) => setField('gstNo', e.target.value.toUpperCase())} maxLength={15} placeholder="Enter GST number" className={`${inputClass} font-mono uppercase`} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Pincode <span className="text-rose-500">*</span></label>
                  <input type="text" inputMode="numeric" value={form.pincode} onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter pincode" className={`${inputClass} font-mono`} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Address <span className="text-rose-500">*</span></label>
                <textarea rows={3} value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Enter full address" className={`${inputClass} resize-y`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-sm font-semibold text-slate-700">Email ID</label>
                  <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Enter customer email" className={inputClass} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setField('status', e.target.value)} className={inputClass}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Contact persons */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <UserRound className="w-4 h-4 text-indigo-600" /> Contact Person(s)
                  </div>
                  <button type="button" onClick={addContact} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-50">
                    <Plus className="w-3.5 h-3.5" /> Add Contact
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-600 font-semibold">
                      <tr className="border-b border-slate-100">
                        <th className="px-2 py-2 w-8">#</th>
                        <th className="px-2 py-2">Contact Person <span className="text-rose-500">*</span></th>
                        <th className="px-2 py-2">Mobile No.</th>
                        <th className="px-2 py-2">Email ID</th>
                        <th className="px-2 py-2 w-12 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.contacts.map((c, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                          <td className="px-2 py-1.5 min-w-[130px]">
                            <input type="text" value={c.contactName} onChange={(e) => setContactField(i, 'contactName', e.target.value)} placeholder="Name" className={`${inputClass} py-1.5 text-xs`} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[110px]">
                            <input type="tel" value={c.mobile} onChange={(e) => setContactField(i, 'mobile', e.target.value.replace(/[^0-9+\s-]/g, ''))} placeholder="Mobile" className={`${inputClass} py-1.5 text-xs font-mono`} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[140px]">
                            <input type="email" value={c.email} onChange={(e) => setContactField(i, 'email', e.target.value)} placeholder="Email" className={`${inputClass} py-1.5 text-xs`} />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button type="button" onClick={() => removeContact(i)} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50" title="Remove contact" aria-label="Remove contact">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">{formError}</div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={closePanel} className="px-5 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update Customer' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CustomerMaster;
