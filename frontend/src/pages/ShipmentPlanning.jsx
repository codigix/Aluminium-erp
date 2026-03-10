import { useState, useEffect, useCallback } from 'react';
import { Card, StatusBadge, Modal, FormControl, DataTable } from '../components/ui.jsx';
import { Package, Search, Truck, Calendar, User, Phone, Mail as MailIcon, CheckCircle, Clock, Save, XCircle, Eye, ListTodo, Filter, Download } from 'lucide-react';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ShipmentPlanning = ({ apiRequest }) => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedShipment, setSelectedOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  
  const [planningForm, setPlanningForm] = useState({
    planned_dispatch_date: '',
    transporter: '',
    vehicle_number: '',
    driver_name: '',
    driver_contact: '',
    driver_email: '',
    estimated_delivery_date: '',
    packing_status: 'PENDING',
    special_instructions: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    shipping_address: '',
    billing_address: ''
  });

  const fetchCustomerDetails = async (customerId) => {
    try {
      const data = await apiRequest(`/companies/${customerId}`);
      
      const primaryContact = data.contacts?.find(c => c.contact_type === 'PRIMARY') || data.contacts?.[0] || {};
      const shippingAddr = data.addresses?.find(a => a.address_type === 'SHIPPING') || {};
      const billingAddr = data.addresses?.find(a => a.address_type === 'BILLING') || {};

      setPlanningForm(prev => ({
        ...prev,
        customer_name: data.company_name || '',
        customer_phone: primaryContact.phone || '',
        customer_email: primaryContact.email || '',
        shipping_address: shippingAddr.line1 ? `${shippingAddr.line1}, ${shippingAddr.city || ''}, ${shippingAddr.state || ''} - ${shippingAddr.pincode || ''}` : '',
        billing_address: billingAddr.line1 ? `${billingAddr.line1}, ${billingAddr.city || ''}, ${billingAddr.state || ''} - ${billingAddr.pincode || ''}` : ''
      }));
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/shipments/orders');
      
      // Filter for planning page: ACCEPTED, PLANNING
      const planningData = data.filter(s => 
        ['ACCEPTED', 'PLANNING'].includes(s.shipment_status)
      );
      setShipments(planningData);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleOpenPlan = (shipment) => {
    setSelectedOrder(shipment);
    setPlanningForm({
      planned_dispatch_date: shipment.planned_dispatch_date ? new Date(shipment.planned_dispatch_date).toISOString().split('T')[0] : '',
      transporter: shipment.transporter || '',
      vehicle_number: shipment.vehicle_number || '',
      driver_name: shipment.driver_name || '',
      driver_contact: shipment.driver_contact || '',
      driver_email: shipment.driver_email || '',
      estimated_delivery_date: shipment.estimated_delivery_date ? new Date(shipment.estimated_delivery_date).toISOString().split('T')[0] : '',
      packing_status: shipment.packing_status || 'PENDING',
      special_instructions: shipment.special_instructions || '',
      customer_name: shipment.snapshot_customer_name || shipment.company_name || '',
      customer_phone: shipment.snapshot_customer_phone || '',
      customer_email: shipment.snapshot_customer_email || '',
      shipping_address: shipment.snapshot_shipping_address || '',
      billing_address: shipment.snapshot_billing_address || ''
    });

    if ((!shipment.snapshot_customer_name || !shipment.snapshot_shipping_address || !shipment.snapshot_customer_phone) && shipment.customer_id) {
      fetchCustomerDetails(shipment.customer_id);
    }
    
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      setPlanLoading(true);
      
      const payload = {
        ...planningForm,
        status: 'PLANNING'
      };

      const shipmentId = selectedShipment.id || selectedShipment.shipment_order_id;
      await apiRequest(`/shipments/orders/${shipmentId}/planning`, {
        method: 'PATCH',
        body: payload
      });

      Swal.fire('Success', 'Shipment plan saved successfully', 'success');
      setShowPlanModal(false);
      fetchShipments();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleMarkReady = async (shipmentId) => {
    const result = await Swal.fire({
      title: 'Mark as Ready for Dispatch?',
      text: 'This will move the shipment to Dispatch Management.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Ready',
      confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
      try {
        await apiRequest(`/shipments/orders/${shipmentId}/status`, {
          method: 'PATCH',
          body: { status: 'READY_TO_DISPATCH' }
        });

        Swal.fire('Ready', 'Shipment is ready for dispatch', 'success');
        fetchShipments();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleViewDetails = async (shipmentId) => {
    try {
      setViewLoading(true);
      setShowViewModal(true);
      const data = await apiRequest(`/shipments/orders/${shipmentId}`);
      setViewOrder(data);
    } catch (error) {
      console.error('Error fetching shipment details:', error);
      Swal.fire('Error', 'Could not load shipment details', 'error');
      setShowViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  const filteredShipments = shipments.filter(s => {
    const matchesSearch = 
      s.shipment_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.so_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.company_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || s.shipment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { 
      label: 'Shipment Code', 
      key: 'shipment_code',
      className: 'font-bold text-indigo-600'
    },
    { 
      label: 'SO Number', 
      key: 'so_number',
      render: (_, row) => (
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
          {row.so_number || (row.sales_order_id ? `SO-${String(row.sales_order_id).padStart(4, '0')}` : '—')}
        </span>
      )
    },
    { 
      label: 'Customer', 
      key: 'company_name',
      className: 'font-semibold text-slate-700'
    },
    { 
      label: 'Planned Date', 
      key: 'planned_dispatch_date',
      className: 'text-slate-600',
      render: (val) => val ? new Date(val).toLocaleDateString('en-IN') : 'Not Set'
    },
    { 
      label: 'Transporter', 
      key: 'transporter',
      className: 'text-slate-600',
      render: (val) => val || '—'
    },
    { 
      label: 'Vehicle', 
      key: 'vehicle_number',
      className: 'text-slate-600',
      render: (val) => val || '—'
    },
    { 
      label: 'Status', 
      key: 'shipment_status',
      className: 'text-center',
      render: (val) => <StatusBadge status={val} />
    },
    { 
      label: 'Actions', 
      key: 'actions',
      className: 'text-right',
      render: (_, shipment) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleViewDetails(shipment.id || shipment.shipment_order_id)}
            className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100"
            title="View Items"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenPlan(shipment)}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all border border-indigo-100 text-[10px] font-bold"
          >
            {shipment.shipment_status === 'ACCEPTED' ? 'Plan Shipment' : 'Edit Plan'}
          </button>
          {shipment.shipment_status === 'PLANNING' && (
            <button
              onClick={() => handleMarkReady(shipment.id || shipment.shipment_order_id)}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100 text-[10px] font-bold"
            >
              Mark Ready
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-8 bg-white/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipment Planning</h1>
          <p className="text-slate-500 text-sm mt-1">Plan and prepare shipments for dispatch.</p>
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
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Code, SO or Customer..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-all"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="PLANNING">Planning</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <Truck className="w-4 h-4 text-indigo-500" />
              <span>{filteredShipments.length} Shipments found</span>
            </div>
          </div>

          <div className="p-2">
            <DataTable 
              columns={columns}
              data={filteredShipments}
              loading={loading}
              hideHeader={true}
              emptyMessage="No shipments for planning found."
            />
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title={`Shipment Planning - ${selectedShipment?.shipment_code}`}
        size="4xl"
      >
        <form onSubmit={handleSavePlan} className="space-y-6 p-2">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 mb-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Information (Read-only)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormControl label="Customer Name">
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-500"
                  value={planningForm.customer_name}
                  readOnly
                />
              </FormControl>
              <FormControl label="Contact Number">
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-500"
                  value={planningForm.customer_phone}
                  readOnly
                />
              </FormControl>
              <FormControl label="Email Address">
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-500"
                  value={planningForm.customer_email}
                  readOnly
                />
              </FormControl>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Shipping Address">
                <textarea
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-500"
                  rows="2"
                  value={planningForm.shipping_address}
                  readOnly
                />
              </FormControl>
              <FormControl label="Billing Address">
                <textarea
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-500"
                  rows="2"
                  value={planningForm.billing_address}
                  readOnly
                />
              </FormControl>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Dispatch Schedule
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <FormControl label="Planned Dispatch Date" required>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={planningForm.planned_dispatch_date}
                    onChange={(e) => setPlanningForm({ ...planningForm, planned_dispatch_date: e.target.value })}
                    required
                  />
                </FormControl>
                <FormControl label="Est. Delivery Date">
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={planningForm.estimated_delivery_date}
                    onChange={(e) => setPlanningForm({ ...planningForm, estimated_delivery_date: e.target.value })}
                  />
                </FormControl>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                Logistics & Packing
              </h4>
              <FormControl label="Transporter Name">
                <input
                  type="text"
                  placeholder="Ex: BlueDart, FedEx, etc."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={planningForm.transporter}
                  onChange={(e) => setPlanningForm({ ...planningForm, transporter: e.target.value })}
                />
              </FormControl>
              <FormControl label="Packing Status">
                <select
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  value={planningForm.packing_status}
                  onChange={(e) => setPlanningForm({ ...planningForm, packing_status: e.target.value })}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </FormControl>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormControl label="Vehicle Number">
              <input
                type="text"
                placeholder="MH-12-AB-1234"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={planningForm.vehicle_number}
                onChange={(e) => setPlanningForm({ ...planningForm, vehicle_number: e.target.value })}
              />
            </FormControl>
            <FormControl label="Driver Name">
              <input
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={planningForm.driver_name}
                onChange={(e) => setPlanningForm({ ...planningForm, driver_name: e.target.value })}
              />
            </FormControl>
            <FormControl label="Driver Contact">
              <input
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={planningForm.driver_contact}
                onChange={(e) => setPlanningForm({ ...planningForm, driver_contact: e.target.value })}
              />
            </FormControl>
          </div>

          <FormControl label="Special Instructions">
            <textarea
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows="2"
              placeholder="Any specific delivery instructions..."
              value={planningForm.special_instructions}
              onChange={(e) => setPlanningForm({ ...planningForm, special_instructions: e.target.value })}
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              className="px-6 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={planLoading}
              className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
            >
              {planLoading ? 'Saving...' : (
                <>
                  <Save className="w-4 h-4" />
                  Save Shipment Plan
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Items Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Shipment Items - ${viewOrder?.shipment_code || ''}`}
        size="4xl"
      >
        {viewLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : viewOrder ? (
          <div className="space-y-6">
            <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">Item Details</th>
                    <th className="px-6 py-4">Warehouse</th>
                    <th className="px-6 py-4 text-center">Ready Qty</th>
                    <th className="px-6 py-4 text-center">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {viewOrder.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{item.description}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Code: {item.item_code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{item.warehouse || 'MAIN STORE'}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 text-xs">
                        {parseFloat(item.quantity || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-400 text-xs uppercase">{item.unit || 'Nos'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ShipmentPlanning;
