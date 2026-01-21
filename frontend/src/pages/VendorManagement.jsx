import { useState } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const vendorStatusColors = {
  ACTIVE: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Active' },
  INACTIVE: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Inactive' },
  BLOCKED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', label: 'Blocked' },
};

const rfqStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Draft' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Sent' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Received' },
  REVIEWED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', label: 'Reviewed' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Closed' },
};

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Draft' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Sent' },
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
          <p className="text-slate-500 mb-3">No vendors added yet</p>
          <button
            type="button"
            onClick={onAddVendor}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm  hover:bg-slate-800"
          >
            + Add Vendor
          </button>
        </div>
      )}
      {vendors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
              <tr>
                <th className="px-4 py-3 text-left ">Vendor Name</th>
                <th className="px-4 py-3 text-left ">Contact</th>
                <th className="px-4 py-3 text-left ">Email</th>
                <th className="px-4 py-3 text-left ">Status</th>
                <th className="px-4 py-3 text-right ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={`vendor-${vendor.id}`} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-4 py-4 text-slate-600">{vendor.contact}</td>
                  <td className="px-4 py-4 text-slate-600">{vendor.email}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs  border ${vendorStatusColors[vendor.status]?.bg} ${vendorStatusColors[vendor.status]?.text} ${vendorStatusColors[vendor.status]?.border}`}>
                      {vendorStatusColors[vendor.status]?.label || vendor.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                      title="View Details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
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
          <p className="text-slate-500 mb-3">No quotations yet</p>
          <button
            type="button"
            onClick={onCreateRFQ}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm  hover:bg-slate-800"
          >
            + Create RFQ
          </button>
        </div>
      )}
      {rfqs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
              <tr>
                <th className="px-4 py-3 text-left ">RFQ #</th>
                <th className="px-4 py-3 text-left ">Vendor</th>
                <th className="px-4 py-3 text-left ">Items</th>
                <th className="px-4 py-3 text-left ">Status</th>
                <th className="px-4 py-3 text-left ">Sent Date</th>
                <th className="px-4 py-3 text-right ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((rfq) => (
                <tr key={`rfq-${rfq.id}`} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-medium text-slate-900">RFQ-{String(rfq.id).padStart(4, '0')}</td>
                  <td className="px-4 py-4 text-slate-600">{rfq.vendor_name}</td>
                  <td className="px-4 py-4 text-slate-600">{rfq.items_count} items</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs  border ${rfqStatusColors[rfq.status]?.bg} ${rfqStatusColors[rfq.status]?.text} ${rfqStatusColors[rfq.status]?.border}`}>
                      {rfqStatusColors[rfq.status]?.label || rfq.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(rfq.sent_date)}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                      title="View Details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
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
          <p className="text-slate-500 mb-3">No purchase orders yet</p>
          <button
            type="button"
            onClick={onCreatePO}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm  hover:bg-slate-800"
          >
            + Create PO
          </button>
        </div>
      )}
      {pos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
              <tr>
                <th className="px-4 py-3 text-left ">PO #</th>
                <th className="px-4 py-3 text-left ">Vendor</th>
                <th className="px-4 py-3 text-left ">Amount</th>
                <th className="px-4 py-3 text-left ">Status</th>
                <th className="px-4 py-3 text-left ">Created</th>
                <th className="px-4 py-3 text-right ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr key={`po-${po.id}`} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-medium text-slate-900">PO-{String(po.id).padStart(4, '0')}</td>
                  <td className="px-4 py-4 text-slate-600">{po.vendor_name}</td>
                  <td className="px-4 py-4 text-slate-900 text-xs">{formatCurrency(po.total_amount)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs  border ${poStatusColors[po.status]?.bg} ${poStatusColors[po.status]?.text} ${poStatusColors[po.status]?.border}`}>
                      {poStatusColors[po.status]?.label || po.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(po.created_at)}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                      title="View Details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
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
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-4 py-3 text-sm  transition ${activeTab === 'vendors' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Vendors
        </button>
        <button
          onClick={() => setActiveTab('quotations')}
          className={`px-4 py-3 text-sm  transition ${activeTab === 'quotations' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Quotations (RFQ)
        </button>
        <button
          onClick={() => setActiveTab('purchase-orders')}
          className={`px-4 py-3 text-sm  transition ${activeTab === 'purchase-orders' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Purchase Orders
        </button>
      </div>

      {activeTab === 'vendors' && <Vendors onAddVendor={handleAddVendor} />}
      {activeTab === 'quotations' && <Quotations onCreateRFQ={handleCreateRFQ} />}
      {activeTab === 'purchase-orders' && <PurchaseOrders onCreatePO={handleCreatePO} />}
    </div>
  );
};

export default VendorManagement;
