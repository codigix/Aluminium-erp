import { useState } from 'react';
import { Card } from '../components/ui.jsx';
import { 
  Plus, 
  Eye, 
  Users, 
  FileText, 
  ShoppingCart
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const vendorStatusColors = {
  ACTIVE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Inactive' },
  BLOCKED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', label: 'Blocked' },
};

const rfqStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Draft' },
  Sent : { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Sent' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Received' },
  REVIEWED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', label: 'Reviewed' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Closed' },
};

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Draft' },
  Sent : { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Sent' },
  ACKNOWLEDGED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Acknowledged' },
  RECEIVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Received' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Closed' },
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const Vendors = ({ onAddVendor }) => {
  const [vendors] = useState([]);
  const [loading] = useState(false);

  return (
    <Card title="Vendors" subtitle="Manage supplier and vendor information">
      {loading && <p className="text-xs text-slate-400">Loading vendors...</p>}
      {!loading && vendors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-3 font-medium">No vendors added yet</p>
          <button
            type="button"
            onClick={onAddVendor}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Plus size={16} />
            Add Vendor
          </button>
        </div>
      )}
      {vendors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
              <tr>
                <th className="p-2 text-left ">Vendor Name</th>
                <th className="p-2 text-left ">Contact</th>
                <th className="p-2 text-left ">Email</th>
                <th className="p-2 text-left ">Status</th>
                <th className="p-2  text-right ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={`vendor-${vendor.id}`} className="border-t border-slate-100 group hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4  text-slate-900 ">{vendor.name}</td>
                  <td className="px-4 py-4 text-slate-600">{vendor.contact}</td>
                  <td className="px-4 py-4 text-slate-600">{vendor.email}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block px-2 py-1  rounded text-[10px]  uppercase tracking-wider border ${vendorStatusColors[vendor.status]?.bg} ${vendorStatusColors[vendor.status]?.text} ${vendorStatusColors[vendor.status]?.border}`}>
                      {vendorStatusColors[vendor.status]?.label || vendor.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const Quotations = ({ onCreateRFQ }) => {
  const [rfqs] = useState([]);
  const [loading] = useState(false);

  return (
    <Card title="Quotations / RFQs" subtitle="Request for Quotation from vendors">
      {loading && <p className="text-xs text-slate-400">Loading quotations...</p>}
      {!loading && rfqs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-3 font-medium">No quotations yet</p>
          <button
            type="button"
            onClick={onCreateRFQ}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Plus size={16} />
            Create RFQ
          </button>
        </div>
      )}
      {rfqs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
              <tr>
                <th className="p-2 text-left ">RFQ #</th>
                <th className="p-2 text-left ">Vendor</th>
                <th className="p-2 text-left ">Items</th>
                <th className="p-2 text-left ">Status</th>
                <th className="p-2 text-left ">Sent Date</th>
                <th className="p-2  text-right ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((rfq) => (
                <tr key={`rfq-${rfq.id}`} className="border-t border-slate-100 group hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4  text-slate-900 ">RFQ-{String(rfq.id).padStart(4, '0')}</td>
                  <td className="px-4 py-4 text-slate-600">{rfq.vendor_name}</td>
                  <td className="px-4 py-4 text-slate-600">{rfq.items_count} items</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block px-2 py-1  rounded text-[10px]  uppercase tracking-wider border ${rfqStatusColors[rfq.status]?.bg} ${rfqStatusColors[rfq.status]?.text} ${rfqStatusColors[rfq.status]?.border}`}>
                      {rfqStatusColors[rfq.status]?.label || rfq.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(rfq.sent_date)}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const PurchaseOrders = ({ onCreatePO }) => {
  const [pos] = useState([]);
  const [loading] = useState(false);

  return (
    <Card title="Purchase Orders" subtitle="Vendor purchase orders from quotations">
      {loading && <p className="text-xs text-slate-400">Loading purchase orders...</p>}
      {!loading && pos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-3 font-medium">No purchase orders yet</p>
          <button
            type="button"
            onClick={onCreatePO}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Plus size={16} />
            Create PO
          </button>
        </div>
      )}
      {pos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
              <tr>
                <th className="p-2 text-left ">PO #</th>
                <th className="p-2 text-left ">Vendor</th>
                <th className="p-2 text-left ">Amount</th>
                <th className="p-2 text-left ">Status</th>
                <th className="p-2 text-left ">Created</th>
                <th className="p-2  text-right ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr key={`po-${po.id}`} className="border-t border-slate-100 group hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4  text-slate-900 ">PO-{String(po.id).padStart(4, '0')}</td>
                  <td className="px-4 py-4 text-slate-600">{po.vendor_name}</td>
                  <td className="px-4 py-4 text-slate-900 text-xs ">{formatCurrency(po.total_amount)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block px-2 py-1  rounded text-[10px]  uppercase tracking-wider border ${poStatusColors[po.status]?.bg} ${poStatusColors[po.status]?.text} ${poStatusColors[po.status]?.border}`}>
                      {poStatusColors[po.status]?.label || po.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(po.created_at)}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const VendorManagement = () => {
  const [activeTab, setActiveTab] = useState('vendors');

  const handleAddVendor = () => {
    console.log('Add vendor clicked');
  };

  const handleCreateRFQ = () => {
    console.log('Create RFQ clicked');
  };

  const handleCreatePO = () => {
    console.log('Create PO clicked');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${activeTab === 'vendors' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={16} />
          Vendors
          {activeTab === 'vendors' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('quotations')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${activeTab === 'quotations' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText size={16} />
          Quotations (RFQ)
          {activeTab === 'quotations' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('purchase-orders')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${activeTab === 'purchase-orders' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShoppingCart size={16} />
          Purchase Orders
          {activeTab === 'purchase-orders' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
      </div>

      <div className="animate-in fade-in duration-300">
        {activeTab === 'vendors' && <Vendors onAddVendor={handleAddVendor} />}
        {activeTab === 'quotations' && <Quotations onCreateRFQ={handleCreateRFQ} />}
        {activeTab === 'purchase-orders' && <PurchaseOrders onCreatePO={handleCreatePO} />}
      </div>
    </div>
  );
};

export default VendorManagement;

