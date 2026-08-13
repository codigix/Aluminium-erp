import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, DataTable, StatusBadge, Button, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';
import { useNavigate } from 'react-router-dom';
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
  AlertTriangle, Archive, Move
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const InventoryReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [movementsPage, setMovementsPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const itemsPerPage = 10;
  const itemsPerSmallPage = 5;
  const allItemsPerPage = 15;

  useEffect(() => {
    fetchInventoryReport();
    setMovementsPage(1);
    setLowStockPage(1);
  }, [dateRange, selectedWarehouse]);

  const fetchInventoryReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/dashboard/inventory-report?start=${dateRange.start}&end=${dateRange.end}`;
      if (selectedWarehouse !== 'All') url += `&warehouse=${selectedWarehouse}`;

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch inventory report');
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching inventory report:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedMovements = useMemo(() => {
    if (!stats?.recentMovements) return [];
    const perPage = showAllMovements ? allItemsPerPage : itemsPerPage;
    const currPage = movementsPage;
    const startIndex = (currPage - 1) * perPage;
    return stats.recentMovements.slice(startIndex, startIndex + perPage);
  }, [stats?.recentMovements, movementsPage, showAllMovements]);

  const totalMovementsPages = useMemo(() => {
    const perPage = showAllMovements ? allItemsPerPage : itemsPerPage;
    return Math.ceil((stats?.recentMovements?.length || 0) / perPage);
  }, [stats?.recentMovements, showAllMovements]);

  const paginatedLowStock = useMemo(() => {
    if (!stats?.lowStockItems) return [];
    const perPage = showAllLowStock ? allItemsPerPage : itemsPerSmallPage;
    const currPage = lowStockPage;
    const startIndex = (currPage - 1) * perPage;
    return stats.lowStockItems.slice(startIndex, startIndex + perPage);
  }, [stats?.lowStockItems, lowStockPage, showAllLowStock]);

  const totalLowStockPages = useMemo(() => {
    const perPage = showAllLowStock ? allItemsPerPage : itemsPerSmallPage;
    return Math.ceil((stats?.lowStockItems?.length || 0) / perPage);
  }, [stats?.lowStockItems, showAllLowStock]);

  const handleExport = () => {
    if (!stats) return;

    const wb = XLSX.utils.book_new();

    // 1. Inventory Summary
    const summaryData = [
      { Metric: 'Total Items', Value: stats.kpis?.totalItems || 0 },
      { Metric: 'Total Stock Value', Value: stats.kpis?.totalValue || 0 },
      { Metric: 'Low Stock Items', Value: stats.kpis?.lowStockItems || 0 },
      { Metric: 'Out of Stock Items', Value: stats.kpis?.outOfStockItems || 0 },
      { Metric: 'Active Warehouses', Value: stats.kpis?.activeWarehouses || 0 }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Inventory Summary");

    // 2. Stock by Warehouse
    if (stats.stockByWarehouse) {
      const warehouseData = stats.stockByWarehouse.map(w => ({
        'Warehouse': w.name,
        'Total Items': w.totalItems,
        'Stock Value': w.stockValue,
        'Low Stock': w.lowStock,
        'Out of Stock': w.outOfStock,
        'Status': w.status
      }));
      const wsWarehouse = XLSX.utils.json_to_sheet(warehouseData);
      XLSX.utils.book_append_sheet(wb, wsWarehouse, "Stock by Warehouse");
    }

    // 3. Top Low Stock Items
    if (stats.lowStockItems) {
      const lowStockData = stats.lowStockItems.map(item => ({
        'Item Code': item.code,
        'Item Name': item.name,
        'Current Stock': item.currentStock,
        'Min Required': item.minRequired,
        'Warehouse': item.warehouse
      }));
      const wsLowStock = XLSX.utils.json_to_sheet(lowStockData);
      XLSX.utils.book_append_sheet(wb, wsLowStock, "Low Stock Items");
    }

    // 4. Recent Stock Movements
    if (stats.recentMovements) {
      const movementsData = stats.recentMovements.map(m => ({
        'Date / Time': m.timestamp,
        'Item Code': m.itemCode,
        'Item Name': m.itemName,
        'Transaction Type': m.type,
        'Reference': m.reference,
        'Quantity': m.quantity,
        'Balance': m.balance,
        'Warehouse': m.warehouse
      }));
      const wsMovements = XLSX.utils.json_to_sheet(movementsData);
      XLSX.utils.book_append_sheet(wb, wsMovements, "Recent Movements");
    }

    XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  const isDataLoading = loading || !stats;

  if (showAllLowStock) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl text-slate-900 font-bold">All Low Stock Items</h2>
            <div className="hidden md:flex items-center gap-2">
               <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">Low Stock: {stats.kpis.lowStockCount}</div>
               <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold">Out of Stock: {stats.kpis.outOfStockCount}</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowAllLowStock(false)}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <KPIStoreCard title="Total Items" value={stats.kpis.totalItems} subtitle="In Catalog" icon={Box} color="text-indigo-600" subColor="bg-indigo-50" />
           <KPIStoreCard title="Low Stock" value={stats.kpis.lowStockCount} subtitle="Items Below Min" icon={AlertTriangle} color="text-amber-600" subColor="bg-amber-50" />
           <KPIStoreCard title="Out of Stock" value={stats.kpis.outOfStockCount} subtitle="Zero Balance" icon={XCircle} color="text-rose-600" subColor="bg-rose-50" />
           <KPIStoreCard title="Stock Value" value={`₹${(stats.kpis.totalValue/100000).toFixed(1)}L`} subtitle="Total Assets" icon={IndianRupee} color="text-emerald-600" subColor="bg-emerald-50" />
        </div>

        <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400 font-bold uppercase tracking-tighter border-b border-slate-100">
                  <th className="p-2">Item Code</th>
                  <th className="p-2">Item Name</th>
                  <th className="p-2">Warehouse</th>
                  <th className="p-2 text-center">Current Stock</th>
                  <th className="p-2 text-right">Min. Required</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedLowStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2 font-bold text-indigo-600">{item.itemCode}</td>
                    <td className="p-2 font-medium text-slate-900">{item.itemName}</td>
                    <td className="p-2 text-slate-500">{item.warehouse}</td>
                    <td className="p-2 text-center">
                       <span className={`px-2 py-0.5 rounded font-bold ${parseFloat(item.currentStock) === 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                         {parseFloat(item.currentStock).toFixed(0)} {item.uom}
                       </span>
                    </td>
                    <td className="p-2 text-right font-bold text-slate-400">{parseFloat(item.minRequired).toFixed(0)} {item.uom}</td>
                    <td className="p-2 text-right">
                      <button 
                        onClick={() => navigate(`/stock-details/${item.itemCode}`)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalLowStockPages > 1 && (
            <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {(lowStockPage - 1) * (showAllLowStock ? allItemsPerPage : itemsPerSmallPage) + 1} to {Math.min(lowStockPage * (showAllLowStock ? allItemsPerPage : itemsPerSmallPage), stats.lowStockItems.length)} of {stats.lowStockItems.length} items
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={lowStockPage === 1}
                  onClick={() => setLowStockPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalLowStockPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setLowStockPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      lowStockPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={lowStockPage === totalLowStockPages}
                  onClick={() => setLowStockPage(prev => prev + 1)}
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

  if (showAllMovements) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl text-slate-900 font-bold">Stock Movement History</h2>
            <div className="hidden md:flex items-center gap-2">
               <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">Receipts: {stats.recentMovements.filter(m => m.type.includes('IN')).length}</div>
               <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold">Issues: {stats.recentMovements.filter(m => m.type.includes('OUT')).length}</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowAllMovements(false)}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <KPIStoreCard title="Total Items" value={stats.kpis.totalItems} subtitle="Inventory Catalog" icon={Box} color="text-indigo-600" subColor="bg-indigo-50" />
           <KPIStoreCard title="Total Value" value={`₹${(stats.kpis.totalValue/100000).toFixed(1)}L`} subtitle="Current Assets" icon={IndianRupee} color="text-emerald-600" subColor="bg-emerald-50" />
           <KPIStoreCard title="Active WH" value={stats.kpis.activeWarehouses} subtitle="Storage Locations" icon={Warehouse} color="text-blue-600" subColor="bg-blue-50" />
           <KPIStoreCard title="Low Stock" value={stats.kpis.lowStockCount} subtitle="Needs Reorder" icon={AlertTriangle} color="text-amber-600" subColor="bg-amber-50" />
        </div>

        <div className="bg-white rounded border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-xs text-slate-400 font-bold uppercase tracking-tighter border-b border-slate-100">
                  <th className="p-2">Date / Time</th>
                  <th className="p-2">Item Code</th>
                  <th className="p-2">Item Name</th>
                  <th className="p-2 text-center">Type</th>
                  <th className="p-2">Reference</th>
                  <th className="p-2 text-right">Quantity</th>
                  <th className="p-2 text-right">Balance</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedMovements.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs">
                    <td className="p-2">
                      <p className="font-bold text-slate-900">{new Date(m.time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p className="text-[10px] text-slate-400">{new Date(m.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="p-2 font-bold text-indigo-600">{m.itemCode}</td>
                    <td className="p-2 font-medium text-slate-900 truncate max-w-[200px]">{m.itemName}</td>
                    <td className="p-2 text-center">
                       <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                         m.type.includes('IN') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                       }`}>
                         {m.type.includes('IN') ? 'Receipt' : 'Issue'}
                       </span>
                    </td>
                    <td className="p-2 font-medium text-slate-600">{m.reference}</td>
                    <td className={`p-2 text-right font-black ${m.type.includes('IN') ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.type.includes('IN') ? '+' : '-'}{parseFloat(m.quantity).toFixed(3)}
                    </td>
                    <td className="p-2 text-right font-black text-slate-900">{parseFloat(m.balance).toFixed(3)}</td>
                    <td className="p-2 text-right">
                      <button 
                        onClick={() => navigate(`/stock-details/${m.itemCode}`)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-all"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalMovementsPages > 1 && (
            <div className="p-2 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {(movementsPage - 1) * allItemsPerPage + 1} to {Math.min(movementsPage * allItemsPerPage, stats.recentMovements.length)} of {stats.recentMovements.length} movements
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={movementsPage === 1}
                  onClick={() => setMovementsPage(prev => prev - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                {[...Array(totalMovementsPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setMovementsPage(i + 1)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      movementsPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button 
                  disabled={movementsPage === totalMovementsPages}
                  onClick={() => setMovementsPage(prev => prev + 1)}
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

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

  return (
    <div className="space-y-2 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl text-slate-900  ">Inventory Report</h1>
          <p className="text-xs text-slate-500    mt-1">Overview of inventory status and stock movement</p>
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
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-white border border-slate-200 rounded p-2 text-xs  text-slate-600 outline-none"
          >
            <option value="All">All Warehouses</option>
            {stats?.stockByWarehouse?.map((warehouse, idx) => (
              <option key={idx} value={warehouse.name}>{warehouse.name}</option>
            ))}
          </select>
          <button 
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded text-xs   tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPIs Row */}
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
            <KPIStoreCard title="Total Items" value={stats?.kpis?.totalItems || 0} subtitle="All Items" icon={Box} color="text-indigo-600" subColor="bg-indigo-50" />
            <KPIStoreCard title="Total Value" value={`₹${((stats?.kpis?.totalValue || 0)/100000).toFixed(1)}L`} subtitle="Current Assets" icon={IndianRupee} color="text-emerald-600" subColor="bg-emerald-50" />
            <KPIStoreCard title="Active Warehouses" value={stats?.kpis?.activeWarehouses || 0} subtitle="Storage Locations" icon={Warehouse} color="text-blue-600" subColor="bg-blue-50" />
            <KPIStoreCard title="Low Stock Items" value={stats?.kpis?.lowStockCount || 0} subtitle="Needs Reorder" icon={AlertTriangle} color="text-amber-600" subColor="bg-amber-50" />
            <KPIStoreCard title="Stock Turnover" value={stats?.kpis?.turnoverRate || '0x'} subtitle="Annual Rate" icon={Activity} color="text-rose-600" subColor="bg-rose-50" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Value by Category */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900   ">Stock Value by Category</h3>
            <p className="text-xs text-slate-400   mt-1">Distribution of stock value by category</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.categoryDistribution || []}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(stats?.categoryDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${parseFloat(value).toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full mt-6 space-y-2">
              {(stats?.categoryDistribution || []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-xs  text-slate-500 ">{item.name}</span>
                  </div>
                  <span className="text-xs  text-slate-900">₹{parseFloat(item.value).toLocaleString('en-IN')} ({item.percent}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Status Summary */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="mb-8">
            <h3 className="text-sm text-slate-900   ">Stock Status Summary</h3>
            <p className="text-xs text-slate-400   mt-1">Current stock availability overview</p>
          </div>
          <div className="space-y-6">
            {(stats?.statusSummary || []).map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-xs   tracking-wider">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      item.name === 'Available' ? 'bg-emerald-500' : 
                      item.name === 'Low Stock' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <span className="text-slate-600">{item.name} Items</span>
                  </div>
                  <span className="text-slate-900">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    item.name === 'Available' ? 'bg-emerald-500' : 
                    item.name === 'Low Stock' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} style={{ width: `${(item.value / (stats?.kpis?.totalItems || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className="text-xs  text-slate-400  ">Total Items</span>
              <span className="text-sm  text-slate-900">{stats?.kpis?.totalItems || 0}</span>
            </div>
          </div>
        </div>

        {/* Stock Value Trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm text-slate-900   ">Stock Value Trend</h3>
              <p className="text-xs text-slate-400   mt-1">Total stock value over time</p>
            </div>
            <select className="text-xs    text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <option>Daily</option>
            </select>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.stockTrend || []}>
                <defs>
                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} tickFormatter={(val) => `₹${val / 1000}K`} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val) => `₹${parseFloat(val).toLocaleString('en-IN')}`} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorStock)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Warehouse & Low Stock Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Warehouse */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900   ">Stock by Warehouse</h3>
              <p className="text-xs text-slate-400   mt-1">Current stock summary by warehouse</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400    border-b border-slate-50">
                  <th className="pb-3 pr-2">Warehouse</th>
                  <th className="pb-3 pr-2 text-center">Total Items</th>
                  <th className="pb-3 pr-2 text-center">Stock Value</th>
                  <th className="pb-3 pr-2 text-center">Low Stock</th>
                  <th className="pb-3 pr-2 text-center">Out of Stock</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(stats?.warehouseStock || []).map((warehouse, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 pr-2 text-xs  text-slate-900">{warehouse.name}</td>
                    <td className="py-4 text-xs  text-slate-600 text-center">{warehouse.totalItems}</td>
                    <td className="py-4 text-xs  text-slate-600 text-center">₹{parseFloat(warehouse.stockValue).toLocaleString('en-IN')}</td>
                    <td className="py-4 text-xs  text-amber-600 text-center">{warehouse.lowStock}</td>
                    <td className="py-4 text-xs  text-rose-600 text-center">{warehouse.outOfStock}</td>
                    <td className="py-4 text-right">
                       <span className="text-[9px]   px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Low Stock Items */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm text-slate-900   ">Top Low Stock Items</h3>
              <p className="text-xs text-slate-400   mt-1">Items that are running low on stock</p>
            </div>
            <button 
              onClick={() => setShowAllLowStock(true)}
              className="text-xs  text-indigo-600   flex items-center gap-1 hover:underline"
            >
              View all low stock items <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400    border-b border-slate-50">
                  <th className="pb-3 pr-2">Item Code</th>
                  <th className="pb-3 pr-2">Item Name</th>
                  <th className="pb-3 pr-2 text-center">Current Stock</th>
                  <th className="pb-3 text-right">Min. Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedLowStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 text-xs  text-indigo-600">{item.itemCode}</td>
                    <td className="py-4 text-xs  text-slate-600">{item.itemName}</td>
                    <td className="py-4 text-xs  text-rose-600 text-center">{parseFloat(item.currentStock).toFixed(0)} {item.uom}</td>
                    <td className="py-4 text-right text-xs  text-slate-400">{parseFloat(item.minRequired).toFixed(0)} {item.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalLowStockPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[9px]  text-slate-400  ">
                Page {lowStockPage} of {totalLowStockPages}
              </p>
              <div className="flex items-center gap-1">
                <button 
                  disabled={lowStockPage === 1}
                  onClick={() => setLowStockPage(prev => prev - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
                <button 
                  disabled={lowStockPage === totalLowStockPages}
                  onClick={() => setLowStockPage(prev => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Stock Movements */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
           <h3 className="text-sm text-slate-900   ">Recent Stock Movements</h3>
           <button 
             onClick={() => setShowAllMovements(true)}
             className="text-xs  text-indigo-600   flex items-center gap-1 hover:underline"
           >
             View all stock movements <ArrowRight className="w-3 h-3" />
           </button>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-xs text-slate-400    border-b border-slate-100">
                <th className="px-4 py-2">Date / Time</th>
                <th className="px-4 py-2">Item Code</th>
                <th className="px-4 py-2">Item Name</th>
                <th className="px-4 py-2 text-center">Transaction Type</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2">Warehouse</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedMovements.map((movement, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-xs border-b border-slate-50">
                  <td className="px-4 py-1.5 whitespace-nowrap">
                    <p className=" text-slate-900">{new Date(movement.time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[8px] text-slate-400  mt-0.5">{new Date(movement.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-4 py-1.5  text-indigo-600 font-bold">{movement.itemCode}</td>
                  <td className="px-4 py-1.5  text-slate-600 truncate max-w-[150px] font-medium">{movement.itemName}</td>
                  <td className="px-4 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[8px]   er ${
                      movement.type === 'IN' || movement.type === 'GRN_IN' ? 'bg-emerald-50 text-emerald-600 font-black' : 'bg-rose-50 text-rose-600 font-black'
                    }`}>
                      {movement.type === 'IN' || movement.type === 'GRN_IN' ? 'Receipt' : 'Issue'}
                    </span>
                  </td>
                  <td className="px-4 py-1.5  text-slate-900 font-medium">{movement.reference}</td>
                  <td className={`px-4 py-1.5 text-right font-black ${
                    movement.type === 'IN' || movement.type === 'GRN_IN' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {movement.type === 'IN' || movement.type === 'GRN_IN' ? '+' : '-'}{parseFloat(movement.quantity).toFixed(3)}
                  </td>
                  <td className="px-4 py-1.5 text-right  text-slate-900 font-black">{parseFloat(movement.balance).toFixed(3)}</td>
                  <td className="px-4 py-1.5  text-slate-500">{movement.warehouse}</td>
                  <td className="px-4 py-1.5 text-right">
                    <button 
                      onClick={() => navigate(`/stock-details/${movement.itemCode}`)}
                      className="p-1 hover:bg-white text-slate-400 hover:text-indigo-600 rounded border border-transparent hover:border-slate-100 transition-all shadow-sm"
                      title="View Stock Details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalMovementsPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
             <p className="text-xs  text-slate-400  ">
               Showing {(movementsPage - 1) * itemsPerPage + 1} to {Math.min(movementsPage * itemsPerPage, stats?.recentMovements?.length || 0)} of {stats?.recentMovements?.length || 0} entries
             </p>
             <div className="flex items-center gap-1">
               <button 
                 disabled={movementsPage === 1}
                 onClick={() => setMovementsPage(prev => prev - 1)}
                 className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-white disabled:opacity-50"
               >
                 <ChevronRight className="w-4 h-4 rotate-180" />
               </button>
               {[...Array(totalMovementsPages)].map((_, i) => (
                 <button 
                   key={i}
                   onClick={() => setMovementsPage(i + 1)}
                   className={`w-8 h-8 flex items-center justify-center rounded  text-xs transition-all ${
                     movementsPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'border border-slate-200 text-slate-400 hover:bg-white'
                   }`}
                 >
                   {i + 1}
                 </button>
               ))}
               <button 
                 disabled={movementsPage === totalMovementsPages}
                 onClick={() => setMovementsPage(prev => prev + 1)}
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

export default InventoryReport;
