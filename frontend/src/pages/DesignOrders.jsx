import React, { useState, useEffect } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const DesignOrders = () => {
  const [orders, setOrders] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  
  // Details Modal State
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewDetails, setReviewDetails] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Item Edit State
  const [editingItem, setEditingItem] = useState(null);
  const [editItemData, setEditItemData] = useState({
    drawing_no: '',
    revision_no: '',
    drawing_pdf: null
  });
  const [itemSaveLoading, setItemSaveLoading] = useState(false);

  // Bulk Operations State
  const [selectedIncomingOrders, setSelectedIncomingOrders] = useState(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [expandedIncomingPo, setExpandedIncomingPo] = useState({});

  const toggleIncomingPo = (po) => {
    setExpandedIncomingPo(prev => ({ ...prev, [po]: !prev[po] }));
  };

  const groupedIncoming = incomingOrders.reduce((acc, order) => {
    const key = order.po_number || 'NO-PO';
    if (!acc[key]) {
      acc[key] = {
        po_number: key,
        company_name: order.company_name,
        orders: []
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {});

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch design orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingOrders = async () => {
    try {
      setIncomingLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/incoming?department=DESIGN_ENG`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch incoming orders');
      const data = await response.json();
      setIncomingOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIncomingLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchIncomingOrders();
  }, []);

  const handleViewOrder = async (order) => {
    try {
      setReviewLoading(true);
      setReviewOrder(order);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order items');
      const items = await response.json();
      setReviewDetails(items || []);
      setShowReviewModal(true);
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ departmentCode: 'DESIGN_ENG' })
      });

      if (!response.ok) throw new Error('Failed to accept order');
      
      Swal.fire('Success', 'Order accepted and design task created', 'success');
      fetchOrders();
      fetchIncomingOrders();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      Swal.fire('Success', `Design order status updated to ${status}`, 'success');
      fetchOrders();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleApproveDesign = async (orderId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/approve-design`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      
      if (!response.ok) throw new Error('Failed to approve design');
      
      Swal.fire('Success', 'Design approved. Sent to Sales for quotation.', 'success');
      setShowReviewModal(false);
      fetchIncomingOrders();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleRejectDesign = async (orderId) => {
    const result = await Swal.fire({
      title: 'Reject Design',
      input: 'textarea',
      inputLabel: 'Rejection reason',
      inputPlaceholder: 'Enter reason for rejection...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Please enter a reason';
      }
    });
    
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/${orderId}/reject-design`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason: result.value })
        });
        
        if (!response.ok) throw new Error('Failed to reject design');
        
        Swal.fire('Success', 'Design rejected and sent back to sales.', 'success');
        setShowReviewModal(false);
        fetchIncomingOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const toggleSelectOrder = (orderId) => {
    const newSelected = new Set(selectedIncomingOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedIncomingOrders(newSelected);
  };

  const toggleSelectAllOrders = () => {
    if (selectedIncomingOrders.size === incomingOrders.length && incomingOrders.length > 0) {
      setSelectedIncomingOrders(new Set());
    } else {
      setSelectedIncomingOrders(new Set(incomingOrders.map(o => o.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIncomingOrders.size === 0) {
      Swal.fire('Info', 'Please select at least one order to approve', 'info');
      return;
    }

    const result = await Swal.fire({
      title: 'Bulk Approve Designs',
      text: `Are you sure you want to approve ${selectedIncomingOrders.size} design(s) and send them to Sales for quotation?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, approve all'
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/approve-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds: Array.from(selectedIncomingOrders) })
        });

        if (!response.ok) throw new Error('Failed to approve designs');

        Swal.fire('Success', `${selectedIncomingOrders.size} designs approved and sent to Sales department.`, 'success');
        setSelectedIncomingOrders(new Set());
        fetchIncomingOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleBulkReject = async () => {
    if (selectedIncomingOrders.size === 0) {
      Swal.fire('Info', 'Please select at least one order to reject', 'info');
      return;
    }

    const result = await Swal.fire({
      title: 'Bulk Reject Designs',
      input: 'textarea',
      inputLabel: 'Rejection reason (required for all selected orders)',
      inputPlaceholder: 'Enter reason for rejection...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Please enter a reason';
      }
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/reject-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds: Array.from(selectedIncomingOrders), reason: result.value })
        });

        if (!response.ok) throw new Error('Failed to reject designs');

        Swal.fire('Success', `${selectedIncomingOrders.size} designs rejected and sent back to Sales.`, 'success');
        setSelectedIncomingOrders(new Set());
        fetchIncomingOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleViewDetails = async (order) => {
    try {
      setSelectedOrder(order);
      setShowDetails(true);
      setDetailsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.sales_order_id}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setOrderDetails(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load order details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItemData({
      drawing_no: item.drawing_no || '',
      revision_no: item.revision_no || '0',
      drawing_pdf: null
    });
  };

  const handleSaveItem = async (itemId) => {
    try {
      setItemSaveLoading(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('drawingNo', editItemData.drawing_no);
      formData.append('revisionNo', editItemData.revision_no);
      if (editItemData.drawing_pdf) {
        formData.append('drawing_pdf', editItemData.drawing_pdf);
      }

      const response = await fetch(`${API_BASE}/drawings/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update item drawing');
      
      Swal.fire('Success', 'Item drawing updated', 'success');
      setEditingItem(null);
      // Refresh details
      handleViewDetails(selectedOrder);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setItemSaveLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/design-orders/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to delete order');
        
        Swal.fire('Deleted!', 'Order has been deleted.', 'success');
        fetchOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'IN_DESIGN': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Design Engineering Hub</h1>
              <p className="text-xs text-slate-600">Review customer drawings and create technical specifications</p>
            </div>
            <button 
              onClick={() => { fetchOrders(); fetchIncomingOrders(); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Refresh
            </button>
          </div>

          {/* INFO BANNER */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs text-blue-900 font-medium">
              Review incoming drawings, accept design requests, and manage technical specifications for all orders.
            </p>
          </div>
        </div>

        {/* INCOMING REQUESTS SECTION */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200 mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 border-b border-blue-700">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  📥 Incoming Design Requests
                </h2>
                <p className="text-blue-100 text-xs">Customer drawings ready for design engineering review</p>
              </div>
              {incomingOrders.length > 0 && (
                <span className="px-3 py-1 bg-white text-blue-600 rounded-full text-xs font-bold">
                  {incomingOrders.length}
                </span>
              )}
            </div>
            {selectedIncomingOrders.size > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-blue-400">
                <span className="text-white text-xs font-semibold">
                  {selectedIncomingOrders.size} selected
                </span>
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  Bulk Approve
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  Bulk Reject
                </button>
              </div>
            )}
          </div>
        
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIncomingOrders.size === incomingOrders.length && incomingOrders.length > 0}
                      onChange={toggleSelectAllOrders}
                      className="w-4 h-4 rounded"
                      disabled={incomingOrders.length === 0}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Client Name</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Drawing No</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Description</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {incomingLoading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-600 font-semibold">Checking for new requests...</span>
                      </div>
                    </td>
                  </tr>
                ) : incomingOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <p className="text-xs text-slate-500 font-semibold">No incoming design requests</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedIncoming).map(([poNumber, group]) => {
                    const isExpanded = expandedIncomingPo[poNumber];
                    const allSelected = group.orders.every(o => selectedIncomingOrders.has(o.id));
                    const someSelected = group.orders.some(o => selectedIncomingOrders.has(o.id));

                    return (
                      <React.Fragment key={poNumber}>
                        {/* Group Header */}
                        <tr 
                          className={`bg-slate-50/80 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-all ${isExpanded ? 'sticky top-0 z-10' : ''}`} 
                          onClick={() => toggleIncomingPo(poNumber)}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newSelected = new Set(selectedIncomingOrders);
                                group.orders.forEach(o => {
                                  if (e.target.checked) newSelected.add(o.id);
                                  else newSelected.delete(o.id);
                                });
                                setSelectedIncomingOrders(newSelected);
                              }}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-xs">{group.company_name}</span>
                              <span className="text-[10px] text-slate-500 font-medium">PO: {poNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[10px]">
                                {group.orders.length} Drawings
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 text-[10px]">Multiple Drawings Review</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-slate-400 text-[10px]">Total: {group.orders.reduce((sum, o) => sum + (Number(o.item_qty) || 1), 0)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 toggleIncomingPo(poNumber);
                               }}
                               className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-50 transition-colors"
                             >
                               {isExpanded ? 'Hide' : 'Show'}
                             </button>
                          </td>
                        </tr>
                        {/* Group Items */}
                        {isExpanded && group.orders.map((order) => (
                          <tr key={order.id} className={`transition-colors text-[11px] border-b border-slate-50 bg-white/50 ${selectedIncomingOrders.has(order.id) ? 'bg-blue-50' : 'hover:bg-blue-50/20'}`}>
                            <td className="px-4 py-2.5 pl-8">
                              <input
                                type="checkbox"
                                checked={selectedIncomingOrders.has(order.id)}
                                onChange={() => toggleSelectOrder(order.id)}
                                className="w-3.5 h-3.5 rounded"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{group.company_name}</td>
                            <td className="px-4 py-2.5 font-bold text-indigo-600">{order.drawing_no || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600 italic">
                              {order.item_description || 'No description'}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                              {order.item_qty || 1}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-right flex gap-2 justify-end">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleViewOrder(order); }}
                                className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 transition-colors"
                                title="View details"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAcceptOrder(order.id); }}
                                className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                Accept
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTIVE DESIGN TASKS SECTION */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 border-b border-purple-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  🎨 Design Tasks in Progress
                </h2>
                <p className="text-purple-100 text-xs">Manage active design orders and technical specifications</p>
              </div>
              {orders.length > 0 && (
                <span className="px-3 py-1 bg-white text-purple-600 rounded-full text-xs font-bold">
                  {orders.length}
                </span>
              )}
            </div>
          </div>
        
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Design Order</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">PO / Sales Order</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Customer</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Project</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Target Date</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-600 font-semibold">Loading design orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v12m6-6H6"/></svg>
                        <p className="text-xs text-slate-500 font-semibold">No active design tasks</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-purple-50/30 transition-colors text-xs">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">{order.design_order_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs">PO: {order.po_number}</div>
                        <div className="text-slate-500">SO-{String(order.sales_order_id).padStart(4, '0')}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{order.company_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{order.project_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center font-semibold text-indigo-600">{order.total_quantity || 0}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {order.target_dispatch_date ? new Date(order.target_dispatch_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`text-xs font-semibold rounded px-2 py-1 border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors ${getStatusColor(order.status)}`}
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="IN_DESIGN">IN_DESIGN</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={() => handleViewDetails(order)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(order.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-all"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDetails(false)}></div>
            <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden transform transition-all">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 border-b border-purple-700">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      Technical Details: PO {selectedOrder?.po_number}
                    </h3>
                    <p className="text-sm text-purple-100">
                      SO-{String(selectedOrder?.sales_order_id).padStart(4, '0')} | {selectedOrder?.company_name} - {selectedOrder?.project_name}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetails(false)}
                    className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {detailsLoading ? (
                  <div className="py-12 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-slate-600 font-semibold text-xs">Loading technical details...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Item Code</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Drawing No</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Rev</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Description</th>
                          <th className="px-4 py-2 text-center text-xs font-bold text-slate-600 uppercase">Qty</th>
                          <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase">PDF / Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {orderDetails.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-xs">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{item.item_code}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editingItem?.id === item.id ? (
                                <input 
                                  type="text" 
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-xs"
                                  value={editItemData.drawing_no}
                                  onChange={(e) => setEditItemData({...editItemData, drawing_no: e.target.value})}
                                />
                              ) : (
                                <span className="font-bold text-slate-900">{item.drawing_no || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editingItem?.id === item.id ? (
                                <input 
                                  type="text" 
                                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                                  value={editItemData.revision_no}
                                  onChange={(e) => setEditItemData({...editItemData, revision_no: e.target.value})}
                                />
                              ) : (
                                <span className="text-slate-600">{item.revision_no || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{item.description}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center font-semibold text-indigo-600">{parseFloat(item.quantity).toFixed(3)} {item.unit}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {editingItem?.id === item.id ? (
                                <div className="flex flex-col gap-2 items-end">
                                  <input 
                                    type="file" 
                                    accept=".pdf"
                                    className="text-xs"
                                    onChange={(e) => setEditItemData({...editItemData, drawing_pdf: e.target.files[0]})}
                                  />
                                  <div className="space-x-2">
                                    <button 
                                      onClick={() => handleSaveItem(item.id)}
                                      disabled={itemSaveLoading}
                                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingItem(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-300 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  {item.drawing_pdf ? (
                                    <button 
                                      onClick={() => window.open(`${API_BASE.replace('/api', '')}/${item.drawing_pdf}`, '_blank')}
                                      className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                                      title="View PDF"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                  <button 
                                    onClick={() => handleEditItem(item)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                                    title="Edit Drawing Info"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-2border-t border-slate-200 flex justify-end">
                <button 
                  type="button" 
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && reviewOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 sticky top-0">
              <h2 className="text-lg font-bold text-white">Design Review - {reviewOrder.company_name}</h2>
              <p className="text-indigo-100 text-xs mt-1">Order: {reviewOrder.project_name}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Customer</label>
                  <p className="text-sm font-semibold text-slate-900 text-xs mt-1">{reviewOrder.company_name}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">PO Number</label>
                  <p className="text-sm font-semibold text-slate-900 text-xs mt-1">{reviewOrder.po_number || '—'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Project</label>
                  <p className="text-sm font-semibold text-slate-900 text-xs mt-1">{reviewOrder.project_name}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Sales Order</label>
                  <p className="text-sm font-semibold text-slate-900 text-xs mt-1">SO-{String(reviewOrder.id).padStart(4, '0')}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-xs font-bold text-slate-600 uppercase block mb-3">Drawing Details</label>
                {reviewLoading ? (
                  <div className="text-center py-4">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : reviewDetails.length > 0 ? (
                  <div className="space-y-3">
                    {reviewDetails.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-slate-500">Drawing No</span>
                            <p className="font-semibold text-slate-900 text-xs">{item.drawing_no || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Revision</span>
                            <p className="font-semibold text-slate-900 text-xs">{item.revision_no || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Quantity</span>
                            <p className="font-semibold text-slate-900 text-xs">{item.quantity || 1} {item.unit || 'NOS'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{item.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No drawing details available</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-between gap-3">
              <button 
                onClick={() => handleRejectDesign(reviewOrder.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                ✗ Reject & Return
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg text-xs font-semibold hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleApproveDesign(reviewOrder.id)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  ✓ Approve & Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignOrders;
