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
  const [loading, setLoading] = useState(false);
  
  // Mock data for visual perfection
  const cashFlowData = [
    { name: 'Jan', payments: 45000, receipts: 38000 },
    { name: 'Feb', payments: 52000, receipts: 48000 },
    { name: 'Mar', payments: 48000, receipts: 62000 },
    { name: 'Apr', payments: 61000, receipts: 55000 },
    { name: 'May', payments: 55000, receipts: 80000 },
    { name: 'Jun', payments: 72000, receipts: 75000 },
  ];

  const statusData = [
    { name: 'Paid', value: 52, color: COLORS.green },
    { name: 'Pending', value: 31, color: COLORS.orange },
    { name: 'Overdue', value: 12, color: COLORS.red },
    { name: 'Fulfilled', value: 5, color: COLORS.blue },
  ];

  const vendorPayableData = [
    { name: 'ABC SUPPLIERS', amount: 180000, color: COLORS.blue },
    { name: 'sanika mote', amount: 68000, color: '#38bdf8' },
    { name: 'mack suppliers', amount: 52000, color: '#4ade80' },
    { name: 'XYZ INDUSTRIES', amount: 36000, color: '#fbbf24' },
    { name: 'excel traders', amount: 26000, color: '#f87171' },
  ];

  const paymentModeData = [
    { name: 'UFI', value: 45, color: '#60a5fa' },
    { name: 'Cheque', value: 23, color: '#34d399' },
    { name: 'Cash', value: 9, color: '#fbbf24' },
    { name: 'Other', value: 23, color: '#818cf8' },
  ];

  const recentActivity = [
    { id: 1, ref: 'PO-2026-0006', status: 'Overdue', amount: 1416, vendor: 'ABC SUPPLIERS', time: '12h ago' },
    { id: 2, ref: 'Invoice-2026-ERR08', status: 'Fulfilled', amount: 38000, vendor: 'SNP Tech Solution', time: '1d ago' },
    { id: 3, ref: 'PO-2026-0022', status: 'Fulfilled', amount: 8500, vendor: 'Sunny Enterprises', time: '3d ago' },
    { id: 4, ref: 'PO-2026-0019', status: 'Pending', amount: 200000, vendor: 'Excel Traders', time: '5d ago' },
  ];

  const tableData = [
    { no: 'PO-2026-0006', vendor: 'ABC SUPPLIERS', amount: 1416, status: 'Overdue', date: '18 Feb 2026' },
    { no: 'Invoice-2026-ERR09', vendor: 'SNP Tech Solution', amount: 38000, status: 'Paid', date: '25 Feb 2026' },
    { no: 'PO-2026-0022', vendor: 'ABC SUPPLIERS', amount: 8500, status: 'Fulfilled', date: '24 Feb 2026' },
  ];

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
        <StatCard title="Total Vendor Invoices" amount="128" icon={FileText} trend="+ 12%" />
        <StatCard title="Total Payable Amount" amount="₹4,52,000" icon={IndianRupee} trend="+ 4%" />
        <StatCard title="Paid Amount" amount="₹3,10,000" icon={CheckCircle} />
        <StatCard title="Pending Payable" amount="₹1,42,000" icon={Clock} />
        <StatCard title="Overdue Invoices" amount="7" icon={AlertCircle} trend="+ 9%" />
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
