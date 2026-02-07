import { useState, useEffect } from 'react';
import { Card, DataTable, Badge } from '../components/ui.jsx';
import { 
  ClipboardList, 
  Clock, 
  RotateCcw, 
  CheckCircle, 
  XCircle,
  Beaker
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const QualityDashboard = () => {
  const [stats, setStats] = useState({
    totalQc: 0,
    pendingQc: 0,
    inProgressQc: 0,
    passedQc: 0,
    failedQc: 0,
    qcPendingItems: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const [qcStatsRes, qcPendingRes] = await Promise.all([
        fetch(`${API_BASE}/qc-stats`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/inventory/qc-pending`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      const qcStatsData = qcStatsRes.ok ? await qcStatsRes.json() : {};
      const qcPendingData = qcPendingRes.ok ? await qcPendingRes.json() : [];

      setStats({
        ...qcStatsData,
        qcPendingItems: Array.isArray(qcPendingData) ? qcPendingData : []
      });
    } catch (error) {
      console.error('Error fetching quality dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, count, icon: Icon, colorClass }) => (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px]  text-slate-400   mb-1">{title}</p>
          <p className="text-2xl  text-slate-900">{count}</p>
        </div>
        <div className={`p-4 rounded-xl transition-colors ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  const columns = [
    { 
      label: 'GRN Reference', 
      key: 'grn_id', 
      sortable: true,
      render: (val) => <span className=" text-indigo-600">GRN-{String(val).padStart(4, '0')}</span> 
    },
    { 
      label: 'Item Code', 
      key: 'item_code', 
      sortable: true,
      render: (val) => <span className="font-medium text-slate-900">{val}</span>
    },
    { 
      label: 'Quantity Pending', 
      key: 'quantity', 
      className: 'text-right',
      render: (val) => <span className="font-mono  text-slate-700">{parseFloat(val || 0).toFixed(3)}</span>
    },
    { 
      label: 'Current Status', 
      key: 'status',
      render: (val) => (
        <Badge variant="purple" className=" tracking-wider  text-[10px]">
          {val}
        </Badge>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
          <Beaker className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="mt-6 text-sm  text-slate-500 tracking-wide">Gathering Quality Insights...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl  text-slate-900">Quality Assurance Dashboard</h1>
          <p className="text-slate-500 mt-1">Real-time monitoring of inspection status and manufacturing quality</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          title="Refresh Dashboard"
        >
          <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Total Inspections" 
          count={stats.totalQc || 0} 
          icon={ClipboardList}
          colorClass="bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
        />
        <StatCard 
          title="Awaiting QC" 
          count={stats.pendingQc || 0} 
          icon={Clock}
          colorClass="bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
        />
        <StatCard 
          title="In Progress" 
          count={stats.inProgressQc || 0} 
          icon={RotateCcw}
          colorClass="bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
        />
        <StatCard 
          title="Passed" 
          count={stats.passedQc || 0} 
          icon={CheckCircle}
          colorClass="bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
        />
        <StatCard 
          title="Failed" 
          count={stats.failedQc || 0} 
          icon={XCircle}
          colorClass="bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
          <h2 className="text-lg  text-slate-900">Items Awaiting Inspection</h2>
        </div>
        <DataTable
          columns={columns}
          data={stats.qcPendingItems}
          loading={loading}
          searchPlaceholder="Filter by item code..."
          emptyMessage="Perfect! No items are currently awaiting inspection"
        />
      </div>
    </div>
  );
};

export default QualityDashboard;

