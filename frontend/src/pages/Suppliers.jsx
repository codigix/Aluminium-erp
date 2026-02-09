import { useState, useEffect } from 'react';
import { Card, Modal, FormControl, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const supplierStatusColors = {
  ACTIVE: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'active' },
  INACTIVE: { badge: 'bg-slate-100 text-slate-700 border-slate-200', label: 'inactive' },
  BLOCKED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'blocked' },
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
        <svg key={`empty-${i}`} className="w-4 h-4 text-slate-200 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[10px] text-slate-500 font-bold ml-1">{numRating.toFixed(1)}</span>
    </div>
  );
};

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    vendorName: '',
    gstin: '',
    groupName: '',
    leadTime: '',
    category: 'Material Supplier',
    status: 'ACTIVE',
    email: '',
    phone: '',
    location: '',
    rating: 5.0
  });

  useEffect(() => {
    fetchSuppliers();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/suppliers/stats`, {
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

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/suppliers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch suppliers');
      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.vendorName.trim()) {
      errorToast('Supplier name is required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const url = editingSupplier ? `${API_BASE}/suppliers/${editingSupplier.id}` : `${API_BASE}/suppliers`;
      const method = editingSupplier ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error(`Failed to ${editingSupplier ? 'update' : 'create'} supplier`);

      successToast(`Supplier ${editingSupplier ? 'updated' : 'added'} successfully`);
      resetForm();
      fetchSuppliers();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      vendorName: '',
      gstin: '',
      groupName: '',
      leadTime: '',
      category: 'Material Supplier',
      status: 'ACTIVE',
      email: '',
      phone: '',
      location: '',
      rating: 5.0
    });
    setEditingSupplier(null);
    setShowForm(false);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      vendorName: supplier.vendor_name || '',
      gstin: supplier.gstin || '',
      groupName: supplier.group_name || '',
      leadTime: supplier.lead_time || '',
      category: supplier.category || 'Material Supplier',
      status: supplier.status || 'ACTIVE',
      email: supplier.email || '',
      phone: supplier.phone || '',
      location: supplier.location || '',
      rating: supplier.rating || 5.0
    });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Delete Supplier?',
      text: `Are you sure you want to delete ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/suppliers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete supplier');

      successToast('Supplier deleted successfully');
      fetchSuppliers();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const columns = [
    {
      label: 'Name',
      key: 'vendor_name',
      sortable: true,
      render: (val) => <span className="font-bold text-slate-900">{val}</span>
    },
    {
      label: 'ID',
      key: 'vendor_code',
      sortable: true,
      render: (val) => <span className="text-slate-600">{val}</span>
    },
    {
      label: 'GSTIN',
      key: 'gstin',
      render: (val) => <span className="text-slate-600">{val || '—'}</span>
    },
    {
      label: 'Group',
      key: 'group_name',
      render: (val) => <span className="text-slate-600">{val || '-'}</span>
    },
    {
      label: 'Rating',
      key: 'rating',
      sortable: true,
      render: (val) => <StarRating rating={val} />
    },
    {
      label: 'Lead Time',
      key: 'lead_time',
      render: (val) => {
        if (!val) return <span className="text-slate-500">—</span>;
        const displayVal = /^\d+$/.test(val) ? `${val} days` : val;
        return <span className="text-slate-500">{displayVal}</span>;
      }
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => {
        const config = supplierStatusColors[val] || supplierStatusColors.ACTIVE;
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${config.badge}`}>
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
        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => handleEdit(row)}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
          >
            Edit
          </button>
          <button 
            onClick={() => handleDelete(val, row.vendor_name)}
            className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-slate-900">Suppliers</h1>
          <p className="text-slate-500 mt-1">Manage your supplier network and relationships</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Supplier
        </button>
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
              <p className="text-xs text-slate-500 tracking-wider">Total Suppliers</p>
              <p className="text-2xl text-slate-900 font-bold">{stats?.total_vendors || suppliers.length}</p>
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
              <p className="text-xs text-slate-500 tracking-wider">Active</p>
              <p className="text-2xl text-slate-900 font-bold">{stats?.active_vendors || suppliers.filter(v => v.status === 'ACTIVE').length}</p>
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
              <p className="text-xs text-slate-500 tracking-wider">Avg Rating</p>
              <p className="text-2xl text-slate-900 font-bold">
                {parseFloat(stats?.avg_rating || 0).toFixed(1)}
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
              <p className="text-xs text-slate-500 tracking-wider">Total Orders</p>
              <p className="text-2xl text-slate-900 font-bold">{stats?.total_orders || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <DataTable 
        columns={columns}
        data={suppliers}
        loading={loading}
        searchPlaceholder="Search by name, ID, or GSTIN..."
      />

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-2 max-h-[70vh] overflow-y-auto">
          <FormControl label="Supplier Name *">
            <input
              type="text"
              value={formData.vendorName}
              onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              placeholder="Enter supplier name"
              required
            />
          </FormControl>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="GSTIN">
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({...formData, gstin: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="GSTIN Number"
              />
            </FormControl>
            <FormControl label="Group">
              <input
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="Group Name"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Lead Time">
              <input
                type="text"
                value={formData.leadTime}
                onChange={(e) => setFormData({...formData, leadTime: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="e.g. 7 days"
              />
            </FormControl>
            <FormControl label="Initial Rating">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating}
                onChange={(e) => setFormData({...formData, rating: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Email">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="email@example.com"
              />
            </FormControl>
            <FormControl label="Phone">
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="Phone Number"
              />
            </FormControl>
          </div>

          <FormControl label="Location">
            <textarea
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none min-h-[80px]"
              placeholder="Full Address"
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Suppliers;
