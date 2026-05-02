import { useState, useEffect } from 'react';
import { Card, DataTable, Badge } from '../components/ui.jsx';
import { 
  ClipboardList, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  RotateCcw,
  BarChart3,
  Download,
  Calendar,
  ChevronDown,
  User,
  Search,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { errorToast } from '../utils/toast';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#f59e0b',
  purple: '#7c3aed',
  background: '#f8fafc',
  chart: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6']
};

const QualityReports = () => {
  const [loading, setLoading] = useState(true);
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
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/qc-inspections/reports`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching quality reports:', error);
    } finally {
      setLoading(false);
    }
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

  const StatCard = (props) => {
    const { title, value, icon: Icon, colorClass, trend } = props;
    return (
      <div className="bg-white rounded p-5 border border-slate-100 shadow-sm hover: transition-all">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded  ${colorClass}`}>
            <Icon className="w-3 h-3" />
          </div>
          <div className="flex-1">
            <p className="text-xs   text-slate-400   mb-1">{title}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-xl  text-slate-900">{value}</h3>
              {trend && (
                <div className="flex items-center text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 ">
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                  {trend}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-22 bg-white rounded border border-slate-100">
        <div className="w-5 h-5 border-4 border-blue-50 border-t-blue-600 rounded animate-spin mb-4" />
        <p className="text-slate-500 animate-pulse">Generating Quality Analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen space-y-2">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-xl  text-slate-900 ">Quality Reports</h1>
          <p className="text-slate-500 mt-1">Advanced analytics and compliance reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-white p-2  border border-slate-200 rounded  shadow-sm  text-slate-700 hover:bg-slate-50 transition-all group">
            <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            <span>Export Report</span>
          </button>
          <div className="flex items-center gap-2 pl-5 border-l border-slate-200">
            <div className="text-right">
              <p className="text-xs  text-slate-900">Alice</p>
              <p className="text-xs text-slate-400   ">QA Inspector</p>
            </div>
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white  shadow-lg shadow-blue-200">
              A
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <StatCard 
          title="Total Inspections" 
          value={data.kpis.totalInspections} 
          icon={ClipboardList}
          colorClass="bg-blue-50 text-blue-600"
          trend="+ 12%"
        />
        <StatCard 
          title="Pass Rate" 
          value={data.kpis.passRate} 
          icon={CheckCircle}
          colorClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard 
          title="Rejection Rate" 
          value={data.kpis.rejectionRate} 
          icon={AlertTriangle}
          colorClass="bg-red-50 text-red-600"
        />
        <StatCard 
          title="Quality Score" 
          value={data.kpis.qualityScore} 
          icon={TrendingUp}
          colorClass="bg-orange-50 text-orange-600"
        />
        <StatCard 
          title="Defect Score" 
          value={data.kpis.defectScore} 
          icon={RotateCcw}
          colorClass="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-8 rounded  border border-slate-100 shadow-sm">
          <h2 className="text-xl  text-slate-900 mb-8">Monthly Inspection Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="passed" name="Passed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Defect Category Breakdown */}
        <div className="bg-white p-8 rounded  border border-slate-100 shadow-sm">
          <h2 className="text-xl  text-slate-900 mb-8">Defect Category Breakdown</h2>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 h-80 lg:h-auto">
            <div className="w-64 h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.defectBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {data.defectBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl  text-slate-900">30%</span>
                <span className="text-xs text-slate-400   ">Average</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 w-full">
              {data.defectBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded shadow-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm  text-slate-500 group-hover:text-slate-900 transition-colors">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs  text-slate-900">{item.value}%</span>
                    <div className="w-12 h-1.5 bg-slate-50 rounded overflow-hidden">
                      <div className="h-full rounded transition-all duration-1000" style={{ backgroundColor: item.color, width: `${item.value}%` }}></div>
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
        <div className="lg:col-span-1 bg-white p-6 rounded  border border-slate-100 shadow-sm flex flex-col max-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold  text-slate-900 uppercase tracking-tight">Supplier Performance</h2>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full">
              <thead className="text-left text-[10px] font-bold text-slate-400 uppercase sticky top-0 bg-white z-10 pb-4">
                <tr>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.supplierPerformance.length > 0 ? data.supplierPerformance.map((row, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 text-xs font-medium  text-slate-600 group-hover:text-slate-900">{row.supplier}</td>
                    <td className="py-3 text-right">
                      <span className="text-xs font-bold  text-slate-900">{row.qualityScore}%</span>
                    </td>
                  </tr>
                )) : (
                  ['ABC Metals', 'Global Alloys', 'Sanika Industries'].map((name, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 text-xs font-medium  text-slate-600 group-hover:text-slate-900">{name}</td>
                      <td className="py-3 text-right">
                        <span className="text-xs font-bold  text-slate-900">{95 - (idx * 3)}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supplier Quality Detail Table */}
        <div className="lg:col-span-1 bg-white p-6 rounded  border border-slate-100 shadow-sm flex flex-col max-h-[500px]">
          <h2 className="text-sm font-bold  text-slate-900 mb-6 uppercase tracking-tight">Recent QC History</h2>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full">
              <thead className="text-left text-[10px] font-bold text-slate-400 uppercase sticky top-0 bg-white z-10 pb-4">
                <tr>
                  <th className="pb-3">Report</th>
                  <th className="pb-3">GRN</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentReports.map((report, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 text-[10px] font-bold text-blue-600">QC-{String(report.reportId).padStart(4, '0')}</td>
                    <td className="py-3 text-[10px] font-medium text-slate-600">{report.grn}</td>
                    <td className="py-3 text-right">
                      <button 
                        onClick={() => handleDownloadPdf(report.reportId)}
                        className="p-1 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-all"
                        title="QC Report"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Inspection Reports */}
        <div className="lg:col-span-1 bg-white p-6 rounded  border border-slate-100 shadow-sm flex flex-col max-h-[500px]">
          <h2 className="text-sm font-bold  text-slate-900 mb-6 uppercase tracking-tight">Inspection Results</h2>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full">
              <thead className="text-left text-[10px] font-bold text-slate-400 uppercase sticky top-0 bg-white z-10 pb-4">
                <tr>
                  <th className="pb-3 text-left">Report</th>
                  <th className="pb-3 text-right">Status</th>
                  <th className="pb-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentReports.map((report, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-blue-600 leading-none">QC-{String(report.reportId).padStart(4, '0')}</span>
                        <span className="text-[9px] text-slate-400 mt-1">{report.grn}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <Badge 
                        variant={report.status === 'PASSED' || report.status === 'ACCEPTED' ? 'success' : 'danger'}
                        className="text-[9px] font-bold px-1.5 py-0 rounded"
                      >
                        {report.status === 'PASSED' || report.status === 'ACCEPTED' ? 'PASS' : 'FAIL'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <button 
                        onClick={() => handleDownloadPdf(report.reportId)}
                        className="p-1 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-all"
                        title="QC Report"
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rejections Table Section */}
      <div className="bg-white p-6 rounded border border-slate-100 shadow-sm mt-4 flex flex-col max-h-[500px]">
        <h2 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-tight">Recent Quality Rejections</h2>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className="text-left text-[10px] font-bold text-slate-400 uppercase sticky top-0 bg-white z-10 pb-4">
              <tr className="border-b border-slate-50">
                <th className="pb-3">Item Details</th>
                <th className="pb-3">Reference</th>
                <th className="pb-3 text-center">Rejected Qty</th>
                <th className="pb-3">Reason</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.recentRejections.map((rejection, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 leading-tight">{rejection.material_name}</span>
                      <span className="text-[10px] text-indigo-600 font-mono mt-0.5">{rejection.item_code}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-600 font-bold">{rejection.reference_number}</span>
                      <span className="text-[9px] text-slate-400">{rejection.source_name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      {parseFloat(rejection.rejected_qty || 0).toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3 text-[10px] text-slate-500 italic">
                    {rejection.item_remarks || 'No remarks'}
                  </td>
                  <td className="py-3 text-right">
                    {rejection.ref_type === 'GRN' && rejection.qc_inspection_id && (
                      <button 
                        onClick={() => handleDownloadPdf(rejection.qc_inspection_id)}
                        className="px-2 py-1 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded hover:bg-orange-100 transition-all active:scale-95"
                      >
                        QC Report
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.recentRejections.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 italic text-xs">No recent rejections recorded.</td>
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
