import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from 'xlsx';
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
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  ArrowRight,
  Package,
  CheckCircle2,
  Box,
  LayoutDashboard,
  ShieldCheck,
  Search
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
  Cell,
  PieChart,
  Pie
} from "recharts";
import { StatusBadge } from "../components/ui.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ShipmentReports = ({ apiRequest }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });

  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/shipments/reports');
      setData(res);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching shipment reports:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  const handleExport = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      { Metric: 'Total Shipments', Value: stats.total_shipments },
      { Metric: 'Delayed Shipments', Value: stats.total_delayed },
      { Metric: 'Returns', Value: stats.total_returns },
      { Metric: 'Total Revenue', Value: stats.total_revenue },
      { Metric: 'Total Customers', Value: stats.total_customers }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Logistics Summary");

    // Regional Sheet
    if (byDestination) {
      const regionData = byDestination.map(d => ({
        'Destination': d.destination,
        'Shipment Count': d.count
      }));
      const wsRegions = XLSX.utils.json_to_sheet(regionData);
      XLSX.utils.book_append_sheet(wb, wsRegions, "Regional Distribution");
    }

    // Recent Shipments Sheet
    if (recentDeliveries) {
      const shipmentData = recentDeliveries.map(s => ({
        'Shipment Code': s.shipment_code,
        'Customer': s.customer,
        'Destination': s.destination || 'Main Warehouse',
        'Status': s.status,
        'Date': s.date || 'N/A'
      }));
      const wsShipments = XLSX.utils.json_to_sheet(shipmentData);
      XLSX.utils.book_append_sheet(wb, wsShipments, "Recent Shipments");
    }

    XLSX.writeFile(wb, `Shipment_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#6366f1', '#f43f5e'];

  const StatCard = ({ title, amount, subtitle, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs text-slate-400 mb-1   ">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl text-slate-900 ">{amount}</h3>
            {trendValue && (
              <span className={`flex items-center text-xs  ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 ">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
          <Truck className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900   ">Generating Logistics Analytics</h3>
          <p className="text-xs text-slate-500 mt-1">Fetching shipment metrics and regional distribution...</p>
        </div>
      </div>
    );
  }

  const { stats, statusTrends, byRegion, byDestination, detailedTrend, recentDeliveries } = data;

  return (
    <div className="space-y-2 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 ">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Truck size={15} className=" text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900  ">Logistics & Shipments</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400   ">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 p-2 bg-slate-50 border border-slate-200 rounded text-xs  text-slate-600">
             <Calendar className="w-3.5 h-3.5 text-slate-400" />
             <span className="text-slate-400">Last 30 Days</span>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 p-2 bg-indigo-600 text-white rounded text-xs    hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
        <StatCard title="Total Shipments" amount={stats.total_shipments} subtitle="Outbound volume" icon={Package} color="bg-blue-500" trend="up" trendValue={stats.shipmentsGrowth} />
        <StatCard title="Delayed" amount={stats.total_delayed} subtitle="Critical attention" icon={AlertTriangle} color="bg-rose-500" trend="down" trendValue={stats.delayedGrowth} />
        <StatCard title="Returns" amount={stats.total_returns} subtitle="Processing required" icon={RotateCcw} color="bg-amber-500" trend="up" trendValue={stats.returnsGrowth} />
        <StatCard title="Revenue" amount={`₹${parseFloat(stats.total_revenue).toLocaleString()}`} subtitle="Shipment value" icon={DollarSign} color="bg-emerald-500" trend="up" trendValue="+12%" />
        <StatCard title="Customers" amount={stats.total_customers} subtitle="Active destinations" icon={Users} color="bg-indigo-500" trend="up" trendValue={stats.customersGrowth} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        {/* Shipments by Status Chart */}
        <div className="xl:col-span-2 bg-white rounded p-2 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-md text-slate-900   flex items-center gap-2 ">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Shipment Pipeline
              </h3>
              <p className="text-xs text-slate-500 mt-1   ">MONTHLY STATUS DISTRIBUTION</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: '' }} />
                <Bar dataKey="ordered" name="Ordered" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={15} />
                <Bar dataKey="dispatched" name="Dispatched" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={15} />
                <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} barSize={15} />
                <Bar dataKey="returned" name="Returned" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={15} />
                <Bar dataKey="delayed" name="Delayed" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Breakdown */}
        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-md text-slate-900   mb-8 ">Regional Distribution</h3>
          <div className="space-y-2 flex-1 overflow-y-auto pr-2">
            {byDestination.map((dest, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-900   ">{dest.destination}</p>
                    <p className="text-xs text-slate-400 ">Active Region</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs  text-slate-900">{dest.count}</p>
                    <p className="text-xs text-emerald-500  flex items-center justify-end">
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                      +{Math.floor(Math.random() * 20) + 5}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full p-2 bg-slate-50 text-slate-600 text-xs    rounded border border-slate-100 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
            View All Regions <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Recent Deliveries Table */}
        <div className="xl:col-span-3  flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xs text-slate-900   flex items-center gap-2 ">
                <Activity className="w-4 h-4 text-indigo-600" />
                RECENT LOGISTICS OPERATIONS
              </h3>
              <p className="text-xs text-slate-500 mt-0.5   ">LATEST DISPATCHES AND DELIVERY STATUS</p>
            </div>
            <button className="flex items-center gap-2 text-xs  text-indigo-600 hover:gap-2 transition-all  ">
              View Tracking History <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400    border-b border-slate-100">
                  <th className="p-2">Shipment Code</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Destination</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentDeliveries.slice(0, 10).map((shipment, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2  text-indigo-600  er">{shipment.shipment_code}</td>
                    <td className="p-2  text-slate-600 ">{shipment.customer}</td>
                    <td className="p-2  text-slate-500 ">{shipment.destination || 'Main Warehouse'}</td>
                    <td className="p-2 text-center">
                       <StatusBadge status={shipment.status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded border border-transparent hover:border-slate-100 transition-all shadow-sm">
                          <Search className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShipmentReports;
