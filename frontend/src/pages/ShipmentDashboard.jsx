import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Package,
  TrendingUp,
  Filter,
  Clock,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ShieldCheck
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
import { StatusBadge, DataTable } from "../components/ui.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ShipmentDashboard = ({ apiRequest }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      let res;
      if (apiRequest) {
        res = await apiRequest('/dashboard/shipment');
      } else {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/dashboard/shipment`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-ERP-Request': 'true'
          }
        });
        if (!response.ok) throw new Error('Failed to fetch shipment stats');
        res = await response.json();
      }
      setData(res);
      setLastUpdated(new Date());
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
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
          <Truck className="w-3 h-3 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900  ">Syncing Logistics</h3>
          <p className="text-xs text-slate-500 mt-1">Gathering transit data and shipment milestones...</p>
        </div>
      </div>
    );
  }

  const { stats, monthlyData, recentShipments } = data || {};
  
  const safeStats = stats || { active: 0, delivered: 0, delayed: 0, returns: 0, dispatched: 0, total: 0, sla: 0, health: [] };
  const safeMonthlyData = monthlyData || [];
  const safeRecentShipments = recentShipments || [];

  const kpis = [
    { title: "Active Shipments", value: safeStats.active || 0, subtitle: "In transit/ready", color: "bg-indigo-500", icon: Truck },
    { title: "On-Time Delivery", value: `${Math.round(((safeStats.delivered || 0) / (safeStats.total || 1)) * 100)}%`, subtitle: "Efficiency score", color: "bg-emerald-500", icon: CheckCircle },
    { title: "Delayed Items", value: safeStats.delayed || 0, subtitle: "Awaiting resolution", color: "bg-rose-500", icon: AlertTriangle },
    { title: "Returns Hub", value: safeStats.returns || 0, subtitle: "Quality returns", color: "bg-amber-500", icon: RotateCcw },
    { title: "Total Dispatched", value: safeStats.dispatched || 0, subtitle: "Last 30 days", color: "bg-blue-500", icon: Package },
  ];

  const pieData = [
    { name: "Active", value: safeStats.active || 0, color: "#4f46e5" },
    { name: "Dispatched", value: safeStats.dispatched || 0, color: "#3b82f6" },
    { name: "Delivered", value: safeStats.delivered || 0, color: "#10b981" },
    { name: "Return", value: safeStats.returns || 0, color: "#f59e0b" },
    { name: "Delayed", value: safeStats.delayed || 0, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const StatCard = ({ title, value, subtitle, color, icon: Icon }) => (
    <div className="bg-white rounded  p-2 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs  text-slate-400   mb-1">{title}</p>
          <h3 className="text-xl  text-slate-900">{value}</h3>
          <p className="text-xs text-slate-500 mt-1 ">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded  border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl  text-slate-900 ">Shipment & Logistics</h1>
            <div className="flex items-center gap-2 mt-1 text-xs  text-slate-400  ">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 p-2 bg-slate-50 text-slate-600 rounded  text-xs  hover:bg-slate-100 transition-all border border-slate-200 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
          <button className="flex items-center gap-2 p-2 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Download className="w-4 h-4" />
            EXPORT LOGS
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {kpis.map((kpi, i) => (
          <StatCard key={i} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="xl:col-span-2 bg-white rounded] p-2 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-md  text-slate-900  flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Dispatch Throughput
              </h3>
              <p className="text-xs text-slate-500   mt-1">MONTHLY SHIPMENT VOLUME BY STATUS</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="ordered" name="Ordered" fill="#4f46e5" radius={[0, 0, 0, 0]} barSize={12} />
                <Bar dataKey="dispatched" name="Dispatched" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={12} />
                <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[0, 0, 0, 0]} barSize={12} />
                <Bar dataKey="returned" name="Returned" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={12} />
                <Bar dataKey="delayed" name="Delayed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded] p-2 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-md  text-slate-900  mb-8">Fleet Analytics</h3>
          <div className="flex-1 flex flex-col">
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl  text-slate-900">{safeStats.sla || 0}%</span>
                <span className="text-xs text-slate-400   ">SLA Compliance</span>
              </div>
            </div>
            <div className="mt-8 space-y-2 flex-1">
              {(safeStats.health || [
                { label: 'Active', value: 0, color: '#4f46e5' },
                { label: 'Delivered', value: 0, color: '#10b981' },
                { label: 'Delayed', value: 0, color: '#ef4444' },
                { label: 'Returns', value: 0, color: '#f59e0b' }
              ]).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs   text-slate-600  ">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs  text-slate-900">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Shipments Table */}
        <div className="xl:col-span-3 bg-white rounded  border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xs  text-slate-900  flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                LIVE SHIPMENT TRACKER
              </h3>
              <p className="text-xs text-slate-500  mt-0.5  ">REAL-TIME MOVEMENT LOGS</p>
            </div>
            <button 
              onClick={() => window.location.href='/shipment-orders'}
              className="flex items-center gap-2 text-xs  text-indigo-600   hover:gap-2 transition-all"
            >
              View Full Fleet <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {safeRecentShipments.map((s, i) => (
                <div key={i} className="flex flex-col p-2 rounded bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-lg hover:border-indigo-100 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-white rounded  shadow-sm group-hover:scale-110 transition-transform">
                      <Truck className="w-4 h-4 text-indigo-600" />
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs  text-slate-900  truncate">{s.shipment_code}</p>
                  <p className="text-xs  text-slate-400  truncate mt-1">{s.customer_name || 'Generic Customer'}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1 text-xs  text-slate-400">
                      <Clock className="w-3 h-3" />
                      {new Date(s.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
              {safeRecentShipments.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <div className="w-5 h-5 bg-slate-50 rounded flex items-center justify-center mx-auto mb-4">
                    <Package className="w-3 h-3 text-slate-300" />
                  </div>
                  <p className="text-xs  text-slate-400  ">No active shipments in queue</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDashboard;
