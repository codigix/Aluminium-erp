import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye, RotateCw, Clock, History, Check, X, ExternalLink, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const BOMApproval = () => {
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  
  // Modal for viewing BOM items
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const toggleItem = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/bom-approval-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch approval history');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (activeTab === 'history') {
      return fetchHistory();
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders?includeWithoutPo=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      
      setOrders(data.filter(order => (order.status || '').trim().toUpperCase() === 'BOM_SUBMITTED'));
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchHistory]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handlePreviewByNo = async (drawingNo) => {
    if (!drawingNo || drawingNo === 'N/A') {
      errorToast('Drawing number not available');
      return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/drawings?search=${encodeURIComponent(drawingNo)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const drawings = await response.json();
            const dwg = drawings.find(d => d.drawing_no === drawingNo);
            if (dwg) {
                setPreviewDrawing(dwg);
                setShowPreviewModal(true);
                return;
            }
        }
        errorToast('Drawing file not found in system');
    } catch (error) {
        console.error(error);
        errorToast('Failed to fetch drawing info');
    }
  };

  const handleViewBOM = async (order) => {
    try {
      setSelectedOrder(order);
      setShowDetails(true);
      setDetailsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch BOM details');
      const data = await response.json();
      setOrderItems(data);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load BOM details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApproveBOM = async (orderId) => {
    const result = await Swal.fire({
      title: 'Approve BOM?',
      text: "This will approve the technical design and bill of materials.",
      icon: 'success',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Yes, Approve'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'BOM_Approved' })
        });

        if (!response.ok) throw new Error('Failed to approve BOM');
        successToast('BOM has been approved.');
        fetchOrders();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const columns = [
    { 
      label: 'PO / SO Ref', 
      key: 'po_ref',
      render: (_, item) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{item.po_number || (item.customer_po_id ? `PO-${item.customer_po_id}` : `SO-${item.id || item.sales_order_id}`)}</div>
          <div className="text-[10px] text-slate-500">Sales Order Ref</div>
        </div>
      )
    },
    { 
      label: 'Customer / Project', 
      key: 'customer',
      render: (_, item) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{item.company_name}</div>
          <div className="text-xs text-slate-500">{item.project_name}</div>
        </div>
      )
    },
    ...(activeTab === 'history' ? [
      { 
        label: 'Approver', 
        key: 'approver_name',
        render: (val) => <div className="text-sm text-slate-700">{val}</div>
      }
    ] : []),
    { 
      label: activeTab === 'history' ? 'Approval Date' : 'Status', 
      key: 'status_date',
      render: (_, item) => activeTab === 'history' ? (
        <div className="text-xs text-slate-600">
          {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      ) : (
        <span className={`px-2 py-1 rounded text-xs font-medium ${(item.status || '').trim().toUpperCase() === 'BOM_SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {(item.status || '').replace(/_/g, ' ')}
        </span>
      )
    },
    { 
      label: 'Actions', 
      key: 'actions', 
      className: 'text-right',
      render: (_, item) => (
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => handleViewBOM(activeTab === 'history' ? { id: item.sales_order_id, ...item } : item)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {activeTab === 'pending' && (
            <button 
              onClick={() => handleApproveBOM(item.id)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
              title="Approve"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">BOM Approval</h1>
          <p className="text-sm text-slate-500 font-medium">Review and approve finalized Bill of Materials</p>
        </div>
        <button 
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="w-4 h-4" />
          Pending Approval
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <History className="w-4 h-4" />
          Approval History
        </button>
      </div>

      <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-2">
          <DataTable 
            columns={columns}
            data={activeTab === 'pending' ? orders : history}
            loading={loading}
            pageSize={5}
            hideHeader={true}
            emptyMessage={`No ${activeTab === 'pending' ? 'pending' : 'approved'} BOMs found`}
          />
        </div>
      </Card>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDetails(false)}></div>
            
            <div className="relative bg-white rounded-[40px] shadow-2xl max-w-6xl w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner border border-indigo-100">
                    <Eye size={20} className="drop-shadow-sm" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">BOM Details: {selectedOrder?.po_number || (selectedOrder?.customer_po_id ? `PO-${selectedOrder.customer_po_id}` : `SO-${selectedOrder?.id}`)}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedOrder?.company_name}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{selectedOrder?.project_name}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDetails(false)} 
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto bg-slate-50/30">
                {detailsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest animate-pulse">Analyzing BOM Data...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Drawings</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900 tracking-tighter">{orderItems.filter(i => i.status !== 'REJECTED').length}</span>
                            <span className="text-[10px] font-bold text-slate-400 italic">Sets</span>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 text-slate-300 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-all">
                          <History size={20} />
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-4 rounded-[32px] shadow-xl shadow-indigo-100 flex items-center justify-between border border-indigo-500/20">
                        <div>
                          <p className="text-[9px] font-black text-indigo-200/80 uppercase tracking-[0.2em] mb-1">Aggregate Estimated Manufacturing Cost</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-indigo-200 text-sm font-black">₹</span>
                            <span className="text-3xl font-black text-white tracking-tighter">
                              {orderItems.reduce((total, item) => {
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
                        <div className="p-4 bg-white/10 text-white/50 rounded-2xl backdrop-blur-md border border-white/5 flex flex-col items-center">
                           <Check size={24} className="text-emerald-400" />
                           <span className="text-[8px] font-black uppercase tracking-tighter mt-1 text-emerald-400/80">Validated</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {orderItems.map((item) => {
                        const matCost = item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity || 0) * parseFloat(m.rate || 0)), 0) || 0;
                        const compCost = item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(item.quantity || 0) * parseFloat(c.rate || 0)), 0) || 0;
                        const laborCost = item.operations?.reduce((sum, o) => {
                          const cycle = parseFloat(o.cycle_time_min || 0);
                          const setup = parseFloat(o.setup_time_min || 0);
                          const rate = parseFloat(o.hourly_rate || 0);
                          return sum + (((cycle + setup) / 60 * rate) * parseFloat(item.quantity || 0));
                        }, 0) || 0;
                        const scrapValue = item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0) || 0;
                        const totalItemCost = matCost + compCost + laborCost - scrapValue;
                        const isExpanded = expandedItems.has(item.id);
                        
                        return (
                          <div key={item.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all group border-l-4 border-l-transparent hover:border-l-indigo-500">
                            <div 
                              className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer"
                              onClick={() => toggleItem(item.id)}
                            >
                              <div className="flex items-center gap-4 min-w-[280px]">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-inner ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                                  <FileText size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className={`text-[13px] font-black tracking-tight uppercase ${item.status === 'REJECTED' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                      {item.item_code || item.drawing_no}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${item.item_group === 'FG' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                      {item.item_group || 'Component'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5" onClick={e => e.stopPropagation()}>
                                    <button 
                                      onClick={() => handlePreviewByNo(item.drawing_no)}
                                      className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 underline underline-offset-4 decoration-indigo-200 uppercase tracking-wider flex items-center gap-1"
                                    >
                                      VIEW DRAWING <ExternalLink size={10} />
                                    </button>
                                    <Link 
                                      to={`/bom-form/${item.id}?view=true`} 
                                      target="_blank"
                                      className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wider flex items-center gap-1"
                                    >
                                      FULL BOM <ExternalLink size={10} />
                                    </Link>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-2xl px-2">
                                <div className="p-2 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Order Qty</p>
                                  <p className="text-[13px] font-black text-slate-900">{parseFloat(item.quantity || 0).toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">{item.unit || 'Nos'}</span></p>
                                </div>
                                <div className="p-2 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Material Cost</p>
                                  <p className="text-[13px] font-black text-slate-900">₹{(matCost + compCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="p-2 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Labor Cost</p>
                                  <p className="text-[13px] font-black text-slate-900">₹{laborCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-emerald-50/30 p-2 rounded-2xl border border-emerald-100/50 flex flex-col justify-center">
                                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.15em] mb-1">Est. Profit</p>
                                  <p className="text-[13px] font-black text-emerald-700">₹0.00</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 pl-4 lg:border-l lg:border-slate-100">
                                <div className="text-right min-w-[100px]">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Item Total</p>
                                  <p className="text-sm font-black text-indigo-600 tracking-tighter">₹{totalItemCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${item.status === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'} shadow-sm`}>
                                  {item.status === 'REJECTED' ? <X size={14} /> : <Check size={14} />}
                                </div>
                              </div>
                            </div>

                            {/* EXPANDABLE BREAKDOWN SECTION */}
                            {isExpanded && (
                              <div className="px-6 pb-6 pt-2 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                  {/* Raw Materials */}
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-50">
                                      <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                        Raw Materials
                                      </h5>
                                      <span className="text-[10px] font-black text-indigo-600">₹{matCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="space-y-2">
                                      {item.materials?.length > 0 ? item.materials.map((m, idx) => (
                                        <div key={idx} className="flex justify-between items-start gap-2 py-1">
                                          <div className="flex-1">
                                            <p className="text-[10px] font-bold text-slate-700 leading-tight">{m.material_name}</p>
                                            <p className="text-[8px] text-slate-400 font-medium uppercase mt-0.5">{m.qty_per_pc} {m.unit} @ ₹{m.rate}</p>
                                          </div>
                                          <span className="text-[9px] font-black text-slate-900 whitespace-nowrap">₹{(parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity || 0) * parseFloat(m.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      )) : (
                                        <p className="text-[9px] text-slate-400 italic">No raw materials listed</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Purchased Components / Assemblies */}
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-50">
                                      <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                                        Components
                                      </h5>
                                      <span className="text-[10px] font-black text-blue-600">₹{compCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="space-y-2">
                                      {item.components?.length > 0 ? item.components.map((c, idx) => (
                                        <div key={idx} className="flex justify-between items-start gap-2 py-1">
                                          <div className="flex-1">
                                            <p className="text-[10px] font-bold text-slate-700 leading-tight">{c.component_name}</p>
                                            <p className="text-[8px] text-slate-400 font-medium uppercase mt-0.5">{c.quantity} {c.unit} @ ₹{c.rate}</p>
                                          </div>
                                          <span className="text-[9px] font-black text-slate-900 whitespace-nowrap">₹{(parseFloat(c.quantity || 0) * parseFloat(item.quantity || 0) * parseFloat(c.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      )) : (
                                        <p className="text-[9px] text-slate-400 italic">No components listed</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Operations / Labor */}
                                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-50">
                                      <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                                        Operations
                                      </h5>
                                      <span className="text-[10px] font-black text-amber-600">₹{laborCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="space-y-2">
                                      {item.operations?.length > 0 ? item.operations.map((o, idx) => {
                                        const opCost = ((parseFloat(o.cycle_time_min || 0) + parseFloat(o.setup_time_min || 0)) / 60 * parseFloat(o.hourly_rate || 0)) * parseFloat(item.quantity || 0);
                                        return (
                                          <div key={idx} className="flex justify-between items-start gap-2 py-1">
                                            <div className="flex-1">
                                              <p className="text-[10px] font-bold text-slate-700 leading-tight">{o.operation_name}</p>
                                              <p className="text-[8px] text-slate-400 font-medium uppercase mt-0.5">{(parseFloat(o.cycle_time_min || 0) + parseFloat(o.setup_time_min || 0))} MIN @ ₹{o.hourly_rate}/hr</p>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-900 whitespace-nowrap">₹{opCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                          </div>
                                        );
                                      }) : (
                                        <p className="text-[9px] text-slate-400 italic">No operations listed</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowDetails(false)}
                  className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all shadow-sm"
                >
                  Close
                </button>
                {activeTab === 'pending' && (
                  <button 
                    onClick={() => { handleApproveBOM(selectedOrder.id); setShowDetails(false); }}
                    className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    Approve BOM
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal Component */}
      <DrawingPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default BOMApproval;
