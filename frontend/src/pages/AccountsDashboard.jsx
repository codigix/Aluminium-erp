import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { 
  FileText, IndianRupee, CheckCircle, Clock, AlertCircle, TrendingUp, Filter, 
  Download, Eye, Calendar, RefreshCw, ArrowRight, Wallet, ArrowUpRight, ArrowDownRight,
  TrendingDown, Search
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const COLORS = {
  blue: '#4f46e5',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  indigo: '#6366f1',
  slate: '#94a3b8',
  chart: ['#4f46e5', '#10b981', '#f59e0b', '#6366f1', '#f43f5e']
};

const AccountsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/dashboard/accounts`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-ERP-Request': 'true'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching accounts dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, amount, subtitle, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900">{amount}</h3>
            {trendValue && (
              <span className={`flex items-center text-[10px] font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {trendValue}
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
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <IndianRupee className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 font-black tracking-tight">Financial Sync in Progress</h3>
          <p className="text-xs text-slate-500 mt-1">Calculating payables, receipts and cash flow trends...</p>
        </div>
      </div>
    );
  }

  const tableColumns = [
    { key: 'no', label: 'REFERENCE', render: (val) => <span className="font-black text-slate-900">{val}</span> },
    { key: 'vendor', label: 'ENTITY', render: (val) => <span className="font-bold text-slate-600">{val}</span> },
    { key: 'amount', label: 'AMOUNT', className: 'text-right', render: (val) => <span className="font-black text-indigo-600">₹{parseFloat(val || 0).toLocaleString('en-IN')}</span> },
    { key: 'status', label: 'STATUS', render: (val) => <StatusBadge status={val} /> },
    { key: 'date', label: 'DATE', render: (val) => <span className="text-slate-500 font-medium">{val}</span> },
    { 
      key: 'actions', 
      label: 'ACTION', 
      className: 'text-right',
      render: () => (
        <div className="flex justify-end gap-2">
          <button className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors border border-transparent hover:border-slate-100">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors border border-transparent hover:border-indigo-100">
            <FileText className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Accounts & Finance</h1>
            <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-100">
            <Calendar className="w-3.5 h-3.5" />
            Last 30 Days
          </div>
          <button 
            onClick={fetchDashboardData}
            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            GENERATE REPORT
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Total Invoices" 
          amount={stats.kpis.totalInvoices} 
          subtitle="Processed this period"
          color="bg-indigo-500"
          icon={FileText}
          trend="up"
          trendValue="8.4%"
        />
        <StatCard 
          title="Total Payables" 
          amount={`₹${Number(stats.kpis.totalPayable).toLocaleString('en-IN')}`} 
          subtitle="Total liability"
          color="bg-rose-500"
          icon={IndianRupee}
        />
        <StatCard 
          title="Paid to Vendors" 
          amount={`₹${Number(stats.kpis.paidAmount).toLocaleString('en-IN')}`} 
          subtitle="Cleared payments"
          color="bg-emerald-500"
          icon={CheckCircle}
          trend="up"
          trendValue="12.1%"
        />
        <StatCard 
          title="Pending Payments" 
          amount={`₹${Number(stats.kpis.pendingPayable).toLocaleString('en-IN')}`} 
          subtitle="Awaiting clearance"
          color="bg-amber-500"
          icon={Clock}
        />
        <StatCard 
          title="Overdue Items" 
          amount={stats.kpis.overdueCount} 
          subtitle="Requires attention"
          color="bg-rose-600"
          icon={AlertCircle}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Cash Flow Chart */}
        <div className="xl:col-span-2 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Financial Performance
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">MONTHLY CASH FLOW: RECEIPTS VS PAYMENTS</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.cashFlow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                  tickFormatter={(v) => `₹${v/1000}K`} 
                />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                />
                <Line 
                  type="monotone" 
                  dataKey="receipts" 
                  stroke={COLORS.blue} 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: COLORS.blue, strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="payments" 
                  stroke={COLORS.emerald} 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: COLORS.emerald, strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Status Distribution */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-8">Status Analytics</h3>
          <div className="flex-1 flex flex-col">
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.statusBreakdown.map(item => ({
                      name: item.name,
                      value: item.count,
                      color: item.name === 'PAID' ? COLORS.emerald : (item.name === 'OVERDUE' ? COLORS.rose : COLORS.amber)
                    }))}
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stats.statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'PAID' ? COLORS.emerald : (entry.name === 'OVERDUE' ? COLORS.rose : COLORS.amber)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900">72%</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Collection Rate</span>
              </div>
            </div>
            <div className="mt-8 space-y-4 flex-1">
              {stats.statusBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.name === 'PAID' ? COLORS.emerald : (item.name === 'OVERDUE' ? COLORS.rose : COLORS.amber) }}></div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900">{item.count}</span>
                    <span className="text-[10px] font-black text-slate-400 w-8 text-right">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Financial Activity Table */}
        <div className="xl:col-span-3 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-indigo-600" />
                RECENT FINANCIAL OPERATIONS
              </h3>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-wider">LATEST INVOICES AND PAYMENTS</p>
            </div>
            <button className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:gap-3 transition-all">
              View All Transactions <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            <DataTable
              columns={tableColumns}
              data={stats.recentActivity.filter(a => a.type === 'INVOICE').slice(0, 8)}
              loading={loading}
              hideHeader
              emptyMessage="No recent financial activity recorded."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountsDashboard;
