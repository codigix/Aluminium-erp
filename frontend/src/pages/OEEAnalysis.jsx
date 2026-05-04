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
  Pause, MoreHorizontal, HelpCircle, Wallet
} from 'lucide-react';
import { Card, Button, StatusBadge, DataTable } from '../components/ui.jsx';

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

const OEEAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('Executive Overview');
  const [timeRange, setTimeRange] = useState('Weekly');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/oee-analysis?range=${timeRange}`, {
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
      console.error('Error fetching OEE metrics:', error);
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
          <BrainCircuit className="w-3 h-3 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 tracking-tight">OEE Sync in Progress</h3>
          <p className="text-xs text-slate-500 mt-1">Synchronizing real-time telemetry streams...</p>
        </div>
      </div>
    );
  }

  const overall = data?.overall || { oee: 0, availability: 0, performance: 0, quality: 0, utilization: 0 };

  const recentOpsColumns = [
    { label: 'WORKSTATION', key: 'workstation_name', render: (val, row) => (
      <div className="flex flex-col">
        <span className="text-xs text-slate-900">{val}</span>
        <span className="text-[10px] text-slate-400">{row.workstation_code}</span>
      </div>
    )},
    { label: 'SHIFT', key: 'shift_id', render: (val) => (
      <span className="text-[10px] text-slate-600 uppercase">SHIFT {val === 1 ? 'B' : 'A'}</span>
    )},
    { label: 'PRODUCED', key: 'actual_output', render: (val) => (
      <span className="text-xs text-slate-900">{val}</span>
    )},
    { label: 'TARGET', key: 'target_output', render: (val) => (
      <span className="text-xs text-slate-900">{val}</span>
    )},
    { label: 'REJECT RATE', key: 'reject', render: () => (
      <span className="text-[10px] text-emerald-500">0.0%</span>
    )},
    { label: 'STATUS', key: 'status', render: () => (
      <StatusBadge status="ACTIVE" />
    )},
    { label: 'LAST UPDATED', key: 'updated_at', render: () => (
      <span className="text-[10px] text-slate-400">12:14:33 PM</span>
    )}
  ];

  return (
    <div className="space-y-2 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900">OEE Intelligence Dashboard</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 cursor-pointer hover:bg-slate-100">
            <Calendar className="w-3.5 h-3.5" />
            Last 30 Days
          </div>
          <button 
            onClick={fetchMetrics}
            className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            GENERATE REPORT
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        {['Executive Overview', 'Machine Analytics', 'Loss Analysis'].map((tab) => (
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

      {activeTab === 'Executive Overview' && (
        <div className="space-y-2">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <StatCard title="Overall OEE" amount={`${overall.oee}%`} subtitle="Current Score" color="bg-indigo-500" icon={Activity} trend="down" trendValue="2.4%" />
            <StatCard title="Availability" amount={`${overall.availability}%`} subtitle="Machine Uptime" color="bg-emerald-500" icon={Clock} trend="up" trendValue="1.8%" />
            <StatCard title="Performance" amount={`${overall.performance}%`} subtitle="Cycle Speed" color="bg-amber-500" icon={Zap} trend="down" trendValue="1.3%" />
            <StatCard title="Quality" amount={`${overall.quality}%`} subtitle="First-Pass Yield" color="bg-indigo-600" icon={ShieldCheck} trend="up" trendValue="0.9%" />
            <StatCard title="Utilization" amount={`${overall.utilization}%`} subtitle="Asset Usage" color="bg-blue-500" icon={Target} trend="up" trendValue="1.2%" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {/* Overall Effectiveness Index */}
            <div className="bg-white rounded p-4 border border-slate-100 shadow-sm flex flex-col items-center">
              <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4 w-full">Overall Effectiveness Index</h3>
              <div className="relative h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{v: overall.oee}, {v: 100 - overall.oee}]}
                      startAngle={210} endAngle={-30}
                      innerRadius={80} outerRadius={110}
                      paddingAngle={0} dataKey="v" stroke="none"
                    >
                      <Cell fill="#4f46e5" />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                  <span className="text-5xl text-slate-900">{overall.oee}%</span>
                  <span className="text-[10px] text-slate-400 uppercase mt-2">OEE SCORE</span>
                </div>
              </div>
            </div>

            {/* Workstation OEE Analysis */}
            <div className="bg-white rounded p-4 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4">Workstation OEE Analysis</h3>
              <div className="flex-1 flex flex-col md:flex-row items-center gap-8 px-4">
                <div className="relative h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{v: overall.oee}, {v: 100 - overall.oee}]}
                        innerRadius={60} outerRadius={85}
                        paddingAngle={5} dataKey="v" stroke="none"
                      >
                        <Cell fill="#4f46e5" />
                        <Cell fill="#f8fafc" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl text-slate-900">{overall.oee}%</span>
                    <span className="text-[10px] text-slate-400">Global</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4 w-full">
                  {[
                    { name: 'Availability Loss', value: 74.4, color: '#4f46e5' },
                    { name: 'Performance Loss', value: 20.4, color: '#818cf8' },
                    { name: 'Quality Loss', value: 3.9, color: '#c7d2fe' }
                  ].map((loss, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">{loss.name}</span>
                        <span className="text-xs text-slate-900">{loss.value}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${loss.value}%`, backgroundColor: loss.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
            {/* Efficiency List */}
            <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-slate-50 bg-slate-50/30">
                <h3 className="text-xs text-slate-900 tracking-tight flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  WORKSTATION EFFICIENCY
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {[
                   {name: 'Laser Machine', code: 'WS-0001', oee: 1.3},
                   {name: 'Rolling Machine', code: 'WS-0002', oee: 1.3},
                   {name: 'Welding Station', code: 'WS-0003', oee: 1.3},
                   {name: 'Finishing Area', code: 'WS-0004', oee: 1.3},
                   {name: 'Cutting Machine', code: 'WS-0005', oee: 1.3},
                   {name: 'Assembly Bench', code: 'WS-0006', oee: 1.3},
                   {name: 'Manual Area', code: 'WS-0007', oee: 1.3},
                   {name: 'Assembly Line', code: 'WS-0008', oee: 1.3},
                   {name: 'QC Station', code: 'WS-0009', oee: 1.3},
                   {name: 'Packing Area', code: 'WS-0010', oee: 1.3}
                 ].map((ws, idx) => (
                   <div key={idx} className="p-2 hover:bg-slate-50 rounded transition-all flex items-center justify-between border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center">
                          <Cpu className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-900">{ws.name}</p>
                          <p className="text-[10px] text-slate-400">{ws.code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-indigo-600">{ws.oee}%</p>
                        <div className="w-16 bg-slate-100 h-1 rounded-full mt-1">
                          <div className="bg-indigo-600 h-full rounded-full" style={{width: `${ws.oee}%`}} />
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            {/* Factor Comparison */}
            <div className="bg-white rounded border border-slate-100 shadow-sm p-4 flex flex-col h-[400px]">
              <h3 className="text-xs text-slate-900 mb-4 uppercase tracking-widest">Factor Comparison</h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.workstations?.slice(0, 6) || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="workstation_code" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="availability" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={8} />
                    <Bar dataKey="performance" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={8} />
                    <Bar dataKey="quality" fill="#c7d2fe" radius={[4, 4, 0, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Loss Impact */}
            <div className="bg-white rounded border border-slate-100 shadow-sm p-4 flex flex-col h-[400px]">
               <h3 className="text-xs text-slate-900 mb-4 uppercase tracking-widest">Loss Weighted Impact</h3>
               <div className="flex-1 space-y-4">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.workstations?.slice(0, 10) || []} layout="vertical">
                         <XAxis type="number" hide />
                         <YAxis dataKey="workstation_code" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} width={50} />
                         <Tooltip cursor={{fill: '#f8fafc'}} />
                         <Bar dataKey="oee" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded border border-indigo-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="w-3 h-3 text-indigo-600" />
                      <span className="text-[10px] text-indigo-900 uppercase">Insight</span>
                    </div>
                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                      Availability loss contributes the most to OEE degradation across all workstations.
                    </p>
                  </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
            {/* Operational Log */}
            <div className="xl:col-span-2 bg-white rounded border border-slate-100 shadow-sm flex flex-col h-[400px]">
              <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <h3 className="text-xs text-slate-900 tracking-tight flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  OPERATIONAL LOG
                </h3>
                <StatusBadge status="LIVE" />
              </div>
              <div className="flex-1 overflow-hidden p-2">
                <DataTable
                  columns={recentOpsColumns}
                  data={data?.recentJobs || []}
                  loading={loading}
                  hideHeader
                  pageSize={5}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 h-[400px]">
               {[
                 { label: 'Total Workstations', value: '10', sub: 'ACTIVE', icon: Cpu, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                 { label: 'Live Machines', value: '8', sub: 'RUNNING', icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                 { label: 'Idle Machines', value: '2', sub: 'IDLE', icon: Pause, color: 'text-amber-600', bg: 'bg-amber-50' },
                 { label: 'Critical Alerts', value: '5', sub: 'ACTION REQUIRED', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
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
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center relative">
                       <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                           <Pie data={[{v: 98.7}, {v: 1.3}]} innerRadius={14} outerRadius={18} dataKey="v" stroke="none">
                             <Cell fill="#4f46e5" />
                             <Cell fill="#f1f5f9" />
                           </Pie>
                         </PieChart>
                       </ResponsiveContainer>
                       <Activity className="w-3 h-3 text-indigo-600 absolute" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-widest">Data Accuracy</p>
                      <p className="text-lg text-slate-900">98.7%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold">This Week</p>
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

export default OEEAnalysis;
