import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_HOST = API_BASE.replace(/\/api$/, '');

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
  HIGH: 'text-red-600 ',
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatOrderCode = (id) => {
  return `SO-${String(id).padStart(4, '0')}`;
};

const SalesOrderRow = ({ order, onAction, actionLoading }) => {
  const currentStatus = statusColors[order.status] || statusColors.CREATED;
  const isProcessing = actionLoading === order.id;
  const rejectedItems = (order.items || []).filter(item => item.status === 'REJECTED');

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
        <td className="px-5 py-4 text-slate-900 whitespace-nowrap">
          {formatOrderCode(order.id)}
          {rejectedItems.length > 0 && (
            <div className="mt-1">
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[8px] font-bold uppercase">
                {rejectedItems.length} Item(s) Rejected
              </span>
            </div>
          )}
        </td>
        <td className="px-5 py-4">
          <p className="text-slate-900 text-xs">{order.company_name}</p>
          <p className="text-xs text-slate-400">{order.project_name || '—'}</p>
        </td>
        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{order.po_number || '—'}</td>
        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{formatDate(order.target_dispatch_date)}</td>
        <td className="px-5 py-4">
          <span className={`text-[10px]  ${priorityColors[order.production_priority]}`}>
            {order.production_priority || 'NORMAL'}
          </span>
        </td>
        <td className="px-5 py-4">
          <span className={`px-2 py-1 rounded-full text-[10px]  border ${currentStatus.bg} ${currentStatus.border} ${currentStatus.text}  whitespace-nowrap`}>
            {currentStatus.label}
          </span>
          {order.status === 'DESIGN_QUERY' && order.rejection_reason && (
            <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-700 leading-relaxed max-w-[200px]">
              <span className="font-bold">Rejection Reason:</span> {order.rejection_reason}
            </div>
          )}
        </td>
        <td className="px-5 py-4 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => window.open(`${API_BASE}/sales-orders/${order.id}/pdf`, '_blank')}
              className="px-3 py-1.5 border border-indigo-200 text-indigo-600 text-xs  rounded-lg hover:bg-indigo-50 transition-all"
            >
              View PDF
            </button>
            <button
              onClick={() => onAction(order.id, 'accept')}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs  rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isProcessing ? '...' : 'Accept'}
            </button>
            <button
              onClick={() => onAction(order.id, 'reject')}
              disabled={isProcessing}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs  rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </td>
      </tr>
    </>
  );
};

const IncomingOrders = ({ userDepartment = 'DESIGN_ENG' }) => {
  const [orders, setOrders] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const url = `${API_BASE}/sales-orders/incoming?department=${userDepartment}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      
      // Group flat rows by order ID
      const grouped = (Array.isArray(data) ? data : []).reduce((acc, row) => {
        if (!acc[row.id]) {
          acc[row.id] = { ...row, items: [] };
        }
        if (row.item_id) {
          acc[row.id].items.push({
            id: row.item_id,
            item_code: row.item_code,
            drawing_no: row.drawing_no,
            description: row.item_description,
            quantity: row.item_qty,
            unit: row.item_unit,
            status: row.item_status
          });
        }
        return acc;
      }, {});
      
      setOrders(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching incoming orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [userDepartment]);

  useEffect(() => {
    if (userDepartment) fetchOrders();
  }, [userDepartment, fetchOrders]);

  const handleAction = async (orderId, type) => {
    if (type === 'reject' && !confirm('Reject this order?')) return;
    try {
      setActionLoading(orderId);
      const token = localStorage.getItem('authToken');
      const endpoint = type === 'accept' ? 'accept' : 'reject';
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ departmentCode: userDepartment }),
      });
      if (response.ok) {
        setOrders(orders.filter(o => o.id !== orderId));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card id="incoming-orders" title="Incoming Orders" subtitle="Accept or reject incoming sales orders from upstream departments">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-500  tracking-[0.2em] text-[0.65rem]">
              <tr>
                <th className="px-5 py-4 text-left ">SO Code</th>
                <th className="px-5 py-4 text-left ">Customer / Project</th>
                <th className="px-5 py-4 text-left ">PO Number</th>
                <th className="px-5 py-4 text-left ">Dispatch Target</th>
                <th className="px-5 py-4 text-left ">Priority</th>
                <th className="px-5 py-4 text-left ">Status</th>
                <th className="px-5 py-4 text-right ">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => (
                <SalesOrderRow 
                  key={order.id} 
                  order={order} 
                  onAction={handleAction}
                  actionLoading={actionLoading}
                />
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-20 text-center text-slate-400 italic bg-white">
                    No incoming orders in your queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default IncomingOrders;
