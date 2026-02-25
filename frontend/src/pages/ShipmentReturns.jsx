import React, { useState, useEffect, useCallback } from 'react';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  Download, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Phone,
  Calendar,
  Info,
  ChevronRight,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';
import { Card, StatusBadge, Modal } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const ShipmentReturns = ({ apiRequest }) => {
  const [returns, setReturns] = useState([]);
  const [stats, setStats] = useState({ total: 0, initiated: 0, in_transit: 0, received: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [returnsData, statsData] = await Promise.all([
        apiRequest('/shipments/returns'),
        apiRequest('/shipments/returns/stats')
      ]);
      setReturns(returnsData);
      setStats(statsData);
      
      if (returnsData.length > 0 && !selectedReturn) {
        handleViewDetails(returnsData[0].id);
      }
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
      const data = await apiRequest(`/shipments/returns/${id}`);
      setSelectedReturn(data);
    } catch (error) {
      Swal.fire('Error', 'Could not load return details', 'error');
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

  const filteredReturns = returns.filter(r => 
    r.return_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.shipment_code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Returns List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search returns..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-1 custom-scrollbar">
            {loading ? (
               Array(5).fill(0).map((_, i) => (
                 <div key={i} className="h-24 bg-white/50 border border-slate-100 rounded-3xl animate-pulse" />
               ))
            ) : filteredReturns.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No returns found</p>
              </div>
            ) : (
              filteredReturns.map((r) => (
                <div 
                  key={r.id}
                  onClick={() => handleViewDetails(r.id)}
                  className={`p-4 rounded-3xl cursor-pointer transition-all border-2 group ${
                    selectedReturn?.id === r.id 
                      ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' 
                      : 'bg-white border-transparent hover:border-slate-100 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tighter">{r.return_code}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{r.shipment_code}</p>
                    </div>
                    <StatusBadge status={r.status} size="xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 uppercase">
                      {(r.customer_name || 'U').charAt(0)}
                    </div>
                    <p className="text-[10px] font-black text-slate-700 truncate uppercase flex-1">{r.customer_name}</p>
                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedReturn?.id === r.id ? 'translate-x-1 text-indigo-400' : ''}`} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Details Panel */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden h-full min-h-[500px] flex flex-col">
            {selectedReturn ? (
              <>
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                  <div className="flex justify-between items-start mb-6">
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
                </div>

                <div className="flex-1 p-8 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                          <p className="text-[9px] text-slate-400 font-bold">{new Date(selectedReturn.created_at).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="relative pl-8">
                          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${selectedReturn.received_date ? 'bg-green-500' : 'bg-slate-200'}`} />
                          <p className="text-[10px] font-black text-slate-700">Received at Warehouse</p>
                          <p className="text-[9px] text-slate-400 font-bold">{selectedReturn.received_date ? new Date(selectedReturn.received_date).toLocaleDateString('en-IN') : 'Awaiting'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Return Items */}
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Returned Items</h4>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <th className="px-6 py-4">Item Code</th>
                            <th className="px-6 py-4 text-center">Returned Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedReturn.items?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-900 text-xs">{item.item_code}</span>
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-slate-700 text-xs">
                                {parseFloat(item.quantity).toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mb-6">
                  <RotateCcw className="w-10 h-10 opacity-10" />
                </div>
                <h3 className="font-black text-lg text-slate-400 uppercase tracking-tighter mb-2">Select a Return</h3>
                <p className="text-sm font-medium text-slate-400 max-w-[240px]">Choose a return record from the left to view full details and processing options.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShipmentReturns;
