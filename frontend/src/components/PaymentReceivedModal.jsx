import React, { useState, useEffect } from 'react';
import { Modal, FormControl } from './ui.jsx';
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
  const [bankAccounts, setBankAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [customerSalesOrders, setCustomerSalesOrders] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchBankAccounts();
      if (!invoice) {
        fetchCustomers();
      }
    }
  }, [isOpen, invoice]);

  useEffect(() => {
    if (isOpen) {
      if (invoice) {
        setFormData({
          customerId: invoice.customer_id || invoice.company_id || '',
          salesOrderId: invoice.sales_order_id || invoice.id || '',
          soId: `${invoice.sales_order_source || 'SALES_ORDER'}_${invoice.sales_order_id || invoice.id}`,
          salesOrderSource: invoice.sales_order_source || 'SALES_ORDER',
          paymentAmount: invoice.outstanding || invoice.total_amount || '',
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

  const fetchBankAccounts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bank-accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

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
    setFormData(prev => ({ ...prev, [field]: value }));
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
        setFormData(prev => ({ 
          ...prev, 
          salesOrderId: value,
          soId: `${selectedInv.source}_${selectedInv.id}`,
          salesOrderSource: selectedInv.source,
          paymentAmount: selectedInv.outstanding 
        }));
      }
    } else if (field === 'soId' && value) {
      const [source, id] = value.split('_');
      const selectedSO = customerSalesOrders.find(so => so.id.toString() === id && so.source === source);
      if (selectedSO) {
        setFormData(prev => ({ 
          ...prev, 
          soId: value,
          salesOrderId: id,
          salesOrderSource: source,
          paymentAmount: selectedSO.outstanding || selectedSO.total_amount 
        }));
      }
    } else if (field === 'customerId') {
      setFormData(prev => ({
        ...prev,
        customerId: value,
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

    if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
      newErrors.paymentAmount = 'Payment amount is required and must be greater than 0';
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      errorToast('Please fix the errors in the form');
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

  const currentOutstanding = invoice ? parseFloat(invoice.outstanding || invoice.total_amount || 0) : 
    (formData.salesOrderId ? parseFloat(customerInvoices.find(inv => inv.id.toString() === formData.salesOrderId.toString())?.outstanding || 0) : null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={invoice ? "Record Payment Received" : "Add Payment Received"} size="2xl">
      <div className="space-y-6">
        
        {/* Selection Section (Only if no invoice passed) */}
        {!invoice && (
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="col-span-2">
              <FormControl label="Customer *">
                <select
                  value={formData.customerId}
                  onChange={(e) => handleInputChange('customerId', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white ${errors.customerId ? 'border-rose-500' : 'border-slate-300'}`}
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100"
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
        {invoice && (
          <div className="bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-100 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Invoice Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-5 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Invoice No</span>
                <p className="font-bold text-slate-900 mt-1">{invoice.po_number || invoice.so_number || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Customer</span>
                <p className="font-bold text-slate-900 mt-1">{invoice.customer_name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Invoice Amount</span>
                <p className="font-bold text-slate-900 mt-1">{formatCurrency(invoice.total_amount || invoice.net_total)}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Outstanding</span>
                <p className="font-bold text-rose-600 mt-1">{formatCurrency(currentOutstanding)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Details */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Payment Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Payment Amount *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paymentAmount}
                  onChange={(e) => handleInputChange('paymentAmount', e.target.value)}
                  className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:ring-2 ${errors.paymentAmount ? 'border-rose-500 focus:ring-rose-200' : 'border-slate-300 focus:ring-emerald-200'}`}
                  placeholder="0.00"
                />
              </div>
              {errors.paymentAmount && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentAmount}</span>}
            </FormControl>

            <FormControl label="Payment Date *">
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.paymentDate ? 'border-rose-500' : 'border-slate-300'}`}
              />
              {errors.paymentDate && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentDate}</span>}
            </FormControl>

            <FormControl label="Payment Mode *">
              <select
                value={formData.paymentMode}
                onChange={(e) => handleInputChange('paymentMode', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.paymentMode ? 'border-rose-500' : 'border-slate-300'}`}
              >
                <option value="">Select Mode</option>
                {paymentModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {errors.paymentMode && <span className="text-xs text-rose-600 mt-1 block">{errors.paymentMode}</span>}
            </FormControl>

            {formData.paymentMode === 'BANK_TRANSFER' && (
              <FormControl label="Bank Account *">
                <select
                  value={formData.bankAccount}
                  onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.bankAccount ? 'border-rose-500' : 'border-slate-300'}`}
                >
                  <option value="">Select Account</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
                </select>
                {errors.bankAccount && <span className="text-xs text-rose-600 mt-1 block">{errors.bankAccount}</span>}
              </FormControl>
            )}

            {formData.paymentMode === 'UPI' && (
              <>
                <FormControl label="UPI App *">
                  <select
                    value={formData.upiApp}
                    onChange={(e) => handleInputChange('upiApp', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="ID"
                  />
                </FormControl>
              </>
            )}

            {formData.paymentMode === 'CHEQUE' && (
              <>
                <FormControl label="Cheque No *">
                  <input
                    type="text"
                    value={formData.chequeNumber}
                    onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.chequeNumber ? 'border-rose-500' : 'border-slate-300'}`}
                  />
                  {errors.chequeNumber && <span className="text-xs text-rose-600 mt-1 block">{errors.chequeNumber}</span>}
                </FormControl>
                <FormControl label="Bank Name *">
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.bankName ? 'border-rose-500' : 'border-slate-300'}`}
                    placeholder="e.g. HDFC Bank"
                  />
                  {errors.bankName && <span className="text-xs text-rose-600 mt-1 block">{errors.bankName}</span>}
                </FormControl>
                <FormControl label="Cheque Date *">
                  <input
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) => handleInputChange('chequeDate', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.chequeDate ? 'border-rose-500' : 'border-slate-300'}`}
                  />
                  {errors.chequeDate && <span className="text-xs text-rose-600 mt-1 block">{errors.chequeDate}</span>}
                </FormControl>
              </>
            )}

            {(formData.paymentMode === 'BANK_TRANSFER' || formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') && (
              <FormControl label="Ref No *">
                <input
                  type="text"
                  value={formData.transactionRefNo}
                  onChange={(e) => handleInputChange('transactionRefNo', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Reference #"
                />
              </FormControl>
            )}
          </div>

          <FormControl label="Remarks">
            <textarea
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows="2"
            />
          </FormControl>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
            {loading ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentReceivedModal;
