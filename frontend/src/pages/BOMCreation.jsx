import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, StatusBadge, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { getFileUrl } from '../utils/url';
import { Eye, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [clientData, setClientData] = useState({}); // { [clientId]: { items: [], loading: false } }
  const [expandedDrawings, setExpandedDrawings] = useState({}); // { drawingKey: boolean }
  const [expandedIncomingRequests, setExpandedIncomingRequests] = useState({}); // { clientName: boolean }
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewDetails, setReviewDetails] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

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

  const fetchIncomingRequests = useCallback(async () => {
    try {
      setIncomingLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/incoming?department=DESIGN_ENG`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch incoming design requests');
      const data = await response.json();
      setIncomingRequests(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIncomingLoading(false);
    }
  }, []);

  const handleApproveItem = async (itemId) => {
    try {
      setBulkOperationLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/items/${itemId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Approved ' })
      });

      if (!response.ok) throw new Error('Failed to approve item');

      successToast('Item approved and moved to Process list');

      // Update local state if in review modal
      setReviewDetails(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'Approved ', item_status: 'Approved ' } : item
      ));

      fetchOrders();
      fetchIncomingRequests();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleRejectItem = async (itemId) => {
    const { value: reason } = await Swal.fire({
      title: 'Reject Design Request',
      input: 'textarea',
      inputLabel: 'Reason for rejection',
      inputPlaceholder: 'Enter reason here...',
      inputAttributes: {
        'aria-label': 'Enter reason here'
      },
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Reject'
    });

    if (reason) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/items/${itemId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'REJECTED', reason: reason })
        });

        if (!response.ok) throw new Error('Failed to reject item');

        successToast('Item marked as rejected');
        
        // Update local state if in review modal
        setReviewDetails(prev => prev.map(item => 
          item.id === itemId ? { 
            ...item, 
            status: 'REJECTED', 
            item_status: 'REJECTED',
            rejection_reason: reason,
            item_rejection_reason: reason
          } : item
        ));

        fetchOrders();
        fetchIncomingRequests();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handlePreview = (item) => {
    setPreviewDrawing(item);
    setShowPreviewModal(true);
  };

  const handleViewOrder = async (order) => {
    try {
      setReviewLoading(true);
      
      // The "order" object here is actually the "req" object from groupedIncomingRequests
      // In DesignOrders.jsx it expects order.id (which is sales_order_id)
      const salesOrderId = order.sales_order_id;
      
      setReviewOrder({
        ...order,
        id: salesOrderId
      });
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${salesOrderId}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order items');
      const items = await response.json();
      
      // Filter items to show only the specific drawing that was clicked
      const filteredItems = items.filter(item => item.drawing_no === order.drawing_no);
      setReviewDetails(filteredItems || []);
      
      setShowReviewModal(true);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleApproveDesign = async (orderId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/approve-design`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      
      if (!response.ok) throw new Error('Failed to approve design');
      
      successToast('Design accepted and moved to Process tab.');
      setShowReviewModal(false);
      setReviewOrder(null);
      setReviewDetails([]);
      fetchOrders();
      fetchIncomingRequests();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleApproveGroup = async (group) => {
    // Get unique sales order IDs from the items in this group
    const orderIds = [...new Set(group.items.map(item => item.id))].filter(id => id);
    if (orderIds.length === 0) return;

    const result = await Swal.fire({
      title: '<span class="text-base font-bold text-slate-800">Approve Group Drawings</span>',
      html: `<span class="text-xs text-slate-600">Are you sure you want to approve all <span class="font-bold text-indigo-600">${orderIds.length}</span> sales order(s) for <span class="font-bold">${group.client_name}</span>?</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Approve All',
      cancelButtonText: 'Cancel',
      width: '380px',
      padding: '1rem',
      customClass: {
        confirmButton: 'text-[11px] font-bold px-4 py-2 rounded shadow-lg shadow-emerald-100 uppercase tracking-wider',
        cancelButton: 'text-[11px] font-bold px-4 py-2 rounded uppercase tracking-wider'
      }
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/approve-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds })
        });

        if (!response.ok) throw new Error('Failed to approve group');

        successToast(`Successfully approved all drawings for ${group.client_name}`);
        fetchOrders();
        fetchIncomingRequests();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

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
    fetchIncomingRequests();
  }, [fetchOrders, fetchIncomingRequests]);

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

  const toggleIncomingRequest = (clientName) => {
    setExpandedIncomingRequests(prev => ({ ...prev, [clientName]: !prev[clientName] }));
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

  const groupedIncomingRequests = useMemo(() => {
    const groups = incomingRequests.reduce((acc, req) => {
      const clientName = req.company_name || 'Unknown Client';
      if (!acc[clientName]) {
        acc[clientName] = {
          client_name: clientName,
          project_name: req.project_name,
          items: []
        };
      }
      acc[clientName].items.push(req);
      return acc;
    }, {});
    return Object.values(groups);
  }, [incomingRequests]);

  const columns = [
    {
      label: 'Client Name',
      key: 'client_name',
      sortable: true,
      className: ' text-slate-900'
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
          className="flex items-center gap-2 p-1.5 bg-emerald-50 text-emerald-600 rounded  text-xs  hover:bg-emerald-100 transition-all border border-emerald-100"
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
          <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded animate-spin" />
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
      <div className="bg-slate-50/50 p-2 rounded border border-slate-100 m-2 space-y-2">
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
            
            // Refined status logic
            let dwgStatus = 'PENDING';
            if (itemsWithBOM.some(i => (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished')))) {
              dwgStatus = 'COMPLETED';
            } else if (dwgItems.length > 0) {
              dwgStatus = 'DESIGN_APPROVED'; // Custom label for UI
            }

            return (
              <div key={dwgKey} className="bg-white border border-slate-100 rounded  shadow-sm overflow-hidden">
                <div 
                  onClick={() => toggleDrawing(dwgKey)}
                  className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded  ${isDwgExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      <svg className={`w-4 h-4 transition-transform duration-300 ${isDwgExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs  text-slate-900">{dwgNo}</span>
                        {dwgStatus === 'DESIGN_APPROVED' ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100">
                            Design Approved
                          </span>
                        ) : (
                          <StatusBadge status={dwgStatus} />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{drawingName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400   ">BOMs</p>
                      <p className="text-xs  text-slate-700">{itemsWithBOM.length}</p>
                    </div>
                    <Link 
                      to={`/bom-form?drawing_no=${encodeURIComponent(dwgNo)}&drawing_id=${drawingId}&drawing_name=${encodeURIComponent(drawingName)}&sales_order_id=${dwgItems[0].sales_order_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`px-4 py-2 rounded text-xs transition-all shadow-sm flex items-center gap-1.5 ${
                        dwgStatus === 'DESIGN_APPROVED' 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                      }`}
                    >
                      {dwgStatus === 'DESIGN_APPROVED' && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      Create BOM
                    </Link>
                  </div>
                </div>

                {isDwgExpanded && (
                  <div className="border-t border-slate-50 bg-slate-50/20 p-2">
                    <div className="overflow-x-auto rounded  border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100 bg-white">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-4 p-2 text-left text-xs  text-slate-400  ">Item Details</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Group</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Qty</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Est. Cost</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Status</th>
                            <th className="px-4 p-2 text-right text-xs  text-slate-400  ">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dwgItems.filter(item => item.has_bom || item.has_master_bom).map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 p-2">
                                <div className="flex flex-col">
                                  <span className="text-xs  text-slate-700">{cleanText(item.description || item.material_name || `Item ${idx + 1}`)}</span>
                                  <span className="text-xs text-slate-400 ">{item.item_code}</span>
                                </div>
                              </td>
                              <td className="px-4 p-2 text-center">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs ">
                                  {item.item_group || '—'}
                                </span>
                              </td>
                              <td className="px-4 p-2 text-center">
                                <span className="text-xs  text-slate-700">
                                  {item.total_quantity || item.quantity} <span className="text-xs text-slate-400 font-normal">{item.unit || 'NOS'}</span>
                                </span>
                              </td>
                              <td className="px-4 p-2 text-center">
                                <span className="text-xs  text-indigo-600">
                                  ₹{parseFloat(item.bom_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="px-4 p-2 text-center">
                                <StatusBadge status={item.status === 'DRAFT' ? 'DRAFT' : ((item.has_bom || item.has_master_bom) ? "FINALIZED" : "PENDING")} />
                              </td>
                              <td className="px-4 p-2">
                                <div className="flex justify-end gap-1">
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
      <div className="p-2 space-y-2">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl  text-slate-900">BOM Creation Center</h1>
            <p className="text-xs text-slate-500 ">Manage and define Bill of Materials for client production orders</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Link 
              to="/bom-form"
              className="flex items-center gap-2 p-2  bg-indigo-600 text-white rounded text-xs  shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New BOM
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Active Clients', value: stats.totalClients, sub: 'In Design Phase', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Drawings', value: stats.totalDrawings, sub: 'Across all Clients', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'bg-indigo-50 text-indigo-600' },
            { label: 'Completion Rate', value: `${stats.completionRate}%`, sub: 'BOMs Finalized', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-emerald-50 text-emerald-600', progress: stats.completionRate },
            { label: 'Est. BOM Value', value: `₹${stats.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'Production Costing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-amber-50 text-amber-600' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-2 rounded border border-slate-100 shadow-sm flex items-center gap-2">
              <div className={`p-2 rounded ${stat.color}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs  text-slate-400   leading-none mb-1">{stat.label}</p>
                <p className="text-xl  text-slate-900 tracking-tight">{stat.value}</p>
                {stat.progress !== undefined && (
                  <div className="mt-2 w-full h-1 bg-slate-50 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded" style={{ width: `${stat.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pending Design Approvals Section */}
        {incomingRequests.length > 0 && (
          <Card className="border-amber-100 bg-amber-50/20 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900">Pending Design Approvals</h3>
                  <p className="text-xs text-amber-600 font-medium">Review incoming requests from sales department</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full border border-amber-300">
                {incomingRequests.length} REQUESTS
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-amber-100">
                <thead className="bg-amber-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-amber-700 uppercase tracking-wider">Client & Project</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-amber-700 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-amber-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white/50">
                  {groupedIncomingRequests.map((group) => (
                    <React.Fragment key={group.client_name}>
                      <tr 
                        onClick={() => toggleIncomingRequest(group.client_name)}
                        className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`p-1 rounded transition-colors ${expandedIncomingRequests[group.client_name] ? 'bg-amber-200 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                              <svg className={`w-4 h-4 transition-transform duration-300 ${expandedIncomingRequests[group.client_name] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{group.client_name}</span>
                              <span className="text-[10px] text-slate-500 font-medium">Design Review - {group.items.length} Drawings for {group.client_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                            Awaiting Approval
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApproveGroup(group); }}
                              disabled={bulkOperationLoading}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-50 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                              Approve Group
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleIncomingRequest(group.client_name); }}
                              className="px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                              {expandedIncomingRequests[group.client_name] ? 'Hide' : 'View Details'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedIncomingRequests[group.client_name] && (
                        <tr className="bg-amber-50/20">
                          <td colSpan="3" className="px-4 py-0">
                            <div className="py-2 px-6 space-y-2">
                              <div className="bg-white/80 border border-amber-100 rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-slate-100">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10">#</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drawing</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                                      <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {group.items.map((req, idx) => (
                                      <tr key={req.item_id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-2 text-xs text-slate-400">{idx + 1}</td>
                                        <td className="px-4 py-2">
                                          <span className="text-xs font-bold text-indigo-600">{req.drawing_no}</span>
                                        </td>
                                        <td className="px-4 py-2">
                                          <span className="text-xs text-slate-600 font-medium italic">{req.item_description || req.material_name || req.description || 'No Description'}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              onClick={() => handleViewOrder(req)}
                                              className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-all border border-indigo-100 flex items-center gap-1 shadow-sm active:scale-95"
                                              title="Review Drawing"
                                            >
                                              <Eye className="w-3 h-3" />
                                              <span className="text-[10px] font-bold">Review</span>
                                            </button>
                                            <button
                                              onClick={() => handleRejectItem(req.item_id)}
                                              disabled={bulkOperationLoading}
                                              className="px-2 py-1 bg-white text-rose-600 border border-rose-100 rounded text-[10px] font-bold hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                              Reject
                                            </button>
                                            <button
                                              onClick={() => handleApproveItem(req.item_id)}
                                              disabled={bulkOperationLoading}
                                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-50 active:scale-95 disabled:opacity-50 flex items-center gap-1"
                                            >
                                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                              </svg>
                                              Approve
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className=" border border-slate-100 rounded  shadow-sm overflow-hidden">
          <div className="p-2">
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

      {showReviewModal && reviewOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded  shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 sticky top-0 flex justify-between items-start">
              <div>
                <h2 className="text-lg  text-white">
                  {reviewDetails.length === 1 ? 'Drawing Review' : 'Design Review'} - {reviewOrder.company_name}
                </h2>
                <p className="text-indigo-100 text-xs mt-1">
                  {reviewDetails.length === 1 ? `Drawing: ${reviewDetails[0].drawing_no}` : `Order: ${reviewOrder.project_name}`}
                </p>
              </div>
              <button 
                onClick={() => setShowReviewModal(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-2 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs  text-slate-600 ">Customer</label>
                  <p className="text-xs  text-slate-900 mt-1">{reviewOrder.company_name}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">PO Number</label>
                  <p className="text-xs  text-slate-900 mt-1">{reviewOrder.po_number || '—'}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">Project</label>
                  <p className="text-xs  text-slate-900 mt-1">{reviewOrder.project_name}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">Sales Order</label>
                  <p className="text-xs  text-slate-900 mt-1">SO-{String(reviewOrder.sales_order_id).padStart(4, '0')}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-xs  text-slate-600  block mb-3">Drawing Details</label>
                {reviewLoading ? (
                  <div className="text-center py-4">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded  animate-spin mx-auto"></div>
                  </div>
                ) : reviewDetails.length > 0 ? (
                  <div className="space-y-3">
                    {reviewDetails.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="grid grid-cols-4 gap-2 text-sm flex-1">
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Drawing No</span>
                                <p className=" text-slate-900 text-xs font-bold text-indigo-600">{item.drawing_no || '—'}</p>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Group</span>
                                <p className=" text-slate-900 text-xs mt-0.5">
                                  {item.item_group ? (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                      {item.item_group}
                                    </span>
                                  ) : '—'}
                                </p>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Revision</span>
                                <p className=" text-slate-900 text-xs font-bold">{item.revision_no || 'A'}</p>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Quantity</span>
                                <p className=" text-slate-900 text-xs font-bold">{item.quantity || 1} {item.unit || 'NOS'}</p>
                              </div>
                            </div>
                          </div>
                          {((item.item_status || item.status) === 'REJECTED') ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold border border-red-200 uppercase tracking-wider">Rejected</span>
                          ) : ((item.item_status || item.status) === 'Approved ') ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200 uppercase tracking-wider">Approved</span>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveItem(item.id)}
                                className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded text-[10px] font-bold border border-emerald-200 transition-all uppercase tracking-wider"
                              >
                                Approve
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-2 font-medium italic">{item.item_description || item.description || 'No description provided'}</p>
                        
                        {item.drawing_pdf && (
                          <div className="mt-4 border rounded  overflow-hidden bg-white">
                            {['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(item.drawing_pdf.toLowerCase().split('.').pop()) ? (
                              <div className="relative group">
                                <img 
                                  src={getFileUrl(item.drawing_pdf)} 
                                  alt="Drawing" 
                                  className="max-w-full h-auto object-contain mx-auto max-h-[400px] cursor-pointer"
                                  onClick={() => handlePreview(item)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-900 px-3 py-1 rounded text-xs font-bold shadow-lg transition-opacity border border-slate-200">
                                    Click to Enlarge
                                  </span>
                                </div>
                              </div>
                            ) : item.drawing_pdf.toLowerCase().endsWith('.pdf') ? (
                              <div className="p-6 flex flex-col items-center justify-center bg-slate-50/50">
                                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center mb-3">
                                  <FileText className="w-6 h-6" />
                                </div>
                                <h4 className="text-xs  text-slate-900 mb-1 font-bold">PDF Drawing Available</h4>
                                <p className="text-[10px] text-slate-500 mb-4 font-medium text-center">This drawing is in PDF format and cannot be previewed directly here.</p>
                                <button 
                                  onClick={() => handlePreview(item)}
                                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-100"
                                >
                                  <Eye className="w-4 h-4" />
                                  Open PDF Preview
                                </button>
                              </div>
                            ) : (
                              <div className="p-6 text-center text-slate-500 text-xs font-medium italic">
                                Preview not available for this file type
                              </div>
                            )}
                          </div>
                        )}

                        {(item.item_status === 'REJECTED' || item.status === 'REJECTED') && (item.item_rejection_reason || item.rejection_reason || item.reason) && (
                          <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                            <p className="text-xs text-red-500 italic leading-snug">
                              <span className="font-bold not-italic mr-1 uppercase text-[10px]">Reason:</span>
                              {item.item_rejection_reason || item.rejection_reason || item.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No drawing details available</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0">
              <button 
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleApproveDesign(reviewOrder.id)}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
                Approve & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && previewDrawing && (
        <DrawingPreviewModal 
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewDrawing(null);
          }}
          drawingData={{
            drawing_no: previewDrawing.drawing_no,
            drawing_pdf: previewDrawing.drawing_pdf
          }}
        />
      )}
    </div>
  );
};

export default BOMCreation;