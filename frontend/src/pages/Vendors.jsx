import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, DataTable, StatusBadge } from '../components/ui.jsx';
import { 
  Plus, 
  Users, 
  CheckCircle, 
  Star, 
  Briefcase, 
  FileEdit, 
  Trash2,
  Mail,
  Phone,
  Download,
  MapPin,
  Clock,
  TrendingUp
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const StarRating = ({ rating }) => {
  const numRating = parseFloat(rating) || 0;
  const filled = Math.floor(numRating);
  const empty = 5 - filled;
  
  return (
    <div className="flex items-center gap-1">
      {[...Array(filled)].map((_, i) => (
        <Star key={`filled-${i}`} size={14} className="text-yellow-400 fill-current" />
      ))}
      {[...Array(empty)].map((_, i) => (
        <Star key={`empty-${i}`} size={14} className="text-slate-200 fill-current" />
      ))}
      <span className="text-xs font-bold text-slate-600 ml-1">{numRating.toFixed(1)}</span>
    </div>
  );
};

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    vendorName: '',
    contactPerson: '',
    category: '',
    vendorType: 'Material Supplier',
    status: 'ACTIVE',
    email: '',
    phone: '',
    location: '',
    rating: 0
  });

  const vendorTypes = ['Material Supplier', 'Service Provider', 'Logistics', 'Consultant', 'Other'];
  const statuses = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

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
    try {
      const token = localStorage.getItem('authToken');
      const url = isEditing ? `${API_BASE}/vendors/${editingId}` : `${API_BASE}/vendors`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save vendor');
      
      successToast(isEditing ? 'Vendor updated successfully' : 'Vendor added successfully');
      setShowForm(false);
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        vendorName: '',
        contactPerson: '',
        category: '',
        vendorType: 'Material Supplier',
        status: 'ACTIVE',
        email: '',
        phone: '',
        location: '',
        rating: 0
      });
      fetchVendors();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleEditVendor = (vendor) => {
    setFormData({
      vendorName: vendor.vendor_name,
      contactPerson: vendor.contact_person || '',
      category: vendor.category || '',
      vendorType: vendor.vendor_type || 'Material Supplier',
      status: vendor.status || 'ACTIVE',
      email: vendor.email || '',
      phone: vendor.phone || '',
      location: vendor.location || '',
      rating: vendor.rating || 0
    });
    setEditingId(vendor.id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDeleteVendor = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/vendors/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete vendor');

        successToast('Vendor deleted successfully');
        fetchVendors();
        fetchStats();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const columns = [
    {
      label: 'Vendor Name',
      key: 'vendor_name',
      sortable: true,
      className: 'font-bold text-slate-900'
    },
    {
      label: 'Category',
      key: 'category',
      sortable: true,
      render: (val) => val ? <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100 uppercase tracking-wider">{val}</span> : '—'
    },
    {
      label: 'Contact',
      key: 'contact',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-700">{row.contact_person || '—'}</span>
          <span className="text-[10px] text-slate-400 font-medium">{row.phone || 'No Phone'}</span>
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
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleEditVendor(row); }}
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
            title="Edit Vendor"
          >
            <FileEdit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteVendor(row.id); }}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Delete Vendor"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const renderVendorExpanded = (vendor) => (
    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 m-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Mail className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Contact Information</h4>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Email Address</p>
              <p className="text-xs font-black text-slate-700">{vendor.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Phone Number</p>
              <p className="text-xs font-black text-slate-700">{vendor.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Location</p>
              <p className="text-xs font-black text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {vendor.location || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Business Summary</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Total Orders</p>
              <p className="text-lg font-black text-slate-900">{vendor.total_orders || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Total Value</p>
              <p className="text-lg font-black text-indigo-600">₹{(vendor.total_value || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 col-span-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Last Order Date</p>
              <p className="text-xs font-black text-slate-700 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {vendor.last_order_date ? new Date(vendor.last_order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'No orders yet'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Briefcase className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Classification</h4>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Vendor Type</p>
              <p className="text-xs font-black text-slate-700 uppercase">{vendor.vendor_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Category</p>
              <p className="text-xs font-black text-slate-700 uppercase">{vendor.category || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
              <Briefcase className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Suppliers</h2>
          </div>
          <p className="text-sm font-medium text-slate-500 ml-14">Manage your supplier network and relationships</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            title="Refresh Data"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => { setIsEditing(false); setFormData({ vendorName: '', contactPerson: '', category: '', vendorType: 'Material Supplier', status: 'ACTIVE', email: '', phone: '', location: '', rating: 0 }); setShowForm(true); }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Suppliers</p>
            <p className="text-xl font-black text-slate-900">{stats?.totalVendors || vendors.length}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active</p>
            <p className="text-xl font-black text-slate-900">{vendors.filter(v => v.status === 'ACTIVE').length}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-yellow-50 text-yellow-600">
            <Star className="w-5 h-5 fill-current" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Rating</p>
            <p className="text-xl font-black text-slate-900">
              {(vendors.reduce((acc, v) => acc + parseFloat(v.rating || 0), 0) / (vendors.length || 1)).toFixed(1)}
            </p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Orders</p>
            <p className="text-xl font-black text-slate-900">{vendors.reduce((acc, v) => acc + (v.total_orders || 0), 0)}</p>
          </div>
        </div>
      </div>

      <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
        <div className="p-6">
          <DataTable 
            columns={columns}
            data={vendors}
            loading={loading}
            renderExpanded={renderVendorExpanded}
            pageSize={5}
            searchPlaceholder="Search suppliers by name, category, or contact..."
            emptyMessage="No suppliers found. Add one to get started."
          />
        </div>
      </Card>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={isEditing ? "Edit Supplier" : "Add New Supplier"}
        size="3xl"
      >
        <form onSubmit={handleAddVendor} className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Users className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Basic Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Supplier Name *">
                <input
                  type="text"
                  placeholder="Enter supplier name"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </FormControl>

              <FormControl label="Contact Person">
                <input
                  type="text"
                  placeholder="Contact person name"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </FormControl>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormControl label="Category">
                <input
                  type="text"
                  placeholder="e.g., Electronics"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Supplier Type">
                <select
                  value={formData.vendorType}
                  onChange={(e) => setFormData({...formData, vendorType: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  {vendorTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </FormControl>

              <FormControl label="Status">
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </FormControl>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Mail className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Contact Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Email Address">
                <input
                  type="email"
                  placeholder="supplier@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Phone Number">
                <input
                  type="tel"
                  placeholder="+91 XXXXXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </FormControl>
            </div>

            <FormControl label="Location/Address">
              <textarea
                placeholder="Enter supplier location or address"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px]"
              />
            </FormControl>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Star className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Performance</h3>
            </div>
            <FormControl label="Supplier Rating (0.0 - 5.0)">
              <div className="flex items-center gap-6">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => setFormData({...formData, rating: parseFloat(e.target.value) || 0})}
                  className="w-32 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <StarRating rating={formData.rating} />
              </div>
            </FormControl>
          </div>

          <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              {isEditing ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Vendors;