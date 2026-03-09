import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
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
  Target
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const SalesDashboard = () => {
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
      const response = await fetch(`${API_BASE}/dashboard/sales`, {
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
        <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Initializing Sales Performance Hub...</p>
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
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sales Command</h1>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                Revenue Growth
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
                Target Achievement: 104%
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
            REFRESH HUB
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" count={`₹${(stats.totalRevenue || 0).toLocaleString()}`} subtitle="Year to date" color="bg-indigo-500" icon={IndianRupee} trend={18} />
        <StatCard title="Active Quotes" count={stats.activeQuotes || 0} subtitle="Pending client approval" color="bg-emerald-500" icon={FileText} trend={12} />
        <StatCard title="New Leads" count={stats.newLeads || 0} subtitle="Last 30 days" color="bg-amber-500" icon={Users} />
        <StatCard title="Win Rate" count={`${stats.winRate || 0}%`} subtitle="Conversion efficiency" color="bg-blue-500" icon={Target} trend={5} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Sales Forecast Chart */}
        <div className="xl:col-span-2 bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                Revenue Velocity
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">MONTHLY SALES PERFORMANCE & PROJECTION</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Analytics */}
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Pipeline Health</h3>
          <div className="space-y-6 flex-1">
            {[
              { label: 'Quote fulfillment', value: 85, color: 'bg-indigo-500' },
              { label: 'Customer Retention', value: 94, color: 'bg-emerald-500' },
              { label: 'Market Penetration', value: 62, color: 'bg-amber-500' },
              { label: 'Lead Velocity', value: 78, color: 'bg-blue-500' }
            ].map((item, idx) => (
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
      </div>

      {/* Recent Client Interactions */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Handshake className="w-4 h-4 text-indigo-600" />
              HIGH-VALUE OPPORTUNITIES
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest">TOP PENDING QUOTATIONS & CONTRACTS</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/20">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Client</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Value</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Age</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(stats.topOpportunities || []).map((opp, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 text-xs font-black text-slate-900">{opp.client_name}</td>
                  <td className="px-8 py-4 text-xs font-medium text-slate-600">₹{(opp.value || 0).toLocaleString()}</td>
                  <td className="px-8 py-4 text-xs font-medium text-slate-600">{opp.age} days</td>
                  <td className="px-8 py-4">
                    <StatusBadge status={opp.status} />
                  </td>
                </tr>
              ))}
              {(!stats.topOpportunities || stats.topOpportunities.length === 0) && (
                <tr>
                  <td colSpan="4" className="px-8 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No active high-value opportunities</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
