import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  Activity, Zap, ShieldCheck, RefreshCw,
  TrendingUp, Clock, Monitor, LayoutDashboard,
  Target, ZapOff, Gauge, Waves, Download, Calendar,
  Cpu, Layers, BarChart3, Info, ChevronRight,
  AlertTriangle, CheckCircle2, PlayCircle, PauseCircle,
  Settings, Database, Filter, ArrowRight, Flame,
  TrendingDown, Box, Microscope, Wind, MoreHorizontal
} from 'lucide-react';
import { Card, Button, StatusBadge, DataTable } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const COLORS = {
  indigo: '#4f46e5',
  blue: '#3b82f6',
  amber: '#f59e0b',
  emerald: '#10b981',
  rose: '#ef4444',
  slate: '#94a3b8',
  chart: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']
};

const MachineAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/machine-analysis`, {
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
      console.error('Error fetching machine analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, amount, subtitle, icon: Icon, color, trend, trendValue, animate }) => (
    <div className="bg-white rounded p-3 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl text-slate-900 font-bold tracking-tight">{amount}</h3>
            {trendValue && (
              <span className={`flex items-center text-[10px] font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
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
          <Monitor className="w-4 h-4 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 font-bold tracking-tight">Machine Pulse Sync</h3>
          <p className="text-xs text-slate-500 mt-1">Aggregating real-time line telemetry and asset health...</p>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'System OEE', value: `${data?.kpis?.oee}%`, icon: Waves, color: 'bg-indigo-500', sub: 'Plant Efficiency', trend: 'down', trendValue: '1.2%' },
    { label: 'Performance', value: `${data?.kpis?.performance}%`, icon: TrendingUp, color: 'bg-amber-500', sub: 'Global Avg', trend: 'up', trendValue: '0.8%' },
    { label: 'Availability', value: `${data?.kpis?.availability}%`, icon: Clock, color: 'bg-blue-500', sub: 'Uptime Index', trend: 'up', trendValue: '2.1%' },
    { label: 'Active Units', value: data?.assetHealth?.active, icon: Zap, color: 'bg-emerald-500', sub: 'Live Stream', animate: true },
    { label: 'System Alerts', value: '5', icon: AlertTriangle, color: 'bg-rose-500', sub: 'Attention Req' }
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900 font-bold tracking-tight">Machine Analysis Matrix <span className="ml-2 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">+ LIVE</span></h1>
            <div className="flex items-center gap-2 mt-1">
               <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                 <Clock className="w-3.5 h-3.5" />
                 Matrix Sync: {lastUpdated.toLocaleTimeString()}
               </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 cursor-pointer hover:bg-slate-100 font-bold uppercase">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Live Monitor
          </div>
          <button 
            onClick={fetchStats}
            className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 uppercase">
            <Download className="w-4 h-4" />
            GENERATE REPORT
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi, idx) => (
          <StatCard 
            key={idx}
            title={kpi.label} 
            amount={kpi.value} 
            subtitle={kpi.sub}
            color={kpi.color}
            icon={kpi.icon}
            trend={kpi.trend}
            trendValue={kpi.trendValue}
            animate={kpi.animate}
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'Lines', label: 'Production Lines', icon: Layers },
          { id: 'Machines', label: 'Asset Monitor', icon: Cpu },
          { id: 'Efficiency', label: 'Efficiency Matrix', icon: BarChart3 }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all border ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-4">
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col items-center relative">
                 <div className="flex items-center justify-between w-full mb-4">
                    <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                       Asset Health Spread
                    </h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-300" />
                 </div>
                 <div className="relative h-full w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={[
                                { name: 'Active', value: data?.assetHealth?.active },
                                { name: 'Idle', value: data?.assetHealth?.idle }
                             ]}
                             innerRadius={80} outerRadius={110}
                             paddingAngle={5} dataKey="value" stroke="none"
                          >
                             <Cell fill="#10b981" />
                             <Cell fill="#f1f5f9" />
                          </Pie>
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                       <span className="text-5xl font-black text-slate-900 tracking-tighter">{data?.assetHealth?.total}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total Units</span>
                       <div className="mt-4 flex items-center gap-2">
                          <div className="flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <span className="text-[10px] text-slate-500 font-bold uppercase">{data?.assetHealth?.active} Active</span>
                          </div>
                          <div className="flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-slate-200" />
                             <span className="text-[10px] text-slate-500 font-bold uppercase">{data?.assetHealth?.idle} Idle</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="xl:col-span-2 bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col relative">
                 <div className="flex items-center justify-between w-full mb-8">
                    <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5 text-indigo-600" />
                       Temporal Asset Analysis
                    </h3>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Productive</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-slate-100 rounded-sm" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Idle Time</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={data?.temporalAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="productive" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={40} />
                          <Bar dataKey="idle" fill="#f1f5f9" radius={[2, 2, 0, 0]} barSize={40} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col relative">
              <div className="flex items-center justify-between w-full mb-8">
                 <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                    <Waves className="w-3.5 h-3.5 text-indigo-600" />
                    Multi-Factor Efficiency Stream
                 </h3>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm" />
                       <span className="text-[9px] text-slate-500 font-bold uppercase">OEE Score</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                       <span className="text-[9px] text-slate-500 font-bold uppercase">Availability</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
                       <span className="text-[9px] text-slate-500 font-bold uppercase">Performance</span>
                    </div>
                 </div>
              </div>
              <div className="flex-1">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.efficiencyStream}>
                       <defs>
                          <linearGradient id="colorOEE" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                       <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       <Area type="monotone" dataKey="oeeScore" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorOEE)" />
                       <Area type="monotone" dataKey="availability" stroke="#3b82f6" strokeWidth={1} fill="none" strokeDasharray="5 5" />
                       <Area type="monotone" dataKey="performance" stroke="#f59e0b" strokeWidth={1} fill="none" strokeDasharray="5 5" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'Lines' && (
        <div className="space-y-4">
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-white rounded border border-slate-100 p-4 shadow-sm h-[400px] flex flex-col relative">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5 text-indigo-600" />
                       Line Throughput Analysis
                    </h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-300" />
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={data?.temporalAnalysis || []} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                             <linearGradient id="colorLines" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" hide />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Area type="monotone" dataKey="productive" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorLines)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="mt-4 p-3 bg-indigo-50 rounded border border-indigo-100 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-900 font-bold uppercase tracking-wider">Line Optimization Alert: Main Assembly is running at 94.2% capacity</span>
                    <button className="text-[10px] text-indigo-600 font-black uppercase tracking-widest hover:underline">Re-balance Floor</button>
                 </div>
              </div>

              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm h-[400px] flex flex-col relative">
                 <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2 mb-8">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Line Availability Spread
                 </h3>
                 <div className="flex-1 flex flex-col justify-center gap-8">
                    <div className="relative h-48 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                             <Pie
                                data={[
                                  { name: 'ACTIVE', value: data?.assetHealth?.active },
                                  { name: 'IDLE', value: data?.assetHealth?.idle }
                                ]}
                                innerRadius={65} outerRadius={90}
                                paddingAngle={8} dataKey="value" stroke="none"
                             >
                                <Cell fill="#4f46e5" />
                                <Cell fill="#f1f5f9" />
                             </Pie>
                          </PieChart>
                       </ResponsiveContainer>
                       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-bold text-slate-900">{(data?.assetHealth?.active / data?.assetHealth?.total * 100).toFixed(0)}%</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Floor</span>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center px-4">
                          <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
                             <span className="text-[11px] text-slate-500 font-bold uppercase">Main Line</span>
                          </div>
                          <span className="text-[11px] text-slate-900 font-extrabold tracking-tighter">88.5% OEE</span>
                       </div>
                       <div className="flex justify-between items-center px-4">
                          <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-sm bg-indigo-200" />
                             <span className="text-[11px] text-slate-500 font-bold uppercase">Assembly B</span>
                          </div>
                          <span className="text-[11px] text-slate-900 font-extrabold tracking-tighter">74.2% OEE</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'Machines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {(data?.temporalAnalysis || []).map((ws, idx) => (
             <div key={idx} className="bg-white rounded border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all group relative">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 border border-slate-100 rounded flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                        <Cpu className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="text-xs text-slate-900 font-bold uppercase leading-tight">{ws.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">UNIT-{(idx + 101).toString()}</p>
                     </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1 ${ws.productive > 50 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'} rounded text-[9px] font-bold border uppercase tracking-tighter`}>
                     <div className={`w-1.5 h-1.5 ${ws.productive > 50 ? 'bg-emerald-600' : 'bg-amber-600'} rounded-full animate-pulse`} />
                     {ws.productive > 50 ? 'Running' : 'Idle'}
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Efficiency</span>
                      <span className="text-[11px] text-slate-900 font-extrabold">{ws.productive}%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: `${ws.productive}%` }} />
                   </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                     <Activity className="w-3 h-3 text-indigo-400" />
                     Telemetry Active
                   </span>
                   <button className="p-2 hover:bg-slate-50 rounded transition-colors text-slate-400 hover:text-indigo-600">
                      <Settings className="w-3.5 h-3.5" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'Efficiency' && (
        <div className="space-y-4">
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[450px] flex flex-col relative">
                 <div className="flex items-center justify-between w-full mb-8">
                    <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                       <BarChart3 className="w-4 h-4 text-indigo-600" />
                       Comparative Efficiency Index
                    </h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-300" />
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart outerRadius="80%" data={data?.efficiencyStream?.slice(0, 6) || []}>
                          <PolarGrid stroke="#f1f5f9" />
                          <PolarAngleAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} hide />
                          <Radar name="OEE" dataKey="oeeScore" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                          <Radar name="Availability" dataKey="availability" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                          <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[450px] flex flex-col relative">
                 <div className="flex items-center justify-between w-full mb-8">
                    <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                       <Gauge className="w-4 h-4 text-indigo-600" />
                       OEE Component Decomposition
                    </h3>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase">A</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-indigo-400 rounded-sm" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase">P</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-indigo-100 rounded-sm" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Q</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={data?.efficiencyStream?.slice(0, 10) || []} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" hide />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="availability" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={8} />
                          <Bar dataKey="performance" fill="#818cf8" radius={[2, 2, 0, 0]} barSize={8} />
                          <Bar dataKey="quality" fill="#c7d2fe" radius={[2, 2, 0, 0]} barSize={8} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-[0.03] rounded-bl-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
              <div className="p-4 rounded flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:rotate-6 transition-transform">
                       <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                       <h4 className="text-[12px] text-slate-900 font-black uppercase tracking-wider">Operational Efficiency Forecast</h4>
                       <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Predicted +4.2% Increase in next 72 hours
                       </p>
                    </div>
                 </div>
                 <button className="px-5 py-2.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 tracking-widest">
                    View Optimization Plan
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MachineAnalysis;
