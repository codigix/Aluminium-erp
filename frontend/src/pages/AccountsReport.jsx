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
  Activity, Play, ClipboardList, Layers, Settings, Box, Warehouse,
  AlertTriangle, Archive, Move, CreditCard, Receipt, History
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const AccountsReport = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCustomer, setSelectedCustomer] = useState('All');

  useEffect(() => {
    fetchAccountsReport();
  }, [dateRange, selectedCustomer]);

  const fetchAccountsReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/dashboard/accounts-report?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedCustomer !== 'All') url += `&customer=${selectedCustomer}`;

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch accounts report');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching accounts report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!stats) return;

    const wb = XLSX.utils.book_new();

    // 1. Financial Summary
    const summaryData = [
      { Metric: 'Total Receivables', Value: stats.kpis?.totalReceivables || 0 },
      { Metric: 'Total Payables', Value: stats.kpis?.totalPayables || 0 },
      { Metric: 'Cash Received', Value: stats.kpis?.cashReceived || 0 },
      { Metric: 'Invoices Sent', Value: stats.kpis?.invoicesSent || 0 },
      { Metric: 'Overdue Amount', Value: stats.kpis?.overdueAmount || 0 }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Financial Summary");

    // 2. Top Customers
    if (stats.topCustomers) {
      const customerData = stats.topCustomers.map(c => ({
        'Customer': c.name,
        'Total Invoices': c.totalInvoices,
        'Outstanding Amount': c.outstanding,
        'Overdue Amount': c.overdue
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(customerData);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Top Customers");
    }

    // 3. Top Vendors
    if (stats.topVendors) {
      const vendorData = stats.topVendors.map(v => ({
        'Vendor': v.name,
        'Total Invoices': v.totalInvoices,
        'Outstanding Amount': v.outstanding,
        'Overdue Amount': v.overdue
      }));
      const wsVendors = XLSX.utils.json_to_sheet(vendorData);
      XLSX.utils.book_append_sheet(wb, wsVendors, "Top Vendors");
    }

    // 4. Recent Transactions
    if (stats.recentTransactions) {
      const transactionsData = stats.recentTransactions.map(t => ({
        'Type': t.type,
        'Reference': t.reference,
        'Customer / Vendor': t.party,
        'Date': t.date,
        'Due Date': t.dueDate || 'N/A',
        'Amount': t.amount,
        'Status': t.status
      }));
      const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(wb, wsTransactions, "Recent Transactions");
    }

    XLSX.writeFile(wb, `Accounts_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        <h3 className="text-slate-900 font-black tracking-tight uppercase">Generating Accounts Report...</h3>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e'];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-slate-900 font-black tracking-tight">Accounts Report</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Overview of financial performance and account activities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
             <Calendar className="w-4 h-4 text-slate-400" />
             01 Apr 2026 - 05 May 2026
             <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
          </div>
          <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-600 outline-none">
            <option>All Customers</option>
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPIStoreCard title="Total Receivables" value={`₹${parseFloat(stats.kpis.totalReceivables).toLocaleString('en-IN')}`} subtitle={`From ${stats.kpis.receivableCustomers} Customers`} icon={FileText} color="text-indigo-600" subColor="bg-indigo-50" />
        <KPIStoreCard title="Total Payables" value={`₹${parseFloat(stats.kpis.totalPayables).toLocaleString('en-IN')}`} subtitle={`To ${stats.kpis.payableVendors} Vendors`} icon={ShoppingCart} color="text-emerald-600" subColor="bg-emerald-50" />
        <KPIStoreCard title="Cash Received" value={`₹${parseFloat(stats.kpis.cashReceived).toLocaleString('en-IN')}`} subtitle="This Period" icon={IndianRupee} color="text-amber-600" subColor="bg-amber-50" />
        <KPIStoreCard title="Invoices Sent" value={stats.kpis.invoicesSent} subtitle="This Period" icon={Receipt} color="text-blue-600" subColor="bg-blue-50" />
        <KPIStoreCard title="Overdue Amount" value={`₹${parseFloat(stats.kpis.overdueAmount).toLocaleString('en-IN')}`} subtitle={`${stats.kpis.overdueInvoices} Overdue Invoices`} icon={Clock} color="text-rose-600" subColor="bg-rose-50" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receivables vs Payables */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Receivables vs Payables</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Outstanding comparison</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.receivablesPayables}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.receivablesPayables.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${parseFloat(value).toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full mt-6 space-y-3">
              {stats.receivablesPayables.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-900">₹{parseFloat(item.value).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{item.percent}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cash Flow Trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Cash Flow Trend</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Cash inflow and outflow over time</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cashFlowTrend}>
                <defs>
                  <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `₹${val / 1000}K`} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val) => `₹${parseFloat(val).toLocaleString('en-IN')}`} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px'}} />
                <Area name="Cash Inflow" type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                <Area name="Cash Outflow" type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aging Summary */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Aging Summary (Receivables)</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Outstanding by aging buckets</p>
          </div>
          <div className="space-y-4">
            {stats.agingSummary.map((bucket, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    idx === 0 ? 'bg-emerald-50 text-emerald-600' : 
                    idx === 1 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{bucket.range}</span>
                </div>
                <div className="text-right">
                   <p className="text-[11px] font-black text-slate-900">₹{parseFloat(bucket.amount).toLocaleString('en-IN')}</p>
                   <span className="text-[9px] font-bold text-slate-400 uppercase">{bucket.invoiceCount} Invoice</span>
                </div>
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-slate-50 flex items-center justify-between font-black">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Total Outstanding</span>
              <span className="text-sm text-indigo-600">₹{parseFloat(stats.kpis.totalReceivables).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers & Vendors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Top Customers</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">By outstanding amount</p>
            </div>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all customers <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-3 pr-2">Customer</th>
                  <th className="pb-3 pr-2 text-center">Total Invoices</th>
                  <th className="pb-3 pr-2 text-center">Outstanding Amount</th>
                  <th className="pb-3 text-right">Overdue Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.topCustomers.map((customer, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 pr-2">
                       <p className="text-xs font-black text-slate-900">{customer.name}</p>
                       <p className="text-[9px] text-slate-400 font-bold mt-0.5">{customer.email}</p>
                    </td>
                    <td className="py-4 text-xs font-bold text-slate-600 text-center">{customer.totalInvoices}</td>
                    <td className="py-4 text-xs font-black text-slate-900 text-center">₹{parseFloat(customer.outstanding).toLocaleString('en-IN')}</td>
                    <td className="py-4 text-right">
                       <span className={`text-[10px] font-black ${
                         parseFloat(customer.overdue) > 0 ? 'text-rose-600' : 'text-slate-400'
                       }`}>₹{parseFloat(customer.overdue).toLocaleString('en-IN')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Vendors */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Top Vendors</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">By outstanding amount</p>
            </div>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all vendors <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-3 pr-2">Vendor</th>
                  <th className="pb-3 pr-2 text-center">Total Invoices</th>
                  <th className="pb-3 pr-2 text-center">Outstanding Amount</th>
                  <th className="pb-3 text-right">Overdue Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.topVendors.map((vendor, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 pr-2">
                       <p className="text-xs font-black text-slate-900">{vendor.name}</p>
                       <p className="text-[9px] text-slate-400 font-bold mt-0.5">{vendor.email}</p>
                    </td>
                    <td className="py-4 text-xs font-bold text-slate-600 text-center">{vendor.totalInvoices}</td>
                    <td className="py-4 text-xs font-black text-slate-900 text-center">₹{parseFloat(vendor.outstanding).toLocaleString('en-IN')}</td>
                    <td className="py-4 text-right">
                       <span className={`text-[10px] font-black ${
                         parseFloat(vendor.overdue) > 0 ? 'text-rose-600' : 'text-slate-400'
                       }`}>₹{parseFloat(vendor.overdue).toLocaleString('en-IN')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
           <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Recent Transactions</h3>
           <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
             View all transactions <ArrowRight className="w-3 h-3" />
           </button>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Customer / Vendor</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.recentTransactions.map((transaction, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${
                      transaction.type === 'Payment Received' ? 'bg-emerald-50 text-emerald-600' : 
                      transaction.type === 'Vendor Payment' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-indigo-600">{transaction.reference}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{transaction.party}</td>
                  <td className="px-6 py-4 text-slate-500 font-bold whitespace-nowrap">
                    {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold whitespace-nowrap">
                    {transaction.dueDate ? new Date(transaction.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">₹{parseFloat(transaction.amount).toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${
                      transaction.status === 'Confirmed' || transaction.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                       {[Eye, Download, Printer].map((Icon, i) => (
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
      </div>
    </div>
  );
};

export default AccountsReport;
