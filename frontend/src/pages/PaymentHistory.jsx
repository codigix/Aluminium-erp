import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { History, RefreshCw, Download, Send, Calendar, CheckCircle, FileText } from 'lucide-react';
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

const PaymentHistory = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [emailData, setEmailData] = useState(null);

  // URL Synchronization
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    const id = searchParams.get('id');

    if (segments.includes('email') && id && history.length > 0) {
      const payment = history.find(p => p.id === parseInt(id));
      if (payment) {
        openEmailModal(payment);
      }
    } else if (!path.includes('/email')) {
      setShowEmailModal(false);
      setSelectedPayment(null);
      setEmailData(null);
    }
  }, [location.pathname, searchParams, history]);

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments?status=CONFIRMED`, {
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

  const downloadReceipt = async (paymentId, voucherNo) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments/${paymentId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to download receipt');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Voucher-${voucherNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      errorToast('Failed to download receipt');
    }
  };

  const handleDownloadInvoice = async (row) => {
    try {
      const token = localStorage.getItem('authToken');
      const targetId = row.po_id || row.job_card_quality_log_id;
      const targetType = row.po_id ? 'PURCHASE_ORDER' : 'SUBCONTRACTING';

      if (!targetId) {
        errorToast('Invoice reference ID not found');
        return;
      }

      const endpoint = `${API_BASE}/payments/vendor-invoice/${targetId}/pdf?type=${targetType}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to download invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Invoice_${row.po_number || targetId}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      errorToast('Failed to download invoice');
    }
  };

  const openEmailModal = (payment) => {
    if (!location.pathname.includes('/email')) {
      navigate(`/payment-history/email?id=${payment.id}`);
      return;
    }

    setSelectedPayment(payment);
    setEmailData({
      to: payment.vendor_email || '',
      subject: `Payment Receipt: ${payment.payment_voucher_no}`,
      message: `Dear ${payment.vendor_name || 'Vendor'},\n\nPlease find attached the payment receipt ${payment.payment_voucher_no} for the payment made on ${new Date(payment.payment_date).toLocaleDateString()}.\n\nAmount Paid: INR ${parseFloat(payment.payment_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nRegards,\nAccounts Department\nSPTECHPIONEER PVT LTD`,
      attachPDF: true
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async (data) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments/${selectedPayment.id}/send-email`, {
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

      successToast('Payment voucher sent to vendor email');
      navigate('/accounts/payment-history');
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
      throw error;
    }
  };

  const columns = [
    {
      label: 'Payment Details',
      key: 'payment_voucher_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className=" text-rose-600  font-mono ">
            {val}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 ">
              PO: {row.po_number}
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
      label: 'Amount Paid',
      key: 'payment_amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1  text-slate-900">
            <span className="text-rose-600">₹</span>
            <span>{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
            Successful Transaction
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
            {val || 'COMPLETED'}
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
          {(row.po_id || row.job_card_quality_log_id) && (
            <button
              onClick={() => handleDownloadInvoice(row)}
              className="p-2 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100 group shadow-sm"
              title="Download Invoice Copy"
            >
              <FileText className="w-4 h-4 group-hover:scale-110" />
            </button>
          )}
        </div>
      )
    }
  ];

  const totalPayments = history.length;
  const totalValue = history.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <History size={15} />
          </div>
          <div>
            <h1 className="text-xl  text-slate-900 ">Vendor Payment History</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs  text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                {totalPayments} Transactions
              </span>
              <span className="text-xs  text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-emerald-500" />
                {formatCurrency(totalValue)} Total Paid
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
          searchPlaceholder="Search by voucher, PO or supplier..."
          className="border-none"
        />
      </div>

      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => navigate('/accounts/payment-history')}
        onSend={handleSendEmail}
        data={emailData}
        title="Send Receipt to Vendor"
        subTitle={`${selectedPayment?.payment_voucher_no} • ${selectedPayment?.vendor_name}`}
        attachmentName={`Voucher-${selectedPayment?.payment_voucher_no}.pdf`}
      />
    </div>
  );
};

export default PaymentHistory;
