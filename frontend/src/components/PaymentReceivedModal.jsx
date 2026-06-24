import React, { useState, useEffect, useRef } from 'react';
import { Modal, FormControl, SearchableSelect } from './ui.jsx';
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

const PaymentReceivedModal = ({ isOpen, onClose, invoice, onSuccess }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    salesOrderId: '',
    soId: '',
    salesOrderSource: 'SALES_ORDER',
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
  const [customers, setCustomers] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [customerSalesOrders, setCustomerSalesOrders] = useState([]);
  const [fullSODetail, setFullSODetail] = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [installments, setInstallments] = useState([]);
  const [fetchingInstallments, setFetchingInstallments] = useState(false);

  const fetchInstallmentHistory = async (soId, source) => {
    if (!soId) return;
    try {
      setFetchingInstallments(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments?salesOrderId=${soId}&salesOrderSource=${source}`, {
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
    if (isOpen) {
      if (!invoice) {
        fetchCustomers();
      }
    }
  }, [isOpen, invoice]);

  const fetchFullSODetail = async (soId, source = 'SALES_ORDER') => {
    if (!soId) return;
    try {
      setFetchingDetail(true);
      const token = localStorage.getItem('authToken');
      // Fix endpoint for DIRECT_ORDER to use singular /order/
      const endpoint = source === 'DIRECT_ORDER' ? `${API_BASE}/order/${soId}` : `${API_BASE}/sales-orders/${soId}`;
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFullSODetail(data);
      } else {
        setFullSODetail(null);
      }
    } catch (error) {
      console.error('Error fetching SO detail:', error);
      setFullSODetail(null);
    } finally {
      setFetchingDetail(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (invoice) {
        const custId = invoice.customer_id || invoice.company_id || invoice.client_id || '';
        const soId = invoice.sales_order_id || invoice.id || '';
        const source = invoice.sales_order_source || invoice.source || 'SALES_ORDER';
        
        fetchFullSODetail(soId, source);
        fetchInstallmentHistory(soId, source);

        setFormData({
          customerId: custId,
          salesOrderId: soId,
          soId: invoice.soId || (source && soId ? `${source}_${soId}` : ''),
          salesOrderSource: source,
          paymentAmount: invoice.outstanding ? parseFloat(invoice.outstanding).toFixed(2) : (invoice.total_amount ? parseFloat(invoice.total_amount).toFixed(2) : ''),
          paymentDate: new Date().toISOString().split('T')[0],
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
      } else {
        setFullSODetail(null);
        setInstallments([]);
        setFormData({
          customerId: '',
          salesOrderId: '',
          soId: '',
          paymentAmount: '',
          paymentDate: new Date().toISOString().split('T')[0],
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
      }
      setErrors({});
    }
  }, [invoice, isOpen]);

  useEffect(() => {
    if (formData.customerId && !invoice && isOpen) {
      fetchCustomerInvoices(formData.customerId);
      fetchCustomerSalesOrders(formData.customerId);
    }
  }, [formData.customerId, invoice, isOpen]);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchCustomerInvoices = async (customerId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/customer/${customerId}/outstanding`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomerInvoices(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customer invoices:', error);
    }
  };

  const fetchCustomerSalesOrders = async (customerId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/customer/${customerId}/outstanding`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomerSalesOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customer sales orders:', error);
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
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'salesOrderId' && value) {
      const selectedInv = customerInvoices.find(inv => inv.id.toString() === value.toString());
      if (selectedInv) {
        fetchInstallmentHistory(selectedInv.id, selectedInv.source);
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          soId: `${selectedInv.source}_${selectedInv.id}`,
          salesOrderSource: selectedInv.source,
          paymentAmount: selectedInv.outstanding ? parseFloat(selectedInv.outstanding).toFixed(2) : ''
        }));
      } else {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'soId' && value) {
      const [source, id] = value.split('_');
      const selectedSO = customerSalesOrders.find(so => so.id.toString() === id && so.source === source);
      if (selectedSO) {
        fetchFullSODetail(id, source);
        fetchInstallmentHistory(id, source);
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          salesOrderId: id,
          salesOrderSource: source,
          paymentAmount: selectedSO.outstanding ? parseFloat(selectedSO.outstanding).toFixed(2) : (selectedSO.total_amount ? parseFloat(selectedSO.total_amount).toFixed(2) : '')
        }));
      } else {
        setFullSODetail(null);
        setInstallments([]);
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'customerId') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        salesOrderId: '',
        soId: '',
        salesOrderSource: 'SALES_ORDER',
        paymentAmount: ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.customerId) {
      newErrors.customerId = 'Customer is required';
    }

    const amount = parseFloat(formData.paymentAmount);
    if (!formData.paymentAmount || isNaN(amount) || amount <= 0) {
      newErrors.paymentAmount = 'Valid payment amount is required';
    }

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (!formData.paymentMode) {
      newErrors.paymentMode = 'Payment mode is required';
    }

    if ((formData.paymentMode === 'BANK_TRANSFER' || formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') && !formData.transactionRefNo) {
      newErrors.transactionRefNo = 'Transaction reference number is required';
    }

    if (formData.paymentMode === 'BANK_TRANSFER' && !formData.bankAccount) {
      newErrors.bankAccount = 'Bank account is required';
    }

    if (formData.paymentMode === 'UPI') {
      if (!formData.upiApp) newErrors.upiApp = 'UPI app is required';
      if (!formData.upiTransactionId) newErrors.upiTransactionId = 'UPI transaction ID is required';
    }

    if (formData.paymentMode === 'CHEQUE') {
      if (!formData.chequeNumber) newErrors.chequeNumber = 'Cheque number is required';
      if (!formData.bankName) newErrors.bankName = 'Bank name is required';
      if (!formData.chequeDate) newErrors.chequeDate = 'Cheque date is required';
    }

    if ((formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD')) {
      if (!formData.cardType) newErrors.cardType = 'Card type is required';
      if (!formData.last4Digits) newErrors.last4Digits = 'Last 4 digits are required';
      if (!formData.authorizationCode) newErrors.authorizationCode = 'Authorization code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const isValid = validateForm();
    if (!isValid) {
      // Re-run validation logic locally to get immediate errors object
      const currentErrors = {};
      if (!formData.customerId) currentErrors.customerId = 'Customer is required';
      const amount = parseFloat(formData.paymentAmount);
      if (!formData.paymentAmount || isNaN(amount) || amount <= 0) currentErrors.paymentAmount = 'Valid payment amount is required';
      if (!formData.paymentDate) currentErrors.paymentDate = 'Payment date is required';
      if (!formData.paymentMode) currentErrors.paymentMode = 'Payment mode is required';
      
      const firstError = Object.values(currentErrors)[0] || 'Please fix the errors in the form';
      errorToast(firstError);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const paymentPayload = {
        invoiceId: formData.salesOrderId || null,
        salesOrderId: formData.salesOrderId || null,
        salesOrderSource: formData.salesOrderSource,
        customerId: formData.customerId,
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

      const response = await fetch(`${API_BASE}/customer-payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to record payment');
      }

      const result = await response.json();
      successToast('Payment received and recorded successfully');
      onSuccess?.(result);
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      errorToast(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const lastSalesOrderId = useRef('');
  useEffect(() => {
    const currentId = String(formData.salesOrderId || '');
    if (isOpen && currentId !== lastSalesOrderId.current && (invoice || fullSODetail)) {
      lastSalesOrderId.current = currentId;
      const invAmt = parseFloat(fullSODetail?.total_amount || fullSODetail?.grand_total || invoice?.total_amount || invoice?.net_total || 0);
      const paidAmt = installments.reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);
      const outAmt = Math.max(0, invAmt - paidAmt);
      setFormData(prev => ({
        ...prev,
        paymentAmount: outAmt > 0 ? outAmt.toFixed(2) : ''
      }));
    }
  }, [fullSODetail, installments, formData.salesOrderId, invoice, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      lastSalesOrderId.current = '';
    }
  }, [isOpen]);

  const invoiceAmount = parseFloat(fullSODetail?.total_amount || fullSODetail?.grand_total || invoice?.total_amount || invoice?.net_total || 0);
  const alreadyReceived = installments.reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);
  const outstandingAmount = Math.max(0, invoiceAmount - alreadyReceived);
  const progressPercent = invoiceAmount > 0 ? Math.round((alreadyReceived / invoiceAmount) * 100) : 0;
  const advanceReceived = installments
    .filter(inst => (inst.remarks || '').toLowerCase().includes('advance') || (inst.description || '').toLowerCase().includes('advance'))
    .reduce((sum, inst) => sum + (parseFloat(inst.payment_amount) || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={invoice ? "Record Payment Received" : "Add Payment Received"} size="5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[80vh] custom-scrollbar p-1">
        <div className="space-y-4">
          {/* Selection Section (Only if no invoice passed) */}
          {!invoice && (
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded  border border-slate-200">
              <div className="col-span-2">
                <FormControl label="Customer *">
                  <select
                    value={formData.customerId}
                    onChange={(e) => handleInputChange('customerId', e.target.value)}
                    className={`w-full p-2 border rounded  text-sm bg-white ${errors.customerId ? 'border-rose-500' : 'border-slate-300'}`}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                  {errors.customerId && <span className="text-xs text-rose-600 mt-1 block">{errors.customerId}</span>}
                </FormControl>
              </div>

              <FormControl label="Invoice (Optional)">
                <select
                  value={formData.salesOrderId}
                  onChange={(e) => handleInputChange('salesOrderId', e.target.value)}
                  disabled={!formData.customerId}
                  className="w-full p-2 border border-slate-300 rounded  text-sm bg-white disabled:bg-slate-100"
                >
                  <option value="">Advance Payment / On Account</option>
                  {customerInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.so_number} - {formatCurrency(inv.outstanding)} due</option>
                  ))}
                </select>
              </FormControl>

              <FormControl label="Sales Order (Optional)">
                <select
                  value={formData.soId}
                  onChange={(e) => handleInputChange('soId', e.target.value)}
                  disabled={!formData.customerId}
                  className="w-full p-2 border border-slate-300 rounded  text-sm bg-white disabled:bg-slate-100"
                >
                  <option value="">Select Sales Order</option>
                  {customerSalesOrders.map(so => (
                    <option key={`${so.source}_${so.id}`} value={`${so.source}_${so.id}`}>
                      {so.so_number} - {formatCurrency(so.outstanding || so.total_amount)}
                    </option>
                  ))}
                </select>
              </FormControl>
            </div>
          )}

          {/* Invoice Summary (If invoice passed) */}
          {(invoice || fullSODetail) && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Invoice Details</span>
                    <h3 className="text-slate-900 font-bold text-sm mt-0.5">{fullSODetail?.so_number || fullSODetail?.order_no || invoice?.po_number || invoice?.so_number || 'N/A'}</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">Collection View</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div className="col-span-2">
                    <span className="text-slate-500">Customer</span>
                    <p className="text-slate-900 font-semibold mt-0.5">{fullSODetail?.company_name || invoice?.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Project</span>
                    <p className="text-slate-900 mt-0.5 font-medium truncate">{fullSODetail?.project_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Collection Progress</span>
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
                    <span className="text-slate-500">Already Received</span>
                    <p className="text-emerald-600 text-sm font-bold mt-0.5">{formatCurrency(alreadyReceived)}</p>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500">Outstanding Amount</span>
                    <p className="text-rose-600 text-sm font-bold mt-0.5">{formatCurrency(outstandingAmount)}</p>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500">Advance Received</span>
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
                          <span className="font-semibold text-slate-700">{inst.payment_receipt_no}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(inst.payment_date)} • {inst.payment_mode?.replace('_', ' ')}</span>
                          {inst.transaction_ref_no && <span className="text-[9px] text-slate-400">Ref: {inst.transaction_ref_no}</span>}
                        </div>
                        <span className="font-medium text-emerald-600">{formatCurrency(inst.payment_amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {fullSODetail && (
                <div className="bg-white border border-slate-100 rounded overflow-hidden">
                  <div className="p-2.5 bg-slate-50/50 border-b border-slate-100">
                    <h4 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Items List</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/30">
                        <tr>
                          <th className="p-2 text-[10px] font-semibold text-slate-400">Description</th>
                          <th className="p-2 text-[10px] font-semibold text-slate-400 text-center">Qty</th>
                          <th className="p-2 text-[10px] font-semibold text-slate-400 text-right">Price</th>
                          <th className="p-2 text-[10px] font-semibold text-slate-400 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(fullSODetail.items || fullSODetail.order_items || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-2">
                              <p className="text-[11px]  text-slate-800 leading-tight">{item.description || item.material_name || 'N/A'}</p>
                              {item.item_code && <span className="text-[9px] text-slate-400 uppercase er">{item.item_code}</span>}
                            </td>
                            <td className="p-2 text-[11px] text-slate-600 text-center">
                              {item.quantity} {item.unit || item.type || 'Nos'}
                            </td>
                            <td className="p-2 text-[11px] text-slate-600 text-right">
                              {formatCurrency(item.rate || item.unit_rate)}
                            </td>
                            <td className="p-2 text-[11px]  text-slate-900 text-right">
                              {formatCurrency(item.total_amount || item.amount || (item.quantity || 0) * (item.rate || item.unit_rate || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50 border-t border-slate-100">
                        {(fullSODetail.subtotal || fullSODetail.gst) && (
                          <>
                            <tr>
                              <td colSpan="3" className="p-2 text-[10px] font-semibold text-slate-500 text-right">Subtotal</td>
                              <td className="p-2 text-[11px]  text-slate-700 text-right">
                                {formatCurrency(fullSODetail.subtotal)}
                              </td>
                            </tr>
                            <tr>
                              <td colSpan="3" className="p-2 text-[10px] font-semibold text-slate-500 text-right">GST</td>
                              <td className="p-2 text-[11px]  text-slate-700 text-right">
                                {formatCurrency(fullSODetail.gst)}
                              </td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td colSpan="3" className="p-2 text-[10px] font-semibold text-slate-500 text-right">Total Amount (Incl. Taxes)</td>
                          <td className="p-2 text-[11px]  text-slate-900 text-right">
                            {formatCurrency(fullSODetail.grand_total || fullSODetail.total_amount || fullSODetail.net_total || fullSODetail.po_net_total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Entry Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className=" text-slate-900 text-xs  tracking-wide font-semibold">Recording Payment</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <FormControl label="Payment Amount *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 ">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paymentAmount}
                  onChange={(e) => handleInputChange('paymentAmount', e.target.value)}
                  className={`w-full pl-7 pr-3 py-2.5 border rounded text-sm  focus:outline-none focus:ring-2 transition-all ${errors.paymentAmount ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-500'}`}
                  placeholder="0.00"
                />
              </div>
              {errors.paymentAmount && <span className="text-xs text-rose-600 mt-1 block ">{errors.paymentAmount}</span>}
            </FormControl>

            <div className="grid grid-cols-2 gap-4">
              <FormControl label="Payment Date *">
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                  className={`w-full p-2 border rounded text-sm  focus:outline-none focus:ring-2 transition-all ${errors.paymentDate ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-500'}`}
                />
                {errors.paymentDate && <span className="text-xs text-rose-600 mt-1 block ">{errors.paymentDate}</span>}
              </FormControl>

              <FormControl label="Payment Mode *">
                <select
                  value={formData.paymentMode}
                  onChange={(e) => handleInputChange('paymentMode', e.target.value)}
                  className={`w-full p-2 border rounded text-sm  focus:outline-none focus:ring-2 transition-all cursor-pointer ${errors.paymentMode ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-500'}`}
                >
                  <option value="">Select Mode</option>
                  {paymentModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {errors.paymentMode && <span className="text-xs text-rose-600 mt-1 block ">{errors.paymentMode}</span>}
              </FormControl>
            </div>

            {formData.paymentMode === 'BANK_TRANSFER' && (
              <FormControl label="Bank Account / Reference *">
                <input
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                  className={`w-full p-2 border rounded text-sm  focus:outline-none focus:ring-2 transition-all ${errors.bankAccount ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-emerald-500/30 focus:border-emerald-500'}`}
                  placeholder="Enter bank name or account details"
                />
                {errors.bankAccount && <span className="text-xs text-rose-600 mt-1 block ">{errors.bankAccount}</span>}
              </FormControl>
            )}

            {formData.paymentMode === 'UPI' && (
              <div className="grid grid-cols-2 gap-4">
                <FormControl label="UPI App *">
                  <select
                    value={formData.upiApp}
                    onChange={(e) => handleInputChange('upiApp', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-sm "
                  >
                    <option value="">Select App</option>
                    {upiApps.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </FormControl>
                <FormControl label="UPI Transaction ID *">
                  <input
                    type="text"
                    value={formData.upiTransactionId}
                    onChange={(e) => handleInputChange('upiTransactionId', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-sm "
                    placeholder="Ref ID"
                  />
                </FormControl>
              </div>
            )}

            {formData.paymentMode === 'CHEQUE' && (
              <div className="grid grid-cols-3 gap-2">
                <FormControl label="Cheque No *">
                  <input
                    type="text"
                    value={formData.chequeNumber}
                    onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                    className={`w-full p-2 border rounded text-sm  ${errors.chequeNumber ? 'border-rose-500' : 'border-slate-300'}`}
                  />
                </FormControl>
                <FormControl label="Bank Name *">
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className={`w-full p-2 border rounded text-sm  ${errors.bankName ? 'border-rose-500' : 'border-slate-300'}`}
                  />
                </FormControl>
                <FormControl label="Date *">
                  <input
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) => handleInputChange('chequeDate', e.target.value)}
                    className={`w-full p-2 border rounded text-sm  ${errors.chequeDate ? 'border-rose-500' : 'border-slate-300'}`}
                  />
                </FormControl>
              </div>
            )}

            {(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD'].includes(formData.paymentMode)) && (
              <FormControl label="Transaction Ref No *">
                <input
                  type="text"
                  value={formData.transactionRefNo}
                  onChange={(e) => handleInputChange('transactionRefNo', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-sm  focus:ring-2 focus:ring-emerald-200 outline-none"
                  placeholder="UTR / Ref Number"
                />
              </FormControl>
            )}

            <FormControl label="Remarks">
              <textarea
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-sm "
                rows="2"
                placeholder="Optional notes about this payment"
              />
            </FormControl>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={onClose} 
              className="flex-1 p-2.5 bg-slate-100 text-slate-600 rounded text-sm  hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={loading} 
              className="flex-1 p-2.5 bg-emerald-600 text-white rounded text-sm  hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Complete Record'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentReceivedModal;
