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
import { Card, StatusBadge, Modal } from '../components/ui.jsx';
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
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; font-family: sans-serif; }
            .print-container { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; }
          </style>
        </head>
        <body>
          <div class="print-container flex flex-col">
            <!-- Header -->
            <div class="bg-[#4f6ebc] text-white p-8 text-center">
              <h1 class="text-2xl font-black tracking-widest uppercase mb-1">SPTECHPIONEER PRIVATE LIMITED</h1>
              <p class="text-xs opacity-90 font-medium">MIDC Bhosari, Pune – 411026, Maharashtra</p>
              <p class="text-[10px] opacity-80 mt-1">GSTIN: 27ABCDE1234F1Z5 | Phone: +91-9876543210 | Email: info@sptech.com</p>
            </div>

            <!-- Title Section -->
            <div class="px-10 py-6 flex justify-between items-end border-b-2 border-slate-100">
              <h2 class="text-3xl font-black text-[#1e3a8a] tracking-tight">DELIVERY CHALLAN</h2>
              <div class="text-right space-y-1">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Challan No: <span class="text-slate-900 ml-2">${challan.challan_number}</span></p>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Date: <span class="text-slate-900 ml-2">${dispatchDate}</span></p>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Shipment: <span class="text-slate-900 ml-2">${challan.shipment_code}</span></p>
              </div>
            </div>

            <div class="p-10 space-y-8 flex-1">
              <!-- Info Cards Grid -->
              <div class="grid grid-cols-2 gap-8">
                <div class="space-y-6">
                  <div class="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                    <div class="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Bill To:</div>
                    <div class="p-5 space-y-3">
                      <p class="text-lg font-black text-[#1e3a8a] leading-none mb-2">${challan.snapshot_customer_name || challan.customer_name}</p>
                      <div class="space-y-1 text-xs font-bold text-slate-600">
                        <p><span class="w-16 inline-block text-[10px] text-slate-400 uppercase tracking-wider">GSTIN:</span> ${challan.snapshot_customer_gst || '27XXXXX1234Z1A1'}</p>
                        <p><span class="w-16 inline-block text-[10px] text-slate-400 uppercase tracking-wider">Contact:</span> ${challan.snapshot_customer_phone || 'N/A'}</p>
                        <p><span class="w-16 inline-block text-[10px] text-slate-400 uppercase tracking-wider">Email:</span> ${challan.snapshot_customer_email || 'N/A'}</p>
                      </div>
                      <div class="pt-3 border-t border-slate-100 mt-3">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Address:</p>
                        <p class="text-xs font-bold text-slate-600 leading-relaxed">${challan.snapshot_billing_address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div class="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                    <div class="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Ship To:</div>
                    <div class="p-5 text-xs font-bold text-slate-600 leading-relaxed">${challan.snapshot_shipping_address || 'Address not set'}</div>
                  </div>
                </div>

                <div class="space-y-6">
                  <div class="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                    <div class="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Transport Details:</div>
                    <div class="p-5 space-y-3">
                      <div class="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span class="text-[10px] text-slate-400 uppercase tracking-widest">Transporter:</span>
                        <span>${challan.transporter || '—'}</span>
                      </div>
                      <div class="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span class="text-[10px] text-slate-400 uppercase tracking-widest">Vehicle No:</span>
                        <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">${challan.vehicle_number || '—'}</span>
                      </div>
                      <div class="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span class="text-[10px] text-slate-400 uppercase tracking-widest">Driver Name:</span>
                        <span>${challan.driver_name || '—'}</span>
                      </div>
                      <div class="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span class="text-[10px] text-slate-400 uppercase tracking-widest">Dispatch Time:</span>
                        <span>${dispatchTime}</span>
                      </div>
                      <div class="mt-6 pt-6 border-t-2 border-slate-100 grid grid-cols-2 gap-4 text-center">
                        <div class="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                          <p class="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Total Qty</p>
                          <p class="text-lg font-black text-[#1e3a8a]">${totalQty} <span class="text-[9px]">PCS</span></p>
                        </div>
                        <div class="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                          <p class="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Total Weight</p>
                          <p class="text-lg font-black text-[#1e3a8a]">200 <span class="text-[9px]">KG</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Items Table -->
              <div class="border-2 border-slate-100 rounded-3xl overflow-hidden mt-8">
                <table class="w-full text-left">
                  <thead class="bg-[#e0e7ff] text-[#1e3a8a]">
                    <tr class="text-[10px] font-black uppercase tracking-widest">
                      <th class="px-6 py-4 w-12 text-center border-r border-slate-200/50">Sr</th>
                      <th class="px-6 py-4 w-32 border-r border-slate-200/50">Item Code</th>
                      <th class="px-6 py-4 border-r border-slate-200/50">Description</th>
                      <th class="px-6 py-4 w-20 text-center border-r border-slate-200/50">HSN</th>
                      <th class="px-6 py-4 w-20 text-right border-r border-slate-200/50">Qty</th>
                      <th class="px-6 py-4 w-20 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    ${challan.items?.map((item, idx) => `
                      <tr>
                        <td class="px-6 py-4 text-center border-r border-slate-50 text-slate-400">${idx + 1}</td>
                        <td class="px-6 py-4 border-r border-slate-50 font-black text-[#1e3a8a]">${item.item_code}</td>
                        <td class="px-6 py-4 border-r border-slate-50">${item.description}</td>
                        <td class="px-6 py-4 text-center border-r border-slate-50 text-slate-500">732690</td>
                        <td class="px-6 py-4 text-right border-r border-slate-50 font-black">${Number(item.quantity).toFixed(0)}</td>
                        <td class="px-6 py-4 text-center text-slate-500">PCS</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <div class="bg-[#fffbeb] border-2 border-[#fde68a] p-6 rounded-[32px] mt-8 relative">
                <h4 class="text-[10px] font-black text-[#92400e] uppercase tracking-widest mb-2">Remarks:</h4>
                <p class="text-xs font-bold text-[#b45309] leading-relaxed italic">"${challan.remarks || 'Material sent for delivery. Please check items and quantities before receiving.'}"</p>
              </div>

              <div class="grid grid-cols-5 gap-8 mt-12 mb-10">
                <div class="col-span-3 border-2 border-slate-100 rounded-[32px] p-6 space-y-6">
                  <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Received By:</h4>
                  <div class="grid grid-cols-2 gap-x-10 gap-y-6">
                    ${['Name', 'Mobile', 'Date / Time', 'Signature'].map(label => `
                      <div class="space-y-1">
                        <p class="text-[9px] text-slate-400 font-bold uppercase">${label}:</p>
                        <div class="border-b border-dotted border-slate-300 h-6"></div>
                      </div>
                    `).join('')}
                  </div>
                </div>
                <div class="col-span-2 border-2 border-slate-100 rounded-[32px] p-6 flex flex-col items-center justify-between text-center bg-slate-50/30">
                  <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">For SPTECHPIONEER PVT LTD</h4>
                  <div class="py-8 opacity-10">
                    <div class="w-20 h-20 border-4 border-indigo-200 rounded-full flex items-center justify-center">
                      <span class="text-2xl font-black text-indigo-200">SP</span>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm font-black text-[#1e3a8a]">Authorized Signatory</p>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Computer Generated</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-slate-100 p-4 text-center mt-auto">
              <p class="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">This is a computer generated Delivery Challan. Subject to Pune Jurisdiction.</p>
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

  return (
    <div className="p-6 space-y-8 bg-white/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Challan</h1>
          <p className="text-slate-500 text-sm mt-1">Generate and manage delivery challans.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4 text-slate-400" />
            Export
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="bg-white border border-slate-100 rounded-[32px] shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search challan, shipment, customer..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-y border-slate-100">
                <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Challan No</th>
                  <th className="px-6 py-4">Shipment Code</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4 text-center">Dispatch Date</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-xs text-slate-400">Loading challans...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredChallans.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center text-slate-400">
                      <FileText className="w-12 h-12 opacity-20 mx-auto mb-3" />
                      <p className="text-sm font-medium">No delivery challans found</p>
                    </td>
                  </tr>
                ) : (
                  filteredChallans.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-indigo-600 group-hover:underline cursor-pointer">{item.challan_number}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">{item.shipment_code}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-700">{item.customer_name}</td>
                      <td className="px-6 py-4 text-center text-xs text-slate-600">
                        {item.dispatch_time ? new Date(item.dispatch_time).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={item.delivery_status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleView(item.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handlePrint(item)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Print Challan"
                          >
                            <Printer className="w-4 h-4" />
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Challan Details - ${selectedChallan?.challan_number || ''}`}
        size="5xl"
      >
        {viewLoading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : selectedChallan && (
          <div className="bg-slate-50 p-2 sm:p-8 rounded-3xl">
            {/* Printable Area - mimicking the requested design */}
            <div id="challan-printable" className="bg-white shadow-2xl mx-auto max-w-[210mm] min-h-[297mm] overflow-hidden flex flex-col rounded-sm">
              {/* Header */}
              <div className="bg-[#4f6ebc] text-white p-8 text-center">
                <h1 className="text-2xl font-black tracking-widest uppercase mb-1">SPTECHPIONEER PRIVATE LIMITED</h1>
                <p className="text-xs opacity-90 font-medium">MIDC Bhosari, Pune – 411026, Maharashtra</p>
                <p className="text-[10px] opacity-80 mt-1">GSTIN: 27ABCDE1234F1Z5 | Phone: +91-9876543210 | Email: info@sptech.com</p>
              </div>

              {/* Title Section */}
              <div className="px-10 py-6 flex justify-between items-end border-b-2 border-slate-100">
                <h2 className="text-3xl font-black text-[#1e3a8a] tracking-tight">DELIVERY CHALLAN</h2>
                <div className="text-right space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Challan No: <span className="text-slate-900 ml-2">{selectedChallan.challan_number}</span></p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date: <span className="text-slate-900 ml-2">{selectedChallan.dispatch_time ? new Date(selectedChallan.dispatch_time).toLocaleDateString('en-IN') : '—'}</span></p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shipment: <span className="text-slate-900 ml-2">{selectedChallan.shipment_code}</span></p>
                </div>
              </div>

              <div className="p-10 space-y-8 flex-1">
                {/* Info Cards Grid */}
                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column: Addresses */}
                  <div className="space-y-6">
                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                      <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Bill To:</div>
                      <div className="p-5 space-y-3">
                        <p className="text-lg font-black text-[#1e3a8a] leading-none mb-2">{selectedChallan.snapshot_customer_name || selectedChallan.customer_name}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                            <span className="w-16 text-[10px] text-slate-400 uppercase">GSTIN:</span> 
                            {selectedChallan.snapshot_customer_gst || '27XXXXX1234Z1A1'}
                          </p>
                          <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                            <span className="w-16 text-[10px] text-slate-400 uppercase">Contact:</span> 
                            {selectedChallan.snapshot_customer_phone || 'N/A'}
                          </p>
                          <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                            <span className="w-16 text-[10px] text-slate-400 uppercase">Email:</span> 
                            {selectedChallan.snapshot_customer_email || 'N/A'}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-100 mt-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Address:</p>
                          <p className="text-xs font-bold text-slate-600 leading-relaxed">{selectedChallan.snapshot_billing_address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                      <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Ship To:</div>
                      <div className="p-5">
                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{selectedChallan.snapshot_shipping_address || 'Address not set'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Transport & Totals */}
                  <div className="space-y-6">
                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                      <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Transport Details:</div>
                      <div className="p-5">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Transporter:</span>
                            <span>{selectedChallan.transporter || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Vehicle No:</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{selectedChallan.vehicle_number || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Driver Name:</span>
                            <span>{selectedChallan.driver_name || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Dispatch Time:</span>
                            <span>{selectedChallan.dispatch_time ? new Date(selectedChallan.dispatch_time).toLocaleTimeString('en-IN') : '—'}</span>
                          </div>
                        </div>

                        {/* Summary Box */}
                        <div className="mt-6 pt-6 border-t-2 border-slate-100 grid grid-cols-2 gap-4">
                          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Quantity</p>
                            <p className="text-xl font-black text-[#1e3a8a]">{selectedChallan.items?.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(0)} <span className="text-[10px] font-bold text-indigo-400 ml-1">PCS</span></p>
                          </div>
                          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Weight</p>
                            <p className="text-xl font-black text-[#1e3a8a]">200 <span className="text-[10px] font-bold text-indigo-400 ml-1">KG</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-2 border-slate-100 rounded-3xl overflow-hidden mt-8">
                  <table className="w-full text-left">
                    <thead className="bg-[#e0e7ff] text-[#1e3a8a]">
                      <tr className="text-[10px] font-black uppercase tracking-widest">
                        <th className="px-6 py-4 w-12 text-center border-r border-slate-200/50">Sr</th>
                        <th className="px-6 py-4 w-32 border-r border-slate-200/50">Item Code</th>
                        <th className="px-6 py-4 border-r border-slate-200/50">Description</th>
                        <th className="px-6 py-4 w-24 text-center border-r border-slate-200/50">HSN</th>
                        <th className="px-6 py-4 w-24 text-right border-r border-slate-200/50">Qty</th>
                        <th className="px-6 py-4 w-20 text-center border-r border-slate-200/50">Unit</th>
                        <th className="px-6 py-4 w-32 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedChallan.items?.map((item, idx) => (
                        <tr key={idx} className="text-xs font-bold text-slate-700">
                          <td className="px-6 py-4 text-center border-r border-slate-50 text-slate-400">{idx + 1}</td>
                          <td className="px-6 py-4 border-r border-slate-50 font-black text-[#1e3a8a]">{item.item_code}</td>
                          <td className="px-6 py-4 border-r border-slate-50">{item.description}</td>
                          <td className="px-6 py-4 text-center border-r border-slate-50 text-slate-500">732690</td>
                          <td className="px-6 py-4 text-right border-r border-slate-50 font-black">{Number(item.quantity).toFixed(0)}</td>
                          <td className="px-6 py-4 text-center border-r border-slate-50 text-slate-500">PCS</td>
                          <td className="px-6 py-4 text-right font-black text-slate-900">120 KG</td>
                        </tr>
                      ))}
                      {/* Blank rows to fill space */}
                      {[1, 2].map((_, i) => (
                        <tr key={`blank-${i}`} className="h-12">
                          <td className="border-r border-slate-50"></td>
                          <td className="border-r border-slate-50"></td>
                          <td className="border-r border-slate-50"></td>
                          <td className="border-r border-slate-50"></td>
                          <td className="border-r border-slate-50"></td>
                          <td className="border-r border-slate-50"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 border-t-2 border-slate-100">
                      <tr className="text-xs font-black">
                        <td colSpan={4} className="px-6 py-4 text-right uppercase tracking-widest text-slate-400 text-[10px]">Total Quantity:</td>
                        <td className="px-6 py-4 text-right text-[#1e3a8a]">{selectedChallan.items?.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(0)}</td>
                        <td colSpan={1} className="px-6 py-4 text-right uppercase tracking-widest text-slate-400 text-[10px]">Total Weight:</td>
                        <td className="px-6 py-4 text-right text-[#1e3a8a]">200 KG</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Remarks Section */}
                <div className="bg-[#fffbeb] border-2 border-[#fde68a] p-6 rounded-[32px] mt-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#fef3c7] rounded-full -mr-16 -mt-16 opacity-50"></div>
                  <h4 className="text-[10px] font-black text-[#92400e] uppercase tracking-[0.2em] mb-2 relative z-10">Remarks:</h4>
                  <p className="text-xs font-bold text-[#b45309] leading-relaxed relative z-10 italic">
                    "{selectedChallan.remarks || 'Material sent for delivery. Please check items and quantities before receiving.'}"
                  </p>
                </div>

                {/* Signature Grid */}
                <div className="grid grid-cols-5 gap-8 mt-12 mb-10">
                  <div className="col-span-3 border-2 border-slate-100 rounded-[32px] p-6 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Received By:</h4>
                    <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Name:</p>
                        <div className="border-b border-dotted border-slate-300 h-6"></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Mobile:</p>
                        <div className="border-b border-dotted border-slate-300 h-6"></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Date / Time:</p>
                        <div className="border-b border-dotted border-slate-300 h-6"></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Signature:</p>
                        <div className="border-b border-dotted border-slate-300 h-10"></div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 border-2 border-slate-100 rounded-[32px] p-6 flex flex-col items-center justify-between text-center bg-slate-50/30">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">For SPTECHPIONEER PVT LTD</h4>
                    <div className="py-8 opacity-10">
                      <div className="w-24 h-24 border-4 border-indigo-200 rounded-full flex items-center justify-center">
                        <span className="text-4xl font-black text-indigo-200">SP</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-[#1e3a8a]">Authorized Signatory</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Computer Generated</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Bar */}
              <div className="bg-slate-100 p-4 text-center">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">
                  This is a computer generated Delivery Challan. Subject to Pune Jurisdiction.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
           <button 
             onClick={() => setShowViewModal(false)}
             className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
           >
             Close Preview
           </button>
           <button 
             onClick={() => handlePrint(selectedChallan)}
             className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
           >
             <Printer className="w-4 h-4" /> Print Challan
           </button>
        </div>
      </Modal>
    </div>
  );
};

export default DeliveryChallan;
