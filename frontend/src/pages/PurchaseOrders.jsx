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
  const [expandedPOs, setExpandedPOs] = useState({});
  const [pos, setPos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const toggleExpandPO = (poId) => {
    setExpandedPOs(prev => ({
      ...prev,
      [poId]: !prev[poId]
    }));
  };

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
    toggleExpandPO(poId);
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
    <div className="space-y-3">
      <Card title="Purchase Orders" subtitle="Create and manage vendor purchase orders from quotations">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-2.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search PO number or vendor..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm  hover:bg-emerald-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create PO
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm  hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
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
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm  hover:bg-slate-800"
            >
              + Create PO from Quote
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left ">PO Number</th>
                  <th className="px-4 py-3 text-left ">Vendor</th>
                  <th className="px-4 py-3 text-left ">Total Amount</th>
                  <th className="px-4 py-3 text-left ">Expected Delivery</th>
                  <th className="px-4 py-3 text-left ">Status</th>
                  <th className="px-4 py-3 text-left ">Items</th>
                  <th className="px-4 py-3 text-right ">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => {
                  const isExpanded = expandedPOs[po.id];
                  return (
                    <React.Fragment key={`po-group-${po.id}`}>
                      <tr 
                        className={`border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                        onClick={() => toggleExpandPO(po.id)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                            <span className="font-medium text-slate-900">{po.po_number || `PO-${String(po.id).padStart(4, '0')}`}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{po.vendor_name}</td>
                        <td className="px-4 py-4 text-slate-900 text-xs font-bold">{formatCurrency(po.total_amount)}</td>
                        <td className="px-4 py-4 text-slate-600 text-xs">{formatDate(po.expected_delivery_date)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border ${poStatusColors[po.status]?.badge}`}>
                            {poStatusColors[po.status]?.label?.toUpperCase() || po.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-xs italic">{po.items_count || 0} items</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleEditPO(po.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 shadow-sm"
                              title="Edit PO"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeletePO(po.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 shadow-sm"
                              title="Delete PO"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" className="px-8 py-4 bg-slate-50/50">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                  <tr>
                                    <th className="px-4 py-2 text-left">Description</th>
                                    <th className="px-4 py-2 text-left">Material</th>
                                    <th className="px-4 py-2 text-center">Qty</th>
                                    <th className="px-4 py-2 text-right">Unit Rate</th>
                                    <th className="px-4 py-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {po.items && po.items.length > 0 ? (
                                    po.items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2">
                                          <p className="font-medium text-slate-900">{item.description}</p>
                                          {item.item_code && <p className="text-[10px] text-slate-400">{item.item_code}</p>}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">{item.material_name || '—'}</td>
                                        <td className="px-4 py-2 text-center font-bold">{item.quantity} {item.unit || 'NOS'}</td>
                                        <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(item.unit_rate)}</td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(item.total_amount || (item.quantity * item.unit_rate))}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="5" className="px-4 py-6 text-center text-slate-400 italic">No items found for this PO</td>
                                    </tr>
                                  )}
                                </tbody>
                                {po.items && po.items.length > 0 && (
                                  <tfoot className="bg-slate-50/50">
                                    <tr>
                                      <td colSpan="4" className="px-4 py-2 text-right font-bold text-slate-500">Total Amount:</td>
                                      <td className="px-4 py-2 text-right font-black text-indigo-600 text-sm">
                                        {formatCurrency(po.total_amount)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600   tracking-wider mb-1">Total POs</p>
            <p className="text-2xl  text-blue-900">{stats.total_pos || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600   tracking-wider mb-1">Pending</p>
            <p className="text-2xl  text-yellow-900">{stats.pending_pos || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600   tracking-wider mb-1">Approved</p>
            <p className="text-2xl  text-emerald-900">{stats.approved_pos || 0}</p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p className="text-xs text-cyan-600   tracking-wider mb-1">Delivered</p>
            <p className="text-2xl  text-cyan-900">{stats.delivered_pos || 0}</p>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-md text-slate-900 text-xs">Create Purchase Order from Quotation</h3>
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
                      <thead className="bg-slate-50 text-slate-600 ">
                        <tr>
                          <th className="px-3 py-2 text-left ">Description</th>
                          <th className="px-3 py-2 text-left ">Material</th>
                          <th className="px-3 py-2 text-right ">Qty</th>
                          <th className="px-3 py-2 text-center ">Unit</th>
                          <th className="px-3 py-2 text-right ">Rate</th>
                          <th className="px-3 py-2 text-right ">Total</th>
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
                        <tr className="bg-slate-50  border-t border-slate-200">
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
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 "
                >
                  Create PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Edit Purchase Order</h3>
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
                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-blue-600 font-mono "
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
