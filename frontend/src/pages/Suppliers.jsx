import { useState, useEffect } from 'react';
import { Card, Modal, FormControl, DataTable } from '../components/ui.jsx';
import { 
  Plus, 
  Users, 
  CheckCircle, 
  Star, 
  ShoppingBag, 
  FileEdit, 
  Trash2,
  Search
} from 'lucide-react';
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
        <Star key={`filled-${i}`} size={16} className="text-yellow-400 fill-current" />
      ))}
      {[...Array(empty)].map((_, i) => (
        <Star key={`empty-${i}`} size={16} className="text-slate-200 fill-current" />
      ))}
      <span className="text-[10px] text-slate-500  ml-1">{numRating.toFixed(1)}</span>
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
      render: (val) => <span className=" text-slate-900">{val}</span>
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
          <span className={`p-1  roundedtext-xs   ${config.badge}`}>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs  hover:bg-indigo-100 transition-all"
          >
            <FileEdit size={14} />
            Edit
          </button>
          <button 
            onClick={() => handleDelete(val, row.vendor_name)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs  hover:bg-red-100 transition-all"
          >
            <Trash2 size={14} />
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
          <h1 className="text-2xl  text-slate-900">Suppliers</h1>
          <p className="text-slate-500 mt-1">Manage your supplier network and relationships</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-100 rounded-xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Suppliers</p>
              <p className="text-2xl text-slate-900 ">{stats?.total_vendors || suppliers.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-100 rounded-xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Active</p>
              <p className="text-2xl text-slate-900 ">{stats?.active_vendors || suppliers.filter(v => v.status === 'ACTIVE').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-100 rounded-xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Star className="w-6 h-6 text-yellow-600 fill-current" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Avg Rating</p>
              <p className="text-2xl text-slate-900 ">
                {parseFloat(stats?.avg_rating || 0).toFixed(1)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-100 rounded-xl bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Orders</p>
              <p className="text-2xl text-slate-900 ">{stats?.total_orders || 0}</p>
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
              className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
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
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="GSTIN Number"
              />
            </FormControl>
            <FormControl label="Group">
              <input
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
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
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
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
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Email">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="email@example.com"
              />
            </FormControl>
            <FormControl label="Phone">
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                placeholder="Phone Number"
              />
            </FormControl>
          </div>

          <FormControl label="Location">
            <textarea
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none min-h-[80px]"
              placeholder="Full Address"
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="p-2.5 rounded  border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="p-2.5 rounded  bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
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
