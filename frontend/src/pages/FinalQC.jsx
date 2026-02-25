import { useState, useEffect, useCallback } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import { Beaker, CheckCircle, XCircle, Search, Truck } from 'lucide-react';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const FinalQC = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/final-qc/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleQCAction = async (orderId, status) => {
    const result = await Swal.fire({
      title: `${status === 'PASSED' ? 'Approve' : 'Reject'} Final QC?`,
      text: status === 'PASSED' ? 'This will mark the order as Ready for Dispatch.' : 'Please provide a reason for rejection.',
      input: status === 'FAILED' ? 'textarea' : undefined,
      inputPlaceholder: 'Reason...',
      showCancelButton: true,
      confirmButtonText: status === 'PASSED' ? 'Approve' : 'Reject',
      confirmButtonColor: status === 'PASSED' ? '#10b981' : '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/final-qc/orders/${orderId}/complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status,
            remarks: result.value || ''
          })
        });

        if (response.ok) {
          Swal.fire('Success', `QC ${status} successfully`, 'success');
          fetchOrders();
        } else {
          throw new Error('Action failed');
        }
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleCreateShipment = async (orderId) => {
    const result = await Swal.fire({
      title: 'Create Shipment Order?',
      text: 'This will generate a shipment order for dispatch planning.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Create',
      cancelButtonColor: '#4f46e5',
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/final-qc/orders/${orderId}/create-shipment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          Swal.fire('Success', `Shipment Order ${data.shipmentCode} created successfully`, 'success');
          fetchOrders();
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create shipment');
        }
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.so_number || `SO-${o.id}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card title="Final Quality Control" subtitle="Post-production quality clearance and certification">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SO number or Customer..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <Beaker className="w-4 h-4 text-indigo-500" />
            <span>{filteredOrders.length} Orders Pending Inspection</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-20" />
            <p className="text-slate-500 italic">No orders pending final QC.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-4 text-left font-medium">SO Number</th>
                  <th className="px-5 py-4 text-left font-medium">Customer</th>
                  <th className="px-5 py-4 text-left font-medium">Target Dispatch</th>
                  <th className="px-5 py-4 text-left font-medium">Priority</th>
                  <th className="px-5 py-4 text-left font-medium">Status</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {order.so_number || `SO-${String(order.id).padStart(4, '0')}`}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-900">{order.company_name}</p>
                      <p className="text-slate-400 text-[10px]">{order.project_name || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {order.target_dispatch_date ? new Date(order.target_dispatch_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-semibold ${order.production_priority === 'HIGH' ? 'text-rose-600' : 'text-slate-500'}`}>
                        {order.production_priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {order.status !== 'READY_FOR_SHIPMENT' && (
                          <>
                            <button
                              onClick={() => handleQCAction(order.id, 'PASSED')}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors bg-white border border-slate-100"
                              title="Approve QC"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleQCAction(order.id, 'FAILED')}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors bg-white border border-slate-100"
                              title="Reject QC"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {order.status === 'READY_FOR_SHIPMENT' && !order.shipment_id && (
                          <button
                            onClick={() => handleCreateShipment(order.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors bg-white border border-slate-100"
                            title="Create Shipment"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {order.shipment_id && (
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                             <Truck className="w-3 h-3 mr-1" />
                             Shipment Created
                           </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FinalQC;
