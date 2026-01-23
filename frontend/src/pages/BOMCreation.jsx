import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState({}); // { [groupId]: { items: [], loading: false } }
  const [expandedClients, setExpandedClients] = useState({}); // { [groupId]: boolean }
  const [expandedDrawings, setExpandedDrawings] = useState({}); // { drawing_no: boolean }
  
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch design orders');
      const data = await response.json();
      
      const activeOrders = data;
      
      const grouped = activeOrders.reduce((acc, order) => {
        const poKey = order.po_number || (order.customer_po_id ? `PO-${order.customer_po_id}` : 'N/A');
        const companyKey = order.company_name || 'Unknown';
        const key = `${companyKey}_${poKey}`;
        
        if (!acc[key]) {
          acc[key] = {
            id: key, 
            po_number: poKey,
            company_name: companyKey,
            project_name: order.project_name,
            orderIds: [order.sales_order_id],
            statuses: [order.status],
            customer_po_id: order.customer_po_id
          };
        } else {
          if (!acc[key].orderIds.includes(order.sales_order_id)) {
            acc[key].orderIds.push(order.sales_order_id);
          }
          if (!acc[key].statuses.includes(order.status)) {
            acc[key].statuses.push(order.status);
          }
        }
        return acc;
      }, {});

      const groupedArray = Object.values(grouped);
      setOrders(groupedArray);
      
      // Fetch items for ALL groups to support global validation
      for (const group of groupedArray) {
        fetchClientItems(group);
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientItems = async (group) => {
    try {
      setClientData(prev => ({ ...prev, [group.id]: { ...(prev[group.id] || {}), loading: true } }));
      const token = localStorage.getItem('authToken');
      
      const allItems = [];
      for (const orderId of group.orderIds) {
        const response = await fetch(`${API_BASE}/sales-orders/${orderId}/timeline`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const activeItems = (data || []).filter(item => item.status !== 'REJECTED');
          allItems.push(...activeItems);
        }
      }
      setClientData(prev => ({ 
        ...prev, 
        [group.id]: { items: allItems, loading: false } 
      }));

    } catch (err) {
      console.error(err);
      setClientData(prev => ({ ...prev, [group.id]: { ...(prev[group.id] || {}), loading: false } }));
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      fetchOrders();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const toggleClient = (groupId) => {
    setExpandedClients(prev => ({ ...prev, [groupId]: !prev[groupId] }));
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
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/bom/items/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete BOM');

        Swal.fire('Deleted!', 'BOM has been deleted.', 'success');
        fetchOrders();
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const totalDrawingsCount = orders.reduce((acc, group) => {
    const items = clientData[group.id]?.items || [];
    const uniqueDrawings = new Set(items.map(i => i.drawing_no || 'N/A'));
    return acc + uniqueDrawings.size;
  }, 0);

  const totalItems = orders.reduce((acc, group) => acc + (clientData[group.id]?.items || []).length, 0);
  const completedItemsCount = orders.reduce((acc, group) => acc + (clientData[group.id]?.items || []).filter(i => i.has_bom).length, 0);
  const completionPercent = totalItems > 0 ? Math.round((completedItemsCount / totalItems) * 100) : 0;

  const totalPageCost = orders.reduce((acc, group) => {
    const items = clientData[group.id]?.items || [];
    const groupCost = items.reduce((sum, item) => {
      const itemQty = (item.quantity || item.total_quantity || 0);
      return sum + (parseFloat(item.bom_cost || 0) * itemQty);
    }, 0);
    return acc + groupCost;
  }, 0);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            BOM Creation
          </h1>
          <p className="text-xs text-slate-500 ml-11">Define comprehensive Bill of Materials for production</p>
        </div>
        <div className="flex gap-2">
          <Link 
            to="/bom-form"
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 shadow-indigo-100 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add BOM
          </Link>
          <button 
            onClick={fetchOrders} 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Active Clients</div>
          <div className="text-xl font-black text-slate-900">{orders.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Drawings</div>
          <div className="text-xl font-black text-indigo-600">{totalDrawingsCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Overall Completion</div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-black text-emerald-600">{completionPercent}%</div>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${completionPercent}%` }}></div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total BOM Value</div>
          <div className="text-xl font-black text-indigo-600">₹{totalPageCost.toFixed(2)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {loading && orders.length === 0 ? (
          <div className="p-20 text-center text-slate-400">Loading clients...</div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center text-slate-400 flex flex-col items-center shadow-sm">
             <p className="font-semibold text-lg text-slate-600">No Orders in Design Phase</p>
          </div>
        ) : (
          orders.map(group => {
            const isExpanded = expandedClients[group.id];
            const items = clientData[group.id]?.items || [];
            const clientLoading = clientData[group.id]?.loading;

            const drawingGroups = items.reduce((acc, item) => {
              const dwgNo = item.drawing_no || 'N/A';
              const dwgId = item.drawing_id || 'no-id';
              const key = dwgNo === 'N/A' ? `${dwgId}_${dwgNo}` : dwgNo; 
              
              if (!acc[key]) acc[key] = [];
              
              // Find existing item with same item_code in this drawing group
              let existing = acc[key].find(i => i.item_code === item.item_code);
              
              if (existing) {
                // If we found a duplicate, aggregate the status
                // If ANY item has a BOM, the whole group (for this drawing/item_code) should show as completed
                if (item.has_bom) {
                  existing.has_bom = true;
                  existing.bom_cost = item.bom_cost; // Update with the cost from the created BOM
                  existing.id = item.id; // Link to the one that actually has the BOM
                }
                existing.total_quantity = (existing.total_quantity || existing.quantity || 0) + (item.quantity || 0);
              } else {
                acc[key].push({ ...item, total_quantity: item.quantity });
              }
              return acc;
            }, {});

            const totalDrawings = Object.keys(drawingGroups).length;
            const completedDrawings = Object.values(drawingGroups).filter(items => items.every(i => i.has_bom)).length;

            const poTotalCost = items.reduce((sum, item) => {
              const itemQty = (item.quantity || item.total_quantity || 0);
              return sum + (parseFloat(item.bom_cost || 0) * itemQty);
            }, 0);

            return (
              <Card key={group.id} className="border-slate-200 shadow-sm overflow-hidden mb-4">
                <div 
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-all flex items-center justify-between ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : ''}`}
                  onClick={() => toggleClient(group.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-slate-400">
                      {isExpanded ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
                        Client: {group.company_name}
                        <span className="text-xs font-normal text-slate-400">| PO: {group.po_number}</span>
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {poTotalCost > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Est. Cost</p>
                        <p className="text-xs font-bold text-indigo-600">₹{poTotalCost.toFixed(2)}</p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drawing Coverage</p>
                      <p className="text-xs font-bold text-slate-700">{completedDrawings} / {totalDrawings} Drawings</p>
                    </div>
                    <StatusBadge status={completedDrawings === totalDrawings && totalDrawings > 0 ? 'COMPLETED' : 'IN_PROGRESS'} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-white space-y-4">
                    {clientLoading ? (
                      <div className="p-8 text-center text-slate-400">Loading drawings...</div>
                    ) : Object.entries(drawingGroups).map(([key, drawingItems]) => {
                      const dwg = drawingItems[0].drawing_no || 'N/A';
                      const dwgKey = `${group.id}_${key}`;
                      const isDwgExpanded = expandedDrawings[dwgKey];
                      
                      const completedItems = drawingItems.filter(i => i.has_bom);
                      const pendingItems = drawingItems.filter(i => !i.has_bom);
                      
                      const fgItem = drawingItems.find(i => (i.item_group || i.material_type || '').toLowerCase().includes('fg') || (i.item_group || i.material_type || '').toLowerCase().includes('finished')) || drawingItems[0];
                      const isDwgCompleted = drawingItems.every(i => i.has_bom);

                      const totalDwgCost = drawingItems.reduce((sum, item) => {
                        const itemQty = (item.quantity || item.total_quantity || 0);
                        return sum + (parseFloat(item.bom_cost || 0) * itemQty);
                      }, 0);

                      return (
                        <div key={dwg} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-slate-50/30">
                          <div 
                            className={`p-4 cursor-pointer hover:bg-slate-100/50 transition-all flex items-center justify-between ${isDwgExpanded ? 'bg-slate-100/50 border-b border-slate-200' : ''}`}
                            onClick={() => toggleDrawing(dwgKey)}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="text-slate-400">
                                {isDwgExpanded ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="grid grid-cols-3 flex-1 gap-4">
                                <div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drawing No</div>
                                  <div className="text-sm font-bold text-indigo-600">DWG: {dwg}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Description</div>
                                  <div className="text-sm font-medium text-slate-700 truncate max-w-xs">{fgItem.description}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Order Qty</div>
                                  <div className="text-sm font-bold text-slate-900">{(fgItem.quantity || fgItem.total_quantity || 0)} {fgItem.unit}</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                               {isDwgCompleted ? (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">ALL COMPLETED</span>
                              ) : (
                                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">IN PROGRESS</span>
                              )}
                            </div>
                          </div>

                          {isDwgExpanded && (
                            <div className="p-4 space-y-6">
                              <div className="flex gap-8 mb-4 px-2 bg-slate-100/50 p-3 rounded-xl border border-slate-100">
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BOMs Created :</span>
                                  <span className="ml-2 text-xs font-bold text-slate-700">{completedItems.length}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Items :</span>
                                  <span className="ml-2 text-xs font-bold text-slate-700">{pendingItems.length}</span>
                                </div>
                                {totalDwgCost > 0 && (
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Drawing Value :</span>
                                    <span className="ml-2 text-sm font-black text-indigo-600">₹{totalDwgCost.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col gap-6">
                                {/* Created BOMs Section */}
                                {completedItems.length > 0 && (
                                  <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Created BOMs</h3>
                                    <div className="flex flex-col gap-3">
                                      {completedItems.map(item => (
                                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-200 transition-all">
                                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs font-bold text-slate-900">{item.item_code}</span>
                                                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold uppercase">
                                                    {item.item_group || item.material_type || 'Assembly'}
                                                  </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-8">
                                              <div className="text-right pr-8 border-r border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">BOM Cost</p>
                                                <p className="text-sm font-black text-indigo-600">₹{parseFloat(item.bom_cost || 0).toFixed(2)}</p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Assembly</p>
                                                <p className="text-xs font-bold text-emerald-600">COMPLETED</p>
                                              </div>
                                              <div className="text-right border-l border-slate-100 pl-8">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Finished Good</p>
                                                <p className="text-xs font-bold text-emerald-600">COMPLETED</p>
                                              </div>
                                              <div className="flex gap-2 ml-4">
                                                <Link 
                                                  to={`/bom-form/${item.id}`}
                                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                  title="Edit BOM"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                  </svg>
                                                </Link>
                                                <button 
                                                  onClick={() => handleDeleteBOM(item.id)}
                                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                  title="Delete BOM"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Pending Items Section */}
                                {pendingItems.length > 0 && (
                                  <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Pending BOM Creation</h3>
                                    <div className="flex flex-col gap-3">
                                      {pendingItems.map(item => (
                                        <div key={item.id} className="bg-white border border-slate-200 border-dashed rounded-xl p-4 shadow-sm hover:border-amber-300 transition-all flex justify-between items-center">
                                          <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-900">{item.item_code}</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-bold uppercase">
                                                  {item.item_group || 'Assembly'}
                                                </span>
                                              </div>
                                              <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-8">
                                            <div className="text-right">
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Assembly</p>
                                              <p className="text-xs font-bold text-amber-600">PENDING</p>
                                            </div>
                                            <div className="text-right border-l border-slate-100 pl-8">
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Finished Good</p>
                                              <p className="text-xs font-bold text-amber-600 uppercase">Pending</p>
                                            </div>
                                            <div className="ml-4">
                                              <Link 
                                                to={`/bom-form/${item.id}`}
                                                className="px-6 py-2 bg-white border border-indigo-600 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                              >
                                                + Create BOM
                                              </Link>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BOMCreation;
