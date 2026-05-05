import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, DataTable, StatusBadge, Button } from '../components/ui.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  TrendingUp, IndianRupee, ShoppingCart, Clock, CheckCircle2, 
  Target, Filter, Download, RefreshCw, Calendar, ChevronRight,
  FileText, Users, Eye, Printer, Share2, Trash2, Edit, Truck,
  CheckCircle, XCircle, Send, Package, ArrowRight, MoreVertical,
  Activity, Play, ClipboardList, Layers, Settings
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ProductionReport = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedProject, setSelectedProject] = useState('All');
  const [summaryPage, setSummaryPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);
  const itemsPerPage = 2;
  const itemsPerSmallPage = 3;

  useEffect(() => {
    fetchProductionReport();
    setSummaryPage(1);
    setProjectsPage(1);
  }, [dateRange, selectedProject]);

  const fetchProductionReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/dashboard/production-report?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedProject !== 'All') url += `&project=${selectedProject}`;

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch production report');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching production report:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedSummary = useMemo(() => {
    if (!stats?.summaryTable) return [];
    const startIndex = (summaryPage - 1) * itemsPerPage;
    return stats.summaryTable.slice(startIndex, startIndex + itemsPerPage);
  }, [stats?.summaryTable, summaryPage]);

  const totalSummaryPages = Math.ceil((stats?.summaryTable?.length || 0) / itemsPerPage);

  const paginatedProjects = useMemo(() => {
    if (!stats?.topProjects) return [];
    const startIndex = (projectsPage - 1) * itemsPerSmallPage;
    return stats.topProjects.slice(startIndex, startIndex + itemsPerSmallPage);
  }, [stats?.topProjects, projectsPage]);

  const totalProjectsPages = Math.ceil((stats?.topProjects?.length || 0) / itemsPerSmallPage);

  const handleExport = () => {
    if (!stats) return;

    const wb = XLSX.utils.book_new();

    // 1. Production Summary
    const summaryData = [
      { Metric: 'Total Work Orders', Value: stats.kpis?.totalWorkOrders || 0 },
      { Metric: 'In Progress', Value: stats.kpis?.inProgress || 0 },
      { Metric: 'Completed', Value: stats.kpis?.completed || 0 },
      { Metric: 'Planned Qty', Value: stats.kpis?.plannedQty || 0 },
      { Metric: 'Produced Qty', Value: stats.kpis?.producedQty || 0 },
      { Metric: 'Overall Efficiency %', Value: stats.kpis?.overallEfficiency || 0 }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Production Summary");

    // 2. Operation Efficiency
    if (stats.operationEfficiency) {
      const operationData = stats.operationEfficiency.map(op => ({
        'Operation': op.name,
        'Efficiency %': op.efficiency,
        'Status': op.status
      }));
      const wsOperations = XLSX.utils.json_to_sheet(operationData);
      XLSX.utils.book_append_sheet(wb, wsOperations, "Operation Efficiency");
    }

    // 3. Top Projects by Production
    if (stats.topProjects) {
      const projectData = stats.topProjects.map(p => ({
        'Project / Client': p.name,
        'Planned Qty': p.planned,
        'Produced Qty': p.produced,
        'Efficiency %': p.efficiency
      }));
      const wsProjects = XLSX.utils.json_to_sheet(projectData);
      XLSX.utils.book_append_sheet(wb, wsProjects, "Top Projects");
    }

    // 4. Recent Production Activity
    if (stats.recentActivity) {
      const activityData = stats.recentActivity.map(a => ({
        'Activity': a.text,
        'Time': a.time,
        'Date': a.date
      }));
      const wsActivity = XLSX.utils.json_to_sheet(activityData);
      XLSX.utils.book_append_sheet(wb, wsActivity, "Recent Activity");
    }

    // 5. Work Orders Summary
    if (stats.workOrdersSummary) {
      const woSummaryData = stats.workOrdersSummary.map(wo => ({
        'Work Order ID': wo.woNo,
        'Project / Client': wo.project,
        'Operation': wo.operation,
        'Item To Manufacture': wo.item,
        'Planned Qty': wo.planned,
        'Produced Qty': wo.produced,
        'Progress %': wo.progress,
        'Status': wo.status,
        'Start Date': wo.startDate,
        'Due Date': wo.dueDate
      }));
      const wsWO = XLSX.utils.json_to_sheet(woSummaryData);
      XLSX.utils.book_append_sheet(wb, wsWO, "Work Orders Summary");
    }

    XLSX.writeFile(wb, `Production_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        <h3 className="text-slate-900 font-black tracking-tight uppercase">Generating Production Report...</h3>
      </div>
    );
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e'];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-slate-900 font-black tracking-tight">Production Report</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Monitor production performance and operational efficiency</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
             <Calendar className="w-4 h-4 text-slate-400" />
             01 Apr 2026 - 05 May 2026
             <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
          </div>
          <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 outline-none">
            <option>All Projects</option>
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
        <KPIStoreCard title="Total Work Orders" value={stats.kpis.totalWorkOrders} subtitle="All Time" icon={ClipboardList} color="text-indigo-600" subColor="bg-indigo-50" />
        <KPIStoreCard title="In Progress" value={stats.kpis.inProgress} subtitle={`${stats.kpis.inProgressPercent}%`} icon={Play} color="text-blue-600" subColor="bg-blue-50" />
        <KPIStoreCard title="Completed" value={stats.kpis.completed} subtitle={`${stats.kpis.completedPercent}%`} icon={CheckCircle2} color="text-emerald-600" subColor="bg-emerald-50" />
        <KPIStoreCard title="Planned Qty" value={stats.kpis.plannedQty} subtitle="Total Units" icon={Target} color="text-amber-600" subColor="bg-amber-50" />
        <KPIStoreCard title="Produced Qty" value={stats.kpis.producedQty} subtitle="Total Units" icon={Layers} color="text-indigo-600" subColor="bg-indigo-50" />
        <KPIStoreCard title="Overall Efficiency" value={`${stats.kpis.efficiency}%`} subtitle="(Produced / Planned)" icon={Activity} color="text-rose-600" subColor="bg-rose-50" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Production Trend</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Planned vs Produced quantity over time</p>
            </div>
            <select className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <option>Daily</option>
            </select>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.productionTrend}>
                <defs>
                  <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px'}} />
                <Area name="Planned Qty" type="monotone" dataKey="planned" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorPlanned)" />
                <Area name="Produced Qty" type="monotone" dataKey="produced" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProduced)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Work Order Status */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8 text-center lg:text-left">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Work Order Status</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Distribution of work orders by status</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.statusDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Total</p>
                <h4 className="text-xl font-black text-slate-900">{stats.kpis.totalWorkOrders}</h4>
              </div>
            </div>
            <div className="w-full mt-6 space-y-2">
              {stats.statusDistribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-900">{item.value} ({item.percent}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operation Efficiency */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Operation Efficiency</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Average efficiency by operations</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-50 pb-2">
              <span className="flex-1">Operation</span>
              <span className="w-20 text-center">Efficiency</span>
              <span className="w-16 text-right">Status</span>
            </div>
            {stats.operationEfficiency.map((op, idx) => (
              <div key={idx} className="flex items-center group">
                <span className="flex-1 text-[11px] font-black text-slate-900">{op.name}</span>
                <span className="w-20 text-center text-[11px] font-bold text-slate-600">{op.efficiency}%</span>
                <span className="w-16 text-right">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    op.efficiency >= 70 ? 'text-emerald-600 bg-emerald-50' : 
                    op.efficiency >= 50 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50'
                  }`}>
                    {op.efficiency >= 70 ? 'Good' : op.efficiency >= 50 ? 'Average' : 'Low'}
                  </span>
                </span>
              </div>
            ))}
            <button className="w-full text-center mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center justify-center gap-1">
              View all operations <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Projects */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Top Projects by Production</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Projects with highest production output</p>
            </div>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all projects <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-3 pr-2">Project / Client</th>
                  <th className="pb-3 pr-2 text-center">Planned Qty</th>
                  <th className="pb-3 pr-2 text-center">Produced Qty</th>
                  <th className="pb-3 text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedProjects.map((project, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 pr-2">
                      <p className="text-xs font-black text-slate-900">{project.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-tighter">{project.client}</p>
                    </td>
                    <td className="py-4 text-xs font-bold text-slate-600 text-center">{parseFloat(project.planned).toFixed(2)}</td>
                    <td className="py-4 text-xs font-bold text-slate-600 text-center">{parseFloat(project.produced).toFixed(2)}</td>
                    <td className="py-4 text-right">
                       <span className={`text-[10px] font-black ${
                         project.efficiency >= 60 ? 'text-emerald-600' : 'text-amber-600'
                       }`}>{project.efficiency}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalProjectsPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Page {projectsPage} of {totalProjectsPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={projectsPage === 1}
                  onClick={() => setProjectsPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={projectsPage === totalProjectsPages}
                  onClick={() => setProjectsPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Production Activity */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Recent Production Activity</h3>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all activity <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 
                  activity.type === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' : 
                  activity.type === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  {activity.type === 'COMPLETED' ? <CheckCircle className="w-3.5 h-3.5" /> : 
                   activity.type === 'IN_PROGRESS' ? <Activity className="w-3.5 h-3.5" /> : 
                   activity.type === 'PENDING' ? <Clock className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 border-b border-slate-50 pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-900 tracking-tight">
                        Work Order {activity.wo} {activity.type === 'COMPLETED' ? 'completed' : 
                                               activity.type === 'IN_PROGRESS' ? 'in progress' : 
                                               activity.type === 'PENDING' ? 'pending' : 'on hold'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">Operation: {activity.operation}</p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] text-slate-400 font-bold whitespace-nowrap">
                        {new Date(activity.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <span className="block text-[9px] text-slate-400 font-bold mt-1">
                        {new Date(activity.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
           <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Work Orders Summary</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Work Order ID</th>
                <th className="px-6 py-4">Project / Client</th>
                <th className="px-6 py-4">Operation</th>
                <th className="px-6 py-4">Item To Manufacture</th>
                <th className="px-6 py-4 text-center">Planned Qty</th>
                <th className="px-6 py-4 text-center">Produced Qty</th>
                <th className="px-6 py-4">Progress</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedSummary.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                  <td className="px-6 py-4 font-black text-indigo-600">{row.woNumber}</td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900">{row.project}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{row.client}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-600">{row.operation}</td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900 uppercase tracking-tighter">{row.itemCode}</p>
                    <p className="text-[9px] text-slate-500 font-bold mt-0.5">{row.itemName}</p>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-600">{parseFloat(row.plannedQty).toFixed(3)}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-900">{parseFloat(row.producedQty).toFixed(3)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                         <div className={`h-full rounded-full ${
                           row.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                         }`} style={{ width: `${row.progress}%` }} />
                       </div>
                       <span className="text-[10px] font-black text-slate-900">{row.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold whitespace-nowrap">
                    {row.startDate ? new Date(row.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold whitespace-nowrap">
                    {row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                       {[Eye, BarChart, Printer].map((Icon, i) => (
                         <button key={i} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all border border-transparent hover:border-slate-200">
                           <Icon className="w-3.5 h-3.5" />
                         </button>
                       ))}
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
    </div>
  );
};

export default ProductionReport;
