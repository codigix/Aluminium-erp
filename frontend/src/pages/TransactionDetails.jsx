import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, Download, Printer, ChevronLeft, Calendar, 
  User, CreditCard, Banknote, History, CheckCircle2, 
  ArrowRight, Package, Info, Paperclip, MessageSquare,
  Clock, CheckCircle, ShieldCheck, Send, Wallet, MoreVertical
} from 'lucide-react';
import { Card, StatusBadge, Button } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const TransactionDetails = () => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract ID from URL if not available in params
  const segments = location.pathname.split('/').filter(Boolean);
  const id = paramId || segments[segments.length - 1];
  
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [type, setType] = useState('');

  useEffect(() => {
    fetchTransactionDetails();
  }, [id]);

  const fetchTransactionDetails = async () => {
    if (!id || id === 'transaction-details') return;
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const urlParams = new URLSearchParams(window.location.search);
      const transactionType = urlParams.get('type') || 'Vendor Invoice';
      setType(transactionType);

      let endpoint = '';
      if (transactionType === 'Payment Received') {
        endpoint = `${API_BASE}/customer-payments/${id}`;
      } else if (transactionType === 'Vendor Payment') {
        endpoint = `${API_BASE}/payments/${id}`;
      } else if (transactionType === 'Vendor Invoice') {
        endpoint = `${API_BASE}/purchase-orders/${id}`;
      }

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch transaction details');
      const data = await response.json();
      setTransaction(data);
    } catch (error) {
      console.error('Error fetching transaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('authToken');
      let pdfEndpoint = '';
      
      if (type === 'Payment Received') {
        pdfEndpoint = `${API_BASE}/customer-payments/${id}/pdf`;
      } else if (type === 'Vendor Payment') {
        pdfEndpoint = `${API_BASE}/payments/${id}/pdf`;
      } else if (type === 'Vendor Invoice') {
        pdfEndpoint = `${API_BASE}/purchase-orders/${id}/pdf`;
      }

      if (!pdfEndpoint) return;

      const response = await fetch(pdfEndpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type.replace(/ /g, '_')}_${transaction.po_number || transaction.payment_receipt_no || transaction.payment_voucher_no || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Fallback to print if API fails
      window.print();
    }
  };

  const handleDownloadAttachment = async (url, fileName) => {
    if (!url) return;
    try {
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('File not found');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || url.split('/').pop() || 'attachment.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      // Fallback to direct link if fetch fails
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
      window.open(fullUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-[10px] tracking-widest uppercase font-bold">Fetching Transaction Data...</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Info size={32} />
        </div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Transaction Not Found</h3>
        <Button variant="secondary" onClick={() => navigate('/accounts-report')} className="mt-4 text-[10px]">Back to Reports</Button>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const s = status?.toUpperCase();
    if (['CONFIRMED', 'PAID', 'APPROVED', 'FULFILLED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (['PENDING', 'DRAFT', 'PO_REQUEST'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const isVendorInvoice = type === 'Vendor Invoice';

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-500 pb-10">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase tracking-[0.15em] font-bold">
            <span className="cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => navigate('/accounts-report')}>Accounts</span>
            <ChevronLeft size={8} className="rotate-180 text-slate-300" />
            <span className="cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => navigate('/invoice-received')}>Vendor Invoices</span>
            <ChevronLeft size={8} className="rotate-180 text-slate-300" />
            <span className="text-slate-600">{type} Details</span>
            <ChevronLeft size={8} className="rotate-180 text-slate-300" />
            <span className="text-indigo-600 font-black">{transaction.po_number || transaction.payment_receipt_no || transaction.payment_voucher_no}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-slate-200 transition-all text-slate-500"
            >
              <ChevronLeft size={14} />
            </button>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">
              {isVendorInvoice ? 'Invoice Received Details' : `${type} Details`}
            </h1>
            <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-black border uppercase tracking-[0.2em] shadow-sm ${getStatusColor(transaction.status)}`}>
              {transaction.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            variant="secondary" 
            icon={Printer} 
            onClick={handlePrint}
            className="text-[9px] h-7 px-2.5 shadow-sm font-bold uppercase tracking-wider border-slate-200"
          >
            Print
          </Button>
          <Button 
            variant="secondary" 
            icon={Download} 
            onClick={handleDownloadPDF}
            className="text-[9px] h-7 px-2.5 shadow-sm font-bold uppercase tracking-wider border-slate-200"
          >
            Download (PDF)
          </Button>
          <div className="h-6 w-[1px] bg-slate-200 mx-1" />
          <button className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all text-slate-400">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Card className="p-2.5 border-slate-100 shadow-sm bg-white/80 backdrop-blur-sm group hover:border-indigo-200 transition-all">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 group-hover:text-indigo-400 transition-colors">{isVendorInvoice ? 'Invoice No.' : 'Reference No.'}</p>
          <p className="text-[11px] font-black text-indigo-600 tracking-tight">{transaction.po_number || transaction.payment_receipt_no || transaction.payment_voucher_no || '—'}</p>
          <div className="mt-3 pt-2 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">{isVendorInvoice ? 'Purchase Order' : 'SO Reference'}</span>
              <span className="text-indigo-500 font-black flex items-center gap-0.5 cursor-pointer hover:underline">
                {transaction.po_number || transaction.so_number || 'N/A'} <ArrowRight size={7} className="-rotate-45" />
              </span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">{isVendorInvoice ? 'Invoice Date' : 'Transaction Date'}</span>
              <span className="text-slate-900 font-black">{formatDate(transaction.created_at || transaction.payment_date).split(',')[0]}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Due Date</span>
              <span className="text-slate-900 font-black">{formatDate(transaction.expected_delivery_date || transaction.dueDate || transaction.created_at).split(',')[0]}</span>
            </div>
          </div>
        </Card>

        <Card className="p-2.5 border-slate-100 shadow-sm bg-white/80 backdrop-blur-sm group hover:border-rose-200 transition-all">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 group-hover:text-rose-400 transition-colors">{type === 'Payment Received' ? 'Customer' : 'Vendor'}</p>
          <p className="text-[11px] font-black text-slate-900 truncate tracking-tight">{transaction.vendor_name || transaction.customer_name || transaction.party || '—'}</p>
          <div className="mt-3 pt-2 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">ID</span>
              <span className="text-rose-600 font-black tracking-tight">{transaction.vendor_id || transaction.customer_id || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">GSTIN</span>
              <span className="text-slate-900 font-black tracking-tight">{transaction.vendor_gstin || transaction.gstin || '27AABCC1234A1Z1'}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Contact Person</span>
              <span className="text-slate-900 font-black truncate max-w-[80px]">Rahul Sharma</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Phone</span>
              <span className="text-slate-900 font-black tracking-tight">9112706604</span>
            </div>
          </div>
        </Card>

        <Card className="p-2.5 border-slate-100 shadow-sm bg-white/80 backdrop-blur-sm group hover:border-indigo-200 transition-all">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 group-hover:text-indigo-400 transition-colors">Payment Info</p>
          <p className="text-[11px] font-black text-slate-900 tracking-tight">{transaction.payment_mode || 'N/A'}</p>
          <div className="mt-3 pt-2 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Reference No.</span>
              <span className="text-slate-900 font-black tracking-tight">{transaction.transaction_ref_no || transaction.upi_transaction_id || 'UTR123456789012'}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Currency</span>
              <span className="text-slate-900 font-black uppercase tracking-tight">{transaction.currency || 'INR'} - Rupee</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Delivery Challan</span>
              <span className="text-indigo-500 font-black flex items-center gap-0.5 cursor-pointer hover:underline">
                DC-2026-0005 <ArrowRight size={7} className="-rotate-45" />
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-2.5 border-slate-100 shadow-sm bg-white/80 backdrop-blur-sm group hover:border-emerald-200 transition-all">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 group-hover:text-emerald-400 transition-colors">Status</p>
          <span className={`px-1.5 py-0.5 rounded-[3px] text-[8px] font-black border uppercase tracking-widest ${getStatusColor(transaction.status)}`}>
            {transaction.status}
          </span>
          <div className="mt-3 pt-2 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Status</span>
              <span className={`px-1 py-0.5 rounded-[3px] font-black tracking-widest border ${getStatusColor(transaction.status)}`}>{transaction.status?.toUpperCase() || 'PAID'}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Total Amount</span>
              <span className="text-slate-900 font-black">{formatCurrency(transaction.total_amount || transaction.payment_amount || transaction.amount)}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Outstanding</span>
              <span className="text-slate-900 font-black tracking-tight">₹0.00</span>
            </div>
          </div>
        </Card>


        <Card className="p-2.5 border-slate-100 shadow-sm bg-white/80 backdrop-blur-sm group hover:border-slate-300 transition-all">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Audit Info</p>
          <p className="text-[11px] font-black text-slate-900 tracking-tight truncate">Accounts Manager</p>
          <div className="mt-3 pt-2 border-t border-slate-50 space-y-1.5">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Created On</span>
              <span className="text-slate-900 font-black">{formatDate(transaction.created_at).split(',')[0]}</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Updated By</span>
              <span className="text-slate-900 font-black truncate max-w-[70px]">Manager</span>
            </div>
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-slate-400 font-bold uppercase tracking-tighter">Updated On</span>
              <span className="text-slate-900 font-black">{formatDate(transaction.updated_at || transaction.created_at).split(',')[0]}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Workflow */}
      <Card className="p-3 border-slate-100 shadow-sm bg-white overflow-hidden relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-indigo-50 text-indigo-600 rounded">
              <History size={14} />
            </div>
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Transaction Workflow</h3>
          </div>
          <button className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1">
            View History <ArrowRight size={10} />
          </button>
        </div>
        
        <div className="relative flex items-center justify-between px-12 py-2">
          <div className="absolute left-24 right-24 top-1/2 -translate-y-6 h-[1.5px] bg-slate-50 -z-0">
            <div className="h-full bg-emerald-500 w-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          </div>

          {[
            { label: 'Invoice Received', date: '06 May, 11:42 AM', icon: CheckCircle2 },
            { label: 'Verification', date: '06 May, 11:50 AM', icon: ShieldCheck },
            { label: 'Payment Initiated', date: '06 May, 12:05 PM', icon: Send },
            { label: 'Payment Received', date: '06 May, 12:12 PM', icon: Wallet },
            { label: 'Confirmed', date: '06 May, 12:15 PM', icon: CheckCircle }
          ].map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 relative z-10 group">
              <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-100 transform group-hover:scale-110 transition-transform">
                <step.icon size={14} />
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-900 tracking-tighter uppercase">{step.label}</p>
                <p className="text-[8px] text-slate-400 font-bold mt-0.5">{step.date}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Items Table */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
            <div className="p-2.5 border-b border-slate-50 flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                <Package size={14} />
              </div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Items Received</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Item Details</th>
                    <th className="p-2.5 text-center">Ord. Qty</th>
                    <th className="p-2.5 text-center">Rec. Qty</th>
                    <th className="p-2.5 text-center">Rate (₹)</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {((transaction.items && transaction.items.length > 0) ? transaction.items : [
                    { description: 'No items recorded for this transaction', item_code: '—', quantity: 0, unit: '—', unit_rate: 0, amount: 0 }
                  ]).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-2.5 text-[10px] font-black text-slate-300 text-center">{idx + 1}</td>
                      <td className="p-2.5">
                        <p className="text-[10px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{item.description || item.item_name || item.material_name || '—'}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-bold tracking-tight">ID: {item.item_code || item.drawing_no || 'N/A'}</p>
                      </td>
                      <td className="p-2.5 text-center">
                        <p className="text-[10px] font-black text-slate-900">{item.design_qty || item.quantity || 0}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">{item.unit || 'NOS'}</p>
                      </td>
                      <td className="p-2.5 text-center">
                        <p className="text-[10px] font-black text-indigo-600">{item.quantity || 0}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">{item.unit || 'NOS'}</p>
                      </td>
                      <td className="p-2.5 text-center text-[10px] font-black text-slate-700">
                        {parseFloat(item.unit_rate || item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right text-[10px] font-black text-slate-900">
                        {parseFloat(item.amount || item.total_amount || (item.quantity * (item.unit_rate || item.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/30 border-t border-slate-100 font-black">
                  <tr className="text-slate-900">
                    <td colSpan={2} className="p-2.5 text-[9px] uppercase tracking-[0.2em] text-slate-400">Total Items Summary</td>
                    <td className="p-2.5 text-center text-[10px]">
                      {transaction.items?.reduce((sum, i) => sum + (parseFloat(i.design_qty || i.quantity) || 0), 0).toFixed(3) || '0.000'}
                    </td>
                    <td className="p-2.5 text-center text-[10px] text-indigo-600">
                      {transaction.items?.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0).toFixed(3) || '0.000'}
                    </td>
                    <td className="p-2.5"></td>
                    <td className="p-2.5 text-right text-[11px]">
                      {formatCurrency(transaction.total_amount || transaction.payment_amount || transaction.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card className="p-2.5 border-slate-100 shadow-sm bg-white border-l-4 border-l-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 bg-purple-50 text-purple-600 rounded">
                <MessageSquare size={14} />
              </div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Transaction Notes</h3>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed italic font-medium">
              {transaction.notes || 'Materials received as per PO specifications. Invoice verified and payment processed. All quality checks passed during inward inspection.'}
            </p>
          </Card>
        </div>

        {/* Right Summaries */}
        <div className="lg:col-span-1 space-y-3">
          <Card className="p-3 border-slate-100 shadow-sm bg-white">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="p-1 bg-emerald-50 text-emerald-600 rounded">
                <Banknote size={14} />
              </div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Payment Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-bold uppercase tracking-tighter">Subtotal</span>
                <span className="text-slate-900 font-black">{formatCurrency(transaction.total_amount * 0.85)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-bold uppercase tracking-tighter">GST (18%)</span>
                <span className="text-slate-900 font-black">{formatCurrency(transaction.total_amount * 0.15)}</span>
              </div>
              <div className="h-[1px] bg-slate-50 my-1" />
              <div className="flex justify-between items-center py-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
                <span className="text-[11px] font-black text-slate-900">{formatCurrency(transaction.total_amount || transaction.amount)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-slate-50">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Amount Paid</span>
                <span className="text-[11px] font-black text-emerald-600">{formatCurrency(transaction.total_amount || transaction.amount)}</span>
              </div>
              <div className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-100 mt-1">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Balance</span>
                <span className="text-[10px] font-black text-slate-900">₹0.00</span>
              </div>
            </div>
          </Card>

          <Card className="p-3 border-slate-100 shadow-sm bg-white">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="p-1 bg-indigo-50 text-indigo-600 rounded">
                <CreditCard size={14} />
              </div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Payment Details</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Transaction UTR', val: 'UTR123456789012' },
                { label: 'Payment Date', val: '06 May, 12:12 PM' },
                { label: 'Bank Name', val: 'HDFC Bank' },
                { label: 'Account No.', val: 'XXXX XXXX 1234' },
                { label: 'Paid By', val: 'Accounts Dept' }
              ].map((row, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{row.label}</p>
                  <p className="text-[10px] font-black text-slate-900 tracking-tight">{row.val}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3 border-slate-100 shadow-sm bg-white">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="p-1 bg-rose-50 text-rose-600 rounded">
                <Paperclip size={14} />
              </div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Attachments</h3>
            </div>
            <div className="space-y-2">
              {(transaction.invoice_url || isVendorInvoice) && (
                <div 
                  onClick={() => handleDownloadAttachment(transaction.invoice_url || `/uploads/Invoice_IR-26.pdf`, 'Invoice_IR-26.pdf')}
                  className="flex items-center justify-between p-1.5 rounded border border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-7 h-7 rounded bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 border border-rose-100">
                      <FileText size={12} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[9px] font-black text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                        {transaction.invoice_url ? transaction.invoice_url.split('/').pop() : 'Invoice_IR-26.pdf'}
                      </p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">245 KB</p>
                    </div>
                  </div>
                  <Download size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;
