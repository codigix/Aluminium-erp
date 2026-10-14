import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DataTable, Modal } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import { Eye, FileText, CheckCircle, Send, RefreshCw, Wallet, Clock, Banknote } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const VendorInwardChallans = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/vendor-receipts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      errorToast('Failed to fetch vendor receipts');
    } finally {
      setLoading(false);
    }
  };

  const sendToPayment = async (receipt) => {
    try {
      setProcessingId(receipt.id);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/vendor-receipts/${receipt.id}/send-to-payment`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to send to payment');

      successToast('Receipt sent to payment processing');

      // Navigate to payment processing with state
      navigate('/accounts/payment-processing', {
        state: {
          selectedInvoice: {
            id: receipt.id,
            isSubcontracting: true,
            po_number: receipt.job_card_number,
            vendor_name: receipt.vendor_name,
            vendor_id: receipt.vendor_id,
            total_amount: receipt.amount,
            outstanding: receipt.amount,
            already_paid: 0,
            created_at: receipt.date
          }
        }
      });
    } catch (error) {
      console.error('Error sending to payment:', error);
      errorToast('Failed to send to payment');
    } finally {
      setProcessingId(null);
    }
  };

  const fetchReceiptItems = async (receipt) => {
    try {
      setSelectedReceipt(receipt);
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/vendor-receipts/${receipt.id}/items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch items');
      const data = await response.json();
      setReceiptItems(data);
    } catch (error) {
      console.error('Error fetching receipt items:', error);
      errorToast('Failed to fetch items');
    } finally {
      setItemsLoading(false);
    }
  };

  const columns = [
    {
      label: 'Job Card',
      key: 'job_card_number',
      sortable: true,
      className: 'text-blue-600 '
    },
    {
      label: 'Vendor',
      key: 'vendor_name',
      sortable: true
    },
    {
      label: 'Date',
      key: 'date',
      sortable: true,
      render: (val) => formatDate(val)
    },
    {
      label: 'Amount',
      key: 'amount',
      sortable: true,
      className: ' text-emerald-600',
      render: (val) => formatCurrency(val)
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <span className={`px-2 py-1 rounded text-xs  border   ${
          val === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
          val === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
          val === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
          'bg-amber-50 text-amber-700 border-amber-100'
        }`}>
          {val}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => fetchReceiptItems(row)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.invoice_url && (
            <button
              onClick={() => window.open(`${API_BASE}/${row.invoice_url}`, '_blank')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
              title="View Invoice"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          {row.status === 'APPROVED' && (
            <button
              onClick={() => sendToPayment(row)}
              disabled={processingId === row.id}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
              title="Process Payment"
            >
              {processingId === row.id ? (
                <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )
    }
  ];

  const [statusFilter, setStatusFilter] = useState('APPROVED');
  const isWaitingForQc = (r) => !['APPROVED', 'PROCESSING', 'PAID'].includes(r.status);
  const searched = receipts.filter(r =>
    (r.job_card_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const total = (rows) => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const money = (rows) => (total(rows) > 0 ? formatCurrency(total(rows)) : formatCurrency(0.001));
  const byStatus = (st) => receipts.filter(r => (st === 'PENDING' ? isWaitingForQc(r) : r.status === st));
  const FILTERS = [
    { id: 'APPROVED', label: 'Ready to pay', hint: 'QC-approved receipts waiting for you to send them to payment' },
    { id: 'PENDING', label: 'Awaiting QC approval', hint: 'The Quality department has not approved these yet' },
    { id: 'PROCESSING', label: 'With accounts', hint: 'Sent to payment; accounts is processing them' },
    { id: 'PAID', label: 'Paid', hint: 'The vendor has been paid' },
    { id: 'ALL', label: 'All', hint: '' }
  ];
  const activeFilter = FILTERS.find(f => f.id === statusFilter);
  const filteredData = searched.filter(r => statusFilter === 'ALL' || (statusFilter === 'PENDING' ? isWaitingForQc(r) : r.status === statusFilter));
  const STATUS_LABEL = { APPROVED: 'Ready to pay', PROCESSING: 'With accounts', PAID: 'Paid' };
  const STATUS_CLS = { APPROVED: 'bg-indigo-50 text-indigo-700', PROCESSING: 'bg-blue-50 text-blue-700', PAID: 'bg-emerald-50 text-emerald-700' };

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl  text-slate-900 ">Vendor Receipts &amp; Payment</h1>
          <p className="text-xs text-slate-500 mt-1">Work that came back from vendors, what it cost, and whether the vendor has been paid. A receipt becomes ready to pay once Quality approves it.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search challans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all w-64"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button onClick={fetchReceipts} title="Refresh" className="p-2 bg-white border border-slate-200 rounded text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-indigo-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><Wallet className="w-3 h-3" />Ready to pay</div><div className="text-xl text-indigo-700">{money(byStatus('APPROVED'))}</div><div className="text-xs text-slate-500">{byStatus('APPROVED').length} receipt(s)</div></div>
        <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />Awaiting QC approval</div><div className="text-xl text-amber-700">{byStatus('PENDING').length}</div><div className="text-xs text-slate-500">receipt(s)</div></div>
        <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><Banknote className="w-3 h-3" />With accounts</div><div className="text-xl text-blue-700">{money(byStatus('PROCESSING'))}</div><div className="text-xs text-slate-500">{byStatus('PROCESSING').length} receipt(s)</div></div>
        <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Paid</div><div className="text-xl text-emerald-700">{money(byStatus('PAID'))}</div><div className="text-xs text-slate-500">{byStatus('PAID').length} receipt(s)</div></div>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)} title={f.hint}
            className={`px-3 py-1.5 text-xs rounded-full border ${statusFilter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {f.label} <span className={statusFilter === f.id ? 'opacity-80' : 'text-slate-400'}>{f.id === 'ALL' ? receipts.length : byStatus(f.id).length}</span>
          </button>
        ))}
      </div>
      {activeFilter && activeFilter.hint && <div className="text-xs text-slate-500">{activeFilter.hint}.</div>}

      <div className="bg-white rounded border border-slate-200 divide-y divide-slate-100">
        {loading && receipts.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading receipts...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{receipts.length === 0 ? 'No vendor receipts yet. They appear when you record a receipt against a subcontract challan.' : 'No receipts in this view.'}</div>
        ) : filteredData.map(row => {
          const st = ['APPROVED', 'PROCESSING', 'PAID'].includes(row.status) ? row.status : 'PENDING';
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-[10rem]"><div className="text-sm text-blue-700">{row.job_card_number}</div><div className="text-[11px] text-slate-500">{formatDate(row.date)}</div></div>
              <div className="min-w-[10rem] flex-1 text-sm text-slate-900">{row.vendor_name}</div>
              <div className="w-32 text-right text-sm text-emerald-700">{formatCurrency(row.amount)}</div>
              <span className={`text-[11px] px-2 py-0.5 rounded w-36 text-center ${STATUS_CLS[st] || 'bg-amber-50 text-amber-700'}`}>{STATUS_LABEL[st] || 'Awaiting QC approval'}</span>
              <div className="flex items-center gap-1 ml-auto">
                {row.status === 'APPROVED' && (
                  <button onClick={() => sendToPayment(row)} disabled={processingId === row.id} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
                    {processingId === row.id ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}Send to payment
                  </button>
                )}
                <button onClick={() => fetchReceiptItems(row)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50"><Eye className="w-3.5 h-3.5" />Details</button>
                {row.invoice_url && <button onClick={() => window.open(`${API_BASE}/${row.invoice_url}`, '_blank')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50"><FileText className="w-3.5 h-3.5" />Invoice</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Vendor Inward Details"
        maxWidth="max-w-2xl"
      >
        {selectedReceipt && (
          <div className="space-y-2">
             <div className="bg-slate-50 border border-slate-200 rounded  p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <p className="text-xs   text-slate-400 ">Job Card</p>
                  <p className="text-xs  text-slate-900 mt-1">{selectedReceipt.job_card_number}</p>
                </div>
                <div>
                  <p className="text-xs   text-slate-400 ">Vendor</p>
                  <p className="text-xs  text-slate-900 mt-1">{selectedReceipt.vendor_name}</p>
                </div>
                <div>
                  <p className="text-xs   text-slate-400 ">Inward Date</p>
                  <p className="text-xs  text-slate-900 mt-1">{formatDate(selectedReceipt.date)}</p>
                </div>
                <div>
                  <p className="text-xs   text-slate-400 ">Status</p>
                  <div className="mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs  border   ${
                      selectedReceipt.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      selectedReceipt.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      selectedReceipt.status === 'APPROVED' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {selectedReceipt.status}
                    </span>
                  </div>
                </div>
             </div>

             <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 bg-blue-500 rounded"></div>
                  <h4 className="text-xs  text-slate-900  ">Inward Items & Costing</h4>
                </div>

                <div className="border border-slate-100 rounded  overflow-hidden">
                  <table className="w-full text-left text-xs ">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-2 font-semibold text-slate-500  ">Item Code</th>
                        <th className="p-2 font-semibold text-slate-500   text-center">Qty</th>
                        <th className="p-2 font-semibold text-slate-500   text-right">Rate</th>
                        <th className="p-2 font-semibold text-slate-500   text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsLoading ? (
                        <tr><td colSpan="4" className="px-3 py-4 text-center text-slate-400">Loading items...</td></tr>
                      ) : receiptItems.map((item, idx) => (
                        <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                          <td className="p-2 text-slate-700">{item.item_code}</td>
                          <td className="p-2 text-center text-slate-600 ">{item.release_qty}</td>
                          <td className="p-2 text-right text-slate-900 ">{formatCurrency(item.rate)}</td>
                          <td className="p-2 text-right text-slate-900 ">{formatCurrency(Number(item.release_qty) * Number(item.rate))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 border-t border-slate-100 ">
                      <tr>
                        <td colSpan="3" className="p-2 text-right text-slate-500   text-xs">Sub Total</td>
                        <td className="p-2 text-right text-slate-700">{formatCurrency(selectedReceipt.sub_total)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="p-2 text-right text-slate-500   text-xs">GST (18%)</td>
                        <td className="p-2 text-right text-indigo-600">{formatCurrency(selectedReceipt.gst_amount)}</td>
                      </tr>
                      <tr className="bg-slate-100/50">
                        <td colSpan="3" className="p-2 text-right text-slate-900   text-xs">Grand Total</td>
                        <td className="p-2 text-right text-emerald-600 text-sm">{formatCurrency(selectedReceipt.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
             </div>

             {selectedReceipt.invoice_url && (
               <div className="flex justify-center pt-4">
                 <button
                  onClick={() => window.open(`${API_BASE}/${selectedReceipt.invoice_url}`, '_blank')}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all text-xs    shadow-lg shadow-indigo-100"
                 >
                   <FileText className="w-4 h-4" />
                   View Vendor Invoice
                 </button>
               </div>
             )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VendorInwardChallans;
