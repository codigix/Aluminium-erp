import { useState, useEffect, useCallback } from 'react';
import { Card, StatusBadge, Modal } from '../components/ui.jsx';
import { Package, CheckCircle, XCircle, Search, Eye, ListTodo, Filter, Download } from 'lucide-react';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ShipmentOrders = ({ apiRequest }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/shipments/orders');
      setOrders(data);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleViewDetails = async (shipmentId) => {
    try {
      setViewLoading(true);
      setShowViewModal(true);
      const data = await apiRequest(`/shipments/orders/${shipmentId}`);
      setSelectedOrder(data);
    } catch (error) {
      console.error('Error fetching shipment details:', error);
      Swal.fire('Error', 'Could not load shipment details', 'error');
      setShowViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  const handleAction = async (shipmentId, status) => {
    const result = await Swal.fire({
      title: `${status === 'ACCEPTED' ? 'Accept' : 'Reject'} Shipment Order?`,
      text: status === 'ACCEPTED' ? 'This order will move to Shipment Planning.' : 'This will notify QC/Production of rejection.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: status === 'ACCEPTED' ? 'Accept' : 'Reject',
      confirmButtonColor: status === 'ACCEPTED' ? '#3b82f6' : '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        await apiRequest(`/shipments/orders/${shipmentId}/status`, {
          method: 'PATCH',
          body: { status }
        });

        Swal.fire('Updated', `Shipment order ${status.toLowerCase()}`, 'success');
        fetchShipments();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredOrders = orders.filter(o => 
    o.shipment_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.so_number || `SO-${o.id}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 bg-white/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipment Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track shipment-ready sales orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-400" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4 text-slate-400" />
            Export
          </button>
        </div>
      </div>

      <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Code, SO or Customer..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <Package className="w-4 h-4 text-indigo-500" />
              <span>{filteredOrders.length} Shipment Orders</span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
              <Package className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-20" />
              <p className="text-slate-500 italic">No shipment orders found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-y border-slate-100">
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Shipment Code</th>
                    <th className="px-6 py-4">SO Number</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4 text-center">Target Date</th>
                    <th className="px-6 py-4 text-center">Priority</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredOrders.map(order => (
                    <tr key={order.id || order.shipment_order_id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-indigo-600 group-hover:underline cursor-pointer">{order.shipment_code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          {order.so_number || `SO-${String(order.sales_order_id || order.id).padStart(4, '0')}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-700">{order.company_name}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs text-slate-600">{order.dispatch_target_date ? new Date(order.dispatch_target_date).toLocaleDateString('en-IN') : '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-bold ${order.priority === 'HIGH' ? 'text-rose-600' : 'text-slate-500'}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={order.shipment_status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {order.shipment_status === 'PENDING_ACCEPTANCE' && (
                            <>
                              <button
                                onClick={() => handleAction(order.id || order.shipment_order_id, 'ACCEPTED')}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                                title="Accept"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleAction(order.id || order.shipment_order_id, 'REJECTED')}
                                className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors border border-rose-100"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleViewDetails(order.id || order.shipment_order_id)}
                            className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Shipment Details - ${selectedOrder?.shipment_code || ''}`}
        size="5xl"
      >
        {viewLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : selectedOrder ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border 
                  ${selectedOrder.shipment_status === 'PENDING_ACCEPTANCE' ? 'bg-amber-50 border-amber-200 text-amber-600' : 
                    selectedOrder.shipment_status === 'ACCEPTED' ? 'bg-blue-50 border-blue-200 text-blue-600' : 
                    selectedOrder.shipment_status === 'READY_TO_DISPATCH' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                    'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  {selectedOrder.shipment_status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SO / PO Number</p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedOrder.po_number || (selectedOrder.sales_order_id ? `SO-${String(selectedOrder.sales_order_id).padStart(4, '0')}` : '—')}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</p>
                <p className="text-sm font-bold text-slate-900">{selectedOrder.company_name}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Date</p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedOrder.dispatch_target_date ? new Date(selectedOrder.dispatch_target_date).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <ListTodo className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Items Verification</h4>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-4">Item Details</th>
                      <th className="px-4 py-4">Warehouse</th>
                      <th className="px-4 py-4 text-center">Design Qty</th>
                      <th className="px-4 py-4 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedOrder.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs">{item.description || 'Unnamed Item'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Code: {item.item_code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg">
                            {item.warehouse || 'MAIN STORE'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-700 text-xs">
                          {parseFloat(item.quantity || 0).toFixed(3)}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-500 text-xs">
                          {item.unit || 'PCS'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ShipmentOrders;
