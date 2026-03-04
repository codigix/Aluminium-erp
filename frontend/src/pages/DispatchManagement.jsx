import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  MapPin, 
  CheckCircle, 
  Search, 
  Plus, 
  Filter, 
  Download,
  Eye,
  ChevronRight,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Package,
  Calendar,
  ListTodo,
  X
} from 'lucide-react';
import { Card, StatusBadge, Modal } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DispatchManagement = ({ apiRequest }) => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchDispatches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/shipments/orders');
      
      // Filter for dispatch management: READY_TO_DISPATCH, DISPATCHED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, CLOSED
      const dispatchData = data.filter(s => 
        ['READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'].includes(s.shipment_status)
      );
      setDispatches(dispatchData);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  const handleStatusUpdate = async (id, nextStatus, label) => {
    if (!id) {
      Swal.fire('Error', 'Invalid Shipment ID', 'error');
      return;
    }

    const result = await Swal.fire({
      title: `${label}?`,
      text: `Are you sure you want to mark this shipment as ${nextStatus.replace(/_/g, ' ')}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Proceed',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      try {
        await apiRequest(`/shipments/orders/${id}/status`, {
          method: 'PATCH',
          body: { status: nextStatus }
        });

        Swal.fire({
          title: 'Updated',
          text: `Shipment status updated to ${nextStatus.replace(/_/g, ' ')}`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        fetchDispatches();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleView = async (id) => {
    if (!id) return;
    try {
      setViewLoading(true);
      setShowViewModal(true);
      const data = await apiRequest(`/shipments/orders/${id}`);
      setSelectedItem(data);
    } catch (error) {
      console.error('Error fetching details:', error);
      Swal.fire('Error', 'Could not load details', 'error');
      setShowViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  const getStatusCounts = () => {
    return {
      dispatched: dispatches.filter(d => d.shipment_status === 'DISPATCHED').length,
      inTransit: dispatches.filter(d => d.shipment_status === 'IN_TRANSIT').length,
      outForDelivery: dispatches.filter(d => d.shipment_status === 'OUT_FOR_DELIVERY').length,
      delivered: dispatches.filter(d => d.shipment_status === 'DELIVERED').length,
      closed: dispatches.filter(d => d.shipment_status === 'CLOSED').length
    };
  };

  const statusCounts = getStatusCounts();

  const statusCards = [
    {
      id: 'dispatched',
      label: 'Dispatched',
      count: statusCounts.dispatched,
      description: 'Shipment dispatched from warehouse',
      icon: Truck,
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-100'
    },
    {
      id: 'in-transit',
      label: 'In Transit',
      count: statusCounts.inTransit,
      description: 'Shipment in transit to destination',
      icon: MapPin,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-100'
    },
    {
      id: 'out-for-delivery',
      label: 'Out for Delivery',
      count: statusCounts.outForDelivery,
      description: 'Out for final delivery',
      icon: Truck,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-100'
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: statusCounts.delivered,
      description: 'Successfully delivered to customer',
      icon: CheckCircle,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-100'
    },
    {
      id: 'closed',
      label: 'Closed',
      count: statusCounts.closed,
      description: 'Shipment completed and closed',
      icon: CheckCircle,
      bgColor: 'bg-slate-50',
      iconColor: 'text-slate-600',
      borderColor: 'border-slate-100'
    }
  ];

  useEffect(() => {
    fetchDispatches();
  }, [fetchDispatches]);

  const filteredDispatches = dispatches.filter(d => 
    d.shipment_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.so_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionButton = (item) => {
    const shipmentId = item.id || item.shipment_order_id;
    
    const handleInitiateReturn = async () => {
      const { value: reason } = await Swal.fire({
        title: 'Initiate Return',
        input: 'textarea',
        inputLabel: 'Reason for Return',
        inputPlaceholder: 'Type reason...',
        showCancelButton: true,
        confirmButtonText: 'Initiate',
        confirmButtonColor: '#ef4444'
      });

      if (reason) {
        try {
          await apiRequest('/shipments/returns', {
            method: 'POST',
            body: {
              shipment_id: shipmentId,
              reason: reason
            }
          });

          Swal.fire('Success', 'Return initiated', 'success');
          fetchDispatches();
        } catch (error) {
          Swal.fire('Error', error.message, 'error');
        }
      }
    };

    switch (item.shipment_status) {
      case 'READY_TO_DISPATCH':
        return (
          <button 
            onClick={() => handleStatusUpdate(shipmentId, 'DISPATCHED', 'Start Dispatch')}
            className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all"
          >
            Start Dispatch
          </button>
        );
      case 'DISPATCHED':
        return (
          <button 
            onClick={() => handleStatusUpdate(shipmentId, 'IN_TRANSIT', 'Move to In Transit')}
            className="px-3 py-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-700 transition-all"
          >
            In Transit
          </button>
        );
      case 'IN_TRANSIT':
        return (
          <button 
            onClick={() => handleStatusUpdate(shipmentId, 'OUT_FOR_DELIVERY', 'Mark Out for Delivery')}
            className="px-3 py-1.5 bg-orange-600 text-white text-[10px] font-bold rounded-lg hover:bg-orange-700 transition-all"
          >
            Out for Delivery
          </button>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <div className="flex gap-2">
            <button 
              onClick={() => handleStatusUpdate(shipmentId, 'DELIVERED', 'Mark Delivered')}
              className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all"
            >
              Mark Delivered
            </button>
            <button 
              onClick={handleInitiateReturn}
              className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-100 transition-all border border-rose-100"
            >
              Return
            </button>
          </div>
        );
      case 'DELIVERED':
        return (
          <div className="flex gap-2">
            <button 
              onClick={() => handleStatusUpdate(shipmentId, 'CLOSED', 'Close Shipment')}
              className="px-3 py-1.5 bg-slate-700 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all"
            >
              Close
            </button>
            <button 
              onClick={handleInitiateReturn}
              className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-100 transition-all border border-rose-100"
            >
              Return
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-8 bg-white/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatch Management</h1>
          <p className="text-slate-500 text-sm mt-1">Coordinate vehicle dispatch and loading.</p>
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
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 active:scale-95">
            <Plus className="w-4 h-4" />
            Create Dispatch
          </button>
        </div>
      </div>

      {/* KPI Stats / Stepper Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
        {statusCards.map((card, index) => (
          <React.Fragment key={card.id}>
            <div className="flex flex-col items-center text-center min-w-[140px] group cursor-pointer">
              <div className={`w-14 h-14 ${card.bgColor} rounded-full flex items-center justify-center mb-4 border-2 ${card.borderColor} shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{card.label}</h3>
              <p className="text-2xl font-bold text-slate-900 mb-1">{card.count}</p>
              <p className="text-[10px] text-slate-400 max-w-[120px] leading-tight font-medium">{card.description}</p>
            </div>
            {index < statusCards.length - 1 && (
              <div className="hidden md:flex items-center justify-center px-2">
                <ChevronRight className="w-5 h-5 text-slate-200" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table Section */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search shipments, orders, customers..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                   <Truck className="w-4 h-4 text-indigo-500" />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Shipments: {dispatches.length}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-y border-slate-100">
                    <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Shipment ID</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Order No</th>
                      <th className="px-6 py-4 text-center">Dispatch Date</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4">Driver</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="text-xs text-slate-400">Loading shipments...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredDispatches.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-300">
                            <Truck className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-medium">No shipments found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDispatches.map((item) => (
                        <tr key={item.id || item.shipment_order_id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-indigo-600 group-hover:underline cursor-pointer">{item.shipment_code}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-semibold text-slate-700">{item.company_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                              {item.so_number || (item.sales_order_id ? `SO-${String(item.sales_order_id).padStart(4, '0')}` : '—')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs text-slate-600">{item.planned_dispatch_date ? new Date(item.planned_dispatch_date).toLocaleDateString('en-IN') : '—'}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <StatusBadge status={item.shipment_status} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {(item.driver_name || 'U').charAt(0)}
                              </div>
                              <span className="text-xs font-medium text-slate-600">{item.driver_name || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {getActionButton(item)}
                              <button 
                                onClick={() => handleView(item.id || item.shipment_order_id)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>

        {/* Side Panel / Summary Section */}
        <div className="space-y-6">
          <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
            <div className="p-6 space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-50 pb-4">Today's Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Dispatched</p>
                      <p className="text-sm font-bold text-slate-900">{statusCounts.dispatched} Shipments</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pending</p>
                      <p className="text-sm font-bold text-slate-900">{statusCounts.inTransit + statusCounts.outForDelivery} Deliveries</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Delivered</p>
                      <p className="text-sm font-bold text-slate-900">{statusCounts.delivered} Completed</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Delivery Time</p>
                  <p className="text-xl font-bold text-slate-900">1.2 Days</p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '85%' }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">On schedule for 94% of orders</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* View Details Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Dispatch Details - ${selectedItem?.shipment_code || ''}`}
        size="5xl"
      >
        {viewLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : selectedItem ? (
          <div className="space-y-8 p-2">
            {/* Status Stepper */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              {['READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((status, idx) => {
                const isCompleted = ['READY_TO_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].indexOf(selectedItem.shipment_status) >= idx;
                return (
                  <div key={status} className="flex flex-col items-center relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <span>{idx + 1}</span>}
                    </div>
                    <span className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${isCompleted ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    {idx < 4 && (
                      <div className={`absolute top-4 left-[60%] w-full h-[2px] -z-0 ${isCompleted ? 'bg-indigo-600' : 'bg-slate-100'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Shipment & Customer Info */}
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-500" />
                    Shipment Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Order Number</p>
                      <p className="text-sm font-bold text-slate-900">{selectedItem.so_number || (selectedItem.sales_order_id ? `SO-${String(selectedItem.sales_order_id).padStart(4, '0')}` : '—')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Target Date</p>
                      <p className="text-sm font-bold text-slate-900">{selectedItem.dispatch_target_date ? new Date(selectedItem.dispatch_target_date).toLocaleDateString('en-IN') : '—'}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200/50">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Customer Details</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{selectedItem.customer_name || selectedItem.company_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs">{selectedItem.customer_phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="text-xs">{selectedItem.customer_email || 'N/A'}</span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-500 pt-2">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span className="text-xs leading-relaxed">{selectedItem.shipping_address || 'Address not set'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transport Info */}
                <div className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-500" />
                    Logistics & Transport
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase text-xs">Transporter</p>
                      <p className="text-sm font-bold text-slate-900">{selectedItem.transporter || 'Self Managed'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Vehicle Number</p>
                      <div className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 w-fit uppercase">
                        {selectedItem.vehicle_number || 'Pending'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Driver Name</p>
                      <p className="text-sm font-bold text-slate-900">{selectedItem.driver_name || 'Unassigned'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Driver Contact</p>
                      <p className="text-sm font-bold text-slate-900">{selectedItem.driver_contact || 'N/A'}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Driver Email</p>
                      <p className="text-sm font-bold text-slate-900">{selectedItem.driver_email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-6">
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-indigo-500" />
                      Items to Dispatch
                    </h4>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[400px]">
                    <table className="w-full text-left">
                      <thead className="bg-white sticky top-0 border-b border-slate-50">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-3">Item Details</th>
                          <th className="px-6 py-3 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedItem.items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-slate-900 leading-tight">{item.description}</p>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Code: {item.item_code}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="text-xs font-bold text-indigo-600">{item.quantity} <span className="text-[10px] text-slate-400">{item.unit}</span></p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedItem.special_instructions && (
                    <div className="p-6 bg-amber-50 border-t border-amber-100 mt-auto">
                      <p className="text-[10px] text-amber-600 font-bold uppercase flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Special Instructions
                      </p>
                      <p className="text-xs text-amber-700 leading-relaxed font-medium italic">
                        "{selectedItem.special_instructions}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-8 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                Close Details
              </button>
              {selectedItem.shipment_status === 'READY_TO_DISPATCH' && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleStatusUpdate(selectedItem.shipment_order_id, 'DISPATCHED', 'Start Dispatch');
                  }}
                  className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  Dispatch Now
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DispatchManagement;
