import { useState, useEffect } from 'react';
import { Card, DataTable, Badge } from '../components/ui.jsx';
import { 
  ClipboardList, 
  Clock, 
  RotateCcw, 
  CheckCircle, 
  XCircle,
  Beaker,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  ChevronDown,
  ArrowRight,
  User,
  MoreHorizontal
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
  passed: '#16a34a',
  failed: '#dc2626',
  awaiting: '#f59e0b',
  inProgress: '#7c3aed',
  primary: '#2563eb',
  background: '#f8fafc',
  pie: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6']
};

const QualityDashboard = () => {
  const [stats, setStats] = useState({
    totalQc: 0,
    pendingQc: 0,
    inProgressQc: 0,
    passedQc: 0,
    failedQc: 0,
    qcPendingItems: [],
    rejectionReasons: [
      { name: 'Damaged', value: 1500, percentage: 38, color: '#ef4444' },
      { name: 'Incorrect Spec', value: 1200, percentage: 30, color: '#f59e0b' },
      { name: 'Passed', value: 1200, percentage: 20, color: '#10b981' },
      { name: 'Other', value: 1200, percentage: 32, color: '#3b82f6' },
    ],
    statusOverview: [
      { month: 'JAN', accepted: 40, rejected: 20, returned: 10 },
      { month: 'FEB', accepted: 35, rejected: 15, returned: 5 },
      { month: 'MAR', accepted: 45, rejected: 25, returned: 15 },
      { month: 'APR', accepted: 30, rejected: 20, returned: 10 },
      { month: 'MAY', accepted: 50, rejected: 30, returned: 20 },
      { month: 'JUN', accepted: 40, rejected: 15, returned: 5 },
    ],
    recentInspections: [
      { id: 'GRN-0024', itemCode: 'IPS-06800', time: '2 ago', status: 'Passed', color: 'bg-emerald-500' },
      { id: 'GRN-0018', itemCode: 'IPS-00324', time: '3 ago', status: 'Failed', color: 'bg-red-500' },
      { id: 'GRN-0016', itemCode: 'IPS-06274', time: '4 ago', status: 'Passed', color: 'bg-emerald-500' },
    ]
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
        fetch(`${API_BASE}/qc-inspections/stats`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/inventory/qc-pending`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      const qcStatsData = qcStatsRes.ok ? await qcStatsRes.json() : {};
      const qcPendingData = qcPendingRes.ok ? await qcPendingRes.json() : [];

      setStats(prev => ({
        ...prev,
        ...qcStatsData,
        qcPendingItems: Array.isArray(qcPendingData) ? qcPendingData : []
      }));
    } catch (error) {
      console.error('Error fetching quality dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, count, icon: Icon, colorClass, trend, trendType }) => (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-0.5">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-slate-900">{count}</p>
            {trend && (
              <div className={`flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-bold ${trendType === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {trendType === 'up' ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {trend}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const columns = [
    { 
      label: 'GRN Reference', 
      key: 'grn_id', 
      sortable: true,
      render: (val) => <span className="font-medium text-blue-600">GRN-{String(val).padStart(4, '0')}</span> 
    },
    { 
      label: 'Item Code', 
      key: 'item_code', 
      sortable: true,
      render: (val) => <span className="font-medium text-slate-700">{val && val !== '—' && val.trim() !== '' ? val : 'IPS-00300'}</span>
    },
    { 
      label: 'Quantity Pending', 
      key: 'quantity', 
      className: 'text-right',
      render: (val) => <span className="font-medium text-slate-900">{parseFloat(val || 3).toFixed(3)}</span>
    },
    { 
      label: 'Current Status', 
      key: 'status',
      render: (val) => (
        <Badge variant="warning" className="bg-slate-100 text-slate-600 border-slate-200 uppercase text-[10px] font-bold px-2 py-0.5">
          {val || 'PENDING'}
        </Badge>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-100 ">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
          <Beaker className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="mt-6 text-sm font-medium text-slate-500 tracking-wide">Gathering Quality Insights...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quality Assurance Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Real-time monitoring of inspection status and manufacturing quality</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Last 30 Days</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
          <button className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-lg shadow-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4 text-slate-400" />
            <span>Export</span>
          </button>
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900">Alice Quality</p>
              <p className="text-[10px] text-slate-500 font-medium">QA Inspector</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-100">
              A
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Total Inspections" 
          count={stats.totalQc || 23} 
          icon={ClipboardList}
          colorClass="bg-blue-50 text-blue-600"
          trend="12%"
          trendType="up"
        />
        <StatCard 
          title="Awaiting QC" 
          count={stats.pendingQc || 8} 
          icon={Clock}
          colorClass="bg-amber-50 text-amber-600"
        />
        <StatCard 
          title="In Progress" 
          count={stats.inProgressQc || 4} 
          icon={RotateCcw}
          colorClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard 
          title="Passed" 
          count={stats.passedQc || 9} 
          icon={CheckCircle}
          colorClass="bg-emerald-50 text-emerald-600"
          trend="14%"
          trendType="up"
        />
        <StatCard 
          title="Failed" 
          count={stats.failedQc || 2} 
          icon={XCircle}
          colorClass="bg-red-50 text-red-600"
          trend="20%"
          trendType="down"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rejection Reasons */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Top Rejection Reasons</h2>
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
            <div className="h-48 w-48 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.rejectionReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.rejectionReasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl font-bold text-slate-900">30%</span>
                <span className="text-[8px] text-slate-400 font-bold uppercase">Average</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 w-full">
              {stats.rejectionReasons.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-slate-900">{item.value >= 1000 ? (item.value / 1000).toFixed(1) + 'K' : item.value}</span>
                    <div className="w-3 h-3 rounded-full border border-slate-200 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 w-6 text-right">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-900">Inspection Status Overview</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-500">12</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase">Accepted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-500">8</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase">Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-500">3</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase">Returned</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusOverview}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="accepted" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="rejected" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="returned" stackId="a" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Awaiting Inspection Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
            <h2 className="text-lg font-bold text-slate-900">Items Awaiting Inspection</h2>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <DataTable
              columns={columns}
              data={stats.qcPendingItems.length > 0 ? stats.qcPendingItems : [
                { grn_id: 30, item_code: 'IPS-00300', quantity: 3.000, status: 'PENDING' },
                { grn_id: 30, item_code: 'IPS-00330', quantity: 3.000, status: 'PENDING' },
                { grn_id: 30, item_code: 'IPS-00390', quantity: 3.000, status: 'PENDING' },
                { grn_id: 20, item_code: 'IPS-00297', quantity: 3.000, status: 'PENDING' },
                { grn_id: 22, item_code: 'IPS-00396', quantity: 3.000, status: 'PENDING' },
                { grn_id: 24, item_code: 'IPS-00291', quantity: 3.000, status: 'PENDING' },
                { grn_id: 30, item_code: 'IPS-00297', quantity: 3.000, status: 'PENDING' },
              ]}
              loading={loading}
              searchPlaceholder="Filter by item code..."
              emptyMessage="Perfect! No items are currently awaiting inspection"
            />
          </div>
        </div>

        {/* Right Side Panels */}
        <div className="lg:col-span-1 space-y-6">
          {/* Inspection Summary */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Inspection Summary</h3>
            </div>
            <div className="space-y-5">
              {[
                { name: 'PENOOSS', status: 'Passed', color: 'emerald' },
                { name: 'CFNOODE', status: 'Failed', color: 'red' },
                { name: 'CENDOOS', status: 'Passed', color: 'emerald' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                      <div className={`w-3 h-3 rounded-full bg-${item.color}-500`}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">{item.name}</span>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-${item.color}-50 border border-${item.color}-100`}>
                    <div className={`w-1 h-1 rounded-full bg-${item.color}-500`}></div>
                    <span className={`text-[10px] font-bold text-${item.color}-600 uppercase`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Completed */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Recently Completed Inspections</h3>
            </div>
            <div className="space-y-4">
              {stats.recentInspections.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between group cursor-pointer">
                  <div>
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.id}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{item.time}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-bold ${item.status === 'Passed' ? 'text-emerald-500' : 'text-red-500'} uppercase`}>{item.itemCode}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">{item.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;


