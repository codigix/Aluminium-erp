import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';
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
  FileSearch,
  CheckSquare
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
    <div className="bg-white rounded-lg p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[110px]">
      <div className={`absolute top-0 right-0 w-20 h-20 ${color} opacity-[0.03] rounded-full -mr-6 -mt-6 transition-transform duration-500 group-hover:scale-125`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">{count}</h3>
        </div>
        <div className={`p-2.5 rounded-lg bg-slate-50 text-slate-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-600 shadow-sm`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 relative z-10">
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        {trend && (
          <span className={`flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );

  const isDataLoading = loading || !stats;

  // Filter out health items that are 0%
  const activeHealth = (stats?.health || []).filter(item => item.value > 0);

  // Quick Summary Items (Filter out undefined or 0 values)
  const totalProjects = (stats?.activeProjects || 0) + (stats?.completedProjects || 0);
  const summaryItems = [
    { label: 'Total Projects', value: totalProjects },
    { label: 'Released to Production', value: stats?.completedProjects || 0 },
    { label: 'Pending Projects', value: stats?.activeProjects || 0 }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-4 pb-12">
      
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Design Studio</h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Synced: {lastUpdated.toLocaleTimeString()}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping ml-1" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 hover:shadow-lg active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            REFRESH DATA
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isDataLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard title="Active Projects" count={stats?.activeProjects || 0} subtitle="In design phase" color="bg-indigo-500" icon={PencilRuler} trend={12} />
            <StatCard title="Pending BOMs" count={stats?.pendingBoms || 0} subtitle="Awaiting submission" color="bg-emerald-500" icon={Layers} trend={5} />
            <StatCard title="Drawing Reviews" count={stats?.drawingReviews || 0} subtitle="Pending approval" color="bg-amber-500" icon={FileSearch} />
            <StatCard title="Completed" count={stats?.completedProjects || 0} subtitle="Released to production" color="bg-blue-500" icon={CheckCircle} trend={8} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        
        {/* Release Chart */}
        <div className="xl:col-span-2 bg-white rounded-lg p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Engineering Velocity
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Project release throughput over time</p>
          </div>
          <div className="h-[260px] w-full">
            {isDataLoading ? (
              <div className="w-full h-full flex flex-col justify-end gap-2 p-4 bg-slate-50/50 rounded animate-pulse">
                <div className="h-32 bg-slate-200/80 rounded w-full"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.chartData || []}>
                  <defs>
                    <linearGradient id="colorReleases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'}}
                    formatter={(val) => [val, 'Releases']}
                  />
                  <Area type="monotone" dataKey="releases" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorReleases)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Design Health & Quick Summary Panel */}
        <div className="bg-white rounded-lg p-4 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          {isDataLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-8 bg-slate-100 rounded w-full"></div>
              <div className="h-8 bg-slate-100 rounded w-full"></div>
            </div>
          ) : (
            <>
              {activeHealth.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">Engineering Health</h3>
                  <div className="space-y-2">
                    {activeHealth.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-end">
                          <span className="text-[11px] font-semibold text-slate-500">{item.label}</span>
                          <span className="text-xs font-bold text-slate-700">{item.value}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summaryItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">Quick Summary</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {summaryItems.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col justify-center">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</span>
                        <span className="text-lg font-bold text-slate-700 mt-0.5">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pending Design Tasks Table */}
      {isDataLoading ? (
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4">
          <SkeletonTable rows={3} columns={4} />
        </div>
      ) : (
        stats?.pendingTasks && stats.pendingTasks.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-slate-50 bg-slate-50/20">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                Critical Design Queue
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/10">
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase">Project Code</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase">Client</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase">Deadline</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(stats?.pendingTasks || []).map((task, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-xs font-bold text-indigo-600">{task.project_code}</td>
                      <td className="px-6 py-3 text-xs text-slate-600 font-medium">{task.company_name}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{task.deadline}</td>
                      <td className="px-6 py-3 text-center">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

    </div>
  );
};

export default DesignDashboard;
