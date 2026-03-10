import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye, RotateCw, Clock, History, Check, X, ExternalLink } from 'lucide-react';
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

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

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
            
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-6xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">BOM Details: {selectedOrder?.po_number || (selectedOrder?.customer_po_id ? `PO-${selectedOrder.customer_po_id}` : `SO-${selectedOrder?.id}`)}</h3>
                    <p className="text-sm font-medium text-slate-500">{selectedOrder?.company_name} • {selectedOrder?.project_name}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetails(false)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 max-h-[75vh] overflow-y-auto">
                {detailsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <RotateCw className="w-10 h-10 text-indigo-600 animate-spin" />
                    <p className="text-slate-500 font-medium">Loading details...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Summary Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Drawings</p>
                          <p className="text-3xl font-bold text-slate-900">{orderItems.filter(i => i.status !== 'REJECTED').length}</p>
                        </div>
                        <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl">
                          <History size={24} />
                        </div>
                      </div>
                      <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Total Est. Cost</p>
                          <p className="text-3xl font-bold text-white">
                            ₹{orderItems.reduce((total, item) => {
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
                          </p>
                        </div>
                        <div className="p-4 bg-white/10 text-white rounded-2xl">
                          <Check size={24} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                    {orderItems.map((item) => (
                      <div key={item.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            {item.status !== 'REJECTED' ? (
                              <h4 className="font-bold text-slate-900">{item.item_code || item.drawing_no}</h4>
                            ) : (
                              <h4 className="font-bold text-rose-500 line-through">{item.item_code || item.drawing_no}</h4>
                            )}
                            {item.status !== 'REJECTED' && (
                              <Link 
                                to={`/bom-form/${item.id}?view=true`} 
                                target="_blank"
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                              >
                                VIEW FULL BOM
                                <ExternalLink size={12} />
                              </Link>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Status</p>
                              <span className={`text-xs font-bold ${item.status === 'REJECTED' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {item.status?.replace(/_/g, ' ') || 'ACTIVE'}
                              </span>
                            </div>
                            {item.drawing_no && (
                              <button 
                                onClick={() => handlePreviewByNo(item.drawing_no)}
                                className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm"
                                title="Preview Drawing"
                              >
                                <Eye size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        {item.status !== 'REJECTED' && (
                          <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Qty</p>
                                <p className="text-lg font-bold text-slate-900">{item.quantity} {item.unit || 'Nos'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material Cost</p>
                                <p className="text-lg font-bold text-slate-900">
                                  ₹{(item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labor Cost</p>
                                <p className="text-lg font-bold text-slate-900">
                                  ₹{(item.operations?.reduce((sum, o) => {
                                    const cycle = parseFloat(o.cycle_time_min || 0);
                                    const setup = parseFloat(o.setup_time_min || 0);
                                    const rate = parseFloat(o.hourly_rate || 0);
                                    return sum + (((cycle + setup) / 60 * rate) * parseFloat(item.quantity));
                                  }, 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Estimated Profit</p>
                                <p className="text-lg font-bold text-emerald-700">₹{((parseFloat(item.selling_rate || 0) - parseFloat(item.valuation_rate || 0)) * parseFloat(item.quantity)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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
