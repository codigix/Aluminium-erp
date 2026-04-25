import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Download,
  Eye,
  Printer,
  Calendar,
  User,
  Truck,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, StatusBadge, Modal, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DeliveryChallan = () => {
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchChallans = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/delivery-challans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch challans');
      const data = await response.json();
      setChallans(data);
    } catch (error) {
      console.error('Error fetching challans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallans();
  }, [fetchChallans]);

  const handleView = async (challanId) => {
    try {
      setViewLoading(true);
      setShowViewModal(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/delivery-challans/${challanId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setSelectedChallan(data);
    } catch (error) {
      console.error('Error fetching details:', error);
      Swal.fire('Error', 'Could not load challan details', 'error');
      setShowViewModal(false);
    } finally {
      setViewLoading(false);
    }
  };

  const handlePrint = async (challanData) => {
    if (!challanData) return;
    
    let challan = challanData;
    
    // If items are missing (happens when clicking from list), fetch full details
    if (!challan.items) {
      try {
        Swal.fire({
          title: 'Preparing Print...',
          didOpen: () => Swal.showLoading(),
          allowOutsideClick: false
        });
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/delivery-challans/${challan.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch details');
        challan = await response.json();
        Swal.close();
      } catch (error) {
        console.error('Print fetch error:', error);
        Swal.fire('Error', 'Could not load challan details for printing', 'error');
        return;
      }
    }

    const totalQty = challan.items?.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(0);
    const dispatchDate = challan.dispatch_time ? new Date(challan.dispatch_time).toLocaleDateString('en-IN') : '—';
    const dispatchTime = challan.dispatch_time ? new Date(challan.dispatch_time).toLocaleTimeString('en-IN') : '—';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Delivery Challan - ${challan.challan_number}</title>
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
              <h1 class="text-2xl    mb-1">SPTECHPIONEER PRIVATE LIMITED</h1>
              <p class="text-xs opacity-90 font-medium">MIDC Bhosari, Pune – 411026, Maharashtra</p>
              <p class="text-xs opacity-80 mt-1">GSTIN: 27ABCDE1234F1Z5 | Phone: +91-9876543210 | Email: info@sptech.com</p>
            </div>

            <!-- Title Section -->
            <div class="px-10 py-6 flex justify-between items-end border-b-2 border-slate-100">
              <h2 class="text-xl  text-[#1e3a8a] tracking-tight">DELIVERY CHALLAN</h2>
              <div class="text-right space-y-1">
                <p class="text-xs  text-slate-400  ">Challan No: <span class="text-slate-900 ml-2">${challan.challan_number}</span></p>
                <p class="text-xs  text-slate-400  ">Date: <span class="text-slate-900 ml-2">${dispatchDate}</span></p>
                <p class="text-xs  text-slate-400  ">Shipment: <span class="text-slate-900 ml-2">${challan.shipment_code}</span></p>
              </div>
            </div>

            <div class="p-10 space-y-2 flex-1">
              <!-- Info Cards Grid -->
              <div class="grid grid-cols-2 gap-8">
                <div class="space-y-2">
                  <div class="border border-slate-100 rounded overflow-hidden bg-slate-50/30">
                    <div class="bg-slate-50 px-4 py-2 text-xs  text-slate-500   border-b border-slate-100">Bill To:</div>
                    <div class="p-5 space-y-3">
                      <p class="text-lg  text-[#1e3a8a] leading-none mb-2">${challan.snapshot_customer_name || challan.customer_name}</p>
                      <div class="space-y-1 text-xs  text-slate-600">
                        <p><span class="w-16 inline-block text-xs text-slate-400  ">GSTIN:</span> ${challan.snapshot_customer_gst || '27XXXXX1234Z1A1'}</p>
                        <p><span class="w-16 inline-block text-xs text-slate-400  ">Contact:</span> ${challan.snapshot_customer_phone || 'N/A'}</p>
                        <p><span class="w-16 inline-block text-xs text-slate-400  ">Email:</span> ${challan.snapshot_customer_email || 'N/A'}</p>
                      </div>
                      <div class="pt-3 border-t border-slate-100 mt-3">
                        <p class="text-xs  text-slate-400   mb-1">Billing Address:</p>
                        <p class="text-xs  text-slate-600 leading-relaxed">${challan.snapshot_billing_address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div class="border border-slate-100 rounded overflow-hidden bg-slate-50/30">
                    <div class="bg-slate-50 px-4 py-2 text-xs  text-slate-500   border-b border-slate-100">Ship To:</div>
                    <div class="p-5 text-xs  text-slate-600 leading-relaxed">${challan.snapshot_shipping_address || 'Address not set'}</div>
                  </div>
                </div>

                <div class="space-y-2">
                  <div class="border border-slate-100 rounded overflow-hidden bg-slate-50/30">
                    <div class="bg-slate-50 px-4 py-2 text-xs  text-slate-500   border-b border-slate-100">Transport Details:</div>
                    <div class="p-5 space-y-3">
                      <div class="flex justify-between items-center text-xs  text-slate-600">
                        <span class="text-xs text-slate-400  ">Transporter:</span>
                        <span>${challan.transporter || '—'}</span>
                      </div>
                      <div class="flex justify-between items-center text-xs  text-slate-600">
                        <span class="text-xs text-slate-400  ">Vehicle No:</span>
                        <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">${challan.vehicle_number || '—'}</span>
                      </div>
                      <div class="flex justify-between items-center text-xs  text-slate-600">
                        <span class="text-xs text-slate-400  ">Driver Name:</span>
                        <span>${challan.driver_name || '—'}</span>
                      </div>
                      <div class="flex justify-between items-center text-xs  text-slate-600">
                        <span class="text-xs text-slate-400  ">Dispatch Time:</span>
                        <span>${dispatchTime}</span>
                      </div>
                      <div class="mt-6 pt-6 border-t-2 border-slate-100 grid grid-cols-2 gap-2 text-center">
                        <div class="bg-indigo-50/50 p-2 rounded  border border-indigo-100">
                          <p class="text-[8px]  text-indigo-400  ">Total Qty</p>
                          <p class="text-lg  text-[#1e3a8a]">${totalQty} <span class="text-xs">PCS</span></p>
                        </div>
                        <div class="bg-indigo-50/50 p-2 rounded  border border-indigo-100">
                          <p class="text-[8px]  text-indigo-400  ">Total Weight</p>
                          <p class="text-lg  text-[#1e3a8a]">200 <span class="text-xs">KG</span></p>
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
                    <tr class="text-xs   ">
                      <th class=" p-2 w-12 text-center border-r border-slate-200/50">Sr</th>
                      <th class=" p-2 w-32 border-r border-slate-200/50">Item Code</th>
                      <th class=" p-2 border-r border-slate-200/50">Description</th>
                      <th class=" p-2 w-20 text-center border-r border-slate-200/50">HSN</th>
                      <th class=" p-2 w-20 text-right border-r border-slate-200/50">Qty</th>
                      <th class=" p-2 w-20 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs  text-slate-700">
                    ${challan.items?.map((item, idx) => `
                      <tr>
                        <td class=" p-2 text-center border-r border-slate-50 text-slate-400">${idx + 1}</td>
                        <td class=" p-2 border-r border-slate-50  text-[#1e3a8a]">${item.item_code}</td>
                        <td class=" p-2 border-r border-slate-50">${item.description}</td>
                        <td class=" p-2 text-center border-r border-slate-50 text-slate-500">732690</td>
                        <td class=" p-2 text-right border-r border-slate-50 ">${Number(item.quantity).toFixed(0)}</td>
                        <td class=" p-2 text-center text-slate-500">PCS</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <div class="bg-[#fffbeb] border-2 border-[#fde68a] p-2 rounded  mt-8 relative">
                <h4 class="text-xs  text-[#92400e]   mb-2">Remarks:</h4>
                <p class="text-xs  text-[#b45309] leading-relaxed italic">"${challan.remarks || 'Material sent for delivery. Please check items and quantities before receiving.'}"</p>
              </div>

              <div class="grid grid-cols-5 gap-8 mt-12 mb-10">
                <div class="col-span-3 border-2 border-slate-100 rounded  p-2 space-y-2">
                  <h4 class="text-xs  text-slate-400  ">Received By:</h4>
                  <div class="grid grid-cols-2 gap-x-10 gap-y-6">
                    ${['Name', 'Mobile', 'Date / Time', 'Signature'].map(label => `
                      <div class="space-y-1">
                        <p class="text-xs text-slate-400  ">${label}:</p>
                        <div class="border-b border-dotted border-slate-300 h-6"></div>
                      </div>
                    `).join('')}
                  </div>
                </div>
                <div class="col-span-2 border-2 border-slate-100 rounded  p-2 flex flex-col items-center justify-between text-center bg-slate-50/30">
                  <h4 class="text-xs  text-slate-400  ">For SPTECHPIONEER PVT LTD</h4>
                  <div class="py-8 opacity-10">
                    <div class="w-5 h-5 border-4 border-indigo-200 rounded flex items-center justify-center">
                      <span class="text-2xl  text-indigo-200">SP</span>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm  text-[#1e3a8a]">Authorized Signatory</p>
                    <p class="text-xs text-slate-400   ">Computer Generated</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-slate-100 p-2 text-center mt-auto">
              <p class="text-xs  text-slate-500  tracking-[0.3em]">This is a computer generated Delivery Challan. Subject to Pune Jurisdiction.</p>
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
  };

  const filteredChallans = challans.filter(c => 
    c.challan_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.shipment_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    { 
      label: 'Challan No', 
      key: 'challan_number',
      className: ' text-indigo-600'
    },
    { 
      label: 'Shipment Code', 
      key: 'shipment_code',
      render: (val) => (
        <span className="text-xs  text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
          {val}
        </span>
      )
    },
    { 
      label: 'Customer', 
      key: 'customer_name',
      className: 'font-semibold text-slate-700',
      render: (val) => val || '—'
    },
    { 
      label: 'Dispatch Date', 
      key: 'dispatch_time',
      className: 'text-slate-600',
      render: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '—'
    },
    { 
      label: 'Status', 
      key: 'status',
      className: 'text-center',
      render: (val) => <StatusBadge status={val || 'DISPATCHED'} />
    },
    { 
      label: 'Actions', 
      key: 'actions',
      className: 'text-right',
      render: (_, challan) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleView(challan.id)}
            className="p-1.5 bg-slate-50 text-slate-600 rounded  hover:bg-slate-100 transition-colors border border-slate-100"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePrint(challan)}
            className="p-1.5 bg-indigo-50 text-indigo-600 rounded  hover:bg-indigo-100 transition-colors border border-indigo-100"
            title="Print Challan"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-2 space-y-2 bg-white/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl  text-slate-900">Delivery Challan</h1>
          <p className="text-slate-500 text-xs ">Generate and manage delivery challans.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded text-xs text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4 text-slate-400" />
            Export
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="bg-white border border-slate-100 rounded  shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search challan, shipment, customer..."
                className="w-full pl-10 pr-4 py-2.5 rounded  border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs  text-slate-500   bg-slate-50 p-1.5 rounded  border border-slate-100">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>{filteredChallans.length} Challans Found</span>
            </div>
          </div>

          <div className="p-2">
            <DataTable 
              columns={columns}
              data={filteredChallans}
              loading={loading}
              pageSize={5}
              hideHeader={true}
              emptyMessage="No delivery challans found."
            />
          </div>
        </div>
      </Card>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Delivery Challan Details - ${selectedChallan?.challan_number || ''}`}
        size="5xl"
      >
        {viewLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded animate-spin" />
          </div>
        ) : selectedChallan ? (
          <div className="space-y-2">
            {/* Modal Header with Actions */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-white rounded border border-slate-100 flex items-center justify-center shadow-sm">
                  <FileText className="w-3 h-3 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-md  text-slate-900">{selectedChallan.challan_number}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs  text-slate-400  ">Shipment:</span>
                    <span className="text-xs  text-indigo-600">{selectedChallan.shipment_code}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handlePrint(selectedChallan)}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded text-xs  hover:bg-indigo-700 transition-all  shadow-indigo-100"
              >
                <Printer className="w-4 h-4" />
                Print Challan
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <div className="bg-white p-2 rounded  border border-slate-100 shadow-sm space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded  flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs  text-slate-900  ">Customer Information</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs  text-slate-600">
                    <span className="text-xs text-slate-400  ">Name:</span>
                    <span>{selectedChallan.snapshot_customer_name || selectedChallan.customer_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs  text-slate-600">
                    <span className="text-xs text-slate-400  ">Phone:</span>
                    <span>{selectedChallan.snapshot_customer_phone || '—'}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-50">
                    <p className="text-xs  text-slate-400   mb-1">Shipping Address:</p>
                    <p className="text-xs  text-slate-600 leading-relaxed">{selectedChallan.snapshot_shipping_address || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Transport Info */}
              <div className="bg-white p-2 rounded  border border-slate-100 shadow-sm space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded  flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs  text-slate-900  ">Transport Details</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs  text-slate-600">
                    <span className="text-xs text-slate-400  ">Transporter:</span>
                    <span>{selectedChallan.transporter || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs  text-slate-600">
                    <span className="text-xs text-slate-400  ">Vehicle No:</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded ">{selectedChallan.vehicle_number || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs  text-slate-600">
                    <span className="text-xs text-slate-400  ">Driver:</span>
                    <span>{selectedChallan.driver_name || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs  text-slate-600">
                    <span className="text-xs text-slate-400  ">Dispatch Time:</span>
                    <span>{selectedChallan.dispatch_time ? new Date(selectedChallan.dispatch_time).toLocaleString('en-IN') : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded  border border-slate-100 overflow-hidden shadow-sm">
              <div className="bg-slate-50  p-2 border-b border-slate-100 flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs  text-slate-900  ">Verified Items List</h4>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-xs  text-slate-500   border-b border-slate-100">
                    <th className=" p-2">Item Details</th>
                    <th className=" p-2 text-center">Quantity</th>
                    <th className=" p-2 text-center">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedChallan.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className=" p-2">
                        <div className="flex flex-col">
                          <span className=" text-slate-900 text-xs">{item.description}</span>
                          <span className="text-xs text-slate-400 tracking-tight">Code: {item.item_code}</span>
                        </div>
                      </td>
                      <td className=" p-2 text-center  text-slate-700 text-xs">
                        {parseFloat(item.quantity).toFixed(0)}
                      </td>
                      <td className=" p-2 text-center text-xs  text-slate-400 ">PCS</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Remarks Section */}
            {selectedChallan.remarks && (
              <div className="bg-amber-50 p-2 rounded  border border-amber-100">
                <h4 className="text-xs  text-amber-600   mb-1">Remarks:</h4>
                <p className="text-xs  text-amber-700 leading-relaxed italic">"{selectedChallan.remarks}"</p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DeliveryChallan;
