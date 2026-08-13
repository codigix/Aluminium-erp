import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, DataTable, StatusBadge, Button, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, IndianRupee, ShoppingCart, Clock, CheckCircle2, 
  Target, Filter, Download, RefreshCw, Calendar, ChevronRight,
  FileText, Users, Eye, Printer, Share2, Trash2, Edit, Truck,
  CheckCircle, XCircle, Send, ArrowRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const SalesReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);
  const itemsPerPage = 2;
  const itemsPerSmallPage = 3;

  useEffect(() => {
    fetchSalesReport();
    setCurrentPage(1);
    setApprovedPage(1);
    setClientsPage(1);
  }, [dateRange, selectedCustomer]);

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/dashboard/sales?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedCustomer !== 'All') url += `&customer=${selectedCustomer}`;

      const response = await fetch(url, {
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

  const handleExport = () => {
    if (!stats || !stats.salesOrders) return;
    
    const exportData = stats.salesOrders.map(order => ({
      'Order ID': order.id,
      'Customer': order.customer,
      'Order Date': order.date,
      'Delivery Date': order.delivery,
      'Total Amount': order.total,
      'Status': order.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Orders");
    XLSX.writeFile(wb, `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredOrders = useMemo(() => {
    if (!stats?.salesOrders) return [];
    return stats.salesOrders;
  }, [stats?.salesOrders]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const paginatedApprovedQuotes = useMemo(() => {
    if (!stats?.approvedQuotes) return [];
    const startIndex = (approvedPage - 1) * itemsPerSmallPage;
    return stats.approvedQuotes.slice(startIndex, startIndex + itemsPerSmallPage);
  }, [stats?.approvedQuotes, approvedPage]);

  const totalApprovedPages = Math.ceil((stats?.approvedQuotes?.length || 0) / itemsPerSmallPage);

  const paginatedActiveClients = useMemo(() => {
    if (!stats?.activeClients) return [];
    const startIndex = (clientsPage - 1) * itemsPerSmallPage;
    return stats.activeClients.slice(startIndex, startIndex + itemsPerSmallPage);
  }, [stats?.activeClients, clientsPage]);

  const totalClientsPages = Math.ceil((stats?.activeClients?.length || 0) / itemsPerSmallPage);

  const KPIStoreCard = ({ title, value, subtitle, icon: Icon, color, subColor }) => (
    <div className="bg-white rounded p-2 border border-slate-100  flex items-center gap-4 relative overflow-hidden group hover:border-rose-100 transition-colors">
      <div className={`absolute top-0 right-0 w-16 h-16 ${subColor} opacity-10 rounded -mr-6 -mt-6 transition-transform group-hover:scale-110`} />
      <div className={`p-2 rounded ${subColor} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-400   ">{title}</p>
        <h3 className="text-xl text-slate-900 ">{value}</h3>
        <p className="text-xs text-slate-500  ">{subtitle}</p>
      </div>
    </div>
  );

  const isDataLoading = loading || !stats;

  return (
    <div className="space-y-2 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl  text-slate-900  ">Sales Report</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500   ">
            <span>Home</span> <ChevronRight className="w-3 h-3" />
            <span>Sales</span> <ChevronRight className="w-3 h-3" />
            <span className="text-rose-600">Sales Report</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded text-xs  text-slate-600">
             <Calendar className="w-4 h-4 text-slate-400" />
             <input 
               type="date" 
               value={dateRange.start} 
               onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
               className="bg-transparent border-none outline-none cursor-pointer"
             />
             <span className="text-slate-300 mx-1">—</span>
             <input 
               type="date" 
               value={dateRange.end} 
               onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
               className="bg-transparent border-none outline-none cursor-pointer"
             />
          </div>
          <select 
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="bg-white border border-slate-200 rounded p-2 text-xs  text-slate-600 outline-none"
          >
            <option value="All">All Customers</option>
            {stats?.activeClients?.map(client => (
              <option key={client.id} value={client.name}>{client.name}</option>
            ))}
          </select>
          <button 
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded text-xs    transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Activity KPIs */}
      <div className="space-y-3">
        <h3 className="text-sm text-slate-900   ">Activity Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {isDataLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KPIStoreCard 
                title="Total Sales Orders" 
                value={stats?.kpis?.totalSalesOrders || 0} 
                subtitle="This Period" 
                icon={ShoppingCart} 
                color="text-indigo-600" 
                subColor="bg-indigo-50" 
              />
              <KPIStoreCard 
                title="Total Customer POs" 
                value={stats?.kpis?.totalCustomerPos || 0} 
                subtitle="This Period" 
                icon={FileText} 
                color="text-blue-600" 
                subColor="bg-blue-50" 
              />
              <KPIStoreCard 
                title="Approved Quotations" 
                value={stats?.kpis?.approvedQuotes || 0} 
                subtitle="This Period" 
                icon={CheckCircle} 
                color="text-emerald-600" 
                subColor="bg-emerald-50" 
              />
              <KPIStoreCard 
                title="Rejected Quotations" 
                value={stats?.kpis?.rejectedQuotes || 0} 
                subtitle="This Period" 
                icon={XCircle} 
                color="text-rose-600" 
                subColor="bg-rose-50" 
              />
              <KPIStoreCard 
                title="Conversion Rate" 
                value={`${stats?.kpis?.conversionRate || 0}%`} 
                subtitle="Quotation to Order" 
                icon={Target} 
                color="text-amber-600" 
                subColor="bg-amber-50" 
              />
            </>
          )}
        </div>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Sales Trend */}
        <div className="lg:col-span-1 bg-white rounded p-2 border border-slate-100 ">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900   ">Sales Trend</h3>
              <p className="text-xs text-slate-400   mt-1">Total sales value over time</p>
            </div>
            <select className="text-xs    text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <option>Daily</option>
            </select>
          </div>
          <div className="h-[250px] w-full">
            {isDataLoading ? (
              <div className="w-full h-full flex flex-col justify-end gap-2 p-4 bg-slate-50/50 rounded animate-pulse">
                <div className="h-32 bg-slate-200/80 rounded w-full"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.chartData || []}>
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
                    tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={(val) => [`₹${parseFloat(val).toLocaleString('en-IN')}`, 'Value']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quotation Funnel */}
        <div className="bg-white rounded p-2 border border-slate-100  flex flex-col items-center">
          <div className="w-full mb-6">
            <h3 className="text-sm text-slate-900   ">Quotation Funnel</h3>
            <p className="text-xs text-slate-400   mt-1">Track conversion of quotations</p>
          </div>
          
          {isDataLoading ? (
            <div className="w-full space-y-4 animate-pulse p-4">
              <div className="h-6 bg-slate-200 rounded w-full"></div>
              <div className="h-6 bg-slate-200 rounded w-4/5"></div>
              <div className="h-6 bg-slate-200 rounded w-3/5"></div>
            </div>
          ) : (
            <>
              <div className="w-full flex flex-col items-center justify-center space-y-1 py-4 relative">
                 {/* Funnel Visualization */}
                 {(stats?.funnelData || []).map((item, idx) => (
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
                       <span className="text-xs   er opacity-0 group-hover:opacity-100 transition-opacity">
                         {item.name}
                       </span>
                       <span className="text-xs  ml-2">{item.value}</span>
                     </div>
                   </div>
                 ))}

                 {/* Conversion Rate Side Info */}
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 text-center pr-2">
                    <p className="text-[8px] text-slate-400   ">Conversion Rate</p>
                    <h4 className="text-lg text-slate-900 ">{stats?.kpis?.conversionRate || 0}%</h4>
                    <p className="text-[8px] text-slate-500  mt-1  er">
                      {stats?.kpis?.approvedQuotes || 0} / {stats?.kpis?.sentQuotes || 0}<br/>Sent to Order
                    </p>
                 </div>
              </div>

              <div className="w-full mt-auto pt-6 grid grid-cols-2 gap-2">
                {(stats?.funnelData || []).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px]  text-slate-500  er">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded p-2 border border-slate-100 ">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm text-slate-900   ">Recent Activity</h3>
            <button 
              onClick={() => navigate('/sales/dashboard')}
              className="text-xs  text-indigo-600 hover:text-indigo-700   flex items-center gap-1 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {isDataLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-10 bg-slate-100 rounded"></div>
                <div className="h-10 bg-slate-100 rounded"></div>
                <div className="h-10 bg-slate-100 rounded"></div>
              </div>
            ) : (
              (stats?.recentActivity || []).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 group">
                  <div className={`p-2 rounded ${
                    activity.type === 'QUOTE_APPROVED' ? 'bg-emerald-50 text-emerald-600' : 
                    activity.type === 'ORDER_CREATED' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {activity.type === 'QUOTE_APPROVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                     activity.type === 'ORDER_CREATED' ? <ShoppingCart className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 border-b border-slate-50 pb-3 last:border-0">
                    <div className="flex justify-between items-start">
                      <p className="text-xs  text-slate-900 ">
                        {activity.type === 'QUOTE_APPROVED' ? `Quotation ${activity.ref} approved` : 
                         `Sales Order ${activity.ref} created`}
                      </p>
                      <span className="text-[9px] text-slate-400  whitespace-nowrap">
                        {new Date(activity.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500  mt-0.5">{activity.customer}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Approved Quotations */}
        <div className="bg-white rounded p-2 border border-slate-100 ">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900   ">Approved Quotations</h3>
              <p className="text-xs text-slate-400   mt-1">List of recently approved quotations</p>
            </div>
            <button 
              onClick={() => navigate('/sales/approved-quotations')}
              className="text-xs  text-indigo-600 hover:text-indigo-700   flex items-center gap-1 transition-colors"
            >
              View all approved quotations <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400    border-b border-slate-50">
                  <th className="pb-3 pr-2">Quotation ID</th>
                  <th className="pb-3 pr-2">Client & Project</th>
                  <th className="pb-3 pr-2 text-right">Amount</th>
                  <th className="pb-3 text-right">Approved On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedApprovedQuotes.map((quote, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 text-xs  text-indigo-600">{quote.id}</td>
                    <td className="py-3 text-xs  text-slate-600">{quote.customer}</td>
                    <td className="py-3 text-xs  text-slate-900 text-right">₹{parseFloat(quote.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 text-xs  text-slate-500 text-right ">{quote.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalApprovedPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[9px]  text-slate-400  ">
                Page {approvedPage} of {totalApprovedPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={approvedPage === 1}
                  onClick={() => setApprovedPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={approvedPage === totalApprovedPages}
                  onClick={() => setApprovedPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active Clients */}
        <div className="bg-white rounded p-2 border border-slate-100 ">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900   ">Active Clients</h3>
              <p className="text-xs text-slate-400   mt-1">Top active clients based on orders</p>
            </div>
            <button 
              onClick={() => {
                const segments = location.pathname.split('/').filter(Boolean);
                const currentPrefix = segments[0] || 'sales';
                navigate(`/${currentPrefix}/active-clients`);
              }}
              className="text-xs  text-indigo-600 hover:text-indigo-700   flex items-center gap-1 transition-colors"
            >
              View all clients <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-5 text-xs text-slate-400    pb-2 border-b border-slate-50">
              <span className="col-span-2">Client</span>
              <span className="text-center">Orders</span>
              <span className="text-right">Sales Value</span>
              <span className="text-right">Last Order Date</span>
            </div>
            {paginatedActiveClients.map((client, idx) => (
              <div key={idx} className="grid grid-cols-5 items-center">
                <div className="col-span-2 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded flex items-center justify-center  text-xs ${
                    idx % 3 === 0 ? 'bg-indigo-50 text-indigo-600' : idx % 3 === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {client.initials}
                  </div>
                  <div>
                    <p className="text-xs  text-slate-900 ">{client.name}</p>
                    <p className="text-[9px] text-slate-400   er">{client.sub}</p>
                  </div>
                </div>
                <div className="text-center">
                   <span className="text-xs  text-slate-600">{client.orders}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs  text-slate-900">₹{parseFloat(client.value).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs  text-slate-400">{client.lastDate}</span>
                </div>
              </div>
            ))}
          </div>
          {totalClientsPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[9px]  text-slate-400  ">
                Page {clientsPage} of {totalClientsPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={clientsPage === 1}
                  onClick={() => setClientsPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={clientsPage === totalClientsPages}
                  onClick={() => setClientsPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales Orders Detailed Table */}
      <div className="">
        <div className="p-2 border-b border-slate-50 flex items-center justify-between">
           <div>
             <h3 className="text-sm text-slate-900   ">Sales Orders</h3>
           </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full bg-white text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-xs text-slate-400    border-b border-slate-100">
                <th className="p-2">Order Details</th>
                <th className="p-2">Customer</th>
                <th className="p-2">Order Date</th>
                <th className="p-2">Delivery</th>
                <th className="p-2 text-right">Grand Total</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedOrders.map((order, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-2">
                    <button 
                      onClick={() => navigate(`/sales-report-details/${order.public_id || order.id_val}`)}
                      className="text-left group/id"
                    >
                      <p className="text-xs  text-indigo-600 group-hover/id:underline font-bold">{order.id}</p>
                      <p className="text-[9px] text-slate-400   mt-0.5">Sales Order</p>
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs  text-slate-500">
                        {order.initials}
                      </div>
                      <div>
                        <p className="text-xs  text-slate-900 ">{order.customer}</p>
                        <p className="text-[9px] text-slate-400   er">{order.sub}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 text-xs  text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-300" />
                      {order.date}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 text-xs  text-slate-600">
                      <div className={`w-2 h-2 rounded ${order.status === 'Paid' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {order.delivery}
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <p className="text-xs  text-slate-900">₹{parseFloat(order.total).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] text-emerald-600  flex items-center justify-end gap-1 mt-0.5">
                       <CheckCircle2 className="w-2.5 h-2.5" /> Inclusive of Tax
                    </p>
                  </td>
                  <td className="p-2 text-center">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                       <button 
                         onClick={() => navigate(`/sales-report-details/${order.public_id || order.id_val}`)}
                         className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all border border-transparent hover:border-slate-200"
                         title="View Order Details"
                       >
                         <Eye className="w-3.5 h-3.5" />
                       </button>
                       <button className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all border border-transparent hover:border-slate-200">
                         <Printer className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 text-xs   ">
                    No sales orders found for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
             <p className="text-xs  text-slate-400  ">
               Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries
             </p>
             <div className="flex items-center gap-1">
               <button 
                 disabled={currentPage === 1}
                 onClick={() => setCurrentPage(prev => prev - 1)}
                 className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
               >
                 <ChevronRight className="w-4 h-4 rotate-180" />
               </button>
               {[...Array(totalPages)].map((_, i) => (
                 <button 
                   key={i}
                   onClick={() => setCurrentPage(i + 1)}
                   className={`w-8 h-8 flex items-center justify-center rounded  text-xs transition-all ${
                     currentPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                   }`}
                 >
                   {i + 1}
                 </button>
               ))}
               <button 
                 disabled={currentPage === totalPages}
                 onClick={() => setCurrentPage(prev => prev + 1)}
                 className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
               >
                 <ChevronRight className="w-4 h-4" />
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesReport;
