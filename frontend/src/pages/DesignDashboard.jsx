import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
import { 
  Palette, 
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
  PencilRuler,
  Layers,
  FileSearch
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DesignDashboard = ({ apiRequest }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      if (apiRequest) {
        const data = await apiRequest('/dashboard/design');
        setStats(data);
      } else {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/dashboard/design`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-ERP-Request': 'true'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch design stats');
        const data = await response.json();
        setStats(data);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching design dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, count, subtitle, color, icon: Icon, trend }) => (
    <div className="bg-white rounded  p-2 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs  text-slate-400   mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl  text-slate-900">{count}</h3>
            {trend && (
              <span className={`flex items-center text-xs  ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
        <p className="text-xs text-slate-500   ">Initializing Design Studio Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-12">
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded border border-slate-100  relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="p-2 bg-indigo-600 rounded shadow-indigo-200">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl  text-slate-900 ">Design Studio</h1>
              <span className="p-1 bg-indigo-50 text-indigo-600 rounded text-xs    border border-indigo-100">
                Engineering
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs  text-slate-400  ">
                <Clock className="w-3.5 h-3.5" />
                Updated {lastUpdated.toLocaleTimeString()}
              </div>
              <div className="w-1 h-1 rounded bg-slate-200" />
              <div className="flex items-center gap-1.5 text-xs  text-emerald-500  ">
                <ShieldCheck className="w-3.5 h-3.5" />
                BOM Approval Rate: 94%
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-5 p-2 bg-slate-50 text-slate-600 rounded text-xs  hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH DATA
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Projects" count={stats.activeProjects || 0} subtitle="In design phase" color="bg-indigo-500" icon={PencilRuler} trend={12} />
        <StatCard title="Pending BOMs" count={stats.pendingBoms || 0} subtitle="Awaiting submission" color="bg-emerald-500" icon={Layers} trend={5} />
        <StatCard title="Drawing Reviews" count={stats.drawingReviews || 0} subtitle="Pending approval" color="bg-amber-500" icon={FileSearch} />
        <StatCard title="Completed" count={stats.completedProjects || 0} subtitle="Released to production" color="bg-blue-500" icon={CheckCircle} trend={8} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Release Chart */}
        <div className="xl:col-span-2 bg-white rounded] p-2 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-md  text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                Engineering velocity
              </h3>
              <p className="text-xs text-slate-500   mt-1 ">PROJECT RELEASE THROUGHPUT</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData || []}>
                <defs>
                  <linearGradient id="colorReleases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="releases" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorReleases)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Design Health */}
        <div className="bg-white rounded] p-2 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-md  text-slate-900  mb-2">Engineering Health</h3>
          <div className="space-y-2 flex-1">
            {(stats.health || [
              { label: 'BOM Accuracy', value: 0, color: 'bg-indigo-500' },
              { label: 'Timeline Adherence', value: 0, color: 'bg-emerald-500' },
              { label: 'Revision Rate', value: 0, color: 'bg-amber-500' },
              { label: 'Technical Compliance', value: 0, color: 'bg-blue-500' }
            ]).map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs   text-slate-500  ">{item.label}</span>
                  <span className="text-md  text-slate-900">{item.value}%</span>
                </div>
                <div className="h-3 w-full bg-slate-50 rounded overflow-hidden border border-slate-100">
                  <div className={`h-full ${item.color} rounded transition-all duration-1000`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Design Tasks */}
      <div className="bg-white rounded  border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-xs  text-slate-900 tracking-tight flex items-center gap-2">
              <PencilRuler className="w-4 h-4 text-indigo-600" />
              CRITICAL DESIGN QUEUE
            </h3>
            <p className="text-xs text-slate-500  mt-0.5  ">AWAITING DRAWINGS & BOM RELEASES</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/20">
                <th className="px-8 py-4 text-xs  text-slate-400  ">Project Code</th>
                <th className="px-8 py-4 text-xs  text-slate-400  ">Client</th>
                <th className="px-8 py-4 text-xs  text-slate-400  ">Deadline</th>
                <th className="px-8 py-4 text-xs  text-slate-400  ">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(stats.pendingTasks || []).map((task, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 text-xs  text-slate-900">{task.project_code}</td>
                  <td className="px-8 py-4 text-xs text-slate-600">{task.company_name}</td>
                  <td className="px-8 py-4 text-xs text-slate-600">{task.deadline}</td>
                  <td className="px-8 py-4">
                    <StatusBadge status={task.status} />
                  </td>
                </tr>
              ))}
              {(!stats.pendingTasks || stats.pendingTasks.length === 0) && (
                <tr>
                  <td colSpan="4" className="px-8 py-12 text-center text-xs text-slate-400   ">No pending design projects</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DesignDashboard;
