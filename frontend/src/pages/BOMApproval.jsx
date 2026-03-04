import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui.jsx';
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
      
      setOrders(data.filter(order => order.status === 'BOM_SUBMITTED'));
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
          body: JSON.stringify({ status: 'BOM_Approved ' })
        });

        if (!response.ok) throw new Error('Failed to approve BOM');
        successToast('BOM has been approved.');
        fetchOrders();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  return (
    <div className="">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl text-slate-900">BOM Approval</h1>
          <p className="text-xs text-slate-500">Review and approve finalized Bill of Materials</p>
        </div>
        <button 
          onClick={fetchOrders}
          className="flex items-center gap-2  p-2  bg-white border border-slate-200 rounded  text-sm  text-slate-600 hover:bg-slate-50  transition-all"
        >
          <RotateCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2  p-2 rounded-md text-xs  transition-all ${activeTab === 'pending' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          <Clock className="w-4 h-4" />
          Pending Approval
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2  p-2 rounded-md text-xs  transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          <History className="w-4 h-4" />
          Approval History
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 bg-white">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left text-xs  text-slate-500 ">PO / SO Ref</th>
                <th className="p-2 text-left text-xs  text-slate-500 ">Customer / Project</th>
                {activeTab === 'history' && <th className="p-2 text-left text-xs  text-slate-500 ">Approver</th>}
                <th className="p-2 text-left text-xs  text-slate-500 ">{activeTab === 'history' ? 'Approval Date' : 'Status'}</th>
                <th className="p-2 text-right text-xs  text-slate-500 ">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={activeTab === 'history' ? "5" : "4"} className="px-6 py-10 text-center text-slate-500">Loading BOMs...</td></tr>
              ) : (activeTab === 'pending' ? orders : history).length === 0 ? (
                <tr><td colSpan={activeTab === 'history' ? "5" : "4"} className="p-6 text-center text-slate-400">No {activeTab === 'pending' ? 'pending' : 'approved'} BOMs found</td></tr>
              ) : (
                (activeTab === 'pending' ? orders : history).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 whitespace-nowrap">
                      <div className="text-sm  text-slate-900">{item.po_number || (item.customer_po_id ? `PO-${item.customer_po_id}` : `SO-${item.id || item.sales_order_id}`)}</div>
                      <div className="text-[10px] text-slate-500">Sales Order Ref</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="text-sm  text-slate-900">{item.company_name}</div>
                      <div className="text-xs text-slate-500">{item.project_name}</div>
                    </td>
                    {activeTab === 'history' && (
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{item.approver_name}</div>
                      </td>
                    )}
                    <td className="p-2 whitespace-nowrap text-left">
                      {activeTab === 'history' ? (
                        <div className="text-xs text-slate-600">
                          {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs     ${item.status === 'BOM_SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap text-right text-sm ">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleViewBOM(activeTab === 'history' ? { id: item.sales_order_id, ...item } : item)}
                          className="p-1.5 rounded  border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {activeTab === 'pending' && (
                          <button 
                            onClick={() => handleApproveBOM(item.id)}
                            className="p-1.5 rounded  border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900/75 transition-opacity" onClick={() => setShowDetails(false)}></div>
            
            <div className="relative bg-white rounded  shadow-xl max-w-5xl w-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-sm  text-slate-900">BOM Details: {selectedOrder?.po_number || (selectedOrder?.customer_po_id ? `PO-${selectedOrder.customer_po_id}` : `SO-${selectedOrder?.id}`)}</h3>
                  <p className="text-xs text-slate-500">{selectedOrder?.company_name} • {selectedOrder?.project_name}</p>
                </div>
                <button onClick={() => setShowDetails(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded  transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {detailsLoading ? (
                  <div className="p-2 text-center text-slate-500">Loading details...</div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-4 rounded  border border-slate-200">
                        <div className="text-[10px] text-slate-400 mb-1   ">Total Drawings</div>
                        <div className="text-xl text-slate-900">{orderItems.filter(i => i.status !== 'REJECTED').length}</div>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded  border border-indigo-100">
                        <div className="text-[10px] text-indigo-400 mb-1   ">Total Est. Cost</div>
                        <div className="text-xl  text-indigo-600">
                          ₹{orderItems.reduce((total, item) => {
                            if (item.status === 'REJECTED') return total;
                            const mat = item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) || 0;
                            const comp = item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0) || 0;
                            const labor = item.operations?.reduce((sum, o) => {
                              const cycle = parseFloat(o.cycle_time_min || 0);
                              const setup = parseFloat(o.setup_time_min || 0);
                              const rate = parseFloat(o.hourly_rate || 0);
                              return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                            }, 0) || 0;
                            const scrap = item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0) || 0;
                            return total + (mat + comp + labor - scrap);
                          }, 0).toFixed(2)}
                        </div>
                        <p className="text-[8px] text-indigo-400 mt-1">* Estimated cost excludes rejected items as they have no BOM analysis.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.id} className="border border-slate-200 rounded  overflow-hidden">
                        <div className="bg-slate-50 p-2  border-b border-slate-200 flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-4">
                              {item.status !== 'REJECTED' && (
                                <span className="text-sm  text-slate-900">{item.item_code || item.drawing_no}</span>
                              )}
                              {item.status !== 'REJECTED' && (
                                <div className="flex items-center gap-2 ">
                                  <Link 
                                    to={`/bom-form/${item.id}?view=true`} 
                                    target="_blank"
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1  bg-indigo-50 p-1  rounded border border-indigo-100 transition-all "
                                  >
                                    View Full BOM
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>
                                  <button
                                    onClick={() => handlePreviewByNo(item.item_code || item.drawing_no)}
                                    className="p-1 text-indigo-600 hover:bg-indigo-100 rounded border border-indigo-100 transition-all  flex items-center gap-1"
                                    title="Preview Drawing"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              {item.status === 'REJECTED' && (
                                <span className="px-1.5 py-0.5 rounded text-[8px]  bg-rose-100 text-rose-600 border border-rose-200 animate-pulse ">
                                  Rejected
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2  mt-1">
                              <span className="text-xs text-slate-600">{item.drawing_name || item.description}</span>
                              {item.status === 'REJECTED' && item.rejection_reason && (
                                <>
                                  <span className="mx-2 text-slate-300">|</span>
                                  <span className="text-[10px] text-rose-500 italic">Reason: {item.rejection_reason}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-[9px] text-slate-400  ">Cost / Unit</div>
                              <div className="text-xs  text-slate-700">₹{(((item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) + 
                                     item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0) + 
                                     item.operations?.reduce((sum, o) => {
                                       const cycle = parseFloat(o.cycle_time_min || 0);
                                       const setup = parseFloat(o.setup_time_min || 0);
                                       const rate = parseFloat(o.hourly_rate || 0);
                                       return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                                     }, 0) - 
                                     item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0)) || 0) / parseFloat(item.quantity || 1)).toFixed(2)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[9px] text-indigo-400   ">Total Cost</div>
                              <div className="text-sm  text-indigo-600">₹{((item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) + 
                                     item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0) + 
                                     item.operations?.reduce((sum, o) => {
                                       const cycle = parseFloat(o.cycle_time_min || 0);
                                       const setup = parseFloat(o.setup_time_min || 0);
                                       const rate = parseFloat(o.hourly_rate || 0);
                                       return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                                     }, 0) - 
                                     item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0)) || 0).toFixed(2)}</div>
                            </div>
                            <div className="text-xs  text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              QTY: {item.quantity} {item.unit}
                            </div>
                          </div>
                        </div>
                        
                        {/* Materials Section */}
                        <div className="p-2  bg-slate-50 border-y border-slate-200 flex justify-between items-center">
                          <h4 className="text-[10px]  text-slate-500  ">Raw Materials</h4>
                          <span className="text-[10px]  text-slate-400">Total: ₹{item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0).toFixed(2)}</span>
                        </div>
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-white">
                            <tr>
                              <th className="p-2  text-lefttext-xs   text-slate-400 ">Material</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Qty/pc</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Total Qty</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Rate</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.materials?.length > 0 ? (
                              item.materials.map((mat) => {
                                const totalQty = parseFloat(mat.qty_per_pc) * parseFloat(item.quantity);
                                const amount = totalQty * parseFloat(mat.rate || 0);
                                return (
                                  <tr key={mat.id}>
                                    <td className="p-2  text-xs text-slate-700">
                                      <div className="">{mat.material_name}</div>
                                      <div className="text-[9px] text-slate-400">{mat.material_type}</div>
                                    </td>
                                    <td className="p-2  text-xs text-right text-slate-500">{parseFloat(mat.qty_per_pc).toFixed(4)}</td>
                                    <td className="p-2  text-xs text-right text-slate-900 ">{totalQty.toFixed(2)} {mat.uom}</td>
                                    <td className="p-2  text-xs text-right text-slate-500">₹{parseFloat(mat.rate || 0).toFixed(2)}</td>
                                    <td className="p-2  text-xs text-right  text-indigo-600">₹{amount.toFixed(2)}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr><td colSpan="5" className="px-4 py-4 text-left text-xs text-slate-400 italic">{item.status === 'REJECTED' ? 'No analysis available for rejected item' : 'No materials defined'}</td></tr>
                            )}
                          </tbody>
                        </table>

                        {/* Components Section */}
                        <div className="p-2  bg-slate-50 border-y border-slate-200 flex justify-between items-center">
                          <h4 className="text-[10px]  text-slate-500  ">Components</h4>
                          <span className="text-[10px]  text-slate-400">Total: ₹{item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0).toFixed(2)}</span>
                        </div>
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-white">
                            <tr>
                              <th className="p-2  text-lefttext-xs   text-slate-400 ">Component</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Qty</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Rate</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.components?.length > 0 ? (
                              item.components.map((comp) => {
                                const amount = parseFloat(comp.quantity || 0) * parseFloat(comp.rate || 0);
                                return (
                                  <tr key={comp.id}>
                                    <td className="p-2  text-xs text-slate-700">
                                      <div className="">{comp.component_code}</div>
                                      <div className="text-[9px] text-slate-400">{comp.description}</div>
                                    </td>
                                    <td className="p-2  text-xs text-right text-slate-900 ">{comp.quantity} {comp.uom}</td>
                                    <td className="p-2  text-xs text-right text-slate-500">₹{parseFloat(comp.rate || 0).toFixed(2)}</td>
                                    <td className="p-2  text-xs text-right  text-indigo-600">₹{amount.toFixed(2)}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr><td colSpan="4" className="px-4 py-4 text-left text-xs text-slate-400 italic">{item.status === 'REJECTED' ? 'No analysis available for rejected item' : 'No components defined'}</td></tr>
                            )}
                          </tbody>
                        </table>

                        {/* Operations Section */}
                        <div className="p-2  bg-slate-50 border-y border-slate-200 flex justify-between items-center">
                          <h4 className="text-[10px]  text-slate-500  ">Operations</h4>
                          <span className="text-[10px]  text-slate-400">Total: ₹{item.operations?.reduce((sum, o) => {
                            const cycle = parseFloat(o.cycle_time_min || 0);
                            const setup = parseFloat(o.setup_time_min || 0);
                            const rate = parseFloat(o.hourly_rate || 0);
                            return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                          }, 0).toFixed(2)}</span>
                        </div>
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-white">
                            <tr>
                              <th className="p-2  text-lefttext-xs   text-slate-400 ">Operation</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Cycle (m)</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Rate/hr</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Time (h)</th>
                              <th className="p-2  text-righttext-xs   text-slate-400 ">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.operations?.length > 0 ? (
                              item.operations.map((op) => {
                                const totalTimeMin = (parseFloat(op.cycle_time_min || 0) * parseFloat(item.quantity)) + parseFloat(op.setup_time_min || 0);
                                const totalTimeHrs = totalTimeMin / 60;
                                const cost = totalTimeHrs * parseFloat(op.hourly_rate || 0);
                                return (
                                  <tr key={op.id}>
                                    <td className="p-2  text-xs text-slate-700">
                                      <div className="">{op.operation_name}</div>
                                      <div className="text-[9px] text-slate-400">{op.workstation}</div>
                                    </td>
                                    <td className="p-2  text-xs text-right text-slate-500">{op.cycle_time_min}</td>
                                    <td className="p-2  text-xs text-right text-slate-500">₹{parseFloat(op.hourly_rate || 0).toFixed(2)}</td>
                                    <td className="p-2  text-xs text-right text-slate-500">{totalTimeHrs.toFixed(2)} hrs</td>
                                    <td className="p-2  text-xs text-right  text-indigo-600">₹{cost.toFixed(2)}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr><td colSpan="5" className="px-4 py-4 text-left text-xs text-slate-400 italic">{item.status === 'REJECTED' ? 'No analysis available for rejected item' : 'No operations defined'}</td></tr>
                            )}
                          </tbody>
                        </table>

                        {/* Scrap Section */}
                        {item.scrap?.length > 0 && (
                          <>
                            <div className="p-2  bg-slate-50 border-y border-slate-200 flex justify-between items-center">
                              <h4 className="text-[10px]  text-slate-500  ">Scrap Recovery</h4>
                              <span className="text-[10px]  text-rose-400">Recovery: ₹{item.scrap.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0).toFixed(2)}</span>
                            </div>
                            <table className="min-w-full divide-y divide-slate-100">
                              <thead className="bg-white">
                                <tr>
                                  <th className="p-2  text-lefttext-xs   text-slate-400 ">Scrap Item</th>
                                  <th className="p-2  text-righttext-xs   text-slate-400 ">Input</th>
                                  <th className="p-2  text-righttext-xs   text-slate-400 ">Loss %</th>
                                  <th className="p-2  text-righttext-xs   text-slate-400 ">Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {item.scrap.map((s) => {
                                  const value = parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0);
                                  return (
                                    <tr key={s.id}>
                                      <td className="p-2  text-xs text-slate-700">{s.item_name}</td>
                                      <td className="p-2  text-xs text-right text-slate-500">{s.input_qty}</td>
                                      <td className="p-2  text-xs text-right text-rose-500 ">{s.loss_percent}%</td>
                                      <td className="p-2  text-xs text-right  text-rose-600">₹{value.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </>
                        )}
                        
                        {/* Item Total Breakdown */}
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                           <div className="text-xs    opacity-60">Item Cost Summary</div>
                           <div className="flex gap-8">
                              <div className="text-right">
                                 <div className="text-[9px]  opacity-50 ">Total Item Cost</div>
                                 <div className="text-lg ">₹{((item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) + 
                                     item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0) + 
                                     item.operations?.reduce((sum, o) => {
                                       const cycle = parseFloat(o.cycle_time_min || 0);
                                       const setup = parseFloat(o.setup_time_min || 0);
                                       const rate = parseFloat(o.hourly_rate || 0);
                                       return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                                     }, 0) - 
                                     item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0)) || 0).toFixed(2)}</div>
                              </div>
                              <div className="text-right border-l border-white/10 pl-8">
                                 <div className="text-[9px]  opacity-50 ">Cost Per Unit</div>
                                 <div className="text-lg  text-amber-400">₹{(((item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) + 
                                     item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0) + 
                                     item.operations?.reduce((sum, o) => {
                                       const cycle = parseFloat(o.cycle_time_min || 0);
                                       const setup = parseFloat(o.setup_time_min || 0);
                                       const rate = parseFloat(o.hourly_rate || 0);
                                       return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                                     }, 0) - 
                                     item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0)) || 0) / parseFloat(item.quantity || 1)).toFixed(2)}</div>
                              </div>
                           </div>
                        </div>
                      </div>
                    ))}
                    </div>

                    {/* Overall Order Summary Breakdown */}
                    <div className="mt-8 flex justify-end">
                      <div className="w-80 bg-white border border-slate-200 rounded   overflow-hidden">
                        <div className="bg-slate-50 p-2  border-b border-slate-200">
                          <h4 className="text-xs  text-slate-700  ">Overall Cost Breakdown</h4>
                        </div>
                        <div className="p-4 space-y-3">
                          {(() => {
                            const subtotal = orderItems.reduce((total, item) => {
                              const mat = item.materials?.reduce((sum, m) => sum + (parseFloat(m.qty_per_pc || 0) * parseFloat(item.quantity) * parseFloat(m.rate || 0)), 0) || 0;
                              const comp = item.components?.reduce((sum, c) => sum + (parseFloat(c.quantity || 0) * parseFloat(c.rate || 0)), 0) || 0;
                              const labor = item.operations?.reduce((sum, o) => {
                                const cycle = parseFloat(o.cycle_time_min || 0);
                                const setup = parseFloat(o.setup_time_min || 0);
                                const rate = parseFloat(o.hourly_rate || 0);
                                return sum + (((cycle * parseFloat(item.quantity)) + setup) / 60 * rate);
                              }, 0) || 0;
                              const scrap = item.scrap?.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100) * parseFloat(s.rate || 0)), 0) || 0;
                              return total + (mat + comp + labor - scrap);
                            }, 0);
                            const gst = subtotal * 0.18;
                            const total = subtotal + gst;

                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500 ">BOM Subtotal:</span>
                                  <span className="text-slate-900 ">₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500 ">GST (18.0%):</span>
                                  <span className="text-slate-900 ">₹{gst.toFixed(2)}</span>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                  <span className="text-sm  text-slate-700">Sales Order Price:</span>
                                  <span className="text-xl font-extrabold text-emerald-600">₹{total.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowDetails(false)}
                  className="p-2 bg-white border border-slate-200 rounded  text-sm  text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <DrawingPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default BOMApproval;

