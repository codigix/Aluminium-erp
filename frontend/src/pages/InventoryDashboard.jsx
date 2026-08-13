import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge, SkeletonCard } from '../components/ui.jsx';
import { 
  Package, 
  ClipboardList, 
  Truck, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Clock,
  ExternalLink
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const InventoryDashboard = () => {
  const [stats, setStats] = useState({
    incomingPos: [],
    pendingGRNs: [],
    lowStockItems: [],
    materialRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

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
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching inventory dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, count, subtitle, color, icon: Icon, trend }) => (
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs  text-slate-400   mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl  text-slate-900">{count}</h3>
            {trend && (
              <span className={`flex items-center text-xs  ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 ">{subtitle}</p>
        </div>
        <div className={`p-2 rounded  ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>
      
      <div className="mt-4 flex items-center text-xs  text-slate-400 group-hover:text-indigo-600 transition-colors cursor-pointer">
        VIEW DETAILS <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );

  const incomingColumns = [
    { key: 'order_code', label: 'Order Code', sortable: true, render: (val) => <span className=" text-slate-900">{val}</span> },
    { key: 'company_name', label: 'Customer', sortable: true },
    { key: 'project_name', label: 'Project', className: 'max-w-xs truncate' },
    { key: 'amount', label: 'Amount', sortable: true, className: 'text-right', render: (val) => <span className=" text-indigo-600">₹{parseFloat(val || 0).toLocaleString('en-IN')}</span> },
    { key: 'target_dispatch_date', label: 'Target Dispatch', sortable: true, render: (val) => val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—' },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> }
  ];

  const mrColumns = [
    { key: 'request_no', label: 'Request No', sortable: true, render: (val) => <span className=" text-slate-900">{val}</span> },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'purpose', label: 'Purpose' },
    { key: 'items_count', label: 'Items', className: 'text-right ' },
    { key: 'required_date', label: 'Required By', sortable: true, render: (val) => val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—' },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> }
  ];

  const grnColumns = [
    { key: 'id', label: 'GRN ID', sortable: true, render: (val) => <span className=" text-slate-900">GRN-{String(val).padStart(4, '0')}</span> },
    { key: 'po_number', label: 'PO Number', sortable: true },
    { key: 'received_quantity', label: 'Qty Received', className: 'text-right ', render: (val) => parseFloat(val || 0).toFixed(3) },
    { key: 'grn_date', label: 'Date', sortable: true, render: (val) => new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> }
  ];

  const lowStockColumns = [
    { key: 'item_code', label: 'Item Code', sortable: true, render: (val) => <span className=" text-slate-900">{val}</span> },
    { key: 'item_description', label: 'Description', className: 'max-w-xs truncate' },
    { key: 'warehouse', label: 'Warehouse', sortable: true },
    { key: 'current_balance', label: 'Balance', sortable: true, className: 'text-right', render: (val) => (
      <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded   border border-rose-100">
        {parseFloat(val || 0).toFixed(3)}
      </span>
    )},
    { key: 'unit', label: 'Unit' }
  ];

  const isDataLoading = loading;

  return (
    <div className="space-y-2 pb-12">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl  text-slate-900 ">Inventory Dashboard</h1>
            <div className="flex items-center gap-2 mt-1 text-xs  text-slate-400  ">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 p-2 bg-slate-50 text-slate-600 rounded  text-xs  hover:bg-slate-100 transition-all border border-slate-200 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH DATA
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isDataLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard 
              title="Incoming Orders" 
              count={stats?.incomingPos?.length || 0} 
              subtitle="Active in pipeline"
              color="bg-indigo-500"
              icon={Truck}
              trend={12}
            />
            <StatCard 
              title="Material Requests" 
              count={stats?.materialRequests?.length || 0} 
              subtitle="Pending fulfillment"
              color="bg-emerald-500"
              icon={ClipboardList}
            />
            <StatCard 
              title="Pending GRNs" 
              count={stats?.pendingGRNs?.length || 0} 
              subtitle="Awaiting inspection"
              color="bg-amber-500"
              icon={RefreshCw}
            />
            <StatCard 
              title="Low Stock Alert" 
              count={stats?.lowStockItems?.length || 0} 
              subtitle="Below reorder level"
              color="bg-rose-500"
              icon={AlertTriangle}
              trend={-5}
            />
          </>
        )}
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Incoming Orders Section */}
        <div className="bg-white rounded  border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xs  text-slate-900  flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                ACTIVE PRODUCTION PIPELINE
              </h3>
              <p className="text-xs text-slate-500  mt-0.5">INCOMING ORDERS FROM SALES</p>
            </div>
            <button className="p-2 hover:bg-white rounded  transition-colors border border-transparent hover:border-slate-100">
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-2 flex-1">
            <DataTable 
              columns={incomingColumns} 
              data={stats.incomingPos.slice(0, 5)} 
              loading={loading}
              hideHeader
              emptyMessage="No incoming orders currently"
            />
          </div>
        </div>

        {/* Material Requests Section */}
        <div className="bg-white rounded  border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xs  text-slate-900  flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                PURCHASE REQUISITIONS
              </h3>
              <p className="text-xs text-slate-500  mt-0.5">RECENT MATERIAL REQUESTS</p>
            </div>
            <button 
              onClick={() => window.location.href='/po-material-request'}
              className="p-2 hover:bg-white rounded  transition-colors border border-transparent hover:border-slate-100"
            >
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-2 flex-1">
            <DataTable 
              columns={mrColumns} 
              data={stats.materialRequests.slice(0, 5)} 
              loading={loading}
              hideHeader
              emptyMessage="No pending material requests"
            />
          </div>
        </div>

        {/* Pending GRNs Section */}
        <div className="bg-white rounded  border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xs  text-slate-900  flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                AWAITING QUALITY CHECK
              </h3>
              <p className="text-xs text-slate-500  mt-0.5">GOODS RECEIVED MANAGEMENT</p>
            </div>
            <button className="p-2 hover:bg-white rounded  transition-colors border border-transparent hover:border-slate-100">
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-2 flex-1">
            <DataTable 
              columns={grnColumns} 
              data={stats.pendingGRNs.slice(0, 5)} 
              loading={loading}
              hideHeader
              emptyMessage="No pending GRNs for inspection"
            />
          </div>
        </div>

        {/* Low Stock Items Section */}
        <div className="bg-white rounded  border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 text-rose-600">
            <div>
              <h3 className="text-sm   flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                CRITICAL STOCK ALERTS
              </h3>
              <p className="text-xs text-slate-500  mt-0.5 ">ITEMS BELOW REORDER LEVEL</p>
            </div>
            <button className="p-2 hover:bg-white rounded  transition-colors border border-transparent hover:border-slate-100">
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-2 flex-1">
            <DataTable 
              columns={lowStockColumns} 
              data={stats.lowStockItems.slice(0, 5)} 
              loading={loading}
              hideHeader
              emptyMessage="All items are above reorder level"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;

