import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Download, Send, Calendar, User, FileText } from 'lucide-react';
import { DataTable, Button } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import SendEmailModal from '../components/SendEmailModal.jsx';

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

const CustomerPaymentHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [emailData, setEmailData] = useState({ to: '', subject: '', message: '' });

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments?status=CONFIRMED`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch payment history');
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching history:', error);
      errorToast('Failed to fetch payment history');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async (paymentId, receiptNo) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/${paymentId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to download receipt');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${receiptNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      errorToast('Failed to download receipt');
    }
  };

  const openEmailModal = (payment) => {
    setSelectedPayment(payment);
    setEmailData({
      to: payment.customer_email || '',
      subject: `Payment Receipt: ${payment.payment_receipt_no}`,
      message: `Dear ${payment.customer_name || 'Customer'},\n\nThank you for your payment. Please find attached the payment receipt ${payment.payment_receipt_no} for the amount received on ${new Date(payment.payment_date).toLocaleDateString()}.\n\nAmount Received: INR ${parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nRegards,\nAccounts Department\nSPTECHPIONEER PVT LTD`,
      attachPDF: true
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async (data) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/${selectedPayment.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to send email');
      }

      successToast('Payment receipt sent to customer email');
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
      throw error;
    }
  };

  const columns = [
    {
      label: 'Receipt Details',
      key: 'payment_receipt_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className=" text-rose-600  font-mono ">
            {val}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 ">
              SO: {row.so_number}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Customer',
      key: 'customer_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600  text-xs shadow-sm">
            {val ? val.substring(0, 2).toUpperCase() : 'C'}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">{val}</span>
            <span className="text-[10px] text-slate-500 italic">
              Mode: {row.payment_mode || 'N/A'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Payment Date',
      key: 'payment_date',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs">{formatDate(val)}</span>
        </div>
      )
    },
    {
      label: 'Amount Received',
      key: 'payment_amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1  text-slate-900">
            <span className="text-rose-600">₹</span>
            <span>{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
            Payment Confirmed
          </span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <div className="flex items-center justify-center">
          <span className={`px-2 py-0.5 rounded text-[10px]  border bg-emerald-50 text-emerald-700 border-emerald-100`}>
            {val || 'CONFIRMED'}
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
            onClick={() => openEmailModal(row)}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="Send Receipt to Customer"
          >
            <Send className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button
            onClick={() => downloadReceipt(row.id, row.payment_receipt_no)}
            className="p-2 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 group shadow-sm"
            title="Download PDF"
          >
            <Download className="w-4 h-4 group-hover:scale-110" />
          </button>
        </div>
      )
    }
  ];

  const totalTransactions = history.length;
  const totalReceived = history.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-xl   text-slate-900 ">Client Payment History</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs  text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                {totalTransactions} Transactions
              </span>
              <span className="text-xs  text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-emerald-500" />
                {formatCurrency(totalReceived)} Total Collected
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchPaymentHistory}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
            title="Refresh Data"
          />
        </div>
      </div>

      <div className="overflow-hidden my-4">
        <DataTable
          columns={columns}
          data={history}
          loading={loading}
          searchPlaceholder="Search by receipt, SO or customer..."
          className="border-none"
        />
      </div>

      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleSendEmail}
        data={emailData}
        title="Send Receipt to Customer"
        subTitle={`${selectedPayment?.payment_receipt_no} • ${selectedPayment?.customer_name}`}
        attachmentName={`Receipt-${selectedPayment?.payment_receipt_no}.pdf`}
      />
    </div>
  );
};

export default CustomerPaymentHistory;
