import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { 
  Activity, Zap, ShieldCheck, Gauge, TrendingDown, 
  AlertTriangle, RefreshCw, Download, Filter, Search,
  Settings, Layers, List, Cpu, Info, ChevronRight,
  TrendingUp, Clock, LayoutDashboard, Target, Calendar,
  Flame, Award, Microscope, Wind, Monitor, BrainCircuit,
  Lightbulb, ZapOff, CheckCircle2, ChevronRight as ChevronRightIcon,
  Layout, AlertCircle, ArrowUpRight, ArrowDownRight, Database, ArrowRight,
  Pause, MoreHorizontal, HelpCircle, Briefcase, FileText
} from 'lucide-react';
import { Card, Button, StatusBadge, DataTable } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProjectAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/project-analysis`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'X-ERP-Request': 'true'
        }
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching project metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, amount, subtitle, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl text-slate-900">{amount}</h3>
            {trendValue && (
              <span className={`flex items-center text-xs ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
          <Briefcase className="w-3 h-3 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 tracking-tight">Project Data Sync</h3>
          <p className="text-xs text-slate-500 mt-1">Analyzing order pipelines and delivery schedules...</p>
        </div>
      </div>
    );
  }

  const kpis = data.kpis || { total: 0, ongoing: 0, completed: 0, delayed: 0, onTimeRate: '0%' };

  const projectColumns = [
    { label: 'PROJECT / ORDER', key: 'order_no', render: (val, row) => (
      <div className="flex flex-col">
        <span className="text-xs text-slate-900">{val}</span>
        <span className="text-[10px] text-slate-400">{row.company_name}</span>
      </div>
    )},
    { label: 'DELIVERY', key: 'delivery_date', render: (val) => (
      <span className="text-xs text-slate-600">{new Date(val).toLocaleDateString()}</span>
    )},
    { label: 'PROGRESS', key: 'progress', render: (val) => (
      <div className="w-24 bg-slate-100 h-1 rounded-full overflow-hidden">
        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${val || 0}%` }} />
      </div>
    )},
    { label: 'STATUS', key: 'status', render: (val) => <StatusBadge status={val} /> },
    { label: 'HEALTH', key: 'health', render: () => <span className="text-emerald-500 text-[10px] font-bold">STABLE</span> }
  ];

  return (
    <div className="space-y-2 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900">Project Analysis Suite</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 cursor-pointer hover:bg-slate-100">
            <Calendar className="w-3.5 h-3.5" />
            Active Projects
          </div>
          <button 
            onClick={fetchMetrics}
            className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            EXPORT ANALYSIS
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        {['Overview', 'Timeline', 'Resource Allocation'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-xs transition-all ${
              activeTab === tab 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-2">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <StatCard title="Total Projects" amount={kpis.total} subtitle="All time managed" color="bg-indigo-500" icon={Layers} />
            <StatCard title="Active Now" amount={kpis.ongoing} subtitle="Currently in pipeline" color="bg-blue-500" icon={Zap} trend="up" trendValue="4.2%" />
            <StatCard title="Completed" amount={kpis.completed} subtitle="Successfully delivered" color="bg-emerald-500" icon={CheckCircle2} />
            <StatCard title="Delayed" amount={kpis.delayed} subtitle="Requires intervention" color="bg-rose-500" icon={AlertCircle} trend="down" trendValue="2.1%" />
            <StatCard title="On-Time Rate" amount={kpis.onTimeRate} subtitle="Delivery performance" color="bg-amber-500" icon={Target} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {/* Delivery Performance Chart */}
            <div className="bg-white rounded p-4 border border-slate-100 shadow-sm flex flex-col h-[400px]">
              <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4">Delivery Performance (Monthly)</h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trends || []}>
                    <defs>
                      <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorOee)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Project Status Distribution */}
            <div className="bg-white rounded p-4 border border-slate-100 shadow-sm flex flex-col h-[400px]">
              <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4">Project Status Distribution</h3>
              <div className="flex-1 flex flex-col md:flex-row items-center gap-8">
                <div className="relative h-64 w-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.distribution || []}
                        innerRadius={80} outerRadius={110}
                        paddingAngle={5} dataKey="count" stroke="none"
                      >
                        {data.distribution?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-4">
                   {data.distribution?.map((item, idx) => (
                     <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.chart[idx % COLORS.chart.length] }} />
                          <span className="text-xs text-slate-600">{item.status}</span>
                        </div>
                        <span className="text-xs text-slate-900 font-bold">{item.count}</span>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
            {/* Active Projects Table */}
            <div className="xl:col-span-2 bg-white rounded border border-slate-100 shadow-sm flex flex-col h-[400px]">
              <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <h3 className="text-xs text-slate-900 tracking-tight flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  RECENT PROJECT ACTIVITY
                </h3>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                <DataTable
                  columns={projectColumns}
                  data={data.recentProjects || []}
                  loading={loading}
                  hideHeader
                />
              </div>
            </div>

            {/* Project Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 h-[400px]">
               {[
                 { label: 'Work Orders', value: '156', sub: 'TOTAL ISSUED', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                 { label: 'Avg Lead Time', value: '12d', sub: 'ORDER TO SHIP', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                 { label: 'Quality Pass', value: '99.2%', sub: 'FIRST INSPECTION', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
                 { label: 'Customer Sat', value: '4.8', sub: 'AVG RATING', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' }
               ].map((m, idx) => (
                 <div key={idx} className="bg-white rounded border border-slate-100 p-4 flex flex-col justify-between hover:shadow-md transition-all">
                    <div className={`w-8 h-8 rounded ${m.bg} flex items-center justify-center`}>
                      <m.icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <div>
                      <p className="text-xl text-slate-900">{m.value}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter mt-1">{m.label}</p>
                    </div>
                    <p className={`text-[9px] ${m.color} uppercase tracking-widest`}>{m.sub}</p>
                 </div>
               ))}
               <div className="col-span-2 bg-white rounded border border-slate-100 p-4 flex items-center justify-between hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center relative">
                       <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                           <Pie data={[{v: 94.5}, {v: 5.5}]} innerRadius={14} outerRadius={18} dataKey="v" stroke="none">
                             <Cell fill="#10b981" />
                             <Cell fill="#f1f5f9" />
                           </Pie>
                         </PieChart>
                       </ResponsiveContainer>
                       <Target className="w-3 h-3 text-emerald-600 absolute" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-widest">Delivery Accuracy</p>
                      <p className="text-lg text-slate-900">94.5%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold">In-Time Delivery</p>
                    <ArrowRight className="w-4 h-4 text-slate-300 ml-auto mt-2" />
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const COLORS = {
  blue: '#4f46e5',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  indigo: '#6366f1',
  slate: '#94a3b8',
  chart: ['#4f46e5', '#10b981', '#f59e0b', '#6366f1', '#f43f5e']
};

export default ProjectAnalysis;
