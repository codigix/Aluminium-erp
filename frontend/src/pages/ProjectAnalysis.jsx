import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  BarChart3, TrendingUp, AlertCircle, CheckCircle2, 
  Clock, Activity, Filter, Download, RefreshCw,
  Projector, Building2, Calendar, IndianRupee,
  Factory, Users, Settings, Briefcase, ChevronRight,
  Target, Zap, Flame, LayoutDashboard, ArrowLeft,
  Truck, Package, History, Box, Layers, List,
  ClipboardList, GitBranch, MapPin, Search, Database,
  Eye, FileText, MoreVertical, Globe, Info, 
  ArrowRight, ShieldCheck, PlayCircle, Plus,
  Map, MoveRight, Receipt, Timer, Cpu, Monitor, AlertTriangle
} from 'lucide-react';
import { Card, DataTable, Button, StatusBadge } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const COLORS = {
  indigo: '#4f46e5',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  slate: '#94a3b8',
  chart: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#6366f1']
};

const ProjectAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [detailTab, setDetailTab] = useState('Overview');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [flowFilter, setFlowFilter] = useState('PENDING');

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectDetails(selectedProject.id);
    }
  }, [selectedProject]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/project-analysis`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching project analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (id) => {
    try {
      setDetailsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/project-analysis/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setProjectDetails(result);
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === '0000-00-00' || new Date(dateString).getTime() <= 0) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatCurrency = (value) => {
    return `₹${(parseFloat(value || 0)).toLocaleString('en-IN')}`;
  };

  const diffDays = (date1, date2) => {
    if (!date1) return 0;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d1 - d2;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleGenerateLedger = () => {
    try {
      if (!projectDetails) {
        alert("Project details are not loaded yet.");
        return;
      }

      const { projectInfo, workOrders, logistics, supplyChain, stockMovements, inventoryMatrix } = projectDetails;

      // 1. Project Overview Sheet
      const overviewData = [
        { Field: 'Project Name', Value: projectInfo.project_name },
        { Field: 'Customer', Value: projectInfo.company_name },
        { Field: 'Status', Value: projectInfo.status },
        { Field: 'Revenue', Value: projectInfo.net_total },
        { Field: 'Order Date', Value: formatDate(projectInfo.created_at) },
        { Field: 'Target Dispatch', Value: formatDate(projectInfo.target_dispatch_date) },
        { Field: 'Total Work Orders', Value: projectInfo.total_work_orders },
        { Field: 'Completed Work Orders', Value: projectInfo.completed_work_orders }
      ];

      // 2. Work Orders Sheet
      const woData = (workOrders || []).map(wo => ({
        'WO Number': wo.work_order_no,
        'Item': wo.item_name,
        'Quantity': wo.planned_qty,
        'Produced': wo.produced_qty,
        'Status': wo.status,
        'Target Date': formatDate(wo.target_date)
      }));

      // 3. Supply Chain Sheet
      const scData = (supplyChain || []).map(sc => ({
        'MR Number': sc.mr_no,
        'Item': sc.item_name,
        'Quantity': sc.quantity,
        'Status': sc.status,
        'Requested By': sc.requested_by_name || 'N/A',
        'Date': formatDate(sc.created_at)
      }));

      // 4. Stock Movements Sheet
      const smData = (stockMovements || []).map(sm => ({
        'Date': formatDate(sm.transaction_date || sm.created_at),
        'Item': sm.item_name,
        'Type': sm.transaction_type,
        'Quantity': sm.quantity,
        'Reference': sm.reference_no,
        'Warehouse': sm.warehouse_name
      }));

      // 5. Inventory Matrix Sheet
      const imData = (inventoryMatrix || []).map(im => ({
        'Item Name': im.item_name,
        'Item Code': im.item_code,
        'Unit': im.unit,
        'Available Qty': im.available_qty,
        'Required Qty': im.required_qty
      }));

      const wb = XLSX.utils.book_new();
      
      const wsOverview = XLSX.utils.json_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(wb, wsOverview, "Overview");

      if (woData.length > 0) {
        const wsWO = XLSX.utils.json_to_sheet(woData);
        XLSX.utils.book_append_sheet(wb, wsWO, "Work Orders");
      }

      if (scData.length > 0) {
        const wsSC = XLSX.utils.json_to_sheet(scData);
        XLSX.utils.book_append_sheet(wb, wsSC, "Supply Chain");
      }

      if (smData.length > 0) {
        const wsSM = XLSX.utils.json_to_sheet(smData);
        XLSX.utils.book_append_sheet(wb, wsSM, "Stock Movements");
      }

      if (imData.length > 0) {
        const wsIM = XLSX.utils.json_to_sheet(imData);
        XLSX.utils.book_append_sheet(wb, wsIM, "Inventory Matrix");
      }

      const safeFileName = (projectInfo.project_name || 'Project')
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, '_');

      XLSX.writeFile(wb, `Ledger_${safeFileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error generating ledger:", error);
      alert("Failed to generate ledger. Please check the console for details.");
    }
  };

  const handleGenerateGlobalLedger = () => {
    try {
      if (!data || !data.projectList) {
        alert("Project data is not loaded yet.");
        return;
      }

      const exportData = data.projectList.map(project => {
        const progress = project.totalJobs > 0 ? (project.completedJobs / project.totalJobs) * 100 : 0;
        return {
          'Reference': project.project_name,
          'SO Number': `SO-${project.id?.toString().padStart(6, '0')}`,
          'Client': project.company_name,
          'Status': project.status,
          'Target Dispatch': project.target_dispatch_date ? new Date(project.target_dispatch_date).toLocaleDateString('en-GB') : 'N/A',
          'Completion %': Math.round(progress),
          'Revenue': project.revenue,
          'Completed Jobs': project.completedJobs,
          'Total Jobs': project.totalJobs,
          'Yield %': project.yield ? Math.round(project.yield) : 100
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Project Summary");

      XLSX.writeFile(wb, `Global_Project_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error generating global ledger:", error);
      alert("Failed to generate global ledger.");
    }
  };

  const StatCard = ({ title, amount, subtitle, icon: Icon, color = 'bg-indigo-500', trend, trendValue, animate, subColor }) => (
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className={`absolute top-0 right-0 w-16 h-16 ${color} opacity-5 rounded -mr-6 -mt-6 transition-transform group-hover:scale-110`} />
      
      <div className="flex flex-col h-full justify-between relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400    mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl text-slate-900  ">{amount}</h3>
              {trendValue && (
                <span className={`flex items-center text-xs  ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {trend === 'up' ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <AlertCircle className="w-2.5 h-2.5 mr-0.5" />}
                  {trendValue}
                </span>
              )}
            </div>
          </div>
          <div className={`p-1.5 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
            {Icon && <Icon className={`w-3 h-3 ${animate ? 'animate-pulse' : ''}`} />}
          </div>
        </div>
        <div className="mt-2">
           <p className={`text-xs   ${subColor || 'text-slate-500'}`}>{subtitle}</p>
        </div>
      </div>
      {title === 'Completion' && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50">
           <div className="h-full bg-indigo-600 transition-all duration-1000" style={{width: amount}} />
        </div>
      )}
    </div>
  );

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-2">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
          <BarChart3 className="w-4 h-4 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-900  ">Analyzing Project Matrix</h3>
          <p className="text-xs text-slate-500 mt-1">Processing intelligence, timelines and resource yields...</p>
        </div>
      </div>
    );
  }

  const columns = [
    {
      label: 'REFERENCE',
      key: 'project_name',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-50 rounded border border-slate-100">
            <Projector className="w-3 h-3 text-slate-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-900   font-medium">{row.project_name}</span>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[10px] text-slate-400 ">#SO-{row.id?.toString().padStart(6, '0')}</span>
               {row.drawing_nos && (
                 <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1 rounded border border-indigo-100 max-w-[150px] truncate">
                   {row.drawing_nos}
                 </span>
               )}
            </div>
          </div>
        </div>
      )
    },
    {
      label: 'CLIENT',
      key: 'company_name',
      render: (val) => <span className="text-xs text-slate-600   ">{val}</span>
    },
    {
      label: 'STATUS',
      key: 'status',
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'COMPLETION',
      key: 'yield',
      render: (_, row) => {
        const progress = row.totalJobs > 0 ? (row.completedJobs / row.totalJobs) * 100 : 0;
        return (
          <div className="w-full max-w-[100px] space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs  text-slate-900">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-50 rounded h-1.5 overflow-hidden border border-slate-100">
              <div className="bg-indigo-600 h-full rounded transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      }
    },
    {
      label: 'REVENUE',
      key: 'revenue',
      className: 'text-right',
      render: (val) => <span className="text-xs  text-indigo-600">₹{parseFloat(val || 0).toLocaleString('en-IN')}</span>
    },
    {
      label: 'ACTION',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <button onClick={() => setSelectedProject(row)} className="p-1.5 hover:bg-indigo-600 hover:text-white text-slate-400 rounded transition-all border border-transparent hover:border-indigo-600 active:scale-95">
          <Eye className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  if (selectedProject) {
    if (detailsLoading || !projectDetails) {
      return (
        <div className="flex flex-col items-center justify-center p-22 space-y-2">
           <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
           <p className="text-xs text-slate-500 mt-1   ">Hydrating Intelligence Matrix...</p>
        </div>
      );
    }

    const { 
      projectInfo, productionFlow, workOrders: woDetails, logistics: logData, 
      supplyChain: scData, purchaseOrders = [], grns = [], qcInspections = [],
      stockMovements, inventoryMatrix, machineUtilization, 
      productionLogs, machineEfficiency, childOrders 
    } = projectDetails;

    const tabs = [
      { id: 'Overview', icon: LayoutDashboard },
      { id: 'Production Flow', icon: GitBranch },
      { id: 'Work Orders', icon: ClipboardList },
      { id: 'Logistics', icon: Truck },
      { id: 'Supply Chain', icon: Globe },
      { id: 'Production History', icon: History },
      { id: 'Inventory Matrix', icon: Box }
    ];

    if (childOrders && childOrders.length > 0) {
      tabs.splice(1, 0, { id: 'Sub-Orders', icon: GitBranch });
    }

    return (
      <div className=" pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Detail Header */}
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => { setSelectedProject(null); setProjectDetails(null); }} className="p-2 hover:bg-slate-50 text-slate-400 rounded border border-slate-100">
                 <ArrowLeft size={15} />
              </button>
              <div>
                 <div className="flex items-center gap-2">
                    <h1 className="text-xl text-slate-900  ">{projectInfo.project_name}</h1>
                    <div className="flex items-center gap-1.5 p-1 bg-blue-50 text-blue-600 rounded text-xs  border border-blue-100 ">
                       <Cpu size={15}/>
                       {projectInfo.status}
                    </div>
                 </div>
                 <div className="flex items-center gap-6 mt-1 text-xs  text-slate-400  ">
                    <span>Customer: <span className="text-slate-900">{projectInfo.company_name}</span></span>
                    <span>Project ID: <span className="text-indigo-600">SO-{projectInfo.id.toString().padStart(6, '0')}</span></span>
                    <span>PO: <span className="text-slate-900">{projectInfo.customer_po_no || 'N/A'}</span></span>
                 </div>
              </div>
           </div>

           <div className="flex mt-5 items-center gap-2 px-2 relative z-50">
              <div className=" rounded p-2 bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <BarChart3 size={15} className=" text-white" />
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateLedger();
                }}
                className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded text-[11px]    transition-all shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-2 cursor-pointer pointer-events-auto"
              >
                <Download className="w-4 h-4" />
                Generate Ledger
              </button>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center mt-5 gap-2 bg-white/50 border border-slate-100 p-1 rounded w-fit overflow-x-auto max-w-full no-scrollbar">
           {tabs.map((tab) => (
             <button
               key={tab.id}
               onClick={() => setDetailTab(tab.id)}
               className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs    transition-all whitespace-nowrap ${
                 detailTab === tab.id ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:text-rose-600 hover:bg-white'
               }`}
             >
               <tab.icon className="w-3.5 h-3.5" />
               {tab.id}
             </button>
           ))}
        </div>

        {detailTab === 'Overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-2">
             <div className="xl:col-span-3 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                   <StatCard 
                    title="Completion" 
                    amount={`${projectInfo.total_work_orders > 0 ? Math.round((projectInfo.completed_work_orders / projectInfo.total_work_orders) * 100) : 0}%`} 
                    subtitle="" 
                    icon={TrendingUp} 
                    trend="up" 
                   />
                   <StatCard title="Revenue" amount={formatCurrency(projectInfo.net_total)} subtitle="Confirmed" icon={ShieldCheck} subColor="text-emerald-500" />
                   <StatCard title="Timeline" amount={`${diffDays(projectInfo.target_dispatch_date, new Date())} Days`} subtitle="Remaining" icon={Clock} />
                   <StatCard title="Materials" amount={scData.length} subtitle="Requests Active" icon={Package} subColor="text-indigo-600" />
                   <StatCard title="Purchase Orders" amount={purchaseOrders.length} subtitle={`${grns.length} GRNs / ${qcInspections.length} QCs`} icon={FileText} subColor="text-amber-500" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-white rounded border border-slate-100 p-4 h-[250px] flex flex-col">
                      <h3 className="text-xs text-slate-400    mb-4">Supply Chain Health</h3>
                      <div className="space-y-4">
                         <div>
                            <div className="flex justify-between items-center mb-1 text-xs ">
                               <span className="text-slate-500 ">Material Requests</span>
                               <span className="text-slate-900">{scData.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length} / {scData.length} Approved</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-50 rounded overflow-hidden border border-slate-100">
                               <div className="h-full bg-emerald-500" style={{width: `${scData.length > 0 ? (scData.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length / scData.length) * 100 : 0}%`}} />
                            </div>
                         </div>
                         <div>
                            <div className="flex justify-between items-center mb-1 text-xs ">
                               <span className="text-slate-500 ">Stock Logistics</span>
                               <span className="text-slate-900">{stockMovements.length} Transactions</span>
                            </div>
                            <div className="flex gap-1 overflow-hidden">
                               {stockMovements.slice(0, 15).map((_, i) => <div key={i} className="flex-1 min-w-[4px] h-1.5 bg-emerald-500 rounded-sm" />)}
                            </div>
                         </div>
                      </div>
                      <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                               <Truck className="w-4 h-4" />
                            </div>
                            <div>
                               <p className="text-[8px] text-slate-400    leading-none">Last Request</p>
                               <p className="text-xs text-slate-900   ">{scData[0]?.mr_no || 'N/A'}</p>
                            </div>
                         </div>
                         <button onClick={() => setDetailTab('Supply Chain')} className="text-xs text-indigo-600   hover:underline flex items-center gap-1">
                            View Details <ArrowRight className="w-2.5 h-2.5" />
                         </button>
                      </div>
                   </div>

                   <div className="bg-white rounded border border-slate-100 p-4 h-[250px] flex flex-col">
                      <h3 className="text-xs text-slate-400    mb-4">Machine Utilization</h3>
                      <div className="flex-1">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={machineUtilization}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 8, fontWeight: 700}} />
                               <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                               <Bar dataKey="v" fill="#10b981" radius={[2, 2, 0, 0]} barSize={25} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="flex gap-4 mt-4 text-xs  ">
                         <span className="text-slate-400">Nodes: <span className="text-slate-900">{machineUtilization.length}</span></span>
                         <span className="text-slate-400">Avg Eff: <span className="text-slate-900">{Math.round(machineUtilization.reduce((acc, curr) => acc + parseFloat(curr.v || 0), 0) / (machineUtilization.length || 1))}%</span></span>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xs text-slate-400   ">Verified Progress by Stage</h3>
                      <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded bg-blue-500" />
                         <span className="text-xs text-slate-400   ">Verified Stage Output</span>
                      </div>
                   </div>
                   <div className="h-[350px] w-full flex items-center justify-center">
                      {productionFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={productionFlow.map(p => ({ n: p.item_name, v: p.planned_qty > 0 ? (p.produced_qty / p.planned_qty) * 100 : 0 }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                              <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="v" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={25} />
                           </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center">
                           <GitBranch className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                           <p className="text-xs text-slate-400   ">No production stages defined</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>

             <div className="bg-slate-900 rounded p-6 shadow-xl flex flex-col text-white">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xs text-indigo-400   ">Delivery Intelligence</h3>
                   <Calendar className="w-6 h-6 text-slate-700" />
                </div>
                <div className="mb-8">
                   <p className="text-xs text-slate-500   mb-1">Estimated Delivery</p>
                   <p className="text-xl   ">{formatDate(projectInfo.target_dispatch_date)}</p>
                </div>
                
                {new Date(projectInfo.target_dispatch_date) < new Date() && projectInfo.status !== 'SHIPPED' && (
                  <div className="bg-rose-900/30 border border-rose-500/30 rounded p-4 mb-8">
                    <div className="flex items-center gap-2 text-rose-500 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs  ">At Risk</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed ">Project is currently behind schedule. target delivery date has passed.</p>
                  </div>
                )}

                <div className="space-y-6">
                   <p className="text-xs text-slate-500   ">Key Milestones</p>
                   {[
                     { l: 'Project Kickoff', d: formatDate(projectInfo.created_at), c: 'indigo-500' },
                     { l: 'Target Delivery', d: formatDate(projectInfo.target_dispatch_date), c: 'slate-700' }
                   ].map((m, i) => (
                     <div key={i} className="flex gap-4 relative">
                        {i < 1 && <div className="absolute left-[3px] top-4 bottom-[-16px] w-[2px] bg-slate-800" />}
                        <div className={`w-2 h-2 rounded bg-${m.c} mt-1`} />
                        <div>
                           <p className="text-xs   leading-none mb-1">{m.l}</p>
                           <p className="text-xs text-slate-500  ">{m.d}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {detailTab === 'Sub-Orders' && (
          <div className="space-y-4">
            <div className="bg-white rounded border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-900 mb-4">Child Sales Orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {childOrders.map((child) => (
                  <div key={child.id} className="p-4 rounded border border-slate-100 bg-slate-50 hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{child.project_name || 'No Project Name'}</span>
                        <span className="text-[10px] text-slate-500">SO-{child.id.toString().padStart(6, '0')}</span>
                      </div>
                      <StatusBadge status={child.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                      <div>
                        <p className="text-slate-400">Created At</p>
                        <p className="text-slate-900">{formatDate(child.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400">Target Delivery</p>
                        <p className="text-slate-900">{formatDate(child.target_dispatch_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {detailTab === 'Production Flow' && (
          <div className="space-y-2">
             <div className="bg-white rounded border border-slate-100 p-4 flex items-center justify-between shadow-sm">
                <div>
                   <h3 className="text-sm text-slate-900  ">Production Workflow Analysis</h3>
                   <p className="text-xs text-slate-400   mt-0.5">Status of operations across all manufacturing phases</p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                  { id: 'PENDING', label: 'Pending', icon: Clock, color: 'slate', bgColor: 'bg-indigo-50/30' },
                  { id: 'IN_PROGRESS', label: 'In Progress', icon: PlayCircle, color: 'blue', bgColor: 'bg-blue-50/30' },
                  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle2, color: 'emerald', bgColor: 'bg-emerald-50/30' }
                ].map((col) => (
                  <div key={col.id} className={`flex flex-col gap-2 p-2 rounded-xl ${col.bgColor} border border-dashed border-slate-200`}>
                    {/* Kanban Header */}
                    <div className="bg-white rounded-lg border border-slate-100 p-2.5 flex items-center justify-between shadow-sm">
                       <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${col.id === 'PENDING' ? 'bg-slate-500' : col.id === 'IN_PROGRESS' ? 'bg-blue-600' : 'bg-emerald-600'} flex items-center justify-center text-white shadow-sm`}>
                             <col.icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                       </div>
                       <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-bold border border-slate-100">
                         {productionFlow.filter(f => f.status === col.id).length}
                       </span>
                    </div>

                    {/* Cards Container */}
                    <div className="space-y-2 min-h-[600px]">
                      {productionFlow.filter(stage => stage.status === col.id).length > 0 ? (
                        productionFlow
                          .filter(stage => stage.status === col.id)
                          .map((stage, idx) => {
                            const netPct = stage.planned_qty > 0 ? (stage.accepted_qty / stage.planned_qty) * 100 : 0;
                            const grossPct = stage.planned_qty > 0 ? (stage.produced_qty / stage.planned_qty) * 100 : 0;
                            const yieldPct = stage.produced_qty > 0 ? (stage.accepted_qty / stage.produced_qty) * 100 : 100;
                            
                            return (
                              <div key={idx} className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm hover:shadow-md transition-all border-l-2 border-l-indigo-400">
                                <div className="flex justify-between items-start mb-0.5">
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-medium">Stage {idx + 1}</p>
                                      <h4 className="text-[11px] font-bold text-slate-800 mt-0.5 leading-tight">{stage.item_name}</h4>
                                      <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400">
                                          <Calendar className="w-2.5 h-2.5 text-slate-300" />
                                          <span>{formatDate(stage.start_date || stage.created_at)} - {formatDate(stage.target_date)}</span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-[9px] font-bold ${yieldPct > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {Math.round(yieldPct)}% Yield
                                      </span>
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[8px] text-slate-400 font-bold tracking-wider uppercase">Execution Progress</span>
                                        <span className="text-[9px] font-bold text-slate-700">
                                           {Math.round(netPct)}% / {Math.round(grossPct)}%
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${netPct}%` }} />
                                        <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${Math.max(0, grossPct - netPct)}%` }} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-0.5 mt-3 pt-2 border-t border-slate-50">
                                   <div>
                                      <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Net: {Math.round(stage.accepted_qty)}</p>
                                   </div>
                                   <div className="text-center">
                                      <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Gross: {Math.round(stage.produced_qty)}</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Target: {Math.round(stage.planned_qty)}</p>
                                   </div>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-medium">
                                     <Layers className="w-3 h-3 text-slate-400" />
                                     <span>{stage.completed_job_cards || 0} Active Jobs</span>
                                  </div>
                                  {stage.rejected_qty > 0 && (
                                     <div className="flex items-center gap-1 text-rose-500 font-bold text-[10px]">
                                        <AlertTriangle className="w-3 h-3"/>
                                        {Math.round(stage.rejected_qty)} Loss
                                     </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-lg bg-white/50 text-center min-h-[150px]">
                           <Clock className="w-6 h-6 text-slate-300 mb-2" />
                           <p className="text-xs text-slate-500 font-medium">No Operations</p>
                           <p className="text-[10px] text-slate-400 mt-0.5">No manufacturing steps are currently in {col.label.toLowerCase()} status.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {detailTab === 'Work Orders' && (
          <div className="space-y-2">
             <div className="bg-white rounded border border-slate-100 p-5 shadow-sm relative overflow-hidden group">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded -mr-32 -mt-32 transition-transform group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 w-1/2 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-600 rounded shadow-lg shadow-indigo-100">
                         <Layers className="w-6 h-6 text-white" />
                      </div>
                      <div>
                         <p className="text-xs text-slate-400   tracking-[0.2em] mb-1">Production Planning & Control</p>
                         <h3 className="text-xl   text-slate-900 ">{projectInfo.project_name}</h3>
                         <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 rounded border border-slate-100 text-xs   ">
                               <Calendar className="w-3 h-3 text-indigo-500" />
                               {formatDate(projectInfo.created_at)}
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 text-xs   ">
                               <div className="w-1.5 h-1.5 rounded bg-indigo-500 animate-pulse" />
                               Status: {projectInfo.status}
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2 pr-4 border-l border-slate-100 pl-8">
                      <div className="text-right">
                         <p className="text-xs text-slate-400    mb-1">Total Operations</p>
                         <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-4xl   text-slate-900">{woDetails.length}</span>
                            <span className="text-xs text-indigo-500  ">Nodes</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                   <div>
                      <h4 className="text-sm text-slate-900  ">Manufacturing Work Orders</h4>
                      <p className="text-xs text-slate-400   mt-0.5">Detailed tracking of item production status</p>
                   </div>
                   <span className="p-1 bg-slate-50 text-slate-900 rounded text-xs  border border-slate-200">{woDetails.length} Orders</span>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50/50 border-b border-slate-50">
                         <tr className="text-[9px] text-slate-400   ">
                            <th className="px-4 py-3">Work Order</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">Qty</th>
                            <th className="px-4 py-3">Produced</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Target Delivery</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {woDetails.length > 0 ? woDetails.map((wo, i) => (
                           <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-4">
                                 <p className="text-xs text-slate-900  leading-none">{wo.work_order_no}</p>
                                 <p className="text-[8px] text-slate-400   mt-1">SO: SO-{wo.sales_order_id}</p>
                              </td>
                              <td className="px-4 py-4">
                                 <p className="text-xs text-slate-900  leading-none">{wo.item_name}</p>
                              </td>
                              <td className="px-4 py-4 text-xs text-slate-900 ">{wo.planned_qty}</td>
                              <td className="px-4 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1 bg-slate-50 rounded border border-slate-100 overflow-hidden min-w-[60px]">
                                       <div className="h-full bg-indigo-600" style={{width: `${wo.planned_qty > 0 ? (wo.produced_qty / wo.planned_qty) * 100 : 0}%`}} />
                                    </div>
                                    <span className="text-xs text-slate-900 ">{wo.produced_qty}</span>
                                 </div>
                              </td>
                              <td className="px-4 py-4">
                                 <StatusBadge status={wo.status} />
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex items-center gap-1.5 text-xs text-slate-500 ">
                                    <Calendar className="w-3 h-3 text-slate-300" />
                                    {formatDate(wo.target_date)}
                                 </div>
                              </td>
                           </tr>
                         )) : (
                           <tr>
                              <td colSpan="6" className="p-20 text-center text-slate-400 italic font-medium">
                                 No work orders found for this project
                              </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {detailTab === 'Logistics' && (
           <div className="space-y-2">
              <div className="bg-white rounded border border-slate-100 p-5 shadow-sm relative overflow-hidden group">
                 {/* Decorative Background Elements */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded -mr-32 -mt-32 transition-transform group-hover:scale-110" />
                 <div className="absolute bottom-0 left-0 w-1/3 h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                 <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                       <div className="p-3 bg-blue-600 rounded shadow-lg shadow-blue-100">
                          <Truck className="w-6 h-6 text-white" />
                       </div>
                       <div>
                          <p className="text-xs text-slate-400   tracking-[0.2em] mb-1">Logistics & Final Delivery</p>
                          <h3 className="text-xl   text-slate-900 ">Shipment Status for SO-{projectInfo.id.toString().padStart(6, '0')}</h3>
                          <div className="flex items-center gap-3 mt-3">
                             <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 rounded border border-slate-100 text-xs   ">
                                <MapPin className="w-3 h-3 text-blue-500" />
                                {projectInfo.company_name}
                             </div>
                             <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded border border-blue-100 text-xs   ">
                                <Box size={15}/>
                                {logData.length} Shipments Found
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-2 pr-4 border-l border-slate-100 pl-8">
                       <div className="text-right">
                          <p className="text-xs text-slate-400    mb-1">Total Dispatched</p>
                          <div className="flex items-baseline gap-1 justify-end">
                             <span className="text-4xl   text-slate-900">{logData.reduce((acc, curr) => acc + parseFloat(curr.shipped_qty || 0), 0)}</span>
                             <span className="text-xs text-blue-500  ">Units</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                 <div className="bg-white rounded border border-slate-100 shadow-sm p-4 min-h-[400px] flex flex-col overflow-hidden">
                    <h4 className="text-xs text-slate-900    mb-6 flex items-center gap-2">
                       <Box className="w-3.5 h-3.5 text-indigo-600" />
                       Delivery Challans / Official Orders
                    </h4>
                    <div className="overflow-x-auto">
                       <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/50 border-b border-slate-50    text-slate-400">
                             <tr>
                                <th className="px-4 py-3">Shipment ID</th>
                                <th className="px-4 py-3">Challan</th>
                                <th className="px-4 py-3">Carrier</th>
                                <th className="px-4 py-3">Qty</th>
                                <th className="px-4 py-3">Status</th>
                             </tr>
                          </thead>
                          <tbody>
                             {logData.length > 0 ? logData.map((log, i) => (
                               <tr key={i} className="border-b border-slate-50  text-slate-900">
                                  <td className="px-4 py-4 text-indigo-600">SHIP-{log.id.toString().padStart(6, '0')}</td>
                                  <td className="px-4 py-4 ">{log.challan_no || 'N/A'}</td>
                                  <td className="px-4 py-4 text-slate-400 italic">{log.courier_name || '--'}</td>
                                  <td className="px-4 py-4">{log.shipped_qty}</td>
                                  <td className="px-4 py-4">
                                     <span className="text-emerald-500   ">{log.status}</span>
                                  </td>
                               </tr>
                             )) : (
                               <tr>
                                  <td colSpan="5" className="p-20 text-center text-slate-400 italic  ">No shipment records found</td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {detailTab === 'Supply Chain' && (
           <div className="space-y-4">
              {/* Material Requests */}
              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                 <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-[11px] text-slate-900 font-bold uppercase tracking-wider">Material Requests (MR)</h3>
                    <span className="p-1 bg-indigo-50 text-indigo-600 rounded text-[9px]  border border-indigo-100">{scData.length} Requests</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                       <thead className="text-slate-400    border-b border-slate-50">
                          <tr>
                             <th className="px-2 py-3">MR ID</th>
                             <th className="px-2 py-3">Dept</th>
                             <th className="px-2 py-3">Purpose</th>
                             <th className="px-2 py-3">Status</th>
                             <th className="px-2 py-3">Request Date</th>
                          </tr>
                       </thead>
                       <tbody>
                          {scData.length > 0 ? scData.map((sc, i) => (
                            <tr key={i} className=" text-slate-900 hover:bg-slate-50/50">
                               <td className="px-2 py-4 font-medium text-indigo-600">{sc.mr_no}</td>
                               <td className="px-2 py-4">{sc.department_name}</td>
                               <td className="px-2 py-4">{sc.purpose}</td>
                               <td className="px-2 py-4">
                                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded border border-indigo-100  text-[8px] ">{sc.status}</span>
                               </td>
                               <td className="px-2 py-4 text-slate-400">{formatDate(sc.created_at)}</td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan="5" className="p-8 text-center text-slate-400 italic">No material requests found for this project</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* Purchase Orders */}
              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                 <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-[11px] text-slate-900 font-bold uppercase tracking-wider">Purchase Orders (via Customer PO)</h3>
                    <span className="p-1 bg-amber-50 text-amber-600 rounded text-[9px] border border-amber-100">{purchaseOrders.length} POs</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                       <thead className="text-slate-400 border-b border-slate-50">
                          <tr>
                             <th className="px-2 py-3">PO Number</th>
                             <th className="px-2 py-3">Vendor</th>
                             <th className="px-2 py-3">Items</th>
                             <th className="px-2 py-3 text-right">Total Value</th>
                             <th className="px-2 py-3">Status</th>
                             <th className="px-2 py-3">Created Date</th>
                          </tr>
                       </thead>
                       <tbody>
                          {purchaseOrders.length > 0 ? purchaseOrders.map((po, i) => (
                            <tr key={i} className="text-slate-900 hover:bg-slate-50/50">
                               <td className="px-2 py-4 font-medium text-indigo-600">{po.po_number}</td>
                               <td className="px-2 py-4">{po.vendor_name || 'N/A'}</td>
                               <td className="px-2 py-4">{po.item_count} items</td>
                               <td className="px-2 py-4 text-right">{formatCurrency(po.total_value)}</td>
                               <td className="px-2 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${po.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>{po.status}</span>
                               </td>
                               <td className="px-2 py-4 text-slate-400">{formatDate(po.created_at)}</td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan="6" className="p-8 text-center text-slate-400 italic">No purchase orders found for this project</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* GRNs & QC Inspections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 {/* GRNs */}
                 <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                       <h3 className="text-[11px] text-slate-900 font-bold uppercase tracking-wider">Goods Receipt Notes (GRNs)</h3>
                       <span className="p-1 bg-emerald-50 text-emerald-600 rounded text-[9px] border border-emerald-100">{grns.length} Receipts</span>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-xs text-left">
                          <thead className="text-slate-400 border-b border-slate-50">
                             <tr>
                                <th className="px-2 py-3">GRN ID</th>
                                <th className="px-2 py-3">Vendor / PO</th>
                                <th className="px-2 py-3 text-right">Received Qty</th>
                                <th className="px-2 py-3">Status</th>
                                <th className="px-2 py-3">Date</th>
                             </tr>
                          </thead>
                          <tbody>
                             {grns.length > 0 ? grns.map((g, i) => (
                               <tr key={i} className="text-slate-900 hover:bg-slate-50/50">
                                  <td className="px-2 py-4 font-medium text-indigo-600">GRN-{g.id.toString().padStart(6, '0')}</td>
                                  <td className="px-2 py-4">
                                     <p className="font-medium text-slate-800">{g.vendor_name}</p>
                                     <p className="text-[10px] text-slate-400">PO: {g.linked_po_number || g.po_number}</p>
                                  </td>
                                  <td className="px-2 py-4 text-right">{g.received_quantity}</td>
                                  <td className="px-2 py-4">
                                     <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100 text-[8px] font-bold">{g.status}</span>
                                  </td>
                                  <td className="px-2 py-4 text-slate-400">{formatDate(g.grn_date)}</td>
                               </tr>
                             )) : (
                               <tr>
                                  <td colSpan="5" className="p-8 text-center text-slate-400 italic">No GRN receipts found for this project</td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* QC Inspections */}
                 <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                       <h3 className="text-[11px] text-slate-900 font-bold uppercase tracking-wider">Incoming Quality Checks</h3>
                       <span className="p-1 bg-rose-50 text-rose-600 rounded text-[9px] border border-rose-100">{qcInspections.length} Inspections</span>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-xs text-left">
                          <thead className="text-slate-400 border-b border-slate-50">
                             <tr>
                                <th className="px-2 py-3">Date</th>
                                <th className="px-2 py-3">PO Number</th>
                                <th className="px-2 py-3 text-right font-medium">Received / Pass / Fail</th>
                                <th className="px-2 py-3">Status</th>
                             </tr>
                          </thead>
                          <tbody>
                             {qcInspections.length > 0 ? qcInspections.map((qc, i) => (
                               <tr key={i} className="text-slate-900 hover:bg-slate-50/50">
                                  <td className="px-2 py-4 text-slate-400">{formatDate(qc.inspection_date)}</td>
                                  <td className="px-2 py-4 font-medium text-indigo-600">{qc.po_number}</td>
                                  <td className="px-2 py-4 text-right">
                                     <span className="text-slate-900">{qc.received_quantity}</span>
                                     <span className="text-slate-300 mx-1">/</span>
                                     <span className="text-emerald-600 font-bold">{qc.pass_quantity}</span>
                                     <span className="text-slate-300 mx-1">/</span>
                                     <span className="text-rose-600 font-bold">{qc.fail_quantity}</span>
                                  </td>
                                  <td className="px-2 py-4">
                                     <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${qc.status === 'PASSED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{qc.status}</span>
                                  </td>
                               </tr>
                             )) : (
                               <tr>
                                  <td colSpan="4" className="p-8 text-center text-slate-400 italic">No incoming QC inspections found</td>
                               </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>

              {/* Stock Movements */}
              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                 <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-[11px] text-slate-900 font-bold uppercase tracking-wider">Stock Logistics</h3>
                    <span className="p-1 bg-emerald-50 text-emerald-600 rounded text-[9px]  border border-emerald-100 ">{stockMovements.length} Movements</span>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                       <thead className="text-slate-400    border-b border-slate-50">
                          <tr>
                             <th className="px-2 py-3">Transaction</th>
                             <th className="px-2 py-3">Item Details</th>
                             <th className="px-2 py-3">Type</th>
                             <th className="px-2 py-3 text-right">Quantity</th>
                             <th className="px-2 py-3 text-right">Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {stockMovements.length > 0 ? stockMovements.map((stk, i) => (
                            <tr key={i} className=" text-slate-900 hover:bg-slate-50/50">
                               <td className="px-2 py-4">
                                  <p>STK-{stk.id.toString().padStart(6, '0')}</p>
                               </td>
                               <td className="px-2 py-4">
                                  <p>{stk.item_name}</p>
                               </td>
                               <td className="px-2 py-4 ">
                                  <span className={`p-1 rounded border text-[8px]  ${stk.transaction_type === 'IN' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                    {stk.transaction_type}
                                  </span>
                               </td>
                               <td className="px-2 py-4 text-right ">{stk.quantity}</td>
                               <td className="px-2 py-4 text-right">
                                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-100 text-[8px]   ">Approved</span>
                               </td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan="5" className="p-8 text-center text-slate-400 italic">No stock transactions found for this project</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}

        {detailTab === 'Production History' && (
           <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                 <StatCard title="Overall Plan" amount={woDetails.reduce((acc, curr) => acc + parseFloat(curr.planned_qty || 0), 0).toLocaleString()} subtitle="Units" icon={Layers} />
                 <StatCard title="Overall Actual" amount={woDetails.reduce((acc, curr) => acc + parseFloat(curr.produced_qty || 0), 0).toLocaleString()} subtitle="Units" icon={Target} subColor="text-indigo-600" />
                 <StatCard 
                    title="Production Yield" 
                    amount={`${
                       woDetails.reduce((acc, curr) => acc + parseFloat(curr.planned_qty || 0), 0) > 0 
                       ? Math.round((woDetails.reduce((acc, curr) => acc + parseFloat(curr.produced_qty || 0), 0) / woDetails.reduce((acc, curr) => acc + parseFloat(curr.planned_qty || 0), 0)) * 100) 
                       : 0
                    }%`} 
                    subtitle="" 
                    icon={TrendingUp} 
                    trend="up" 
                    subColor="text-emerald-500" 
                 />
                 <StatCard title="Operations" amount={woDetails.length} subtitle="Work Orders" icon={ClipboardList} subColor="text-rose-500" />
              </div>

              <div className="bg-white rounded border border-slate-100 p-6 shadow-sm">
                 <div className="flex items-center justify-between mb-12">
                    <h3 className="text-[11px] text-slate-900   ">Global Production Tracking</h3>
                    <div className="flex items-center gap-6">
                       <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                          <span className="text-[9px] text-slate-400  ">Plan</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded bg-rose-500" />
                          <span className="text-[9px] text-slate-400  ">Actual</span>
                       </div>
                    </div>
                 </div>
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={woDetails.map(wo => ({ n: wo.work_order_no, p: wo.planned_qty, a: wo.produced_qty }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 900}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 900}} />
                          <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="p" fill="#10b981" radius={[2, 2, 0, 0]} barSize={35} />
                          <Bar dataKey="a" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={35} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                         <History className="w-4 h-4" />
                      </div>
                      <div>
                         <h4 className="text-[11px] text-slate-900    leading-none">Recent Production Logs</h4>
                         <p className="text-xs text-slate-400    mt-1 italic">Audit log of all production transactions</p>
                      </div>
                   </div>
                   <span className="p-1 bg-slate-50 text-slate-900 rounded text-[9px]  border border-slate-200  ">{productionLogs?.length || 0} Records</span>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50/50 border-b border-slate-50 text-slate-400   ">
                         <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Work Order</th>
                            <th className="px-4 py-3">Operation</th>
                            <th className="px-4 py-3 text-right">Quantity</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {(productionLogs || []).length > 0 ? productionLogs.map((log, i) => (
                           <tr key={i} className="hover:bg-slate-50/30 transition-colors text-slate-900 ">
                              <td className="px-4 py-4 text-slate-400   ">ENTRY-{log.id.toString().padStart(6, '0')}</td>
                              <td className="px-4 py-4">{formatDate(log.date)}</td>
                              <td className="px-4 py-4  ">{log.work_order}</td>
                              <td className="px-4 py-4">
                                 <span className="p-1 bg-blue-50 text-blue-600 rounded text-[8px]   border border-blue-100 ">{log.operation}</span>
                              </td>
                              <td className="px-4 py-4 text-right  ">{log.quantity}</td>
                           </tr>
                         )) : (
                           <tr>
                              <td colSpan="5" className="p-20 text-center text-slate-400    italic">No production logs found for this project</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
           </div>
        )}

        {detailTab === 'Inventory Matrix' && (
           <div className="space-y-2">
              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm">
                       <Layers className="w-4 h-4" />
                    </div>
                    <div>
                       <h4 className="text-[11px] text-slate-900    leading-none">Resource & Component Readiness</h4>
                       <p className="text-xs text-slate-400    mt-1 italic">Tracking inventory requirements across all production stages</p>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs ">
                       <thead className="bg-slate-50/50 border-b border-slate-50 text-slate-400  ">
                          <tr>
                             <th className="px-4 py-3">Item Details</th>
                             <th className="px-4 py-3 text-right">Required</th>
                             <th className="px-4 py-3 text-right">Available</th>
                             <th className="px-4 py-3 text-right">Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {inventoryMatrix.length > 0 ? inventoryMatrix.map((item, i) => (
                             <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-4  ">
                                   <p className="text-slate-900">{item.item_name}</p>
                                   <p className="text-slate-400  text-[8px]">{item.item_code}</p>
                                </td>
                                <td className="px-4 py-4 text-right text-slate-900">{item.required_qty} {item.unit}</td>
                                <td className="px-4 py-4 text-right text-emerald-600  ">{item.available_qty || 0} {item.unit}</td>
                                <td className="px-4 py-4 text-right  ">
                                   <span className={`p-1 rounded border text-[8px]  ${item.available_qty >= item.required_qty ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : 'text-rose-500 bg-rose-50 border-rose-100'}`}>
                                     {item.available_qty >= item.required_qty ? 'Ready' : 'Shortage'}
                                   </span>
                                </td>
                             </tr>
                          )) : (
                              <tr>
                                 <td colSpan="4" className="p-8 text-center text-slate-400 italic">No inventory matrix requirements found for this project</td>
                              </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="bg-white rounded border border-slate-100 p-4 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm">
                       <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                       <h4 className="text-[11px] text-slate-900    leading-none">Machine Efficiency</h4>
                       <p className="text-xs text-slate-400    mt-1 italic">Real-time utilization and downtime analysis</p>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs ">
                       <thead className="bg-slate-50/50 border-b border-slate-50 text-slate-400  ">
                          <tr>
                             <th className="px-4 py-3">Machine</th>
                             <th className="px-4 py-3 text-right">Working</th>
                             <th className="px-4 py-3 text-right">Downtime</th>
                             <th className="px-4 py-3 text-right">Efficiency</th>
                             <th className="px-4 py-3 text-right">Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {machineEfficiency && machineEfficiency.length > 0 ? machineEfficiency.map((m, i) => (
                             <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-4  ">
                                   <p className="text-slate-900">{m.name}</p>
                                   <p className="text-slate-400  text-[8px]">{m.workstation_code}</p>
                                </td>
                                <td className="px-4 py-4 text-right text-slate-900">{Number(m.working_hrs).toFixed(1)} hrs</td>
                                <td className="px-4 py-4 text-right text-slate-400  ">{Number(m.downtime_hrs).toFixed(1)} hrs</td>
                                <td className="px-4 py-4 text-right">
                                   <div className="flex flex-col items-end gap-1">
                                      <span className="text-slate-900 ">{Math.round(m.efficiency)}%</span>
                                      <div className="w-24 h-1 bg-slate-50 rounded overflow-hidden border border-slate-100">
                                         <div className={`h-full ${m.efficiency > 90 ? 'bg-emerald-500' : m.efficiency > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{width: `${m.efficiency}%`}} />
                                      </div>
                                   </div>
                                </td>
                                <td className="px-4 py-4 text-right  ">
                                   <span className={`p-1 rounded border text-[8px]  ${m.efficiency > 90 ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : m.efficiency > 70 ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-rose-500 bg-rose-50 border-rose-100'}`}>
                                     {m.efficiency > 90 ? 'Optimal' : m.efficiency > 70 ? 'Warning' : 'Critical'}
                                   </span>
                                </td>
                             </tr>
                          )) : (
                             <tr>
                                <td colSpan="5" className="p-8 text-center text-slate-400 italic">No workstation data found for this project</td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  const DATEDIFF = (d1, d2) => {
    const diffTime = new Date(d1) - new Date(d2);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-2 pb-12">
      {/* List Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-500 rounded shadow-lg shadow-rose-200">
            <BarChart3 size={15} className=" text-white" />
          </div>
          <div>
            <h1 className="text-xl text-slate-900 ">Project Matrix Analytics</h1>
            <div className="flex items-center gap-2 mt-1">
               <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-xs border border-rose-100   ">
                  Intelligence Matrix
               </span>
               <div className="flex items-center gap-1.5 text-xs text-slate-400 ">
                 <Clock className="w-3.5 h-3.5" />
                 Matrix Sync: {lastUpdated.toLocaleTimeString()}
               </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStats} className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleGenerateGlobalLedger}
            className="flex items-center gap-2 p-2 bg-rose-500 text-white rounded text-xs hover:bg-rose-600 transition-all shadow-lg shadow-rose-100   cursor-pointer pointer-events-auto relative z-10"
          >
            <Download className="w-4 h-4" />
            Generate Ledger
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
        <StatCard title="Total Projects" amount={data?.kpis?.totalProjects} subtitle="Active engagements" icon={Briefcase} trend="up" trendValue="12%" />
        <StatCard title="Estimated Revenue" amount={`₹${(data?.kpis?.estimatedRevenue / 100000).toFixed(1)}L`} subtitle="Projected value" icon={IndianRupee} trend="up" trendValue="8%" />
        <StatCard title="Ready For Shipment" amount={data?.kpis?.readyForShipment} subtitle="Approved for dispatch" icon={Truck} color="bg-emerald-500" subColor="text-emerald-600" animate />
        <StatCard title="System Completion" amount={`${data?.kpis?.completionRate}%`} subtitle="Overall throughput" icon={Target} trend="up" trendValue="5%" />
        <StatCard title="Critical Assets" amount={data?.kpis?.atRiskProjects} subtitle="Requires attention" icon={Flame} trend="down" trendValue="2%" animate />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        <div className="xl:col-span-2 bg-white rounded p-2 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xs text-slate-400    flex items-center gap-2 mb-8">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Timeline Analytics
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.timelineData || []}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="production" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                <Area type="monotone" dataKey="forecast" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xs text-slate-400   mb-8 ">Status Distribution</h3>
          <div className="flex-1 flex flex-col items-center">
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.statusBreakdown || []}
                    innerRadius={70} outerRadius={95}
                    paddingAngle={8} dataKey="value" stroke="none"
                  >
                    {(data?.statusBreakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                 <span className="text-3xl  text-slate-900">{data?.kpis?.completionRate}%</span>
                 <span className="text-xs  text-slate-400  ">Throughput</span>
              </div>
            </div>
            <div className="mt-8 space-y-1 w-full">
              {(data?.statusBreakdown || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded bg-slate-50/50 border border-transparent hover:border-slate-100 transition-all  text-xs ">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded" style={{ backgroundColor: COLORS.chart[index % COLORS.chart.length] }} />
                    <span className="text-slate-600 ">{item.name}</span>
                  </div>
                  <span className="text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 ">
            <h3 className="text-xs text-slate-900  flex items-center gap-2 ">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Live Project Operations
            </h3>
          </div>
          <div className="flex-1 overflow-hidden p-2">
            <DataTable columns={columns} data={data?.projectList || []} loading={loading} hideHeader pageSize={10} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectAnalysis;
