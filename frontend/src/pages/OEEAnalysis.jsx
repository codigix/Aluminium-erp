import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
  Lightbulb, ZapOff, CheckCircle2, User as UserIcon,
  Layout, AlertCircle, ArrowUpRight, ArrowDownRight, Database, ArrowRight,
  Pause, MoreHorizontal, HelpCircle, Wallet, ChevronDown
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
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const timeRangeOptions = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

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

  const dateRangeLabel = useMemo(() => {
    const end = new Date("2026-05-05"); // Based on environment date
    const start = new Date(end);
    
    if (timeRange === 'Daily') start.setDate(end.getDate() - 1);
    else if (timeRange === 'Weekly') start.setDate(end.getDate() - 7);
    else if (timeRange === 'Monthly') start.setMonth(end.getMonth() - 1);
    else if (timeRange === 'Yearly') start.setFullYear(end.getFullYear() - 1);

    const format = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${format(start)} - ${format(end)}`;
  }, [timeRange]);

  const handleExport = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    const overallData = [
      { Metric: 'Overall OEE', Value: `${data.overall?.oee || 0}%` },
      { Metric: 'Availability', Value: `${data.overall?.availability || 0}%` },
      { Metric: 'Performance', Value: `${data.overall?.performance || 0}%` },
      { Metric: 'Quality', Value: `${data.overall?.quality || 0}%` },
      { Metric: 'Utilization', Value: `${data.overall?.utilization || 0}%` }
    ];
    const wsOverall = XLSX.utils.json_to_sheet(overallData);
    XLSX.utils.book_append_sheet(wb, wsOverall, "Overall Summary");

    if (data.workstationAnalysis) {
      const wsAnalysisData = data.workstationAnalysis.map(ws => ({
        'Workstation Name': ws.workstation_name,
        'Code': ws.workstation_code,
        'OEE %': ws.oee,
        'Availability %': ws.availability,
        'Performance %': ws.performance,
        'Quality %': ws.quality
      }));
      const wsWorkstations = XLSX.utils.json_to_sheet(wsAnalysisData);
      XLSX.utils.book_append_sheet(wb, wsWorkstations, "Workstation Analysis");
    }

    XLSX.writeFile(wb, `OEE_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const StatCard = ({ title, count, subtitle, icon: Icon, color, trend, trendValue, animate }) => (
    <div className="bg-white rounded p-3 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-black text-slate-900">{count}</h3>
            {trendValue && (
              <span className={`flex items-center text-[10px] font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100').replace('600', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className={`w-4 h-4 ${animate ? 'animate-pulse' : ''}`} />
        </div>
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-600 rounded animate-spin" />
          <BrainCircuit className="w-6 h-6 text-rose-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 font-black tracking-tight uppercase">OEE Intelligence Matrix Syncing</h3>
          <p className="text-xs text-slate-500 mt-1">Synchronizing real-time telemetry and workstation metrics...</p>
        </div>
      </div>
    );
  }

  const overall = data?.overall || { oee: 0, availability: 0, performance: 0, quality: 0, utilization: 0 };

  const recentOpsColumns = [
    { label: 'ID / PROJECT', key: 'identifier', render: (val, row) => (
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-900 uppercase truncate max-w-[180px]">
          {row.project_name || 'Project Name'}
        </span>
        <span className="text-[9px] text-slate-400 font-bold">WO: {row.wo_number || 'N/A'}</span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-[8px] font-black text-slate-500 border border-slate-200">
            {data?.recentOperations?.indexOf(row) + 1}
          </span>
          <span className="text-[10px] font-black text-indigo-600">{val}</span>
        </div>
      </div>
    )},
    { label: 'OPERATION / STATUS', key: 'operation_name', render: (val, row) => (
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-900 uppercase">
          {val || 'Operation'}
        </span>
        <div className="mt-1">
          <StatusBadge status={row.status === 'IN_PROGRESS' ? 'CRITICAL' : (row.status === 'COMPLETED' ? 'SUCCESS' : row.status)} />
        </div>
      </div>
    )},
    { label: 'SPECIFICATION', key: 'item_description', render: (val) => (
      <div className="flex flex-col max-w-[200px]">
        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">Main Process</span>
        <span className="text-[10px] font-bold text-slate-600 truncate">{val || 'Item Description'}</span>
      </div>
    )},
    { label: 'PRODUCED', key: 'produced', className: 'text-center', render: (val) => (
      <span className="text-[11px] font-black text-slate-900">{parseFloat(val || 0).toFixed(3)}</span>
    )},
    { label: 'ACCEPTED', key: 'accepted_qty', className: 'text-center', render: (val) => (
      <span className="text-[11px] font-black text-emerald-600">{parseFloat(val || 0).toFixed(3)}</span>
    )},
    { label: 'TARGET', key: 'target', className: 'text-center', render: (val) => (
      <span className="text-[11px] font-black text-slate-400">{parseFloat(val || 0).toFixed(3)}</span>
    )},
    { label: 'TIME & COSTING', key: 'start_time', render: (val, row) => {
      const cycleTime = parseFloat(row.cycle_time || 0);
      const hourlyRate = parseFloat(row.hourly_rate || 0);
      const totalCost = (cycleTime / 60) * (row.produced || row.target || 1) * hourlyRate;
      
      const start = row.start_time ? new Date(row.start_time) : null;
      const end = row.end_time ? new Date(row.end_time) : (row.status === 'IN_PROGRESS' ? new Date() : null);
      let duration = '0m';
      if (start && end) {
        const diff = Math.floor((end - start) / (1000 * 60));
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      }
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5" />
            <span>{Math.round(cycleTime)} min/u • {duration}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <span className="font-medium text-emerald-600">₹{totalCost.toFixed(2)}</span>
            <span className="text-slate-400">@ ₹{hourlyRate}/hr</span>
          </div>
        </div>
      );
    }},
    { label: 'WORKSTATION', key: 'assetContext', render: (val) => (
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-900 uppercase">{val}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[8px] text-slate-400 font-bold uppercase">Online</span>
        </div>
      </div>
    )},
    { label: 'ASSIGNEE & TIME', key: 'operator_name', render: (val, row) => {
      const formatTime = (iso) => {
        if (!iso) return '--:--';
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      };
      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
               <UserIcon className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] font-black text-slate-700 uppercase">{val || 'Unassigned'}</span>
          </div>
          <span className="text-[9px] text-slate-400 font-bold mt-1">
            {formatTime(row.start_time)} - {row.status === 'COMPLETED' ? formatTime(row.end_time) : 'LIVE'}
          </span>
        </div>
      );
    }}
  ];

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 rounded shadow-lg shadow-rose-100">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900 font-black tracking-tight uppercase">OEE Intelligence Matrix</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" />
                Real-time stream: {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {dateRangeLabel}
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowRangeDropdown(!showRangeDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {timeRange}
              <ChevronDown className={`w-3 h-3 transition-transform ${showRangeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showRangeDropdown && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-slate-100 rounded shadow-xl z-50 overflow-hidden py-1 animate-in slide-in-from-top-2">
                {timeRangeOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => {
                      setTimeRange(opt);
                      setShowRangeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      timeRange === opt ? 'bg-rose-50 text-rose-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded text-[11px] font-black uppercase tracking-wider hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {['Executive Overview', 'Machine Analytics', 'Loss Analysis'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-[10px] font-black transition-all uppercase tracking-widest ${
              activeTab === tab 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-100' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Executive Overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Overall OEE" count={`${overall.oee}%`} subtitle="Efficiency Core" color="bg-indigo-500" icon={Activity} trend="down" trendValue="2.4%" />
            <StatCard title="Availability" count={`${overall.availability}%`} subtitle="Machine Uptime" color="bg-emerald-500" icon={Clock} trend="up" trendValue="1.8%" />
            <StatCard title="Performance" count={`${overall.performance}%`} subtitle="Cycle Velocity" color="bg-amber-500" icon={Zap} trend="down" trendValue="1.3%" />
            <StatCard title="Quality" count={`${overall.quality}%`} subtitle="Yield Quality" color="bg-rose-600" icon={ShieldCheck} trend="up" trendValue="0.9%" />
            <StatCard title="Utilization" count={`${overall.utilization}%`} subtitle="Asset Loading" color="bg-blue-500" icon={Target} trend="up" trendValue="1.2%" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded p-6 border border-slate-100 shadow-sm flex flex-col items-center relative h-[400px]">
              <div className="flex items-center justify-between w-full mb-8">
                <h3 className="text-xs text-slate-900 font-black tracking-tight uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" />
                  Effectiveness Index
                </h3>
              </div>
              <div className="relative h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{v: parseFloat(overall.oee) || 0.1}, {v: 100 - (parseFloat(overall.oee) || 0.1)}]}
                      startAngle={210} endAngle={-30}
                      innerRadius={85} outerRadius={115}
                      paddingAngle={0} dataKey="v" stroke="none"
                    >
                      <Cell fill={overall.oee > 0 ? "#4f46e5" : "#f1f5f9"} />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                  <span className="text-6xl text-slate-900 font-black tracking-tighter">{overall.oee}%</span>
                  <span className="text-[10px] text-slate-400 uppercase mt-2 font-black tracking-widest">OEE PERFORMANCE</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded border border-slate-100 shadow-sm p-6 flex flex-col h-[400px]">
              <h3 className="text-xs text-slate-900 font-black tracking-tight uppercase mb-8 flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-600" />
                Workstation Efficiency Gradient
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.workstationAnalysis?.length > 0 ? data.workstationAnalysis.slice(0, 10) : [{workstation_code: 'WS-0001', oee: 0}, {workstation_code: 'WS-0002', oee: 0}, {workstation_code: 'WS-0003', oee: 0}]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="workstation_code" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} domain={[0, 100]} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="oee" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <Card title="OPERATIONAL LOG" icon={Layers} badge="LIVE MONITOR">
            <DataTable 
              columns={recentOpsColumns} 
              data={data?.recentOperations || []} 
              loading={loading}
              pageSize={10}
            />
          </Card>
        </div>
      )}

      {activeTab === 'Machine Analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {(data?.workstationAnalysis || []).map((ws, idx) => (
             <div key={idx} className="bg-white rounded border border-slate-100 p-4 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-24 h-24 bg-indigo-500 opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 border border-slate-100 rounded flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-rose-600 transition-colors shadow-sm">
                        <Cpu className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="text-xs text-slate-900 font-black uppercase leading-tight">{ws.workstation_name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{ws.workstation_code}</p>
                     </div>
                  </div>
                  <StatusBadge status={ws.hasActivity ? "ACTIVE" : "PENDING"} />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6 relative z-10">
                   {[
                     { label: 'Avail.', value: ws.availability },
                     { label: 'Perf.', value: ws.performance },
                     { label: 'Qual.', value: ws.quality }
                   ].map((f, i) => (
                     <div key={i} className="bg-slate-50/50 p-2 rounded text-center border border-slate-50">
                        <p className="text-[8px] text-slate-400 font-black uppercase mb-1">{f.label}</p>
                        <p className="text-[11px] text-slate-900 font-black">{Number(f.value || 0).toFixed(1)}%</p>
                     </div>
                   ))}
                </div>

                <div className="flex items-end justify-between pt-4 border-t border-slate-50 relative z-10">
                   <div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">OEE SCORE</p>
                      <p className="text-2xl text-slate-900 font-black tracking-tighter leading-none">{Number(ws.oee || 0).toFixed(1)}%</p>
                   </div>
                   <button className="p-2 bg-slate-50 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all">
                      <ArrowUpRight className="w-4 h-4" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'Loss Analysis' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
           <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col">
              <h3 className="text-xs text-slate-900 font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                 <Clock className="w-4 h-4 text-rose-600" />
                 Loss Vector Distribution
              </h3>
              <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12">
                 <div className="w-56 h-56 relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={(data?.lossDistribution && data.lossDistribution.some(l => parseFloat(l.value) > 0)) ? data.lossDistribution : [{name: 'No Loss', value: 100}]}
                             innerRadius={75}
                             outerRadius={105}
                             paddingAngle={5}
                             dataKey="value"
                             stroke="none"
                          >
                             {data?.lossDistribution?.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={parseFloat(entry.value) > 0 ? COLORS.chart[index % COLORS.chart.length] : '#f1f5f9'} />
                             ))}
                             {(!data?.lossDistribution || !data.lossDistribution.some(l => parseFloat(l.value) > 0)) && <Cell fill="#f1f5f9" />}
                          </Pie>
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Aggregate</span>
                       <span className="text-2xl text-slate-900 font-black">{(data?.lossDistribution?.reduce((acc, curr) => acc + parseFloat(curr.value), 0) || 0).toFixed(0)}%</span>
                    </div>
                 </div>
                 <div className="space-y-3 flex-1">
                    {(data?.lossDistribution || []).map((loss, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 rounded border border-slate-100 hover:bg-slate-50 transition-all">
                         <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.chart[i % COLORS.chart.length] }} />
                            <span className="text-[11px] text-slate-600 font-black uppercase tracking-widest">{loss.name}</span>
                         </div>
                         <span className="text-xs text-slate-900 font-black">{loss.value}%</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="bg-white rounded border border-slate-100 p-6 shadow-sm h-[400px] flex flex-col">
              <h3 className="text-xs text-slate-900 font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-rose-500" />
                 Operational Bottlenecks
              </h3>
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                 {(data?.bottlenecks || []).map((b, i) => (
                    <div key={i} className="p-4 bg-slate-50/50 rounded border border-slate-100 hover:border-rose-100 transition-all group">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-110 transition-transform">
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                             </div>
                             <div>
                                <p className="text-xs text-slate-900 font-black uppercase">{b.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Critical Asset</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-black text-rose-600">{b.gap}%</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gap to Target</p>
                          </div>
                       </div>
                       <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${b.gap}%` }} />
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
