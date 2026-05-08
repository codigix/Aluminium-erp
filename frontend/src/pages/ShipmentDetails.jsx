import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Inbox, CheckCircle2, Package, Truck, 
  ArrowLeft, Printer, Download, Search, AlertCircle, Eye, 
  CheckCircle, XCircle, Clock, ChevronRight, Filter, RotateCcw,
  User, Users, Box, ClipboardList, Info, FileSpreadsheet, Paperclip,
  MapPin, Calendar, CreditCard, Activity, ArrowRight, Share2, MoreVertical
} from 'lucide-react';
import { Card, StatusBadge, Button } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ShipmentDetails = () => {
  const { shipmentId: paramShipmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract ID from URL if not available in params
  const segments = location.pathname.split('/').filter(Boolean);
  const shipmentId = paramShipmentId || segments[segments.length - 1];
  
  const [loading, setLoading] = useState(true);
  const [shipmentData, setShipmentData] = useState(null);
  const [challanData, setChallanData] = useState(null);

  useEffect(() => {
    fetchData();
  }, [shipmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      const res = await fetch(`${API_BASE}/shipments/orders/${shipmentId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch Shipment details');
      const data = await res.json();
      setShipmentData(data);

      // Fetch delivery challan for this shipment
      try {
        const dcRes = await fetch(`${API_BASE}/delivery-challans`, { headers });
        if (dcRes.ok) {
          const challans = await dcRes.json();
          const shipmentChallan = challans.find(c => String(c.shipment_id) === String(shipmentId));
          if (shipmentChallan) {
            setChallanData(shipmentChallan);
          }
        }
      } catch (dcError) {
        console.error('Error fetching delivery challan:', dcError);
      }
    } catch (error) {
      console.error('Error fetching shipment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintChallan = async () => {
    if (!challanData && !shipmentData) return;

    try {
      Swal.fire({
        title: 'Preparing Print...',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
      });

      const token = localStorage.getItem('authToken');
      let fullChallan = challanData;

      // If we have a challan ID, fetch full details including items
      if (challanData && challanData.id) {
        const response = await fetch(`${API_BASE}/delivery-challans/${challanData.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          fullChallan = await response.json();
        }
      } else {
        // Fallback: use shipment data to construct a temporary challan view
        fullChallan = {
          challan_number: `DC-TEMP-${shipmentData.shipment_code}`,
          shipment_code: shipmentData.shipment_code,
          customer_name: shipmentData.company_name,
          snapshot_customer_name: shipmentData.snapshot_customer_name,
          snapshot_customer_phone: shipmentData.snapshot_customer_phone,
          snapshot_customer_email: shipmentData.snapshot_customer_email,
          snapshot_shipping_address: shipmentData.snapshot_shipping_address,
          snapshot_billing_address: shipmentData.snapshot_billing_address,
          transporter: shipmentData.transporter,
          vehicle_number: shipmentData.vehicle_number,
          driver_name: shipmentData.driver_name,
          dispatch_time: shipmentData.planned_dispatch_date,
          items: shipmentData.items || []
        };
      }

      Swal.close();

      if (!fullChallan) {
        Swal.fire('Error', 'Could not load challan details', 'error');
        return;
      }

      const totalQty = fullChallan.items?.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(0);
      const dispatchDate = fullChallan.dispatch_time ? new Date(fullChallan.dispatch_time).toLocaleDateString('en-IN') : '—';
      const dispatchTime = fullChallan.dispatch_time ? new Date(fullChallan.dispatch_time).toLocaleTimeString('en-IN') : '—';

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Delivery Challan - ${fullChallan.challan_number}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; font-family: 'Roboto', sans-serif; }
              .print-container { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; }
            </style>
          </head>
          <body>
            <div class="print-container flex flex-col">
              <!-- Header -->
              <div class="bg-[#4f6ebc] text-white p-8 text-center">
                <h1 class="text-xl font-bold mb-1">SPTECHPIONEER PRIVATE LIMITED</h1>
                <p class="text-xs opacity-90 ">MIDC Bhosari, Pune – 411026, Maharashtra</p>
                <p class="text-xs opacity-80 mt-1">GSTIN: 27ABCDE1234F1Z5 | Phone: +91-9876543210 | Email: info@sptech.com</p>
              </div>

              <!-- Title Section -->
              <div class="px-10 py-6 flex justify-between items-end border-b-2 border-slate-100">
                <h2 class="text-xl font-bold text-[#1e3a8a] ">DELIVERY CHALLAN</h2>
                <div class="text-right space-y-1">
                  <p class="text-xs font-bold text-slate-400  ">Challan No: <span class="text-slate-900 ml-2">${fullChallan.challan_number}</span></p>
                  <p class="text-xs font-bold text-slate-400  ">Date: <span class="text-slate-900 ml-2">${dispatchDate}</span></p>
                  <p class="text-xs font-bold text-slate-400  ">Shipment: <span class="text-slate-900 ml-2">${fullChallan.shipment_code}</span></p>
                </div>
              </div>

              <div class="p-10 space-y-2 flex-1">
                <!-- Info Cards Grid -->
                <div class="grid grid-cols-2 gap-8">
                  <div class="space-y-2">
                    <div class="border border-slate-100 rounded overflow-hidden bg-slate-50/30">
                      <div class="bg-slate-50 p-2 text-xs font-bold text-slate-500   border-b border-slate-100">Bill To:</div>
                      <div class="p-5 space-y-3">
                        <p class="text-lg font-bold text-[#1e3a8a] leading-none mb-2">${fullChallan.snapshot_customer_name || fullChallan.customer_name}</p>
                        <div class="space-y-1 text-xs font-medium text-slate-600">
                          <p><span class="w-16 inline-block text-xs text-slate-400 font-bold ">GSTIN:</span> ${fullChallan.snapshot_customer_gst || '27XXXXX1234Z1A1'}</p>
                          <p><span class="w-16 inline-block text-xs text-slate-400 font-bold ">Contact:</span> ${fullChallan.snapshot_customer_phone || 'N/A'}</p>
                          <p><span class="w-16 inline-block text-xs text-slate-400 font-bold ">Email:</span> ${fullChallan.snapshot_customer_email || 'N/A'}</p>
                        </div>
                        <div class="pt-3 border-t border-slate-100 mt-3">
                          <p class="text-xs font-bold text-slate-400   mb-1">Billing Address:</p>
                          <p class="text-xs font-medium text-slate-600 leading-relaxed">${fullChallan.snapshot_billing_address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    <div class="border border-slate-100 rounded overflow-hidden bg-slate-50/30">
                      <div class="bg-slate-50 p-2 text-xs font-bold text-slate-500   border-b border-slate-100">Ship To:</div>
                      <div class="p-5 text-xs font-medium text-slate-600 leading-relaxed">${fullChallan.snapshot_shipping_address || 'Address not set'}</div>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <div class="border border-slate-100 rounded overflow-hidden bg-slate-50/30">
                      <div class="bg-slate-50 p-2 text-xs font-bold text-slate-500   border-b border-slate-100">Transport Details:</div>
                      <div class="p-5 space-y-3">
                        <div class="flex justify-between items-center text-xs font-medium text-slate-600">
                          <span class="text-xs text-slate-400 font-bold ">Transporter:</span>
                          <span>${fullChallan.transporter || '—'}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs font-medium text-slate-600">
                          <span class="text-xs text-slate-400 font-bold ">Vehicle No:</span>
                          <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">${fullChallan.vehicle_number || '—'}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs font-medium text-slate-600">
                          <span class="text-xs text-slate-400 font-bold ">Driver Name:</span>
                          <span>${fullChallan.driver_name || '—'}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs font-medium text-slate-600">
                          <span class="text-xs text-slate-400 font-bold ">Dispatch Time:</span>
                          <span>${dispatchTime}</span>
                        </div>
                        <div class="mt-6 pt-6 border-t-2 border-slate-100 grid grid-cols-2 gap-2 text-center">
                          <div class="bg-indigo-50/50 p-2 rounded font-bold border border-indigo-100">
                            <p class="text-[8px] font-bold text-indigo-400  ">Total Qty</p>
                            <p class="text-lg font-bold text-[#1e3a8a]">${totalQty} <span class="text-xs">PCS</span></p>
                          </div>
                          <div class="bg-indigo-50/50 p-2 rounded font-bold border border-indigo-100">
                            <p class="text-[8px] font-bold text-indigo-400  ">Total Weight</p>
                            <p class="text-lg font-bold text-[#1e3a8a]">200 <span class="text-xs">KG</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Items Table -->
                <div class="border-2 border-slate-100 rounded overflow-hidden mt-8">
                  <table class="w-full text-left">
                    <thead class="bg-[#e0e7ff] text-[#1e3a8a]">
                      <tr class="text-xs font-bold  ">
                        <th class=" p-2 w-12 text-center border-r border-slate-200/50">Sr</th>
                        <th class=" p-2 w-32 border-r border-slate-200/50">Item Code</th>
                        <th class=" p-2 border-r border-slate-200/50">Description</th>
                        <th class=" p-2 w-20 text-center border-r border-slate-200/50">HSN</th>
                        <th class=" p-2 w-20 text-right border-r border-slate-200/50">Qty</th>
                        <th class=" p-2 w-20 text-center">Unit</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      ${fullChallan.items?.map((item, idx) => `
                        <tr>
                          <td class=" p-2 text-center border-r border-slate-50 text-slate-400">${idx + 1}</td>
                          <td class=" p-2 border-r border-slate-50 font-bold text-[#1e3a8a]">${item.item_code}</td>
                          <td class=" p-2 border-r border-slate-50">${item.description}</td>
                          <td class=" p-2 text-center border-r border-slate-50 text-slate-500">732690</td>
                          <td class=" p-2 text-right border-r border-slate-50 font-bold">${Number(item.quantity).toFixed(0)}</td>
                          <td class=" p-2 text-center text-slate-500">PCS</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <div class="bg-[#fffbeb] border-2 border-[#fde68a] p-2 rounded font-medium mt-8 relative">
                  <h4 class="text-xs font-bold text-[#92400e]   mb-2">Remarks:</h4>
                  <p class="text-xs font-medium text-[#b45309] leading-relaxed italic">"${fullChallan.remarks || 'Material sent for delivery. Please check items and quantities before receiving.'}"</p>
                </div>

                <div class="grid grid-cols-5 gap-8 mt-12 mb-10">
                  <div class="col-span-3 border-2 border-slate-100 rounded font-bold p-2 space-y-2">
                    <h4 class="text-xs font-bold text-slate-400  ">Received By:</h4>
                    <div class="grid grid-cols-2 gap-x-10 gap-y-6">
                      ${['Name', 'Mobile', 'Date / Time', 'Signature'].map(label => `
                        <div class="space-y-1">
                          <p class="text-xs text-slate-400 font-bold ">${label}:</p>
                          <div class="border-b border-dotted border-slate-300 h-6"></div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                  <div class="col-span-2 border-2 border-slate-100 rounded font-bold p-2 flex flex-col items-center justify-between text-center bg-slate-50/30">
                    <h4 class="text-xs font-bold text-slate-400  ">For SPTECHPIONEER PVT LTD</h4>
                    <div class="py-8 opacity-10">
                      <div class="w-5 h-5 border-4 border-indigo-200 rounded flex items-center justify-center">
                        <span class="text-xl font-bold  text-indigo-200">SP</span>
                      </div>
                    </div>
                    <div class="space-y-1">
                      <p class="text-sm font-bold text-[#1e3a8a]">Authorized Signatory</p>
                      <p class="text-xs text-slate-400 font-bold  ">Computer Generated</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-slate-100 p-2 text-center mt-auto">
                <p class="text-xs font-bold text-slate-500 font-bold tracking-[0.3em]">This is a computer generated Delivery Challan. Subject to Pune Jurisdiction.</p>
              </div>
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error('Error printing challan:', error);
      Swal.fire('Error', 'Failed to generate delivery challan', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded animate-spin" />
        <h3 className="text-slate-900 font-medium">Loading Shipment Details...</h3>
      </div>
    );
  }

  if (!shipmentData) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">Shipment Not Found</h2>
        <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
  };

  const statusSteps = [
    { label: 'Order Confirmed', date: shipmentData.created_at, status: 'completed' },
    { label: 'Dispatched', date: shipmentData.planned_dispatch_date, status: shipmentData.shipment_status === 'DELIVERED' || shipmentData.shipment_status === 'IN_TRANSIT' ? 'completed' : 'pending' },
    { label: 'In Transit', date: shipmentData.last_location_update, status: shipmentData.shipment_status === 'DELIVERED' || shipmentData.shipment_status === 'IN_TRANSIT' ? 'completed' : 'pending' },
    { label: 'Delivered', date: shipmentData.actual_delivery_date, status: shipmentData.shipment_status === 'DELIVERED' ? 'completed' : 'pending' }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">Shipment Details - {shipmentData.shipment_code}</h1>
              <StatusBadge status={shipmentData.shipment_status} />
            </div>
            <nav className="flex items-center gap-2 text-xs text-slate-500">
              <span>Shipment Management</span>
              <ChevronRight className="w-3 h-3" />
              <span>Shipment Orders</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-indigo-600 font-medium">{shipmentData.shipment_code}</span>
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white" onClick={handlePrintChallan}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" className="bg-white" onClick={handlePrintChallan}>
            <Download className="w-4 h-4 mr-2" /> Download (PDF)
          </Button>
          <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main Info Column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Summary Card */}
          <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="p-4 space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shipment ID</p>
                  <p className="text-sm font-bold text-indigo-600">{shipmentData.shipment_code}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order No</p>
                  <p className="text-xs font-medium text-slate-700">{shipmentData.so_number || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shipment Date</p>
                  <p className="text-xs font-medium text-slate-700">{formatDisplayDate(shipmentData.planned_dispatch_date)}</p>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</p>
                  <p className="text-sm font-bold text-slate-900">{shipmentData.company_name}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Person</p>
                  <p className="text-xs font-medium text-indigo-600">{shipmentData.snapshot_customer_name || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                  <p className="text-xs font-medium text-slate-700">{shipmentData.snapshot_customer_phone || '—'}</p>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</p>
                  <p className="text-sm font-bold text-slate-900">Shipping Address</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Address</p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {shipmentData.snapshot_shipping_address || 'Address not set'}
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                  <StatusBadge status={shipmentData.shipment_status} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Delivery</p>
                  <p className="text-xs font-medium text-slate-700">{formatDisplayDate(shipmentData.estimated_delivery_date)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dispatched Date & Time</p>
                  <p className="text-xs font-medium text-slate-700">{formatDateTime(shipmentData.planned_dispatch_date)}</p>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle No.</p>
                  <p className="text-xs font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700 inline-block">
                    {shipmentData.vehicle_number || '—'}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver Name</p>
                  <p className="text-sm font-bold text-slate-900">{shipmentData.driver_name || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver Contact</p>
                  <p className="text-xs font-medium text-slate-700">{shipmentData.driver_contact || '—'}</p>
                </div>
              </div>
            </div>

            {/* Workflow Timeline */}
            <div className="p-6 bg-white border-t border-slate-100">
              <div className="flex items-center justify-between max-w-5xl mx-auto relative">
                {/* Connection Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                
                {statusSteps.map((step, idx) => (
                  <div key={idx} className="relative z-10 flex flex-col items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all
                      ${step.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {step.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] font-bold tracking-wide uppercase mb-1
                        ${step.status === 'completed' ? 'text-slate-900' : 'text-slate-400'}`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {step.date ? formatDateTime(step.date) : '—'}
                      </p>
                    </div>
                    {idx < statusSteps.length - 1 && (
                      <div className="absolute top-1/2 left-[120%] w-[160%] h-0.5 -translate-y-1/2 hidden md:block">
                        <div className={`h-full transition-all duration-500 ${step.status === 'completed' && statusSteps[idx+1].status === 'completed' ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        <ChevronRight className={`absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 
                          ${step.status === 'completed' && statusSteps[idx+1].status === 'completed' ? 'text-emerald-500' : 'text-slate-200'}`} 
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Items Table */}
            <div className="lg:col-span-2">
              <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Box className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Items Shipped</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="px-4 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2">Item Code / Description</th>
                        <th className="px-3 py-2 text-right">Ordered Qty</th>
                        <th className="px-3 py-2 text-right">Shipped Qty</th>
                        <th className="px-3 py-2 text-center w-20">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {shipmentData.items && shipmentData.items.length > 0 ? (
                        shipmentData.items.map((item, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{idx + 1}</td>
                            <td className="px-3 py-3">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {item.material_name || item.description || '—'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono tracking-tight">
                                  {item.item_code || item.drawing_no || '—'}
                                </p>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-xs font-medium text-slate-600">
                                {Number(item.quantity).toFixed(3)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-xs font-bold text-slate-900">
                                {Number(item.quantity).toFixed(3)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                                {item.unit || 'PCS'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <Package className="w-8 h-8 text-slate-200" />
                              <p className="text-xs text-slate-400 font-medium">No items found for this shipment</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/30 border-t border-slate-100">
                      <tr>
                        <td className="px-4 py-3 text-xs font-bold text-slate-900" colSpan="2">Total</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-slate-500">
                          {shipmentData.items ? shipmentData.items.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(3) : '0.000'}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-slate-900">
                          {shipmentData.items ? shipmentData.items.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(3) : '0.000'}
                        </td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>

            {/* Side Column */}
            <div className="space-y-5">
              {/* Transport Details */}
              <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-emerald-50/30 flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Transport Details</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transporter</p>
                      <p className="text-xs font-bold text-slate-900">{shipmentData.transporter || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle No.</p>
                      <p className="text-xs font-medium text-slate-700">{shipmentData.vehicle_number || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver Name</p>
                      <p className="text-xs font-bold text-slate-900">{shipmentData.driver_name || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver Contact</p>
                      <p className="text-xs font-medium text-slate-700">{shipmentData.driver_contact || '—'}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LR / Challan No.</p>
                      <p className="text-xs font-medium text-slate-700">{shipmentData.shipment_code || '—'}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Attachments */}
              <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-blue-50/30 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Attachments</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div 
                    onClick={handlePrintChallan}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-blue-200 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded shadow-sm">
                        <FileText className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-700 truncate w-40">
                          {challanData ? `${challanData.challan_number}.pdf` : `delivery_challan_${shipmentData.shipment_code}.pdf`}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">245 KB</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-all" />
                  </div>
                </div>
              </Card>

              {/* Notes */}
              <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-amber-50/30 flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Notes</h3>
                </div>
                <div className="p-4">
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100/50">
                    <p className="text-xs text-slate-700 italic leading-relaxed">
                      {shipmentData.special_instructions || "No special instructions provided for this shipment."}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetails;
