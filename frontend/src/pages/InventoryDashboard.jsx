import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const InventoryDashboard = () => {
  const [stats, setStats] = useState({
    incomingPos: [],
    pendingGRNs: [],
    lowStockItems: [],
    materialRequests: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const [incomingRes, grnRes, stockRes, mrRes] = await Promise.all([
        fetch(`${API_BASE}/inventory/incoming-orders`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/inventory/pending-grns`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/inventory/low-stock`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/purchase-orders/material-requests`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      const incomingData = incomingRes.ok ? await incomingRes.json() : [];
      const grnData = grnRes.ok ? await grnRes.json() : [];
      const stockData = stockRes.ok ? await stockRes.json() : [];
      const mrData = mrRes.ok ? await mrRes.json() : [];

      setStats({
        incomingPos: Array.isArray(incomingData) ? incomingData : [],
        pendingGRNs: Array.isArray(grnData) ? grnData : [],
        lowStockItems: Array.isArray(stockData) ? stockData : [],
        materialRequests: Array.isArray(mrData) ? mrData : []
      });
    } catch (error) {
      console.error('Error fetching inventory dashboard:', error);
      setStats({
        incomingPos: [],
        pendingGRNs: [],
        lowStockItems: [],
        materialRequests: []
      });
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, count, color, icon }) => (
    <div className={`${color} rounded-lg p-4 border border-slate-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{count}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Incoming Orders" 
          count={stats.incomingPos.length} 
          color="bg-blue-50"
          icon="📊"
        />
        <StatCard 
          title="Material Requests" 
          count={stats.materialRequests.length} 
          color="bg-emerald-50"
          icon="📝"
        />
        <StatCard 
          title="Pending GRNs" 
          count={stats.pendingGRNs.length} 
          color="bg-amber-50"
          icon="📋"
        />
        <StatCard 
          title="Low Stock Items" 
          count={stats.lowStockItems.length} 
          color="bg-orange-50"
          icon="⚠️"
        />
      </div>

      <Card title="Incoming Orders" subtitle="Active orders in production pipeline">
        {stats.incomingPos.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No incoming orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Order Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Project</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Target Dispatch</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.incomingPos.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{order.order_code}</td>
                    <td className="px-4 py-4 text-slate-600">{order.company_name}</td>
                    <td className="px-4 py-4 text-slate-600 text-xs max-w-xs truncate">{order.project_name || '—'}</td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      ₹{parseFloat(order.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {order.target_dispatch_date ? new Date(order.target_dispatch_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Material Requests" subtitle="Recent purchase requests from production/inventory">
        {stats.materialRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No pending material requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Request No</th>
                  <th className="px-4 py-3 text-left font-semibold">Material</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold">Req. Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.materialRequests.slice(0, 5).map((req) => (
                  <tr key={req.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{req.request_no}</td>
                    <td className="px-4 py-4 text-slate-600">{req.material_name}</td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {req.quantity} {req.unit}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {req.required_date ? new Date(req.required_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pending GRNs" subtitle="Goods received awaiting inspection">
        {stats.pendingGRNs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No pending GRNs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">GRN ID</th>
                  <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty Received</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingGRNs.map((grn) => (
                  <tr key={grn.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">GRN-{String(grn.id).padStart(4, '0')}</td>
                    <td className="px-4 py-4 text-slate-600">{grn.po_number}</td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {parseFloat(grn.received_quantity || 0).toFixed(3)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(grn.grn_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        {grn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Low Stock Items" subtitle="Items below reorder level">
        {stats.lowStockItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">All items in stock</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Item Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Current Balance</th>
                  <th className="px-4 py-3 text-left font-semibold">Unit</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockItems.map((item) => (
                  <tr key={item.item_code} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.item_code}</td>
                    <td className="px-4 py-4 text-slate-600 text-xs max-w-xs truncate">{item.item_description}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        {parseFloat(item.current_balance || 0).toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
};

export default InventoryDashboard;
