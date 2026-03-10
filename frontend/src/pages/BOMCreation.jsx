import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, StatusBadge, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState({}); // { [clientId]: { items: [], loading: false } }
  const [expandedDrawings, setExpandedDrawings] = useState({}); // { drawingKey: boolean }
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();

  const filter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('filter');
  }, [location.search]);

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

  useEffect(() => {
    if (filter === 'drafts' && orders.length > 0) {
      const newExpandedDrawings = { ...expandedDrawings };

      orders.forEach(client => {
        const items = clientData[client.id]?.items || [];
        const hasDraft = items.some(i => i.status === 'DRAFT');
        if (hasDraft) {
          const drawings = items.reduce((acc, item) => {
            const dwg = cleanText(item.drawing_no || 'N/A');
            if (!acc[dwg]) acc[dwg] = [];
            acc[dwg].push(item);
            return acc;
          }, {});

          Object.entries(drawings).forEach(([dwgNo, dwgItems]) => {
            if (dwgItems.some(i => i.status === 'DRAFT')) {
              newExpandedDrawings[`${client.id}_${dwgNo}`] = true;
            }
          });
        }
      });

      setExpandedDrawings(newExpandedDrawings);
    }
  }, [filter, orders, clientData]);

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
          (i.has_bom || i.has_master_bom) && (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'))
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

  const columns = [
    {
      label: 'Client Name',
      key: 'client_name',
      sortable: true,
      className: 'font-bold text-slate-900'
    },
    {
      label: 'Total Drawings',
      key: 'total_drawings',
      render: (_, row) => {
        const items = clientData[row.id]?.items || [];
        const drawingsSet = new Set(items.map(i => cleanText(i.drawing_no || 'N/A')));
        return <span className="text-sm text-slate-700">{drawingsSet.size}</span>;
      }
    },
    {
      label: 'FG BOM Cost',
      key: 'fg_bom_cost',
      render: (_, row) => {
        const items = clientData[row.id]?.items || [];
        const fgBomCost = items.reduce((total, i) => {
          const isFG = (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'));
          if (isFG) {
            return total + (parseFloat(i.bom_cost || 0) * (i.quantity || 0));
          }
          return total;
        }, 0);
        return <span className="font-semibold text-slate-900">₹{fgBomCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>;
      }
    },
    {
      label: 'Overall Status',
      key: 'status',
      render: (_, row) => {
        const items = clientData[row.id]?.items || [];
        const drawingsMap = items.reduce((acc, item) => {
          const dwg = cleanText(item.drawing_no || 'N/A');
          if (!acc[dwg]) acc[dwg] = [];
          acc[dwg].push(item);
          return acc;
        }, {});
        
        const drawingsList = Object.values(drawingsMap);
        const allBOMsCompleted = drawingsList.length > 0 && drawingsList.every(dwgItems => 
          dwgItems.some(i => i.has_bom && (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished')))
        );
        return <StatusBadge status={allBOMsCompleted ? 'COMPLETED' : 'IN_PROGRESS'} />;
      }
    },
    {
      label: 'Actions',
      key: 'actions',
      render: (_, row) => (
        <button 
          onClick={(e) => { e.stopPropagation(); handleSendForApproval(row); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          Send for Approval
        </button>
      )
    }
  ];

  const renderClientExpanded = (client) => {
    const items = clientData[client.id]?.items || [];
    const clientLoading = clientData[client.id]?.loading;

    if (clientLoading) {
      return (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      );
    }

    const drawingsMap = items.reduce((acc, item) => {
      const dwg = cleanText(item.drawing_no || 'N/A');
      if (!acc[dwg]) acc[dwg] = [];
      acc[dwg].push(item);
      return acc;
    }, {});

    return (
      <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 m-2 space-y-4">
        {Object.entries(drawingsMap).length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 font-medium">No drawings found for this client.</p>
          </div>
        ) : (
          Object.entries(drawingsMap).map(([dwgNo, dwgItems]) => {
            const dwgKey = `${client.id}_${dwgNo}`;
            const isDwgExpanded = expandedDrawings[dwgKey];
            const drawingName = dwgItems[0].drawing_name || 'No Description';
            const drawingId = dwgItems[0].drawing_id;
            const itemsWithBOM = dwgItems.filter(i => i.has_bom || i.has_master_bom);
            const dwgStatus = itemsWithBOM.some(i => (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'))) ? 'COMPLETED' : 'PENDING';

            return (
              <div key={dwgKey} className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                <div 
                  onClick={() => toggleDrawing(dwgKey)}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isDwgExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <svg className={`w-4 h-4 transition-transform duration-300 ${isDwgExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{dwgNo}</span>
                        <StatusBadge status={dwgStatus} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{drawingName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BOMs</p>
                      <p className="text-xs font-black text-slate-700">{itemsWithBOM.length}</p>
                    </div>
                    <Link 
                      to={`/bom-form?drawing_no=${encodeURIComponent(dwgNo)}&drawing_id=${drawingId}&drawing_name=${encodeURIComponent(drawingName)}&sales_order_id=${dwgItems[0].sales_order_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
                    >
                      Create BOM
                    </Link>
                  </div>
                </div>

                {isDwgExpanded && (
                  <div className="border-t border-slate-50 bg-slate-50/20 p-4">
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100 bg-white">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item Details</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qty</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Cost</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dwgItems.filter(item => item.has_bom || item.has_master_bom).map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700">{cleanText(item.description || item.material_name || `Item ${idx + 1}`)}</span>
                                  <span className="text-[10px] font-medium text-slate-400 uppercase">{item.item_code}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                  {item.item_group || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-bold text-slate-700">
                                  {item.total_quantity || item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit || 'NOS'}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-bold text-indigo-600">
                                  ₹{parseFloat(item.bom_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <StatusBadge status={item.status === 'DRAFT' ? 'DRAFT' : ((item.has_bom || item.has_master_bom) ? "FINALIZED" : "PENDING")} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-1">
                                  <Link to={`/bom-form/${item.id}?view=true`} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="View BOM">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </Link>
                                  <Link to={`/bom-form/${item.id}`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit BOM">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </Link>
                                  <button 
                                    onClick={() => handleDeleteBOM(item.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Delete BOM"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-50/50 min-h-screen pb-12">
      <div className="p-6 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">BOM Creation Center</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and define Bill of Materials for client production orders</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              to="/bom-form"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New BOM
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Clients', value: stats.totalClients, sub: 'In Design Phase', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Drawings', value: stats.totalDrawings, sub: 'Across all Clients', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'bg-indigo-50 text-indigo-600' },
            { label: 'Completion Rate', value: `${stats.completionRate}%`, sub: 'BOMs Finalized', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-emerald-50 text-emerald-600', progress: stats.completionRate },
            { label: 'Est. BOM Value', value: `₹${stats.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'Production Costing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-amber-50 text-amber-600' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${stat.color}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                <p className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                {stat.progress !== undefined && (
                  <div className="mt-2 w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stat.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
          <div className="p-6">
            <DataTable 
              columns={columns}
              data={filteredOrders}
              loading={loading}
              pageSize={5}
              renderExpanded={renderClientExpanded}
              searchPlaceholder="Search by client, drawing, or code..."
              emptyMessage="No active clients found."
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BOMCreation;