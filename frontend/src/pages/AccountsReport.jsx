import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [vendorsPage, setVendorsPage] = useState(1);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [allTransactionsPage, setAllTransactionsPage] = useState(1);
  const itemsPerPage = 5;
  const transactionsPerPage = 5;
  const allTransactionsPerPage = 15;

  useEffect(() => {
    fetchAccountsReport();
    setTransactionsPage(1);
    setAllTransactionsPage(1);
    setCustomersPage(1);
    setVendorsPage(1);
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

  const paginatedTransactions = useMemo(() => {
    if (!stats?.recentTransactions) return [];
    const perPage = showAllTransactions ? allTransactionsPerPage : transactionsPerPage;
    const currPage = showAllTransactions ? allTransactionsPage : transactionsPage;
    const startIndex = (currPage - 1) * perPage;
    return stats.recentTransactions.slice(startIndex, startIndex + perPage);
  }, [stats?.recentTransactions, transactionsPage, allTransactionsPage, showAllTransactions]);

  const totalTransactionPages = Math.ceil((stats?.recentTransactions?.length || 0) / (showAllTransactions ? allTransactionsPerPage : transactionsPerPage));

  const paginatedCustomers = useMemo(() => {
    if (!stats?.topCustomers) return [];
    const startIndex = (customersPage - 1) * itemsPerPage;
    return stats.topCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [stats?.topCustomers, customersPage]);

  const totalCustomerPages = Math.ceil((stats?.topCustomers?.length || 0) / itemsPerPage);

  const paginatedVendors = useMemo(() => {
    if (!stats?.topVendors) return [];
    const startIndex = (vendorsPage - 1) * itemsPerPage;
    return stats.topVendors.slice(startIndex, startIndex + itemsPerPage);
  }, [stats?.topVendors, vendorsPage]);

  const totalVendorPages = Math.ceil((stats?.topVendors?.length || 0) / itemsPerPage);

  const handleViewPDF = async (transaction) => {
    try {
      let endpoint = '';
      if (transaction.type === 'Payment Received') {
        endpoint = `${API_BASE}/customer-payments/${transaction.id}/pdf`;
      } else if (transaction.type === 'Vendor Payment') {
        endpoint = `${API_BASE}/payments/${transaction.id}/pdf`;
      } else if (transaction.type === 'Vendor Invoice') {
        endpoint = `${API_BASE}/purchase-orders/${transaction.id}/pdf`;
      }

      if (!endpoint) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error viewing PDF:', error);
    }
  };

  const handleDownloadPDF = async (transaction) => {
    try {
      let endpoint = '';
      let filename = '';
      if (transaction.type === 'Payment Received') {
        endpoint = `${API_BASE}/customer-payments/${transaction.id}/pdf`;
        filename = `Receipt_${transaction.reference}.pdf`;
      } else if (transaction.type === 'Vendor Payment') {
        endpoint = `${API_BASE}/payments/${transaction.id}/pdf`;
        filename = `Voucher_${transaction.reference}.pdf`;
      } else if (transaction.type === 'Vendor Invoice') {
        endpoint = `${API_BASE}/purchase-orders/${transaction.id}/pdf`;
        filename = `PO_${transaction.reference}.pdf`;
      }

      if (!endpoint) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handlePrintPDF = async (transaction) => {
    try {
      let endpoint = '';
      if (transaction.type === 'Payment Received') {
        endpoint = `${API_BASE}/customer-payments/${transaction.id}/pdf`;
      } else if (transaction.type === 'Vendor Payment') {
        endpoint = `${API_BASE}/payments/${transaction.id}/pdf`;
      } else if (transaction.type === 'Vendor Invoice') {
        endpoint = `${API_BASE}/purchase-orders/${transaction.id}/pdf`;
      }

      if (!endpoint) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error('Error printing PDF:', error);
    }
  };

  const handleDownloadAttachment = async (url, fileName) => {
    if (!url) return;
    try {
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('File not found');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || url.split('/').pop() || 'attachment.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
      window.open(fullUrl, '_blank');
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
    <div className="bg-white rounded p-2 border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-16 h-16 ${subColor} opacity-10 rounded -mr-6 -mt-6 transition-transform group-hover:scale-110`} />
      <div className={`p-2 rounded ${subColor} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider leading-tight truncate">{title}</p>
        <h3 className="text-xl font-bold text-slate-900 leading-tight truncate">{value}</h3>
        <p className="text-xs text-slate-500 font-medium leading-tight truncate">{subtitle}</p>
      </div>
    </div>
  );

  const renderTransactionsTable = (data, isFullView = false) => (
    <div className="p-0 overflow-x-auto">
      <table className="w-full text-left bg-white border-collapse">
        <thead>
          <tr className="bg-slate-50/50 text-xs text-slate-400 font-bold uppercase tracking-tighter border-b border-slate-100">
            <th className="p-2">Type</th>
            <th className="p-2">Reference</th>
            <th className="p-2">Customer / Vendor</th>
            <th className="p-2">Date</th>
            <th className="p-2">Due Date</th>
            <th className="p-2 text-right">Amount</th>
            <th className="p-2 text-center">Status</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((transaction, idx) => (
            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
              <td className="p-2">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  transaction.type === 'Payment Received' ? 'bg-emerald-50 text-emerald-600' : 
                  transaction.type === 'Vendor Payment' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {transaction.type}
                </span>
              </td>
              <td className="p-2 font-bold text-indigo-600">{transaction.reference}</td>
              <td className="p-2 font-medium text-slate-900">{transaction.party}</td>
              <td className="p-2 text-slate-500 whitespace-nowrap">
                {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="p-2 text-slate-500 whitespace-nowrap">
                {transaction.dueDate ? new Date(transaction.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
              </td>
              <td className="p-2 text-right font-bold text-slate-900">₹{parseFloat(transaction.amount).toLocaleString('en-IN')}</td>
              <td className="p-2 text-center">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  transaction.status === 'Confirmed' || transaction.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {transaction.status}
                </span>
              </td>
              <td className="p-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => navigate(`/transaction-details/${transaction.id}?type=${encodeURIComponent(transaction.type)}`)}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all border border-transparent hover:border-slate-200"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDownloadPDF(transaction)}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all border border-transparent hover:border-slate-200"
                    title="Download PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handlePrintPDF(transaction)}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-all border border-transparent hover:border-slate-200"
                    title="Print PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan="8" className="p-2 text-center text-slate-400 text-xs   ">
                No transactions found for selected period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-22 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-600 rounded animate-spin" />
        <h3 className="text-slate-900   ">Generating Accounts Report...</h3>
      </div>
    );
  }

  if (showAllTransactions) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">All Transactions</h2>
            <p className="text-xs text-slate-500 mt-1">Full transaction history for the selected period</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowAllTransactions(false)}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Report
          </Button>
        </div>

        {/* Mini KPIs for History View */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <KPIStoreCard title="Receivables" value={`₹${(stats.kpis.totalReceivables/100000).toFixed(1)}L`} subtitle="Total Owed" icon={IndianRupee} color="text-indigo-600" subColor="bg-indigo-50" />
           <KPIStoreCard title="Payables" value={`₹${(stats.kpis.totalPayables/100000).toFixed(1)}L`} subtitle="Total Due" icon={CreditCard} color="text-rose-600" subColor="bg-rose-50" />
           <KPIStoreCard title="Cash Inflow" value={`₹${(stats.kpis.cashReceived/100000).toFixed(1)}L`} subtitle="Total Collected" icon={TrendingUp} color="text-emerald-600" subColor="bg-emerald-50" />
           <KPIStoreCard title="Overdue" value={`₹${(stats.kpis.overdueAmount/100000).toFixed(1)}L`} subtitle="Pending Recovery" icon={AlertTriangle} color="text-amber-600" subColor="bg-amber-50" />
        </div>

        <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          {renderTransactionsTable(paginatedTransactions, true)}
          
          {totalTransactionPages > 1 && (
            <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {(allTransactionsPage - 1) * allTransactionsPerPage + 1} to {Math.min(allTransactionsPage * allTransactionsPerPage, stats.recentTransactions.length)} of {stats.recentTransactions.length} transactions
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={allTransactionsPage === 1}
                  onClick={() => setAllTransactionsPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalTransactionPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setAllTransactionsPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      allTransactionsPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={allTransactionsPage === totalTransactionPages}
                  onClick={() => setAllTransactionsPage(prev => prev + 1)}
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
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e'];

  return (
    <div className=" pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accounts Report</h1>
          <p className="text-xs text-slate-500 mt-1">Overview of financial performance and account activities</p>
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
            {stats.topCustomers?.map((customer, idx) => (
              <option key={idx} value={customer.name}>{customer.name}</option>
            ))}
          </select>
          <button 
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded text-xs   tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 my-5 gap-4">
        <KPIStoreCard title="Total Receivables" value={`₹${parseFloat(stats.kpis.totalReceivables).toLocaleString('en-IN')}`} subtitle={`From ${stats.kpis.receivableCustomers} Customers`} icon={FileText} color="text-indigo-600" subColor="bg-indigo-50" />
        <KPIStoreCard title="Total Payables" value={`₹${parseFloat(stats.kpis.totalPayables).toLocaleString('en-IN')}`} subtitle={`To ${stats.kpis.payableVendors} Vendors`} icon={ShoppingCart} color="text-emerald-600" subColor="bg-emerald-50" />
        <KPIStoreCard title="Cash Received" value={`₹${parseFloat(stats.kpis.cashReceived).toLocaleString('en-IN')}`} subtitle="This Period" icon={IndianRupee} color="text-amber-600" subColor="bg-amber-50" />
        <KPIStoreCard title="Invoices Sent" value={stats.kpis.invoicesSent} subtitle="This Period" icon={Receipt} color="text-blue-600" subColor="bg-blue-50" />
        <KPIStoreCard title="Overdue Amount" value={`₹${parseFloat(stats.kpis.overdueAmount).toLocaleString('en-IN')}`} subtitle={`${stats.kpis.overdueInvoices} Overdue Invoices`} icon={Clock} color="text-rose-600" subColor="bg-rose-50" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 my-5 gap-2">
        {/* Receivables vs Payables */}
        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900   ">Receivables vs Payables</h3>
            <p className="text-xs text-slate-400   mt-1">Outstanding comparison</p>
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
            <div className="w-full mt-3 ">
              {stats.receivablesPayables.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-xs  text-slate-500 ">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs  text-slate-900">₹{parseFloat(item.value).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cash Flow Trend */}
        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900   ">Cash Flow Trend</h3>
              <p className="text-xs text-slate-400   mt-1">Cash inflow and outflow over time</p>
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
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: '', paddingTop: '20px'}} />
                <Area name="Cash Inflow" type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                <Area name="Cash Outflow" type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aging Summary */}
        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm text-slate-900   ">Aging Summary (Receivables)</h3>
            <p className="text-xs text-slate-400   mt-1">Outstanding by aging buckets</p>
          </div>
          <div className="">
            {stats.agingSummary.map((bucket, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${
                    idx === 0 ? 'bg-emerald-50 text-emerald-600' : 
                    idx === 1 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs  text-slate-900  er">{bucket.range}</span>
                </div>
                <div className="text-right">
                   <p className="text-xs  text-slate-900">₹{parseFloat(bucket.amount).toLocaleString('en-IN')}</p>
                   <span className="text-xs  text-slate-400 ">{bucket.invoiceCount} Invoice</span>
                </div>
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-slate-50 flex items-center justify-between ">
              <span className="text-xs text-slate-500  ">Total Outstanding</span>
              <span className="text-sm text-indigo-600">₹{parseFloat(stats.kpis.totalReceivables).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers & Vendors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900   ">Top Customers</h3>
              <p className="text-xs text-slate-400   mt-1">By outstanding amount</p>
            </div>
            <button 
              onClick={() => navigate('/active-clients')}
              className="text-xs  text-indigo-600   flex items-center gap-1"
            >
              View all customers <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400    border-b border-slate-50">
                  <th className="p-2">Customer</th>
                  <th className="p-2 text-center">Total Invoices</th>
                  <th className="p-2 text-center">Outstanding Amount</th>
                  <th className="p-2 text-right">Overdue Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedCustomers.map((customer, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-2">
                       <p className="text-xs  text-slate-900">{customer.name}</p>
                       <p className="text-xs text-slate-400  mt-0.5">{customer.email}</p>
                    </td>
                    <td className="p-2 text-xs  text-slate-600 text-center">{customer.totalInvoices}</td>
                    <td className="p-2 text-xs  text-slate-900 text-center">₹{parseFloat(customer.outstanding).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right">
                       <span className={`text-xs  ${
                         parseFloat(customer.overdue) > 0 ? 'text-rose-600' : 'text-slate-400'
                       }`}>₹{parseFloat(customer.overdue).toLocaleString('en-IN')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCustomerPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs  text-slate-400  ">
                Page {customersPage} of {totalCustomerPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={customersPage === 1}
                  onClick={() => setCustomersPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={customersPage === totalCustomerPages}
                  onClick={() => setCustomersPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top Vendors */}
        <div className="bg-white rounded p-2 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900   ">Top Vendors</h3>
              <p className="text-xs text-slate-400   mt-1">By outstanding amount</p>
            </div>
            <button 
              onClick={() => navigate('/suppliers?from=accounts-report')}
              className="text-xs  text-indigo-600   flex items-center gap-1"
            >
              View all vendors <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400    border-b border-slate-50">
                  <th className="p-2">Vendor</th>
                  <th className="p-2 text-center">Total Invoices</th>
                  <th className="p-2 text-center">Outstanding Amount</th>
                  <th className="p-2 text-right">Overdue Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedVendors.map((vendor, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-2">
                       <p className="text-xs  text-slate-900">{vendor.name}</p>
                       <p className="text-xs text-slate-400  mt-0.5">{vendor.email}</p>
                    </td>
                    <td className="p-2 text-xs  text-slate-600 text-center">{vendor.totalInvoices}</td>
                    <td className="p-2 text-xs  text-slate-900 text-center">₹{parseFloat(vendor.outstanding).toLocaleString('en-IN')}</td>
                    <td className="p-2 text-right">
                       <span className={`text-xs  ${
                         parseFloat(vendor.overdue) > 0 ? 'text-rose-600' : 'text-slate-400'
                       }`}>₹{parseFloat(vendor.overdue).toLocaleString('en-IN')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalVendorPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs  text-slate-400  ">
                Page {vendorsPage} of {totalVendorPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={vendorsPage === 1}
                  onClick={() => setVendorsPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={vendorsPage === totalVendorPages}
                  onClick={() => setVendorsPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="mt-5">
        <div className="border-b border-slate-50 flex items-center justify-between">
           <h3 className="text-sm text-slate-900   ">Recent Transactions</h3>
           <button 
             onClick={() => setShowAllTransactions(true)}
             className="text-xs  text-indigo-600   flex items-center gap-1"
           >
             View all transactions <ArrowRight className="w-3 h-3" />
           </button>
        </div>
        {renderTransactionsTable(paginatedTransactions)}
        {totalTransactionPages > 1 && (
          <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
             <p className="text-xs  text-slate-400  ">
               Showing {(transactionsPage - 1) * transactionsPerPage + 1} to {Math.min(transactionsPage * transactionsPerPage, stats.recentTransactions.length)} of {stats.recentTransactions.length} entries
             </p>
             <div className="flex items-center gap-1">
               <button 
                 disabled={transactionsPage === 1}
                 onClick={() => setTransactionsPage(prev => prev - 1)}
                 className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
               >
                 <ChevronRight className="w-4 h-4 rotate-180" />
               </button>
               {[...Array(totalTransactionPages)].map((_, i) => (
                 <button 
                   key={i}
                   onClick={() => setTransactionsPage(i + 1)}
                   className={`w-8 h-8 flex items-center justify-center rounded  text-xs transition-all ${
                     transactionsPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                   }`}
                 >
                   {i + 1}
                 </button>
               ))}
               <button 
                 disabled={transactionsPage === totalTransactionPages}
                 onClick={() => setTransactionsPage(prev => prev + 1)}
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

export default AccountsReport;
