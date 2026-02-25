import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  Globe,
  Users,
  DollarSign,
  Download,
  Calendar,
  Filter,
  ChevronRight,
  TrendingUp,
  MapPin,
  Clock
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  Cell
} from "recharts";
import { StatusBadge } from "../components/ui.jsx";

const ShipmentReports = ({ apiRequest }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/shipments/reports');
      setData(res);
    } catch (error) {
      console.error('Error fetching shipment reports:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { stats, statusTrends, byRegion, byDestination, detailedTrend, recentDeliveries } = data;

  return (
    <div className="p-8 bg-slate-50/50 min-h-screen space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Shipment Reports</h1>
          <p className="text-slate-500 mt-1">Analytics and reporting for shipments.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm cursor-pointer hover:bg-slate-50">
            <Calendar className="w-4 h-4 text-slate-400" />
            Last 30 Days
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Download className="w-4 h-4 text-slate-400" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <KpiCard label="Shipments" value={stats.total_shipments} growth={stats.shipmentsGrowth} icon={<BarChart3 />} color="blue" />
        <KpiCard label="Delayed Shipments" value={stats.total_delayed} growth={stats.delayedGrowth} icon={<AlertTriangle />} color="red" />
        <KpiCard label="Returns" value={stats.total_returns} growth={stats.returnsGrowth} icon={<RotateCcw />} color="purple" />
        <KpiCard label="Revenue" value={`$${parseFloat(stats.total_revenue).toLocaleString()}`} growth="+12%" icon={<DollarSign />} color="green" />
        <KpiCard label="Customers" value={stats.total_customers} growth={stats.customersGrowth} icon={<Users />} color="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipments by Status (Bar Chart) */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-900">Shipments by Status</h2>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
               Last 30 Days <Clock className="w-3 h-3 ml-1" />
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="ordered" name="Ordered" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="dispatched" name="Dispatched" fill="#06B6D4" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="delivered" name="Delivered" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="returned" name="Returned" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="delayed" name="Delayed" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shipments by Destination */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-8">Shipments by Destination</h2>
          <div className="space-y-6">
            {byDestination.map((dest, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold text-slate-400 overflow-hidden">
                      <Globe className="w-4 h-4 text-slate-300" />
                   </div>
                   <div>
                     <p className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{dest.destination}</p>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   <p className="text-sm font-black text-slate-900">{dest.count}</p>
                   <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      +{Math.floor(Math.random() * 500) + 100}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipments By region */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Shipments By region</h2>
          <div className="space-y-4">
            {byRegion.slice(0, 4).map((region, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {region.name.charAt(0)}
                   </div>
                   <p className="text-sm font-bold text-slate-700">{region.name}</p>
                </div>
                <StatusBadge status={region.status} size="xs" />
              </div>
            ))}
          </div>
        </div>

        {/* World Map / Destination Placeholder */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h2 className="text-lg font-bold text-slate-900 mb-6 self-start">Shipments By Destination</h2>
          <div className="relative w-full aspect-video flex items-center justify-center">
             <MapPin className="w-8 h-8 text-indigo-500 absolute top-1/4 left-1/3 animate-bounce" />
             <MapPin className="w-8 h-8 text-emerald-500 absolute top-1/2 left-2/3 animate-pulse" />
             <MapPin className="w-8 h-8 text-rose-500 absolute bottom-1/4 left-1/4" />
             <div className="w-full h-full bg-slate-100 rounded-3xl border border-dashed border-slate-200 flex items-center justify-center">
                <Globe className="w-24 h-24 text-slate-200" />
             </div>
          </div>
        </div>

        {/* Delivery Statistics */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-900">Delivery Statistics</h2>
              <select className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none">
                 <option>All Status</option>
              </select>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-3xl relative overflow-hidden">
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">On-Time</p>
                    <p className="text-xs font-black text-slate-900">92%</p>
                 </div>
                 <div className="w-full h-1.5 bg-white rounded-full">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                 </div>
              </div>
              
              <div className="space-y-3 mt-6">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                   <span>Shipment ID+</span>
                   <span>Customer</span>
                   <span>Status</span>
                </div>
                {recentDeliveries.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-medium text-slate-600 border-b border-slate-50 pb-2">
                     <span className="font-bold text-slate-900">{s.shipment_code}</span>
                     <span className="truncate max-w-[80px]">{s.customer}</span>
                     <StatusBadge status={s.status} size="xs" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Shipment Report (Full width Bottom) */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-bold text-slate-900">Detailed Shipment Report</h2>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
                All Status <Filter className="w-3 h-3" />
             </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={detailedTrend}>
              <defs>
                <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDelayed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#10B981" fillOpacity={1} fill="url(#colorDelivered)" strokeWidth={3} />
              <Area type="monotone" dataKey="delayed" name="Delayed" stroke="#EF4444" fillOpacity={1} fill="url(#colorDelayed)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, growth, icon, color }) => {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    red: "bg-rose-50 text-rose-600 border-rose-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    cyan: "bg-cyan-50 text-cyan-600 border-cyan-100",
  };

  const isPositive = growth?.startsWith('+');

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-200">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-4 rounded-2xl border ${colorStyles[color]}`}>
          {React.cloneElement(icon, { className: "w-6 h-6" })}
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
          <h3 className="text-xl font-black text-slate-900">{value}</h3>
        </div>
      </div>
      <div className="flex items-center gap-2">
         <div className={`flex items-center gap-0.5 text-[11px] font-black px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {growth}
         </div>
      </div>
    </div>
  );
};

export default ShipmentReports;
