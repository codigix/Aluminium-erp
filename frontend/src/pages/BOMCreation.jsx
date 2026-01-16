import React, { useState, useEffect } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      const designPhaseOrders = data.filter(order => 
        ['DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'DESIGN_QUERY'].includes(order.status)
      );
      setOrders(designPhaseOrders);
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSelectOrder = async (order) => {
    try {
      setSelectedOrder(order);
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order items');
      const data = await response.json();
      setOrderItems(data);
    } catch (error) {
      Swal.fire('Error', 'Failed to load order items', 'error');
    } finally {
      setItemsLoading(false);
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
          text: 'This will finalize the Bill of Materials for this order and move it to the next stage.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, Submit',
        });
        if (!confirm.isConfirmed) return;
      }

      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: 'BOM_SUBMITTED' })
      });

      if (!response.ok) throw new Error('Failed to submit BOM');
      
      await Swal.fire('Success', 'BOM has been submitted successfully', 'success');
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
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600">📋</span>
            BOM Creation
          </h1>
          <p className="text-sm text-slate-500 ml-10">Define comprehensive Bill of Materials for production</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Orders Sidebar */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Active Design Orders</h2>
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
                      <span className="text-xs font-bold text-slate-900">PO: {order.po_number || 'N/A'}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-sm font-semibold text-slate-700 truncate">{order.company_name}</div>
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
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center text-slate-400 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-2xl">👈</div>
              <p className="font-medium text-lg">Select an order from the sidebar to start building BOM</p>
            </div>
          ) : (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-white p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Order Items: {selectedOrder.po_number}</h2>
                  <p className="text-sm text-slate-500">{selectedOrder.company_name} • {selectedOrder.project_name}</p>
                </div>
                <button 
                  onClick={handleSubmitFinalBOM}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center gap-2"
                >
                  <span>Submit Final BOM</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item Details</th>
                      <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">BOM Status</th>
                      <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Cost</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{item.item_code}</div>
                          <div className="text-xs text-indigo-600 font-medium">DWG: {item.drawing_no || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600 max-w-sm line-clamp-1">{item.description}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm font-bold text-slate-900">{item.quantity}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.has_bom ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">COMPLETED</span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">NOT STARTED</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm font-bold text-slate-900">₹{parseFloat(item.bom_cost || 0).toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a 
                            href={`/bom-form/${item.id}`}
                            className="inline-block px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                          >
                            Manage BOM
                          </a>
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
