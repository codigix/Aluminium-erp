import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState({}); // { [clientId]: { items: [], loading: false } }
  const [expandedClients, setExpandedClients] = useState({}); // { [clientId]: boolean }
  const [expandedDrawings, setExpandedDrawings] = useState({}); // { drawingKey: boolean }
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClientDrawings = useCallback(async (client) => {
    try {
      setClientData(prev => ({ ...prev, [client.id]: { ...(prev[client.id] || {}), loading: true } }));
      const token = localStorage.getItem('authToken');
      
      const allTimelineItems = [];
      const seenItemIds = new Set();
      const salesOrderIds = [...new Set(client.items.map(i => i.sales_order_id))];

      for (const soId of salesOrderIds) {
        const response = await fetch(`${API_BASE}/sales-orders/${soId}/timeline`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          (data || []).forEach(mi => {
            if (!seenItemIds.has(mi.id) && mi.status !== 'REJECTED') {
              allTimelineItems.push(mi);
              seenItemIds.add(mi.id);
            }
          });
        }
      }

      setClientData(prev => ({ 
        ...prev, 
        [client.id]: { items: allTimelineItems, loading: false } 
      }));
    } catch (err) {
      console.error(err);
      setClientData(prev => ({ ...prev, [client.id]: { ...(prev[client.id] || {}), loading: false } }));
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch design orders');
      const data = await response.json();
      
      const clientGroups = data.reduce((acc, item) => {
        const clientName = item.company_name || 'Unknown Client';
        if (!acc[clientName]) {
          acc[clientName] = {
            id: clientName,
            client_name: clientName,
            items: []
          };
        }
        acc[clientName].items.push(item);
        return acc;
      }, {});

      const groupedArray = Object.values(clientGroups).sort((a, b) => (a.client_name || '').localeCompare(b.client_name || ''));
      setOrders(groupedArray);
      
      for (const client of groupedArray) {
        fetchClientDrawings(client);
      }
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [fetchClientDrawings]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleClient = (clientId) => {
    setExpandedClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const toggleDrawing = (dwgKey) => {
    setExpandedDrawings(prev => ({ ...prev, [dwgKey]: !prev[dwgKey] }));
  };

  const handleDeleteBOM = async (itemId) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You want to delete this BOM? This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/bom/items/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete BOM');
        successToast('BOM has been deleted.');
        fetchOrders();
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleSendForApproval = async (client) => {
    try {
      const items = clientData[client.id]?.items || [];
      const salesOrderIds = [...new Set(items.map(i => i.sales_order_id))].filter(id => id);

      if (salesOrderIds.length === 0) {
        errorToast("No sales orders found for this client.");
        return;
      }

      const result = await Swal.fire({
        title: 'Send for Approval?',
        text: `Are you sure you want to send BOMs for ${client.client_name} for approval?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Send'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        
        const promises = salesOrderIds.map(soId => 
          fetch(`${API_BASE}/sales-orders/${soId}/status`, {
            method: 'PATCH',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'BOM_SUBMITTED' })
          })
        );

        const responses = await Promise.all(promises);
        const failed = responses.filter(r => !r.ok);

        if (failed.length > 0) {
          throw new Error(`Failed to send ${failed.length} order(s) for approval.`);
        }

        successToast('BOMs sent for approval successfully.');
        fetchOrders();
      }
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    let totalDrawings = 0;
    let completedDrawings = 0;
    let totalCost = 0;

    orders.forEach(client => {
      const items = clientData[client.id]?.items || [];
      const drawingsMap = {};
      
      items.forEach(i => {
        const dwgNo = cleanText(i.drawing_no || 'N/A');
        if (!drawingsMap[dwgNo]) drawingsMap[dwgNo] = [];
        drawingsMap[dwgNo].push(i);
        
        // Only include Finished Goods (FG) in the estimated total value
        const isFG = (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'));
        if (isFG) {
          totalCost += (parseFloat(i.bom_cost || 0) * (i.quantity || 0));
        }
      });

      const drawings = Object.keys(drawingsMap);
      totalDrawings += drawings.length;
      
      drawings.forEach(dwgNo => {
        const dwgItems = drawingsMap[dwgNo];
        const hasFGBOM = dwgItems.some(i => 
          i.has_bom && (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'))
        );
        if (hasFGBOM) completedDrawings++;
      });
    });

    return {
      totalClients: orders.length,
      totalDrawings,
      completionRate: totalDrawings > 0 ? Math.round((completedDrawings / totalDrawings) * 100) : 0,
      totalCost
    };
  }, [orders, clientData]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o => {
      const matchClient = o.client_name.toLowerCase().includes(term);
      if (matchClient) return true;

      const items = clientData[o.id]?.items || [];
      return items.some(i => 
        (i.drawing_no || '').toLowerCase().includes(term) ||
        (i.item_code || '').toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, clientData]);

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      <div className=" mx-auto ">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl  text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded  text-white shadow-lg shadow-indigo-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              BOM Creation Center
            </h1>
            <p className="text-sm text-slate-500 mt-1 ">Manage and define Bill of Materials for client production orders</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <input 
                type="text"
                placeholder="Search Client..."
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64 transition-all "
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button 
              onClick={fetchOrders}
              className="p-2.5 bg-white border border-slate-200 rounded  text-slate-600 hover:bg-slate-50 transition-all  group"
              title="Refresh Data"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <Link 
              to="/bom-form"
              className="flex items-center gap-2  px-5 py-2.5 bg-indigo-600 text-white rounded  text-sm  shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New BOM
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Clients', value: stats.totalClients, sub: 'In Design Phase', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'blue' },
            { label: 'Total Drawings', value: stats.totalDrawings, sub: 'Across all Clients', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'indigo' },
            { label: 'Completion Rate', value: `${stats.completionRate}%`, sub: 'BOMs Finalized', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'emerald', progress: stats.completionRate },
            { label: 'Est. BOM Value', value: `₹${stats.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'Production Costing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'amber' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded  border border-slate-200 ">
              <div className='flex justify-between items-start'>
                <div>
                  <div className="text-1xl  text-slate-900 leading-none">{stat.value}</div>
                  <div className="text-xs  text-slate-500 mt-1">{stat.label}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{stat.sub}</div>
                </div>
                <div className={`p-2 rounded  bg-${stat.color}-50 text-${stat.color}-600`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                  </svg>
                </div>
              </div>
              {stat.progress !== undefined && (
                <div className="mt-4">
                  <div className="w-full h-1.5 bg-slate-100 rounded  overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded " style={{ width: `${stat.progress}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main Table Content */}
        <div className="bg-white rounded  border border-slate-200  overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left text-xs  text-slate-500 ">Client Name</th>
                  <th className="p-2 text-left text-xs  text-slate-500 ">Total Drawings</th>
                  <th className="p-2 text-left text-xs  text-slate-500 ">FG BOM Cost (Amount)</th>
                  <th className="p-2 text-left text-xs  text-slate-500 ">Overall Status</th>
                  <th className="p-2 text-left text-xs  text-slate-500 ">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-24 text-center">
                      <div className="flex flex-col items-center">
                        <div className="p-4 bg-slate-50 rounded  mb-4">
                          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <h3 className="text-lg  text-slate-900">No active clients found</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Try adjusting your search or refresh to see newly added orders.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(client => {
                    const isExpanded = expandedClients[client.id];
                    const items = clientData[client.id]?.items || [];
                    const clientLoading = clientData[client.id]?.loading;

                    const drawingsSet = new Set(items.map(i => cleanText(i.drawing_no || 'N/A')));
                    const totalDrawingsCount = drawingsSet.size;
                    
                    const fgBomCost = items.reduce((total, i) => {
                      const isFG = (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'));
                      if (isFG) {
                        return total + (parseFloat(i.bom_cost || 0) * (i.quantity || 0));
                      }
                      return total;
                    }, 0);

                    const drawingsMapForStatus = items.reduce((acc, item) => {
                      const dwg = cleanText(item.drawing_no || 'N/A');
                      if (!acc[dwg]) acc[dwg] = [];
                      acc[dwg].push(item);
                      return acc;
                    }, {});
                    
                    const drawingsListForStatus = Object.values(drawingsMapForStatus);
                    const allBOMsCompleted = drawingsListForStatus.length > 0 && drawingsListForStatus.every(dwgItems => 
                      dwgItems.some(i => i.has_bom && (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished')))
                    );

                    return (
                      <React.Fragment key={client.id}>
                        <tr 
                          onClick={() => toggleClient(client.id)}
                          className={`group transition-all cursor-pointer ${isExpanded ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <td className="p-2">
                            <div className="flex items-center gap-4">
                              <button className={`p-1 rounded text-indigo-600 transition-colors ${isExpanded ? 'bg-indigo-100' : 'hover:bg-slate-100'}`}>
                                <svg className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">{client.client_name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-left">
                            <span className="text-sm text-slate-900 ">{totalDrawingsCount}</span>
                          </td>
                          <td className="p-2 text-left">
                            <span className="text-sm font-medium text-slate-900">
                              ₹{fgBomCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-2 text-left">
                            <StatusBadge status={allBOMsCompleted ? 'COMPLETED' : 'IN_PROGRESS'} />
                          </td>
                          <td className="p-2 text-left">
                            <div className="flex items-center gap-2 ">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleClient(client.id); }}
                                className="p-2 .5 text-xs  text-indigo-600 bg-indigo-50 border border-indigo-100 rounded  hover:bg-indigo-100 transition-all"
                              >
                                {isExpanded ? 'Hide Drawings' : 'View Drawings'}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSendForApproval(client); }}
                                className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-all flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                BOM Approval
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="5" className="p-2 bg-slate-50/50">
                              <div className="space-y-4">
                                {clientLoading ? (
                                  <div className="py-8 text-center text-slate-400 animate-pulse ">Loading drawings...</div>
                                ) : items.length === 0 ? (
                                  <div className="py-10 text-center bg-white rounded  border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-500 ">No drawings found for this client.</p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 gap-4">
                                    {Object.entries(items.reduce((acc, item) => {
                                      const dwg = cleanText(item.drawing_no || 'N/A');
                                      if (!acc[dwg]) acc[dwg] = [];
                                      acc[dwg].push(item);
                                      return acc;
                                    }, {})).map(([dwgNo, dwgItems]) => {
                                      const dwgKey = `${client.id}_${dwgNo}`;
                                      const isDwgExpanded = expandedDrawings[dwgKey];
                                      
                                      // Drawing status is COMPLETED if at least one FG item has a BOM
                                      const itemsWithBOM = dwgItems.filter(i => i.has_bom);
                                      const hasFGBOM = dwgItems.some(i => 
                                        i.has_bom && (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'))
                                      );
                                      const dwgStatus = hasFGBOM ? 'COMPLETED' : 'PENDING';
                                      
                                      const rawDwgId = dwgItems[0].drawing_id;
                                      const drawingId = (rawDwgId && String(rawDwgId).trim().toUpperCase() !== 'N/A') ? rawDwgId : '';
                                      const drawingName = cleanText(dwgItems[0].drawing_name || dwgItems[0].description || dwgItems[0].material_name || '');

                                      return (
                                        <div key={dwgKey} className="bg-white rounded  border border-slate-200  overflow-hidden transition-all hover:border-indigo-200">
                                          {/* Drawing Header */}
                                          <div 
                                            onClick={() => toggleDrawing(dwgKey)}
                                            className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                          >
                                            <div className="flex items-center gap-4">
                                              <div className={`p-2 rounded  ${isDwgExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                <svg className={`w-5 h-5 transition-transform duration-300 ${isDwgExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                </svg>
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2 ">
                                                  <span className="text-sm  text-slate-900">{dwgNo}</span>
                                                  <StatusBadge status={dwgStatus} />
                                                </div>
                                                <p className="text-xs text-slate-500  mt-0.5">{drawingName}</p>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                              <div className="text-right mr-4 hidden sm:block">
                                                <p className="text-[10px] text-slate-400   ">BOMs</p>
                                                <p className="text-sm  text-slate-700">{itemsWithBOM.length}</p>
                                              </div>
                                              <Link 
                                                to={`/bom-form?drawing_no=${encodeURIComponent(dwgNo)}&drawing_id=${drawingId}&drawing_name=${encodeURIComponent(drawingName)}&sales_order_id=${dwgItems[0].sales_order_id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2  bg-indigo-600 text-white rounded  text-xs   hover:bg-indigo-700 transition-all   whitespace-nowrap"
                                              >
                                                Create BOM
                                              </Link>
                                            </div>
                                          </div>

                                          {/* BOM Items List (Expanded) */}
                                          {isDwgExpanded && (
                                            <div className="border-t border-slate-100 bg-slate-50/30">
                                              {dwgItems.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                  <table className="min-w-full divide-y divide-slate-100">
                                                    <thead className="bg-slate-50/50">
                                                      <tr>
                                                        <th className="p-2 text-left text-xs   text-slate-400  ">Item Details</th>
                                                        <th className="p-2 text-center text-xs   text-slate-400  ">Group</th>
                                                        <th className="p-2 text-center text-xs   text-slate-400  ">Qty</th>
                                                        <th className="p-2 text-center text-xs   text-slate-400  ">Est. Cost</th>
                                                        <th className="p-2 text-center text-xs   text-slate-400  ">Status</th>
                                                        <th className="p-2 text-right text-xs   text-slate-400  ">Actions</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                      {dwgItems.filter(item => item.has_bom).map((item, idx) => (
                                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                          <td className="p-2 ">
                                                            <div className="flex flex-col">
                                                              <span className="text-xs  text-slate-700">{cleanText(item.description || item.material_name || `Item ${idx + 1}`)}</span>
                                                              <span className="text-[10px] text-slate-400 ">{item.item_code}</span>
                                                            </div>
                                                          </td>
                                                          <td className="p-2 text-center">
                                                            <span className="text-[10px] p-1  bg-slate-100 text-slate-600 rounded  ">
                                                              {item.item_group || '—'}
                                                            </span>
                                                          </td>
                                                          <td className="p-2 text-center">
                                                            <span className="text-xs  text-slate-700">
                                                              {item.total_quantity || item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit || 'NOS'}</span>
                                                            </span>
                                                          </td>
                                                          <td className="p-2 text-center">
                                                            <span className="text-xs  text-slate-900">
                                                              ₹{parseFloat(item.bom_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </span>
                                                          </td>
                                                          <td className="p-2 text-center">
                                                            <StatusBadge status={item.has_bom ? "FINALIZED" : "PENDING"} />
                                                          </td>
                                                          <td className="p-2 ">
                                                            <div className="flex justify-center gap-2">
                                                              {item.has_bom ? (
                                                                <>
                                                                  <Link to={`/bom-form/${item.id}?view=true`} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all" title="View BOM">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                    </svg>
                                                                  </Link>
                                                                  <Link to={`/bom-form/${item.id}`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded  transition-all" title="Edit BOM">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                  </Link>
                                                                  <button 
                                                                    onClick={() => handleDeleteBOM(item.id)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded  transition-all"
                                                                    title="Delete BOM"
                                                                  >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                  </button>
                                                                </>
                                                              ) : (
                                                                <Link 
                                                                  to={`/bom-form?item_id=${item.id}&drawing_no=${encodeURIComponent(dwgNo)}&drawing_id=${drawingId}`}
                                                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded  transition-all" 
                                                                  title="Create BOM for this Item"
                                                                >
                                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                                  </svg>
                                                                </Link>
                                                              )}
                                                            </div>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <div className="py-6 text-center">
                                                  <p className="text-xs text-slate-400 ">No items available for this drawing.</p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BOMCreation;

