import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, DollarSign, Truck, FileText, Package } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';
import './Buying.css';

export default function BuyingAnalytics() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [poTrends, setPoTrends] = useState([]);
  const [topSuppliers, setTopSuppliers] = useState([]);
  const [invoiceAnalytics, setInvoiceAnalytics] = useState(null);
  const [agingAnalysis, setAgingAnalysis] = useState(null);
  const [overduePOs, setOverduePOs] = useState([]);
  const [pendingGRNs, setPendingGRNs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const [summaryRes, trendsRes, suppliersRes, invoiceRes, agingRes, overdueRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/buying/summary`),
        fetch(`${API_BASE_URL}/analytics/buying/po-trends?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        fetch(`${API_BASE_URL}/analytics/buying/top-suppliers?limit=10`),
        fetch(`${API_BASE_URL}/analytics/buying/invoices`),
        fetch(`${API_BASE_URL}/analytics/buying/aging`),
        fetch(`${API_BASE_URL}/analytics/buying/overdue-pos`),
        fetch(`${API_BASE_URL}/analytics/buying/pending-grns`)
      ]);

      const summaryData = await summaryRes.json();
      const trendsData = await trendsRes.json();
      const suppliersData = await suppliersRes.json();
      const invoiceData = await invoiceRes.json();
      const agingData = await agingRes.json();
      const overdueData = await overdueRes.json();
      const pendingData = await pendingRes.json();

      setSummary(summaryData.data);
      setPoTrends(trendsData.data || []);
      setTopSuppliers(suppliersData.data || []);
      setInvoiceAnalytics(invoiceData.data);
      setAgingAnalysis(agingData.data);
      setOverduePOs(overdueData.data || []);
      setPendingGRNs(pendingData.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading analytics...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Buying Analytics</h1>
          <p className="text-slate-600">Real-time insights and performance metrics</p>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4 items-center">
          <label className="text-sm font-medium text-slate-700">From:</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <label className="text-sm font-medium text-slate-700">To:</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Total POs</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{summary?.purchase_orders?.total_pos || 0}</p>
              </div>
              <Truck className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
            <p className="text-green-600 text-sm mt-4">✓ {summary?.purchase_orders?.completed_count || 0} Completed</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Total PO Value</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">₹{summary?.purchase_orders?.total_value?.toLocaleString() || 0}</p>
              </div>
              <DollarSign className="w-12 h-12 text-green-500 opacity-20" />
            </div>
            <p className="text-blue-600 text-sm mt-4">Avg: ₹{summary?.purchase_orders?.avg_value?.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Total Invoices</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{summary?.invoices?.total_invoices || 0}</p>
              </div>
              <FileText className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
            <p className="text-red-600 text-sm mt-4">⚠ ₹{summary?.invoices?.pending_amount?.toLocaleString()} Pending</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Paid Amount</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">₹{summary?.invoices?.paid_amount?.toLocaleString() || 0}</p>
              </div>
              <Package className="w-12 h-12 text-purple-500 opacity-20" />
            </div>
            <p className="text-slate-600 text-sm mt-4">{summary?.invoices?.paid_count || 0} Invoices Paid</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'suppliers', label: 'Top Suppliers' },
            { id: 'trends', label: 'Trends' },
            { id: 'alerts', label: 'Alerts' },
            { id: 'aging', label: 'Aging Analysis' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content by Tab */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">PO Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Draft', value: summary?.purchase_orders?.draft_count || 0 },
                        { name: 'Submitted', value: summary?.purchase_orders?.submitted_count || 0 },
                        { name: 'Completed', value: summary?.purchase_orders?.completed_count || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Invoice Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { status: 'Draft', count: summary?.invoices?.draft_count || 0 },
                      { status: 'Submitted', count: summary?.invoices?.submitted_count || 0 },
                      { status: 'Paid', count: summary?.invoices?.paid_count || 0 }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Top 10 Suppliers by PO Value</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Supplier</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">POs</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Total Value</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Avg Value</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {topSuppliers.map((supplier) => (
                      <tr key={supplier.supplier_id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">{supplier.supplier_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{supplier.po_count}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-semibold">₹{supplier.total_value?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">₹{supplier.avg_po_value?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                            {supplier.completion_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">PO Trends (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={poTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="po_count" stroke="#3B82F6" name="PO Count" />
                  <Line yAxisId="right" type="monotone" dataKey="total_value" stroke="#10B981" name="Total Value (₹)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-red-50 rounded-lg border border-red-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-bold text-red-900">Overdue POs ({overduePOs.length})</h3>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {overduePOs.length > 0 ? (
                    overduePOs.map((po) => (
                      <div key={po.po_id} className="text-sm text-red-800 bg-white p-3 rounded border border-red-100">
                        <p className="font-semibold">{po.po_number} - {po.supplier_name}</p>
                        <p>Overdue by {po.days_overdue} days</p>
                        <p className="text-xs">Value: ₹{po.po_value?.toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-red-600">No overdue POs</p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-6 h-6 text-amber-600" />
                  <h3 className="text-lg font-bold text-amber-900">Pending GRNs ({pendingGRNs.length})</h3>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pendingGRNs.length > 0 ? (
                    pendingGRNs.map((grn) => (
                      <div key={grn.po_id} className="text-sm text-amber-800 bg-white p-3 rounded border border-amber-100">
                        <p className="font-semibold">{grn.po_number} - {grn.supplier_name}</p>
                        <p>Pending Qty: {grn.pending_qty}</p>
                        <p className="text-xs">Value: ₹{grn.po_value?.toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-amber-600">No pending GRNs</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Aging Analysis Tab */}
          {activeTab === 'aging' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Invoice Aging Analysis</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={[
                    { period: 'Current (0-30)', amount: agingAnalysis?.current || 0 },
                    { period: '30-60 Days', amount: agingAnalysis?.thirty_to_sixty || 0 },
                    { period: '60-90 Days', amount: agingAnalysis?.sixty_to_ninety || 0 },
                    { period: '90+ Days', amount: agingAnalysis?.above_ninety || 0 }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value?.toLocaleString()}`} />
                  <Bar dataKey="amount" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-6 grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-600">Current (0-30)</p>
                  <p className="text-2xl font-bold text-slate-900">₹{agingAnalysis?.current?.toLocaleString() || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600">30-60 Days</p>
                  <p className="text-2xl font-bold text-slate-900">₹{agingAnalysis?.thirty_to_sixty?.toLocaleString() || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600">60-90 Days</p>
                  <p className="text-2xl font-bold text-slate-900">₹{agingAnalysis?.sixty_to_ninety?.toLocaleString() || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600">90+ Days</p>
                  <p className="text-2xl font-bold text-slate-900">₹{agingAnalysis?.above_ninety?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}