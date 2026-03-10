import React, { useState, useEffect } from 'react';
import { Card, DataTable, Badge, StatusBadge } from '../components/ui.jsx';
import { 
  ClipboardList, 
  Clock, 
  RotateCcw, 
  CheckCircle, 
  XCircle,
  Beaker,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  ChevronDown,
  ArrowRight,
  User,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const COLORS = {
  passed: '#10b981',
  failed: '#ef4444',
  awaiting: '#f59e0b',
  inProgress: '#6366f1',
  primary: '#4f46e5',
  pie: ['#ef4444', '#f59e0b', '#10b981', '#6366f1']
};

const QualityDashboard = () => {
  const [stats, setStats] = useState({
    totalQc: 0,
    pendingQc: 0,
    inProgressQc: 0,
    passedQc: 0,
    failedQc: 0,
    qcPendingItems: [],
    rejectionReasons: [],
    statusOverview: [],
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

      const [qcStatsRes, qcPendingRes] = await Promise.all([
        fetch(`${API_BASE}/qc-inspections/stats`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/inventory/qc-pending`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      const qcStatsData = qcStatsRes.ok ? await qcStatsRes.json() : {};
      const qcPendingData = qcPendingRes.ok ? await qcPendingRes.json() : [];

      setStats(prev => ({
        ...prev,
        ...qcStatsData,
        qcPendingItems: Array.isArray(qcPendingData) ? qcPendingData : []
      }));
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching quality dashboard:', error);
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

  const pendingColumns = [
    { 
      label: 'GRN REF', 
      key: 'grn_id', 
      sortable: true,
      render: (val) => <span className="font-black text-slate-900">GRN-{String(val).padStart(4, '0')}</span> 
    },
    { 
      label: 'ITEM CODE', 
      key: 'item_code', 
      sortable: true,
      render: (val) => <span className="font-bold text-indigo-600">{val || 'N/A'}</span>
    },
    { 
      label: 'QUANTITY', 
      key: 'quantity', 
      className: 'text-right',
      render: (val) => <span className="font-black text-slate-900">{parseFloat(val || 0).toFixed(3)}</span>
    },
    { 
      label: 'STATUS', 
      key: 'status',
      render: (val) => <StatusBadge status={val || 'PENDING'} />
    },
    {
      label: 'ACTION',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <button 
          onClick={() => window.location.href=`/qc-inspections?grn=${row.grn_id}`}
          className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors border border-transparent hover:border-indigo-100"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      )
    }
  ];

  if (loading && !stats.totalQc) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <Beaker className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 font-black tracking-tight">Gathering Quality Metrics</h3>
          <p className="text-xs text-slate-500 mt-1">Analyzing inspection results and rejection trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quality Assurance Dashboard</h1>
            <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-100 transition-all border border-slate-200 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            EXPORT REPORT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Total Inspections" 
          count={stats.totalQc || 0} 
          subtitle="Completed this month"
          color="bg-indigo-500"
          icon={ClipboardList}
          trend={stats.totalTrend}
        />
        <StatCard 
          title="Awaiting QC" 
          count={stats.pendingQc || 0} 
          subtitle="Pending in queue"
          color="bg-amber-500"
          icon={Clock}
        />
        <StatCard 
          title="In Progress" 
          count={stats.inProgressQc || 0} 
          subtitle="Currently testing"
          color="bg-blue-500"
          icon={RotateCcw}
        />
        <StatCard 
          title="Passed Inspections" 
          count={stats.passedQc || 0} 
          subtitle="Quality approved"
          color="bg-emerald-500"
          icon={CheckCircle}
          trend={stats.passedTrend}
        />
        <StatCard 
          title="Failed / Rejections" 
          count={stats.failedQc || 0} 
          subtitle="Non-conforming items"
          color="bg-rose-500"
          icon={XCircle}
          trend={stats.failedTrend}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Rejection Trends Chart */}
        <div className="xl:col-span-2 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Inspection Performance
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">MONTHLY ACCEPTANCE VS REJECTION</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-300" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rejected</span>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusOverview}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="accepted" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} barSize={32} />
                <Bar dataKey="rejected" stackId="a" fill="#a5b4fc" radius={[0, 0, 0, 0]} barSize={32} />
                <Bar dataKey="returned" stackId="a" fill="#e0e7ff" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rejection Reasons Pie */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-8">Defect Distribution</h3>
          <div className="flex-1 flex flex-col">
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.rejectionReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stats.rejectionReasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900">12%</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Avg Defect Rate</span>
              </div>
            </div>
            <div className="mt-8 space-y-4 flex-1">
              {stats.rejectionReasons.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900">{item.value}</span>
                    <span className="text-[10px] font-black text-slate-400 w-8 text-right">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Inspections Table */}
        <div className="xl:col-span-3 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                CRITICAL QC QUEUE
              </h3>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-wider">AWAITING TECHNICAL INSPECTION</p>
            </div>
            <button 
              onClick={() => window.location.href='/qc-inspections'}
              className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:gap-3 transition-all"
            >
              View Full Queue <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            <DataTable
              columns={pendingColumns}
              data={stats.qcPendingItems.slice(0, 8)}
              loading={loading}
              hideHeader
              emptyMessage="Excellent! The quality inspection queue is currently empty."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;
