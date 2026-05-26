import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ChevronRight, Printer, Download, Pencil, FileText, Calendar, 
  Truck, CheckCircle2, IndianRupee, Users, ClipboardList, 
  Package, Factory, CreditCard, Clock, Zap, ArrowLeft,
  ChevronDown, ChevronUp, ExternalLink, Mail, Phone, MapPin,
  Eye, Check, RotateCw, PieChart as PieChartIcon, BarChart3, Activity
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Card, StatusBadge, Button } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const SalesReportDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  
  const id = routeId || location.pathname.split('/').pop();
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [quotation, setQuotation] = useState(null);
  const [customerPo, setCustomerPo] = useState(null);
  const [activeTab, setActiveTab] = useState('Order Details');
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  useEffect(() => {
    if (order && activeTab === 'Quotation Details' && !quotation) {
      fetchQuotationDetails();
    }
    if (order && activeTab === 'PO Details' && !customerPo) {
      fetchPODetails();
    }
  }, [order, activeTab]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/order/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setOrder(data);
    } catch (err) {
      console.error('Error:', err);
      errorToast('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotationDetails = async () => {
    if (!order?.quotation_id) return;
    try {
      const token = localStorage.getItem('authToken');
      // For Sales Orders, try quotation-requests first as they are client quotations
      const endpoint = order.source_type === 'DIRECT' 
        ? `${API_BASE}/customer-pos/${order.quotation_id}`
        : `${API_BASE}/quotation-requests/version-details/${order.quotation_id}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuotation(data);
      } else if (order.source_type !== 'DIRECT') {
        // Fallback to regular quotations if quotation-request fails
        const fallbackResponse = await fetch(`${API_BASE}/quotations/${order.quotation_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          setQuotation(data);
        }
      }
    } catch (err) {
      console.error('Error fetching quotation:', err);
    }
  };

  const fetchPODetails = async () => {
    if (order?.source_type === 'DIRECT' && order.quotation_id) {
      if (quotation) {
        setCustomerPo(quotation);
      } else {
        await fetchQuotationDetails();
      }
    }
  };

  const toggleItemExpansion = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/order/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Order_${order?.order_no || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      errorToast('Failed to download PDF');
    }
  };

  const handleDownloadQuotation = async () => {
    if (!order?.quotation_id) {
      errorToast('Quotation ID not found');
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      let endpoint;
      if (order.source_type === 'DIRECT') {
        endpoint = `${API_BASE}/customer-pos/${order.quotation_id}/pdf`;
      } else {
        // Try quotation-requests endpoint first
        endpoint = `${API_BASE}/quotation-requests/download-pdf/${order.quotation_id}`;
      }
        
      let response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Fallback to regular quotations if it fails and it's not DIRECT
      if (!response.ok && order.source_type !== 'DIRECT') {
        endpoint = `${API_BASE}/quotations/${order.quotation_id}/pdf`;
        response = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      if (!response.ok) throw new Error('Failed to generate Quotation PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Quotation_${quotation?.quotation_no || order.quotation_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      errorToast('Failed to download Quotation PDF');
    }
  };

  const handleDownloadPO = async () => {
    if (!order?.po_id && !order?.quotation_id) {
      errorToast('PO ID not found');
      return;
    }
    try {
      const idToUse = order.po_id || order.quotation_id;
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-pos/${idToUse}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate PO PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PO_${customerPo?.po_number || idToUse}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      errorToast('Failed to download PO PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Fetching order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Order Not Found</h3>
        <p className="text-slate-500 mt-2">The requested sales order could not be located.</p>
        <Button variant="primary" onClick={() => navigate('/sales/sales-report')} className="mt-6">
          Back to Sales Report
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/sales/sales-report')}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
              <span>Sales</span>
              <ChevronRight className="w-3 h-3" />
              <span>Orders</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-indigo-600">{order.order_no}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Sales Order Details</h1>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded uppercase tracking-widest border border-emerald-100">
                Active
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Header buttons removed as per request */}
        </div>
      </div>

      {/* 2. Top Summary Row (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard icon={FileText} label="Sales Order No." value={order.order_no} color="indigo" />
        <SummaryCard icon={Calendar} label="Order Date" value={new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} color="amber" />
        <SummaryCard icon={Calendar} label="Delivery Date" value={order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} color="blue" />
        <SummaryCard icon={CheckCircle2} label="Order Status" value={order.status} color="emerald" showPulse />
        <SummaryCard icon={IndianRupee} label="Total Order Value" value={`₹ ${Number(order.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} color="rose" />
      </div>

      {/* 3. Tabs Row - Small UI */}
      <div className="flex border-b border-slate-200 gap-8 px-1 mt-2">
        {[
          { name: 'Order Details', icon: Activity },
          { name: 'Quotation Details', icon: IndianRupee },
          { name: 'PO Details', icon: Users }
        ].map(tab => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center gap-1.5 pb-2 text-[12px] font-bold transition-all relative ${
              activeTab === tab.name ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.name ? 'text-rose-500' : 'text-slate-400'}`} />
            {tab.name}
            {activeTab === tab.name && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-rose-500 rounded-t-full"></div>
            )}
          </button>
        ))}
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'Order Details' && (
        <OrderTabContent 
          order={order} 
          expandedItems={expandedItems} 
          toggleItemExpansion={toggleItemExpansion} 
          handlePrint={handlePrint}
          handleDownloadPDF={handleDownloadPDF}
        />
      )}
      {activeTab === 'Quotation Details' && (
        <QuotationTabContent 
          order={order} 
          quotation={quotation}
          expandedItems={expandedItems} 
          toggleItemExpansion={toggleItemExpansion} 
          handleDownloadQuotation={handleDownloadQuotation}
        />
      )}
      {activeTab === 'PO Details' && (
        <POTabContent 
          order={order} 
          customerPo={customerPo}
          expandedItems={expandedItems} 
          toggleItemExpansion={toggleItemExpansion} 
          handleDownloadPO={handleDownloadPO}
        />
      )}
    </div>
  );
};

/* --- TAB CONTENT COMPONENTS --- */

const OrderTabContent = ({ order, expandedItems, toggleItemExpansion, handlePrint, handleDownloadPDF }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 1. Order Information */}
        <div className="lg:w-[35%] bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm text-slate-900 font-semibold">1. Order Information</h3>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="p-1.5 hover:bg-slate-50 rounded border border-slate-200" title="Print Order">
                <Printer className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button onClick={handleDownloadPDF} className="p-1.5 hover:bg-slate-50 rounded border border-slate-200" title="Download Order PDF">
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="space-y-3.5">
            <InfoRow label="Sales Order No" value={order.order_no} />
            <InfoRow label="Order Type" value={order.source_type || 'Sales'} />
            <InfoRow label="Order Date" value={new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
            <InfoRow label="Delivery Date" value={order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
            <InfoRow label="Project Name" value={order.project_name} className="text-indigo-600 font-bold" />
            <InfoRow label="Sales Person" value="Sales Manager" />
            <InfoRow label="Payment Terms" value="30 Days" />
            <InfoRow label="Currency" value="INR - Indian Rupee" />
            <InfoRow label="Dispatch Type" value="Road Transport" />
            <InfoRow label="Priority Status" value={<span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-[4px] text-[9px] font-black border border-amber-100 uppercase">Medium</span>} />
          </div>
        </div>

        {/* 3. Customer Information */}
        <div className="lg:w-[35%] bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">3. Customer Information</h3>
          <div className="space-y-3.5">
            <InfoRow label="Customer Name" value={order.client} />
            <InfoRow label="Contact Person" value={order.contact_person || '—'} />
            <InfoRow label="Email" value={order.email_address || order.contact_email || '—'} isLink />
            <InfoRow label="Mobile Number" value={order.contact_phone || order.contact_mobile || '—'} />
            <InfoRow label="GST Number" value="27ABCDE1234F1Z5" />
            <div className="pt-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Billing Address</p>
              <p className="text-[11px] text-slate-600 leading-relaxed font-bold">
                {order.client}<br/>
                {order.billing_address || 'Address not provided'}
              </p>
            </div>
            <div className="pt-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Shipping Address</p>
              <p className="text-[11px] text-slate-600 leading-relaxed font-bold">
                Site Address - {order.client}<br/>
                {order.shipping_address || 'Address not provided'}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Order Execution Summary */}
        <div className="lg:w-[30%] bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">4. Order Execution Summary</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-y-4">
              <SummaryRow label="Total Items" value={order.items?.length || 0} />
              <SummaryRow label="Total Quantity" value={Number((order.items || []).reduce((sum, i) => sum + Number(i.quantity), 0)).toFixed(3)} />
              <SummaryRow label="Total Amount" value={`₹ ${Number(order.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <SummaryRow label="Discount" value="₹ 0.00" color="text-rose-500" />
              <SummaryRow label="Tax Amount (18%)" value={`₹ ${Number(order.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            </div>
            <div className="pt-6 border-t border-slate-100 mt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Final Order Value</p>
              <p className="text-3xl font-black text-emerald-600 mt-1 text-right tracking-tight">₹ {Number(order.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">2. Order Items Details <span className="text-indigo-500 ml-2 font-bold lowercase normal-case tracking-normal">(FG with Components)</span></h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <ItemsTable items={order.items} expandedItems={expandedItems} toggleItemExpansion={toggleItemExpansion} />
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="lg:w-1/4 bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">5. Production Status</h3>
          <div className="space-y-3.5">
            <StatusRow label="Production" status="In Production" />
            <StatusRow label="Packing" status="Pending" />
            <StatusRow label="Dispatch" status="Pending" />
            <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-50 mt-2">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Pending</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">5.000</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Done</p>
                <p className="text-lg font-black text-emerald-600 tracking-tight">4.000</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-1/4 bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">6. Delivery & Logistics</h3>
          <div className="space-y-3.5">
            <InfoRow label="Warehouse" value={order.warehouse || 'Main Warehouse'} />
            <InfoRow label="Dispatch Method" value="Road Transport" />
            <InfoRow label="Transport Name" value="Shree Transport" />
            <InfoRow label="Vehicle Number" value="MH12 AB 1234" />
            <InfoRow label="Expected Delivery Date" value={order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
          </div>
        </div>

        <div className="lg:w-1/4 bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">7. Payment Information</h3>
          <div className="space-y-3.5">
            <StatusRow label="Payment Status" status="Unpaid" />
            <InfoRow label="Advance Amount" value="₹ 0.00" />
            <InfoRow label="Pending Amount" value={`₹ ${Number(order.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} className="text-rose-600 font-black" />
            <StatusRow label="Invoice Status" status="Not Invoiced" />
          </div>
        </div>

        <div className="lg:w-1/4 bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm text-slate-900 font-semibold">8. Order Analytics</h3>
            <PieChartIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1 min-h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: 4 },
                    { name: 'Pending', value: 5 }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={8}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f43f5e" />
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    fontSize: '11px', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontWeight: 'bold'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-50">
            <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50/50">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Done</span>
              <p className="text-sm font-black text-emerald-700 mt-0.5">4.0</p>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-rose-50/50">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Pending</span>
              <p className="text-sm font-black text-rose-700 mt-0.5">5.0</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 bg-white rounded-xl border border-slate-100 p-6 shadow-sm h-full">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">9. Status Timeline</h3>
          <Timeline items={[
            { title: "Order Created", subtitle: "Sales order has been created successfully", time: order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "—", clock: order.created_at ? new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "", completed: true },
            { title: "Quotation Approved", subtitle: "Quotation has been approved", time: order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "—", clock: "10:15 AM", completed: true },
            { title: "PO Confirmed", subtitle: order.order_no ? `Purchase Order PO-${order.order_no.split('-').slice(1).join('-')} has been created` : "PO Created", time: order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "—", clock: "11:00 AM", completed: true },
            { title: "Production Started", subtitle: "Production has been started for FG items", time: ['IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED'].includes(order.status) ? "Done" : "—", clock: "", inProgress: order.status === 'IN_PRODUCTION', completed: ['PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED'].includes(order.status) },
            { title: "Ready for Dispatch", subtitle: "Items are ready for dispatch", time: ['READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED'].includes(order.status) ? "Done" : "—", clock: "", completed: ['READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED'].includes(order.status) },
            { title: "Delivered", subtitle: "Order delivered to customer", time: ['CLOSED'].includes(order.status) ? "Done" : "—", clock: "", completed: order.status === 'CLOSED' },
          ]} />
        </div>
      </div>
    </div>
  );
};

const formatSafeDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const normalized = typeof dateVal === 'string' ? dateVal.replace(' ', 'T') : dateVal;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return '';
  }
};

const formatSafeTime = (dateVal) => {
  if (!dateVal) return '';
  try {
    const normalized = typeof dateVal === 'string' ? dateVal.replace(' ', 'T') : dateVal;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  } catch (e) {
    return '';
  }
};

const QuotationTabContent = ({ order, quotation, expandedItems, toggleItemExpansion, handleDownloadQuotation }) => {
  const currentVer = quotation?.po_version || quotation?.version || '1.0';
  const hasPrevious = parseFloat(currentVer) > 1.0;
  const prevVer = hasPrevious ? (parseFloat(currentVer) - 1.0).toFixed(1) : null;
  const currentVal = Number(quotation?.net_total || quotation?.total_amount || order.grand_total || 0);
  const prevVal = hasPrevious ? currentVal * 0.95 : null;
  const diffVal = hasPrevious ? currentVal - prevVal : 0;
  const diffPct = hasPrevious ? (diffVal / prevVal) * 100 : 0;

  const qStatus = String(quotation?.status || 'CREATED').trim().toUpperCase();
  const isDirect = String(order?.source_type || '').trim().toUpperCase() === 'DIRECT';
  
  const isCreated = true;
  const isSent = isDirect || ['SENT', 'RECEIVED', 'REVIEWED', 'APPROVED', 'COMPLETED', 'CONFIRMED', 'ACTIVE'].includes(qStatus);
  const isReceived = isDirect || ['RECEIVED', 'REVIEWED', 'APPROVED', 'COMPLETED', 'CONFIRMED', 'ACTIVE'].includes(qStatus);
  const isApproved = isDirect || ['APPROVED', 'COMPLETED', 'CONFIRMED', 'ACTIVE'].includes(qStatus);

  const displayQuotationDate = formatSafeDate(quotation?.po_date) || 
                               formatSafeDate(quotation?.quotation_date) || 
                               formatSafeDate(quotation?.created_at) || 
                               formatSafeDate(order?.order_date) || 
                               formatSafeDate(order?.created_at) || 
                               '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Quotation Summary */}
        <div className="lg:w-[42%] bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">Quotation Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            <InfoRow label="Quotation No." value={quotation?.po_number || quotation?.quotation_no || order.quotation_no || '—'} className="text-indigo-600 font-bold" />
            <InfoRow label="Quotation Date" value={displayQuotationDate} />
            <InfoRow label="Quotation Version" value={quotation?.po_version || quotation?.version ? `Version ${quotation.po_version || quotation.version}` : 'Version 1.0'} />
            <InfoRow label="Quoted By" value={quotation?.created_by_name || "Sales Manager"} />
            <InfoRow label="Quoted Amount" value={`₹ ${Number(quotation?.net_total || quotation?.total_amount || order.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            <InfoRow label="Valid Till" value={formatSafeDate(quotation?.valid_till) || '—'} />
            <StatusRow label="Status" status={quotation?.status || 'Received'} />
            <InfoRow label="Remarks" value={quotation?.remarks || '—'} />
          </div>
        </div>

        {/* Quotation Comparison */}
        <div className="lg:w-[33%] bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">Quotation Comparison</h3>
          <div className="space-y-4 pt-1">
            <ComparisonRow 
              label={hasPrevious ? `Previous Version (V${prevVer})` : "Previous Version"} 
              value={hasPrevious ? `₹ ${Number(prevVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : "—"} 
            />
            <ComparisonRow 
              label={`Current Version (V${currentVer})`} 
              value={`₹ ${Number(currentVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} 
            />
            <div className="pt-2 border-t border-slate-50">
              {hasPrevious ? (
                <ComparisonRow 
                  label="Difference" 
                  value={`₹ ${Number(diffVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} 
                  subValue={`+${diffPct.toFixed(2)}%`} 
                  color="text-emerald-600" 
                />
              ) : (
                <ComparisonRow 
                  label="Difference" 
                  value="₹ 0.00" 
                  subValue="0.00%" 
                  color="text-slate-500" 
                />
              )}
            </div>
          </div>
        </div>

        {/* Quotation Action */}
        <div className="lg:w-[25%] bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm text-slate-900 font-semibold mb-6">Quotation Action</h3>
          <div className="space-y-4">
            <Button 
              variant="primary" 
              icon={Download} 
              className="w-full bg-rose-600 hover:bg-rose-700 text-[11px] font-bold h-11 justify-center px-6 transition-all"
              onClick={handleDownloadQuotation}
            >
              Download Quotation (PDF)
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Quoted Items <span className="text-indigo-500 ml-2 font-bold lowercase normal-case tracking-normal">(FG with Components)</span></h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <ItemsTable items={order.items} expandedItems={expandedItems} toggleItemExpansion={toggleItemExpansion} isQuotation />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <div className="w-full">
          <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm h-full">
            <h3 className="text-sm text-slate-900 font-semibold mb-6">Quotation Timeline</h3>
            <Timeline items={[
              { 
                title: "Quotation Created", 
                subtitle: "Quotation has been created", 
                time: formatSafeDate(quotation?.created_at) || formatSafeDate(quotation?.po_date) || formatSafeDate(order?.created_at) || "—", 
                clock: formatSafeTime(quotation?.created_at) || formatSafeTime(order?.created_at) || "—", 
                completed: isCreated 
              },
              { 
                title: "Quotation Sent", 
                subtitle: "Quotation sent to customer", 
                time: isSent ? (formatSafeDate(quotation?.po_date) || formatSafeDate(quotation?.quotation_date) || formatSafeDate(quotation?.created_at) || formatSafeDate(order?.order_date) || formatSafeDate(order?.created_at) || "—") : "—", 
                clock: isSent ? "11:00 am" : "—", 
                completed: isSent 
              },
              { 
                title: "Quotation Received", 
                subtitle: parseFloat(currentVer) > 1 ? `Version ${currentVer} Received` : "Quotation Received", 
                time: isReceived ? (formatSafeDate(quotation?.po_date) || formatSafeDate(quotation?.quotation_date) || formatSafeDate(quotation?.created_at) || formatSafeDate(order?.order_date) || formatSafeDate(order?.created_at) || "—") : "—", 
                clock: isReceived ? "03:15 pm" : "—", 
                completed: isReceived 
              },
              { 
                title: "Quotation Approved", 
                subtitle: "Approved by Sales Manager", 
                time: isApproved ? (formatSafeDate(quotation?.po_date) || formatSafeDate(quotation?.quotation_date) || formatSafeDate(quotation?.created_at) || formatSafeDate(order?.order_date) || formatSafeDate(order?.created_at) || "—") : "—", 
                clock: isApproved ? "09:30 am" : "—", 
                completed: isApproved 
              },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
};

const POTabContent = ({ order, customerPo, expandedItems, toggleItemExpansion, handleDownloadPO }) => {
  return (
    <div className="space-y-6">
      {/* Top Row: Summary and Actions Integrated */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 lg:border-r lg:border-slate-100 lg:pr-8">
            <h3 className="text-sm text-slate-900 font-semibold mb-6">PO Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4">
              <InfoRow label="PO Number" value={customerPo?.po_number || order.order_no} className="text-indigo-600 font-bold" />
              <InfoRow label="PO Date" value={customerPo?.po_date ? new Date(customerPo.po_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '05 May 2026'} />
              <InfoRow label="PO Amount" value={`₹ ${Number(customerPo?.net_total || order.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <StatusRow label="Status" status={customerPo?.status || 'Confirmed'} />
              <InfoRow label="Created By" value={customerPo?.created_by_name || "Sales Manager"} />
              <InfoRow label="Remarks" value={customerPo?.remarks || "—"} />
              <InfoRow label="Customer" value={customerPo?.company_name || order.client || '—'} />
              <InfoRow label="Expected Delivery" value="20 May 2026" />
            </div>
          </div>

          <div className="lg:w-[300px]">
            <h3 className="text-sm text-slate-900 font-semibold mb-6">PO Actions</h3>
            <div className="space-y-4">
              <Button 
                variant="primary" 
                icon={Download} 
                className="w-full bg-rose-600 hover:bg-rose-700 text-[11px] font-bold h-11 justify-center px-6 shadow-md shadow-rose-100 transition-all"
                onClick={handleDownloadPO}
              >
                Download PO (PDF)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PO Items: Full Width */}
      <Card className="overflow-hidden border-slate-100 shadow-sm">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">PO Items</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <POItemsTable items={order.items} expandedItems={expandedItems} toggleItemExpansion={toggleItemExpansion} />
        </div>
      </Card>
    </div>
  );
};

/* --- SHARED COMPONENTS --- */

const ItemsTable = ({ items, expandedItems, toggleItemExpansion, isQuotation = false }) => (
  <table className="w-full text-left border-collapse">
    <thead>
      <tr className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 font-black">
        <th className="px-5 py-3.5 w-12 text-center">#</th>
        <th className="px-5 py-3.5">FG Item Code / Name</th>
        <th className="px-5 py-3.5">Drawing No.</th>
        <th className="px-5 py-3.5 text-center">Qty</th>
        <th className="px-5 py-3.5 text-center">Unit</th>
        <th className="px-5 py-3.5 text-right">Rate (₹)</th>
        <th className="px-5 py-3.5 text-right">Amount (₹)</th>
        <th className="px-5 py-3.5 text-center">BOM Ver.</th>
        <th className="px-5 py-3.5 text-center">Prod. Type</th>
        <th className="px-5 py-3.5 text-center">Status</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {(items || []).map((item, idx) => (
        <React.Fragment key={item.id}>
          <tr className={`group hover:bg-slate-50/50 transition-colors ${expandedItems[item.id] ? 'bg-indigo-50/20' : ''}`}>
            <td className="px-5 py-5 text-[11px] font-black text-slate-300 text-center">{idx + 1}</td>
            <td className="px-5 py-5">
              <div className="flex items-center gap-3">
                {item.sub_assemblies && item.sub_assemblies.length > 0 ? (
                  <button 
                    onClick={() => toggleItemExpansion(item.id)}
                    className={`p-1.5 rounded-md border transition-all ${expandedItems[item.id] ? 'rotate-180 bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                ) : (
                  <div className="w-[26px]" />
                )}
                <div>
                  <p className="text-[12px] font-black text-slate-900 tracking-tight">{item.item_code}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 truncate max-w-[180px]">{item.description}</span>
                    {(item.type === 'Assembly' || item.type === 'Assembly Good' || (item.sub_assemblies && item.sub_assemblies.length > 0)) ? (
                      <span className="px-1.5 py-px bg-purple-50 text-purple-600 text-[8px] font-black rounded-[4px] border border-purple-100 uppercase tracking-widest">Assembly</span>
                    ) : (
                      <span className="px-1.5 py-px bg-blue-50 text-blue-600 text-[8px] font-black rounded-[4px] border border-blue-100 uppercase tracking-widest">Part</span>
                    )}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-5 py-5 text-[11px] font-bold text-slate-500 tracking-tight">{String(item.drawing_no || '—').toUpperCase()}</td>
            <td className="px-5 py-5 text-[11px] font-black text-slate-900 text-center">{Number(item.quantity).toFixed(3)}</td>
            <td className="px-5 py-5 text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">{item.unit || 'Nos'}</td>
            <td className="px-5 py-5 text-[11px] font-black text-slate-900 text-right">{Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td className="px-5 py-5 text-[11px] font-black text-indigo-600 text-right">{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td className="px-5 py-5 text-center">
              <span className="text-[10px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">V1.0</span>
            </td>
            <td className="px-5 py-5 text-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] px-2 py-0.5 bg-slate-100 rounded-[4px]">Make</span>
            </td>
            <td className="px-5 py-5 text-center">
              <StatusBadge status="In Production" className="text-[9px] font-black h-5 uppercase tracking-widest" />
            </td>
          </tr>
          {expandedItems[item.id] && item.sub_assemblies && item.sub_assemblies.length > 0 && (
            <tr>
              <td colSpan="10" className="px-5 py-2">
                <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 my-2 shadow-inner">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        BOM Production Hierarchy & Material Flow
                      </p>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">
                      {item.sub_assemblies?.length || 0} Child Components
                    </span>
                  </div>

                  <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-indigo-300 before:to-indigo-100 before:border-dashed">
                    {/* Parent Item Summary Node */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative before:absolute before:left-[-22px] before:top-1/2 before:w-4 before:h-[2px] before:bg-indigo-300">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                        <Factory size={13} className="animate-spin-slow" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900">{item.item_code}</p>
                          <span className="px-1.5 py-px bg-purple-50 text-purple-600 text-[8px] font-black rounded border border-purple-100 uppercase tracking-wider">Parent Assembly</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{item.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Output Quantity</p>
                        <p className="text-xs font-black text-slate-900">{Number(item.quantity).toFixed(0)} NOS</p>
                      </div>
                    </div>

                    {/* Child Node Tree Flow */}
                    {(item.sub_assemblies || []).map((sa, sidx) => {
                      const isSA = (sa.drawingNo || sa.component_code || "").startsWith('SA-') || sa.item_group === 'SA';
                      return (
                        <div key={sidx} className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all shadow-sm relative before:absolute before:left-[-22px] before:top-1/2 before:w-4 before:h-[2px] before:bg-indigo-300 hover:shadow-indigo-50/50 hover:shadow-md">
                          {/* Left Side Info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm ${isSA ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              <Package size={13} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[11px] font-black text-slate-900">{String(sa.drawingNo || sa.component_code || '').toUpperCase()}</p>
                                <span className={`px-1.5 py-px text-[7px] font-black rounded uppercase tracking-wider ${isSA ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                  {isSA ? 'Sub-Assembly' : 'Child Part'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium truncate">{sa.description}</p>
                            </div>
                          </div>

                          {/* Quantity Breakdown Flow */}
                          <div className="flex items-center gap-6 text-slate-600 text-xs px-2 border-l border-slate-100 md:border-l md:border-r md:px-6">
                            <div className="text-center min-w-[70px]">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Required Qty</p>
                              <span className="text-[11px] font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{Number(sa.quantity).toFixed(0)} <span className="text-[9px] font-medium text-slate-400">{sa.unit || 'NOS'}</span></span>
                            </div>
                            <div className="text-center min-w-[70px]">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Available Stock</p>
                              <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{Number(sa.available_stock || sa.availableStock || 0).toFixed(3)}</span>
                            </div>
                          </div>

                          {/* Pricing and Flow Status */}
                          <div className="flex items-center justify-between md:justify-end gap-6 min-w-[200px]">
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Rate / Amount</p>
                              <p className="text-[11px] font-black text-slate-900">₹{Number(sa.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                              <p className="text-[9px] font-bold text-slate-400">Total: ₹{(Number(sa.quantity) * Number(sa.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full border border-emerald-200 uppercase tracking-widest flex items-center gap-1 shadow-sm shadow-emerald-50">
                                <CheckCircle2 size={10} className="text-emerald-600" />
                                Ready
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      ))}
    </tbody>
    <tfoot className="bg-slate-50/50">
      <tr className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
        <td colSpan="4" className="px-5 py-4">Total Quantity: {Number((items || []).reduce((sum, i) => sum + Number(i.quantity), 0)).toFixed(3)}</td>
        <td colSpan="6" className="px-5 py-4 text-right">Total {isQuotation ? 'Quoted' : ''} Amount: <span className="text-indigo-600 ml-2 font-black text-[13px]">₹ {Number((items || []).reduce((sum, i) => sum + Number(i.amount), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
      </tr>
    </tfoot>
  </table>
);

const POItemsTable = ({ items, expandedItems, toggleItemExpansion }) => (
  <table className="w-full text-left border-collapse">
    <thead>
      <tr className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100 font-black">
        <th className="px-5 py-3.5 w-12 text-center">#</th>
        <th className="px-5 py-3.5">Item Code / Name</th>
        <th className="px-5 py-3.5 text-center">Type</th>
        <th className="px-5 py-3.5 text-center">Qty</th>
        <th className="px-5 py-3.5 text-center">Unit</th>
        <th className="px-5 py-3.5 text-right">Rate (₹)</th>
        <th className="px-5 py-3.5 text-right">Amount (₹)</th>
        <th className="px-5 py-3.5 text-center">Delivery Date</th>
        <th className="px-5 py-3.5 text-center">Status</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {(items || []).map((item, idx) => (
        <React.Fragment key={item.id}>
          <tr className={`group hover:bg-slate-50/50 transition-colors ${expandedItems[item.id] ? 'bg-indigo-50/20' : ''}`}>
            <td className="px-5 py-5 text-[11px] font-black text-slate-300 text-center">{idx + 1}</td>
            <td className="px-5 py-5">
              <div className="flex items-center gap-3">
                {item.sub_assemblies && item.sub_assemblies.length > 0 ? (
                  <button 
                    onClick={() => toggleItemExpansion(item.id)}
                    className={`p-1.5 rounded-md border transition-all ${expandedItems[item.id] ? 'rotate-180 bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                ) : (
                  <div className="w-[26px]" />
                )}
                <div>
                  <p className="text-[12px] font-black text-slate-900 tracking-tight">{item.item_code}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate max-w-[180px] mt-0.5">{item.description}</p>
                </div>
              </div>
            </td>
            <td className="px-5 py-5 text-center">
              {(item.type === 'Assembly' || item.type === 'Assembly Good' || (item.sub_assemblies && item.sub_assemblies.length > 0)) ? (
                <span className="px-1.5 py-px bg-purple-50 text-purple-600 text-[8px] font-black rounded-[4px] border border-purple-100 uppercase tracking-widest">Assembly</span>
              ) : (
                <span className="px-1.5 py-px bg-blue-50 text-blue-600 text-[8px] font-black rounded-[4px] border border-blue-100 uppercase tracking-widest">Part</span>
              )}
            </td>
            <td className="px-5 py-5 text-[11px] font-black text-slate-900 text-center">{Number(item.quantity).toFixed(3)}</td>
            <td className="px-5 py-5 text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">{item.unit || 'Nos'}</td>
            <td className="px-5 py-5 text-[11px] font-black text-slate-900 text-right">{Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td className="px-5 py-5 text-[11px] font-black text-indigo-600 text-right">{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td className="px-5 py-5 text-[11px] font-bold text-slate-500 text-center">15 May 2026</td>
            <td className="px-5 py-5 text-center">
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-[4px] border border-emerald-100 uppercase tracking-widest">Confirmed</span>
            </td>
          </tr>
          {expandedItems[item.id] && item.sub_assemblies && item.sub_assemblies.length > 0 && (
            <tr>
              <td colSpan="9" className="px-5 py-0">
                <div className="p-5 bg-white rounded-xl border-2 border-indigo-50 my-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Materials / Components</p>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[9px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-2.5">Item Code / Name</th>
                        <th className="px-4 py-2.5 text-center">Required Qty</th>
                        <th className="px-4 py-2.5 text-center">Unit</th>
                        <th className="px-4 py-2.5 text-right">Rate (₹)</th>
                        <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(item.sub_assemblies || []).map((sa, sidx) => (
                        <MaterialRow 
                          key={sidx}
                          code={String(sa.drawingNo || sa.component_code || '').toUpperCase()} 
                          description={sa.description}
                          qty={Number(sa.quantity).toFixed(3)} 
                          unit={sa.unit || 'Nos'} 
                          rate={Number(sa.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                          amount={(Number(sa.quantity) * Number(sa.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                          status="Confirmed" 
                        />
                      ))}
                      {(!item.sub_assemblies || item.sub_assemblies.length === 0) && (
                        <tr>
                          <td colSpan="6" className="px-4 py-8 text-center text-[11px] text-slate-400 italic font-bold">No materials or components found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      ))}
    </tbody>
    <tfoot className="bg-slate-50/50">
      <tr className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
        <td colSpan="4" className="px-5 py-4">Total Quantity: {Number((items || []).reduce((sum, i) => sum + Number(i.quantity), 0)).toFixed(3)}</td>
        <td colSpan="5" className="px-5 py-4 text-right">Total Amount: <span className="text-indigo-600 ml-2 font-black text-[13px]">₹ {Number((items || []).reduce((sum, i) => sum + Number(i.amount), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
      </tr>
    </tfoot>
  </table>
);

const MaterialRow = ({ code, description, qty, unit, rate, amount, status }) => (
  <tr className="hover:bg-slate-50 transition-colors">
    <td className="px-4 py-3">
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-900 tracking-tight">{code}</span>
        {description && <span className="text-[9px] font-bold text-slate-400 mt-0.5">{description}</span>}
      </div>
    </td>
    <td className="px-4 py-3 text-[10px] font-black text-slate-900 text-center">{qty}</td>
    <td className="px-4 py-3 text-[9px] font-black text-slate-400 text-center uppercase tracking-widest">{unit}</td>
    <td className="px-4 py-3 text-[10px] font-black text-slate-900 text-right">{rate}</td>
    <td className="px-4 py-3 text-[10px] font-black text-indigo-600 text-right">{amount}</td>
    <td className="px-4 py-3 text-center">
      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-[4px] border border-emerald-100 uppercase tracking-widest">{status}</span>
    </td>
  </tr>
);

const Timeline = ({ items }) => (
  <div className="flex items-start justify-between relative px-4 py-8 overflow-x-auto">
    {/* Background horizontal line */}
    <div className="absolute top-[42px] left-10 right-10 h-0.5 border-t-2 border-dashed border-slate-100 -z-0"></div>
    
    {items.map((item, idx) => (
      <TimelineItem key={idx} {...item} />
    ))}
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, color, showPulse = false }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <Card className="p-4 flex items-center gap-4 border-slate-100 hover:shadow-lg transition-all duration-300 group cursor-default">
      <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          {showPulse && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></div>}
          <p className="text-[13px] font-black text-slate-900 tracking-tight truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
};

const InfoSection = ({ icon: Icon, title, children }) => (
  <Card className="overflow-hidden border-slate-100 shadow-sm h-full">
    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </Card>
);

const InfoRow = ({ label, value, className = "", isLink = false }) => (
  <div className="flex justify-between items-start gap-4">
    <p className="text-xs font-medium text-slate-400 min-w-[130px]">{label}</p>
    <p className={`text-xs font-bold text-slate-900 text-right leading-tight ${isLink ? 'text-indigo-600 underline cursor-pointer' : ''} ${className}`}>
      {value || '—'}
    </p>
  </div>
);

const ComparisonRow = ({ label, value, subValue, color = "text-slate-900" }) => (
  <div className="flex justify-between items-center py-1">
    <p className="text-xs font-medium text-slate-400">{label}</p>
    <div className="text-right">
      <p className={`text-xs font-bold ${color}`}>{value}</p>
      {subValue && <p className={`text-[10px] font-bold ${color}`}>{subValue}</p>}
    </div>
  </div>
);

const StatusRow = ({ label, status }) => {
  const getStatusColor = (s) => {
    const sLower = (s || '').toLowerCase();
    if (sLower.includes('paid') || sLower.includes('ready') || sLower.includes('completed') || sLower.includes('approved')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (sLower.includes('production') || sLower.includes('process') || sLower.includes('confirmed')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (sLower.includes('pending') || sLower.includes('unpaid') || sLower.includes('received')) return 'bg-rose-50 text-rose-600 border-rose-100';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  return (
    <div className="flex justify-between items-center gap-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border uppercase tracking-widest ${getStatusColor(status)}`}>
        {status}
      </span>
    </div>
  );
};

const SummaryRow = ({ label, value, color = "text-slate-900" }) => (
  <div>
    <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
    <p className={`text-sm font-bold tracking-tight ${color}`}>{value}</p>
  </div>
);

const TimelineItem = ({ title, subtitle, time, clock, completed = false, inProgress = false }) => (
  <div className="flex flex-col items-center flex-1 relative z-10 text-center px-2 min-w-[150px]">
    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all mb-4 ${
      completed ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 
      inProgress ? 'bg-white border-amber-500 text-amber-500 shadow-lg shadow-amber-50' : 'bg-white border-slate-200 text-slate-300'
    }`}>
      {completed ? <Check className="w-4 h-4 stroke-[3px]" /> : 
       inProgress ? <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> : 
       <div className="w-2 h-2 rounded-full bg-slate-200"></div>}
    </div>
    
    <div className="space-y-1">
      <h4 className={`text-[11px] font-black uppercase tracking-wider ${completed ? 'text-slate-900' : 'text-slate-400'}`}>{title}</h4>
      <p className="text-[10px] text-slate-500 font-bold leading-tight min-h-[20px]">{subtitle}</p>
      
      <div className="pt-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{time}</p>
        <p className="text-[10px] text-indigo-600 font-black mt-0.5">{clock}</p>
      </div>
    </div>
  </div>
);

const ActionButton = ({ icon: Icon, label, sub, onClick, color = "text-slate-600", bg = "bg-white" }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 w-full p-4 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group active:scale-[0.98] ${bg}`}
  >
    <div className={`p-2.5 rounded-lg transition-colors ${color.replace('text', 'bg').replace('600', '100')} ${color} group-hover:bg-indigo-600 group-hover:text-white`}>
      <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
    </div>
    <div className="text-left min-w-0">
      <p className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</p>
      <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5">{sub}</p>
    </div>
  </button>
);

export default SalesReportDetails;
