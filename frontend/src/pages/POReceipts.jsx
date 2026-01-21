import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const receiptStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  RECEIVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Received' },
  ACKNOWLEDGED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Acknowledged' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Closed' }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const POReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

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
    fetchReceipts();
    fetchStats();
    fetchPurchaseOrders();
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
          // Initialize items with their full quantity as default received
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
      Swal.fire('Error', 'Please select a purchase order', 'error');
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

      await Swal.fire('Success', 'PO Receipt created successfully', 'success');
      setShowCreateModal(false);
      setFormData({ poId: '', receiptDate: new Date().toISOString().split('T')[0], receivedQuantity: '', notes: '' });
      fetchReceipts();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to create receipt', 'error');
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
        receiptDate: data.receipt_date || '',
        receivedQuantity: data.received_quantity || '',
        notes: data.notes || '',
        status: data.status || ''
      });
      setShowEditModal(true);
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to load receipt details', 'error');
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

      await Swal.fire('Success', 'PO Receipt updated successfully', 'success');
      setShowEditModal(false);
      fetchReceipts();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update receipt', 'error');
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

      await Swal.fire('Success', 'PO Receipt deleted successfully', 'success');
      fetchReceipts();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete receipt', 'error');
    }
  };

  const handleOpenPdfInNewTab = async (receipt) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receipt.id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
      Swal.fire('Error', 'Failed to open PDF', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <Card title="PO Receipts" subtitle="Track and manage purchase order receipts from vendors">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search PO number or vendor..."
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Receipt
            </button>
            <button
              onClick={async () => {
                if (!selectedReceipt) {
                  Swal.fire('Info', 'Please select a receipt to export', 'info');
                  return;
                }
                try {
                  const token = localStorage.getItem('authToken');
                  const response = await fetch(`${API_BASE}/po-receipts/${selectedReceipt.id}/pdf`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `PO_Receipt_${selectedReceipt.po_number}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } else {
                    Swal.fire('Error', 'Failed to download PDF', 'error');
                  }
                } catch (error) {
                  console.error('Error downloading PDF:', error);
                  Swal.fire('Error', 'Failed to download PDF', 'error');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              title="Export Report"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading PO receipts...</p>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-500 mb-4">No receipts found</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Receipt
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="p-2 text-left ">PO Number</th>
                  <th className="p-2 text-left ">Vendor</th>
                  <th className="p-2 text-left ">Receipt Date</th>
                  <th className="px-4 py-3 text-right ">Received Qty</th>
                  <th className="p-2 text-left ">Status</th>
                  <th className="px-4 py-3 text-right ">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={`receipt-${receipt.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">{receipt.po_number || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{receipt.vendor_name || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(receipt.receipt_date)}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">{receipt.received_quantity || 0}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs  ${receiptStatusColors[receipt.status]?.badge}`}>
                        {receiptStatusColors[receipt.status]?.label || receipt.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenPdfInNewTab(receipt)} 
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="View PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleEditReceipt(receipt.id)} 
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Edit Receipt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteReceipt(receipt.id)} 
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Delete Receipt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600   tracking-wider mb-1">Total Receipts</p>
            <p className="text-2xl  text-blue-900">{stats.total_receipts || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600   tracking-wider mb-1">Draft</p>
            <p className="text-2xl  text-yellow-900">{stats.draft_receipts || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600   tracking-wider mb-1">Received</p>
            <p className="text-2xl  text-emerald-900">{stats.received_receipts || 0}</p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p className="text-xs text-cyan-600   tracking-wider mb-1">Acknowledged</p>
            <p className="text-2xl  text-cyan-900">{stats.acknowledged_receipts || 0}</p>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg  text-slate-900">Create PO Receipt</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Purchase Order *</label>
                  <select
                    value={formData.poId}
                    onChange={(e) => handlePoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">-- Select a PO --</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} - {po.vendor_name} - ₹{formatCurrency(po.total_amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    value={formData.receiptDate}
                    onChange={(e) => setFormData({...formData, receiptDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {formData.items.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Materials in PO</label>
                  <div className="border border-slate-100 rounded overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2  text-slate-600">Material / Description</th>
                          <th className="px-3 py-2 text-center  text-slate-600">Expected</th>
                          <th className="px-3 py-2 text-center  text-slate-600">Received Qty</th>
                          <th className="px-3 py-2 text-center  text-slate-600">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-900">{item.material_name || item.description}</p>
                              {item.material_type && <p className="text-[10px] text-slate-500">{item.material_type}</p>}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-center">
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
                                className="w-20 px-2 py-1 border border-slate-200 rounded text-center focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">{item.unit || 'NOS'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Received Quantity *</label>
                  <input
                    type="number"
                    value={formData.receivedQuantity}
                    onChange={(e) => setFormData({...formData, receivedQuantity: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none cursor-not-allowed  text-blue-600"
                    placeholder="Total quantity"
                    required
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any notes about the receipt"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
                >
                  Create Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg  text-slate-900">PO Receipt Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">PO Number</p>
                <p className="text-md text-slate-900">{selectedReceipt.po_number}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Vendor</p>
                <p className="text-md text-slate-900">{selectedReceipt.vendor_name || '—'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Receipt Date</p>
                <p className="text-md text-slate-900">{formatDate(selectedReceipt.receipt_date)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs  ${receiptStatusColors[selectedReceipt.status]?.badge}`}>
                  {receiptStatusColors[selectedReceipt.status]?.label || selectedReceipt.status}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Received Quantity</p>
                <p className="text-lg  text-emerald-600">{selectedReceipt.received_quantity || 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Created</p>
                <p className="text-md text-slate-900">{formatDate(selectedReceipt.created_at)}</p>
              </div>
            </div>

            {selectedReceipt.notes && (
              <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded">
                <p className="text-xs text-blue-600  tracking-wider  mb-2">Notes</p>
                <p className="text-slate-700">{selectedReceipt.notes}</p>
              </div>
            )}

            {selectedReceipt.items && selectedReceipt.items.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm text-slate-900 text-xs mb-3">Received Items</h4>
                <div className="border border-slate-100 rounded overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2  text-slate-600">Material / Description</th>
                        <th className="px-3 py-2 text-center  text-slate-600">Expected</th>
                        <th className="px-3 py-2 text-center  text-slate-600">Received</th>
                        <th className="px-3 py-2 text-center  text-slate-600">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReceipt.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">{item.material_name || item.description}</p>
                            {item.material_type && <p className="text-[10px] text-slate-500">{item.material_type}</p>}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600">{item.expected_quantity}</td>
                          <td className="px-3 py-2 text-center  text-blue-600">{item.received_quantity}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{item.unit || 'NOS'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken');
                    const response = await fetch(`${API_BASE}/po-receipts/${selectedReceipt.id}/pdf`, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `PO_Receipt_${selectedReceipt.po_number}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } else {
                      Swal.fire('Error', 'Failed to download PDF', 'error');
                    }
                  } catch (error) {
                    console.error('Error downloading PDF:', error);
                    Swal.fire('Error', 'Failed to download PDF', 'error');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg  text-slate-900">Edit PO Receipt</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateReceipt} className="">
              <div className="bg-slate-50 p-3 rounded text-sm">
                <p className="text-slate-600"><span className="font-medium">PO Number:</span> {selectedReceipt.po_number}</p>
                <p className="text-slate-600"><span className="font-medium">Vendor:</span> {selectedReceipt.vendor_name || '—'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select Status --</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="RECEIVED">Received</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={editFormData.receiptDate}
                  onChange={(e) => setEditFormData({...editFormData, receiptDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Received Quantity</label>
                <input
                  type="number"
                  value={editFormData.receivedQuantity}
                  onChange={(e) => setEditFormData({...editFormData, receivedQuantity: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  placeholder="Add notes"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Update Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default POReceipts;
