import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const statusColors = {
  CREATED: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Created' },
  DESIGN_IN_REVIEW: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Design Review' },
  DESIGN_APPROVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Design Approved' },
  DESIGN_QUERY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'Design Query' },
  PROCUREMENT_IN_PROGRESS: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', label: 'Procurement Active' },
  MATERIAL_PURCHASE_IN_PROGRESS: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', label: 'Material Purchase' },
  MATERIAL_READY: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Material Ready' },
  IN_PRODUCTION: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', label: 'In Production' },
  PRODUCTION_COMPLETED: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-600', label: 'Production Done' },
};

const priorityColors = {
  LOW: 'text-slate-500',
  NORMAL: 'text-slate-600',
  HIGH: 'text-red-600 font-bold',
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  const validCurrency = currency && ['USD', 'EUR', 'INR', 'GBP'].includes(currency.toUpperCase()) ? currency.toUpperCase() : 'INR';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: validCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatOrderCode = (id) => {
  return `SO-${String(id).padStart(4, '0')}`;
};

const IncomingOrders = ({ userDepartment = 'DESIGN_ENG', onOrderAction = null, loading = false, apiRequest = null }) => {
  const [orders, setOrders] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [isLoading, setIsLoading] = useState(loading);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('authToken');
        const url = `${API_BASE}/sales-orders/incoming?department=${userDepartment}`;
        console.log('[IncomingOrders] Fetching:', url, 'with token:', token?.substring(0, 20) + '...');
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('[IncomingOrders] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch orders: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('[IncomingOrders] Received orders - raw data:', data, 'is array:', Array.isArray(data), 'type:', typeof data);
        
        let ordersArray = [];
        if (Array.isArray(data)) {
          ordersArray = data;
        } else if (data && typeof data === 'object' && data.data && Array.isArray(data.data)) {
          ordersArray = data.data;
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          ordersArray = [data];
        }
        console.log('[IncomingOrders] Processing to:', ordersArray.length, 'orders');
        setOrders(ordersArray);
      } catch (error) {
        console.error('Error fetching incoming orders:', error);
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (userDepartment) {
      console.log('[IncomingOrders] userDepartment:', userDepartment);
      fetchOrders();
    }
  }, [userDepartment]);

  const handleAccept = async (orderId) => {
    try {
      setActionLoading(orderId);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ departmentCode: userDepartment }),
      });
      if (!response.ok) throw new Error('Failed to accept order');
      
      if (onOrderAction) onOrderAction({ orderId, action: 'accept' });
      
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (orderId) => {
    if (!confirm('Reject this order? It will be sent back to Sales.')) return;
    
    try {
      setActionLoading(orderId);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      if (!response.ok) throw new Error('Failed to reject order');
      
      if (onOrderAction) onOrderAction({ orderId, action: 'reject' });
      
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order');
    } finally {
      setActionLoading(null);
    }
  };

  const hasOrders = orders.length > 0;
  const statusConfig = statusColors[orders[0]?.status] || statusColors.CREATED;

  return (
    <Card
      id="incoming-orders"
      title="Incoming Sales Orders"
      subtitle={`${userDepartment.replace(/_/g, ' ')} Department`}
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading orders...</p>
          </div>
        </div>
      )}

      {!isLoading && hasOrders ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => {
              const currentStatus = statusColors[order.status] || statusColors.CREATED;
              const isProcessing = actionLoading === order.id;

              return (
                <div
                  key={`order-${order.id}`}
                  className="border border-slate-200 rounded-[16px] p-5 hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{formatOrderCode(order.id)}</p>
                      <p className="text-xs text-slate-500">PO: {order.po_number || '—'}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${currentStatus.bg} ${currentStatus.border} ${currentStatus.text}`}
                    >
                      {currentStatus.label}
                    </span>
                  </div>

                  <div className="space-y-2 py-3 border-y border-slate-100">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-slate-500 font-medium">Customer</span>
                      <span className="text-sm font-semibold text-slate-900 text-right">{order.company_name}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-slate-500 font-medium">Project</span>
                      <span className="text-sm text-slate-700 text-right">{order.project_name || '—'}</span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs text-slate-500 font-medium">Priority</span>
                      <span className={`text-sm font-semibold ${priorityColors[order.production_priority]}`}>
                        {order.production_priority || 'NORMAL'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">PO Date:</span>
                      <span className="text-slate-700 font-medium">{formatDate(order.po_date)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Dispatch Target:</span>
                      <span className="text-slate-700 font-medium">{formatDate(order.target_dispatch_date)}</span>
                    </div>
                    {order.po_net_total && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Value:</span>
                        <span className="text-slate-900 font-semibold">
                          {formatCurrency(order.po_net_total, order.po_currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAccept(order.id)}
                      className="flex-1 px-3 py-2 rounded-[8px] bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isProcessing ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReject(order.id)}
                      className="flex-1 px-3 py-2 rounded-[8px] border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isProcessing ? 'Processing...' : 'Reject'}
                    </button>
                  </div>

                  {order.pdf_path && (
                    <a
                      href={`/uploads/${order.pdf_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center px-3 py-2 rounded-[8px] border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      View PO PDF
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !isLoading && (
          <div className="py-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">No Incoming Orders</p>
              <p className="text-sm text-slate-500">All caught up! Check back later for new orders.</p>
            </div>
          </div>
        )
      )}
    </Card>
  );
};

export default IncomingOrders;
