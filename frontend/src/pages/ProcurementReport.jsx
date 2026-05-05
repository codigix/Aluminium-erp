import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, DataTable, StatusBadge, Button } from '../components/ui.jsx';
import PurchaseOrderDetail from './PurchaseOrderDetail.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, IndianRupee, ShoppingCart, Clock, CheckCircle2, 
  Target, Filter, Download, RefreshCw, Calendar, ChevronRight,
  FileText, Users, Eye, Printer, Share2, Trash2, Edit, Truck,
  CheckCircle, XCircle, Send, Package, ArrowRight, MoreVertical
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProcurementReport = () => {
  const navigate = useNavigate();
  const invoiceInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [summaryPage, setSummaryPage] = useState(1);
  const [vendorsPage, setVendorsPage] = useState(1);
  const [uploadingPoId, setUploadingPoId] = useState(null);
  const [selectedPODetail, setSelectedPODetail] = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const itemsPerPage = 10;
  const itemsPerSmallPage = 5;

  useEffect(() => {
    fetchProcurementReport();
    setSummaryPage(1);
    setVendorsPage(1);
  }, [dateRange, selectedSupplier]);

  const handleViewPO = async (poId) => {
    if (!poId) return;
    try {
      setFetchingDetail(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPODetail(data);
      }
    } catch (error) {
      console.error('Error fetching PO detail:', error);
    } finally {
      setFetchingDetail(false);
    }
  };

  const handleViewPDF = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error viewing PDF:', error);
    }
  };

  const handleDownloadPDF = async (poId, poNumber) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO_${poNumber || poId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handlePrintPO = async (poId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error('Error printing PO:', error);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingPoId) return;

    try {
      const formData = new FormData();
      formData.append('invoice', file);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${uploadingPoId}/upload-invoice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        fetchProcurementReport();
      }
    } catch (error) {
      console.error('Error uploading invoice:', error);
    } finally {
      setUploadingPoId(null);
    }
  };

  const fetchProcurementReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/dashboard/procurement-report?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedSupplier !== 'All') url += `&supplier=${selectedSupplier}`;

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch procurement report');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching procurement report:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedSummary = useMemo(() => {
    if (!stats?.poGrnSummary) return [];
    const startIndex = (summaryPage - 1) * itemsPerPage;
    return stats.poGrnSummary.slice(startIndex, startIndex + itemsPerPage);
  }, [stats?.poGrnSummary, summaryPage]);

  const totalSummaryPages = Math.ceil((stats?.poGrnSummary?.length || 0) / itemsPerPage);

  const paginatedVendors = useMemo(() => {
    if (!stats?.vendorPerformance) return [];
    const startIndex = (vendorsPage - 1) * itemsPerSmallPage;
    return stats.vendorPerformance.slice(startIndex, startIndex + itemsPerSmallPage);
  }, [stats?.vendorPerformance, vendorsPage]);

  const totalVendorsPages = Math.ceil((stats?.vendorPerformance?.length || 0) / itemsPerSmallPage);

  const handleExport = () => {
    if (!stats) return;

    const wb = XLSX.utils.book_new();

    // 1. Procurement Summary
    const summaryData = [
      { Metric: 'Total RFQs', Value: stats.kpis?.totalRfqs || 0 },
      { Metric: 'RFQs Sent', Value: stats.kpis?.sentRfqs || 0 },
      { Metric: 'RFQs Received', Value: stats.kpis?.receivedRfqs || 0 },
      { Metric: 'POs Created', Value: stats.kpis?.posCreated || 0 },
      { Metric: 'Completed Orders', Value: stats.kpis?.completedOrders || 0 },
      { Metric: 'Pending Orders', Value: stats.kpis?.pendingOrders || 0 }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Procurement Summary");

    // 2. Vendor Performance
    if (stats.vendorPerformance) {
      const vendorData = stats.vendorPerformance.map(v => ({
        'Vendor': v.name,
        'Total Orders': v.totalOrders,
        'Fulfillment %': v.fulfillment,
        'Avg Rating': v.rating,
        'Delay %': v.delay
      }));
      const wsVendors = XLSX.utils.json_to_sheet(vendorData);
      XLSX.utils.book_append_sheet(wb, wsVendors, "Vendor Performance");
    }

    // 3. Recent Procurement Activity
    if (stats.recentActivity) {
      const activityData = stats.recentActivity.map(a => ({
        'Activity': a.text,
        'Time': a.time,
        'Date': a.date
      }));
      const wsActivity = XLSX.utils.json_to_sheet(activityData);
      XLSX.utils.book_append_sheet(wb, wsActivity, "Recent Activity");
    }

    // 4. Purchase Orders & Goods Receipts Summary
    if (stats.poGrnSummary) {
      const poGrnData = stats.poGrnSummary.map(item => ({
        'PO Number': item.poNo,
        'Supplier': item.supplier,
        'Project / Customer': item.project,
        'PO Date': item.poDate,
        'PO Amount': item.amount,
        'GRN Status': item.grnStatus,
        'Status': item.status
      }));
      const wsPoGrn = XLSX.utils.json_to_sheet(poGrnData);
      XLSX.utils.book_append_sheet(wb, wsPoGrn, "PO & GRN Summary");
    }

    XLSX.writeFile(wb, `Procurement_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const KPIStoreCard = ({ title, value, subtitle, icon: Icon, color, subColor }) => (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-16 h-16 ${subColor} opacity-10 rounded -mr-6 -mt-6 transition-transform group-hover:scale-110`} />
      <div className={`p-3 rounded-xl ${subColor} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{title}</p>
        <h3 className="text-xl text-slate-900 font-black">{value}</h3>
        <p className="text-[10px] text-slate-500 font-bold tracking-tight">{subtitle}</p>
      </div>
    </div>
  );

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-600 rounded animate-spin" />
        <h3 className="text-slate-900 font-black tracking-tight uppercase">Generating Procurement Report...</h3>
      </div>
    );
  }

  if (fetchingDetail) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
        <h3 className="text-slate-900 font-black tracking-tight uppercase">Loading Purchase Order...</h3>
      </div>
    );
  }

  if (selectedPODetail) {
    return (
      <PurchaseOrderDetail 
        po={selectedPODetail} 
        onBack={() => setSelectedPODetail(null)} 
        onRefresh={() => handleViewPO(selectedPODetail.id)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-slate-900 font-black tracking-tight">Procurement Report</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Overview of procurement activities and supplier performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
             <Calendar className="w-4 h-4 text-slate-400" />
             <input 
               type="date" 
               value={dateRange.start} 
               onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
               className="bg-transparent border-none outline-none cursor-pointer"
             />
             <span className="text-slate-300 mx-1">—</span>
             <input 
               type="date" 
               value={dateRange.end} 
               onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
               className="bg-transparent border-none outline-none cursor-pointer"
             />
          </div>
          <select 
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 outline-none"
          >
            <option value="All">All Suppliers</option>
            {stats.vendorPerformance?.map((vendor, idx) => (
              <option key={idx} value={vendor.supplier}>{vendor.supplier}</option>
            ))}
          </select>
          <button 
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPIStoreCard title="Total RFQs" value={stats.kpis.totalRfqs} subtitle="All Time" icon={FileText} color="text-indigo-600" subColor="bg-indigo-50" />
        <KPIStoreCard title="RFQs Sent" value={stats.kpis.sentRfqs} subtitle="This Period" icon={Send} color="text-blue-600" subColor="bg-blue-50" />
        <KPIStoreCard title="RFQs Received" value={stats.kpis.receivedRfqs} subtitle="This Period" icon={FileText} color="text-emerald-600" subColor="bg-emerald-50" />
        <KPIStoreCard title="POs Created" value={stats.kpis.posCreated} subtitle="This Period" icon={ShoppingCart} color="text-amber-600" subColor="bg-amber-50" />
        <KPIStoreCard title="Completed Orders" value={stats.kpis.completedOrders} subtitle="This Period" icon={CheckCircle} color="text-indigo-600" subColor="bg-indigo-50" />
        <KPIStoreCard title="Pending Orders" value={stats.kpis.pendingOrders} subtitle="This Period" icon={Clock} color="text-rose-600" subColor="bg-rose-50" />
      </div>

      {/* Funnel & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Procurement Funnel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Procurement Funnel</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">RFQ to GRN conversion overview</p>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="flex items-center justify-between gap-2">
              {stats.funnelData.map((item, idx) => (
                <React.Fragment key={idx}>
                  <div className="flex-1 flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 relative group transition-all hover:bg-white hover:shadow-md">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter text-center">{item.name}</p>
                    <h4 className="text-lg font-black text-slate-900">{item.value}</h4>
                  </div>
                  {idx < stats.funnelData.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300" />}
                </React.Fragment>
              ))}
            </div>
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
               <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                 Conversion Rate: <span className="text-sm ml-2">{stats.kpis.conversionRate}%</span>
                 <span className="text-slate-400 ml-2 font-bold normal-case">(RFQ Created to GRN Completed)</span>
               </p>
            </div>
          </div>
        </div>

        {/* Purchase Trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Purchase Trend</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total purchase value over time</p>
            </div>
            <select className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <option>Monthly</option>
            </select>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.purchaseTrend}>
                <defs>
                  <linearGradient id="colorPurchaseTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}}
                  tickFormatter={(val) => `₹${val / 1000}K`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorPurchaseTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Vendor Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Performance */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Vendor Performance</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Top vendors based on order performance</p>
            </div>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all vendors <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-3 pr-2">Supplier</th>
                  <th className="pb-3 pr-2 text-center">Total Orders</th>
                  <th className="pb-3 pr-2">Fulfillment %</th>
                  <th className="pb-3 pr-2 text-center">Avg Rating</th>
                  <th className="pb-3 text-right">Delay %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedVendors.map((vendor, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 text-xs font-black text-slate-900">{vendor.supplier}</td>
                    <td className="py-4 text-xs font-bold text-slate-600 text-center">{vendor.totalOrders}</td>
                    <td className="py-4 text-xs">
                       <div className="flex items-center gap-2">
                         <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500 rounded-full" style={{ width: vendor.fulfillment }} />
                         </div>
                         <span className="text-[10px] font-bold text-slate-500">{vendor.fulfillment}</span>
                       </div>
                    </td>
                    <td className="py-4 text-center">
                       <div className="flex items-center justify-center gap-1">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-xs ${s <= Math.floor(vendor.avgRating) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                          ))}
                          <span className="text-[10px] font-bold text-slate-400 ml-1">{vendor.avgRating}</span>
                       </div>
                    </td>
                    <td className="py-4 text-right text-xs font-bold text-rose-500">{vendor.delay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalVendorsPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Page {vendorsPage} of {totalVendorsPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={vendorsPage === 1}
                  onClick={() => setVendorsPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={vendorsPage === totalVendorsPages}
                  onClick={() => setVendorsPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Recent Procurement Activity</h3>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all activity <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'RFQ_SENT' ? 'bg-blue-50 text-blue-600' : 
                  activity.type === 'PO_CREATED' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {activity.type === 'RFQ_SENT' ? <Send className="w-3.5 h-3.5" /> : 
                   activity.type === 'PO_CREATED' ? <ShoppingCart className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 border-b border-slate-50 pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-black text-slate-900 tracking-tight">
                      {activity.type === 'RFQ_SENT' ? `RFQ ${activity.ref} sent to vendors` : 
                       activity.type === 'PO_CREATED' ? `PO ${activity.ref} created` : `GRN ${activity.ref} completed`}
                    </p>
                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">
                      {new Date(activity.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{activity.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
           <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Purchase Orders & Goods Receipts Summary</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[9px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-2">PO Number</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Project / Customer</th>
                <th className="px-4 py-2">PO Date</th>
                <th className="px-4 py-2 text-right">PO Amount</th>
                <th className="px-4 py-2 text-center">GRN Status</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedSummary.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-[10px]">
                  <td className="px-4 py-2 font-black text-indigo-600 whitespace-nowrap">{row.poNumber}</td>
                  <td className="px-4 py-2">
                    <p className="font-black text-slate-900 truncate max-w-[150px]" title={row.supplier}>{row.supplier}</p>
                    <p className="text-[8px] text-blue-600 font-bold uppercase mt-0.5">Active Vendor</p>
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-bold text-slate-600 truncate max-w-[200px]" title={row.project}>{row.project}</p>
                  </td>
                  <td className="px-4 py-2 font-bold text-slate-500 whitespace-nowrap">{row.poDate}</td>
                  <td className="px-4 py-2 text-right">
                    <p className="font-black text-slate-900 whitespace-nowrap">₹{parseFloat(row.poAmount).toLocaleString('en-IN')}</p>
                    <p className="text-[8px] text-slate-400 font-bold mt-0.5">Net Value</p>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                      row.grnStatus ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {row.grnStatus || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center scale-90">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                       <button 
                         onClick={() => handleViewPO(row.id)}
                         className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                         title="View Order"
                       >
                         <Eye className="w-3 h-3" />
                       </button>
                       <button 
                         onClick={() => handleViewPDF(row.id)}
                         className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                         title="View PO PDF"
                       >
                         <FileText className="w-3 h-3" />
                       </button>
                       <button 
                         onClick={() => handleDownloadPDF(row.id, row.poNumber)}
                         className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                         title="Download PDF"
                       >
                         <Download className="w-3 h-3" />
                       </button>
                       <button 
                         onClick={() => handlePrintPO(row.id)}
                         className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                         title="Print PO"
                       >
                         <Printer className="w-3 h-3" />
                       </button>
                       <button 
                         onClick={() => {
                           setUploadingPoId(row.id);
                           invoiceInputRef.current?.click();
                         }}
                         className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                         title="Upload Invoice"
                       >
                         <MoreVertical className="w-3 h-3" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalSummaryPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               Showing {(summaryPage - 1) * itemsPerPage + 1} to {Math.min(summaryPage * itemsPerPage, stats.summaryTable.length)} of {stats.summaryTable.length} entries
             </p>
             <div className="flex items-center gap-1">
               <button 
                 disabled={summaryPage === 1}
                 onClick={() => setSummaryPage(prev => prev - 1)}
                 className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
               >
                 <ChevronRight className="w-4 h-4 rotate-180" />
               </button>
               {[...Array(totalSummaryPages)].map((_, i) => (
                 <button 
                   key={i}
                   onClick={() => setSummaryPage(i + 1)}
                   className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-xs transition-all ${
                     summaryPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                   }`}
                 >
                   {i + 1}
                 </button>
               ))}
               <button 
                 disabled={summaryPage === totalSummaryPages}
                 onClick={() => setSummaryPage(prev => prev + 1)}
                 className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
               >
                 <ChevronRight className="w-4 h-4" />
               </button>
             </div>
          </div>
        )}
      </div>
      <input
        type="file"
        ref={invoiceInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ProcurementReport;
