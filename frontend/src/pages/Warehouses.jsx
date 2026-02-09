import { useState, useEffect } from 'react';
import { Card, Modal, FormControl, DataTable, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const warehouseStatusColors = {
  ACTIVE: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'active' },
  INACTIVE: { badge: 'bg-slate-100 text-slate-700 border-slate-200', label: 'inactive' },
};

const Warehouses = () => {
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'allocation'
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formData, setFormData] = useState({
    warehouseCode: '',
    warehouseName: '',
    warehouseType: '',
    location: '',
    capacity: '',
    status: 'ACTIVE'
  });

  // Allocation State
  const [pendingItems, setPendingItems] = useState([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocatingId, setAllocatingId] = useState(null);
  const [allocationData, setAllocationData] = useState({});

  useEffect(() => {
    fetchWarehouses();
    fetchPendingAllocations();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch warehouses');
      const data = await response.json();
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingAllocations = async () => {
    try {
      setAllocationLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouse-allocations/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch pending allocations');
      const data = await response.json();
      setPendingItems(data);
      
      const initialData = {};
      data.forEach(item => {
        initialData[item.grn_item_id] = {
          target_warehouse: '',
          allocate_qty: item.pending_allocation_qty,
          remarks: ''
        };
      });
      setAllocationData(initialData);
    } catch (error) {
      console.error(error);
    } finally {
      setAllocationLoading(false);
    }
  };

  const handleAllocationInputChange = (itemId, field, value) => {
    setAllocationData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleAllocate = async (item) => {
    const data = allocationData[item.grn_item_id];
    
    if (!data.target_warehouse) {
      errorToast('Please select a target warehouse');
      return;
    }

    if (parseFloat(data.allocate_qty) <= 0 || parseFloat(data.allocate_qty) > item.pending_allocation_qty) {
      errorToast('Invalid allocation quantity');
      return;
    }

    setAllocatingId(item.grn_item_id);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouse-allocations/allocate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          grn_item_id: item.grn_item_id,
          target_warehouse: data.target_warehouse,
          allocate_qty: data.allocate_qty,
          remarks: data.remarks
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Allocation failed');
      }

      successToast('Material allocated successfully');
      fetchPendingAllocations();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setAllocatingId(null);
    }
  };

  const warehouseOptions = [
    { value: 'RM', label: 'Raw Material Warehouse' },
    { value: 'WIP', label: 'Production Issue (WIP)' },
    { value: 'FG', label: 'Finished Goods' },
    { value: 'SUB', label: 'Subcontract Store' },
    { value: 'REJECT', label: 'Rejected Store' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.warehouseCode.trim() || !formData.warehouseName.trim()) {
      errorToast('Warehouse code and name are required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const url = editingWarehouse ? `${API_BASE}/warehouses/${editingWarehouse.id}` : `${API_BASE}/warehouses`;
      const method = editingWarehouse ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error(`Failed to ${editingWarehouse ? 'update' : 'create'} warehouse`);

      successToast(`Warehouse ${editingWarehouse ? 'updated' : 'added'} successfully`);
      resetForm();
      fetchWarehouses();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      warehouseCode: '',
      warehouseName: '',
      warehouseType: '',
      location: '',
      capacity: '',
      status: 'ACTIVE'
    });
    setEditingWarehouse(null);
    setShowForm(false);
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      warehouseCode: warehouse.warehouse_code || '',
      warehouseName: warehouse.warehouse_name || '',
      warehouseType: warehouse.warehouse_type || '',
      location: warehouse.location || '',
      capacity: warehouse.capacity || '',
      status: warehouse.status || 'ACTIVE'
    });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Delete Warehouse?',
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
      const response = await fetch(`${API_BASE}/warehouses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete warehouse');

      successToast('Warehouse deleted successfully');
      fetchWarehouses();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const columns = [
    {
      label: 'Code',
      key: 'warehouse_code',
      sortable: true,
      render: (val) => <span className="font-bold text-slate-900">{val}</span>
    },
    {
      label: 'Name',
      key: 'warehouse_name',
      sortable: true,
      render: (val) => <span className="text-slate-600">{val}</span>
    },
    {
      label: 'Type',
      key: 'warehouse_type',
      render: (val) => <span className="text-slate-600">{val || '—'}</span>
    },
    {
      label: 'Location',
      key: 'location',
      render: (val) => <span className="text-slate-600">{val || '-'}</span>
    },
    {
      label: 'Capacity',
      key: 'capacity',
      render: (val) => <span className="text-slate-600">{val || '—'}</span>
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => {
        const config = warehouseStatusColors[val] || warehouseStatusColors.ACTIVE;
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
            onClick={() => handleDelete(val, row.warehouse_code)}
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
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-xl">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl text-slate-900 font-bold">Warehouses</h1>
            <p className="text-slate-500 mt-1">Manage storage locations and inventory warehouses</p>
          </div>
        </div>
        {activeTab === 'list' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 shadow-sm shadow-orange-200 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Warehouse
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Warehouse List
        </button>
        <button
          onClick={() => setActiveTab('allocation')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'allocation' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Material Allocation
        </button>
      </div>

      {activeTab === 'list' ? (
        <DataTable 
          columns={columns}
          data={warehouses}
          loading={loading}
          searchPlaceholder="Search by name, code, or location..."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-[10px]  ">
                <tr>
                  <th className="p-2 text-left">Source (GRN/PO)</th>
                  <th className="p-2 text-left">Item Details</th>
                  <th className="p-2 text-right">Accepted</th>
                  <th className="p-2 text-right">Allocated</th>
                  <th className="p-2 text-right">Pending</th>
                  <th className="p-2 text-left">Target Warehouse</th>
                  <th className="p-2 text-left">Allocate Qty</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocationLoading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="w-10 h-10 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-xs text-slate-500 font-medium">Loading pending allocations...</p>
                    </td>
                  </tr>
                ) : pendingItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="p-3 bg-slate-50 rounded-full shadow-sm w-fit mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <p className="text-slate-500 font-medium">No items pending allocation</p>
                      <p className="text-xs text-slate-400 mt-1">All received materials have been distributed</p>
                    </td>
                  </tr>
                ) : (
                  pendingItems.map((item) => (
                    <tr key={item.grn_item_id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className=" text-orange-600 font-bold">#{item.grn_number}</div>
                        <div className="text-[10px] text-slate-400 tracking-tight mt-0.5">PO: {item.po_number}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className=" text-slate-900 font-bold">{item.item_code}</div>
                        <div className="text-xs text-slate-500 max-w-[200px] truncate">{item.material_name}</div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-emerald-600 bg-emerald-50/30">
                        {parseFloat(item.accepted_qty).toFixed(3)}
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-slate-400">
                        {parseFloat(item.allocated_qty || 0).toFixed(3)}
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-rose-600 bg-rose-50/30">
                        {parseFloat(item.pending_allocation_qty).toFixed(3)}
                      </td>
                      <td className="px-6 py-5">
                        <select
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all"
                          value={allocationData[item.grn_item_id]?.target_warehouse || ''}
                          onChange={(e) => handleAllocationInputChange(item.grn_item_id, 'target_warehouse', e.target.value)}
                        >
                          <option value="">Select WH</option>
                          {warehouseOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-5">
                        <input
                          type="number"
                          className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                          value={allocationData[item.grn_item_id]?.allocate_qty || ''}
                          onChange={(e) => handleAllocationInputChange(item.grn_item_id, 'allocate_qty', e.target.value)}
                          max={item.pending_allocation_qty}
                          min="0"
                          step="0.001"
                        />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => handleAllocate(item)}
                          disabled={allocatingId === item.grn_item_id}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs transition-all shadow-sm ${
                            allocatingId === item.grn_item_id 
                              ? 'bg-slate-300 cursor-not-allowed' 
                              : 'bg-orange-600 hover:bg-orange-700 active:scale-95 shadow-orange-100 font-bold'
                          }`}
                        >
                          {allocatingId === item.grn_item_id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Wait...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              Allocate
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingWarehouse ? 'Edit Warehouse' : 'Create Warehouse'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Warehouse Code *">
              <input
                type="text"
                value={formData.warehouseCode}
                onChange={(e) => setFormData({...formData, warehouseCode: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
                placeholder="e.g. WH-RM"
                required
              />
            </FormControl>
            <FormControl label="Warehouse Name *">
              <input
                type="text"
                value={formData.warehouseName}
                onChange={(e) => setFormData({...formData, warehouseName: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
                placeholder="Enter warehouse name"
                required
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Type">
              <select
                value={formData.warehouseType}
                onChange={(e) => setFormData({...formData, warehouseType: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
              >
                <option value="">Select Type</option>
                <option value="Stores">Stores</option>
                <option value="Finished Goods">Finished Goods</option>
                <option value="Raw Material">Raw Material</option>
                <option value="Scrap">Scrap</option>
                <option value="WIP">WIP</option>
              </select>
            </FormControl>
            <FormControl label="Location">
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
                placeholder="e.g. Main Factory"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Capacity">
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
                placeholder="Enter capacity"
              />
            </FormControl>
            <FormControl label="Status">
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FormControl>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-all active:scale-95 shadow-sm shadow-orange-200"
            >
              {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Warehouses;
