import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
import { 
  ShoppingCart, 
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
  Box,
  ClipboardList
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProcurementDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/dashboard/procurement`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-ERP-Request': 'true'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch procurement stats');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching procurement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, count, subtitle, color, icon: Icon, trend }) => (
    <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{count}</h3>
            {trend && (
              <span className={`flex items-center text-[10px] font-bold ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
        <div className={`p-4 rounded-2xl ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Initializing Procurement Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200">
            <ShoppingCart className="w-10 h-10 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Procurement Hub</h1>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                Supply Chain
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" />
                Updated {lastUpdated.toLocaleTimeString()}
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5" />
                Inventory Sync: Active
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-5 py-3 bg-slate-50 text-slate-600 rounded-2xl text-xs font-black hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH DATA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'New RFQ', icon: FileText, path: '/procurement/quotations', color: 'bg-indigo-600' },
          { label: 'Create PO', icon: ShoppingCart, path: '/procurement/purchase-orders', color: 'bg-emerald-600' },
          { label: 'New Supplier', icon: Users, path: '/procurement/suppliers', color: 'bg-blue-600' },
          { label: 'View Stock', icon: Box, path: '/inventory', color: 'bg-amber-600' }
        ].map((action, idx) => (
          <button
            key={idx}
            onClick={() => window.location.href = action.path}
            className="flex items-center gap-3 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`p-2 rounded-xl ${action.color} text-white group-hover:scale-110 transition-transform`}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{action.label}</span>
          </button>
        ))}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Open RFQs" count={stats.openRfqs || 0} subtitle="Awaiting vendor response" color="bg-indigo-500" icon={FileText} trend={12} />
        <StatCard title="Pending POs" count={stats.pendingPos || 0} subtitle="Ready for dispatch" color="bg-emerald-500" icon={ClipboardList} trend={5} />
        <StatCard title="Material Requests" count={stats.materialRequests || 0} subtitle="From Production" color="bg-amber-500" icon={Box} />
        <StatCard title="Procurement Spend" count={`₹${(stats.monthlySpend || 0).toLocaleString()}`} subtitle="This Month" color="bg-blue-500" icon={IndianRupee} trend={-8} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Spending Analysis */}
        <div className="xl:col-span-2 bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                Procurement Analytics
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">DAILY SPENDING TREND (LAST 5 DAYS)</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData || []}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="spend" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Category Split</h3>
          <div className="flex-1 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categorySpend || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(stats.categorySpend || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {(stats.categorySpend || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-rose-500'][idx % 5]}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{item.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">₹{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Supplier Performance */}
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Supply Chain Health</h3>
          <div className="space-y-6 flex-1">
            {(stats.health || [
              { label: 'On-Time Delivery', value: 0, color: 'bg-indigo-500' },
              { label: 'Quality Compliance', value: 0, color: 'bg-emerald-500' },
              { label: 'Cost Variance', value: 0, color: 'bg-amber-500' },
              { label: 'Vendor Lead Time', value: 0, color: 'bg-blue-500' }
            ]).map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                  <span className="text-lg font-black text-slate-900">{item.value}%</span>
                </div>
                <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent RFQs */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-3">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                RECENT RFQ PIPELINE
              </h3>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest">ACTIVE VENDOR NEGOTIATIONS</p>
            </div>
          </div>
          <DataTable
            columns={[
              { label: 'RFQ Code', key: 'rfq_code', render: (val) => <span className="font-black text-slate-900">{val}</span> },
              { label: 'Supplier', key: 'vendor_name', render: (val) => val || 'Unassigned' },
              { label: 'Items', key: 'item_count', render: (val) => `${val} items` },
              { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val} /> }
            ]}
            data={stats.recentRfqs || []}
            hideHeader={true}
            className="border-none"
          />
        </div>
      </div>
    </div>
  );
};

export default ProcurementDashboard;
