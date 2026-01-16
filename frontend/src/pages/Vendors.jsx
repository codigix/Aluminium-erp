import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

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
        <span key={`filled-${i}`} className="text-yellow-400">★</span>
      ))}
      {[...Array(empty)].map((_, i) => (
        <span key={`empty-${i}`} className="text-slate-300">★</span>
      ))}
      <span className="text-sm text-slate-600 ml-1">{numRating.toFixed(1)}</span>
    </div>
  );
};

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
    address: '',
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

  const handleAddVendor = async (e) => {
    e.preventDefault();
    
    if (!formData.vendorName.trim()) {
      Swal.fire('Error', 'Vendor name is required', 'error');
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

      await Swal.fire('Success', 'Vendor added successfully', 'success');
      setFormData({
        vendorName: '',
        contactPerson: '',
        category: '',
        vendorType: 'Material Supplier',
        status: 'Active',
        email: '',
        phone: '',
        address: '',
        rating: 0
      });
      setShowForm(false);
      fetchVendors();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to add vendor', 'error');
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

      await Swal.fire('Success', 'Vendor deleted successfully', 'success');
      fetchVendors();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete vendor', 'error');
    }
  };

  const handleExportList = () => {
    if (vendors.length === 0) {
      Swal.fire('Info', 'No vendors to export', 'info');
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

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = 
      vendor.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'All Vendors' || vendor.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getFilterValue = () => {
    if (filterStatus === 'All Vendors') return 'All Vendors';
    return vendorStatusColors[filterStatus]?.label || filterStatus;
  };

  return (
    <div className="space-y-6">
      <Card title="Vendor Management" subtitle="Manage and track vendor relationships">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search vendor or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All Vendors">All Vendors</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={handleExportList}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              ⬇ Export List
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
            >
              + Add Vendor
            </button>
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-blue-50 border-b border-blue-200 p-2 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 text-xs">Add New Vendor</h2>
                  <p className="text-xs text-blue-600">Fill in the vendor details below</p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-slate-500 hover:text-slate-900 text-xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddVendor} className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Vendor Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="Enter vendor name"
                        value={formData.vendorName}
                        onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Contact Person</label>
                      <input
                        type="text"
                        placeholder="Contact person name"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Category</label>
                        <input
                          type="text"
                          placeholder="e.g., Electronics"
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Vendor Type <span className="text-red-500">*</span></label>
                        <select
                          value={formData.vendorType}
                          onChange={(e) => setFormData({...formData, vendorType: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {vendorTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Email</label>
                        <input
                          type="email"
                          placeholder="vendor@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Phone</label>
                        <input
                          type="tel"
                          placeholder="+91 XXXXXXXXXX"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Address</label>
                      <textarea
                        placeholder="Enter vendor address"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Performance</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 text-xs mb-2">Initial Rating (0-5)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={formData.rating}
                        onChange={(e) => setFormData({...formData, rating: parseFloat(e.target.value) || 0})}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < Math.floor(formData.rating) ? 'text-yellow-400 text-lg' : 'text-slate-300 text-lg'}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
                  >
                    Add Vendor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading vendors...</p>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No vendors found</p>
            {vendors.length === 0 && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                + Add Vendor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVendors.map((vendor) => (
              <div
                key={`vendor-${vendor.id}`}
                className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 text-xs text-sm">{vendor.vendor_name}</h3>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {vendor.category && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {vendor.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${vendorStatusColors[vendor.status]?.badge}`}>
                    {vendorStatusColors[vendor.status]?.label}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-xs text-slate-600 border-t border-b border-slate-100 py-3">
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <span>✉</span>
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <span>☎</span>
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.location && (
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span>{vendor.location}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <p className="text-xs text-slate-500 mb-1">Orders</p>
                    <p className="font-semibold text-slate-900 text-xs">{vendor.total_orders || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <p className="text-xs text-slate-500 mb-1">Value</p>
                    <p className="font-semibold text-slate-900 text-xs">₹{(vendor.total_value || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <p className="text-xs text-slate-500 mb-1">Last Order</p>
                    <p className="font-semibold text-slate-900 text-xs">{vendor.last_order_date ? new Date(vendor.last_order_date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}) : 'N/A'}</p>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between py-3 border-t border-slate-100">
                  <StarRating rating={vendor.rating} />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 text-xs rounded border border-blue-200 text-blue-600 font-medium hover:bg-blue-50"
                  >
                    ✎ Edit
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 text-xs rounded border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
                  >
                    📊 Performance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVendor(vendor.id, vendor.vendor_name)}
                    className="px-3 py-2 text-xs rounded border border-red-200 text-red-600 font-medium hover:bg-red-50"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total Vendors</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total_vendors || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Active Vendors</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.active_vendors || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-1">Avg. Rating</p>
            <p className="text-2xl font-bold text-yellow-900">{(parseFloat(stats.avg_rating) || 0).toFixed(1)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-purple-900">{stats.total_orders || 0}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
