import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import { 
  ClipboardList, 
  Clock, 
  RotateCcw, 
  CheckCircle, 
  XCircle,
  Beaker
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500  tracking-wider mb-1">{title}</p>
          <p className="text-xl text-slate-900">{count}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <Beaker className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600 tracking-wide">Loading Quality Metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Total Inspections" 
          count={stats.totalQc || 0} 
          icon={ClipboardList}
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard 
          title="QC Pending" 
          count={stats.pendingQc || 0} 
          icon={Clock}
          colorClass="bg-amber-50 text-amber-600"
        />
        <StatCard 
          title="In Progress" 
          count={stats.inProgressQc || 0} 
          icon={RotateCcw}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard 
          title="Passed" 
          count={stats.passedQc || 0} 
          icon={CheckCircle}
          colorClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard 
          title="Failed" 
          count={stats.failedQc || 0} 
          icon={XCircle}
          colorClass="bg-red-50 text-red-600"
        />
      </div>

      <Card title="Items Awaiting Inspection" subtitle="Goods received requiring quality verification">
        {stats.qcPendingItems.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">All clear! No pending inspections</p>
            <p className="text-xs text-slate-400 mt-1">New items from GRN will appear here</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-2 text-left font-bold text-slate-600  tracking-wider text-[10px]">GRN ID</th>
                  <th className="p-2 text-left font-bold text-slate-600  tracking-wider text-[10px]">Item Code</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-600  tracking-wider text-[10px]">Qty Pending</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600  tracking-wider text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.qcPendingItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-indigo-600">
                      GRN-{String(item.grn_id).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{item.item_code}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-mono font-bold text-slate-700">
                        {parseFloat(item.quantity || 0).toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold  tracking-wider bg-purple-100 text-purple-700">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default QualityDashboard;
