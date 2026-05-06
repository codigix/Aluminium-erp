import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, DataTable, StatusBadge, Button } from '../components/ui.jsx';
import { 
  RefreshCw, 
  Download, 
  Search, 
  Package, 
  TrendingUp, 
  Layers, 
  PieChart as PieChartIcon,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const MaterialConsumption = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [stats, setStats] = useState({
    totalAllocated: 0,
    totalConsumed: 0,
    totalRemaining: 0,
    overallEfficiency: 0
  });

  useEffect(() => {
    fetchConsumptionData();
  }, []);

  const fetchConsumptionData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/project-analysis/material-consumption`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const projects = result.projectList || [];
        
        const consumptionList = projects.map(p => {
          const isFullyConsumed = p.allocated_qty > 0 && p.consumed_qty >= p.allocated_qty;
          const isPartiallyConsumed = p.consumed_qty > 0;
          
          return {
            id: p.id,
            projectName: p.project_name,
            soNumber: `SO-${p.id + 1000}`, 
            customer: p.company_name,
            drawingNos: p.drawing_nos,
            itemDescriptions: p.item_descriptions,
            allocated: p.allocated_qty,
            consumed: p.consumed_qty,
            remaining: p.remaining_qty,
            status: isFullyConsumed ? 'FULLY_CONSUMED' : 
                    isPartiallyConsumed ? 'PARTIALLY_CONSUMED' : 'PENDING',
            efficiency: p.efficiency
          };
        });

        setData(consumptionList);
        setLastUpdated(new Date());
        
        const totalAllocated = consumptionList.reduce((sum, item) => sum + item.allocated, 0);
        const totalConsumed = consumptionList.reduce((sum, item) => sum + item.consumed, 0);
        const totalRemaining = consumptionList.reduce((sum, item) => sum + item.remaining, 0);
        const avgEfficiency = consumptionList.reduce((sum, item) => sum + item.efficiency, 0) / (consumptionList.length || 1);

        setStats({
          totalAllocated,
          totalConsumed,
          totalRemaining,
          overallEfficiency: avgEfficiency
        });
      }
    } catch (error) {
      console.error('Error fetching consumption data:', error);
      errorToast('Failed to load consumption metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCSV = () => {
    if (!data || data.length === 0) return;

    const exportData = data.map(item => ({
      'Project Name': item.projectName,
      'SO Number': item.soNumber,
      'Customer': item.customer,
      'Drawing Nos': item.drawingNos,
      'Allocated': item.allocated,
      'Consumed': item.consumed,
      'Remaining': item.remaining,
      'Status': item.status,
      'Efficiency %': Math.round(item.efficiency)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consumption Report");
    XLSX.writeFile(wb, `Material_Consumption_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns = [
    {
      label: 'PROJECT DETAILS',
      key: 'projectName',
      render: (val, row) => (
        <div>
          <div className=" text-slate-900">{val}</div>
          <div className="text-xs text-slate-400 mt-0.5  ">SO: {row.soNumber}</div>
        </div>
      )
    },
    {
      label: 'CUSTOMER',
      key: 'customer',
      render: (val) => <span className="text-slate-600 ">{val}</span>
    },
    {
      label: 'DRAWING NO & DESCRIPTION',
      key: 'drawingNos',
      render: (val, row) => (
        <div className="max-w-xs">
          <div className="text-slate-900  truncate" title={val || 'N/A'}>
            {val || 'N/A'}
          </div>
          <div className="text-xs text-slate-500 truncate" title={row.itemDescriptions || 'No description'}>
            {row.itemDescriptions || 'No description'}
          </div>
        </div>
      )
    },
    {
      label: 'ALLOCATED',
      key: 'allocated',
      className: 'text-right',
      render: (val) => <span className="text-slate-900 ">{parseFloat(val || 0).toFixed(1)} units</span>
    },
    {
      label: 'CONSUMED',
      key: 'consumed',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex flex-col items-end min-w-[140px]">
          <div className="flex items-center gap-2">
            <div className="text-rose-600 ">{parseFloat(val || 0).toLocaleString()} units</div>
            <div className="text-xs text-slate-400 ">
              {row.allocated > 0 ? Math.round((val / row.allocated) * 100) : 0}%
            </div>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded mt-1 overflow-hidden">
            <div 
              className="h-full bg-rose-500 transition-all duration-500" 
              style={{ width: `${Math.min(100, (val / (row.allocated || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )
    },
    {
      label: 'REMAINING',
      key: 'remaining',
      className: 'text-right',
      render: (val) => <span className="text-slate-500">{parseFloat(val || 0).toFixed(1)} units</span>
    },
    {
      label: 'STATUS',
      key: 'status',
      render: (val) => <StatusBadge status={val} />
    }
  ];

  const StatCard = ({ title, amount, subtitle, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm hover: transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 rounded  transition-transform group-hover:scale-110`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs text-slate-400 mb-1   ">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl  text-slate-900 ">{amount}</h3>
            {trendValue && (
              <span className="flex items-center text-xs  text-emerald-500">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                {trendValue}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1   ">{subtitle}</p>
        </div>
        <div className={`p-2 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} ${color.replace('bg-', 'text-').replace('500', '600')} transition-transform group-hover:rotate-12 shadow-sm`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 ">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-500 rounded shadow-lg shadow-rose-200">
            <Layers size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl  text-slate-900  ">Material Consumption</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400   ">
              <Clock className="w-3 h-3" />
              Last sync: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchConsumptionData}
            className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleGenerateCSV}
            className="flex items-center gap-2 p-2 bg-rose-500 text-white rounded text-xs  hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 active:scale-95  tracking-[0.1em]"
          >
            <Download className="w-4 h-4" />
            Generate CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard 
          title="Total Allocated" 
          amount={stats.totalAllocated.toFixed(1)} 
          subtitle="Gross planned material units"
          icon={Package}
          color="bg-blue-500"
        />
        <StatCard 
          title="Total Consumed" 
          amount={stats.totalConsumed.toLocaleString()} 
          subtitle="Overall utilization index"
          icon={TrendingUp}
          color="bg-rose-500"
          trendValue={`${Math.round((stats.totalConsumed / (stats.totalAllocated || 1)) * 100)}%`}
        />
        <StatCard 
          title="Total Remaining" 
          amount={stats.totalRemaining.toFixed(1)} 
          subtitle="Pending for issuance"
          icon={PieChartIcon}
          color="bg-amber-500"
        />
        <StatCard 
          title="Efficiency" 
          amount={`${Math.round(stats.overallEfficiency)}%`} 
          subtitle="Plant yield metrics"
          icon={CheckCircle2}
          color="bg-emerald-500"
        />
      </div>

      {/* Main Content Table */}
      <div className="flex flex-col">
        <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded text-slate-500">
              <LayoutGrid className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs  text-slate-900  ">Project Consumption Matrix</h3>
              <p className="text-xs text-slate-400   ">Monitor allocation vs actual usage across all production lines</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400   ">
            <Info className="w-3.5 h-3.5 text-rose-500" />
            Sync with Material Requests
          </div>
        </div>
        
        <div className="p-1">
          <DataTable 
            columns={columns}
            data={data}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default MaterialConsumption;