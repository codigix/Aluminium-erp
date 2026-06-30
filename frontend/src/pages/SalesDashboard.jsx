import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, StatusBadge, DataTable } from '../components/ui.jsx';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  RefreshCw, 
  FileText, 
  Package, 
  Truck,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
  Handshake,
  Briefcase,
  Target,
  Calendar,
  Eye,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const SalesDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCustomer, setSelectedCustomer] = useState('All');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, selectedCustomer]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/dashboard/sales?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedCustomer !== 'All') url += `&customer=${selectedCustomer}`;

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-ERP-Request': 'true'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch sales stats');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching sales dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = useMemo(() => {
    if (!stats) return 0;
    if (stats.totalRevenue) return stats.totalRevenue;
    // Calculate fallback total revenue if not directly exposed in stats root
    return stats.salesOrders?.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0) || 0;
  }, [stats]);

  const StatCard = ({ title, count, subtitle, color, icon: Icon, trend }) => (
    <div className="bg-white rounded p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[110px]">
      <div className={`absolute top-0 right-0 w-20 h-20 ${color} opacity-[0.03] rounded-full -mr-6 -mt-6 transition-transform duration-500 group-hover:scale-125`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">{count}</h3>
        </div>
        <div className={`p-2.5 rounded-lg bg-slate-50 text-slate-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-600 shadow-sm`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 relative z-10">
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        {trend !== undefined && (
          <span className={`flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-4">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium animate-pulse">Initializing Sales Command Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-500">
      
      {/* Top Filter & Command Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Sales Command Hub</h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Synced: {lastUpdated.toLocaleTimeString()}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping ml-1" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:border-slate-300 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent border-none outline-none font-semibold cursor-pointer text-slate-700"
            />
            <span className="text-slate-300 font-bold mx-0.5">—</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent border-none outline-none font-semibold cursor-pointer text-slate-700"
            />
          </div>

          {/* Customer Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-slate-300 transition-colors">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
            >
              <option value="All">All Customers</option>
              {stats.activeClients?.map(client => (
                <option key={client.id} value={client.name}>{client.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 hover:shadow-lg active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Revenue" 
          count={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
          subtitle="YTD Costing Value" 
          color="bg-indigo-500" 
          icon={IndianRupee} 
          trend={15} 
        />
        <StatCard 
          title="Sales Orders" 
          count={stats.kpis?.totalSalesOrders || stats.salesOrders?.length || 0} 
          subtitle="Total Created Orders" 
          color="bg-emerald-500" 
          icon={Package} 
        />
        <StatCard 
          title="Approved Quotations" 
          count={stats.kpis?.approvedQuotes || 0} 
          subtitle="Contracts Ready" 
          color="bg-emerald-500" 
          icon={CheckCircle} 
          trend={12} 
        />
        <StatCard 
          title="Win Rate (Funnel)" 
          count={`${stats.kpis?.conversionRate || 0}%`} 
          subtitle="Quote Conversion" 
          color="bg-blue-500" 
          icon={Target} 
          trend={5} 
        />
      </div>

      {/* Analytics Graph Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        
        {/* Sales Trend Chart */}
        <div className="xl:col-span-2 bg-white rounded-lg p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Revenue Velocity
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Monthly sales performance & trend analysis</p>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData || []}>
                <defs>
                  <linearGradient id="colorSalesVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontspan: 600}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontspan: 600}}
                  tickFormatter={(val) => `₹${val >= 100000 ? (val / 100000).toFixed(0) + 'L' : val}`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'}}
                  formatter={(val) => [`₹${parseFloat(val).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSalesVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline / Funnel Health */}
        <div className="bg-white rounded-lg p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              Pipeline Funnel
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Conversion flow across quotation cycles</p>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {(stats.funnelData || []).map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-end">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="text-xs font-bold text-slate-700">{item.value}</span>
                </div>
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  {/* Dynamic width matching maximum value fallback */}
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ 
                      width: `${(parseFloat(item.value) / (parseFloat(stats.funnelData?.[0]?.value) || 1)) * 100}%`,
                      backgroundColor: item.color
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Overall Conversion Efficiency:</span>
            <span className="font-bold text-indigo-600 text-sm">{stats.kpis?.conversionRate || 0}%</span>
          </div>
        </div>
      </div>

      {/* Main Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Sales Orders List Summary */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-3.5 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Recent Sales Orders
              </h3>
            </div>
            <button 
              onClick={() => navigate('/sales/sales-report')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
            >
              Sales Report <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/10">
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">Order Details</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase">Customer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase text-right">Total Amount</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(stats.salesOrders || []).slice(0, 5).map((order, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => navigate(`/sales-report-details/${order.public_id || order.id_val}`)}
                        className="text-left"
                      >
                        <p className="text-xs font-bold text-indigo-600 hover:underline">{order.id}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{order.date}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-800">{order.customer}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 italic">{order.sub}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-slate-700">₹{parseFloat(order.total).toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
                {(!stats.salesOrders || stats.salesOrders.length === 0) && (
                  <tr>
                    <td colSpan="4" className="px-4 py-10 text-center text-xs text-slate-400">No recent sales orders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Active Customers */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-3.5 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Top Customers
            </h3>
          </div>
          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
            {(stats.activeClients || []).slice(0, 5).map((client, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-slate-50 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm ${
                    idx === 0 ? 'bg-indigo-50 text-indigo-600' : idx === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {client.initials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{client.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{client.orders} orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-700">₹{parseFloat(client.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{client.lastDate}</p>
                </div>
              </div>
            ))}
            {(!stats.activeClients || stats.activeClients.length === 0) && (
              <div className="py-10 text-center text-xs text-slate-400">No active clients found</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default SalesDashboard;
