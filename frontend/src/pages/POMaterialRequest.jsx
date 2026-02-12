import { useState, useEffect, useMemo } from 'react';
import { Card, DataTable, StatusBadge, Modal, SearchableSelect } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const POMaterialRequest = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fulfillmentWarehouse, setFulfillmentWarehouse] = useState('');
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // New Request Form State
  const [formData, setFormData] = useState({
    department: '',
    requested_by: '',
    required_by: '',
    purpose: 'Material Issue',
    notes: '',
    items: [],
    target_warehouse: '',
    source_warehouse: ''
  });

  const [currentItem, setCurrentItem] = useState({
    item_code: '',
    quantity: 1,
    uom: 'pcs'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      fetchRequests();
      fetchInitialData();
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [deptRes, userRes, itemRes, warehouseRes] = await Promise.all([
        fetch(`${API_BASE}/departments`, { headers }),
        fetch(`${API_BASE}/users`, { headers }),
        fetch(`${API_BASE}/items`, { headers }),
        fetch(`${API_BASE}/warehouses`, { headers })
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (warehouseRes.ok) {
        const whData = await warehouseRes.json();
        console.log('Warehouses loaded:', whData);
        setWarehouses(whData);
      } else {
        console.error('Failed to load warehouses:', warehouseRes.status);
      }
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        setItems(itemData.map(i => ({
          item_code: i.item_code,
          name: i.item_description || i.material_name || i.item_code,
          uom: i.unit || 'pcs',
          material_type: i.material_type
        })));
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  useEffect(() => {
    if (showViewModal && selectedRequest?.id && fulfillmentWarehouse) {
      const fetchWarehouseStock = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_BASE}/material-requests/${selectedRequest.id}?warehouse=${encodeURIComponent(fulfillmentWarehouse)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setSelectedRequest(data);
          }
        } catch (error) {
          console.error('Error fetching warehouse stock:', error);
        }
      };
      fetchWarehouseStock();
    }
  }, [fulfillmentWarehouse, showViewModal, selectedRequest?.id]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch Material Requests');
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching material requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = async (warehouse) => {
    setFulfillmentWarehouse(warehouse);
    if (!selectedRequest?.id) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requests/${selectedRequest.id}/warehouse`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source_warehouse: warehouse })
      });

      if (response.ok) {
        // Fetch updated data with stock
        const updatedRes = await fetch(`${API_BASE}/material-requests/${selectedRequest.id}?warehouse=${encodeURIComponent(warehouse)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (updatedRes.ok) {
          setSelectedRequest(await updatedRes.json());
        }
      }
    } catch (error) {
      console.error('Error updating warehouse:', error);
    }
  };

  const handleCreatePO = async (mr) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mrId: mr.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        successToast(`Purchase Order Request created successfully`);
        setShowViewModal(false);
        fetchRequests();
      } else {
        const err = await response.json();
        errorToast(err.message || "Failed to create Purchase Order Request");
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast(error.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requests/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedRequest(data);
        // Use suggested warehouse if available, else source_warehouse, else default
        const suggestedWh = data.items?.find(i => i.suggested_warehouse)?.suggested_warehouse;
        if (suggestedWh) {
          setFulfillmentWarehouse(suggestedWh);
        } else if (data.source_warehouse) {
          setFulfillmentWarehouse(data.source_warehouse);
        } else {
          setFulfillmentWarehouse('Consumables Store'); // Default fallback
        }
        setShowViewModal(true);
      } else {
        errorToast("Failed to fetch request details");
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseMaterial = async (id) => {
    try {
      const result = await Swal.fire({
        title: 'Release Material?',
        text: 'This will mark the material request as completed.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, release it!'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/material-requests/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'completed' })
        });

        if (response.ok) {
          successToast("Material released successfully");
          setShowViewModal(false);
          fetchRequests();
        } else {
          errorToast("Failed to release material");
        }
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Request?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/material-requests/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          successToast("Request deleted successfully");
          fetchRequests();
        } else {
          const error = await response.json();
          errorToast(error.message || "Failed to delete request");
        }
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast("Network error");
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts = {
      total: requests.length,
      draft: 0,
      approved: 0,
      processing: 0,
      po_created: 0,
      fulfilled: 0,
      completed: 0,
      cancelled: 0
    };
    requests.forEach(req => {
      const status = (req.status || 'DRAFT').toLowerCase();
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  }, [requests]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).split('/').join('-');
  };

  const columns = [
    {
      key: 'mr_number',
      label: 'ID',
      sortable: true,
      render: (val) => <span className="text-slate-900 font-medium">{val}</span>
    },
    {
      key: 'department',
      label: 'Requester',
      sortable: true,
      render: (val) => (
        <div className="text-slate-500 font-medium">{val || '—'}</div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => <StatusBadge status={val || 'DRAFT'} />
    },
    {
      key: 'required_by',
      label: 'Required By',
      sortable: true,
      render: (val) => formatDate(val)
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 w-fit ${val === 'available' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
          <div className={`w-1 h-1 rounded-full ${val === 'available' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          {val || 'unavailable'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleViewRequest(row.id)}
            className="p-1 hover:bg-slate-100 rounded text-slate-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button 
            onClick={() => handleDeleteRequest(row.id)}
            className="p-1 hover:bg-rose-50 rounded text-rose-400"
            title="Delete Request"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const handleAddItem = () => {
    if (!currentItem.item_code || !currentItem.quantity) return;
    const selectedItem = items.find(i => i.item_code === currentItem.item_code);
    setFormData({
      ...formData,
      items: [
        ...formData.items, 
        { 
          ...currentItem, 
          item_name: selectedItem?.name || currentItem.item_code,
          item_type: selectedItem?.material_type || 'Raw Material'
        }
      ]
    });
    setCurrentItem({ item_code: '', quantity: 1, uom: 'pcs' });
  };

  const handleRemoveItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async () => {
    if (formData.items.length === 0) {
      errorToast("Please add at least one item");
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to create material request');
      
      successToast("Material Request submitted successfully");
      setShowModal(false);
      fetchRequests();
      setFormData({
        department: '',
        requested_by: '',
        required_by: '',
        purpose: 'Material Issue',
        notes: '',
        items: [],
        target_warehouse: '',
        source_warehouse: ''
      });
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Material Requests</h1>
              <p className="text-slate-500 text-[10px]">Updated {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </button>
              <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
            </div>
            <button onClick={fetchRequests} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
            <button onClick={() => { setShowModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm shadow-indigo-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              New Request
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4 mb-6">
          {[
            { label: 'Total Requests', count: statusCounts.total, icon: '📋', color: 'indigo', active: true },
            { label: 'Draft', count: statusCounts.draft, icon: '📝', color: 'slate' },
            { label: 'Approved', count: statusCounts.approved, icon: '🛡️', color: 'blue' },
            { label: 'Processing', count: statusCounts.processing, icon: '⚙️', color: 'purple' },
            { label: 'Fulfilled', count: statusCounts.fulfilled, icon: '✅', color: 'emerald' },
            { label: 'Completed', count: statusCounts.completed, icon: '✔️', color: 'emerald' },
            { label: 'Cancelled', count: statusCounts.cancelled, icon: '❌', color: 'rose' }
          ].map((card, idx) => (
            <div key={idx} className={`bg-white p-4 rounded-2xl border ${card.active ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-100 hover:border-slate-200'} transition-all cursor-pointer group`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xl">{card.icon}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${card.color}-50 text-${card.color}-600`}>+0%</span>
              </div>
              <p className="text-slate-500 text-[10px] font-medium mb-1">{card.label}</p>
              <h3 className="text-xl font-bold text-slate-900">{card.count}</h3>
            </div>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={requests}
          loading={loading}
          searchPlaceholder="Search by ID, requester or department..."
          emptyMessage="No material requests found"
          filterComponent={
            <div className="flex items-center gap-2">
              <select className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-100">
                <option>All Statuses</option>
                <option>Draft</option>
                <option>Approved</option>
                <option>Fulfilled</option>
              </select>
            </div>
          }
          actions={
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2 hover:bg-slate-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                Columns
              </button>
              <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2 hover:bg-slate-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 9l-4-4m0 0L8 9m4-4v12" /></svg>
                Export
              </button>
            </div>
          }
        />
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Material Request"
        size="4xl"
      >
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Request Details</h3>
                  <p className="text-[10px] text-slate-500">Define MR basic parameters</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Requested By (Optional)
                  </label>
                  <select 
                    value={formData.requested_by}
                    onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">{formData.department ? 'Select Requester (Optional)' : 'Select Dept First'}</option>
                    {users.filter(u => !formData.department || u.department_name === formData.department).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Required By <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="date"
                    value={formData.required_by}
                    onChange={(e) => setFormData({ ...formData, required_by: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Purpose</label>
                  <div className="space-y-2">
                    {[
                      { id: 'Purchase Request', icon: '📦', color: 'blue' },
                      { id: 'Internal Transfer', icon: '🏢', color: 'slate' },
                      { id: 'Material Issue', icon: '➡️', color: 'orange' }
                    ].map(p => (
                      <button 
                        key={p.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, purpose: p.id })}
                        className={`w-full px-4 py-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          formData.purpose === p.id 
                            ? `border-${p.color}-200 bg-${p.color}-50/50 text-${p.color}-900 shadow-sm shadow-${p.color}-100` 
                            : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          formData.purpose === p.id ? `bg-${p.color}-100` : 'bg-slate-100'
                        }`}>
                          {p.icon}
                        </div>
                        <span className="text-xs font-medium">{p.id}</span>
                        {formData.purpose === p.id && (
                          <div className={`ml-auto w-4 h-4 rounded-full bg-${p.color}-500 flex items-center justify-center`}>
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {(formData.purpose === 'Internal Transfer' || formData.purpose === 'Material Issue') && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      Source Warehouse <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      value={formData.source_warehouse}
                      onChange={(e) => setFormData({ ...formData, source_warehouse: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Select Source Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.warehouse_name}>{w.warehouse_name}</option>)}
                    </select>
                  </div>
                )}

                {(formData.purpose === 'Internal Transfer' || formData.purpose === 'Purchase Request') && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      Target Warehouse <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      value={formData.target_warehouse}
                      onChange={(e) => setFormData({ ...formData, target_warehouse: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Select Target Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.warehouse_name}>{w.warehouse_name}</option>)}
                    </select>
                  </div>
                )}

                <div className="mt-auto p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    <span className="font-bold">Pro Tip:</span> Setting the department to <span className="font-bold">Production</span> will automatically switch the purpose to <span className="font-bold">Material Issue</span>. Use <span className="font-bold">Internal Transfer</span> for moving stock between warehouses.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 11m8 4V5" /></svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Requested Items</h3>
                  <p className="text-[10px] text-slate-500">{formData.items.length} items total</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-6">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Item <span className="text-rose-500">*</span></label>
                    <SearchableSelect 
                      options={items}
                      value={currentItem.item_code}
                      onChange={(e) => {
                        const selected = items.find(i => i.item_code === e.target.value);
                        setCurrentItem({ 
                          ...currentItem, 
                          item_code: e.target.value,
                          name: selected?.name || '',
                          uom: selected?.uom || 'pcs',
                          material_type: selected?.material_type || ''
                        });
                      }}
                      placeholder="Select Item"
                      labelField="name"
                      valueField="item_code"
                      subLabelField="material_type"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Quantity <span className="text-rose-500">*</span></label>
                    <input 
                      type="number"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">UOM</label>
                    <input 
                      type="text"
                      value={currentItem.uom}
                      readOnly
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <button 
                      onClick={handleAddItem}
                      className="w-10 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Item Info</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Qty</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100">
                    {formData.items.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 11m8 4V5" /></svg>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">No items added yet</p>
                      </div>
                    ) : (
                      formData.items.map((item, idx) => (
                        <div key={idx} className="px-3 py-2 flex justify-between items-center group hover:bg-slate-50">
                          <div>
                            <p className="text-xs font-medium text-slate-900">{item.name}</p>
                            <p className="text-[9px] text-slate-500">{item.item_code} • {item.material_type}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-slate-900">{item.quantity} {item.uom}</span>
                            <button onClick={() => handleRemoveItem(idx)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                    Notes & Special Instructions
                  </label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes for this material request..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 min-h-[80px]"
                  />
                </div>

                <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    <span className="font-bold">Pro Tip:</span> Setting the department to <span className="font-bold">Production</span> will automatically switch the purpose to <span className="font-bold">Material Issue</span>. Use <span className="font-bold">Internal Transfer</span> for moving stock between warehouses.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
            <button 
              onClick={() => setShowModal(false)}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button 
                onClick={handleSubmit}
                className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 flex items-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Save as Draft
              </button>
              <button 
                onClick={handleSubmit}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Material Request: ${selectedRequest?.mr_number}`}
        size="7xl"
      >
        <div className="p-6 bg-slate-50/30">
          {/* Header Stats */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shadow-sm shadow-orange-100/50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                <StatusBadge status={selectedRequest?.status} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm shadow-blue-100/50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Purpose</p>
                <p className="text-sm font-bold text-slate-700">{selectedRequest?.purpose}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 shadow-sm shadow-purple-100/50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Department</p>
                <p className="text-sm font-bold text-slate-700">{selectedRequest?.department}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-sm shadow-emerald-100/50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Requested By</p>
                <p className="text-sm font-bold text-slate-700">{selectedRequest?.requester_name || 'System'}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm shadow-indigo-100/50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Linked PO</p>
                <div className="flex flex-col">
                  <p className="text-xs font-bold text-indigo-600 truncate">
                    {selectedRequest?.linked_po_number ? `#${selectedRequest.linked_po_number}` : (selectedRequest?.linked_po ? `#${selectedRequest.linked_po}` : '#N/A')}
                  </p>
                  {(selectedRequest?.linked_po_number || selectedRequest?.linked_po) && (
                    <span className="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">ORDERED</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Left Side - Line Items */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-50 bg-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 11m8 4V5" /></svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Line Items</h4>
                </div>
                <button 
                  onClick={() => fulfillmentWarehouse && handleWarehouseChange(fulfillmentWarehouse)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh Stock
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item Details</th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Design Qty</th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Warehouse</th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Level</th>
                      <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedRequest?.items?.map((item, idx) => {
                      const isAvailable = item.fulfillment_source === 'STOCK';
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="px-6 py-5">
                            <div>
                              <p className="text-[11px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.item_code}</p>
                              <p className="text-sm font-medium text-slate-600 mt-0.5">{item.name}</p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  item.material_type === 'RAW_MATERIAL' || item.material_type === 'Raw Material' ? 'bg-slate-100 text-slate-600' :
                                  item.material_type === 'SUB_ASSEMBLY' || item.material_type === 'Sub Assembly' ? 'bg-blue-50 text-blue-600' :
                                  item.material_type === 'FG' || item.material_type === 'Finished Good' ? 'bg-purple-50 text-purple-600' :
                                  'bg-slate-50 text-slate-500'
                                }`}>
                                  {item.material_type?.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="text-xs font-bold text-slate-700">
                              {Number(item.design_qty || 0).toFixed(3)}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center text-xs font-medium text-slate-600">
                            {item.warehouse || '—'}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex flex-col items-center">
                              <p className={`text-sm font-bold ${item.total_stock > 0 ? 'text-indigo-600' : 'text-rose-500'}`}>
                                {Number(item.total_stock || 0).toFixed(Number(item.total_stock) % 1 === 0 ? 0 : 2)} {item.uom}
                              </p>
                              <div className="flex flex-col items-center mt-1 gap-1">
                                {item.stocks?.map((st, sidx) => (
                                  <span key={sidx} className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${st.warehouse_name === item.suggested_warehouse ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-500'}`}>
                                    {st.warehouse_name}: {Number(st.current_stock).toFixed(Number(st.current_stock) % 1 === 0 ? 0 : 1)}
                                    {st.warehouse_name === item.suggested_warehouse && <span className="ml-1 text-[8px] font-bold uppercase tracking-tighter">(Suggested)</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border shadow-sm ${
                                isAvailable 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border-rose-100'
                              }`}>
                                {isAvailable ? 'in stock' : 'low stock'}
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-[9px] font-bold uppercase border border-slate-100 shadow-sm">
                                {selectedRequest?.status || 'Draft'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Side - Fulfillment & Summary */}
            <div className="w-96 space-y-6">
              {/* Fulfillment Source */}
              {(() => {
                const allAvailable = selectedRequest?.items?.every(item => item.fulfillment_source === 'STOCK');
                return (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className={`p-5 border-b border-slate-50 flex justify-between items-center transition-colors ${allAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">FULFILLMENT SOURCE</h4>
                      </div>
                      <span className="px-2 py-0.5 bg-white/20 text-white rounded text-[9px] font-bold uppercase tracking-wider">
                        {allAvailable ? 'STOCK AVAILABLE' : 'ACTION REQUIRED'}
                      </span>
                    </div>
                    <div className="p-6 space-y-5">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Warehouse</label>
                          <span className={`flex items-center gap-1.5 text-[10px] font-bold ${allAvailable ? 'text-emerald-500' : 'text-amber-500'} uppercase`}>
                            {allAvailable ? (
                              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>Stock Available</>
                            ) : (
                              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Partial Stock</>
                            )}
                          </span>
                        </div>
                        <div className="relative group">
                          <select 
                            value={fulfillmentWarehouse}
                            onChange={(e) => handleWarehouseChange(e.target.value)}
                            className={`w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:border-${allAvailable ? 'emerald' : 'amber'}-400 transition-all appearance-none group-hover:border-slate-200`}
                          >
                            <option value="">Select Warehouse...</option>
                            {warehouses.map(wh => (
                              <option key={wh.id} value={wh.warehouse_name}>{wh.warehouse_name}</option>
                            ))}
                          </select>
                          <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-${allAvailable ? 'emerald' : 'amber'}-500 transition-colors`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          </div>
                        </div>
                      </div>
                      <div className={`${allAvailable ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'} rounded-2xl p-4 border flex gap-4 transition-colors`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${allAvailable ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          <svg className={`w-4 h-4 ${allAvailable ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className={`text-[11px] font-medium leading-relaxed ${allAvailable ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {allAvailable 
                            ? 'Full stock is available across warehouses. You can fulfill this request directly.' 
                            : 'Stock is insufficient globally. A Purchase Order may be required for some items.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Request Summary */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request Summary</h4>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 group hover:bg-indigo-50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">Linked Purchase Order:</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-600 mb-2 truncate group-hover:text-indigo-700 transition-colors">
                      {selectedRequest?.linked_po_number ? `#${selectedRequest.linked_po_number}` : (selectedRequest?.linked_po ? `#${selectedRequest.linked_po}` : 'No Linked PO')}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                      <StatusBadge status={(selectedRequest?.linked_po_number || selectedRequest?.linked_po) ? "ORDERED" : "none"} />
                    </div>
                  </div>

                  <div className="space-y-4 px-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Required By</span>
                      <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 text-slate-700">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[11px] font-bold uppercase">{formatDate(selectedRequest?.required_by)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Created On</span>
                      <span className="text-[11px] font-bold text-slate-700 uppercase">{formatDate(selectedRequest?.created_at)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Items Total</span>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{selectedRequest?.items?.length} Unique Items</span>
                    </div>
                  </div>

                  <button className="w-full py-4 px-4 bg-white border-2 border-slate-100 rounded-2xl text-[11px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print Document
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end items-center gap-4">
            <button 
              onClick={() => setShowViewModal(false)}
              className="px-8 py-3 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors uppercase tracking-widest active:scale-95"
            >
              Cancel
            </button>
            {selectedRequest?.items?.some(item => {
              const totalStock = item.stocks ? item.stocks.reduce((acc, st) => acc + (Number(st.current_stock) || 0), 0) : 0;
              return totalStock < Number(item.quantity);
            }) && !selectedRequest?.linked_po_id && (
              <button 
                onClick={() => handleCreatePO(selectedRequest)}
                className="px-8 py-3 bg-indigo-500 text-white rounded-2xl text-xs font-bold hover:bg-indigo-600 flex items-center gap-3 shadow-xl shadow-indigo-200/50 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Create Purchase Order
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </button>
            )}
            <button 
              onClick={() => handleReleaseMaterial(selectedRequest?.id)}
              className="px-8 py-3 bg-emerald-500 text-white rounded-2xl text-xs font-bold hover:bg-emerald-600 flex items-center gap-3 shadow-xl shadow-emerald-200/50 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Release Material
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default POMaterialRequest;


