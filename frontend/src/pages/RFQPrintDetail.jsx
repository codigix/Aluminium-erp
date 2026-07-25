import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { formatDimensions } from '../utils/formatters';
import {
  ArrowLeft,
  ChevronRight,
  Package,
  Printer,
  Download,
  Clock,
  Send,
  Building2,
  FileText,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const formatDate = (date) => {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
};

const RFQPrintDetail = ({ quotationId: propQuotationId, onBack: propOnBack }) => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const id = propQuotationId || params.id;
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const fetchQuotation = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/quotations/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch RFQ details');
      const data = await res.json();
      setQuotation(data);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Failed to load RFQ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  useEffect(() => {
    if (quotation && (location.state?.autoPrint || location.search.includes('print=true'))) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [quotation]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RFQ_${quotation?.quote_number || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Swal.fire('Error', 'Failed to download PDF', 'error');
    }
  };

  const handleBack = () => {
    if (propOnBack) {
      propOnBack();
    } else {
      navigate(`${deptPrefix}/quotations`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-sm animate-pulse">Loading RFQ details...</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-sm">RFQ not found.</p>
        <button onClick={handleBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-xs">
          Back to Quotations
        </button>
      </div>
    );
  }

  const items = quotation.items || [];
  const statusLabel = quotation.status?.toUpperCase() || 'DRAFT';

  return (
    <>
      {/* Screen Layout */}
      <div className="space-y-4 p-4 animate-in fade-in duration-300 print:hidden">
        {/* Navigation Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-200 active:scale-95 shadow-sm"
              title="Back to List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span>Buying</span>
                <ChevronRight className="w-3 h-3" />
                <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={handleBack}>
                  Purchase RFQs
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-blue-600 font-semibold">{quotation.quote_number}</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <h1 className="text-xl font-bold text-slate-900 font-mono">{quotation.quote_number}</h1>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 active:scale-95"
              title="Print RFQ"
            >
              <Printer className="w-4 h-4" />
              Print RFQ
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all active:scale-95"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Info Section Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">RFQ Information</p>
            <table className="text-xs w-full text-slate-700">
              <tbody>
                <tr><td className="py-1 text-slate-400">RFQ Number:</td><td className="font-mono font-bold text-right">{quotation.quote_number}</td></tr>
                <tr><td className="py-1 text-slate-400">RFQ Date:</td><td className="font-medium text-right">{formatDate(quotation.created_at)}</td></tr>
                <tr><td className="py-1 text-slate-400">Valid Until:</td><td className="font-medium text-right">{formatDate(quotation.valid_until)}</td></tr>
                <tr><td className="py-1 text-slate-400">Status:</td><td className="font-bold text-blue-600 text-right">{statusLabel}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Supplier Details</p>
            <h3 className="text-sm font-bold text-slate-900 mb-1">{quotation.vendor_name || 'Unassigned'}</h3>
            <p className="text-xs text-slate-600">Contact: {quotation.contact_person || 'N/A'}</p>
            <p className="text-xs text-slate-500 mt-1">{quotation.vendor_email || quotation.email || 'N/A'}</p>
            {quotation.vendor_gstin && <p className="text-xs text-slate-500 font-mono mt-0.5">GSTIN: {quotation.vendor_gstin}</p>}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Project Details</p>
            <table className="text-xs w-full text-slate-700">
              <tbody>
                <tr><td className="py-1 text-slate-400">Customer:</td><td className="font-medium text-right truncate max-w-[120px]">{quotation.company_name || quotation.client || 'Internal'}</td></tr>
                <tr><td className="py-1 text-slate-400">Project:</td><td className="font-medium text-right truncate max-w-[120px]">{quotation.project_name || 'General Requirement'}</td></tr>
                <tr><td className="py-1 text-slate-400">Customer PO:</td><td className="font-mono text-right">{quotation.customer_po || quotation.po_number || 'N/A'}</td></tr>
                <tr><td className="py-1 text-slate-400">Sales Order:</td><td className="font-mono text-right">{quotation.so_number || (quotation.sales_order_id ? `SO-${quotation.sales_order_id}` : 'N/A')}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Drawing Details</p>
            <table className="text-xs w-full text-slate-700">
              <tbody>
                <tr><td className="py-1 text-slate-400">Drawing No:</td><td className="font-mono font-bold text-right">{quotation.drawing_no || (items[0]?.drawing_no) || '—'}</td></tr>
                <tr><td className="py-1 text-slate-400">Drawing Name:</td><td className="font-medium text-right truncate max-w-[120px]">{quotation.drawing_name || (items[0]?.material_name) || '—'}</td></tr>
                <tr><td className="py-1 text-slate-400">Revision:</td><td className="font-medium text-right">{quotation.revision || quotation.drawing_revision || 'R0'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Material Details Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider">Material Items List</span>
            <span className="text-slate-500 font-medium">Total Items: {items.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="p-3 text-center" style={{ width: '50px' }}>Sr No</th>
                  <th className="p-3">Drawing No</th>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Description / Size</th>
                  <th className="p-3">Material Type</th>
                  <th className="p-3 text-center">Design Qty</th>
                  <th className="p-3 text-center">Required Qty</th>
                  <th className="p-3 text-center">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-400">
                      No material items specified in this RFQ.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const plannedQty = (item.planned_qty !== undefined && item.planned_qty !== null && item.planned_qty !== '') ? parseFloat(item.planned_qty) : null;
                    const designNum = (plannedQty !== null && !isNaN(plannedQty)) ? plannedQty : (parseFloat(item.design_qty) || 0);
                    const reqQty = parseFloat(item.quantity || 0);
                    const uom = (item.uom || item.unit || 'Nos').trim();
                    const dims = formatDimensions(item);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-3 text-center font-semibold text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-mono font-semibold text-slate-800">{item.drawing_no || item.item_code || '—'}</td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-900">{item.material_name || item.description || 'N/A'}</p>
                          {item.item_code && <span className="text-[10px] text-slate-400 font-mono">Code: {item.item_code}</span>}
                        </td>
                        <td className="p-3 font-mono text-slate-600">{dims || item.description || '—'}</td>
                        <td className="p-3 text-slate-600">{item.material_type || '—'}</td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {designNum > 0 ? `${designNum} Nos` : '—'}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {reqQty > 0 ? `${reqQty % 1 === 0 ? reqQty.toFixed(0) : reqQty.toFixed(3)} ${uom}` : '—'}
                        </td>
                        <td className="p-3 text-center text-slate-600">{uom}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarks Section */}
        {quotation.notes && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-700 uppercase mb-1">Remarks & Instructions</p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}
      </div>

      {/* Dedicated Printable A4 Document Layout (matches PurchaseOrderDetail.jsx print structure) */}
      <div className="hidden print:block p-6 max-w-[210mm] mx-auto text-black font-sans bg-white">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-orange-600 mb-1">REQUEST FOR QUOTATION (RFQ)</h1>
            <h2 className="text-base font-bold uppercase text-slate-900">SP TECHPIONEER PRIVATE LIMITED</h2>
            <p className="text-[10px] text-slate-600">Industrial Area, Sector 5, Pune, Maharashtra - 411026</p>
            <p className="text-[10px] text-slate-600">Email: milindpodar@gmail.com | Mobile: 09823714674</p>
          </div>
          <div className="text-right border border-slate-300 p-2.5 rounded bg-slate-50 min-w-[220px]">
            <table className="text-[10px] w-full text-left">
              <tbody>
                <tr><td className="font-bold py-0.5">RFQ Number:</td><td className="font-mono font-bold text-right">{quotation.quote_number}</td></tr>
                <tr><td className="font-bold py-0.5">RFQ Date:</td><td className="text-right">{formatDate(quotation.created_at)}</td></tr>
                <tr><td className="font-bold py-0.5">Valid Until:</td><td className="text-right">{formatDate(quotation.valid_until)}</td></tr>
                <tr><td className="font-bold py-0.5">Status:</td><td className="font-bold text-blue-600 text-right">{statusLabel}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4 Info Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="border border-slate-300 rounded p-2.5 bg-white">
            <p className="text-[9.5px] font-bold uppercase border-b border-slate-200 pb-1 mb-1.5 text-slate-800">Supplier Details</p>
            <p className="text-xs font-bold text-slate-900">{quotation.vendor_name || 'Unassigned'}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Contact Person: {quotation.contact_person || 'N/A'}</p>
            <p className="text-[10px] text-slate-600">Mobile: {quotation.phone || quotation.vendor_phone || 'N/A'}</p>
            <p className="text-[10px] text-slate-600">Email: {quotation.vendor_email || quotation.email || 'N/A'}</p>
            {quotation.vendor_gstin && <p className="text-[10px] text-slate-600 font-mono">GSTIN: {quotation.vendor_gstin}</p>}
          </div>

          <div className="border border-slate-300 rounded p-2.5 bg-white">
            <p className="text-[9.5px] font-bold uppercase border-b border-slate-200 pb-1 mb-1.5 text-slate-800">Company Details</p>
            <p className="text-xs font-bold text-slate-900">SP TECHPIONEER PRIVATE LIMITED</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Address: PCNTDA, Bhosari, Pune - 411026, MH</p>
            <p className="text-[10px] text-slate-600">GSTIN: 27AABCS1234F1Z5</p>
            <p className="text-[10px] text-slate-600">Contact: 09823714674 | Email: info@sptechpioneer.com</p>
          </div>

          <div className="border border-slate-300 rounded p-2.5 bg-white">
            <p className="text-[9.5px] font-bold uppercase border-b border-slate-200 pb-1 mb-1.5 text-slate-800">Project Details</p>
            <table className="text-[10px] w-full text-slate-700">
              <tbody>
                <tr><td className="py-0.5 text-slate-500">Customer:</td><td className="font-semibold text-right">{quotation.company_name || quotation.client || 'Internal'}</td></tr>
                <tr><td className="py-0.5 text-slate-500">Project:</td><td className="font-semibold text-right">{quotation.project_name || 'General Requirement'}</td></tr>
                <tr><td className="py-0.5 text-slate-500">Customer PO:</td><td className="font-mono text-right">{quotation.customer_po || quotation.po_number || 'N/A'}</td></tr>
                <tr><td className="py-0.5 text-slate-500">Sales Order:</td><td className="font-mono text-right">{quotation.so_number || (quotation.sales_order_id ? `SO-${quotation.sales_order_id}` : 'N/A')}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="border border-slate-300 rounded p-2.5 bg-white">
            <p className="text-[9.5px] font-bold uppercase border-b border-slate-200 pb-1 mb-1.5 text-slate-800">Drawing Details</p>
            <table className="text-[10px] w-full text-slate-700">
              <tbody>
                <tr><td className="py-0.5 text-slate-500">Drawing Number:</td><td className="font-mono font-bold text-right">{quotation.drawing_no || (items[0]?.drawing_no) || '—'}</td></tr>
                <tr><td className="py-0.5 text-slate-500">Drawing Name:</td><td className="font-semibold text-right">{quotation.drawing_name || (items[0]?.material_name) || '—'}</td></tr>
                <tr><td className="py-0.5 text-slate-500">Revision:</td><td className="font-semibold text-right">{quotation.revision || quotation.drawing_revision || 'R0'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Material Details Table */}
        <div className="border border-slate-300 rounded overflow-hidden mb-4">
          <table className="w-full text-[10px] text-left border-collapse">
            <thead className="bg-slate-100">
              <tr className="border-b border-slate-300">
                <th className="p-2 text-center border-r border-slate-300" style={{ width: '45px' }}>Sr No</th>
                <th className="p-2 border-r border-slate-300">Drawing No</th>
                <th className="p-2 border-r border-slate-300">Material Name</th>
                <th className="p-2 border-r border-slate-300">Description / Size</th>
                <th className="p-2 border-r border-slate-300">Material Type</th>
                <th className="p-2 text-center border-r border-slate-300">Design Qty</th>
                <th className="p-2 text-center border-r border-slate-300">Required Qty</th>
                <th className="p-2 text-center">UOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {items.map((item, idx) => {
                const plannedQty = (item.planned_qty !== undefined && item.planned_qty !== null && item.planned_qty !== '') ? parseFloat(item.planned_qty) : null;
                const designNum = (plannedQty !== null && !isNaN(plannedQty)) ? plannedQty : (parseFloat(item.design_qty) || 0);
                const reqQty = parseFloat(item.quantity || 0);
                const uom = (item.uom || item.unit || 'Nos').trim();
                const dims = formatDimensions(item);

                return (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 text-center font-bold border-r border-slate-300">{idx + 1}</td>
                    <td className="p-2 font-mono font-semibold border-r border-slate-300">{item.drawing_no || item.item_code || '—'}</td>
                    <td className="p-2 border-r border-slate-300 font-bold">{item.material_name || item.description || 'N/A'}</td>
                    <td className="p-2 border-r border-slate-300 font-mono">{dims || item.description || '—'}</td>
                    <td className="p-2 border-r border-slate-300">{item.material_type || '—'}</td>
                    <td className="p-2 text-center font-bold border-r border-slate-300">
                      {designNum > 0 ? `${designNum} Nos` : '—'}
                    </td>
                    <td className="p-2 text-center font-bold border-r border-slate-300">
                      {reqQty > 0 ? `${reqQty % 1 === 0 ? reqQty.toFixed(0) : reqQty.toFixed(3)} ${uom}` : '—'}
                    </td>
                    <td className="p-2 text-center">{uom}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Remarks Box */}
        <div className="border border-slate-300 rounded p-2.5 mb-6">
          <p className="text-[9.5px] font-bold uppercase text-slate-800 mb-1">Remarks / Instructions</p>
          <p className="text-[10px] text-slate-600">{quotation.notes || 'Please submit your best price quotation and lead time for the above material list.'}</p>
        </div>

        {/* Page Footer */}
        <div className="pt-3 border-t border-slate-300 flex justify-between items-center text-[9px] text-slate-500 mt-auto">
          <div>Generated By: System Admin | Date & Time: {new Date().toLocaleString('en-IN')}</div>
          <div>SP TECHPIONEER PRIVATE LIMITED | Page 1 of 1</div>
        </div>
      </div>
    </>
  );
};

export default RFQPrintDetail;
