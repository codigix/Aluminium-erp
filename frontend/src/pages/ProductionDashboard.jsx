import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
import { 
  Factory, 
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
  Hammer,
  Layers,
  Activity
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProductionDashboard = ({ apiRequest }) => {
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
        const data = await apiRequest('/dashboard/production');
        setStats(data);
      } else {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/dashboard/production`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-ERP-Request': 'true'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch production stats');
        const data = await response.json();
        setStats(data);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching production dashboard:', error);
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
          <p className="text-xs text-slate-500 mt-1 ">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>
    </div>
  );

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
        <p className="text-xs text-slate-500   ">Initializing Production Command Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-12">
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        
        <div className="relative z-10 flex items-center gap-6">
         
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl  text-slate-900 ">Production Floor</h1>
              <span className="p-1 bg-indigo-50 text-indigo-600 rounded text-xs    border border-indigo-100">
                Manufacturing
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5 text-xs  text-slate-400  ">
                <Clock className="w-3.5 h-3.5" />
                Shift Active • {lastUpdated.toLocaleTimeString()}
              </div>
              <div className="w-1 h-1 rounded bg-slate-200" />
              <div className="flex items-center gap-1.5 text-xs  text-emerald-500  ">
                <ShieldCheck className="w-3.5 h-3.5" />
                OEE Level: Optimized
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
        <StatCard title="Active Jobs" count={stats.activeWorkOrders || 0} subtitle="On production floor" color="bg-indigo-500" icon={Hammer} trend={8} />
        <StatCard title="Planned Orders" count={stats.plannedOrders || 0} subtitle="Awaiting material" color="bg-emerald-500" icon={Layers} trend={15} />
        <StatCard title="Resource Load" count={`${stats.resourceLoad || 0}%`} subtitle="Workstation utilization" color="bg-amber-500" icon={Activity} />
        <StatCard title="Throughput" count={`${stats.completedToday || 0}`} subtitle="Items finished today" color="bg-blue-500" icon={CheckCircle} trend={4} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Output Chart */}
        <div className="xl:col-span-2 bg-white rounded] p-2 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-md  text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-indigo-600" />
                Production Velocity
              </h3>
              <p className="text-xs text-slate-500   mt-1 ">DAILY THROUGHPUT & EFFICIENCY</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData || []}>
                <defs>
                  <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="output" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorOutput)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Manufacturing Health */}
        <div className="bg-white rounded] p-2 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-md  text-slate-900  mb-2">Operational Health</h3>
          <div className="space-y-2 flex-1">
            {(stats.health || [
              { label: 'Schedule Adherence', value: 0, color: 'bg-indigo-500' },
              { label: 'Yield Quality', value: 0, color: 'bg-emerald-500' },
              { label: 'Downtime Variance', value: 0, color: 'bg-amber-500' },
              { label: 'Scrap Rate', value: 0, color: 'bg-rose-500' }
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

      {/* Critical Work Orders */}
      <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/50">
          <div>
            <h3 className="text-sm  text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              PRIORITY WORK ORDERS
            </h3>
            <p className="text-xs  text-slate-500  mt-0.5 ">REAL-TIME PRODUCTION PIPELINE</p>
          </div>
        </div>
        <DataTable
          columns={[
            {
              label: 'WO Code',
              key: 'wo_code',
              render: (val) => <span className="text-indigo-600 ">{val}</span>
            },
            {
              label: 'Item',
              key: 'item_name',
              render: (val) => <span className="text-slate-700">{val}</span>
            },
            {
              label: 'Quantity',
              key: 'quantity',
              render: (val, row) => <span className="text-slate-900 ">{val} <span className="text-slate-400 font-normal text-xs ">{row.unit}</span></span>
            },
            {
              label: 'Status',
              key: 'status',
              render: (val) => <StatusBadge status={val} />
            }
          ]}
          data={stats.priorityOrders || []}
          loading={loading}
          hideSearch={true}
          hidePagination={true}
        />
      </div>
    </div>
  );
};

export default ProductionDashboard;
