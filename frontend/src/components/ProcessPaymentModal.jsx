import React, { useState, useEffect, useRef } from 'react';
import { Truck, CreditCard, Package } from 'lucide-react';
import { Modal, FormControl, SearchableSelect } from './ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';

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

const ProcessPaymentModal = ({ isOpen, onClose, invoice, onSuccess }) => {
  const [formData, setFormData] = useState({
    paymentAmount: '',
    paymentDate: '',
    paymentMode: '',
    bankAccount: '',
    transactionRefNo: '',
    remarks: '',
    upiApp: '',
    upiTransactionId: '',
    chequeNumber: '',
    bankName: '',
    chequeDate: '',
    cardType: '',
    last4Digits: '',
    authorizationCode: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [fullPODetail, setFullPODetail] = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [installments, setInstallments] = useState([]);
  const [fetchingInstallments, setFetchingInstallments] = useState(false);

  const fetchInstallmentHistory = async (id, type) => {
    if (!id) return;
    try {
      setFetchingInstallments(true);
      const token = localStorage.getItem('authToken');
      const param = type === 'SUBCONTRACTING' ? `jobCardQualityLogId=${id}` : `poId=${id}`;
      const response = await fetch(`${API_BASE}/payments?${param}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setInstallments(Array.isArray(data) ? data : []);
      } else {
        setInstallments([]);
      }
    } catch (error) {
      console.error('Error fetching installments:', error);
      setInstallments([]);
    } finally {
      setFetchingInstallments(false);
    }
  };

  useEffect(() => {
    if (invoice && isOpen) {
      setFormData(prev => ({
        ...prev,
        paymentAmount: invoice.outstanding || invoice.total_amount || '',
        paymentDate: new Date().toISOString().split('T')[0]
      }));
      fetchBankAccounts();
      const isSub = invoice.isSubcontracting || invoice.type === 'SUBCONTRACTING';
      if (isSub) {
        setFullPODetail(null);
      } else {
        fetchFullPODetail(invoice.id);
      }
      fetchInstallmentHistory(invoice.id, isSub ? 'SUBCONTRACTING' : 'PURCHASE_ORDER');
      setErrors({});
    } else if (!isOpen) {
      setInstallments([]);
    }
  }, [invoice, isOpen]);

  const fetchFullPODetail = async (poId) => {
    if (!poId) return;
    try {
      setFetchingDetail(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFullPODetail(data);
      }
    } catch (error) {
      console.error('Error fetching PO detail:', error);
    } finally {
      setFetchingDetail(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bank-accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const paymentModes = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'CASH', label: 'Cash' }
  ];

  const upiApps = [
    { value: 'PHONEPE', label: 'PhonePe' },
    { value: 'GOOGLE_PAY', label: 'Google Pay' },
    { value: 'PAYTM', label: 'Paytm' }
  ];

  const cardTypes = [
    { value: 'CREDIT', label: 'Credit Card' },
    { value: 'DEBIT', label: 'Debit Card' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
      newErrors.paymentAmount = 'Payment amount is required and must be greater than 0';
    }

    if (parseFloat(formData.paymentAmount) > parseFloat(invoice.outstanding || invoice.total_amount || 0)) {
      newErrors.paymentAmount = `Payment amount cannot exceed outstanding balance of ${formatCurrency(invoice.outstanding || invoice.total_amount)}`;
    }

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (!formData.paymentMode) {
      newErrors.paymentMode = 'Payment mode is required';
    }

    if ((formData.paymentMode === 'BANK_TRANSFER' || formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') && !formData.transactionRefNo) {
      newErrors.transactionRefNo = 'Transaction reference number is required for this payment mode';
    }

    if (formData.paymentMode === 'BANK_TRANSFER') {
      if (!formData.bankAccount) {
        newErrors.bankAccount = 'Bank account is required for bank transfers';
      }
    }

    if (formData.paymentMode === 'UPI') {
      if (!formData.upiApp) {
        newErrors.upiApp = 'UPI app is required';
      }
      if (!formData.upiTransactionId) {
        newErrors.upiTransactionId = 'UPI transaction ID is required';
      }
    }

    if (formData.paymentMode === 'CHEQUE') {
      if (!formData.chequeNumber) {
        newErrors.chequeNumber = 'Cheque number is required';
      }
      if (!formData.bankName) {
        newErrors.bankName = 'Bank name is required';
      }
      if (!formData.chequeDate) {
        newErrors.chequeDate = 'Cheque date is required';
      }
    }

    if (formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') {
      if (!formData.cardType) {
        newErrors.cardType = 'Card type is required';
      }
      if (!formData.last4Digits) {
        newErrors.last4Digits = 'Last 4 digits are required';
      }
      if (!formData.authorizationCode) {
        newErrors.authorizationCode = 'Authorization code is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      errorToast('Please fix the errors in the form');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const isSub = invoice.isSubcontracting || invoice.type === 'SUBCONTRACTING';
      const paymentPayload = {
        invoiceId: isSub ? null : invoice.id,
        poId: isSub ? null : invoice.id,
        jobCardQualityLogId: isSub ? invoice.id : null,
        vendorId: invoice.vendor_id,
        paymentAmount: parseFloat(formData.paymentAmount),
        paymentDate: formData.paymentDate,
        paymentMode: formData.paymentMode,
        transactionRefNo: formData.transactionRefNo,
        remarks: formData.remarks,
        bankAccount: formData.bankAccount,
        upiApp: formData.upiApp,
        upiTransactionId: formData.upiTransactionId,
        chequeNumber: formData.chequeNumber,
        bankName: formData.bankName,
        chequeDate: formData.chequeDate,
        cardType: formData.cardType,
        last4Digits: formData.last4Digits,
        authorizationCode: formData.authorizationCode,
      };

      const response = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process payment');
      }

      const result = await response.json();
      
      // Handle success with receipt download option
      import('sweetalert2').then((Swal) => {
        Swal.default.fire({
          title: 'Payment Successful!',
          text: 'The payment has been processed. Would you like to download the receipt?',
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'Download Receipt',
          cancelButtonText: 'Close',
          confirmButtonColor: '#2563eb'
        }).then((res) => {
          if (res.isConfirmed) {
            handleDownloadReceipt(result.data.id || result.data.insertId);
          }
          onSuccess?.(result);
          onClose();
        });
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      errorToast(error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (paymentId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments/${paymentId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Receipt-${paymentId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        errorToast('Failed to download receipt');
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
      errorToast('Network error while downloading receipt');
    }
  };

  const lastInvoiceId = useRef('');
  useEffect(() => {
    const currentId = String(invoice?.id || '');
    if (isOpen && currentId !== lastInvoiceId.current && invoice) {
      lastInvoiceId.current = currentId;
      const invAmt = parseFloat(invoice.total_amount || 0);
      const paidAmt = installments.reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);
      const outAmt = Math.max(0, invAmt - paidAmt);
      setFormData(prev => ({
        ...prev,
        paymentAmount: outAmt > 0 ? outAmt.toFixed(2) : ''
      }));
    }
  }, [installments, invoice, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      lastInvoiceId.current = '';
    }
  }, [isOpen]);

  if (!invoice) return null;

  const invoiceAmount = parseFloat(invoice?.total_amount || 0);
  const alreadyReceived = installments.reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);
  const outstandingAmount = Math.max(0, invoiceAmount - alreadyReceived);
  const progressPercent = invoiceAmount > 0 ? Math.round((alreadyReceived / invoiceAmount) * 100) : 0;
  const advanceReceived = installments
    .filter(inst => (inst.remarks || '').toLowerCase().includes('advance') || (inst.description || '').toLowerCase().includes('advance'))
    .reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Process Payment" size="5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[80vh] custom-scrollbar p-1">
        <div className="space-y-4">
          {/* Invoice Summary Section */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Invoice Details</span>
                <h3 className="text-slate-900 font-bold text-sm mt-0.5">{invoice.po_number || 'N/A'}</h3>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">Payment View</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div className="col-span-2">
                <span className="text-slate-500">Supplier</span>
                <p className="text-slate-900 font-semibold mt-0.5">{invoice.vendor_name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Invoice Date</span>
                <p className="text-slate-900 mt-0.5 font-medium">{formatDate(invoice.created_at)}</p>
              </div>
              <div>
                <span className="text-slate-500">Payment Progress</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                  <span className="text-emerald-600 font-bold">{progressPercent}%</span>
                </div>
              </div>
              
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Invoice Amount</span>
                <p className="text-slate-900 text-sm font-bold mt-0.5">{formatCurrency(invoiceAmount)}</p>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Already Paid</span>
                <p className="text-emerald-600 text-sm font-bold mt-0.5">{formatCurrency(alreadyReceived)}</p>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Outstanding Amount</span>
                <p className="text-rose-600 text-sm font-bold mt-0.5">{formatCurrency(outstandingAmount)}</p>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Advance Paid</span>
                <p className="text-indigo-600 text-sm font-bold mt-0.5">{formatCurrency(advanceReceived)}</p>
              </div>
            </div>
          </div>

          {/* Installment History Section */}
          <div className="bg-white border border-slate-200 rounded p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-semibold text-slate-800 text-xs">Installment History</h4>
              <span className="text-[10px] text-slate-400 font-medium">Recorded Payments</span>
            </div>
            {fetchingInstallments ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading payments...</p>
            ) : installments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No payment transactions exist yet.</p>
            ) : (
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {installments.map((inst, index) => (
                  <div key={inst.id || index} className="flex justify-between items-center text-xs p-2 bg-slate-50 border border-slate-100 rounded">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">{inst.payment_voucher_no}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(inst.payment_date)} • {inst.payment_mode?.replace('_', ' ')}</span>
                      {inst.transaction_ref_no && <span className="text-[9px] text-slate-400">Ref: {inst.transaction_ref_no}</span>}
                    </div>
                    <span className="font-medium text-emerald-600">{formatCurrency(inst.payment_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {fullPODetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 rounded p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-semibold text-slate-700">Shipping</h4>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Address:</span>
                      <span className="text-slate-700 text-right max-w-[120px] truncate">{fullPODetail.shipping_address || 'Main Warehouse'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Incoterm:</span>
                      <span className="text-blue-600 ">{fullPODetail.incoterm || 'EXW'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-semibold text-slate-700">Payment</h4>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tax Category:</span>
                      <span className="text-slate-700">{fullPODetail.tax_category || 'GST'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Currency:</span>
                      <span className="text-slate-700">{fullPODetail.currency || 'INR'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded overflow-hidden">
                <div className="p-2.5 border-b border-slate-50 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-semibold text-slate-700">Items</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2 text-[10px] font-semibold text-slate-400">Item</th>
                        <th className="p-2 text-[10px] font-semibold text-slate-400 text-center">Qty</th>
                        <th className="p-2 text-[10px] font-semibold text-slate-400 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(() => {
                        const filteredItems = (fullPODetail.items || []).filter(item => {
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
                                  <p className="text-[11px]  text-slate-800 leading-tight">{item.material_name || item.description || 'N/A'}</p>
                                  {formatDimensions(item) && (
                                    <span className="text-[10px] text-slate-400 block mt-0.5">{formatDimensions(item)}</span>
                                  )}
                                </td>
                                <td className="p-2 text-[11px] text-slate-600 text-center">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="p-2 text-[11px]  text-slate-900 text-right">
                                  {formatCurrency((item.quantity || 0) * (item.unit_rate || item.rate || 0), fullPODetail.currency)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50/30">
                              <td colSpan="2" className="p-1.5 text-[10px]  text-slate-500 text-right">Subtotal</td>
                              <td className="p-1.5 text-[10px]  text-slate-900 text-right">{formatCurrency(subtotal, fullPODetail.currency)}</td>
                            </tr>
                            <tr className="bg-slate-50/30">
                              <td colSpan="2" className="p-1.5 text-[10px]  text-slate-500 text-right">CGST (9%)</td>
                              <td className="p-1.5 text-[10px]  text-slate-900 text-right">{formatCurrency(totalCGST, fullPODetail.currency)}</td>
                            </tr>
                            <tr className="bg-slate-50/30">
                              <td colSpan="2" className="p-1.5 text-[10px]  text-slate-500 text-right">SGST (9%)</td>
                              <td className="p-1.5 text-[10px]  text-slate-900 text-right">{formatCurrency(totalSGST, fullPODetail.currency)}</td>
                            </tr>
                            <tr className="bg-blue-50/50">
                              <td colSpan="2" className="p-1.5 text-xs  text-blue-700 text-right">Grand Total</td>
                              <td className="p-1.5 text-xs  text-blue-700 text-right">{formatCurrency(grandTotal, fullPODetail.currency)}</td>
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
        </div>

        {/* Payment Entry Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-slate-900 text-xs tracking-wide">Payment Details</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Payment Amount */}
            <FormControl label="Payment Amount *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.paymentAmount}
                  onChange={(e) => handleInputChange('paymentAmount', e.target.value)}
                  className={`w-full pl-7 pr-3 py-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.paymentAmount ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder={`Max: ${formatCurrency(outstandingAmount)}`}
                />
              </div>
              {errors.paymentAmount && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentAmount}</span>}
            </FormControl>

            <div className="grid grid-cols-2 gap-4">
              {/* Payment Date */}
              <FormControl label="Payment Date *">
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                  className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.paymentDate ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                />
                {errors.paymentDate && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentDate}</span>}
              </FormControl>

              {/* Payment Mode */}
              <FormControl label="Payment Mode *">
                <select
                  value={formData.paymentMode}
                  onChange={(e) => handleInputChange('paymentMode', e.target.value)}
                  className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none bg-white bg-no-repeat bg-right pr-10 cursor-pointer ${errors.paymentMode ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center'}}
                >
                  <option value="">Select Payment Mode</option>
                  {paymentModes.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
                {errors.paymentMode && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentMode}</span>}
              </FormControl>
            </div>

            {/* Bank Transfer Fields */}
            {formData.paymentMode === 'BANK_TRANSFER' && (
              <FormControl label="Bank Account *">
                <input
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                  className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.bankAccount ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="Enter bank name or account details"
                />
                {errors.bankAccount && <span className="text-xs text-rose-600 mt-1 block">{errors.bankAccount}</span>}
              </FormControl>
            )}

            {/* Transaction Ref No */}
            {(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD'].includes(formData.paymentMode)) && (
              <FormControl label="Transaction Ref No *">
                <input
                  type="text"
                  value={formData.transactionRefNo}
                  onChange={(e) => handleInputChange('transactionRefNo', e.target.value)}
                  className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.transactionRefNo ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="Enter transaction reference"
                />
                {errors.transactionRefNo && <span className="text-xs text-rose-600 mt-1 block">{errors.transactionRefNo}</span>}
              </FormControl>
            )}

            {/* UPI Fields */}
            {formData.paymentMode === 'UPI' && (
              <div className="grid grid-cols-2 gap-4">
                <FormControl label="UPI App *">
                  <select
                    value={formData.upiApp}
                    onChange={(e) => handleInputChange('upiApp', e.target.value)}
                    className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.upiApp ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  >
                    <option value="">Select UPI App</option>
                    {upiApps.map(app => (
                      <option key={app.value} value={app.value}>{app.label}</option>
                    ))}
                  </select>
                  {errors.upiApp && <span className="text-xs text-rose-600 mt-1 block">{errors.upiApp}</span>}
                </FormControl>
                <FormControl label="UPI Transaction ID *">
                  <input
                    type="text"
                    value={formData.upiTransactionId}
                    onChange={(e) => handleInputChange('upiTransactionId', e.target.value)}
                    className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.upiTransactionId ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                    placeholder="ID"
                  />
                  {errors.upiTransactionId && <span className="text-xs text-rose-600 mt-1 block">{errors.upiTransactionId}</span>}
                </FormControl>
              </div>
            )}

            {/* Cheque Fields */}
            {formData.paymentMode === 'CHEQUE' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormControl label="Cheque Number *">
                    <input
                      type="text"
                      value={formData.chequeNumber}
                      onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                      className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.chequeNumber ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                      placeholder="Enter cheque number"
                    />
                    {errors.chequeNumber && <span className="text-xs text-rose-600 mt-1 block">{errors.chequeNumber}</span>}
                  </FormControl>
                  <FormControl label="Cheque Date *">
                    <input
                      type="date"
                      value={formData.chequeDate}
                      onChange={(e) => handleInputChange('chequeDate', e.target.value)}
                      className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.chequeDate ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                    />
                    {errors.chequeDate && <span className="text-xs text-rose-600 mt-1 block">{errors.chequeDate}</span>}
                  </FormControl>
                </div>
                <FormControl label="Bank Name *">
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.bankName ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                    placeholder="Enter bank name"
                  />
                  {errors.bankName && <span className="text-xs text-rose-600 mt-1 block">{errors.bankName}</span>}
                </FormControl>
              </div>
            )}

            {/* Card Fields */}
            {(formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormControl label="Card Type *">
                    <select
                      value={formData.cardType}
                      onChange={(e) => handleInputChange('cardType', e.target.value)}
                      className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.cardType ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                    >
                      <option value="">Select Card Type</option>
                      {cardTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    {errors.cardType && <span className="text-xs text-rose-600 mt-1 block">{errors.cardType}</span>}
                  </FormControl>
                  <FormControl label="Last 4 Digits *">
                    <input
                      type="text"
                      maxLength="4"
                      value={formData.last4Digits}
                      onChange={(e) => handleInputChange('last4Digits', e.target.value.replace(/\D/g, ''))}
                      className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.last4Digits ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                      placeholder="e.g. 1234"
                    />
                    {errors.last4Digits && <span className="text-xs text-rose-600 mt-1 block">{errors.last4Digits}</span>}
                  </FormControl>
                </div>
                <FormControl label="Authorization Code *">
                  <input
                    type="text"
                    value={formData.authorizationCode}
                    onChange={(e) => handleInputChange('authorizationCode', e.target.value)}
                    className={`w-full p-2 border rounded text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.authorizationCode ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                    placeholder="Enter auth code"
                  />
                  {errors.authorizationCode && <span className="text-xs text-rose-600 mt-1 block">{errors.authorizationCode}</span>}
                </FormControl>
              </div>
            )}

            <FormControl label="Remarks">
              <textarea
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-sm"
                rows="2"
                placeholder="Optional payment notes"
              />
            </FormControl>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded text-sm font-semibold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-2.5 bg-blue-600 text-white rounded text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Complete Payment'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ProcessPaymentModal;
