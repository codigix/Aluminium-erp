import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Search,
  Eye
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
import { StatusBadge, Button } from "../components/ui.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ShipmentReports = ({ apiRequest }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [showTrackingHistory, setShowTrackingHistory] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [trackingHistoryPage, setTrackingHistoryPage] = useState(1);
  const [regionsPage, setRegionsPage] = useState(1);
  const itemsPerPage = 15;
  const regionsPerPage = 15;

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
    setTrackingHistoryPage(1);
    setRegionsPage(1);
  }, [fetchReportsData]);

  const paginatedTracking = useMemo(() => {
    if (!data?.recentDeliveries) return [];
    const startIndex = (trackingHistoryPage - 1) * itemsPerPage;
    return data.recentDeliveries.slice(startIndex, startIndex + itemsPerPage);
  }, [data?.recentDeliveries, trackingHistoryPage]);

  const paginatedRegions = useMemo(() => {
    if (!data?.byDestination) return [];
    const startIndex = (regionsPage - 1) * regionsPerPage;
    return data.byDestination.slice(startIndex, startIndex + regionsPerPage);
  }, [data?.byDestination, regionsPage]);

  const totalHistoryPages = useMemo(() => {
    if (!data?.recentDeliveries) return 0;
    return Math.ceil(data.recentDeliveries.length / itemsPerPage);
  }, [data?.recentDeliveries]);

  const totalRegionsPages = useMemo(() => {
    if (!data?.byDestination) return 0;
    return Math.ceil(data.byDestination.length / regionsPerPage);
  }, [data?.byDestination]);

  const handleExport = () => {
    if (!data) return;
    const { stats, byDestination, recentDeliveries } = data;

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
          <p className="text-xs text-slate-400 mb-0.5 font-medium uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold text-slate-900 leading-tight">{amount}</h3>
            {trendValue && (
              <span className={`flex items-center text-xs font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium leading-tight">{subtitle}</p>
        </div>
        <div className={`p-2 rounded-xl ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-5 h-5" />
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
          <h3 className="text-slate-900 font-bold">Generating Logistics Analytics</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">Fetching shipment metrics and regional distribution...</p>
        </div>
      </div>
    );
  }

  const { stats, statusTrends, byRegion, byDestination, detailedTrend, recentDeliveries } = data;

  if (showTrackingHistory) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl text-slate-900 font-bold">Shipment Tracking History</h2>
            <div className="hidden md:flex items-center gap-2">
               <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">Total: {stats.total_shipments}</div>
               <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">Delivered: {stats.total_delivered || 0}</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowTrackingHistory(false)}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Report
          </Button>
        </div>

        {/* KPI Cards for History View */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="Total Shipments" amount={stats.total_shipments} subtitle="Outbound volume" icon={Package} color="bg-blue-500" trend="up" trendValue={stats.shipmentsGrowth} />
          <StatCard title="Delayed" amount={stats.total_delayed} subtitle="Critical attention" icon={AlertTriangle} color="bg-rose-500" trend="down" trendValue={stats.delayedGrowth} />
          <StatCard title="Returns" amount={stats.total_returns} subtitle="Processing required" icon={RotateCcw} color="bg-amber-500" trend="up" trendValue={stats.returnsGrowth} />
          <StatCard title="Revenue" amount={`₹${parseFloat(stats.total_revenue).toLocaleString()}`} subtitle="Shipment value" icon={DollarSign} color="bg-emerald-500" trend="up" trendValue="+12%" />
          <StatCard title="Customers" amount={stats.total_customers} subtitle="Active destinations" icon={Users} color="bg-indigo-500" trend="up" trendValue={stats.customersGrowth} />
        </div>

        <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400 font-bold uppercase tracking-tighter border-b border-slate-100">
                  <th className="p-2">Shipment Code</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Destination</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedTracking.map((shipment, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2  text-indigo-600 font-bold">{shipment.shipment_code}</td>
                    <td className="p-2  text-slate-900 font-medium">{shipment.customer}</td>
                    <td className="p-2  text-slate-500 font-medium">{shipment.destination || 'Main Warehouse'}</td>
                    <td className="p-2 text-center">
                       <StatusBadge status={shipment.status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/shipment-details/${shipment.id}`)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalHistoryPages > 1 && (
            <div className="p-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs  text-slate-400  ">
                Showing {(trackingHistoryPage - 1) * itemsPerPage + 1} to {Math.min(trackingHistoryPage * itemsPerPage, recentDeliveries.length)} of {recentDeliveries.length} entries
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={trackingHistoryPage === 1}
                  onClick={() => setTrackingHistoryPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalHistoryPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setTrackingHistoryPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded  text-xs font-bold transition-all ${
                      trackingHistoryPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={trackingHistoryPage === totalHistoryPages}
                  onClick={() => setTrackingHistoryPage(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showAllRegions) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl text-slate-900 font-bold">Regional Distribution Analysis</h2>
            <div className="hidden md:flex items-center gap-2">
               <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">Total Regions: {byDestination.length}</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowAllRegions(false)}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Report
          </Button>
        </div>

        {/* KPI Cards for Regions View */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Shipments" amount={stats.total_shipments} subtitle="Outbound volume" icon={Package} color="bg-blue-500" />
          <StatCard title="Primary Region" amount={byDestination[0]?.destination || 'N/A'} subtitle="Highest volume" icon={MapPin} color="bg-indigo-500" />
          <StatCard title="Avg per Region" amount={Math.ceil(stats.total_shipments / byDestination.length)} subtitle="Distribution density" icon={Activity} color="bg-emerald-500" />
          <StatCard title="Active Markets" amount={byDestination.length} subtitle="Regional reach" icon={Globe} color="bg-amber-500" />
        </div>

        <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400 font-bold uppercase tracking-tighter border-b border-slate-100">
                  <th className="p-2">Region / Destination</th>
                  <th className="p-2 text-center">Shipment Count</th>
                  <th className="p-2 text-center">Percentage</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedRegions.map((dest, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2 font-bold text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Globe className="w-4 h-4" />
                      </div>
                      {dest.destination}
                    </td>
                    <td className="p-2 text-center font-bold text-slate-700">{dest.count}</td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${(dest.count / stats.total_shipments * 100).toFixed(1)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          {(dest.count / stats.total_shipments * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <button 
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalRegionsPages > 1 && (
            <div className="p-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {(regionsPage - 1) * regionsPerPage + 1} to {Math.min(regionsPage * regionsPerPage, byDestination.length)} of {byDestination.length} regions
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={regionsPage === 1}
                  onClick={() => setRegionsPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalRegionsPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setRegionsPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      regionsPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={regionsPage === totalRegionsPages}
                  onClick={() => setRegionsPage(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 ">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded shadow-lg shadow-indigo-200">
            <Truck size={15} className=" text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Logistics & Shipments</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 p-2 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600">
             <Calendar className="w-3.5 h-3.5 text-slate-400" />
             <span className="text-slate-400">Last 30 Days</span>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
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
              <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 ">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Shipment Pipeline
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-bold">MONTHLY STATUS DISTRIBUTION</p>
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
          <h3 className="text-md font-bold text-slate-900 mb-8 ">Regional Distribution</h3>
          <div className="space-y-2 flex-1 overflow-y-auto pr-2">
            {byDestination.map((dest, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{dest.destination}</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Active Region</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{dest.count}</p>
                    <p className="text-[10px] font-bold text-emerald-500 flex items-center justify-end">
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                      +{Math.floor(Math.random() * 20) + 5}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setShowAllRegions(true)}
            className="mt-6 w-full p-2 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-tighter rounded border border-slate-100 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            View All Regions <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Recent Deliveries Table */}
        <div className="xl:col-span-3  flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                <Activity className="w-4 h-4 text-indigo-600" />
                RECENT LOGISTICS OPERATIONS
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 font-bold uppercase tracking-tighter">LATEST DISPATCHES AND DELIVERY STATUS</p>
            </div>
            <button 
              onClick={() => setShowTrackingHistory(true)}
              className="flex items-center gap-2 text-[10px] font-black text-indigo-600 hover:gap-2 transition-all uppercase tracking-tighter hover:underline"
            >
              View Tracking History <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-100">
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
                    <td className="p-2  text-indigo-600 font-bold">{shipment.shipment_code}</td>
                    <td className="p-2  text-slate-600 font-medium">{shipment.customer}</td>
                    <td className="p-2  text-slate-500 font-medium">{shipment.destination || 'Main Warehouse'}</td>
                    <td className="p-2 text-center">
                       <StatusBadge status={shipment.status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/shipment-details/${shipment.id}`)}
                          className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded border border-transparent hover:border-slate-100 transition-all shadow-sm"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
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
