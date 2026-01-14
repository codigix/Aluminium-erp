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

  // Item Edit State
  const [editingItem, setEditingItem] = useState(null);
  const [editItemData, setEditItemData] = useState({
    drawing_no: '',
    revision_no: '',
    drawing_pdf: null
  });
  const [itemSaveLoading, setItemSaveLoading] = useState(false);

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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Design Engineering</h1>
          <p className="text-sm text-slate-500">Manage design workflow from incoming orders to technical approval</p>
        </div>
        <button 
          onClick={() => { fetchOrders(); fetchIncomingOrders(); }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Incoming Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          Incoming Design Requests
          {incomingOrders.length > 0 && (
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
              {incomingOrders.length}
            </span>
          )}
        </h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">PO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer / Project</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SO Ref</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Date</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {incomingLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">Checking for new requests...</td>
                  </tr>
                ) : incomingOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic">No new design requests at the moment</td>
                  </tr>
                ) : (
                  incomingOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{order.po_number || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{order.company_name}</div>
                        <div className="text-xs text-slate-500">{order.project_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">SO-{String(order.id).padStart(4, '0')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {order.target_dispatch_date ? new Date(order.target_dispatch_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleAcceptOrder(order.id)}
                          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Accept & Start
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <hr className="my-8 border-slate-200" />

      {/* Active Section */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Design Tasks in Progress</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Design Order No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">PO / Sales Order</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500">Loading design orders...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500">No active design orders found</td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{order.design_order_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">PO: {order.po_number}</div>
                        <div className="text-xs text-slate-500">SO-{String(order.sales_order_id).padStart(4, '0')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{order.company_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{order.project_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{order.total_quantity || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {order.target_dispatch_date ? new Date(order.target_dispatch_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2 py-1 border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${getStatusColor(order.status)}`}
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="IN_DESIGN">IN_DESIGN</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button 
                          onClick={() => handleViewDetails(order)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold"
                          title="Open Details"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleDelete(order.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-900 opacity-75" onClick={() => setShowDetails(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:min-h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Technical Details: PO {selectedOrder?.po_number} (SO-{String(selectedOrder?.sales_order_id).padStart(4, '0')})
                    </h3>
                    <p className="text-sm text-slate-500">{selectedOrder?.company_name} - {selectedOrder?.project_name}</p>
                  </div>
                  <button 
                    onClick={() => setShowDetails(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4">
                  {detailsLoading ? (
                    <div className="py-20 text-center text-slate-500 italic">Loading technical details...</div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Code</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Drawing No</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rev</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Drawing PDF</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {orderDetails.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.item_code}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {editingItem?.id === item.id ? (
                                  <input 
                                    type="text" 
                                    className="w-32 px-2 py-1 border rounded text-sm"
                                    value={editItemData.drawing_no}
                                    onChange={(e) => setEditItemData({...editItemData, drawing_no: e.target.value})}
                                  />
                                ) : (
                                  <span className="font-bold text-slate-900">{item.drawing_no || '—'}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {editingItem?.id === item.id ? (
                                  <input 
                                    type="text" 
                                    className="w-16 px-2 py-1 border rounded text-sm"
                                    value={editItemData.revision_no}
                                    onChange={(e) => setEditItemData({...editItemData, revision_no: e.target.value})}
                                  />
                                ) : (
                                  <span className="text-slate-600">{item.revision_no || '—'}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">{item.description}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{parseFloat(item.quantity).toFixed(3)} {item.unit}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                {editingItem?.id === item.id ? (
                                  <div className="flex flex-col gap-2">
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
                                        className="text-emerald-600 font-bold hover:text-emerald-800 disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                      <button 
                                        onClick={() => setEditingItem(null)}
                                        className="text-slate-400 font-medium hover:text-slate-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-3">
                                    {item.drawing_pdf ? (
                                      <button 
                                        onClick={() => window.open(`${API_BASE.replace('/api', '')}/${item.drawing_pdf}`, '_blank')}
                                        className="text-indigo-600 hover:text-indigo-900 font-bold"
                                      >
                                        View PDF
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 italic">No PDF</span>
                                    )}
                                    <button 
                                      onClick={() => handleEditItem(item)}
                                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                                      title="Edit Drawing Info"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-all"
                  onClick={() => setShowDetails(false)}
                >
                  Close
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
