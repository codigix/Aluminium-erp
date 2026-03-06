import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, Modal } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import { Eye, FileText, CheckCircle, Send } from 'lucide-react';

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
      navigate('/payment-processing', {
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
      className: 'text-blue-600 font-bold'
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
      className: 'font-bold text-emerald-600',
      render: (val) => formatCurrency(val)
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wider ${
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
                <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )
    }
  ];

  const filteredData = receipts.filter(r => 
    r.job_card_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Vendor Inward Challans</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Manage costs and invoices from vendor receipts</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search challans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all w-64"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button 
            onClick={fetchReceipts}
            className="p-2 bg-white border border-slate-200 rounded text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          hideHeader={true}
          emptyMessage="No vendor inward challans found."
        />
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Vendor Inward Details"
        maxWidth="max-w-2xl"
      >
        {selectedReceipt && (
          <div className="space-y-6">
             <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Job Card</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{selectedReceipt.job_card_number}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Vendor</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{selectedReceipt.vendor_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Inward Date</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{formatDate(selectedReceipt.date)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Status</p>
                  <div className="mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
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
                  <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Inward Items & Costing</h4>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Item Code</th>
                        <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-center">Qty</th>
                        <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-right">Rate</th>
                        <th className="px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsLoading ? (
                        <tr><td colSpan="4" className="px-3 py-4 text-center text-slate-400">Loading items...</td></tr>
                      ) : receiptItems.map((item, idx) => (
                        <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-medium text-slate-700">{item.item_code}</td>
                          <td className="px-3 py-2 text-center text-slate-600 font-bold">{item.release_qty}</td>
                          <td className="px-3 py-2 text-right text-slate-900 font-medium">{formatCurrency(item.rate)}</td>
                          <td className="px-3 py-2 text-right text-slate-900 font-bold">{formatCurrency(Number(item.release_qty) * Number(item.rate))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 border-t border-slate-100 font-bold">
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right text-slate-500 uppercase tracking-wider text-[10px]">Sub Total</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(selectedReceipt.sub_total)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right text-slate-500 uppercase tracking-wider text-[10px]">GST (18%)</td>
                        <td className="px-3 py-2 text-right text-indigo-600">{formatCurrency(selectedReceipt.gst_amount)}</td>
                      </tr>
                      <tr className="bg-slate-100/50">
                        <td colSpan="3" className="px-3 py-2 text-right text-slate-900 uppercase tracking-wider text-[10px]">Grand Total</td>
                        <td className="px-3 py-2 text-right text-emerald-600 text-sm">{formatCurrency(selectedReceipt.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
             </div>

             {selectedReceipt.invoice_url && (
               <div className="flex justify-center pt-4">
                 <button 
                  onClick={() => window.open(`${API_BASE}/${selectedReceipt.invoice_url}`, '_blank')}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-100"
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
