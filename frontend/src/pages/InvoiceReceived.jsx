import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, CreditCard, Package, RefreshCw, Eye, Download, Send, FileText, Calendar } from 'lucide-react';
import { DataTable, Modal, Button } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';

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

const VendorInvoices = () => {
  const navigate = useNavigate();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingInvoiceId, setProcessingInvoiceId] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showPODetailModal, setShowPODetailModal] = useState(false);
  const [poLoading, setPoLoading] = useState(false);

  useEffect(() => {
    fetchPOs();
  }, []);

  const handleViewPODetail = async (poId) => {
    try {
      setPoLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PO details');
      const data = await response.json();
      setSelectedPO(data);
      setShowPODetailModal(true);
    } catch (error) {
      errorToast(error.message || 'Failed to load PO details');
    } finally {
      setPoLoading(false);
    }
  };

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch POs');
      const data = await response.json();
      const invoicePOs = Array.isArray(data) ? data.filter(po => po.invoice_url) : [];
      setPos(invoicePOs);
    } catch (error) {
      console.error('Error fetching POs:', error);
      errorToast('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const sendToPayment = async (invoice) => {
    try {
      setProcessingInvoiceId(invoice.id);
      const token = localStorage.getItem('authToken');

      const response = await fetch(`${API_BASE}/purchase-orders/${invoice.id}/send-to-payment`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to update invoice status');

      successToast('Invoice sent to payment processing');
      
      navigate('/payment-processing', {
        state: {
          selectedInvoice: {
            id: invoice.id,
            po_number: invoice.po_number,
            vendor_name: invoice.vendor_name,
            vendor_id: invoice.vendor_id,
            total_amount: invoice.total_amount,
            outstanding: invoice.total_amount,
            already_paid: 0,
            created_at: invoice.created_at
          }
        }
      });
    } catch (error) {
      console.error('Error sending to payment:', error);
      errorToast('Failed to send invoice to payment processing');
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const columns = [
    {
      label: 'Invoice Details',
      key: 'po_number',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className=" text-rose-600  ">
            {val}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 ">
              PURCHASE ORDER
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Supplier',
      key: 'vendor_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600  text-xs shadow-sm">
            {val ? val.substring(0, 2).toUpperCase() : 'V'}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">{val}</span>
            <span className="text-[10px] text-slate-500 italic">
              Vendor ID: {row.vendor_id || 'N/A'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Received Date',
      key: 'created_at',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs">{formatDate(val)}</span>
        </div>
      )
    },
    {
      label: 'Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1  text-slate-900">
            <span className="text-rose-600">₹</span>
            <span>{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
            Verified Invoice
          </span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <div className="flex items-center justify-center">
          <span className={`px-2 py-0.5 rounded text-[10px]  border ${
            val === 'APPROVED' || val === 'FULFILLED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
          }`}>
            {val}
          </span>
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={() => handleViewPODetail(row.id)}
            disabled={poLoading}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="View PO Details"
          >
            <Eye className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button
            onClick={() => window.open(`${API_BASE}/${row.invoice_url}`, '_blank')}
            className="p-2 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 group shadow-sm"
            title="View Invoice"
          >
            <FileText className="w-4 h-4 group-hover:scale-110" />
          </button>
          {(row.status === 'APPROVED' || row.status === 'FULFILLED') && (
            <button
              onClick={() => sendToPayment(row)}
              disabled={processingInvoiceId === row.id}
              className="p-2 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 group shadow-sm"
              title="Send to Payment"
            >
              {processingInvoiceId === row.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 group-hover:scale-110" />
              )}
            </button>
          )}
        </div>
      )
    }
  ];

  const filteredData = pos.filter(po => 
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInvoices = pos.length;
  const approvedInvoices = pos.filter(p => p.status === 'APPROVED' || p.status === 'FULFILLED').length;
  const totalValue = pos.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-xl   text-slate-900 ">Vendor Invoices</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs  text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                {totalInvoices} Received
              </span>
              <span className="text-xs  text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-emerald-500" />
                {approvedInvoices} Approved
              </span>
              <span className="text-xs  text-rose-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-rose-500" />
                {formatCurrency(totalValue)} Total Value
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchPOs}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
            title="Refresh Data"
          />
        </div>
      </div>

      <div className="overflow-hidden my-4">
        <DataTable
          columns={columns}
          data={pos}
          loading={loading}
          searchPlaceholder="Search invoices by PO number or supplier..."
          className="border-none"
        />
      </div>

      <Modal
        isOpen={showPODetailModal}
        onClose={() => setShowPODetailModal(false)}
        title={`Purchase Order Details - ${selectedPO?.po_number}`}
        size="4xl"
      >
        {selectedPO && (
          <div className="space-y-4 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-100 rounded p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded">
                    <Truck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">Shipping Details</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-start text-xs">
                    <span className="text-slate-400">Address</span>
                    <span className="text-slate-800 text-right max-w-[200px]">{selectedPO.shipping_address || 'Gokul Nagar, Katraj, Pune - 411048'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Incoterm</span>
                    <span className="p-1 bg-rose-50 text-rose-600 rounded border border-rose-100">{selectedPO.incoterm || 'EXW'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Shipping Rule</span>
                    <span className="text-slate-800">{selectedPO.shipping_rule || 'Standard'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">Payment & Others</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Tax Category</span>
                    <span className="p-1 bg-slate-50 text-slate-600 rounded border border-slate-200">{selectedPO.tax_category || 'GST'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Currency</span>
                    <span className="text-slate-800">{selectedPO.currency || 'INR'}</span>
                  </div>
                  <div className="flex justify-between items-start text-xs">
                    <span className="text-slate-400">Notes</span>
                    <span className="text-slate-400 italic text-right max-w-[200px]">{selectedPO.notes || 'No notes added'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded overflow-hidden">
              <div className="p-3 border-b border-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                    <Package className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">Items List</h4>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="p-2 text-xs font-semibold text-slate-400">Item</th>
                      <th className="p-2 text-xs font-semibold text-slate-400 text-center">Qty</th>
                      <th className="p-2 text-xs font-semibold text-slate-400 text-center">Rate</th>
                      <th className="p-2 text-xs font-semibold text-slate-400 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      const filteredItems = (selectedPO.items || []).filter(item => {
                        const type = (item.material_type || '').toUpperCase();
                        return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
                      });

                      const subtotal = filteredItems.reduce((sum, item) => {
                        const qty = parseFloat(item.quantity) || 0;
                        const rate = parseFloat(item.unit_rate || item.rate) || 0;
                        return sum + (qty * rate);
                      }, 0);

                      const totalCGST = filteredItems.reduce((sum, item) => {
                        const qty = parseFloat(item.quantity) || 0;
                        const rate = parseFloat(item.unit_rate || item.rate) || 0;
                        const itemAmount = qty * rate;
                        return sum + (parseFloat(item.cgst_amount) || (itemAmount * 0.09));
                      }, 0);

                      const totalSGST = filteredItems.reduce((sum, item) => {
                        const qty = parseFloat(item.quantity) || 0;
                        const rate = parseFloat(item.unit_rate || item.rate) || 0;
                        const itemAmount = qty * rate;
                        return sum + (parseFloat(item.sgst_amount) || (itemAmount * 0.09));
                      }, 0);

                      const grandTotal = subtotal + totalCGST + totalSGST;

                      return (
                        <>
                          {filteredItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2">
                                <p className="text-xs  text-slate-800">{item.material_name || item.description || 'N/A'}</p>
                                {(item.item_code) && (
                                  <span className="text-[10px] text-slate-400">{item.item_code}</span>
                                )}
                              </td>
                              <td className="p-2 text-xs text-slate-600 text-center">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="p-2 text-xs text-slate-600 text-center">
                                {formatCurrency(item.unit_rate || item.rate, selectedPO.currency)}
                              </td>
                              <td className="p-2 text-xs  text-slate-900 text-right">
                                {formatCurrency((item.quantity || 0) * (item.unit_rate || item.rate || 0), selectedPO.currency)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50/30">
                            <td colSpan="3" className="p-2 text-xs  text-slate-500 text-right">Subtotal</td>
                            <td className="p-2 text-xs  text-slate-900 text-right">{formatCurrency(subtotal, selectedPO.currency)}</td>
                          </tr>
                          <tr className="bg-slate-50/30">
                            <td colSpan="3" className="p-2 text-xs  text-slate-500 text-right">CGST (9%)</td>
                            <td className="p-2 text-xs  text-slate-900 text-right">{formatCurrency(totalCGST, selectedPO.currency)}</td>
                          </tr>
                          <tr className="bg-slate-50/30">
                            <td colSpan="3" className="p-2 text-xs  text-slate-500 text-right">SGST (9%)</td>
                            <td className="p-2 text-xs  text-slate-900 text-right">{formatCurrency(totalSGST, selectedPO.currency)}</td>
                          </tr>
                          <tr className="bg-rose-50/50">
                            <td colSpan="3" className="p-2 text-sm  text-rose-700 text-right">Total with GST</td>
                            <td className="p-2 text-sm  text-rose-700 text-right">{formatCurrency(grandTotal, selectedPO.currency)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VendorInvoices;
