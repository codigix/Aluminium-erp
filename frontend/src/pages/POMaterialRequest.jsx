import { useState, useEffect, useMemo } from 'react';
import { Card, DataTable, StatusBadge, Modal } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const POMaterialRequest = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  // New Request Form State
  const [formData, setFormData] = useState({
    department: '',
    requested_by: '',
    required_by: '',
    purpose: 'Material Issue',
    notes: '',
    items: []
  });

  const [currentItem, setCurrentItem] = useState({
    item_code: '',
    quantity: 1,
    uom: 'pcs'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchRequests();
      fetchInitialData();
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [deptRes, userRes, itemRes] = await Promise.all([
        fetch(`${API_BASE}/departments`, { headers }),
        fetch(`${API_BASE}/users`, { headers }),
        fetch(`${API_BASE}/items`, { headers })
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        setItems(itemData.map(i => ({
          item_code: i.item_code,
          name: i.item_description || i.material_name || i.item_code,
          uom: i.unit || 'pcs'
        })));
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

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

  const statusCounts = useMemo(() => {
    const counts = {
      total: requests.length,
      draft: 0,
      approved: 0,
      processing: 0,
      fulfilled: 0,
      cancelled: 0
    };
    requests.forEach(req => {
      const status = (req.status || 'draft').toLowerCase();
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
      key: 'requester_name',
      label: 'Requester',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="text-slate-900">{row.department || '—'}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => <StatusBadge status={val || 'Draft'} />
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
        <span className={`px-2 py-1 rounded-full text-[10px] ${val === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {val || 'unavailable'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-slate-100 rounded text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
      items: [...formData.items, { ...currentItem, name: selectedItem?.name || currentItem.item_code }]
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
        items: []
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
            <button onClick={() => { setModalStep(1); setShowModal(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm shadow-indigo-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              New Request
            </button>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Total Requests', count: statusCounts.total, icon: '📋', color: 'indigo', active: true },
            { label: 'Draft', count: statusCounts.draft, icon: '📝', color: 'slate' },
            { label: 'Approved', count: statusCounts.approved, icon: '🛡️', color: 'blue' },
            { label: 'Processing', count: statusCounts.processing, icon: '⚙️', color: 'purple' },
            { label: 'Fulfilled', count: statusCounts.fulfilled, icon: '✅', color: 'emerald' },
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
        show={showModal}
        onClose={() => setShowModal(false)}
        title="Create Material Request"
        size="2xl"
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department <span className="text-rose-500">*</span></label>
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Requested By <span className="text-rose-500">*</span></label>
                  <select 
                    value={formData.requested_by}
                    onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Select Requester</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Required By <span className="text-rose-500">*</span></label>
                  <input 
                    type="date"
                    value={formData.required_by}
                    onChange={(e) => setFormData({ ...formData, required_by: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purpose</label>
                  <div className="space-y-2">
                    {['Purchase Request', 'Internal Transfer', 'Material Issue'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setFormData({ ...formData, purpose: p })}
                        className={`w-full px-4 py-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          formData.purpose === p ? 'border-orange-200 bg-orange-50/50 text-orange-900 shadow-sm shadow-orange-100' : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${formData.purpose === p ? 'bg-orange-100' : 'bg-slate-100'}`}>
                          {p === 'Purchase Request' && '📦'}
                          {p === 'Internal Transfer' && '🏢'}
                          {p === 'Material Issue' && '➡️'}
                        </div>
                        <span className="text-xs font-medium">{p}</span>
                        {formData.purpose === p && <div className="ml-auto w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes & Special Instructions</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 min-h-[80px]"
                  />
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
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-7">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Item <span className="text-rose-500">*</span></label>
                    <select 
                      value={currentItem.item_code}
                      onChange={(e) => {
                        const selected = items.find(i => i.item_code === e.target.value);
                        setCurrentItem({ 
                          ...currentItem, 
                          item_code: e.target.value,
                          uom: selected?.uom || 'pcs'
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select Item</option>
                      {items.map(i => <option key={i.item_code} value={i.item_code}>{i.name}</option>)}
                    </select>
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
                  <div className="col-span-12">
                    <button 
                      onClick={handleAddItem}
                      className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      Add Item
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
                            <p className="text-[9px] text-slate-500">{item.item_code}</p>
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
    </div>
  );
};

export default POMaterialRequest;


