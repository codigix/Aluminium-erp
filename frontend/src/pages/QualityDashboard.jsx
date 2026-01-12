import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';

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

  const StatCard = ({ title, count, color, icon }) => (
    <div className={`${color} rounded-lg p-4 border border-slate-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{count}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading quality data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Total Inspections" 
          count={stats.totalQc || 0} 
          color="bg-blue-50"
          icon="📊"
        />
        <StatCard 
          title="QC Pending" 
          count={stats.pendingQc || 0} 
          color="bg-amber-50"
          icon="⏳"
        />
        <StatCard 
          title="In Progress" 
          count={stats.inProgressQc || 0} 
          color="bg-indigo-50"
          icon="🔄"
        />
        <StatCard 
          title="Passed" 
          count={stats.passedQc || 0} 
          color="bg-emerald-50"
          icon="✅"
        />
        <StatCard 
          title="Failed" 
          count={stats.failedQc || 0} 
          color="bg-red-50"
          icon="❌"
        />
      </div>

      <Card title="Items Awaiting Inspection" subtitle="Goods received requiring quality verification">
        {stats.qcPendingItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No pending items for inspection</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">GRN ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Item Code</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty Pending</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.qcPendingItems.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">GRN-{String(item.grn_id).padStart(4, '0')}</td>
                    <td className="px-4 py-4 text-slate-600">{item.item_code}</td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {parseFloat(item.quantity || 0).toFixed(3)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
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
