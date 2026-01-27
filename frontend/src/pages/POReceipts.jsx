import { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge, Modal, FormControl } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const POReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    poId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    receivedQuantity: '',
    notes: '',
    items: []
  });

  const [editFormData, setEditFormData] = useState({
    receiptDate: '',
    receivedQuantity: '',
    notes: '',
    status: ''
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.department_code === 'ADMIN' || parsedUser.department_code === 'PROCUREMENT' || parsedUser.department_code === 'INVENTORY' || parsedUser.department_code === 'SALES') {
        fetchReceipts();
        fetchStats();
        fetchPurchaseOrders();
      }
    } else {
      fetchReceipts();
      fetchStats();
      fetchPurchaseOrders();
    }
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      errorToast(error.message || 'Failed to load receipts');
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/stats`, {
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

  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching POs:', error);
    }
  };

  const handlePoChange = async (poId) => {
    const selectedPO = purchaseOrders.find(po => String(po.id) === String(poId));
    if (selectedPO) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const detailedPO = await response.json();
          const items = (detailedPO.items || []).map(item => ({
            ...item,
            received_qty: item.quantity
          }));

          setFormData({
            ...formData,
            poId,
            items,
            receivedQuantity: items.reduce((sum, item) => sum + parseFloat(item.received_qty || 0), 0)
          });
        }
      } catch (error) {
        console.error('Error fetching PO details:', error);
        setFormData({
          ...formData,
          poId,
          receivedQuantity: selectedPO.total_quantity || selectedPO.items_count || '',
          items: []
        });
      }
    } else {
      setFormData({
        ...formData,
        poId: '',
        receivedQuantity: '',
        items: []
      });
    }
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();

    if (!formData.poId) {
      errorToast('Please select a purchase order');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poId: parseInt(formData.poId),
          receiptDate: formData.receiptDate,
          receivedQuantity: formData.receivedQuantity,
          notes: formData.notes || null,
          items: formData.items
        })
      });

      if (!response.ok) throw new Error('Failed to create receipt');

      successToast('PO Receipt created successfully');
      setShowCreateModal(false);
      setFormData({ poId: '', receiptDate: new Date().toISOString().split('T')[0], receivedQuantity: '', notes: '', items: [] });
      fetchReceipts();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to create receipt');
    }
  };

  const handleEditReceipt = async (receiptId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipt details');
      const data = await response.json();
      setSelectedReceipt(data);
      setEditFormData({
        receiptDate: data.receipt_date?.split('T')[0] || '',
        receivedQuantity: data.received_quantity || '',
        notes: data.notes || '',
        status: data.status || ''
      });
      setShowEditModal(true);
    } catch (error) {
      errorToast(error.message || 'Failed to load receipt details');
    }
  };

  const handleUpdateReceipt = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${selectedReceipt.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiptDate: editFormData.receiptDate,
          receivedQuantity: editFormData.receivedQuantity,
          notes: editFormData.notes,
          status: editFormData.status
        })
      });

      if (!response.ok) throw new Error('Failed to update receipt');

      successToast('PO Receipt updated successfully');
      setShowEditModal(false);
      fetchReceipts();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update receipt');
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    const result = await Swal.fire({
      title: 'Delete Receipt?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete receipt');

      successToast('PO Receipt deleted successfully');
      fetchReceipts();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete receipt');
    }
  };

  const handleOpenPdfInNewTab = async (receipt) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receipt.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Error opening PDF:', error);
      errorToast('Failed to open PDF');
    }
  };

  const columns = [
    {
      key: 'po_number',
      label: 'PO Number',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    { key: 'vendor_name', label: 'Vendor', sortable: true },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      render: (val) => new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    },
    {
      key: 'received_quantity',
      label: 'Received Qty',
      sortable: true,
      render: (val) => <span className=" text-indigo-600">{val}</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => handleOpenPdfInNewTab(row)} 
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="View PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button 
            onClick={() => handleEditReceipt(row.id)} 
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Edit Receipt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button 
            onClick={() => handleDeleteReceipt(row.id)} 
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
            title="Delete Receipt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const renderExpanded = (receipt) => (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mx-4">
      <div className="bg-white px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <h4 className="text-[10px]  text-slate-500  tracking-widest">Received Item Details</h4>
        {receipt.notes && <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">Notes: {receipt.notes}</span>}
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/50 text-slate-400 text-[9px]  tracking-widest ">
          <tr>
            <th className="px-4 py-2">Material / Description</th>
            <th className="px-4 py-2 text-center">Expected</th>
            <th className="px-4 py-2 text-center">Received</th>
            <th className="px-4 py-2 text-center">Unit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {(receipt.items || []).map((item, idx) => (
            <tr key={idx} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2">
                <div className="text-slate-900 font-medium">{item.material_name || item.description}</div>
                {item.material_type && <div className="text-[10px] text-slate-500">{item.material_type}</div>}
              </td>
              <td className="px-4 py-2 text-center text-slate-500">{item.expected_qty || item.quantity}</td>
              <td className="px-4 py-2 text-center text-emerald-600 ">{item.received_qty}</td>
              <td className="px-4 py-2 text-center text-slate-400">{item.unit || 'NOS'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl  text-slate-900 tracking-tight">PO Receipts</h1>
            <p className="text-slate-500 text-xs font-medium">Track and manage purchase order receipts from vendors</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Create Receipt
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Receipts', value: stats.total_receipts, color: 'blue', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              { label: 'Draft', value: stats.draft_receipts, color: 'amber', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
              { label: 'Received', value: stats.received_receipts, color: 'emerald', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { label: 'Acknowledged', value: stats.acknowledged_receipts, color: 'cyan', icon: 'M5 13l4 4L19 7' }
            ].map((stat, i) => (
              <div key={i} className={`bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4`}>
                <div className={`p-3 bg-${stat.color}-50 rounded-xl`}>
                  <svg className={`w-6 h-6 text-${stat.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500   tracking-wider">{stat.label}</p>
                  <p className="text-2xl  text-slate-900">{stat.value || 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <DataTable
          columns={columns}
          data={receipts}
          loading={loading}
          renderExpanded={renderExpanded}
          searchPlaceholder="Search PO number or vendor..."
          emptyMessage="No receipts found"
          actions={
            <button
              onClick={fetchReceipts}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors group"
              title="Refresh Data"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          }
        />

        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create PO Receipt">
          <form onSubmit={handleCreateReceipt} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Select Purchase Order *">
                <select
                  value={formData.poId}
                  onChange={(e) => handlePoChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                >
                  <option value="">-- Select a PO --</option>
                  {purchaseOrders.map(po => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.vendor_name} - ₹{formatCurrency(po.total_amount)}
                    </option>
                  ))}
                </select>
              </FormControl>

              <FormControl label="Receipt Date *">
                <input
                  type="date"
                  value={formData.receiptDate}
                  onChange={(e) => setFormData({...formData, receiptDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                />
              </FormControl>
            </div>

            {formData.items.length > 0 && (
              <div className="space-y-3">
                <label className="text-[10px] text-slate-500   tracking-widest">Materials in PO</label>
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[9px]  tracking-widest ">
                      <tr>
                        <th className="px-4 py-3">Material / Description</th>
                        <th className="px-4 py-3 text-center">Expected</th>
                        <th className="px-4 py-3 text-center w-32">Received Qty</th>
                        <th className="px-4 py-3 text-center">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {formData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                            <p className=" text-slate-900">{item.material_name || item.description}</p>
                            {item.material_type && <p className="text-[10px] text-slate-500">{item.material_type}</p>}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              value={item.received_qty}
                              onChange={(e) => {
                                const newItems = [...formData.items];
                                newItems[idx].received_qty = parseFloat(e.target.value) || 0;
                                const total = newItems.reduce((sum, it) => sum + (parseFloat(it.received_qty) || 0), 0);
                                setFormData({
                                  ...formData,
                                  items: newItems,
                                  receivedQuantity: total
                                });
                              }}
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all  text-indigo-600"
                            />
                          </td>
                          <td className="px-4 py-3 text-center text-slate-400">{item.unit || 'NOS'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Total Received Quantity">
                <input
                  type="number"
                  value={formData.receivedQuantity}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm  text-indigo-600 cursor-not-allowed outline-none"
                  readOnly
                />
              </FormControl>
            </div>

            <FormControl label="Notes (Optional)">
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any notes about the receipt"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                rows="3"
              />
            </FormControl>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm  text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm  hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                Create Receipt
              </button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit PO Receipt">
          <form onSubmit={handleUpdateReceipt} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Receipt Date *">
                <input
                  type="date"
                  value={editFormData.receiptDate}
                  onChange={(e) => setEditFormData({...editFormData, receiptDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                />
              </FormControl>
              <FormControl label="Status *">
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="RECEIVED">Received</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </FormControl>
            </div>

            <FormControl label="Total Received Quantity">
              <input
                type="number"
                value={editFormData.receivedQuantity}
                onChange={(e) => setEditFormData({...editFormData, receivedQuantity: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm  text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>

            <FormControl label="Notes (Optional)">
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                rows="3"
              />
            </FormControl>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm  text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Update Receipt
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default POReceipts;
