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

  const totalDrawingsCount = orders.reduce((acc, group) => {
    const items = clientData[group.id]?.items || [];
    const uniqueDrawings = new Set(items.map(i => i.drawing_no || 'N/A'));
    return acc + (uniqueDrawings.has('N/A') && items.filter(i => !i.drawing_no).length === 0 ? uniqueDrawings.size - 1 : uniqueDrawings.size);
  }, 0);

  const readyPOsCount = orders.filter(group => {
    const items = clientData[group.id]?.items || [];
    return items.length > 0 && items.every(item => item.has_bom);
  }).length;

  const totalItems = orders.reduce((acc, group) => acc + (clientData[group.id]?.items || []).length, 0);
  const completedItems = orders.reduce((acc, group) => acc + (clientData[group.id]?.items || []).filter(i => i.has_bom).length, 0);
  const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

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
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ready for Submission</div>
          <div className="text-xl font-black text-indigo-600">{readyPOsCount} POs</div>
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
              const dwg = item.drawing_no || 'N/A';
              if (!acc[dwg]) acc[dwg] = [];
              acc[dwg].push(item);
              return acc;
            }, {});

            const totalDrawings = Object.keys(drawingGroups).length;
            const completedDrawings = Object.values(drawingGroups).filter(items => items.every(i => i.has_bom)).length;

            return (
              <Card key={group.id} className="border-slate-200 shadow-sm overflow-hidden mb-4">
                {/* Level 1: Client Accordion Header */}
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
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drawing Coverage</p>
                      <p className="text-xs font-bold text-slate-700">{completedDrawings} / {totalDrawings} Drawings</p>
                    </div>
                    <StatusBadge status={completedDrawings === totalDrawings && totalDrawings > 0 ? 'COMPLETED' : 'IN_PROGRESS'} />
                  </div>
                </div>

                {/* Level 1 Body: Drawing List */}
                {isExpanded && (
                  <div className="p-4 bg-white space-y-4">
                    {clientLoading ? (
                      <div className="p-8 text-center text-slate-400">Loading drawings...</div>
                    ) : Object.entries(drawingGroups).map(([dwg, drawingItems]) => {
                      const dwgKey = `${group.id}_${dwg}`;
                      const isDwgExpanded = expandedDrawings[dwgKey];
                      const fgItem = drawingItems.find(i => (i.material_type || '').toLowerCase().includes('finished')) || drawingItems[0];
                      const subAssemblies = drawingItems.filter(i => !(i.material_type || '').toLowerCase().includes('finished'));
                      const fgBOMs = drawingItems.filter(i => (i.material_type || '').toLowerCase().includes('finished'));
                      const isDwgCompleted = drawingItems.every(i => i.has_bom);

                      return (
                        <div key={dwg} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-slate-50/30">
                          {/* Level 2: Drawing Accordion Header */}
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
                                  <div className="text-sm font-bold text-slate-900">{fgItem.quantity} {fgItem.unit}</div>
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

                          {/* Level 2 Body: BOM Details */}
                          {isDwgExpanded && (
                            <div className="p-4">
                              {/* Summary info inside drawing */}
                              <div className="flex gap-8 mb-4 px-2">
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sub-Assemblies :</span>
                                  <span className="ml-2 text-xs font-bold text-slate-700">{subAssemblies.length}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Final FG BOM :</span>
                                  <span className="ml-2 text-xs font-bold text-slate-700">{fgBOMs.length}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Overall Status :</span>
                                  <span className={`ml-2 text-xs font-bold ${isDwgCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {isDwgCompleted ? 'ALL COMPLETED' : 'PENDING'}
                                  </span>
                                </div>
                              </div>

                              {/* BOM Details Table */}
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="min-w-full divide-y divide-slate-200">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">BOM Type</th>
                                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item Code</th>
                                      <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item Name</th>
                                      <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost / Unit</th>
                                      <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Cost</th>
                                      <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {subAssemblies.length > 0 && (
                                      <>
                                        <tr className="bg-slate-50/30">
                                          <td colSpan="7" className="px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub-Assemblies</td>
                                        </tr>
                                        {subAssemblies.map(item => (
                                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-[11px] font-medium text-slate-500 uppercase">Sub-Assembly</td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-indigo-600">{item.item_code}</td>
                                            <td className="px-6 py-4 text-[11px] text-slate-700 font-medium">{item.description}</td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-slate-900 text-right">₹{parseFloat(item.bom_cost || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-indigo-600 text-right">₹{parseFloat(item.bom_cost || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center">
                                              {item.has_bom ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">Done</span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600">Pending</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </>
                                    )}
                                    {fgBOMs.length > 0 && (
                                      <>
                                        <tr className="bg-slate-50/30 border-t border-slate-100">
                                          <td colSpan="6" className="px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Final FG</td>
                                        </tr>
                                        {fgBOMs.map(item => (
                                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-[11px] font-medium text-slate-500 uppercase">Final FG</td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-indigo-600">{item.item_code}</td>
                                            <td className="px-6 py-4 text-[11px] text-slate-700 font-medium">{item.description}</td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-slate-900 text-right">₹{parseFloat(item.bom_cost || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-[11px] font-bold text-indigo-600 text-right">₹{(parseFloat(item.bom_cost || 0) * parseFloat(fgItem.quantity)).toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center">
                                              {item.has_bom ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">Done</span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600">Pending</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </>
                                    )}
                                  </tbody>
                                </table>
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
