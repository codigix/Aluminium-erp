import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Package,
  TrendingUp,
  Filter,
  Clock
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend
} from "recharts";
import { StatusBadge } from "../components/ui.jsx";

const ShipmentDashboard = ({ apiRequest }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/shipments/dashboard');
      setData(res);
    } catch (error) {
      console.error('Error fetching shipment dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { stats, monthlyData, recentShipments } = data;

  const kpis = [
    { title: "Active", value: stats.active, icon: <TrendingUp className="w-6 h-6" />, color: "blue" },
    { title: "In Transit", value: stats.in_transit, icon: <Truck className="w-6 h-6" />, color: "orange" },
    { title: "Delivered", value: stats.delivered, icon: <CheckCircle className="w-6 h-6" />, color: "green" },
    { title: "Delayed", value: stats.delayed, icon: <AlertTriangle className="w-6 h-6" />, color: "red" },
    { title: "Returns", value: stats.returns, icon: <RotateCcw className="w-6 h-6" />, color: "purple" },
    { title: "Dispatched", value: stats.dispatched, icon: <Package className="w-6 h-6" />, color: "cyan" },
  ];

  const pieData = [
    { name: "Active", value: stats.active, color: "#3B82F6" },
    { name: "Dispatched", value: stats.dispatched, color: "#06B6D4" },
    { name: "Delivered", value: stats.delivered, color: "#10B981" },
    { name: "Return", value: stats.returns, color: "#8B5CF6" },
    { name: "Delayed", value: stats.delayed, color: "#EF4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 bg-slate-50/50 min-h-screen space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Shipment Dashboard</h1>
          <p className="text-slate-500 mt-1">Real-time insights into shipment operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            Filter
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} {...kpi} />
        ))}
      </div>

      {/* CHART + PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BAR CHART */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Shipments Overview
          </h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
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

        {/* DELIVERY PERFORMANCE */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Delivery Performance
          </h2>
          <div className="space-y-8">
            <ProgressItem label="On-Time Delivery" percent={stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0} color="bg-emerald-500" />
            <ProgressItem label="Delay Rate" percent={stats.total > 0 ? Math.round((stats.delayed / stats.total) * 100) : 0} color="bg-rose-500" />
            <ProgressItem label="Return Rate" percent={stats.total > 0 ? Math.round((stats.returns / stats.total) * 100) : 0} color="bg-purple-500" />
          </div>
          <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Efficiency Score</p>
             <p className="text-2xl font-black text-slate-900">88%</p>
          </div>
        </div>
      </div>

      {/* RECENT + PIE + STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* RECENT SHIPMENTS */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Recent Shipments</h2>
          <div className="space-y-4">
            {recentShipments.map((s, i) => (
              <ShipmentRow key={i} {...s} />
            ))}
            {recentShipments.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-sm italic">
                No recent shipments
              </div>
            )}
          </div>
        </div>

        {/* PIE CHART */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 text-center">Shipment Statistics</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SUMMARY STATS */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-center space-y-6">
          <StatItem label="Ordered" value={stats.total} color="bg-blue-500" />
          <StatItem label="Dispatched" value={stats.dispatched} color="bg-cyan-500" />
          <StatItem label="Delivered" value={stats.delivered} color="bg-green-500" />
          <StatItem label="Return" value={stats.returns} color="bg-purple-500" />
          <StatItem label="Delayed" value={stats.delayed} color="bg-rose-500" />
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon, color }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-rose-50 text-rose-600 border-rose-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    cyan: "bg-cyan-50 text-cyan-600 border-cyan-100",
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex justify-between items-start transition-all hover:shadow-md hover:border-slate-200">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-3">{title}</p>
        <h3 className="text-3xl font-black text-slate-900">{value}</h3>
      </div>
      <div className={`p-4 rounded-2xl border ${colors[color]}`}>
        {icon}
      </div>
    </div>
  );
};

const ProgressItem = ({ label, percent, color }) => (
  <div>
    <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
      <span className="uppercase tracking-wider opacity-60">{label}</span>
      <span>{percent}%</span>
    </div>
    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all duration-1000`}
        style={{ width: `${percent}%` }}
      ></div>
    </div>
  </div>
);

const ShipmentRow = ({ shipment_code, customer_name, status, updated_at }) => {
  return (
    <div className="flex justify-between items-center p-4 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-slate-50 transition-colors">
      <div className="min-w-0 flex-1 mr-4">
        <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{shipment_code}</p>
        <div className="flex items-center gap-2 mt-1">
           <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{customer_name || 'Unknown'}</p>
           <span className="w-1 h-1 rounded-full bg-slate-300"></span>
           <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Clock className="w-3 h-3" />
              {new Date(updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
           </div>
        </div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
};

const StatItem = ({ label, value, color }) => (
  <div className="flex justify-between items-center group">
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${color} shadow-sm group-hover:scale-125 transition-transform`}></div>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
    <span className="text-xl font-black text-slate-900">{value}</span>
  </div>
);

export default ShipmentDashboard;
