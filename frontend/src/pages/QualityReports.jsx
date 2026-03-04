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
  ArrowUpRight
} from 'lucide-react';
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
    recentReports: []
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

  const StatCard = ({ title, value, icon: Icon, colorClass, trend }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{value}</h3>
            {trend && (
              <div className="flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                {trend}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-slate-100">
        <div className="w-12 h-12 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Generating Quality Analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quality Reports</h1>
          <p className="text-slate-500 font-medium mt-1">Advanced analytics and compliance reporting</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-white px-5 py-2.5 border border-slate-200 rounded-xl shadow-sm font-bold text-slate-700 hover:bg-slate-50 transition-all group">
            <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            <span>Export Report</span>
          </button>
          <div className="flex items-center gap-3 pl-5 border-l border-slate-200">
            <div className="text-right">
              <p className="text-sm font-black text-slate-900">Alice</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">QA Inspector</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-200">
              A
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 mb-8">Monthly Inspection Trend</h2>
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
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 mb-8">Defect Category Breakdown</h2>
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
                <span className="text-3xl font-black text-slate-900">30%</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Average</span>
              </div>
            </div>
            <div className="flex-1 space-y-4 w-full">
              {data.defectBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 transition-colors">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900">{item.value}%</span>
                    <div className="w-12 h-1.5 bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ backgroundColor: item.color, width: `${item.value}%` }}></div>
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
        <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black text-slate-900">Supplier Quality Performance</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="pb-4">Supplier</th>
                  <th className="pb-4 text-right">Quality Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.supplierPerformance.length > 0 ? data.supplierPerformance.map((row, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-sm font-bold text-slate-600 group-hover:text-slate-900">{row.supplier}</td>
                    <td className="py-4 text-right">
                      <span className="text-sm font-black text-slate-900">{row.qualityScore}%</span>
                    </td>
                  </tr>
                )) : (
                  ['ABC Metals', 'Global Alloys', 'Sanika Industries'].map((name, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-sm font-bold text-slate-600 group-hover:text-slate-900">{name}</td>
                      <td className="py-4 text-right">
                        <span className="text-sm font-black text-slate-900">{95 - (idx * 3)}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supplier Quality Detail Table */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-black text-slate-900 mb-8">Supplier Quality Performance</h2>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="pb-4">Report ID</th>
                  <th className="pb-4">GRN</th>
                  <th className="pb-4">Inspector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentReports.map((report, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-xs font-bold text-blue-600">QC-{2026}-00{idx+1}</td>
                    <td className="py-4 text-xs font-bold text-slate-600">{report.grn}</td>
                    <td className="py-4 text-xs font-bold text-slate-900">{report.inspector || 'John'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Inspection Reports */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-black text-slate-900 mb-8">Recent Inspection Reports</h2>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="pb-4">Report ID</th>
                  <th className="pb-4">GRN</th>
                  <th className="pb-4 text-right">Date</th>
                  <th className="pb-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentReports.map((report, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-xs font-bold text-blue-600">QC-{2026}-00{idx+1}</td>
                    <td className="py-4 text-xs font-bold text-slate-600">{report.grn}</td>
                    <td className="py-4 text-right text-xs font-medium text-slate-400">
                      {new Date(report.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-4 text-right">
                      <Badge 
                        variant={report.status === 'PASSED' || report.status === 'ACCEPTED' ? 'success' : 'danger'}
                        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5"
                      >
                        {report.status === 'PASSED' || report.status === 'ACCEPTED' ? 'Passed' : 'Failed'}
                      </Badge>
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

export default QualityReports;
