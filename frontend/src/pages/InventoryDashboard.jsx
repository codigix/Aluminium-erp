import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

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
        fetch(`${API_BASE}/inventory/material-requests`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      const incomingData = incomingRes.ok ? await incomingRes.json() : [];
      const grnData = grnRes.ok ? await grnRes.json() : [];
      const stockData = stockRes.ok ? await stockRes.json() : [];
      const filteredStockData = (Array.isArray(stockData) ? stockData : []).filter(item => {
        const type = (item.material_type || item.item_group || '').toUpperCase();
        return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
      });
      const mrData = mrRes.ok ? await mrRes.json() : [];

      setStats({
        incomingPos: Array.isArray(incomingData) ? incomingData : [],
        pendingGRNs: Array.isArray(grnData) ? grnData : [],
        lowStockItems: filteredStockData,
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
    <div className={`${color} rounded-lg p-5 border border-slate-200 transition-all hover:shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500    mb-1">{title}</p>
          <p className="text-xl text-slate-900">{count}</p>
        </div>
        <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center ">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Fetching inventory insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Incoming Orders" 
          count={stats.incomingPos.length} 
          color="bg-indigo-50"
          icon={
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard 
          title="Material Requests" 
          count={stats.materialRequests.length} 
          color="bg-emerald-50"
          icon={
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        />
        <StatCard 
          title="Pending GRNs" 
          count={stats.pendingGRNs.length} 
          color="bg-amber-50"
          icon={
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          title="Low Stock Items" 
          count={stats.lowStockItems.length} 
          color="bg-rose-50"
          icon={
            <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      <Card title="Incoming Orders" subtitle="Active orders in production pipeline">
        {stats.incomingPos.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No incoming orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="p-2 text-left ">Order Code</th>
                  <th className="p-2 text-left ">Customer</th>
                  <th className="p-2 text-left ">Project</th>
                  <th className="px-4 py-3 text-right ">Amount</th>
                  <th className="p-2 text-left ">Target Dispatch</th>
                  <th className="p-2 text-left ">Status</th>
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
                      <span className="px-2 py-1 rounded-full text-xs  bg-blue-100 text-blue-700">
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
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="p-2 text-left ">Request No</th>
                  <th className="p-2 text-left ">Department</th>
                  <th className="p-2 text-left ">Purpose</th>
                  <th className="px-4 py-3 text-right ">Items</th>
                  <th className="p-2 text-left ">Req. Date</th>
                  <th className="p-2 text-left ">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.materialRequests.slice(0, 5).map((req) => (
                  <tr key={req.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href='/po-material-request'}>
                    <td className="px-4 py-4 font-medium text-slate-900">{req.request_no}</td>
                    <td className="px-4 py-4 text-slate-600">{req.department}</td>
                    <td className="px-4 py-4 text-slate-600">{req.purpose}</td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {req.items_count}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {req.required_date ? new Date(req.required_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold  tracking-wider ${
                        req.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 
                        req.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' : 
                        req.status === 'ORDERED' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-orange-100 text-orange-600'
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
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="p-2 text-left ">GRN ID</th>
                  <th className="p-2 text-left ">PO Number</th>
                  <th className="px-4 py-3 text-right ">Qty Received</th>
                  <th className="p-2 text-left ">Date</th>
                  <th className="p-2 text-left ">Status</th>
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
                      <span className="px-2 py-1 rounded-full text-xs  bg-amber-100 text-amber-700">
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
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="p-2 text-left ">Item Code</th>
                  <th className="p-2 text-left ">Description</th>
                  <th className="p-2 text-left ">Warehouse</th>
                  <th className="px-4 py-3 text-right ">Balance</th>
                  <th className="p-2 text-left ">Unit</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockItems.map((item) => (
                  <tr key={`${item.item_code}-${item.warehouse}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.item_code}</td>
                    <td className="px-4 py-4 text-slate-600 text-xs max-w-xs truncate">{item.item_description}</td>
                    <td className="px-4 py-4 text-slate-600">{item.warehouse || 'General'}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
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

