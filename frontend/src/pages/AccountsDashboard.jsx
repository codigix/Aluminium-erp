import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer as ResponsiveContainerBar
} from 'recharts';
import { 
  FileText, IndianRupee, CheckCircle, Clock, AlertCircle, TrendingUp, Filter, Download, Eye, Calendar
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

// Colors from requirements
const COLORS = {
  blue: '#2563eb',
  green: '#16a34a',
  orange: '#f59e0b',
  red: '#dc2626',
  darkRed: '#7f1d1d',
  slate: '#64748b'
};

const AccountsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/dashboard/accounts`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-ERP-Request': 'true'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching accounts dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-4">Fetching financial insights...</p>
        </div>
      </div>
    );
  }

  // Map API data to chart formats
  const cashFlowData = stats.cashFlow || [];
  
  const statusData = (stats.statusBreakdown || []).map(item => {
    let color = COLORS.slate;
    if (item.name === 'PAID') color = COLORS.green;
    if (item.name === 'SENT' || item.name === 'RECEIVED') color = COLORS.orange;
    if (item.name === 'FULFILLED') color = COLORS.blue;
    return { name: item.name, value: item.count, color };
  });

  const vendorPayableData = (stats.vendorPayables || []).map((v, i) => ({
    ...v,
    color: [COLORS.blue, '#38bdf8', '#4ade80', '#fbbf24', '#f87171'][i % 5]
  }));

  const paymentModeData = (stats.paymentModes || []).map((p, i) => ({
    ...p,
    color: ['#60a5fa', '#34d399', '#fbbf24', '#818cf8', '#f472b6'][i % 5]
  }));

  const recentActivity = stats.recentActivity || [];

  const tableData = (stats.recentActivity || []).filter(a => a.type === 'INVOICE').slice(0, 5);

  const StatCard = ({ title, amount, subtext, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-600`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">{title}</p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-lg font-bold text-slate-900">{amount}</h3>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 bg-slate-50/50 p-2 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accounts Dashboard</h1>
          <p className="text-[11px] text-slate-500">Vendor payment overview & liability tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 cursor-pointer hover:bg-slate-50">
            <Calendar className="w-3.5 h-3.5" />
            <span>Last 30 Days</span>
            <Filter className="w-3.5 h-3.5 ml-1 opacity-50" />
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Total Vendor Invoices" amount={stats.kpis.totalInvoices} icon={FileText} />
        <StatCard title="Total Payable Amount" amount={`₹${Number(stats.kpis.totalPayable).toLocaleString('en-IN')}`} icon={IndianRupee} />
        <StatCard title="Paid Amount" amount={`₹${Number(stats.kpis.paidAmount).toLocaleString('en-IN')}`} icon={CheckCircle} />
        <StatCard title="Pending Payable" amount={`₹${Number(stats.kpis.pendingPayable).toLocaleString('en-IN')}`} icon={Clock} />
        <StatCard title="Overdue Invoices" amount={stats.kpis.overdueCount} icon={AlertCircle} />
      </div>

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash Flow Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-900">Monthly Cash Flow</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-0.5 bg-blue-500 rounded-full"></span>
                <span>Customer Receipts</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-0.5 bg-emerald-500 rounded-full"></span>
                <span>Vendor Payments</span>
              </div>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => `${v/1000}K`} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px'}}
                />
                <Line type="monotone" dataKey="receipts" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3, fill: COLORS.blue, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="payments" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3, fill: COLORS.green, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Status Pie Chart */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Invoice Status Breakdown</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-slate-900">52%</span>
                <span className="text-[9px] text-slate-400">Paid Invoices</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full px-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></span>
                  <span className="text-[10px] text-slate-500 font-medium">{item.name}</span>
                  <span className="ml-auto text-[10px] font-bold text-slate-700">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Third Row: Vendor Payable & Recent Activity & Payment Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Vendor Wise Payable */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-5">Vendor Wise Payable</h3>
          <div className="space-y-4">
            {vendorPayableData.map((vendor) => (
              <div key={vendor.name} className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold text-slate-700 uppercase">{vendor.name}</span>
                  <span className="font-bold text-slate-900">₹{vendor.amount.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{
                      backgroundColor: vendor.color,
                      width: `${(vendor.amount / 200000) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 mb-5">Recent Activity</h3>
          <div className="flex-1 space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg bg-slate-50 border border-slate-100`}>
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-[11px] font-bold text-slate-900 truncate">{activity.ref}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      activity.status === 'Overdue' ? 'bg-rose-50 text-rose-600' :
                      activity.status === 'Fulfilled' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-1">{activity.vendor}</p>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-bold text-slate-700">₹{activity.amount.toLocaleString()}</span>
                    <span className="text-slate-400 italic">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Mode Distribution */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Payment Mode Distribution</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentModeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={70}
                  dataKey="value"
                >
                  {paymentModeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 px-4 pb-2">
            {paymentModeData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></span>
                <span className="text-[10px] text-slate-500">{item.name}</span>
                <span className="text-[10px] font-bold text-slate-700 ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">PO / Invoice No</th>
                <th className="px-5 py-3">Vendor/ Customer</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tableData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-bold text-slate-900">{row.no}</td>
                  <td className="px-5 py-3 text-slate-600">{row.vendor}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">₹{row.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      row.status === 'Overdue' ? 'bg-rose-50 text-rose-600' :
                      row.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{row.date}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-100" title="View Detail">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-100" title="View PDF">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountsDashboard;
