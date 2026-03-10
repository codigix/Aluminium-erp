import React, { useState, useEffect, useCallback } from 'react';
import { 
  RotateCcw, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  User,
  Eye,
  Filter,
  Download
} from 'lucide-react';
import { Card, StatusBadge, Modal, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const ShipmentReturns = ({ apiRequest }) => {
  const [returns, setReturns] = useState([]);
  const [stats, setStats] = useState({ total: 0, initiated: 0, in_transit: 0, received: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [returnsData, statsData] = await Promise.all([
        apiRequest('/shipments/returns'),
        apiRequest('/shipments/returns/stats')
      ]);
      setReturns(Array.isArray(returnsData) ? returnsData : []);
      setStats(statsData || { total: 0, initiated: 0, in_transit: 0, received: 0, completed: 0 });
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewDetails = async (id) => {
    try {
      setViewLoading(true);
      setShowViewModal(true);
      const data = await apiRequest(`/shipments/returns/${id}`);
      setSelectedReturn(data);
    } catch (error) {
      Swal.fire('Error', 'Could not load return details', 'error');
      setShowViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  const handleUpdateStatus = async (id, nextStatus, label) => {
    const { isConfirmed } = await Swal.fire({
      title: `${label}?`,
      text: `Are you sure you want to mark this return as ${nextStatus.replace(/_/g, ' ')}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Proceed',
      confirmButtonColor: '#4f46e5'
    });

    if (isConfirmed) {
      try {
        let payload = { status: nextStatus };
        
        if (nextStatus === 'RETURN_RECEIVED') {
          const { value: condition } = await Swal.fire({
            title: 'Select Item Condition',
            input: 'select',
            inputOptions: {
              'GOOD': 'Good (Restock)',
              'DAMAGED': 'Damaged (Scrap)',
              'WRONG_ITEM': 'Wrong Item',
              'CANCELLED': 'Cancelled'
            },
            inputPlaceholder: 'Select condition',
            showCancelButton: true
          });
          if (!condition) return;
          payload.condition_status = condition;
          payload.received_date = new Date().toISOString().split('T')[0];
        }

        await apiRequest(`/shipments/returns/${id}/status`, {
          method: 'PATCH',
          body: payload
        });

        Swal.fire('Updated', 'Return status updated successfully', 'success');
        fetchData();
        if (selectedReturn && selectedReturn.id === id) {
          handleViewDetails(id);
        }
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const kpis = [
    { label: 'Total Returns', value: stats.total, icon: RotateCcw, color: 'bg-slate-50 text-slate-600' },
    { label: 'Initiated', value: stats.initiated, icon: Clock, color: 'bg-blue-50 text-blue-600' },
    { label: 'In Transit', value: stats.in_transit, icon: Truck, color: 'bg-orange-50 text-orange-600' },
    { label: 'Received', value: stats.received, icon: Package, color: 'bg-purple-50 text-purple-600' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
  ];

  const columns = [
    {
      label: 'Return Code',
      key: 'return_code',
      sortable: true,
      className: 'font-bold text-indigo-600'
    },
    {
      label: 'Shipment Reference',
      key: 'shipment_code',
      sortable: true,
      className: 'font-medium text-slate-500'
    },
    {
      label: 'Customer',
      key: 'customer_name',
      sortable: true,
      className: 'font-semibold text-slate-700'
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleViewDetails(row.id)}
            className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-8 bg-white/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipment Returns</h1>
          <p className="text-slate-500 text-sm mt-1">Manage sales returns and RTOs (Reverse Logistics).</p>
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

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="p-4 bg-white border border-slate-100 shadow-sm rounded-3xl flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
              <p className="text-xl font-black text-slate-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
        <div className="p-6">
          <DataTable 
            columns={columns}
            data={returns}
            loading={loading}
            pageSize={5}
            searchPlaceholder="Search by code, customer, or reference..."
            emptyMessage="No shipment returns found."
          />
        </div>
      </Card>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Return Details - ${selectedReturn?.return_code || ''}`}
        size="5xl"
      >
        {viewLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : selectedReturn ? (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedReturn.return_code}</h2>
                  <StatusBadge status={selectedReturn.status} />
                </div>
                <p className="text-slate-500 text-sm font-medium">Origin Shipment: <span className="font-bold text-indigo-600 uppercase">{selectedReturn.shipment_code}</span></p>
              </div>
              <div className="flex gap-2">
                {selectedReturn.status === 'RETURN_INITIATED' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedReturn.id, 'RETURN_PICKUP_ASSIGNED', 'Assign Pickup')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    Assign Pickup
                  </button>
                )}
                {selectedReturn.status === 'RETURN_PICKUP_ASSIGNED' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedReturn.id, 'RETURN_IN_TRANSIT', 'Start Transit')}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-all"
                  >
                    Mark In-Transit
                  </button>
                )}
                {selectedReturn.status === 'RETURN_IN_TRANSIT' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedReturn.id, 'RETURN_RECEIVED', 'Receive Items')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all"
                  >
                    Receive & Inspect
                  </button>
                )}
                {selectedReturn.status === 'RETURN_RECEIVED' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedReturn.id, 'RETURN_COMPLETED', 'Complete Return')}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all"
                  >
                    Complete Process
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reason</p>
                <p className="text-xs font-black text-slate-700">{selectedReturn.reason}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pickup Date</p>
                <p className="text-xs font-black text-slate-700">{selectedReturn.pickup_date ? new Date(selectedReturn.pickup_date).toLocaleDateString('en-IN') : 'TBD'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Condition</p>
                <p className="text-xs font-black text-slate-700">{selectedReturn.condition_status || 'Pending Inspection'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Refund Amount</p>
                <p className="text-xs font-black text-indigo-600">₹{parseFloat(selectedReturn.refund_amount || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
              {/* Customer Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Customer Information</h4>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Customer Name</p>
                    <p className="text-xs font-black text-slate-700 uppercase">{selectedReturn.customer_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Vehicle</p>
                      <p className="text-xs font-black text-slate-700 uppercase">{selectedReturn.vehicle_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Driver</p>
                      <p className="text-xs font-black text-slate-700 uppercase">{selectedReturn.driver_name || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Return Timeline</h4>
                </div>
                <div className="space-y-4 relative before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  <div className="relative pl-8">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${selectedReturn.created_at ? 'bg-green-500' : 'bg-slate-200'}`} />
                    <p className="text-[10px] font-black text-slate-700">Return Initiated</p>
                    <p className="text-[9px] text-slate-400 font-bold">{selectedReturn.created_at ? new Date(selectedReturn.created_at).toLocaleString('en-IN') : '—'}</p>
                  </div>
                  <div className="relative pl-8">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${selectedReturn.pickup_date ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                    <p className="text-[10px] font-black text-slate-700">Pickup Scheduled</p>
                    <p className="text-[9px] text-slate-400 font-bold">{selectedReturn.pickup_date ? new Date(selectedReturn.pickup_date).toLocaleDateString('en-IN') : 'Awaiting Schedule'}</p>
                  </div>
                  <div className="relative pl-8">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${selectedReturn.received_date ? 'bg-purple-500' : 'bg-slate-200'}`} />
                    <p className="text-[10px] font-black text-slate-700">Received & Inspected</p>
                    <p className="text-[9px] text-slate-400 font-bold">{selectedReturn.received_date ? new Date(selectedReturn.received_date).toLocaleDateString('en-IN') : 'Pending Receipt'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ShipmentReturns;