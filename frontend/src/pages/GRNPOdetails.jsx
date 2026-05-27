import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  ChevronRight, 
  FileText, 
  ShoppingCart, 
  Inbox,
  Clock,
  Send,
  CheckCircle2,
  Printer,
  Download,
  Building2,
  Package,
  Calendar,
  CreditCard,
  Truck,
  MapPin,
  Check,
  MoreVertical,
  User,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Users
} from 'lucide-react';
import { Card, Tabs, StatusBadge, Button } from '../components/ui.jsx';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const GRNPOdetails = () => {
  const { poId: paramPoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract ID from URL if not available in params (for manual routing)
  const poId = paramPoId || location.pathname.split('/').pop();
  
  const [activeTab, setActiveTab] = useState('PO Details');
  const [loading, setLoading] = useState(true);
  const [poData, setPoData] = useState(null);
  const [rfqData, setRfqData] = useState(null);
  const [grnData, setGrnData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handleDownloadPDF = async () => {
    if (!poData?.id) return;
    try {
      setDownloading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poData.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO_${poData.po_number || poData.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPDF = async () => {
    if (!poData?.id) return;
    try {
      setPrinting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poData.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      } else {
        throw new Error('Failed to print PDF');
      }
    } catch (error) {
      console.error('Error printing PDF:', error);
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [poId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Fetch PO Details
      const poRes = await fetch(`${API_BASE}/purchase-orders/${poId}`, { headers });
      if (!poRes.ok) throw new Error('Failed to fetch PO');
      const po = await poRes.json();
      setPoData(po);

      // 2. Fetch RFQ Data if available
      if (po.mr_id) {
        const rfqRes = await fetch(`${API_BASE}/rfqs/mr/${po.mr_id}`, { headers });
        if (rfqRes.ok) {
          const rfqs = await rfqRes.json();
          // Find the RFQ associated with this PO's quotation if possible, or just the first one
          const rfq = rfqs.find(r => r.id === po.rfq_id) || rfqs[0];
          setRfqData(rfq);
        }
      }

      // 3. Fetch GRN Data associated with this PO
      const grnsRes = await fetch(`${API_BASE}/grns`, { headers });
      if (grnsRes.ok) {
        const allGrns = await grnsRes.json();
        const poGrns = allGrns.filter(g => g.poNumber === po.po_number);
        if (poGrns.length > 0) {
          // Get full details for the first GRN
          const grnDetailRes = await fetch(`${API_BASE}/grns/${poGrns[0].id}`, { headers });
          const grnItemsRes = await fetch(`${API_BASE}/grn-items/${poGrns[0].id}/details`, { headers });
          if (grnDetailRes.ok && grnItemsRes.ok) {
            const detail = await grnDetailRes.json();
            const items = await grnItemsRes.json();
            setGrnData({ ...detail, ...items });
          }
        }
      }

    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-600 rounded animate-spin" />
        <h3 className="text-slate-900 font-medium">Loading Details...</h3>
      </div>
    );
  }

  if (!poData) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">PO Not Found</h2>
        <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const tabs = [
    { label: 'RFQ Information', icon: FileText, value: 'RFQ Information' },
    { label: 'PO Details', icon: ShoppingCart, value: 'PO Details' },
    { label: 'GRN Details', icon: Inbox, value: 'GRN Details' }
  ];

  const renderRFQTab = () => {
    if (!rfqData) return <div className="p-8 text-center text-slate-500">No RFQ Information available for this PO.</div>;

    const rfqKpis = [
        { label: 'Total Suppliers', value: rfqData.quotations?.length || 0 },
        { label: 'Responses Received', value: rfqData.quotations?.filter(q => q.status === 'RECEIVED' || q.status === 'REVIEWED').length || 0 },
        { label: 'Pending Responses', value: rfqData.quotations?.filter(q => q.status === 'SENT' || q.status === 'DRAFT').length || 0 },
        { label: 'Response Rate', value: rfqData.quotations?.length ? `${Math.round(((rfqData.quotations?.filter(q => q.status === 'RECEIVED' || q.status === 'REVIEWED').length || 0) / rfqData.quotations.length) * 100)}%` : '0%' }
    ];

    const quotes = rfqData.quotations || [];
    const quotedAmounts = quotes.map(q => parseFloat(q.grand_total || q.total_amount) || 0).filter(a => a > 0);
    
    const amountSummary = [
        { label: 'Lowest Quoted', value: quotedAmounts.length ? formatCurrency(Math.min(...quotedAmounts)) : '—' },
        { label: 'Highest Quoted', value: quotedAmounts.length ? formatCurrency(Math.max(...quotedAmounts)) : '—' },
        { label: 'Average Quoted', value: quotedAmounts.length ? formatCurrency(quotedAmounts.reduce((a, b) => a + b, 0) / quotedAmounts.length) : '—' }
    ];

    return (
      <div className="animate-in fade-in slide-in-from-bottom duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-3">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-slate-800 text-sm">RFQ Information</h3>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[10px] text-slate-400">RFQ Number</p>
                  <p className="text-xs font-medium text-slate-900">{rfqData.rfq_number}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">RFQ Type</p>
                  <p className="text-xs font-medium text-slate-900">Material Supply</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Status</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">{rfqData.status || 'Sent'}</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">RFQ Date</p>
                  <p className="text-xs font-medium text-slate-900">{formatDate(rfqData.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Currency</p>
                  <p className="text-xs font-medium text-slate-900">INR - Indian Rupee</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Created By</p>
                  <p className="text-xs font-medium text-slate-900">{rfqData.requester_name || 'Procurement Officer'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Project / Customer</p>
                  <p className="text-xs font-medium text-slate-900 truncate">{rfqData.project_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Payment Terms</p>
                  <p className="text-xs font-medium text-slate-900">30 Days</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50">
                    <h3 className="font-semibold text-slate-800 text-sm">RFQ Items</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="p-2">#</th>
                                <th className="p-2">Item Code / Description</th>
                                <th className="p-2 text-center">Required Qty</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2">Specification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {rfqData.items?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group text-[10px]">
                                    <td className="p-2 text-slate-400">{idx + 1}</td>
                                    <td className="p-2">
                                        <p className="font-medium text-slate-900">{item.material_name || item.item_code}</p>
                                    </td>
                                    <td className="p-2 text-center font-medium text-slate-900">{item.quantity}</td>
                                    <td className="p-2 text-slate-500">{item.uom || 'NOS'}</td>
                                    <td className="p-2 text-slate-500 text-[9px]">IS 2062 Gr. B</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">Supplier Summary</h3>
                </div>
                <div className="p-3 space-y-2">
                    {rfqKpis.map((kpi, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500">{kpi.label}</span>
                            <span className="text-xs font-semibold text-slate-900">{kpi.value}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50">
                    <h3 className="font-semibold text-slate-800 text-sm">Supplier Responses</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="p-2">Supplier</th>
                                <th className="p-2">Response Date</th>
                                <th className="p-2">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {quotes.map((quote, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group text-[10px]">
                                    <td className="p-2">
                                        <p className="font-medium text-slate-900">{quote.vendor_name}</p>
                                    </td>
                                    <td className="p-2 text-slate-500">{formatDate(quote.created_at)}</td>
                                    <td className="p-2">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                            quote.status === 'REVIEWED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                                        }`}>
                                            {quote.status === 'REVIEWED' ? 'Accepted' : 'Submitted'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderPOTab = () => {
    const poSteps = [
        { label: 'PO Created', status: 'DRAFT', icon: CheckCircle2, date: poData.created_at },
        { label: 'PO Sent', status: 'SENT', icon: Send, date: poData.created_at },
        { label: 'PO Confirmed', status: 'ORDERED', icon: CheckCircle2, date: poData.created_at },
        { label: 'In Transit', status: 'RECEIVED', icon: Truck },
        { label: 'Delivered', status: 'FULFILLED', icon: Package }
    ];

    const currentStatus = poData.status?.toUpperCase() || 'DRAFT';
    const activeStepIndex = poSteps.findIndex(s => s.status === currentStatus);

    return (
      <div className="animate-in fade-in slide-in-from-bottom duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-3">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-slate-800 text-sm">PO Information</h3>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[10px] text-slate-400">PO Number</p>
                  <p className="text-xs font-medium text-slate-900">{poData.po_number}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Supplier</p>
                  <p className="text-xs font-medium text-slate-900">{poData.vendor_name}</p>
                  <p className="text-[9px] text-emerald-600 font-medium">Active Vendor</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Status</p>
                  <StatusBadge status={poData.status} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">PO Date</p>
                  <p className="text-xs font-medium text-slate-900">{formatDate(poData.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">PO Type</p>
                  <p className="text-xs font-medium text-slate-900">Stock/Internal</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Created By</p>
                  <p className="text-xs font-medium text-slate-900">Procurement Officer</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Expected Delivery</p>
                  <p className="text-xs font-medium text-slate-900">{formatDate(poData.expected_delivery_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Payment Terms</p>
                  <p className="text-xs font-medium text-slate-900">30 Days</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Project / Customer</p>
                  <p className="text-xs font-medium text-slate-900 truncate" title={poData.project_name}>{poData.project_name}</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 text-sm">PO Items</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="p-2">#</th>
                                <th className="p-2">Item Code / Description</th>
                                <th className="p-2 text-center">Ordered Qty</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2 text-right">Rate (₹)</th>
                                <th className="p-2 text-right">Amount (₹)</th>
                                <th className="p-2 text-center">Expected Delivery</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {poData.items?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group text-[10px]">
                                    <td className="p-2 text-slate-400">{idx + 1}</td>
                                    <td className="p-2">
                                        <p className="font-medium text-slate-900">{item.description || item.item_code}</p>
                                    </td>
                                    <td className="p-2 text-center font-medium text-slate-900">{item.quantity}</td>
                                    <td className="p-2 text-slate-500">{item.unit || 'NOS'}</td>
                                    <td className="p-2 text-right text-slate-900">{parseFloat(item.unit_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-2 text-right font-medium text-slate-900">{parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-2 text-center text-slate-500">{formatDate(poData.expected_delivery_date)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">PO Summary</h3>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Items</span>
                        <span className="text-xs font-semibold text-slate-900">{poData.items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Quantity</span>
                        <span className="text-xs font-semibold text-slate-900">{poData.items?.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Amount</span>
                        <span className="text-xs font-semibold text-slate-900">₹{parseFloat(poData.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Tax Amount (18%)</span>
                        <span className="text-xs font-semibold text-slate-900">₹{(parseFloat(poData.total_amount || 0) * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-900">Total PO Value</span>
                        <span className="text-sm font-bold text-emerald-600">₹{(parseFloat(poData.total_amount || 0) * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">Delivery & Payment</h3>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Dispatch Terms</span>
                        <span className="text-xs font-semibold text-slate-900">EXW - Ex Works</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Payment Terms</span>
                        <span className="text-xs font-semibold text-slate-900">30 Days</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Payment Status</span>
                        <span className="text-xs font-semibold text-rose-600">Unpaid</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Advance Paid</span>
                        <span className="text-xs font-semibold text-slate-900">₹0.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Balance Payable</span>
                        <span className="text-xs font-semibold text-slate-900">₹{(parseFloat(poData.total_amount || 0) * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50">
                    <h3 className="font-semibold text-slate-800 text-sm">Amount Summary</h3>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Subtotal</span>
                        <span className="text-xs font-semibold text-slate-900">₹{parseFloat(poData.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">CGST (9%)</span>
                        <span className="text-xs font-semibold text-slate-900">₹{(parseFloat(poData.total_amount || 0) * 0.09).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">SGST (9%)</span>
                        <span className="text-xs font-semibold text-slate-900">₹{(parseFloat(poData.total_amount || 0) * 0.09).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-900">Total PO Value</span>
                        <span className="text-sm font-bold text-emerald-600">₹{(parseFloat(poData.total_amount || 0) * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50">
                    <h3 className="font-semibold text-slate-800 text-sm">PO Workflow</h3>
                </div>
                <div className="p-3">
                    <div className="flex items-center justify-between relative px-2">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                        {poSteps.map((step, idx) => {
                            const isCompleted = idx <= activeStepIndex;
                            const Icon = step.icon;
                            return (
                                <div key={idx} className="flex flex-col items-center gap-1 z-10">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-300'
                                    }`}>
                                        <Icon className="w-3 h-3" />
                                    </div>
                                    <p className={`text-[8px] font-medium whitespace-nowrap ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderGRNTab = () => {
    if (!grnData) return <div className="p-8 text-center text-slate-500">No GRN recorded for this PO yet.</div>;

    const grnSteps = [
        { label: 'Goods Received', date: grnData.grnDate, icon: Package },
        { label: 'QC / Inspection', date: grnData.grnDate, icon: ShieldCheck },
        { label: 'Accepted', date: grnData.grnDate, icon: CheckCircle2 },
        { label: 'Stored', icon: Inbox }
    ];

    return (
      <div className="animate-in fade-in slide-in-from-bottom duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-3">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-slate-800 text-sm">GRN Information</h3>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[10px] text-slate-400">GRN Number</p>
                  <p className="text-xs font-medium text-slate-900">{`GRN-${String(grnData.id).padStart(4, '0')}`}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Received By</p>
                  <p className="text-xs font-medium text-slate-900">Warehouse Incharge</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Status</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">{grnData.status}</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">GRN Date</p>
                  <p className="text-xs font-medium text-slate-900">{formatDate(grnData.grnDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Warehouse</p>
                  <p className="text-xs font-medium text-slate-900">Main Warehouse</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Remark</p>
                  <p className="text-xs font-medium text-slate-900">{grnData.notes || 'Received as per PO.'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">PO Number</p>
                  <p className="text-xs font-medium text-indigo-600">{grnData.poNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Supplier</p>
                  <p className="text-xs font-medium text-slate-900">{grnData.vendorName}</p>
                  <p className="text-[9px] text-emerald-600 font-medium">Active Vendor</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50">
                    <h3 className="font-semibold text-slate-800 text-sm">GRN Items</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="p-2">#</th>
                                <th className="p-2">Item Code / Description</th>
                                <th className="p-2 text-center">Ordered Qty (PO)</th>
                                <th className="p-2 text-center">Received Qty</th>
                                <th className="p-2 text-center">Accepted Qty</th>
                                <th className="p-2 text-center">Rejected Qty</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {grnData.items?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group text-[10px]">
                                    <td className="p-2 text-slate-400">{idx + 1}</td>
                                    <td className="p-2">
                                        <p className="font-medium text-slate-900">{item.description || item.item_code}</p>
                                    </td>
                                    <td className="p-2 text-center font-medium text-slate-900">{item.po_qty}</td>
                                    <td className="p-2 text-center font-medium text-slate-900">{item.received_qty}</td>
                                    <td className="p-2 text-center font-medium text-emerald-600">{item.accepted_qty}</td>
                                    <td className="p-2 text-center font-medium text-rose-600">{item.rejected_qty}</td>
                                    <td className="p-2 text-slate-500">{item.unit || 'NOS'}</td>
                                    <td className="p-2">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">Accepted</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">GRN Summary</h3>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Items</span>
                        <span className="text-xs font-semibold text-slate-900">{grnData.summary?.total_items || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Received Qty</span>
                        <span className="text-xs font-semibold text-slate-900">{grnData.summary?.total_received_qty || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Accepted Qty</span>
                        <span className="text-xs font-semibold text-slate-900">{grnData.summary?.total_accepted_qty || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Total Rejected Qty</span>
                        <span className="text-xs font-semibold text-rose-600">{grnData.summary?.total_rejected_qty || 0}</span>
                    </div>
                </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">Quality Check</h3>
                </div>
                <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">QC Performed By</span>
                        <span className="text-xs font-semibold text-slate-900">QC Executive</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">QC Date</span>
                        <span className="text-xs font-semibold text-slate-900">{formatDate(grnData.grnDate)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">QC Status</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">Accepted</span>
                    </div>
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] text-slate-500">Quality Remark</span>
                        <span className="text-[9px] font-medium text-slate-600 text-right max-w-[150px]">All items verified and accepted.</span>
                    </div>
                </div>
            </Card>

            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 border-b border-slate-50">
                    <h3 className="font-semibold text-slate-800 text-sm">GRN Workflow</h3>
                </div>
                <div className="p-3">
                    <div className="flex items-center justify-between relative px-2">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                        {grnSteps.map((step, idx) => {
                            const isCompleted = step.date || idx === 0;
                            const Icon = step.icon;
                            return (
                                <div key={idx} className="flex flex-col items-center gap-1 z-10">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isCompleted ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-300'
                                    }`}>
                                        <Icon className="w-3 h-3" />
                                    </div>
                                    <p className={`text-[8px] font-medium whitespace-nowrap ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1.5 px-4 py-2 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 flex items-center justify-center rounded bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-all border border-slate-200 active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
              <span>Procurement Report</span>
              <ChevronRight className="w-2 h-2" />
              <span>Purchase Orders & Goods Receipts</span>
              <ChevronRight className="w-2 h-2" />
              <span className="text-rose-600">{poData.po_number}</span>
            </div>
            <div className="flex items-center gap-2 mt-0">
              <h1 className="text-base font-bold text-slate-900">Purchase Order Details</h1>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-semibold">Confirmed</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm" 
            icon={Printer} 
            onClick={handlePrintPDF} 
            loading={printing}
            className="text-[10px] py-1 h-8"
          >
            Print PO
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            icon={Download} 
            onClick={handleDownloadPDF} 
            loading={downloading}
            className="text-[10px] py-1 h-8"
          >
            Download PDF
          </Button>
          <button className="p-1.5 text-slate-400 hover:text-slate-600">
            <MoreVertical className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="text-right">
                <p className="text-[9px] text-slate-500 leading-none">Procurement</p>
                <p className="text-[10px] font-semibold text-slate-900">Procurement Officer</p>
            </div>
            <div className="w-7 h-7 rounded bg-rose-500 flex items-center justify-center text-white text-[10px] font-bold">P</div>
          </div>
        </div>
      </div>

      <Card className="bg-white border-none shadow-none">
        <Tabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          className="mb-1"
        />

        <div className="mt-1">
          {activeTab === 'RFQ Information' && renderRFQTab()}
          {activeTab === 'PO Details' && renderPOTab()}
          {activeTab === 'GRN Details' && renderGRNTab()}
        </div>
      </Card>
    </div>
  );
};

export default GRNPOdetails;
