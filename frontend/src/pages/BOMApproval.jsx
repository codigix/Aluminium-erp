import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const BOMApproval = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
  
  // Modal for viewing BOM items
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      
      if (activeTab === 'pending') {
        setOrders(data.filter(order => order.status === 'BOM_SUBMITTED'));
      } else {
        setOrders(data.filter(order => 
          ['BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION'].includes(order.status)
        ));
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

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
      Swal.fire('Error', 'Failed to load BOM details', 'error');
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
          body: JSON.stringify({ status: 'BOM_APPROVED' })
        });

        if (!response.ok) throw new Error('Failed to approve BOM');
        Swal.fire('Approved!', 'BOM has been approved.', 'success');
        fetchSubmittedBOMs();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">BOM Approval</h1>
          <p className="text-sm text-slate-500">Review and approve finalized Bill of Materials</p>
        </div>
        <button 
          onClick={fetchOrders}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Pending Approval
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Approval History
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">PO / SO Ref</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Customer / Project</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-500">Loading BOMs...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400 italic">No {activeTab === 'pending' ? 'pending' : 'approved'} BOMs found</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{order.po_number || 'N/A'}</div>
                      <div className="text-[10px] text-slate-500">SO-{String(order.id).padStart(4, '0')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{order.company_name}</div>
                      <div className="text-xs text-slate-500">{order.project_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${order.status === 'BOM_SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button 
                        onClick={() => handleViewBOM(order)}
                        className="text-indigo-600 hover:text-indigo-900 font-bold"
                      >
                        View Details
                      </button>
                      {activeTab === 'pending' && (
                        <button 
                          onClick={() => handleApproveBOM(order.id)}
                          className="text-emerald-600 hover:text-emerald-900 font-bold"
                        >
                          Approve
                        </button>
                      )}
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
            
            <div className="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">BOM Details: PO {selectedOrder?.po_number}</h3>
                  <p className="text-xs text-slate-500">{selectedOrder?.company_name} - {selectedOrder?.project_name}</p>
                </div>
                <button onClick={() => setShowDetails(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {detailsLoading ? (
                  <div className="py-12 text-center text-slate-500">Loading details...</div>
                ) : (
                  <div className="space-y-6">
                    {orderItems.map((item) => (
                      <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                          <div>
                            <span className="text-sm font-bold text-slate-900">{item.item_code}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span className="text-xs text-slate-600">{item.description}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-500">
                            QTY: {item.quantity} {item.unit}
                          </div>
                        </div>
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Material Name</th>
                              <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Type</th>
                              <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Total Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.materials?.length > 0 ? (
                              item.materials.map((mat) => (
                                <tr key={mat.id}>
                                  <td className="px-4 py-2 text-xs text-slate-700">{mat.material_name}</td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{mat.material_type}</td>
                                  <td className="px-4 py-2 text-xs text-right">
                                    <div className="font-bold text-indigo-600">
                                      {(parseFloat(mat.qty_per_pc) * parseFloat(item.quantity)).toFixed(4)} {mat.uom}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-medium">
                                      {parseFloat(mat.qty_per_pc).toFixed(4)} {mat.uom} / pc
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="4" className="px-4 py-4 text-center text-xs text-slate-400 italic">No materials defined for this item</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowDetails(false)}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMApproval;
