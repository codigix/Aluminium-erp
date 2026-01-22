import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      // Fetch from design-orders to sync with DesignOrders.jsx Active section
      const response = await fetch(`${API_BASE}/design-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch design orders');
      const data = await response.json();
      
      // Filter out completed ones if needed, or show all that need BOM
      // Based on App workflow, BOM is created while in design phase
      const activeOrders = data.filter(order => order.status !== 'COMPLETED');
      
      // Group by PO Number + Company to prevent cross-customer grouping
      const grouped = activeOrders.reduce((acc, order) => {
        const poKey = order.po_number || 'N/A';
        const companyKey = order.company_name || 'Unknown';
        const key = `${companyKey}_${poKey}`;
        
        if (!acc[key]) {
          acc[key] = {
            id: key, 
            po_number: poKey,
            company_name: companyKey,
            project_name: order.project_name,
            orderIds: [order.sales_order_id],
            statuses: [order.status]
          };
        } else {
          if (!acc[key].orderIds.includes(order.sales_order_id)) {
            acc[key].orderIds.push(order.sales_order_id);
          }
          if (!acc[key].statuses.includes(order.status)) {
            acc[key].statuses.push(order.status);
          }
        }
        return acc;
      }, {});

      setOrders(Object.values(grouped));
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSelectOrder = async (group) => {
    try {
      setSelectedOrder(group);
      const token = localStorage.getItem('authToken');
      
      const allItems = [];
      for (const orderId of group.orderIds) {
        const response = await fetch(`${API_BASE}/sales-orders/${orderId}/timeline`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter out rejected items from BOM creation list
          const activeItems = (data || []).filter(item => item.status !== 'REJECTED');
          allItems.push(...activeItems);
        }
      }
      setOrderItems(allItems);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to load order items', 'error');
    }
  };

  useEffect(() => {
    const handleFocus = () => {
      if (selectedOrder) {
        handleSelectOrder(selectedOrder);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedOrder]);

  const handleDeleteItem = async (itemId, itemCode) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Item?',
        text: `Are you sure you want to delete item ${itemCode}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      });

      if (!result.isConfirmed) return;

      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${API_BASE}/sales-orders-timeline/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      Swal.fire('Deleted!', 'Item has been deleted successfully', 'success');
      setOrderItems(orderItems.filter(item => item.id !== itemId));
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFinalBOM = async () => {
    try {
      const incompleteItems = orderItems.filter(item => !item.has_bom);
      if (incompleteItems.length > 0) {
        const confirm = await Swal.fire({
          title: 'Incomplete BOMs',
          text: `There are ${incompleteItems.length} items without a defined BOM. Do you still want to submit?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, Submit anyway',
          cancelButtonText: 'No, let me finish'
        });
        if (!confirm.isConfirmed) return;
      } else {
        const confirm = await Swal.fire({
          title: 'Submit Final BOM?',
          text: 'This will finalize the Bill of Materials for this entire PO and move all associated orders to the next stage.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, Submit All',
        });
        if (!confirm.isConfirmed) return;
      }

      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${API_BASE}/sales-orders/bulk/update-status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          orderIds: selectedOrder.orderIds,
          status: 'BOM_SUBMITTED' 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit bulk BOMs');
      }
      
      await Swal.fire('Success', 'BOMs for this PO have been submitted successfully', 'success');
      setSelectedOrder(null);
      setOrderItems([]);
      fetchOrders();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            BOM Creation
          </h1>
          <p className="text-xs text-slate-500 ml-11">Define comprehensive Bill of Materials for production</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchOrders} 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Orders Sidebar */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <h2 className="text-sm  text-slate-700  tracking-wider">Active Design Orders</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[calc(100vh-250px)] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No orders in design phase</div>
              ) : (
                orders.map((order) => (
                  <div 
                    key={order.id} 
                    className={`p-4 cursor-pointer transition-all hover:bg-white border-l-4 ${selectedOrder?.id === order.id ? 'bg-white border-indigo-600 shadow-inner' : 'border-transparent'}`}
                    onClick={() => handleSelectOrder(order)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs text-slate-900">PO: {order.po_number || 'N/A'}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-sm  text-slate-700 truncate">{order.company_name}</div>
                    <div className="text-[11px] text-slate-500 mt-1">SO-{String(order.id).padStart(4, '0')} | {order.project_name}</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Items Main View */}
        <div className="lg:col-span-3">
          {!selectedOrder ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center text-slate-400 flex flex-col items-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </div>
              <p className="font-semibold text-lg text-slate-600">Select an Order</p>
              <p className="text-sm mt-1">Choose an order from the sidebar to start building its BOM</p>
            </div>
          ) : (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-white p-2 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xs text-slate-900">Order Items: {selectedOrder.po_number}</h2>
                  <p className="text-xs text-slate-500">{selectedOrder.company_name} • {selectedOrder.project_name}</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400  tracking-wider font-bold">BOM Coverage</p>
                    <p className="text-xs text-slate-700">
                      {orderItems.filter(i => i.has_bom).length} / {orderItems.length} Drawings
                    </p>
                  </div>
                  <button 
                    onClick={handleSubmitFinalBOM}
                    className="p-2 bg-indigo-600 text-white rounded-md text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                  >
                    Submit Final BOM
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-200 my-3">
                <div className="p-2 border-r border-slate-100">
                  <div className="text-[10px] text-slate-400   mb-1 tracking-wider">Total Drawings</div>
                  <div className="text-xl text-slate-900">{orderItems.length}</div>
                </div>
                <div className="p-2 border-r border-slate-100">
                  <div className="text-[10px] text-slate-400   mb-1 tracking-wider">BOMs Completed</div>
                  <div className="text-xl  text-emerald-600">{orderItems.filter(i => i.has_bom).length}</div>
                </div>
                <div className="p-2 border-r border-slate-100">
                  <div className="text-[10px] text-slate-400   mb-1 tracking-wider">BOMs Pending</div>
                  <div className="text-xl  text-amber-600">{orderItems.filter(i => !i.has_bom).length}</div>
                </div>
                <div className="p-2">
                  <div className="text-[10px] text-slate-400   mb-1 tracking-wider">Total Est. Cost</div>
                  <div className="text-xl  text-indigo-600">₹{orderItems.reduce((sum, item) => sum + (parseFloat(item.bom_cost || 0) * parseFloat(item.quantity || 0)), 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 bg-white">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Independent BOM / Drawing</th>
                      <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Description</th>
                      <th className="p-2 text-left text-xs text-slate-500  tracking-wider">Order Qty</th>
                      <th className="p-2 text-left text-xs text-slate-500  tracking-wider">BOM Status</th>
                      <th className="p-2 text-left text-xs text-slate-500  tracking-wider">Cost / Unit</th>
                      <th className="p-2 text-left text-xs text-slate-500  tracking-wider">Total Cost</th>
                      <th className="p-2 text-right text-[11px]  text-slate-500  tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-slate-900">{item.item_code}</div>
                          </div>
                          <div className="text-xs text-indigo-600 font-medium">DWG: {item.drawing_no || 'N/A'}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs text-slate-600 max-w-sm line-clamp-1">{item.description}</div>
                        </td>
                        <td className="p-2 text-center">
                          <div className="text-xs text-slate-900">{item.quantity}</div>
                          <div className="text-[10px] text-slate-400  ">{item.unit}</div>
                        </td>
                        <td className="p-2 text-center">
                          {item.has_bom ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] ">COMPLETED</span>
                          ) : (
                            <span className="p-2 bg-slate-100 text-slate-500 rounded text-xs">Not Started</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <div className="text-xs text-slate-900">₹{parseFloat(item.bom_cost || 0).toFixed(2)}</div>
                        </td>
                        <td className="p-2 text-center">
                          <div className="text-xs font-bold text-indigo-600">₹{(parseFloat(item.bom_cost || 0) * parseFloat(item.quantity || 0)).toFixed(2)}</div>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Link 
                              to={`/bom-form/${item.id}`}
                              className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 inline-flex items-center justify-center"
                              title="Manage BOM"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </Link>
                            <button 
                              onClick={() => handleDeleteItem(item.id, item.item_code)}
                              className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all border border-rose-100 inline-flex items-center justify-center"
                              title="Delete Item"
                              disabled={loading}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BOMCreation;
