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
  Lightbulb, ZapOff, CheckCircle2,
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
  chart: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']
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

  const StatCard = ({ title, count, subtitle, icon: Icon, color, trend, trendValue, animate }) => (
    <div className="bg-white rounded p-3 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold text-slate-900">{count}</h3>
            {trendValue && (
              <span className={`flex items-center text-[10px] font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100').replace('600', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm relative`}>
          <Icon className={`w-4 h-4 ${animate ? 'animate-pulse' : ''}`} />
        </div>
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
          <BrainCircuit className="w-4 h-4 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 tracking-tight font-bold">OEE Sync in Progress</h3>
          <p className="text-xs text-slate-500 mt-1">Synchronizing real-time telemetry streams...</p>
        </div>
      </div>
    );
  }

  const overall = data?.overall || { oee: 0, availability: 0, performance: 0, quality: 0, utilization: 0 };

  const recentOpsColumns = [
    { label: 'WORKSTATION', key: 'assetContext', render: (val, row) => (
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-900 uppercase">{val}</span>
        <span className="text-[9px] text-slate-400 font-bold">{row.identifier}</span>
      </div>
    )},
    { label: 'SHIFT', key: 'shift', render: () => <span className="text-[10px] text-slate-600 font-bold uppercase">SHIFT B</span> },
    { label: 'PRODUCED', key: 'produced', render: (val) => (
      <span className="text-[11px] font-bold text-slate-900">{val}</span>
    )},
    { label: 'TARGET', key: 'target', render: (val) => (
      <span className="text-[11px] font-bold text-slate-900">{val}</span>
    )},
    { label: 'REJECT RATE', key: 'rejected_qty', render: (val, row) => (
      <span className={`text-[10px] font-bold ${val > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
        {val > 0 ? ((val / row.produced) * 100).toFixed(1) : '0.0'}%
      </span>
    )},
    { label: 'STATUS', key: 'status', render: (val) => (
      <StatusBadge status={val === 'COMPLETED' ? 'ACTIVE' : (val === 'IN_PROGRESS' ? 'CRITICAL' : val)} />
    )},
    { label: 'LAST UPDATED', key: 'lastUpdated', render: (val) => (
      <span className="text-[10px] text-slate-400 font-bold">{val}</span>
    )}
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded shadow-lg shadow-indigo-100">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900 font-bold tracking-tight">OEE Intelligence Matrix <span className="ml-2 text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-widest">+ LIVE</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                <Clock className="w-3.5 h-3.5" />
                Real-time update: {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 cursor-pointer hover:bg-slate-100 font-bold">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Apr 28 - May 5, 2026
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 cursor-pointer hover:bg-slate-100 font-bold">
            {timeRange}
            <ChevronRight className="w-3 h-3 rotate-90" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            EXPORT DATA
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {['Executive Overview', 'Machine Analytics', 'Loss Analysis'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-[11px] font-bold transition-all uppercase tracking-wider ${
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
        <div className="space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard title="Overall OEE" count={`${overall.oee}%`} subtitle="Current Score" color="bg-indigo-500" icon={Activity} trend="down" trendValue="2.4% vs last week" />
            <StatCard title="Availability" count={`${overall.availability}%`} subtitle="Machine Uptime" color="bg-emerald-500" icon={Clock} trend="up" trendValue="1.8% vs last week" />
            <StatCard title="Performance" count={`${overall.performance}%`} subtitle="Cycle Speed" color="bg-amber-500" icon={Zap} trend="down" trendValue="1.3% vs last week" />
            <StatCard title="Quality" count={`${overall.quality}%`} subtitle="First-Pass Yield" color="bg-indigo-600" icon={ShieldCheck} trend="up" trendValue="0.9% vs last week" />
            <StatCard title="Utilization" count={`${overall.utilization}%`} subtitle="Asset Usage" color="bg-blue-500" icon={Target} trend="up" trendValue="1.2% vs last week" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded p-4 border border-slate-100 shadow-sm flex flex-col items-center relative">
              <div className="flex items-center justify-between w-full mb-4">
                <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  Overall Effectiveness Index
                </h3>
                <MoreHorizontal className="w-4 h-4 text-slate-300" />
              </div>
              <div className="relative h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{v: Number(overall.oee)}, {v: 100 - Number(overall.oee)}]}
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
                  <span className="text-5xl text-slate-900 font-extrabold tracking-tight">{overall.oee}%</span>
                  <span className="text-[10px] text-slate-400 uppercase mt-2 font-bold tracking-widest">OEE SCORE</span>
                  <div className="mt-4 flex items-center gap-1 text-[11px] text-rose-500 font-bold">
                    <TrendingDown className="w-3 h-3" />
                    2.4% vs last week
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded p-4 border border-slate-100 shadow-sm flex flex-col relative">
              <div className="flex items-center justify-between w-full mb-4">
                <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  Workstation OEE Analysis
                </h3>
                <MoreHorizontal className="w-4 h-4 text-slate-300" />
              </div>
              <div className="flex-1 flex flex-col md:flex-row items-center gap-8 px-4">
                <div className="relative h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{v: Number(overall.oee)}, {v: 100 - Number(overall.oee)}]}
                        innerRadius={60} outerRadius={85}
                        paddingAngle={5} dataKey="v" stroke="none"
                      >
                        <Cell fill="#4f46e5" />
                        <Cell fill="#f8fafc" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl text-slate-900 font-bold tracking-tight">{overall.oee}%</span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Global OEE</span>
                  </div>
                </div>

                <div className="flex-1 space-y-5 w-full">
                  {[
                    { name: 'Availability Loss', value: data?.lossDistribution?.[0]?.value || 74.4, color: '#4f46e5' },
                    { name: 'Performance Loss', value: data?.lossDistribution?.[1]?.value || 20.4, color: '#6366f1' },
                    { name: 'Quality Loss', value: data?.lossDistribution?.[2]?.value || 3.9, color: '#818cf8' }
                  ].map((loss, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: loss.color}} />
                          <span className="text-[11px] text-slate-600 font-bold uppercase tracking-tight">{loss.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-900 font-extrabold">{loss.value}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${loss.value}%`, backgroundColor: loss.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-2 gap-4">
            {/* Workstation Efficiency List */}
            <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <h3 className="text-[10px] text-slate-900 tracking-widest flex items-center gap-2 font-bold uppercase">
                  <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                  Workstation Efficiency List
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                <div className="grid grid-cols-2 px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">
                  <span>Workstation</span>
                  <span className="text-right">OEE Score</span>
                </div>
                 {(data?.workstationAnalysis || []).map((ws, idx) => (
                   <div key={idx} className="p-2 hover:bg-slate-50 rounded transition-all flex items-center justify-between group">
                      <div className="flex flex-col">
                        <p className="text-[11px] text-slate-900 font-bold uppercase">{ws.workstation_name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{ws.workstation_code}</p>
                      </div>
                      <div className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">
                        {Number(ws.oee || 0).toFixed(1)}%
                      </div>
                   </div>
                 ))}
              </div>
              <div className="p-2 border-t border-slate-50">
                 <button className="w-full py-2 bg-slate-50 text-slate-500 text-[10px] font-bold rounded uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                   View All Workstations
                 </button>
              </div>
            </div>

            {/* Factor Comparison by Workstation */}
            <div className="xl:col-span-2 bg-white rounded border border-slate-100 shadow-sm p-4 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  Factor Comparison by Workstation
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Availability</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Performance</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-indigo-200 rounded-sm" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Quality</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.workstationAnalysis?.slice(0, 10) || []} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="workstation_code" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="availability" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={8} />
                    <Bar dataKey="performance" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} />
                    <Bar dataKey="quality" fill="#c7d2fe" radius={[2, 2, 0, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                 <div className="bg-emerald-50/50 p-2 rounded border border-emerald-100 flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center">
                     <Award className="w-4 h-4 text-emerald-600" />
                   </div>
                   <div>
                     <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest">Best Workstation</p>
                     <p className="text-[11px] text-slate-900 font-bold uppercase">WS-0004</p>
                     <p className="text-[9px] text-slate-500 font-bold uppercase">OEE: 24.8%</p>
                   </div>
                 </div>
                 <div className="bg-rose-50/50 p-2 rounded border border-rose-100 flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-rose-100 flex items-center justify-center">
                     <TrendingDown className="w-4 h-4 text-rose-600" />
                   </div>
                   <div>
                     <p className="text-[8px] text-rose-600 font-bold uppercase tracking-widest">Lowest Workstation</p>
                     <p className="text-[11px] text-slate-900 font-bold uppercase">WS-0007</p>
                     <p className="text-[9px] text-slate-500 font-bold uppercase">OEE: 16.2%</p>
                   </div>
                 </div>
                 <div className="bg-blue-50/50 p-2 rounded border border-blue-100 flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                     <Gauge className="w-4 h-4 text-blue-600" />
                   </div>
                   <div>
                     <p className="text-[8px] text-blue-600 font-bold uppercase tracking-widest">Average OEE</p>
                     <p className="text-[11px] text-slate-900 font-bold uppercase">20.3%</p>
                     <p className="text-[9px] text-slate-500 font-bold uppercase">All Workstations</p>
                   </div>
                 </div>
              </div>
            </div>

            {/* Loss Weighted Impact */}
            <div className="bg-white rounded border border-slate-100 shadow-sm p-4 flex flex-col h-[400px]">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                   <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                   Loss Weighted Impact
                 </h3>
                 <div className="flex gap-1">
                   <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                   <div className="w-2 h-2 bg-blue-500 rounded-full" />
                   <div className="w-2 h-2 bg-indigo-200 rounded-full" />
                 </div>
               </div>
               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-4">OEE Performance Gradient - <span className="text-slate-900">Avg: {overall.oee}%</span></p>
               
               <div className="flex-1">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={data?.workstationAnalysis?.slice(0, 10) || []} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                     <XAxis dataKey="workstation_code" hide />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                     <Bar dataKey="oee" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={12} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>

               <div className="mt-4 p-3 bg-indigo-50 rounded border border-indigo-100 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Info className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-900 font-bold uppercase mb-0.5 tracking-tight">Insight</p>
                    <p className="text-[10px] text-indigo-600 font-medium leading-relaxed">Availability loss contributes the most to OEE degradation across all workstations.</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-3">
              <Card title="OPERATIONAL LOG" icon={Layers} badge="LIVE MONITOR">
                <DataTable 
                  columns={recentOpsColumns} 
                  data={data?.recentOperations || []} 
                  loading={loading}
                />
                <div className="flex items-center justify-between mt-4">
                  <button className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                    View All Logs <ArrowRight className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded">1</button>
                    <button className="px-2 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded hover:bg-slate-100">2</button>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                  {data?.kpis?.slice(0, 4).map((kpi, i) => (
                    <div key={i} className="bg-white rounded border border-slate-100 p-3 shadow-sm flex flex-col items-center justify-center text-center group hover:border-indigo-100 transition-colors">
                       <div className={`w-8 h-8 rounded flex items-center justify-center mb-2 bg-slate-50 group-hover:bg-indigo-50 transition-colors`}>
                         {i === 0 && <Monitor className="w-4 h-4 text-indigo-600" />}
                         {i === 1 && <Zap className="w-4 h-4 text-emerald-600" />}
                         {i === 2 && <Pause className="w-4 h-4 text-amber-600" />}
                         {i === 3 && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                       </div>
                       <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">{kpi.label}</p>
                       <p className="text-xl text-slate-900 font-extrabold">{kpi.value}</p>
                       <p className={`text-[8px] font-extrabold uppercase mt-1 ${kpi.status === 'Running' || kpi.status === 'Active' ? 'text-emerald-500' : (kpi.status === 'Idle' ? 'text-amber-500' : 'text-rose-500')}`}>
                         {kpi.status}
                       </p>
                    </div>
                  ))}
               </div>

               <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-4">
                    <Activity className="w-6 h-6 text-indigo-600 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <div className="text-right">
                       <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Data Accuracy</p>
                       <p className="text-xl text-slate-900 font-extrabold">98.7%</p>
                       <p className="text-[8px] text-slate-400 font-bold uppercase">This Week</p>
                    </div>
                  </div>
                  <div className="relative h-20 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        {v: 95}, {v: 97}, {v: 96}, {v: 98}, {v: 99}, {v: 98.7}
                      ]}>
                        <Area type="monotone" dataKey="v" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.05} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-12 h-12 rounded-full border-2 border-slate-100 border-t-indigo-600 animate-[spin_3s_linear_infinite]" />
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Machine Analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {(data?.workstationAnalysis || []).map((ws, idx) => (
             <div key={idx} className="bg-white rounded border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all group relative">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 border border-slate-100 rounded flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                        <Cpu className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="text-xs text-slate-900 font-bold uppercase leading-tight">{ws.workstation_name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tight">{ws.workstation_code}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold border border-emerald-100 uppercase tracking-tighter">
                     <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                     active
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mb-6">
                   {[
                     { label: 'Availability', value: ws.availability, code: 'AVAILABILITY' },
                     { label: 'Performance', value: ws.performance, code: 'PERFORMANCE' },
                     { label: 'Quality', value: ws.quality, code: 'QUALITY' }
                   ].map((f, i) => (
                     <div key={i} className="bg-slate-50/50 p-1.5 rounded text-center border border-slate-50">
                        <p className="text-[6px] text-slate-400 font-bold uppercase mb-1 truncate">{f.label}</p>
                        <p className="text-xs text-slate-500 font-extrabold">{Number(f.value || 0).toFixed(1)}%</p>
                        <p className="text-[6px] text-slate-300 font-black uppercase mt-0.5">{f.code}</p>
                     </div>
                   ))}
                </div>

                <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                   <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-1">Overall OEE</p>
                      <p className="text-2xl text-slate-900 font-extrabold tracking-tighter leading-none">{Number(ws.oee || 0).toFixed(1)}%</p>
                   </div>
                   <button className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase hover:text-indigo-600 transition-colors">
                      Analysis
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'Loss Analysis' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
           <div className="bg-white rounded border border-slate-100 p-4 shadow-sm h-[400px] flex flex-col">
              <h3 className="text-[10px] text-slate-400 uppercase tracking-widest mb-6 font-bold flex items-center gap-2">
                 <Clock className="w-3.5 h-3.5 text-indigo-600" />
                 Loss Category Distribution
              </h3>
              <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12">
                 <div className="w-48 h-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={data?.lossDistribution || []}
                             innerRadius={60}
                             outerRadius={85}
                             paddingAngle={5}
                             dataKey="value"
                             stroke="none"
                          >
                             {data?.lossDistribution?.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                             ))}
                          </Pie>
                          <Tooltip />
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Loss Impact</span>
                       <span className="text-xl text-slate-900 font-bold">100%</span>
                    </div>
                 </div>
                 <div className="space-y-3 flex-1 max-w-xs">
                    {(data?.lossDistribution || []).map((loss, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-transparent hover:border-slate-100 transition-all group">
                         <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.chart[i % COLORS.chart.length] }} />
                            <span className="text-[11px] text-slate-600 font-bold uppercase">{loss.name}</span>
                         </div>
                         <span className="text-[11px] text-slate-900 font-extrabold">{loss.value}%</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="bg-white rounded border border-slate-100 p-4 shadow-sm h-[400px] flex flex-col">
              <h3 className="text-[10px] text-slate-400 uppercase tracking-widest mb-6 font-bold flex items-center gap-2">
                 <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                 Production Bottlenecks
              </h3>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                 {(data?.bottlenecks || []).map((b, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded border border-transparent hover:border-rose-100 transition-all group">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                             </div>
                             <div>
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Performance Constraint</p>
                                <h4 className="text-xs text-slate-900 font-extrabold uppercase">{b.name}</h4>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-xl text-rose-600 font-extrabold tracking-tighter">{b.performance}%</p>
                             <p className="text-[8px] text-rose-400 font-bold uppercase tracking-widest">Efficiency Gap: {b.gap}%</p>
                          </div>
                       </div>
                       <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full transition-all duration-1000" style={{ width: `${b.performance}%` }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default OEEAnalysis;
