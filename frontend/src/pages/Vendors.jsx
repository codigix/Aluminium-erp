import { useState, useEffect } from 'react';
import { Card, Modal, FormControl, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const vendorStatusColors = {
  ACTIVE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Inactive' },
  BLOCKED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700', label: 'Blocked' },
};

const StarRating = ({ rating }) => {
  const numRating = parseFloat(rating) || 0;
  const filled = Math.floor(numRating);
  const empty = 5 - filled;
  
  return (
    <div className="flex items-center gap-1">
      {[...Array(filled)].map((_, i) => (
        <svg key={`filled-${i}`} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {[...Array(empty)].map((_, i) => (
        <svg key={`empty-${i}`} className="w-4 h-4 text-slate-300 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-sm text-slate-600 ml-1 font-medium">{numRating.toFixed(1)}</span>
    </div>
  );
};

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All Vendors');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    vendorName: '',
    contactPerson: '',
    category: '',
    vendorType: 'Material Supplier',
    status: 'Active',
    email: '',
    phone: '',
    location: '',
    rating: 0
  });

  const vendorTypes = ['Material Supplier', 'Service Provider', 'Logistics', 'Consultant', 'Other'];
  const statuses = ['Active', 'Inactive', 'Blocked'];

  useEffect(() => {
    fetchVendors();
    fetchStats();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch vendors');
      const data = await response.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredVendors = (vendors || []).filter(v => 
    filterStatus === 'All Vendors' || v.status === filterStatus
  );

  const handleAddVendor = async (e) => {
    e.preventDefault();
    
    if (!formData.vendorName.trim()) {
      errorToast('Vendor name is required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          status: 'ACTIVE'
        })
      });

      if (!response.ok) throw new Error('Failed to create vendor');

      successToast('Vendor added successfully');
      setFormData({
        vendorName: '',
        contactPerson: '',
        category: '',
        vendorType: 'Material Supplier',
        status: 'Active',
        email: '',
        phone: '',
        location: '',
        rating: 0
      });
      setShowForm(false);
      fetchVendors();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to add vendor');
    }
  };

  const handleDeleteVendor = async (vendorId, vendorName) => {
    const result = await Swal.fire({
      title: 'Delete Vendor?',
      text: `Are you sure you want to delete ${vendorName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors/${vendorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete vendor');

      successToast('Vendor deleted successfully');
      fetchVendors();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete vendor');
    }
  };

  const handleExportList = () => {
    if (vendors.length === 0) {
      errorToast('No vendors to export');
      return;
    }

    const headers = ['Vendor Name', 'Category', 'Email', 'Phone', 'Location', 'Rating', 'Status'];
    const rows = vendors.map(v => [
      v.vendor_name,
      v.category || '—',
      v.email || '—',
      v.phone || '—',
      v.location || '—',
      v.rating || '0',
      v.status
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const columns = [
    {
      label: 'Vendor',
      key: 'vendor_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600  text-lg">
            {val.charAt(0)}
          </div>
          <div>
            <div className=" text-slate-900">{val}</div>
            <div className="text-xs text-slate-400">{row.vendor_type}</div>
          </div>
        </div>
      )
    },
    {
      label: 'Category',
      key: 'category',
      sortable: true,
      render: (val) => val ? (
        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
          {val}
        </span>
      ) : '—'
    },
    {
      label: 'Contact Details',
      key: 'email',
      render: (val, row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-600">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">{val || 'No email'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-xs">{row.phone || 'No phone'}</span>
          </div>
        </div>
      )
    },
    {
      label: 'Rating',
      key: 'rating',
      sortable: true,
      render: (val) => <StarRating rating={val} />
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => {
        const config = vendorStatusColors[val] || vendorStatusColors.ACTIVE;
        return (
          <span className={`px-3 py-1 rounded-full text-[10px]  border ${config.badge}`}>
            {config.label}
          </span>
        );
      }
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            title="Edit Vendor"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button 
            onClick={() => handleDeleteVendor(val, row.vendor_name)}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="Delete Vendor"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl  text-slate-900 tracking-tight">Vendors</h2>
          <p className="text-sm text-slate-500">Manage your supplier network and performance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportList}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm  hover:bg-slate-50 transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm  hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-100 shadow-sm rounded-2xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500   tracking-wider">Total Vendors</p>
              <p className="text-2xl  text-slate-900">{stats?.totalVendors || vendors.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-100 shadow-sm rounded-2xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500   tracking-wider">Active</p>
              <p className="text-2xl  text-slate-900">{vendors.filter(v => v.status === 'ACTIVE').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-100 shadow-sm rounded-2xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-50 rounded-xl">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500   tracking-wider">Avg Rating</p>
              <p className="text-2xl  text-slate-900">
                {(vendors.reduce((acc, v) => acc + parseFloat(v.rating || 0), 0) / (vendors.length || 1)).toFixed(1)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-100 shadow-sm rounded-2xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500   tracking-wider">Top Category</p>
              <p className="text-xl text-slate-900 truncate max-w-[120px]">Material</p>
            </div>
          </div>
        </Card>
      </div>

      <DataTable 
        columns={columns}
        data={vendors.filter(v => filterStatus === 'All Vendors' || v.status === filterStatus)}
        loading={loading}
        searchPlaceholder="Search vendors, categories, emails..."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            >
              <option value="All Vendors">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        }
      />

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add New Vendor"
      >
        <form onSubmit={handleAddVendor} className="space-y-8 max-h-[70vh] overflow-y-auto px-1">
          <div>
            <h3 className="text-sm  text-slate-800 tracking-wider  border-b border-slate-100 pb-2 mb-4">Basic Information</h3>
            <div className="">
              <FormControl label="Vendor Name *">
                <input
                  type="text"
                  placeholder="Enter vendor name"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  required
                />
              </FormControl>

              <FormControl label="Contact Person">
                <input
                  type="text"
                  placeholder="Contact person name"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                />
              </FormControl>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <FormControl label="Category">
                  <input
                    type="text"
                    placeholder="e.g., Electronics"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  />
                </FormControl>

                <FormControl label="Vendor Type *">
                  <select
                    value={formData.vendorType}
                    onChange={(e) => setFormData({...formData, vendorType: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  >
                    {vendorTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </FormControl>
              </div>

              <FormControl label="Status">
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </FormControl>
            </div>
          </div>

          <div>
            <h3 className="text-sm  text-slate-800 tracking-wider  border-b border-slate-100 pb-2 mb-4">Contact Information</h3>
            <div className="">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <FormControl label="Email">
                  <input
                    type="email"
                    placeholder="vendor@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  />
                </FormControl>

                <FormControl label="Phone">
                  <input
                    type="tel"
                    placeholder="+91 XXXXXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs"
                  />
                </FormControl>
              </div>

              <FormControl label="Location/Address">
                <textarea
                  placeholder="Enter vendor location or address"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white text-xs min-h-[80px]"
                />
              </FormControl>
            </div>
          </div>

          <div>
            <h3 className="text-sm  text-slate-800 tracking-wider  border-b border-slate-100 pb-2 mb-4">Performance</h3>
            <FormControl label="Initial Rating (0-5)">
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => setFormData({...formData, rating: parseFloat(e.target.value) || 0})}
                  className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < Math.floor(formData.rating) ? 'text-yellow-400 text-xl' : 'text-slate-200 text-xl'}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </FormControl>
          </div>

          <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-xs  hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
            >
              Add Vendor
            </button>
          </div>
        </form>
      </Modal>

        {loading ? (
          <p className="text-sm text-slate-400">Loading vendors...</p>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No vendors found</p>
            {vendors.length === 0 && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm  hover:bg-slate-800"
              >
                + Add Vendor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            {filteredVendors.map((vendor) => (
              <div
                key={`vendor-${vendor.id}`}
                className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-slate-900 text-xs text-sm">{vendor.vendor_name}</h3>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {vendor.category && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {vendor.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs  ${(vendorStatusColors[vendor.status] || vendorStatusColors.ACTIVE).badge}`}>
                    {(vendorStatusColors[vendor.status] || vendorStatusColors.ACTIVE).label}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-xs text-slate-600 border-t border-b border-slate-100 py-3">
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.location && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{vendor.location}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <p className="text-xs text-slate-500 mb-1">Orders</p>
                    <p className="text-slate-900 text-xs">{vendor.total_orders || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <p className="text-xs text-slate-500 mb-1">Value</p>
                    <p className="text-slate-900 text-xs">₹{(vendor.total_value || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <p className="text-xs text-slate-500 mb-1">Last Order</p>
                    <p className="text-slate-900 text-xs">{vendor.last_order_date ? new Date(vendor.last_order_date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}) : 'N/A'}</p>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between py-3 border-t border-slate-100">
                  <StarRating rating={vendor.rating} />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 text-xs rounded border border-blue-200 text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 text-xs rounded border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Performance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVendor(vendor.id, vendor.vendor_name)}
                    className="px-3 py-2 text-xs rounded border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors flex items-center justify-center"
                    title="Delete Vendor"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600   tracking-wider mb-1">Total Vendors</p>
            <p className="text-2xl  text-blue-900">{stats.total_vendors || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600   tracking-wider mb-1">Active Vendors</p>
            <p className="text-2xl  text-emerald-900">{stats.active_vendors || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600   tracking-wider mb-1">Avg. Rating</p>
            <p className="text-2xl  text-yellow-900">{(parseFloat(stats.avg_rating) || 0).toFixed(1)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-600   tracking-wider mb-1">Total Orders</p>
            <p className="text-2xl  text-purple-900">{stats.total_orders || 0}</p>
          </div>
        </div>
      )}
   
</div>
  );
};
export default Vendors;
