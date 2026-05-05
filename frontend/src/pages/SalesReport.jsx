import React, { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge, Button } from '../components/ui.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, IndianRupee, ShoppingCart, Clock, CheckCircle2, 
  Target, Filter, Download, RefreshCw, Calendar, ChevronRight,
  FileText, Users, Eye, Printer, Share2, Trash2, Edit, Truck,
  CheckCircle, XCircle, Send
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const SalesReport = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchSalesReport();
  }, []);

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/dashboard/sales`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch sales report');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching sales report:', error);
    } finally {
      setLoading(false);
    }
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
        <h3 className="text-slate-900 font-black tracking-tight uppercase">Generating Sales Report...</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl text-slate-900 font-black tracking-tight">Sales Report</h1>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <span>Home</span> <ChevronRight className="w-3 h-3" />
            <span>Sales</span> <ChevronRight className="w-3 h-3" />
            <span className="text-rose-600">Sales Report</span>
          </div>
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
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Quotation Activity KPIs */}
      <div className="space-y-3">
        <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Quotation Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPIStoreCard 
            title="Total Quotations" 
            value={stats.kpis.totalQuotes} 
            subtitle="All Time" 
            icon={FileText} 
            color="text-indigo-600" 
            subColor="bg-indigo-50" 
          />
          <KPIStoreCard 
            title="Sent Quotations" 
            value={stats.kpis.sentQuotes} 
            subtitle="This Period" 
            icon={Send} 
            color="text-blue-600" 
            subColor="bg-blue-50" 
          />
          <KPIStoreCard 
            title="Approved Quotations" 
            value={stats.kpis.approvedQuotes} 
            subtitle="This Period" 
            icon={CheckCircle} 
            color="text-emerald-600" 
            subColor="bg-emerald-50" 
          />
          <KPIStoreCard 
            title="Rejected Quotations" 
            value={stats.kpis.rejectedQuotes} 
            subtitle="This Period" 
            icon={XCircle} 
            color="text-rose-600" 
            subColor="bg-rose-50" 
          />
          <KPIStoreCard 
            title="Conversion Rate" 
            value={`${stats.kpis.conversionRate}%`} 
            subtitle="Quotation to Order" 
            icon={Target} 
            color="text-amber-600" 
            subColor="bg-amber-50" 
          />
        </div>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Sales Trend</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total sales value over time</p>
            </div>
            <select className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <option>Daily</option>
            </select>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorSalesTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}}
                  tickFormatter={(val) => `${val / 1000}K`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quotation Funnel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col items-center">
          <div className="w-full mb-6">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Quotation Funnel</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Track conversion of quotations</p>
          </div>
          
          <div className="w-full flex flex-col items-center justify-center space-y-1 py-4 relative">
             {/* Funnel Visualization */}
             {stats.funnelData.map((item, idx) => (
               <div 
                 key={idx} 
                 className="relative group transition-all duration-300"
                 style={{ 
                   width: `${100 - (idx * 15)}%`, 
                   height: '40px',
                   backgroundColor: item.color,
                   clipPath: 'polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%)'
                 }}
               >
                 <div className="absolute inset-0 flex items-center justify-center text-white">
                   <span className="text-[10px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                     {item.name}
                   </span>
                   <span className="text-xs font-black ml-2">{item.value}</span>
                 </div>
               </div>
             ))}

             {/* Conversion Rate Side Info */}
             <div className="absolute right-0 top-1/2 -translate-y-1/2 text-center pr-2">
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Conversion Rate</p>
                <h4 className="text-lg text-slate-900 font-black">{stats.kpis.conversionRate}%</h4>
                <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">
                  {stats.kpis.approvedQuotes} / {stats.kpis.sentQuotes}<br/>Sent to Order
                </p>
             </div>
          </div>

          <div className="w-full mt-auto pt-6 grid grid-cols-2 gap-2">
            {stats.funnelData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Recent Activity</h3>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all activity <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'QUOTE_APPROVED' ? 'bg-emerald-50 text-emerald-600' : 
                  activity.type === 'ORDER_CREATED' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {activity.type === 'QUOTE_APPROVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                   activity.type === 'ORDER_CREATED' ? <ShoppingCart className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 border-b border-slate-50 pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-black text-slate-900 tracking-tight">
                      {activity.type === 'QUOTE_APPROVED' ? `Quotation ${activity.ref} approved` : 
                       `Sales Order ${activity.ref} created`}
                    </p>
                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">
                      {new Date(activity.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{activity.customer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approved Quotations */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Approved Quotations</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">List of recently approved quotations</p>
            </div>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all approved quotations <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-3 pr-2">Quotation ID</th>
                  <th className="pb-3 pr-2">Client & Project</th>
                  <th className="pb-3 pr-2 text-right">Amount</th>
                  <th className="pb-3 text-right">Approved On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.approvedQuotes.map((quote, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 text-xs font-black text-indigo-600">{quote.id}</td>
                    <td className="py-3 text-xs font-bold text-slate-600">{quote.customer}</td>
                    <td className="py-3 text-xs font-black text-slate-900 text-right">₹{parseFloat(quote.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 text-[10px] font-bold text-slate-500 text-right uppercase">{quote.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Clients */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Active Clients</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Top active clients based on orders</p>
            </div>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              View all clients <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-5 text-[10px] text-slate-400 font-black uppercase tracking-widest pb-2 border-b border-slate-50">
              <span className="col-span-2">Client</span>
              <span className="text-center">Orders</span>
              <span className="text-right">Sales Value</span>
              <span className="text-right">Last Order Date</span>
            </div>
            {stats.activeClients.map((client, idx) => (
              <div key={idx} className="grid grid-cols-5 items-center">
                <div className="col-span-2 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                    idx % 3 === 0 ? 'bg-indigo-50 text-indigo-600' : idx % 3 === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {client.initials}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 tracking-tight">{client.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{client.sub}</p>
                  </div>
                </div>
                <div className="text-center">
                   <span className="text-xs font-bold text-slate-600">{client.orders}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-900">₹{parseFloat(client.value).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400">{client.lastDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sales Orders Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
           <div>
             <h3 className="text-sm text-slate-900 font-black uppercase tracking-widest">Sales Orders</h3>
           </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Order Details</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Order Date</th>
                <th className="px-6 py-4">Delivery</th>
                <th className="px-6 py-4 text-right">Grand Total</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.salesOrders.map((order, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-xs font-black text-indigo-600 tracking-tight">{order.id}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Sales Order</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {order.initials}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 tracking-tight">{order.customer}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{order.sub}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-300" />
                      {order.date}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <div className={`w-2 h-2 rounded-full ${idx % 2 === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {order.delivery}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs font-black text-slate-900">₹{parseFloat(order.total).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] text-emerald-600 font-bold flex items-center justify-end gap-1 mt-0.5">
                       <CheckCircle2 className="w-2.5 h-2.5" /> Inclusive of Tax
                    </p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                       {[FileText, Eye, Download, Printer, Edit, Trash2].map((Icon, i) => (
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
        <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             Showing 1 to {stats.salesOrders.length} of {stats.salesOrders.length} entries
           </p>
           <div className="flex items-center gap-1">
             <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-white"><ChevronRight className="w-4 h-4 rotate-180" /></button>
             <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs shadow-lg shadow-indigo-100">1</button>
             <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-white"><ChevronRight className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
