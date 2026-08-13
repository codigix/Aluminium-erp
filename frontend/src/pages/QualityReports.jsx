import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, DataTable, StatusBadge, Button, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  TrendingUp, IndianRupee, ShoppingCart, Clock, CheckCircle2, 
  Target, Filter, Download, RefreshCw, Calendar, ChevronRight,
  FileText, Users, Eye, Printer, Share2, Trash2, Edit, Truck,
  CheckCircle, XCircle, Send, Package, ArrowRight, MoreVertical,
  Activity, Play, ClipboardList, Layers, Settings, Box, Warehouse,
  AlertTriangle, Archive, Move, Search, ShieldCheck, RotateCcw
} from 'lucide-react';
import { errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const QualityReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [inspectionsPage, setInspectionsPage] = useState(1);
  const [allHistoryPage, setAllHistoryPage] = useState(1);
  const [suppliersPage, setSuppliersPage] = useState(1);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const itemsPerPage = 5;
  const inspectionsPerPage = 10;
  const allHistoryPerPage = 15;

  const [data, setData] = useState({
    kpis: {
      totalInspections: 0,
      passRate: '0%',
      rejectionRate: '0%',
      qualityScore: '0%',
      defectScore: '0%'
    },
    monthlyTrend: [],
    defectBreakdown: [],
    supplierPerformance: [],
    recentReports: [],
    recentRejections: []
  });

  useEffect(() => {
    fetchReportData();
    setInspectionsPage(1);
    setAllHistoryPage(1);
    setSuppliersPage(1);
  }, [dateRange, selectedSupplier]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/qc-inspections/reports?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedSupplier !== 'All') url += `&supplier=${selectedSupplier}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching quality reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedInspections = useMemo(() => {
    if (!data?.recentReports) return [];
    const perPage = showAllHistory ? allHistoryPerPage : inspectionsPerPage;
    const currPage = showAllHistory ? allHistoryPage : inspectionsPage;
    const startIndex = (currPage - 1) * perPage;
    return data.recentReports.slice(startIndex, startIndex + perPage);
  }, [data?.recentReports, inspectionsPage, allHistoryPage, showAllHistory]);

  const totalInspectionPages = Math.ceil((data?.recentReports?.length || 0) / inspectionsPerPage);
  const totalHistoryPages = Math.ceil((data?.recentReports?.length || 0) / allHistoryPerPage);

  const paginatedSuppliers = useMemo(() => {
    if (!data?.supplierPerformance) return [];
    const startIndex = (suppliersPage - 1) * itemsPerPage;
    return data.supplierPerformance.slice(startIndex, startIndex + itemsPerPage);
  }, [data?.supplierPerformance, suppliersPage]);

  const totalSupplierPages = Math.ceil((data?.supplierPerformance?.length || 0) / itemsPerPage);

  const handleExport = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    const summaryData = [
      { Metric: 'Total Inspections', Value: data.kpis?.totalInspections || 0 },
      { Metric: 'Pass Rate', Value: data.kpis?.passRate || '0%' },
      { Metric: 'Rejection Rate', Value: data.kpis?.rejectionRate || '0%' },
      { Metric: 'Quality Score', Value: data.kpis?.qualityScore || '0%' },
      { Metric: 'Defect Score', Value: data.kpis?.defectScore || '0%' }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Quality Summary");

    if (data.supplierPerformance) {
      const supplierData = data.supplierPerformance.map(s => ({
        'Supplier': s.supplier,
        'Quality Score': s.qualityScore,
        'Pass Rate': s.passRate || '0%'
      }));
      const wsSuppliers = XLSX.utils.json_to_sheet(supplierData);
      XLSX.utils.book_append_sheet(wb, wsSuppliers, "Supplier Performance");
    }

    if (data.recentReports) {
      const reportData = data.recentReports.map(r => ({
        'Report ID': `QC-${String(r.reportId).padStart(4, '0')}`,
        'GRN Number': r.grn,
        'Status': r.status,
        'Date': r.date
      }));
      const wsReports = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(wb, wsReports, "Recent QC Reports");
    }

    XLSX.writeFile(wb, `Quality_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadPdf = async (qcId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QC_Report_${qcId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      errorToast('Failed to download QC Report');
    }
  };

  const KPIStoreCard = ({ title, value, subtitle, icon: Icon, color, subColor }) => (
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-16 h-16 ${subColor} opacity-10 rounded -mr-6 -mt-6 transition-transform group-hover:scale-110`} />
      <div className={`p-2 rounded ${subColor} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider leading-tight truncate">{title}</p>
        <h3 className="text-xl font-bold text-slate-900 leading-tight truncate">{value}</h3>
        <p className="text-xs text-slate-500 font-medium leading-tight truncate">{subtitle}</p>
      </div>
    </div>
  );

  const isDataLoading = loading || !data;

  if (showAllHistory) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl text-slate-900  ">QC Inspection History</h2>
            <div className="hidden md:flex items-center gap-2">
               <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">Total: {data.kpis.totalInspections}</div>
               <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">Pass: {data.kpis.passRate}</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowAllHistory(false)}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Report
          </Button>
        </div>

        {/* Mini KPIs for History View */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <KPIStoreCard title="Total" value={data.kpis.totalInspections} subtitle="Total Inspections" icon={ClipboardList} color="text-indigo-600" subColor="bg-indigo-50" />
           <KPIStoreCard title="Pass Rate" value={data.kpis.passRate} subtitle="Success Ratio" icon={CheckCircle} color="text-emerald-600" subColor="bg-emerald-50" />
           <KPIStoreCard title="Rejection" value={data.kpis.rejectionRate} subtitle="Failure Ratio" icon={AlertTriangle} color="text-rose-600" subColor="bg-rose-50" />
           <KPIStoreCard title="Quality" value={data.kpis.qualityScore} subtitle="Compliance" icon={ShieldCheck} color="text-blue-600" subColor="bg-blue-50" />
        </div>

        <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400 font-bold uppercase tracking-tighter border-b border-slate-100">
                  <th className="p-2">Report ID</th>
                  <th className="p-2">GRN Number</th>
                  <th className="p-2">Date</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedInspections.map((report, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2  text-indigo-600 font-bold">QC-{String(report.reportId).padStart(4, '0')}</td>
                    <td className="p-2  text-slate-600 font-medium">{report.grn}</td>
                    <td className="p-2 text-slate-500">{report.date}</td>
                    <td className="p-2 text-center">
                       <StatusBadge status={report.status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/qc-grn-details/${report.grnId}`)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDownloadPdf(report.reportId)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalHistoryPages > 1 && (
            <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs  text-slate-400  ">
                Showing {(allHistoryPage - 1) * allHistoryPerPage + 1} to {Math.min(allHistoryPage * allHistoryPerPage, data.recentReports.length)} of {data.recentReports.length} entries
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={allHistoryPage === 1}
                  onClick={() => setAllHistoryPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalHistoryPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setAllHistoryPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded  text-xs font-bold transition-all ${
                      allHistoryPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={allHistoryPage === totalHistoryPages}
                  onClick={() => setAllHistoryPage(prev => prev + 1)}
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

  const chartColors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl text-slate-900  ">Quality Reports</h1>
          <p className="text-xs text-slate-500    mt-1">Advanced analytics and compliance reporting</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded text-xs  text-slate-600">
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
            className="bg-white border border-slate-200 rounded p-2 text-xs  text-slate-600 outline-none"
          >
            <option value="All">All Suppliers</option>
            {data?.supplierPerformance?.map((s, idx) => (
              <option key={idx} value={s.supplier}>{s.supplier}</option>
            ))}
          </select>
          <button 
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded text-xs   transition-all flex items-center gap-2  shadow-indigo-100"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {isDataLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KPIStoreCard title="Total Inspections" value={data?.kpis?.totalInspections || 0} subtitle="All Inspections" icon={ClipboardList} color="text-indigo-600" subColor="bg-indigo-50" />
            <KPIStoreCard title="Pass Rate" value={data?.kpis?.passRate || '0%'} subtitle="Success Ratio" icon={CheckCircle} color="text-emerald-600" subColor="bg-emerald-50" />
            <KPIStoreCard title="Rejection Rate" value={data?.kpis?.rejectionRate || '0%'} subtitle="Failure Ratio" icon={AlertTriangle} color="text-rose-600" subColor="bg-rose-50" />
            <KPIStoreCard title="Quality Score" value={data?.kpis?.qualityScore || '0/10'} subtitle="Compliance Rating" icon={ShieldCheck} color="text-blue-600" subColor="bg-blue-50" />
            <KPIStoreCard title="Defect Score" value={data?.kpis?.defectScore || '0/10'} subtitle="Issue Frequency" icon={RotateCcw} color="text-amber-600" subColor="bg-amber-50" />
          </>
        )}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-2 rounded border border-slate-100 shadow-sm">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900   ">Monthly Inspection Trend</h3>
            <p className="text-xs text-slate-400   mt-1">Inspection outcomes over time</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyTrend || []}>
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
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: '' }} />
                <Bar dataKey="passed" name="Passed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Defect Category Breakdown */}
        <div className="bg-white p-2 rounded border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900   ">Defect Category Breakdown</h3>
            <p className="text-xs text-slate-400   mt-1">Primary defect drivers</p>
          </div>
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="w-64 h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.defectBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {(data?.defectBreakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl   text-slate-900">{data?.kpis?.rejectionRate || '0%'}</span>
                <span className="text-xs  text-slate-400 ">Avg Rejection</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 w-full">
              {(data?.defectBreakdown || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }}></div>
                    <span className="text-xs  text-slate-500  group-hover:text-slate-900 transition-colors">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs  text-slate-900">{item.value}%</span>
                    <div className="w-16 h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ backgroundColor: chartColors[index % chartColors.length], width: `${item.value}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Supplier Performance */}
        <div className="lg:col-span-1 bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50">
            <h3 className="text-sm text-slate-900   ">Supplier Performance</h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400    border-b border-slate-100">
                  <th className="p-2">Supplier</th>
                  <th className="p-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedSuppliers.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2  text-slate-900">{row.supplier}</td>
                    <td className="p-2 text-right">
                       <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ">{row.qualityScore}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalSupplierPages > 1 && (
            <div className="p-2 border-t border-slate-50 flex items-center justify-between">
               <span className="text-xs  text-slate-400">Page {suppliersPage} of {totalSupplierPages}</span>
               <div className="flex gap-1">
                 <button disabled={suppliersPage === 1} onClick={() => setSuppliersPage(p => p - 1)} className="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-50"><ChevronRight className="w-3 h-3 rotate-180" /></button>
                 <button disabled={suppliersPage === totalSupplierPages} onClick={() => setSuppliersPage(p => p + 1)} className="p-1 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-50"><ChevronRight className="w-3 h-3" /></button>
               </div>
            </div>
          )}
        </div>

        {/* Recent QC Reports Table */}
        <div className="lg:col-span-2 bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-sm text-slate-900   ">Recent QC Inspections</h3>
            <button 
              onClick={() => setShowAllHistory(true)}
              className="text-xs  text-indigo-600   flex items-center gap-1 hover:underline"
            >
              View All History <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400    border-b border-slate-100">
                  <th className="p-2">Report ID</th>
                  <th className="p-2">GRN Number</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedInspections.map((report, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2  text-indigo-600">QC-{String(report.reportId).padStart(4, '0')}</td>
                    <td className="p-2  text-slate-600">{report.grn}</td>
                    <td className="p-2 text-center">
                       <StatusBadge status={report.status} />
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/qc-grn-details/${report.grnId}`)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDownloadPdf(report.reportId)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalInspectionPages > 1 && (
            <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs  text-slate-400  ">
                Showing {(inspectionsPage - 1) * inspectionsPerPage + 1} to {Math.min(inspectionsPage * inspectionsPerPage, data?.recentReports?.length || 0)} of {data?.recentReports?.length || 0} entries
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={inspectionsPage === 1}
                  onClick={() => setInspectionsPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalInspectionPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setInspectionsPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded  text-xs transition-all ${
                      inspectionsPage === i + 1 ? 'bg-indigo-600 text-white  shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={inspectionsPage === totalInspectionPages}
                  onClick={() => setInspectionsPage(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rejections Table Section */}
      <div className="bg-white p-2 rounded border border-slate-100 shadow-sm mt-4 flex flex-col">
        <h3 className="text-sm text-slate-900    mb-6">Recent Quality Rejections</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-xs text-slate-400    border-b border-slate-100">
                <th className="p-2">Item Details</th>
                <th className="p-2">Reference</th>
                <th className="p-2 text-center">Rejected Qty</th>
                <th className="p-2">Reason</th>
                <th className="p-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.recentRejections.map((rejection, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                  <td className="p-2">
                    <div className="flex flex-col">
                      <span className=" text-slate-900 leading-tight">{rejection.material_name}</span>
                      <span className="text-xs text-indigo-600  mt-0.5  er">{rejection.item_code}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col">
                      <span className=" text-slate-600">{rejection.reference_number}</span>
                      <span className="text-xs text-slate-400  ">{rejection.source_name}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600  border border-rose-100">
                      {parseFloat(rejection.rejected_qty || 0).toFixed(3)}
                    </span>
                  </td>
                  <td className="p-2 text-slate-500  italic">
                    {rejection.item_remarks || 'No remarks'}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {rejection.ref_type === 'GRN' && (
                        <button 
                          onClick={() => navigate(`/qc-grn-details/${rejection.ref_id}`)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {rejection.ref_type === 'GRN' && rejection.qc_inspection_id && (
                        <button 
                          onClick={() => handleDownloadPdf(rejection.qc_inspection_id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded transition-all border border-transparent hover:border-rose-100"
                          title="QC Report"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.recentRejections.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400    text-xs">No recent rejections recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QualityReports;
