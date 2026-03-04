import React, { useState, useEffect } from 'react';
import { Modal, FormControl, SearchableSelect } from './ui.jsx';
import { errorToast } from '../utils/toast';

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

  useEffect(() => {
    if (invoice && isOpen) {
      setFormData(prev => ({
        ...prev,
        paymentAmount: invoice.outstanding || invoice.total_amount || '',
        paymentDate: new Date().toISOString().split('T')[0]
      }));
      fetchBankAccounts();
      setErrors({});
    }
  }, [invoice, isOpen]);

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

      const paymentPayload = {
        invoiceId: invoice.id, // Keeping this for backward compatibility if needed
        poId: invoice.id,      // The purchase_orders table ID is poId
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
      onSuccess?.(result);
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      errorToast(error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  const outstanding = parseFloat(invoice.outstanding || invoice.total_amount || 0);
  const alreadyPaid = parseFloat(invoice.already_paid || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Process Payment" size="2xl">
      <div className="space-y-6">
        {/* Invoice Summary Section */}
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Invoice Summary</h3>
            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-md">READ ONLY</span>
          </div>
          <div className="border-t border-blue-100 pt-3"></div>
          <div className="grid grid-cols-2 gap-5 text-xs">
            <div>
              <span className="text-slate-500 text-xs font-medium">Invoice No</span>
              <p className="font-bold text-slate-900 mt-2 text-sm">{invoice.po_number || 'N/A'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs font-medium">Supplier</span>
              <p className="font-bold text-slate-900 mt-2 text-sm">{invoice.vendor_name || 'N/A'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs font-medium">Invoice Date</span>
              <p className="font-bold text-slate-900 mt-2 text-sm">{formatDate(invoice.created_at)}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs font-medium">Invoice Amount</span>
              <p className="font-bold text-slate-900 mt-2 text-sm">{formatCurrency(invoice.total_amount)}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs font-medium">Already Paid</span>
              <p className="font-bold text-emerald-600 mt-2 text-sm">{formatCurrency(alreadyPaid)}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs font-medium">Outstanding</span>
              <p className="font-bold text-rose-600 mt-2 text-sm">{formatCurrency(outstanding)}</p>
            </div>
          </div>
        </div>

        {/* Payment Entry Form */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Payment Details</h3>
          <div className="border-b border-slate-200"></div>

          {/* Payment Amount */}
          <FormControl label="Payment Amount *">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.paymentAmount}
                onChange={(e) => handleInputChange('paymentAmount', e.target.value)}
                className={`w-full pl-7 pr-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.paymentAmount ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                placeholder={`Max: ${formatCurrency(outstanding)}`}
              />
            </div>
            {errors.paymentAmount && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.paymentAmount}</span>}
          </FormControl>

          {/* Payment Date */}
          <FormControl label="Payment Date *">
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => handleInputChange('paymentDate', e.target.value)}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.paymentDate ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
            />
            {errors.paymentDate && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.paymentDate}</span>}
          </FormControl>

          {/* Payment Mode */}
          <FormControl label="Payment Mode *">
            <select
              value={formData.paymentMode}
              onChange={(e) => handleInputChange('paymentMode', e.target.value)}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none bg-white bg-no-repeat bg-right pr-10 cursor-pointer ${errors.paymentMode ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
              style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center'}}
            >
              <option value="">Select Payment Mode</option>
              {paymentModes.map(mode => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
            {errors.paymentMode && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.paymentMode}</span>}
          </FormControl>

          {/* Bank Transfer Fields */}
          {formData.paymentMode === 'BANK_TRANSFER' && (
            <>
              <FormControl label="Bank Account *">
                <select
                  value={formData.bankAccount}
                  onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none bg-white bg-no-repeat bg-right pr-10 cursor-pointer ${errors.bankAccount ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center'}}
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map(account => (
                    <option key={account.id} value={account.id}>{account.bank_name} - {account.account_number}</option>
                  ))}
                </select>
                {errors.bankAccount && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.bankAccount}</span>}
              </FormControl>
            </>
          )}

          {/* UPI Fields */}
          {formData.paymentMode === 'UPI' && (
            <>
              <FormControl label="UPI App *">
                <select
                  value={formData.upiApp}
                  onChange={(e) => handleInputChange('upiApp', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none bg-white bg-no-repeat bg-right pr-10 cursor-pointer ${errors.upiApp ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center'}}
                >
                  <option value="">Select UPI App</option>
                  {upiApps.map(app => (
                    <option key={app.value} value={app.value}>{app.label}</option>
                  ))}
                </select>
                {errors.upiApp && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.upiApp}</span>}
              </FormControl>
              <FormControl label="UPI Transaction ID *">
                <input
                  type="text"
                  value={formData.upiTransactionId}
                  onChange={(e) => handleInputChange('upiTransactionId', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.upiTransactionId ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="Enter UPI transaction ID"
                />
                {errors.upiTransactionId && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.upiTransactionId}</span>}
              </FormControl>
            </>
          )}

          {/* Cheque Fields */}
          {formData.paymentMode === 'CHEQUE' && (
            <>
              <FormControl label="Cheque Number *">
                <input
                  type="text"
                  value={formData.chequeNumber}
                  onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.chequeNumber ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="Enter cheque number"
                />
                {errors.chequeNumber && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.chequeNumber}</span>}
              </FormControl>
              <FormControl label="Bank Name *">
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.bankName ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="Enter bank name"
                />
                {errors.bankName && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.bankName}</span>}
              </FormControl>
              <FormControl label="Cheque Date *">
                <input
                  type="date"
                  value={formData.chequeDate}
                  onChange={(e) => handleInputChange('chequeDate', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.chequeDate ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                />
                {errors.chequeDate && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.chequeDate}</span>}
              </FormControl>
            </>
          )}

          {/* Card Fields */}
          {(formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') && (
            <>
              <FormControl label="Card Type *">
                <select
                  value={formData.cardType}
                  onChange={(e) => handleInputChange('cardType', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all appearance-none bg-white bg-no-repeat bg-right pr-10 cursor-pointer ${errors.cardType ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.75rem center'}}
                >
                  <option value="">Select Card Type</option>
                  {cardTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {errors.cardType && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.cardType}</span>}
              </FormControl>
              <FormControl label="Last 4 Digits *">
                <input
                  type="text"
                  maxLength="4"
                  value={formData.last4Digits}
                  onChange={(e) => handleInputChange('last4Digits', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all tracking-widest ${errors.last4Digits ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="****"
                />
                {errors.last4Digits && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.last4Digits}</span>}
              </FormControl>
              <FormControl label="Authorization Code *">
                <input
                  type="text"
                  value={formData.authorizationCode}
                  onChange={(e) => handleInputChange('authorizationCode', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.authorizationCode ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                  placeholder="Enter authorization code"
                />
                {errors.authorizationCode && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.authorizationCode}</span>}
              </FormControl>
            </>
          )}

          {/* Transaction Ref No (for Bank Transfer and Card) */}
          {(formData.paymentMode === 'BANK_TRANSFER' || formData.paymentMode === 'CREDIT_CARD' || formData.paymentMode === 'DEBIT_CARD') && (
            <FormControl label="Transaction Ref No *">
              <input
                type="text"
                value={formData.transactionRefNo}
                onChange={(e) => handleInputChange('transactionRefNo', e.target.value)}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${errors.transactionRefNo ? 'border-rose-500 focus:ring-rose-500/30 bg-rose-50' : 'border-slate-300 focus:ring-blue-500/30 focus:border-blue-500'}`}
                placeholder="Enter transaction reference number"
              />
              {errors.transactionRefNo && <span className="text-xs text-rose-600 font-medium mt-1 block">{errors.transactionRefNo}</span>}
            </FormControl>
          )}

          {/* Remarks */}
          <FormControl label="Remarks">
            <textarea
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none transition-all"
              rows="3"
              placeholder="Additional payment remarks..."
            />
          </FormControl>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wide shadow-sm hover:shadow-md"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            )}
            Confirm Payment
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ProcessPaymentModal;
