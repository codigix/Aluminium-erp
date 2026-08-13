import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
import { Card, Button, StatusBadge, DataTable, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';

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

  const handleExport = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // 1. System Overview
    const systemData = [
      { Metric: 'System OEE', Value: `${data.kpis?.oee || 0}%` },
      { Metric: 'Performance', Value: `${data.kpis?.performance || 0}%` },
      { Metric: 'Availability', Value: `${data.kpis?.availability || 0}%` },
      { Metric: 'Active Units', Value: data.assetHealth?.active || 0 },
      { Metric: 'System Alerts', Value: '5' }
    ];
    const wsSystem = XLSX.utils.json_to_sheet(systemData);
    XLSX.utils.book_append_sheet(wb, wsSystem, "System Summary");

    // 2. Temporal Asset Analysis
    if (data.temporalAnalysis) {
      const temporalData = data.temporalAnalysis.map(item => ({
        'Workstation': item.name,
        'Productive Time (Hrs)': item.productive,
        'Idle Time (Hrs)': item.idle
      }));
      const wsTemporal = XLSX.utils.json_to_sheet(temporalData);
      XLSX.utils.book_append_sheet(wb, wsTemporal, "Asset Analysis");
    }

    // 3. Efficiency Stream
    if (data.efficiencyStream) {
      const efficiencyData = data.efficiencyStream.map(item => ({
        'Timestamp': item.name,
        'OEE Score %': item.oeeScore,
        'Availability %': item.availability,
        'Performance %': item.performance
      }));
      const wsEfficiency = XLSX.utils.json_to_sheet(efficiencyData);
      XLSX.utils.book_append_sheet(wb, wsEfficiency, "Efficiency Stream");
    }

    XLSX.writeFile(wb, `Machine_Analysis_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const StatCard = ({ title, amount, subtitle, icon: Icon, color, trend, trendValue, animate }) => (
    <div className="bg-white rounded p-3 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs text-slate-400    mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl text-slate-900  ">{amount}</h3>
            {trendValue && (
              <span className={`flex items-center text-xs  ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className={`w-4 h-4 ${animate ? 'animate-pulse' : ''}`} />
        </div>
      </div>
    </div>
  );

  const isDataLoading = loading || !data;

  const kpis = [
    { label: 'System OEE', value: `${data?.kpis?.oee || 0}%`, icon: Waves, color: 'bg-indigo-500', sub: 'Plant Efficiency', trend: 'down', trendValue: '1.2%' },
    { label: 'Performance', value: `${data?.kpis?.performance || 0}%`, icon: TrendingUp, color: 'bg-amber-500', sub: 'Global Avg', trend: 'up', trendValue: '0.8%' },
    { label: 'Availability', value: `${data?.kpis?.availability || 0}%`, icon: Clock, color: 'bg-blue-500', sub: 'Uptime Index', trend: 'up', trendValue: '2.1%' },
    { label: 'Active Units', value: data?.assetHealth?.active || 0, icon: Zap, color: 'bg-emerald-500', sub: 'Live Stream', animate: true },
    { label: 'System Alerts', value: '5', icon: AlertTriangle, color: 'bg-rose-500', sub: 'Attention Req' }
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-600 rounded shadow-lg shadow-indigo-200">
            <Monitor size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900  ">Machine Analysis Matrix <span className="ml-2 text-xs bg-indigo-50 text-rose-600 px-1.5 py-0.5 rounded border border-indigo-100  ">+ LIVE</span></h1>
            <div className="flex items-center gap-2 mt-1">
               <div className="flex items-center gap-1.5 text-xs text-slate-400 ">
                 <Clock className="w-3.5 h-3.5" />
                 Matrix Sync: {lastUpdated.toLocaleTimeString()}
               </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 cursor-pointer hover:bg-slate-100  ">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Live Monitor
          </div>
          <button 
            onClick={fetchStats}
            className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 p-2 bg-rose-600 text-white rounded text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 "
          >
            <Download className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {isDataLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          kpis.map((kpi, idx) => (
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
          ))
        )}
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
            className={`flex items-center gap-2 p-2 rounded text-xs    transition-all border ${
              activeTab === tab.id 
                ? 'bg-rose-600 text-white border-rose-600 shadow-md' 
                : 'bg-white text-slate-500 border-slate-200 hover:text-rose-600 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-2">
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col items-center relative">
                 <div className="flex items-center justify-between w-full mb-4">
                    <h3 className="text-xs text-slate-400    flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                       Asset Health Spread
                    </h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-300" />
                 </div>
                 <div className="relative h-full w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={[
                                { name: 'Active', value: data?.assetHealth?.active || 0 },
                                { name: 'Idle', value: data?.assetHealth?.idle || 0 }
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
                       <span className="text-5xl  text-slate-900 er">{data?.assetHealth?.total || 0}</span>
                       <span className="text-xs  text-slate-400   mt-2">Total Units</span>
                       <div className="mt-4 flex items-center gap-2">
                          <div className="flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <span className="text-xs text-slate-500  ">{data?.assetHealth?.active || 0} Active</span>
                          </div>
                          <div className="flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-slate-200" />
                             <span className="text-xs text-slate-500  ">{data?.assetHealth?.idle || 0} Idle</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="xl:col-span-2 bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col relative">
                 <div className="flex items-center justify-between w-full mb-8">
                    <h3 className="text-xs text-slate-400    flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5 text-rose-600" />
                       Temporal Asset Analysis
                    </h3>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-rose-600 rounded-sm" />
                          <span className="text-[9px] text-slate-500  ">Productive</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-slate-100 rounded-sm" />
                          <span className="text-[9px] text-slate-500  ">Idle Time</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={data?.temporalAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="workstation_code" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="productive" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={30} />
                          <Bar dataKey="idle" fill="#f1f5f9" radius={[2, 2, 0, 0]} barSize={30} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col relative">
              <div className="flex items-center justify-between w-full mb-8">
                 <h3 className="text-xs text-slate-400    flex items-center gap-2">
                    <Waves className="w-3.5 h-3.5 text-rose-600" />
                    Multi-Factor Efficiency Stream
                 </h3>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 bg-rose-600 rounded-sm" />
                       <span className="text-[9px] text-slate-500  ">OEE Score</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                       <span className="text-[9px] text-slate-500  ">Availability</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
                       <span className="text-[9px] text-slate-500  ">Performance</span>
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
                    <h3 className="text-xs text-slate-400    flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5 text-rose-600" />
                       Line Throughput Analysis
                    </h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-300" />
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={data?.lineAnalysis || []} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                             <linearGradient id="colorLines" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                          <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Area type="monotone" dataKey="performance" name="Performance" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorLines)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="mt-4 p-3 bg-indigo-50 rounded border border-indigo-100 flex items-center justify-between">
                    <span className="text-xs text-indigo-900   ">Line Optimization Alert: {data?.lineAnalysis?.[0]?.name || 'Main Line'} is running at {data?.lineAnalysis?.[0]?.oee || '0'}% capacity</span>
                    <button className="text-xs text-rose-600    hover:underline">Re-balance Floor</button>
                 </div>
              </div>

              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm h-[400px] flex flex-col relative">
                 <h3 className="text-xs text-slate-400    flex items-center gap-2 mb-8">
                    <Layers className="w-3.5 h-3.5 text-rose-600" />
                    Line Availability Spread
                 </h3>
                 <div className="flex-1 flex flex-col justify-center gap-8">
                    <div className="relative h-48 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                             <Pie
                                data={data?.lineAnalysis?.map((line, idx) => ({
                                  name: line.name,
                                  value: parseFloat(line.availability)
                                })) || []}
                                innerRadius={65} outerRadius={90}
                                paddingAngle={8} dataKey="value" stroke="none"
                             >
                                {data?.lineAnalysis?.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                                ))}
                             </Pie>
                          </PieChart>
                       </ResponsiveContainer>
                       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl  text-slate-900">{data?.kpis?.availability}%</span>
                          <span className="text-[8px]  text-slate-400   mt-1">Plant Availability</span>
                       </div>
                    </div>
                    <div className="space-y-4 max-h-[120px] overflow-y-auto pr-2">
                       {data?.lineAnalysis?.map((line, idx) => (
                         <div key={idx} className="flex justify-between items-center px-4">
                            <div className="flex items-center gap-2">
                               <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.chart[idx % COLORS.chart.length] }} />
                               <span className="text-xs text-slate-500   truncate max-w-[100px]">{line.name}</span>
                            </div>
                            <span className="text-xs text-slate-900 font-extrabold er">{line.oee}% OEE</span>
                         </div>
                       ))}
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
                     <div className="w-10 h-10 border border-slate-100 rounded flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-rose-600 transition-colors shadow-sm">
                        <Cpu className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="text-xs text-slate-900   leading-tight">{ws.name}</h4>
                        <p className="text-xs text-slate-400   mt-1 ">UNIT-{(idx + 101).toString()}</p>
                     </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1 ${ws.status === 'RUNNING' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'} rounded text-[9px]  border  er`}>
                     <div className={`w-1.5 h-1.5 ${ws.status === 'RUNNING' ? 'bg-emerald-600' : 'bg-orange-600'} rounded-full animate-pulse`} />
                     {ws.status === 'RUNNING' ? 'Running' : 'Idle'}
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                   <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400   ">Efficiency</span>
                      <span className="text-xs text-slate-900 font-extrabold">{ws.productive}%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div className={`${ws.status === 'RUNNING' ? 'bg-emerald-400' : 'bg-orange-400'} h-full rounded-full transition-all duration-1000`} style={{ width: `${ws.productive}%` }} />
                   </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <span className="text-[9px] text-slate-400    flex items-center gap-1.5">
                     <Activity className="w-3 h-3 text-indigo-400" />
                     Telemetry Active
                   </span>
                   <button className="p-2 hover:bg-slate-50 rounded transition-colors text-slate-400 hover:text-rose-600">
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
                    <h3 className="text-xs text-slate-400    flex items-center gap-2">
                       <BarChart3 className="w-4 h-4 text-rose-600" />
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
                    <h3 className="text-xs text-slate-400    flex items-center gap-2">
                       <Gauge className="w-4 h-4 text-rose-600" />
                       OEE Component Decomposition
                    </h3>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-rose-600 rounded-sm" />
                          <span className="text-[9px] text-slate-500  ">A</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-indigo-400 rounded-sm" />
                          <span className="text-[9px] text-slate-500  ">P</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-indigo-100 rounded-sm" />
                          <span className="text-[9px] text-slate-500  ">Q</span>
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
                    <div className="w-12 h-12 rounded bg-rose-600 flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:rotate-6 transition-transform">
                       <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                       <h4 className="text-[12px] text-slate-900   ">Operational Efficiency Forecast</h4>
                       <p className="text-xs text-rose-600    mt-1 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Predicted +4.2% Increase in next 72 hours
                       </p>
                    </div>
                 </div>
                 <button className="px-5 py-2.5 bg-rose-600 text-white rounded text-xs   hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 ">
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
