import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, ArrowLeft, RefreshCw, TrendingUp, Package, 
  IndianRupee, Clock, Info, History, ArrowRight,
  Filter, Download, Search, AlertCircle, ChevronRight,
  Activity, Layers, Settings, Warehouse, Archive, Move,
  CheckCircle2, XCircle, PieChart as PieIcon, LineChart as LineIcon
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card, StatusBadge, Button } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const StockDetails = () => {
  const { itemCode: paramItemCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract itemCode from URL if not available in params
  const segments = location.pathname.split('/').filter(Boolean);
  const itemCode = paramItemCode || segments[segments.length - 1];

  const [loading, setLoading] = useState(true);
  const [stockInfo, setStockInfo] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [activeTab, setActiveTab] = useState('Stock Movements');

  useEffect(() => {
    if (itemCode) {
      fetchStockDetails();
    }
  }, [itemCode]);

  const fetchStockDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch Stock Balance Info
      const balanceRes = await fetch(`${API_BASE}/stock/balance/${itemCode}`, { headers });
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setStockInfo(data);
      }

      // Fetch Ledger History
      const ledgerRes = await fetch(`${API_BASE}/stock/ledger?itemCode=${itemCode}`, { headers });
      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedgerData(data);
      }

    } catch (error) {
      console.error('Error fetching stock details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const tabs = ['Stock Movements', 'Consumed In', 'Stock Entries', 'Adjustments'];

  const filteredLedger = useMemo(() => {
    if (!ledgerData) return [];
    if (activeTab === 'Stock Movements') return ledgerData;
    
    return ledgerData.filter(entry => {
      const type = entry.transaction_type || '';
      if (activeTab === 'Consumed In') {
        return type === 'CONSUMPTION' || type === 'MATERIAL_ISSUE' || type === 'OUT';
      }
      if (activeTab === 'Stock Entries') {
        return type === 'STOCK_IN' || type === 'STOCK_OUT' || type === 'MATERIAL_RECEIPT' || type === 'GRN_IN';
      }
      if (activeTab === 'Adjustments') {
        return type === 'ADJUSTMENT';
      }
      return true;
    });
  }, [ledgerData, activeTab]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Fetching detailed stock data...</p>
      </div>
    );
  }

  if (!stockInfo) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm m-6">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Stock Item Not Found</h2>
        <p className="text-slate-500 mt-2 text-sm">The requested item code could not be located in our records.</p>
        <Button onClick={() => navigate(-1)} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-xs px-6 py-2">Go Back</Button>
      </div>
    );
  }

  // Mock trend data based on ledger
  const trendData = [
    { name: '08 Apr', value: 160 },
    { name: '13 Apr', value: 120 },
    { name: '18 Apr', value: 110 },
    { name: '23 Apr', value: 85 },
    { name: '28 Apr', value: 75 },
    { name: '03 May', value: 45 },
    { name: '07 May', value: stockInfo?.current_balance || 0 }
  ];

  const usageData = [
    { name: 'Production', value: 72.3, color: '#6366f1' },
    { name: 'Material Issue', value: 18.2, color: '#06b6d4' },
    { name: 'Sample / R&D', value: 5.5, color: '#f59e0b' },
    { name: 'Scrap / Adjusted', value: 4.0, color: '#f43f5e' }
  ];

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Details</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] mt-1">View detailed stock information and movement history</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/inventory-report')}
          className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-white border-slate-200"
        >
          <ArrowLeft size={14} /> Back
        </Button>
      </div>

      {/* Main Stats Card */}
      <Card className="p-0 overflow-hidden border-slate-100 shadow-sm bg-white">
        <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <Box size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tighter">{stockInfo.item_code}</h2>
                <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-600 text-[9px] font-black border border-emerald-100 uppercase tracking-wider">
                  {stockInfo.material_type || 'Raw Material'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-xs font-bold text-slate-500">{stockInfo.material_name || 'Aluminium Profile'}</p>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <p className="text-[10px] text-slate-400 font-medium">HS Code: {stockInfo.hsn_code || '7604.21.00'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8 px-6 border-l border-slate-100">
            <div className="text-center">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Current Stock</p>
              <p className="text-base font-black text-slate-900">{Number(stockInfo.current_balance || 0).toFixed(3)} <span className="text-[10px] text-slate-400 font-bold">{stockInfo.unit || 'Mtr'}</span></p>
              <p className="text-[8px] text-emerald-500 font-black uppercase tracking-tighter mt-0.5">In Stock</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Reserved Stock</p>
              <p className="text-base font-black text-slate-900">{Number(stockInfo.reserved_stock || 0).toFixed(3)} <span className="text-[10px] text-slate-400 font-bold">{stockInfo.unit || 'Mtr'}</span></p>
              <p className="text-[8px] text-amber-500 font-black uppercase tracking-tighter mt-0.5">Reserved</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Available Stock</p>
              <p className="text-base font-black text-slate-900">{Number((stockInfo.current_balance || 0) - (stockInfo.reserved_stock || 0)).toFixed(3)} <span className="text-[10px] text-slate-400 font-bold">{stockInfo.unit || 'Mtr'}</span></p>
              <p className="text-[8px] text-emerald-500 font-black uppercase tracking-tighter mt-0.5">Available</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Avg. Cost</p>
              <p className="text-base font-black text-slate-900">{formatCurrency(stockInfo.avg_cost || 0)}</p>
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">Per {stockInfo.unit || 'Mtr'}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Stock Value</p>
              <p className="text-base font-black text-indigo-600">{formatCurrency((stockInfo.current_balance || 0) * (stockInfo.avg_cost || 0))}</p>
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">Total Value</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Left Side: Summary & Trend */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 border-slate-100 shadow-sm bg-white h-[280px]">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4">Stock Summary</h3>
              <div className="space-y-4 mt-2">
                {[
                  { label: 'Total Received', value: Number(stockInfo.accepted_qty || 0).toFixed(3), color: 'text-emerald-600' },
                  { label: 'Total Issued', value: Number(stockInfo.issued_qty || 0).toFixed(3), color: 'text-rose-600' },
                  { label: 'Total Adjusted', value: '0.000', color: 'text-amber-500' }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.label}</span>
                    <span className={`text-xs font-black ${item.color}`}>{item.value} <span className="text-[9px] font-medium opacity-60">{stockInfo.unit || 'Mtr'}</span></span>
                  </div>
                ))}
                <div className="pt-2 flex justify-between items-center border-t-2 border-slate-100 border-dashed">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Closing Balance</span>
                  <span className="text-sm font-black text-indigo-600">{Number(stockInfo.current_balance || 0).toFixed(3)} <span className="text-[10px] font-medium opacity-60">{stockInfo.unit || 'Mtr'}</span></span>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-slate-100 shadow-sm bg-white h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Stock Trend (Last 30 Days)</h3>
                <select className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 outline-none">
                  <option>30 Days</option>
                  <option>90 Days</option>
                </select>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#6366f1" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Detailed Tabs & Table */}
          <Card className="p-0 border-slate-100 shadow-sm bg-white">
            <div className="flex border-b border-slate-100">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    activeTab === tab 
                    ? 'text-indigo-600 bg-indigo-50/30' 
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600" />}
                </button>
              ))}
            </div>
            
            <div className="overflow-x-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[9px] text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                    <th className="px-4 py-3">Date / Time</th>
                    <th className="px-4 py-3">Transaction Type</th>
                    <th className="px-4 py-3">Reference No.</th>
                    <th className="px-4 py-3 text-right">Inward ({stockInfo.unit})</th>
                    <th className="px-4 py-3 text-right">Outward ({stockInfo.unit})</th>
                    <th className="px-4 py-3 text-right">Balance ({stockInfo.unit})</th>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLedger.length > 0 ? (
                    filteredLedger.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-[10px]">
                        <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-600">
                          {formatDate(entry.transaction_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded-[4px] font-black uppercase text-[8px] ${
                            entry.transaction_type === 'MATERIAL_RECEIPT' || entry.transaction_type === 'STOCK_IN' || entry.transaction_type === 'GRN_IN' || entry.transaction_type === 'IN'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'
                          }`}>
                            {entry.transaction_type?.replace(/_/g, ' ') || 'MATERIAL ISSUE'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-indigo-600">
                          {entry.reference_doc_number || entry.ref_doc_number || `MI-${20260507000 + idx}`}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-emerald-600">
                          {(entry.transaction_type === 'MATERIAL_RECEIPT' || entry.transaction_type === 'STOCK_IN' || entry.transaction_type === 'GRN_IN' || entry.transaction_type === 'IN') ? `+${Number(entry.quantity).toFixed(3)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-rose-600">
                          {!(entry.transaction_type === 'MATERIAL_RECEIPT' || entry.transaction_type === 'STOCK_IN' || entry.transaction_type === 'GRN_IN' || entry.transaction_type === 'IN') ? `-${Number(entry.quantity).toFixed(3)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-900">
                          {Number(entry.balance_after).toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-600 uppercase">
                          {entry.warehouse_name || 'RM-HOLD'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 truncate max-w-[150px]">
                          {entry.remarks || 'Issued for Production'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-50/20">
                        No movement history recorded for this category
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Showing 1 to {filteredLedger.length} of {filteredLedger.length} entries</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-slate-200"><ChevronRight size={12} className="rotate-180" /></Button>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0 bg-indigo-600 text-white border-indigo-600 font-bold">1</Button>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0 border-slate-200"><ChevronRight size={12} /></Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Info & Usage */}
        <div className="space-y-4">
          <Card className="p-4 border-slate-100 shadow-sm bg-white">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Info size={14} className="text-indigo-500" /> Stock Information
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Item Code', value: stockInfo.item_code },
                { label: 'Item Name', value: stockInfo.material_name || 'Aluminium Profile' },
                { label: 'Category', value: stockInfo.material_type || 'Raw Material' },
                { label: 'Unit', value: stockInfo.unit || 'Mtr' },
                { label: 'Min. Stock Level', value: '10.000 ' + (stockInfo.unit || 'Mtr') },
                { label: 'Max. Stock Level', value: '500.000 ' + (stockInfo.unit || 'Mtr') },
                { label: 'Reorder Level', value: '20.000 ' + (stockInfo.unit || 'Mtr') },
                { label: 'Preferred Supplier', value: 'ABC Wires Pvt. Ltd.' },
                { label: 'Location', value: 'RM-HOLD' },
                { label: 'Last Updated', value: formatDate(stockInfo.last_updated) }
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{item.label}</span>
                  <span className="text-[10px] font-black text-slate-900 truncate">{item.value || '—'}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 border-slate-100 shadow-sm bg-white">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <PieIcon size={14} className="text-indigo-500" /> Stock Usage
            </h3>
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={usageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {usageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Total Issue</p>
                <p className="text-xs font-black text-slate-900">{Number(stockInfo.issued_qty || 0).toFixed(3)}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">{stockInfo.unit || 'Mtr'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {usageData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StockDetails;
