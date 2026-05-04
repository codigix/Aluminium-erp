import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Activity, Zap, ShieldCheck, RefreshCw,
  TrendingUp, Clock, Monitor, LayoutDashboard,
  Target, ZapOff, Gauge, Waves, Download, Calendar
} from 'lucide-react';
import { Card, Button } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const MachineAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/machine-analysis`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
                {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
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
          <Monitor className="w-3 h-3 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900 tracking-tight">Syncing Machine Intelligence</h3>
          <p className="text-xs text-slate-500 mt-1">Analyzing asset health, temporal analysis and efficiency streams...</p>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Overall OEE', value: `${data?.kpis?.oee}%`, icon: Waves, color: 'bg-indigo-500', sub: 'Efficiency Score' },
    { label: 'Performance', value: `${data?.kpis?.performance}%`, icon: TrendingUp, color: 'bg-amber-500', sub: 'Throughput Avg' },
    { label: 'Availability', value: `${data?.kpis?.availability}%`, icon: Clock, color: 'bg-blue-500', sub: 'Uptime Rating' },
    { label: 'Quality Index', value: `${data?.kpis?.quality}%`, icon: ShieldCheck, color: 'bg-emerald-500', sub: 'Rework Mitigation' },
    { label: 'Asset Status', value: data?.kpis?.operationalStatus, icon: Zap, color: 'bg-purple-500', sub: 'Live Assets' }
  ];

  return (
    <div className="space-y-2 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900">Machine Analysis Matrix</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 cursor-pointer hover:bg-slate-100">
            <Calendar className="w-3.5 h-3.5" />
            Live Monitor
          </div>
          <button 
            onClick={fetchStats}
            className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            EXPORT DATA
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {kpis.map((kpi, idx) => (
          <StatCard 
            key={idx}
            title={kpi.label} 
            amount={kpi.value} 
            subtitle={kpi.sub}
            color={kpi.color}
            icon={kpi.icon}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white/50 border border-slate-100 p-1 rounded w-fit">
        {['overview', 'lines', 'machines', 'efficiency'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                : 'text-slate-500 hover:text-indigo-600 hover:bg-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <Card className="bg-white rounded p-8 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-md text-slate-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Asset Health Spread
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase">Live Asset Monitoring</p>
               </div>
            </div>

            <div className="relative h-[300px] w-full flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={[
                           { name: 'active', value: data?.assetHealth?.active },
                           { name: 'idle', value: data?.assetHealth?.idle }
                        ]}
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        <Cell fill="#10b981" />
                        <Cell fill="#f1f5f9" />
                     </Pie>
                     <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-black text-slate-900">{data?.assetHealth?.total}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Assets</span>
               </div>
            </div>
         </Card>

         <Card className="lg:col-span-2 bg-white rounded p-8 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-md text-slate-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Temporal Asset Analysis
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase">Active vs Idle Duration (Top 10)</p>
               </div>
            </div>

            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.temporalAnalysis}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 9, fill: '#64748b', fontWeight: 900 }} 
                       dy={10}
                     />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#cbd5e1', fontWeight: 800 }} />
                     <Tooltip 
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                     />
                     <Bar dataKey="productive" fill="#4f46e5" stackId="a" barSize={30} />
                     <Bar dataKey="idle" fill="#f1f5f9" stackId="a" barSize={30} radius={[4, 4, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </Card>
      </div>

      <Card className="bg-white rounded p-8 border border-slate-100 shadow-sm flex flex-col">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="text-md text-slate-900 tracking-tight flex items-center gap-2">
                 <Gauge className="w-5 h-5 text-indigo-600" />
                 Multi-Factor Efficiency Stream
               </h3>
               <p className="text-xs text-slate-500 mt-1 uppercase">Holistic OEE Components Trend</p>
            </div>
         </div>

         <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data?.efficiencyStream}>
                  <defs>
                     <linearGradient id="colorOEE" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 900 }} 
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#cbd5e1', fontWeight: 900 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="oeeScore" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorOEE)" />
                  <Area type="monotone" dataKey="availability" stroke="#3b82f6" strokeWidth={2} fill="none" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="performance" stroke="#f59e0b" strokeWidth={2} fill="none" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="quality" stroke="#10b981" strokeWidth={2} fill="none" strokeDasharray="5 5" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </Card>
    </div>
  );
};

export default MachineAnalysis;