import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  ORDERED: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Ordered' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  ACKNOWLEDGED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Acknowledged' },
  RECEIVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Received' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Closed' },
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const PurchaseOrders = () => {
  const [pos, setPos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [poSuggestions, setPoSuggestions] = useState([]);
  const [isManualPo, setIsManualPo] = useState(false);
  const [formData, setFormData] = useState({
    quotationId: '',
    projectName: '',
    quoteNumber: '',
    poNumber: '',
    vendorName: '',
    expectedDeliveryDate: '',
    notes: ''
  });
  const [editFormData, setEditFormData] = useState({
    expectedDeliveryDate: '',
    notes: '',
    status: ''
  });

  useEffect(() => {
    fetchPOs();
    fetchStats();
    fetchApprovedQuotations();
  }, []);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch POs');
      const data = await response.json();
      setPos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching POs:', error);
      setPos([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/stats`, {
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

  const fetchApprovedQuotations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setQuotations(Array.isArray(data) ? data.filter(q => ['REVIEWED', 'RECEIVED'].includes(q.status)) : []);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
    }
  };

  const handleQuotationChange = async (quotationId) => {
    const selected = quotations.find(q => String(q.id) === String(quotationId));
    if (selected) {
      setFormData({
        ...formData,
        quotationId,
        vendorName: selected.vendor_name || 'Unknown Vendor'
      });

      // Fetch preview and quotation details to get suggested PO number and items
      try {
        const token = localStorage.getItem('authToken');
        const [previewRes, quotationRes] = await Promise.all([
          fetch(`${API_BASE}/purchase-orders/preview/${quotationId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch(`${API_BASE}/quotations/${quotationId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          })
        ]);

        if (previewRes.ok && quotationRes.ok) {
          const preview = await previewRes.json();
          const detailedQuotation = await quotationRes.json();
          
          const suggestions = [preview.poNumber];
          if (selected.quote_number && selected.quote_number !== preview.poNumber) {
            suggestions.push(selected.quote_number);
          }

          setPoSuggestions(suggestions);
          setIsManualPo(false);
          setPoItems(detailedQuotation.items || []);
          setFormData(prev => ({
            ...prev,
            quotationId,
            vendorName: selected.vendor_name || 'Unknown Vendor',
            poNumber: suggestions[0],
            projectName: preview.projectName || '',
            expectedDeliveryDate: preview.expectedDeliveryDate || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching PO preview or quotation:', error);
      }
    } else {
      setFormData({
        ...formData,
        quotationId: '',
        vendorName: '',
        poNumber: '',
        projectName: '',
        expectedDeliveryDate: ''
      });
      setPoSuggestions([]);
    }
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();

    if (!formData.poNumber) {
      Swal.fire('Error', 'Please enter a PO Number', 'error');
      return;
    }

    if (!formData.quotationId) {
      Swal.fire('Error', 'Please select a quotation', 'error');
      return;
    }

    if (!formData.expectedDeliveryDate) {
      Swal.fire('Error', 'Please select an expected delivery date', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quotationId: parseInt(formData.quotationId),
          expectedDeliveryDate: formData.expectedDeliveryDate || null,
          notes: formData.notes || null,
          poNumber: formData.poNumber || null
        })
      });

      if (!response.ok) throw new Error('Failed to create PO');

      await Swal.fire('Success', 'Purchase Order created successfully', 'success');
      setShowCreateModal(false);
      setPoItems([]);
      setFormData({ quotationId: '', projectName: '', quoteNumber: '', poNumber: '', vendorName: '', expectedDeliveryDate: '', notes: '' });
      fetchPOs();
      fetchStats();
      fetchApprovedQuotations();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to create PO', 'error');
    }
  };

  const handleViewPO = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');
      const data = await response.json();
      setSelectedPO(data);
      setPoItems(data.items || []);
      setShowViewModal(true);
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to load PO details', 'error');
    }
  };

  const handleEditPO = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');
      const data = await response.json();
      setSelectedPO(data);
      setPoItems(data.items || []);
      setEditFormData({
        expectedDeliveryDate: data.expected_delivery_date || '',
        notes: data.notes || '',
        status: data.status || ''
      });
      setShowEditModal(true);
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to load PO details', 'error');
    }
  };

  const handleUpdatePO = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${selectedPO.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: editFormData.status,
          poNumber: selectedPO.po_number,
          expectedDeliveryDate: editFormData.expectedDeliveryDate,
          notes: editFormData.notes
        })
      });

      if (!response.ok) throw new Error('Failed to update PO');

      await Swal.fire('Success', 'Purchase Order updated successfully', 'success');
      setShowEditModal(false);
      fetchPOs();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update PO', 'error');
    }
  };

  const handleDeletePO = async (poId) => {
    const result = await Swal.fire({
      title: 'Delete PO?',
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
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete PO');

      await Swal.fire('Success', 'Purchase Order deleted successfully', 'success');
      fetchPOs();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete PO', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Purchase Orders" subtitle="Create and manage vendor purchase orders from quotations">
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
            >
              + Create PO from Quote
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              ⬇ Export Report
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading purchase orders...</p>
        ) : pos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No purchase orders yet</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              + Create PO from Quote
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                  <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-4 py-3 text-left font-semibold">Total Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Expected Delivery</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={`po-${po.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">{po.po_number || `PO-${String(po.id).padStart(4, '0')}`}</td>
                    <td className="px-4 py-4 text-slate-600">{po.vendor_name}</td>
                    <td className="px-4 py-4 text-slate-900 text-xs">{formatCurrency(po.total_amount)}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(po.expected_delivery_date)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${poStatusColors[po.status]?.badge}`}>
                        {poStatusColors[po.status]?.label || po.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{po.items_count || 0} items</td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button onClick={() => handleViewPO(po.id)} className="px-3 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">👁 View</button>
                      <button onClick={() => handleEditPO(po.id)} className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium">✎ Edit</button>
                      <button onClick={() => handleDeletePO(po.id)} className="px-3 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium">🗑</button>
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
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total POs</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total_pos || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pending_pos || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Approved</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.approved_pos || 0}</p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p className="text-xs text-cyan-600 font-semibold uppercase tracking-wider mb-1">Delivered</p>
            <p className="text-2xl font-bold text-cyan-900">{stats.delivered_pos || 0}</p>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg text-slate-900 text-xs">Create Purchase Order from Quotation</h3>
              <button onClick={() => {
                setShowCreateModal(false);
                setPoItems([]);
              }} className="text-slate-500 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Approved Quotation *</label>
                <select
                  value={formData.quotationId}
                  onChange={(e) => handleQuotationChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select a Quotation --</option>
                  {quotations.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quote_number} - {formatCurrency(q.total_amount)} - {q.vendor_name || 'Vendor'} ({q.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PO Number *</label>
                <div className="flex gap-2">
                  <select
                    value={isManualPo ? 'MANUAL' : formData.poNumber}
                    onChange={(e) => {
                      if (e.target.value === 'MANUAL') {
                        setIsManualPo(true);
                        setFormData({...formData, poNumber: ''});
                      } else {
                        setIsManualPo(false);
                        setFormData({...formData, poNumber: e.target.value});
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                    disabled={!formData.quotationId}
                  >
                    {!formData.quotationId ? (
                      <option value="">-- Select Quotation First --</option>
                    ) : (
                      <>
                        <option value="">-- Select PO Number --</option>
                        {poSuggestions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </>
                    )}
                    <option value="MANUAL">Enter Manually...</option>
                  </select>
                  {isManualPo && (
                    <input
                      type="text"
                      value={formData.poNumber}
                      onChange={(e) => setFormData({...formData, poNumber: e.target.value})}
                      placeholder="Enter PO Number"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery Date *</label>
                <input
                  type="date"
                  value={formData.expectedDeliveryDate}
                  onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {poItems.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Quotation Items Preview</label>
                  <div className="overflow-x-auto border border-slate-100 rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Description</th>
                          <th className="px-3 py-2 text-left font-semibold">Material</th>
                          <th className="px-3 py-2 text-right font-semibold">Qty</th>
                          <th className="px-3 py-2 text-center font-semibold">Unit</th>
                          <th className="px-3 py-2 text-right font-semibold">Rate</th>
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poItems.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-900">{item.description}</p>
                              {item.item_code && <p className="text-[10px] text-slate-500">{item.item_code}</p>}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              <p>{item.material_name || '—'}</p>
                              {item.material_type && <p className="text-[10px] opacity-70">{item.material_type}</p>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{item.unit || 'NOS'}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(item.unit_rate)}</td>
                            <td className="px-3 py-2 text-right text-slate-900 text-xs">{formatCurrency(item.total_amount || (item.quantity * item.unit_rate))}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                          <td colSpan="4" className="px-3 py-2 text-right text-slate-700">Total Amount</td>
                          <td className="px-3 py-2 text-right text-emerald-600">
                            {formatCurrency(poItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || (item.quantity * item.unit_rate)), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any special instructions or notes"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
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
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 font-semibold"
                >
                  Create PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg text-slate-900 text-xs">Purchase Order Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">PO Number</p>
                <p className="text-lg text-slate-900">{selectedPO.po_number}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Vendor</p>
                <p className="text-lg text-slate-900">{selectedPO.vendor_name}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Amount</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedPO.total_amount)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${poStatusColors[selectedPO.status]?.badge}`}>
                  {poStatusColors[selectedPO.status]?.label || selectedPO.status}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Expected Delivery</p>
                <p className="text-lg text-slate-900">{formatDate(selectedPO.expected_delivery_date)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Created</p>
                <p className="text-lg text-slate-900">{formatDate(selectedPO.created_at)}</p>
              </div>
            </div>

            {selectedPO.notes && (
              <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded">
                <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-2">Notes</p>
                <p className="text-slate-700">{selectedPO.notes}</p>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-sm text-slate-900 text-xs mb-3">Order Items ({poItems.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Item Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-left font-semibold">Material</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="px-3 py-2 text-center font-semibold">Unit</th>
                      <th className="px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{item.item_code || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{item.description || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.material_name ? (
                            <div>
                              <p className="font-medium">{item.material_name}</p>
                              {item.material_type && <p className="text-[10px] opacity-70">{item.material_type}</p>}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{item.quantity}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{item.unit}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(item.unit_rate)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">{formatCurrency(item.amount)}</td>
                        <td className="px-3 py-2 text-right text-slate-900 text-xs">{formatCurrency(item.total_amount || (parseFloat(item.amount) + parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-slate-900 text-xs">Edit Purchase Order</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleUpdatePO} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-600 w-24">PO Number:</span>
                  <input
                    type="text"
                    value={selectedPO.po_number}
                    onChange={(e) => setSelectedPO({...selectedPO, po_number: e.target.value})}
                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-blue-600 font-mono font-bold"
                  />
                </div>
                <p className="text-slate-600"><span className="font-medium w-24 inline-block">Vendor:</span> {selectedPO.vendor_name}</p>
                <p className="text-slate-600"><span className="font-medium w-24 inline-block">Amount:</span> {formatCurrency(selectedPO.total_amount)}</p>
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
                  <option value="ORDERED">Ordered</option>
                  <option value="SENT">Sent</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="RECEIVED">Received</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={editFormData.expectedDeliveryDate}
                  onChange={(e) => setEditFormData({...editFormData, expectedDeliveryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  placeholder="Add notes about this order"
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
                  Update PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
