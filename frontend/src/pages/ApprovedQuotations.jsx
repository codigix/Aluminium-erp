import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, Search, Filter, Download, ChevronRight, 
  ArrowLeft, Eye, Calendar, Building2, 
  ChevronDown, ChevronUp, GitBranch, IndianRupee,
  Package, LayoutGrid
} from 'lucide-react';
import { StatusBadge, Button } from '../components/ui.jsx';
import { cleanProjectName } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  let base = UPLOAD_BASE || API_BASE;
  if (base.endsWith('/')) base = base.slice(0, -1);
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;
  if (base.toLowerCase().endsWith('/uploads') && cleanPath.toLowerCase().startsWith('uploads/')) {
    cleanPath = cleanPath.slice(8);
  }
  const url = `${base}/${cleanPath}`;
  if (url.startsWith('http')) return url;
  return window.location.origin + (url.startsWith('/') ? url : '/' + url);
};

const ApprovedQuotations = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [expandedItems, setExpandedItems] = useState({});
  
  const toggleItemExpansion = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const [dateRange, setDateRange] = useState({
    start: '2026-04-01',
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchApprovedQuotations();
  }, [dateRange]);

  const fetchApprovedQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${API_BASE}/quotation-requests?status=Approved,Approved,Rejected,REJECTED,Accepted,ACCEPTED,Approval,APPROVAL,Completed,COMPLETED,REVISED,Revised`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch quotations');
      const data = await response.json();
      
      const grouped = {};
      data.forEach(quote => {
        const rootId = quote.parent_id || quote.id;
        const groupKey = `received_${quote.company_id}_${rootId}`;
        
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            id: quote.id,
            display_id: rootId,
            uniqueKey: groupKey,
            company_name: quote.company_name,
            company_id: quote.company_id,
            created_at: quote.created_at,
            status: quote.status,
            reply_pdf: quote.reply_pdf,
            project_name: quote.project_name, 
            total_amount: 0,
            received_amount: 0,
            quotes: [],
            version: quote.version || 1,
            batch_id: quote.batch_id,
            parent_id: quote.parent_id
          };
        }
        
        grouped[groupKey].quotes.push(quote);

        const currentVersion = grouped[groupKey].version || 0;
        const quoteVersion = quote.version || 1;
        const currentStatus = (grouped[groupKey].status || '').trim().toUpperCase();
        const quoteStatus = (quote.status || '').trim().toUpperCase();

        if (quoteVersion > currentVersion || (quoteVersion === currentVersion && quoteStatus === 'APPROVED' && currentStatus !== 'APPROVED')) {
          grouped[groupKey].id = quote.id;
          grouped[groupKey].status = quote.status;
          grouped[groupKey].version = quote.version;
          grouped[groupKey].created_at = quote.created_at;
          grouped[groupKey].project_name = quote.project_name;
          grouped[groupKey].reply_pdf = quote.reply_pdf;
          grouped[groupKey].batch_id = quote.batch_id;
          grouped[groupKey].parent_id = quote.parent_id;
        }
      });
      
      const filteredGroups = Object.values(grouped).filter(group => {
        const s = (group.status || '').trim().toUpperCase();
        return s === 'APPROVED';
      });

      filteredGroups.forEach(group => {
        if (!group.quotes) group.quotes = [];
        group.quotes.sort((a, b) => (b.version || 0) - (a.version || 0));

        const latestVersion = group.version || 1;
        const targetBatchId = group.batch_id;
        const targetParentId = group.parent_id;
        const targetCreatedAt = group.created_at;

        const latestQuotes = group.quotes.filter(q => {
          if ((q.version || 1) !== latestVersion) return false;
          if (targetBatchId && q.batch_id) return q.batch_id === targetBatchId;
          if (targetParentId && q.parent_id) return q.parent_id === targetParentId;
          if (q.id === group.id) return true;
          const diff = Math.abs(new Date(q.created_at) - new Date(targetCreatedAt));
          return diff < 10000;
        });
        
        const billableLatestQuotes = latestQuotes.filter(q => {
          const g = (q.item_group || q.item_group_calc || '').toUpperCase();
          const isSA = (g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY')) && !g.includes('FG');
          const isFG = (g.includes('FG') || g.includes('FINISHED')) && !isSA;
          return isFG || isSA;
        });
        
        group.total_amount = billableLatestQuotes.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0);
        group.received_amount = billableLatestQuotes.reduce((sum, q) => sum + (parseFloat(q.received_amount) || 0), 0);
        group.quotes = latestQuotes;
      });

      setQuotations(filteredGroups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      console.error('Error fetching approved quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key) => {
    const next = new Set(expandedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedKeys(next);
  };

  const handleView = (row) => {
    const latestVersion = row.version || 1;
    const quotes = row?.quotes || [];
    const latestQuotes = quotes.filter(q => (q.version || 1) === latestVersion);
    const firstQuote = latestQuotes[0] || quotes[0];

    navigate('/sales/quotation-form', {
      state: {
        initialData: {
          id: row.id,
          clientId: row.company_id,
          clientName: row.company_name,
          clientEmail: firstQuote?.client_email || '',
          phone: firstQuote?.client_phone || '',
          address: firstQuote?.client_address || '',
          version: row.version,
          parentId: firstQuote?.parent_id || row.id,
          batchId: row.batch_id,
          projectName: row.project_name || '',
          mode: 'received',
          items: latestQuotes.map(q => ({
            id: q.id,
            salesOrderItemId: q.sales_order_item_id,
            item_code: q.item_code,
            orderId: q.sales_order_id,
            drawing_id: q.drawing_id,
            drawing_no: q.drawing_no,
            description: q.item_description,
            quantity: q.item_qty,
            unit: q.item_unit || q.uom || 'Nos',
            rate: q.unit_rate || (parseFloat(q.total_amount) / (parseFloat(q.item_qty) || 1)),
            bom_cost: q.bom_cost || 0,
            gst_percentage: q.gst_percentage || 18,
            item_group: q.item_group,
            status: q.status,
            sub_assemblies: q.sub_assemblies || []
          })),
          notes: firstQuote?.notes || ''
        }
      }
    });
  };

  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesSearch = 
        (q.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (`QRT-${String(q.display_id || q.id).padStart(4, '0')}`).toLowerCase().includes(searchTerm.toLowerCase());
      
      const qDate = new Date(q.created_at).toISOString().split('T')[0];
      const matchesDate = qDate >= dateRange.start && qDate <= dateRange.end;

      return matchesSearch && matchesDate;
    });
  }, [quotations, searchTerm, dateRange]);

  const stats = useMemo(() => {
    return {
      total: filteredQuotations.length,
      totalValue: filteredQuotations.reduce((sum, q) => sum + (parseFloat(q.received_amount || q.total_amount * 1.18) || 0), 0),
      uniqueClients: new Set(filteredQuotations.map(q => q.company_id)).size,
      thisMonth: filteredQuotations.filter(q => {
        const date = new Date(q.created_at);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length
    };
  }, [filteredQuotations]);

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] mb-1">
            <span>Dashboard</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span>Sales Report</span>
            <ChevronRight className="w-2.5 h-2.5" />
            <span className="text-rose-600">Approved Quotations</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">Approved Quotations</h1>
          <p className="text-slate-500 text-[11px]">Track approved quotations from BOM-approved orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/sales/sales-report')} className="flex items-center gap-1 font-bold text-[10px] h-8 px-3">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard icon={FileText} label="Total" value={stats.total} subValue="All Approved" color="indigo" />
        <StatCard icon={IndianRupee} label="Value" value={formatCurrency(stats.totalValue).split('.')[0]} subValue="Incl. GST" color="emerald" />
        <StatCard icon={Building2} label="Clients" value={stats.uniqueClients} subValue="Active" color="blue" />
        <StatCard icon={Calendar} label="Month" value={stats.thisMonth} subValue="Quotations" color="amber" />
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search ID, client or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500/5 focus:border-rose-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">
              <Calendar className="w-3 h-3 text-slate-400 ml-1" />
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent border-none outline-none cursor-pointer p-0.5"
              />
              <span className="text-slate-300 mx-0.5">—</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent border-none outline-none cursor-pointer p-0.5"
              />
            </div>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 font-bold text-[9px] h-7 px-2 rounded-lg">
              <Filter className="w-3 h-3" />
              Filters
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-8 px-3 py-2.5"></th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">ID / Type</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Client & Project</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Drawings</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-slate-100 border-t-rose-600 rounded-full animate-spin"></div>
                      <p className="text-[11px] text-slate-500 font-bold">Loading...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredQuotations.length > 0 ? (
                filteredQuotations.map((row) => (
                  <React.Fragment key={row.uniqueKey}>
                    <tr className={`hover:bg-slate-50/50 transition-colors ${expandedKeys.has(row.uniqueKey) ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <button 
                          onClick={() => toggleExpand(row.uniqueKey)}
                          className="p-1 hover:bg-white border border-transparent hover:border-slate-200 rounded-md transition-all group"
                        >
                          {expandedKeys.has(row.uniqueKey) ? 
                            <ChevronUp size={14} className="text-slate-400 group-hover:text-rose-600" /> : 
                            <ChevronDown size={14} className="text-slate-400 group-hover:text-rose-600" />
                          }
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black border border-indigo-100 w-fit">
                            QRT-{String(row.display_id || row.id).padStart(4, '0')}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold ml-0.5 tracking-tight">Ver {row.version}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-[12px] leading-tight truncate max-w-[180px]">{row.company_name}</span>
                          <span className="text-[10px] text-slate-500 italic truncate max-w-[180px]">{cleanProjectName(row.project_name)}</span>
                          <span className="text-[9px] text-slate-400 font-medium mt-0.5 uppercase tracking-tighter">
                            {new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-700 leading-tight">
                             {(() => {
                               const uniqueDrawings = [...new Set((row.quotes || []).map(q => q.drawing_no).filter(Boolean))];
                               return uniqueDrawings.length > 1 
                                 ? `${uniqueDrawings.length} Drawings` 
                                 : String(uniqueDrawings[0] || '—').toUpperCase();
                             })()}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {row.quotes?.filter(q => {
                              const g = String(q.item_group || q.item_group_calc || '').toUpperCase();
                              return g.includes('ASSEMBLY') || (q.sub_assemblies && q.sub_assemblies.length > 0);
                            }).length > 0 && (
                              <span className="px-1 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-black rounded border border-purple-100 uppercase tracking-wider">
                                {row.quotes?.filter(q => {
                                  const g = String(q.item_group || q.item_group_calc || '').toUpperCase();
                                  return g.includes('ASSEMBLY') || (q.sub_assemblies && q.sub_assemblies.length > 0);
                                }).length} Assembly
                              </span>
                            )}
                            {row.quotes?.filter(q => {
                              const g = String(q.item_group || q.item_group_calc || '').toUpperCase();
                              return !g.includes('ASSEMBLY') && !(q.sub_assemblies && q.sub_assemblies.length > 0);
                            }).length > 0 && (
                              <span className="px-1 py-0.5 bg-blue-50 text-blue-500 text-[8px] font-black rounded border border-blue-100 uppercase tracking-wider">
                                {row.quotes?.filter(q => {
                                  const g = String(q.item_group || q.item_group_calc || '').toUpperCase();
                                  return !g.includes('ASSEMBLY') && !(q.sub_assemblies && q.sub_assemblies.length > 0);
                                }).length} Part
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-black text-emerald-600 text-[12px]">
                            {formatCurrency(parseFloat(row.received_amount || 0) > 0 ? row.received_amount : (parseFloat(row.total_amount || 0) * 1.18))}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Incl. GST</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                    {expandedKeys.has(row.uniqueKey) && (
                      <tr>
                        <td colSpan="6" className="p-0">
                          <div className="bg-slate-50/50 p-2 border-t border-slate-100">
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                              <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Item Details</th>
                                    <th className="px-4 py-2 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Qty</th>
                                    <th className="px-4 py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Rate</th>
                                    <th className="px-4 py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider pr-6">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {row.quotes.map((item, idx) => {
                                    const g = String(item.item_group || item.item_group_calc || '').toUpperCase();
                                    const isAssembly = g.includes('ASSEMBLY') || (item.sub_assemblies && item.sub_assemblies.length > 0);
                                    
                                    return (
                                      <React.Fragment key={idx}>
                                        <tr className={`hover:bg-slate-50/30 transition-colors ${expandedItems[item.id] ? 'bg-indigo-50/10' : ''}`}>
                                          <td className="px-4 py-2">
                                            <div className="flex items-center gap-3">
                                              {item.sub_assemblies && item.sub_assemblies.length > 0 ? (
                                                <button 
                                                  onClick={() => toggleItemExpansion(item.id)}
                                                  className={`p-1 rounded-md border transition-all ${expandedItems[item.id] ? 'rotate-180 bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                                                >
                                                  <ChevronDown className="w-2.5 h-2.5" />
                                                </button>
                                              ) : (
                                                <div className="w-6" />
                                              )}
                                              <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[200px]">{item.description || item.item_description}</span>
                                                  <span className={`px-1.5 py-px text-[7px] font-black rounded uppercase tracking-wider border ${isAssembly ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    {isAssembly ? 'Assembly' : 'Part'}
                                                  </span>
                                                </div>
                                                <span className="text-[9px] text-slate-400 font-bold mt-0.5">DRW: {String(item.drawing_no || 'NA').toUpperCase()} | {item.item_code}</span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            <span className="text-[11px] font-black text-slate-900">{parseFloat(item.item_qty || item.design_qty || 1).toFixed(2)}</span>
                                            <span className="text-[8px] text-slate-400 ml-0.5 font-bold uppercase">{item.item_unit || item.unit || 'Nos'}</span>
                                          </td>
                                          <td className="px-4 py-2 text-right text-[11px] font-bold text-slate-600 italic">
                                            {formatCurrency(parseFloat(item.total_amount) / (parseFloat(item.item_qty || item.design_qty) || 1))}
                                          </td>
                                          <td className="px-4 py-2 text-right text-[11px] font-black text-slate-900 pr-6">
                                            {formatCurrency(item.total_amount)}
                                          </td>
                                        </tr>
                                        {expandedItems[item.id] && item.sub_assemblies && item.sub_assemblies.length > 0 && (
                                          <tr>
                                            <td colSpan="4" className="px-4 py-2 bg-slate-50/30">
                                              <div className="p-4 bg-white rounded-xl border border-slate-150 my-2 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                  <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                      BOM Production Hierarchy & Material Flow
                                                    </p>
                                                  </div>
                                                  <span className="text-[8px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">
                                                    {item.sub_assemblies?.length || 0} Child Components
                                                  </span>
                                                </div>

                                                <div className="space-y-2 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-indigo-300 before:to-indigo-100 before:border-dashed text-left">
                                                  {/* Parent Item Summary Node */}
                                                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm relative before:absolute before:left-[-22px] before:top-1/2 before:w-4 before:h-[2px] before:bg-indigo-300">
                                                    <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                                                      <Package size={11} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="flex items-center gap-2">
                                                        <p className="text-[10px] font-black text-slate-900">{item.item_code}</p>
                                                        <span className="px-1 py-px bg-purple-50 text-purple-600 text-[7px] font-black rounded border border-purple-100 uppercase tracking-wider">Parent Assembly</span>
                                                      </div>
                                                      <p className="text-[9px] text-slate-400 font-medium truncate">{item.description || item.item_description}</p>
                                                    </div>
                                                    <div className="text-right">
                                                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider">Qty</p>
                                                      <p className="text-[10px] font-black text-slate-900">{Number(item.item_qty || item.quantity || 1).toFixed(0)} NOS</p>
                                                    </div>
                                                  </div>

                                                  {/* Child Node Tree Flow */}
                                                  {(item.sub_assemblies || []).map((sa, sidx) => {
                                                    const isChildSA = String(sa.drawingNo || sa.drawing_no || sa.component_code || "").startsWith('SA-') || sa.item_group === 'SA';
                                                    return (
                                                      <div key={sidx} className="flex flex-col md:flex-row md:items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 transition-all shadow-sm relative before:absolute before:left-[-22px] before:top-1/2 before:w-4 before:h-[2px] before:bg-indigo-300 hover:shadow-indigo-50/50 hover:shadow-md">
                                                        {/* Left Side Info */}
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                          <div className={`w-6 h-6 rounded flex items-center justify-center border shadow-sm ${isChildSA ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                            <Package size={11} />
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                              <p className="text-[10px] font-black text-slate-900">{String(sa.drawingNo || sa.drawing_no || sa.component_code || sa.item_code || '').toUpperCase()}</p>
                                                              <span className={`px-1 py-px text-[7px] font-black rounded uppercase tracking-wider ${isChildSA ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                                {isChildSA ? 'PART' : 'PART'}
                                                              </span>
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 font-medium truncate">{sa.description}</p>
                                                          </div>
                                                        </div>

                                                        {/* Quantity Breakdown Flow */}
                                                        <div className="flex items-center gap-4 text-slate-600 text-[10px] px-2 border-l border-slate-100 md:border-l md:border-r md:px-4">
                                                          <div className="text-center min-w-[50px]">
                                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Required Qty</p>
                                                            <span className="text-[9px] font-black text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{Number(sa.quantity || sa.item_qty || 1).toFixed(0)} <span className="text-[8px] font-medium text-slate-400">{sa.unit || 'NOS'}</span></span>
                                                          </div>
                                                        </div>

                                                        {/* Pricing and Flow Status */}
                                                        <div className="flex items-center justify-between md:justify-end gap-4 min-w-[120px]">
                                                          <div className="text-right">
                                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Rate</p>
                                                            <p className="text-[10px] font-black text-slate-900">₹{Number(sa.rate || sa.bom_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-50 rounded-full">
                        <FileText className="w-8 h-8 text-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-900 font-bold text-[13px]">No quotations found</p>
                        <p className="text-[10px] text-slate-400">Adjust filters or search terms</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, subValue, color }) => {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 group hover:border-rose-100 transition-colors">
      <div className={`p-2.5 rounded-lg border ${colorMap[color] || colorMap.indigo} transition-transform group-hover:scale-105`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <h3 className="text-base font-black text-slate-900 leading-none">{value}</h3>
        <p className="text-[10px] text-slate-500 mt-1 font-medium leading-none">{subValue}</p>
      </div>
    </div>
  );
};

export default ApprovedQuotations;
