import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, StatusBadge, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye, FileText, RotateCw, Clock, History, Check, X, ExternalLink, Trash2, Edit2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  });
};

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState({}); // { [clientId]: { items: [], loading: false } }
  const [expandedDrawings, setExpandedDrawings] = useState({}); // { drawingKey: boolean }
  const [expandedBOMGroups, setExpandedBOMGroups] = useState(new Set());
  const location = useLocation();

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  // BOM Details Modal State
  const [showBOMDetails, setShowBOMDetails] = useState(false);
  const [selectedBOMOrder, setSelectedBOMOrder] = useState(null);
  const [bomOrderItems, setBomOrderItems] = useState([]);
  const [bomDetailsLoading, setBomDetailsLoading] = useState(false);
  const [expandedBOMItems, setExpandedBOMItems] = useState(new Set());

  const toggleBOMItem = (itemId) => {
    const newExpanded = new Set(expandedBOMItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedBOMItems(newExpanded);
  };

  const handleViewBOMDetails = async (client) => {
    try {
      // Find the first sales order ID from the client's items to fetch details
      // Note: The BOM Approval modal usually shows details for a specific Sales Order.
      // Since this table is grouped by Client, we'll need to handle it.
      const items = clientData[client.id]?.items || [];
      const salesOrderIds = [...new Set(items.map(i => i.sales_order_id))].filter(id => id);

      if (salesOrderIds.length === 0) {
        errorToast("No sales orders found for this client.");
        return;
      }

      // Use the first sales order ID for the summary, similar to BOMApproval
      const mainOrderId = salesOrderIds[0];
      const mainItem = items.find(i => i.sales_order_id === mainOrderId);

      setSelectedBOMOrder({
        id: mainOrderId,
        company_name: client.client_name,
        project_name: mainItem?.project_name || "N/A",
        po_number: mainItem?.po_number || `SO-${mainOrderId}`
      });

      setShowBOMDetails(true);
      setBomDetailsLoading(true);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${mainOrderId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch BOM details');
      const data = await response.json();
      setBomOrderItems(data);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load BOM details');
    } finally {
      setBomDetailsLoading(false);
    }
  };

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

  const handlePreviewByNo = async (drawingNo) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      // First try to find by search
      const response = await fetch(`${API_BASE}/drawings?search=${encodeURIComponent(drawingNo)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch drawing details');
      const data = await response.json();

      let drawing = null;
      if (data && data.length > 0) {
        drawing = data.find(d => d.drawing_no === drawingNo) || data[0];
      }

      if (drawing) {
        // If we found a drawing, try to fetch its full details including client info
        // The /drawings/:id endpoint usually returns more complete data
        try {
          const detailRes = await fetch(`${API_BASE}/drawings/${drawing.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            drawing = { ...drawing, ...detailData };
          }
        } catch (e) {
          console.warn("Could not fetch extra drawing details", e);
        }

        setPreviewDrawing(drawing);
        setShowPreviewModal(true);
      } else {
        errorToast('Drawing not found');
      }
    } catch (error) {
      console.error(error);
      errorToast('Failed to load drawing preview');
    } finally {
      setLoading(false);
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
  }, [filter, orders, clientData, expandedDrawings]);

  const toggleDrawing = (dwgKey) => {
    setExpandedDrawings(prev => ({ ...prev, [dwgKey]: !prev[dwgKey] }));
  };

  const toggleBOMGroup = (groupId) => {
    const newExpanded = new Set(expandedBOMGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedBOMGroups(newExpanded);
  };

  const handleDeleteBOM = async (itemId) => {
    try {
      const result = await Swal.fire({
        title: '<span class="text-base  text-slate-800">Delete BOM?</span>',
        html: '<span class="text-xs text-slate-600">Are you sure you want to delete this BOM? This action <span class=" text-rose-600">cannot be undone</span>.</span>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        width: '380px',
        padding: '1rem',
        customClass: {
          confirmButton: 'text-[11px]  p-2 rounded shadow-lg shadow-rose-100  ',
          cancelButton: 'text-[11px]  p-2 rounded  '
        }
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

        // If modal is open and showing this order, refresh its items
        if (showBOMDetails && selectedBOMOrder) {
          handleViewBOMDetails(selectedBOMOrder);
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDeleteAllClientBOMs = async (client) => {
    try {
      const items = clientData[client.id]?.items || [];
      const itemsWithBOM = items.filter(i => i.has_bom || i.has_master_bom);

      if (itemsWithBOM.length === 0) {
        errorToast("No BOMs found to delete for this client.");
        return;
      }

      const result = await Swal.fire({
        title: '<span class="text-base  text-slate-800">Delete All Client BOMs?</span>',
        html: `<span class="text-xs text-slate-600">Are you sure you want to delete <span class=" ">${itemsWithBOM.length}</span> BOMs for <span class=" text-indigo-600">${client.client_name}</span>? This action <span class=" text-rose-600">cannot be undone</span>.</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete All',
        cancelButtonText: 'Cancel',
        width: '380px',
        padding: '1rem',
        customClass: {
          confirmButton: 'text-[11px]  p-2 rounded shadow-lg shadow-rose-100  ',
          cancelButton: 'text-[11px]  p-2 rounded  '
        }
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');

        const promises = itemsWithBOM.map(item =>
          fetch(`${API_BASE}/bom/items/${item.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );

        const responses = await Promise.all(promises);
        const failed = responses.filter(r => !r.ok);

        if (failed.length > 0) {
          throw new Error(`Failed to delete ${failed.length} BOM(s).`);
        }

        successToast('All client BOMs have been deleted.');
        fetchOrders();
      }
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDrawingBOMs = async (drawingNo, drawingItems, clientName) => {
    try {
      const itemsWithBOM = drawingItems.filter(i => i.has_bom || i.has_master_bom);

      if (itemsWithBOM.length === 0) {
        errorToast("No BOMs found to delete for this drawing.");
        return;
      }

      const result = await Swal.fire({
        title: '<span class="text-base  text-slate-800">Delete Drawing BOMs?</span>',
        html: `<span class="text-xs text-slate-600">Are you sure you want to delete <span class=" ">${itemsWithBOM.length}</span> BOMs for drawing <span class=" text-indigo-600">${drawingNo}</span>? This action <span class=" text-rose-600">cannot be undone</span>.</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete Drawing BOMs',
        cancelButtonText: 'Cancel',
        width: '380px',
        padding: '1rem',
        customClass: {
          confirmButton: 'text-[11px]  p-2 rounded shadow-lg shadow-rose-100  ',
          cancelButton: 'text-[11px]  p-2 rounded  '
        }
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');

        const promises = itemsWithBOM.map(item =>
          fetch(`${API_BASE}/bom/items/${item.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );

        const responses = await Promise.all(promises);
        const failed = responses.filter(r => !r.ok);

        if (failed.length > 0) {
          throw new Error(`Failed to delete ${failed.length} BOM(s).`);
        }

        successToast(`BOMs for drawing ${drawingNo} have been deleted.`);
        fetchOrders();
      }
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendForApproval = async (client) => {
    try {
      // Filter items to find eligible sales orders (those not already submitted or further)
      const eligibleItems = (client.items || []).filter(i => {
        const s = (i.sales_order_status || '').toUpperCase();
        return !s.includes('BOM_SUBMITTED') && !s.includes('BOM_APPROVED') && !s.includes('QUOTATION') && !s.includes('PO_');
      });

      const salesOrderIds = [...new Set(eligibleItems.map(i => i.sales_order_id))].filter(id => id);

      if (salesOrderIds.length === 0) {
        errorToast("No eligible sales orders found for this client.");
        return;
      }

      const result = await Swal.fire({
        title: '<span class="text-base  text-slate-800">Send for Approval?</span>',
        html: `<span class="text-xs text-slate-600">Are you sure you want to send BOMs for <span class=" text-indigo-600">${client.client_name}</span> for approval? <br/><small class="text-slate-400">(${salesOrderIds.length} order(s) will be submitted)</small></span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Send',
        cancelButtonText: 'Cancel',
        width: '380px',
        padding: '1rem',
        customClass: {
          confirmButton: 'text-[11px]  p-2 rounded shadow-lg shadow-emerald-100  ',
          cancelButton: 'text-[11px]  p-2 rounded  '
        }
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
      });

      const drawings = Object.keys(drawingsMap);
      totalDrawings += drawings.length;

      drawings.forEach(dwgNo => {
        const dwgItems = drawingsMap[dwgNo];

        // Group by item to handle versions in cost calculation
        const itemGroups = dwgItems.reduce((acc, i) => {
          const groupId = i.item_code || cleanText(i.description || i.item_name || i.material_name || 'BOM Item');
          if (!acc[groupId]) acc[groupId] = [];
          acc[groupId].push(i);
          return acc;
        }, {});

        Object.values(itemGroups).forEach(versions => {
          // Sort to get latest version
          const latest = versions.sort((a, b) => {
            const vA = parseFloat(a.version || a.revision_no || 0);
            const vB = parseFloat(b.version || b.revision_no || 0);
            if (vB !== vA) return vB - vA;
            return b.id - a.id;
          })[0];

          const isFG = (latest.item_group === 'FG' || latest.product_type === 'FG' || (latest.item_group || '').toLowerCase().includes('finished'));
          if (isFG && (latest.has_bom || latest.has_master_bom)) {
            totalCost += (parseFloat(latest.bom_cost || 0) * (latest.quantity || 0));
          }
        });

        const hasFGBOM = Object.values(itemGroups).some(versions => {
          const latest = versions[0];
          return (latest.has_bom || latest.has_master_bom) && (latest.item_group === 'FG' || latest.product_type === 'FG' || (latest.item_group || '').toLowerCase().includes('finished'));
        });
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
    return orders;
  }, [orders]);

  const isClientBOMCompleted = (row) => {
    const items = clientData[row.id]?.items || [];
    const drawingsMap = items.reduce((acc, item) => {
      const dwg = cleanText(item.drawing_no || 'N/A');
      if (!acc[dwg]) acc[dwg] = [];
      acc[dwg].push(item);
      return acc;
    }, {});

    const drawingsList = Object.values(drawingsMap);
    return drawingsList.length > 0 && drawingsList.every(dwgItems =>
      dwgItems.some(i => i.has_bom || i.has_master_bom)
    );
  };

  const columns = [
    {
      label: 'Client Name',
      key: 'client_name',
      sortable: true,
      className: ' text-slate-900',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className=" text-slate-900">{val}</span>
          {row.items?.[0]?.project_name && (
            <span className="text-xs  text-slate-500 font-normal">{row.items[0].project_name}</span>
          )}
        </div>
      )
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

        // Group by item to handle versions
        const itemGroups = items.reduce((acc, i) => {
          const groupId = i.item_code || cleanText(i.description || i.item_name || i.material_name || 'BOM Item');
          if (!acc[groupId]) acc[groupId] = [];
          acc[groupId].push(i);
          return acc;
        }, {});

        const fgBomCost = Object.values(itemGroups).reduce((total, versions) => {
          const latest = versions.sort((a, b) => {
            const vA = parseFloat(a.version || a.revision_no || 0);
            const vB = parseFloat(b.version || b.revision_no || 0);
            if (vB !== vA) return vB - vA;
            return b.id - a.id;
          })[0];

          const isFG = (latest.item_group === 'FG' || latest.product_type === 'FG' || (latest.item_group || '').toLowerCase().includes('finished'));
          if (isFG && (latest.has_bom || latest.has_master_bom)) {
            return total + (parseFloat(latest.bom_cost || 0) * (latest.quantity || 0));
          }
          return total;
        }, 0);

        return <span className=" text-slate-900">₹{fgBomCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>;
      }
    },
    {
      label: 'Overall Status',
      key: 'status',
      render: (_, row) => {
        const isCompleted = isClientBOMCompleted(row);
        return <StatusBadge status={isCompleted ? 'COMPLETED' : 'IN_PROGRESS'} />;
      }
    },
    {
      label: 'Actions',
      key: 'actions',
      render: (_, row) => {
        const isCompleted = isClientBOMCompleted(row);
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleViewBOMDetails(row); }}
              className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm"
              title="View BOM Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteAllClientBOMs(row); }}
              className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm"
              title="Delete All Client BOMs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {(row.items?.some(i => {
              const s = (i.sales_order_status || '').toUpperCase();
              return !s.includes('BOM_SUBMITTED') && !s.includes('BOM_APPROVED') && !s.includes('QUOTATION') && !s.includes('PO_');
            })) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSendForApproval(row); }}
                  disabled={!isCompleted}
                  className={`flex items-center gap-2 p-1.5 rounded text-xs transition-all border ${isCompleted
                      ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100"
                      : "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60"
                    }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Send for Approval
                </button>
              )}
          </div>
        );
      }
    }
  ];

  const renderClientExpanded = (client) => {
    const items = clientData[client.id]?.items || [];
    const clientLoading = clientData[client.id]?.loading;

    if (clientLoading) {
      return (
        <div className="flex justify-center py-10">
          <div className="w-3 h-3 border-2 border-slate-200 border-t-indigo-500 rounded animate-spin" />
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
            <p className="text-sm text-slate-400 ">No drawings found for this client.</p>
          </div>
        ) : (
          Object.entries(drawingsMap).map(([dwgNo, dwgItems]) => {
            const dwgKey = `${client.id}_${dwgNo}`;
            const isDwgExpanded = expandedDrawings[dwgKey];
            const drawingName = dwgItems[0].drawing_name || dwgItems[0].item_name || dwgItems[0].item_description || 'No Description';
            const drawingId = dwgItems[0].drawing_id;
            const drawingType = dwgItems.find(i => i.drawing_type)?.drawing_type || '';
            const itemsWithBOM = dwgItems.filter(i => i.has_bom || i.has_master_bom);

            // Calculate total FG/SA cost for this drawing
            const fgItems = dwgItems.filter(i =>
              (i.item_group === 'FG' || i.product_type === 'FG' || (i.item_group || '').toLowerCase().includes('finished'))
            );
            const topItems = fgItems.length > 0 ? fgItems : dwgItems.filter(i =>
              (i.item_code || '').startsWith('SA-') || (i.item_group || '').includes('SA')
            );
            const latestCosts = topItems.reduce((acc, i) => {
              const key = i.item_code || i.description;
              if (!acc[key] || (parseFloat(i.version || i.revision_no || 0) > parseFloat(acc[key].version || acc[key].revision_no || 0))) {
                acc[key] = i;
              }
              return acc;
            }, {});
            const totalDisplayCost = Object.values(latestCosts).reduce((sum, i) => sum + parseFloat(i.bom_cost || 0), 0);

            // Refined status logic
            let dwgStatus = 'PENDING';
            if (itemsWithBOM.length > 0) {
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
                      <p className="text-xs text-slate-500 ">{drawingName}</p>

                      <div className="flex items-center gap-2">
                        <span className="text-xs  text-slate-900">{dwgNo}</span>
                        {dwgStatus === 'DESIGN_APPROVED' ? (
                          <span className="p-1 bg-emerald-50 text-emerald-600 rounded text-xs   border border-emerald-100">
                            Design Approved
                          </span>
                        ) : (
                          <StatusBadge status={dwgStatus} />
                        )}
                        {drawingType && (
                          <span className="p-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200 font-medium">
                            {drawingType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block border-r border-slate-100 pr-4">
                      <p className="text-xs  text-slate-400  uppercase tracking-wider mb-0.5">Est. Price</p>
                      <p className="text-sm  text-indigo-600 leading-none">
                        ₹{totalDisplayCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs  text-slate-400  uppercase tracking-wider mb-0.5">BOMs</p>
                      <p className="text-sm  text-slate-700 leading-none">{itemsWithBOM.length}</p>
                    </div>
                    <Link
                      to={`/bom-form?drawing_no=${encodeURIComponent(dwgNo)}&drawing_id=${dwgItems[0].drawing_public_id || drawingId}&drawing_name=${encodeURIComponent(drawingName)}&sales_order_id=${dwgItems[0].sales_order_public_id || dwgItems[0].sales_order_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded text-xs transition-all shadow-sm flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                      </svg>
                      Create BOM
                    </Link>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDrawingBOMs(dwgNo, dwgItems, client.client_name); }}
                      className="p-2 rounded border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm"
                      title="Delete Drawing BOMs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isDwgExpanded && (
                  <div className="border-t border-slate-50 bg-slate-50/20 p-2">
                    <div className="overflow-x-auto rounded  border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100 bg-white">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-4 p-2 text-left text-xs  text-slate-400  ">Item Details</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Rev</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Created</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Group</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Qty</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Est. Cost</th>
                            <th className="px-4 p-2 text-center text-xs  text-slate-400  ">Status</th>
                            <th className="px-4 p-2 text-right text-xs  text-slate-400  ">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(() => {
                            // Group items by item_code or description to handle versions
                            const groupedBOMs = dwgItems.filter(item => item.has_bom || item.has_master_bom).reduce((acc, item) => {
                              const groupId = item.item_code || cleanText(item.description || item.item_name || item.material_name || 'BOM Item');
                              if (!acc[groupId]) acc[groupId] = [];
                              acc[groupId].push(item);
                              return acc;
                            }, {});

                            return Object.entries(groupedBOMs).map(([groupId, versions]) => {
                              // Sort versions descending by revision_no then ID
                              const sortedVersions = versions.sort((a, b) => {
                                const vA = parseFloat(a.version || a.revision_no || 0);
                                const vB = parseFloat(b.version || b.revision_no || 0);
                                if (vB !== vA) return vB - vA;
                                return b.id - a.id;
                              });
                              const latest = sortedVersions[0];
                              const hasMultiple = sortedVersions.length > 1;

                              return (
                                <React.Fragment key={groupId}>
                                  <tr className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 p-2">
                                      <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                          <span className="text-xs  text-slate-700">
                                            {cleanText(latest.description || latest.material_name || 'BOM Item')}
                                          </span>
                                          <span className="text-xs  text-slate-400 ">{latest.item_code}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 p-2 text-center">
                                      <span className="text-[11px]  text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                        V{latest.version || latest.revision_no || '1'}
                                      </span>
                                    </td>
                                    <td className="px-4 p-2 text-center">
                                      <span className="text-xs  text-slate-500">
                                        {formatDate(latest.created_at)}
                                      </span>
                                    </td>
                                    <td className="px-4 p-2 text-center">
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs   ">
                                        {latest.item_group || '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 p-2 text-center">
                                      <span className="text-xs  text-slate-700">
                                        {latest.total_quantity || latest.quantity} <span className="text-xs  text-slate-400 font-normal">{latest.unit || 'NOS'}</span>
                                      </span>
                                    </td>
                                    <td className="px-4 p-2 text-center">
                                      <span className="text-xs  text-indigo-600">
                                        ₹{parseFloat(latest.bom_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="px-4 p-2 text-center">
                                      <StatusBadge status={latest.status === 'DRAFT' ? 'DRAFT' : "FINALIZED"} />
                                    </td>
                                    <td className="px-4 p-2">
                                      <div className="flex justify-end gap-1">
                                        <Link
                                          to={`/bom-form/${latest.id}?view=true`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                          title="View Latest BOM"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Link>
                                        <Link
                                          to={`/bom-form/${latest.id}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
                                          title="Edit Latest BOM"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Link>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDeleteBOM(latest.id); }}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                          title="Delete BOM"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            });
                          })()}
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
                <p className="text-xl  text-slate-900 ">{stat.value}</p>
                {stat.progress !== undefined && (
                  <div className="mt-2 w-full h-1 bg-slate-50 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded" style={{ width: `${stat.progress}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>



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

      {showBOMDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowBOMDetails(false)}></div>

            <div className="relative bg-white rounded  shadow-2xl max-w-6xl w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
              <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded  border border-indigo-100">
                    <Eye size={20} className="drop-shadow-sm" />
                  </div>
                  <div>
                    <h3 className="text-md  text-slate-900  leading-none ">BOM Details: {selectedBOMOrder?.po_number}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs  text-slate-400  ">{selectedBOMOrder?.company_name}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded" />
                      <span className="text-xs  text-indigo-500  ">{selectedBOMOrder?.project_name}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowBOMDetails(false)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded  transition-all border border-transparent hover:border-rose-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-2 max-h-[80vh] overflow-y-auto bg-slate-50/30">
                {bomDetailsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <div className="w-5 h-5 border-4 border-indigo-600 border-t-transparent rounded animate-spin" />
                    <p className="text-xs text-slate-400    animate-pulse">Analyzing BOM Data...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Summary Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="bg-white p-2 rounded border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div>
                          <p className="text-xs  text-slate-400   mb-1">Total Drawings</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl  text-slate-900 ">{bomOrderItems.filter(i => i.status !== 'REJECTED').length}</span>
                            <span className="text-xs  text-slate-400 italic">Sets</span>
                          </div>
                        </div>
                        <div className="p-2 bg-slate-50 text-slate-300 rounded group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-all">
                          <History size={20} />
                        </div>
                      </div>

                      <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-2 rounded  shadow-xl shadow-indigo-100 flex items-center justify-between border border-indigo-500/20">
                        <div>
                          <p className="text-xs  text-indigo-200/80   mb-1">Aggregate Estimated Manufacturing Cost</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-indigo-200 text-sm ">₹</span>
                            <span className="text-xl  text-white er">
                              {bomOrderItems.reduce((total, item) => {
                                if (item.status === 'REJECTED') return total;
                                const mat = item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) || 0;
                                const comp = item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(item.quantity) * parseFloat(c.rate || 0)), 0) || 0;
                                const labor = item.operations?.reduce((sum, o) => {
                                  const cycle = parseFloat(o.cycle_time_min || 0);
                                  const setup = parseFloat(o.setup_time_min || 0);
                                  const rate = parseFloat(o.hourly_rate || 0);
                                  return sum + (((cycle + setup) / 60 * rate) * parseFloat(item.quantity));
                                }, 0) || 0;
                                const scrap = item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0) || 0;
                                return total + (mat + comp + labor - scrap);
                              }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="p-2 bg-white/10 text-white/50 rounded backdrop-blur-md border border-white/5 flex flex-col items-center">
                          <Check size={15} className="text-emerald-400" />
                          <span className="text-[8px]   er mt-1 text-emerald-400/80">Validated</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {bomOrderItems.map((item) => {
                        const matCost = item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity || 0) * parseFloat(m.rate || 0)), 0) || 0;
                        const compCost = item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(item.quantity || 0) * parseFloat(c.rate || 0)), 0) || 0;
                        const laborCost = item.operations?.reduce((sum, o) => {
                          const cycle = parseFloat(o.cycle_time_min || 0);
                          const setup = parseFloat(o.setup_time_min || 0);
                          const rate = parseFloat(o.hourly_rate || 0);
                          return sum + (((cycle + setup) / 60 * rate) * parseFloat(item.quantity || 0));
                        }, 0) || 0;
                        const scrapCredit = item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0) || 0;
                        const itemTotal = matCost + compCost + laborCost - scrapCredit;
                        const profitMargin = parseFloat(selectedBOMOrder?.profit_margin || 0);
                        const estProfit = (itemTotal * profitMargin) / 100;
                        const isExpanded = expandedBOMItems.has(item.id);

                        return (
                          <div key={item.id} className={`bg-white rounded border transition-all ${isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}>
                            <div className="p-3">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded mt-1 ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                  <FileText size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-xs  text-slate-900 truncate ">{item.item_code}</h4>
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs    ">{item.item_group || 'FINISHED_GOOD'}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs  text-slate-500 ">
                                    <button
                                      onClick={() => item.drawing_no && handlePreviewByNo(item.drawing_no)}
                                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition-colors "
                                    >
                                      VIEW DRAWING <ExternalLink size={10} />
                                    </button>
                                    <button
                                      onClick={() => toggleBOMItem(item.id)}
                                      className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors "
                                    >
                                      {isExpanded ? 'CLOSE BOM' : 'FULL BOM'} <ExternalLink size={10} className={isExpanded ? 'rotate-180' : ''} />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex gap-6 text-center">
                                  <div>
                                    <p className="text-xs  text-slate-400   mb-1">Order Qty</p>
                                    <p className="text-xs  text-slate-700">{item.quantity} <span className="text-xs  font-normal text-slate-400">{item.unit || 'Nos'}</span></p>
                                  </div>
                                  <div>
                                    <p className="text-xs  text-slate-400   mb-1">Material Cost</p>
                                    <p className="text-xs  text-slate-700">₹{matCost.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs  text-slate-400   mb-1">Labor Cost</p>
                                    <p className="text-xs  text-slate-700">₹{laborCost.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div className="px-4 py-1 bg-emerald-50/50 rounded border border-emerald-100/50">
                                    <p className="text-xs  text-emerald-600/70   mb-1">Est. Profit</p>
                                    <p className="text-xs  text-emerald-600">₹{estProfit.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
                                    <div>
                                      <p className="text-xs  text-slate-400   mb-1">Item Total</p>
                                      <p className="text-sm  text-indigo-600">₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded">
                                      <Check size={14} strokeWidth={3} />
                                    </div>
                                    <button
                                      onClick={() => handleDeleteBOM(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                      title="Delete BOM"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Materials */}
                                    <div className="bg-slate-50/50 p-2 rounded border border-slate-100">
                                      <div className="flex items-center justify-between mb-3 px-1">
                                        <h5 className="text-xs   text-indigo-600   flex items-center gap-2">
                                          <div className="w-1 h-3 bg-indigo-600 rounded" />
                                          Raw Materials
                                        </h5>
                                        <span className="text-xs   text-slate-400">₹{matCost.toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {item.materials?.length > 0 ? item.materials.map((m, idx) => (
                                          <div key={idx} className="bg-white p-2 rounded border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-colors">
                                            <div>
                                              <p className="text-xs  text-slate-700">{m.material_name}</p>
                                              <p className="text-xs  text-slate-400 ">{m.qty_per_pc} @ ₹{parseFloat(m.rate || 0).toLocaleString('en-IN')}</p>
                                            </div>
                                            <p className="text-xs  text-slate-600">₹{(parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)).toLocaleString('en-IN')}</p>
                                          </div>
                                        )) : (
                                          <p className="text-xs  text-slate-400 italic px-1">No materials listed</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Components */}
                                    <div className="bg-slate-50/50 p-2 rounded border border-slate-100">
                                      <div className="flex items-center justify-between mb-3 px-1">
                                        <h5 className="text-xs   text-blue-600   flex items-center gap-2">
                                          <div className="w-1 h-3 bg-blue-600 rounded" />
                                          Components
                                        </h5>
                                        <span className="text-xs   text-slate-400">₹{compCost.toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {item.components?.length > 0 ? item.components.map((c, idx) => (
                                          <div key={idx} className="bg-white p-2 rounded border border-slate-100 flex justify-between items-center hover:border-blue-200 transition-colors">
                                            <div>
                                              <p className="text-xs  text-slate-700">{c.description || c.component_code}</p>
                                              <p className="text-xs  text-slate-400 ">{c.quantity} @ ₹{parseFloat(c.rate || 0).toLocaleString('en-IN')}</p>
                                            </div>
                                            <p className="text-xs  text-slate-600">₹{(parseFloat(c.quantity || 0) * parseFloat(item.quantity) * parseFloat(c.rate || 0)).toLocaleString('en-IN')}</p>
                                          </div>
                                        )) : (
                                          <p className="text-xs  text-slate-400 italic px-1">No components listed</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Operations */}
                                    <div className="bg-slate-50/50 p-2 rounded border border-slate-100">
                                      <div className="flex items-center justify-between mb-3 px-1">
                                        <h5 className="text-xs   text-amber-600   flex items-center gap-2">
                                          <div className="w-1 h-3 bg-amber-600 rounded" />
                                          Operations
                                        </h5>
                                        <span className="text-xs   text-slate-400">₹{laborCost.toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {item.operations?.length > 0 ? item.operations.map((o, idx) => {
                                          const opCost = ((parseFloat(o.cycle_time_min || 0) + parseFloat(o.setup_time_min || 0)) / 60 * parseFloat(o.hourly_rate || 0)) * parseFloat(item.quantity);
                                          return (
                                            <div key={idx} className="bg-white p-2 rounded border border-slate-100 flex justify-between items-center hover:border-amber-200 transition-colors">
                                              <div>
                                                <p className="text-xs  text-slate-700">{o.operation_name}</p>
                                                <p className="text-xs  text-slate-400 ">{o.cycle_time_min + o.setup_time_min} MIN @ ₹{parseFloat(o.hourly_rate || 0).toLocaleString('en-IN')}/hr</p>
                                              </div>
                                              <p className="text-xs  text-slate-600">₹{opCost.toLocaleString('en-IN')}</p>
                                            </div>
                                          );
                                        }) : (
                                          <p className="text-xs  text-slate-400 italic px-1">No operations listed</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowBOMDetails(false)}
                  className="px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded text-xs  hover:bg-slate-50 transition-all  "
                >
                  Close
                </button>
              </div>
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
          drawing={previewDrawing}
        />
      )}
    </div>
  );
};

export default BOMCreation;