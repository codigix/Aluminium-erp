import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, StatusBadge, DataTable, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';
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
  Filter,
  ShoppingBag,
  Sparkles,
  Award,
  ArrowRight
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
    return stats.salesOrders?.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0) || 0;
  }, [stats]);

  const StatCard = ({ title, count, subtitle, color, icon: Icon, trend, badgeBg }) => (
    <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[115px]">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-[0.04] rounded-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{count}</h3>
        </div>
        <div className={`p-2.5 rounded-xl ${badgeBg || 'bg-indigo-50 text-indigo-600'} transition-all duration-300 group-hover:scale-110 shadow-2xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 relative z-10">
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        {trend !== undefined && (
          <span className={`flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );

  const isDataLoading = loading || !stats;

  return (
    <div className="space-y-5 pb-12">
      
      {/* Top Filter & Command Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-xl shadow-md shadow-indigo-100">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Sales Command Hub</h1>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                Live Overview
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping ml-1" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 hover:border-indigo-300 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent border-none outline-none font-bold cursor-pointer text-slate-800"
            />
            <span className="text-slate-300 font-bold mx-0.5">—</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent border-none outline-none font-bold cursor-pointer text-slate-800"
            />
          </div>

          {/* Customer Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 hover:border-indigo-300 transition-colors">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <select 
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              <option value="All">All Customers</option>
              {stats?.activeClients?.map(client => (
                <option key={client.id} value={client.name}>{client.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 hover:shadow-lg active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            REFRESH DATA
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              title="Total Revenue" 
              count={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
              subtitle="YTD Costing Value" 
              color="bg-indigo-500" 
              badgeBg="bg-indigo-50 text-indigo-600"
              icon={IndianRupee} 
              trend={15} 
            />
            <StatCard 
              title="Sales Orders" 
              count={stats.kpis?.totalSalesOrders || stats.salesOrders?.length || 0} 
              subtitle="Total Created Orders" 
              color="bg-emerald-500" 
              badgeBg="bg-emerald-50 text-emerald-600"
              icon={Package} 
            />
            <StatCard 
              title="Approved Quotations" 
              count={stats.kpis?.approvedQuotes || 0} 
              subtitle="Contracts Ready" 
              color="bg-purple-500" 
              badgeBg="bg-purple-50 text-purple-600"
              icon={CheckCircle} 
              trend={12} 
            />
            <StatCard 
              title="Win Rate (Funnel)" 
              count={`${stats.kpis?.conversionRate || 0}%`} 
              subtitle="Quote Conversion" 
              color="bg-blue-500" 
              badgeBg="bg-blue-50 text-blue-600"
              icon={Target} 
              trend={5} 
            />
          </>
        )}
      </div>

      {/* Analytics Graph Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        
        {/* Sales Trend Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Revenue Velocity & Growth
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Monthly sales performance & revenue trajectory</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold">
              INR (₹)
            </span>
          </div>

          <div className="h-[270px] w-full">
            {isDataLoading ? (
              <div className="w-full h-full flex flex-col justify-end gap-2 p-4 bg-slate-50/50 rounded-xl animate-pulse">
                <div className="h-36 bg-slate-200/80 rounded-lg w-full"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.chartData || []}>
                  <defs>
                    <linearGradient id="colorSalesVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}}
                    tickFormatter={(val) => `₹${val >= 100000 ? (val / 100000).toFixed(0) + 'L' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'}}
                    formatter={(val) => [`₹${parseFloat(val).toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSalesVal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pipeline / Funnel Health */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              Pipeline Funnel Health
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Stage conversion rates across quote cycles</p>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center my-2">
            {isDataLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded-lg w-full"></div>
                <div className="h-4 bg-slate-100 rounded-lg w-4/5"></div>
                <div className="h-4 bg-slate-100 rounded-lg w-3/5"></div>
              </div>
            ) : (
              (stats?.funnelData || []).map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-extrabold text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 shadow-2xs" 
                      style={{ 
                        width: `${(parseFloat(item.value) / (parseFloat(stats?.funnelData?.[0]?.value) || 1)) * 100}%`,
                        backgroundColor: item.color
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Quote Win Efficiency:</span>
            <span className="font-black text-indigo-600 text-sm px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
              {stats?.kpis?.conversionRate || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Sales Orders List Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Briefcase className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Recent Sales Orders
              </h3>
            </div>
            <button 
              onClick={() => navigate('/sales/sales-report')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-indigo-50"
            >
              Sales Report <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            {isDataLoading ? (
              <div className="p-4">
                <SkeletonTable rows={4} columns={4} />
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Order Details</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(stats?.salesOrders || []).slice(0, 5).map((order, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-4 py-3.5">
                        <button 
                          onClick={() => navigate(`/sales-report-details/${order.public_id || order.id_val}`)}
                          className="text-left"
                        >
                          <p className="text-xs font-bold text-indigo-600 group-hover:underline flex items-center gap-1">
                            {order.id}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{order.date}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-bold text-slate-800">{order.customer}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{order.sub}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs font-black text-slate-900">₹{parseFloat(order.total).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                  {(!stats?.salesOrders || stats.salesOrders.length === 0) && (
                    <tr>
                      <td colSpan="4" className="px-4 py-10 text-center text-xs text-slate-400 font-medium">No recent sales orders found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Active Customers */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Top Active Customers
              </h3>
            </div>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[310px]">
            {isDataLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-11 bg-slate-100 rounded-xl"></div>
                <div className="h-11 bg-slate-100 rounded-xl"></div>
                <div className="h-11 bg-slate-100 rounded-xl"></div>
              </div>
            ) : (
              <>
                {(stats?.activeClients || []).slice(0, 5).map((client, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-xs ${
                        idx === 0 ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 
                        idx === 1 ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {client.initials}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[125px]">{client.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{client.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">₹{parseFloat(client.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">{client.lastDate}</p>
                    </div>
                  </div>
                ))}
                {(!stats?.activeClients || stats.activeClients.length === 0) && (
                  <div className="py-10 text-center text-xs text-slate-400 font-medium">No active clients found</div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default SalesDashboard;
