import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, RefreshCw, Eye, FileText, Send, Calendar, Clock, CreditCard } from 'lucide-react';
import { DataTable, Button } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import ProcessPaymentModal from '../components/ProcessPaymentModal.jsx';
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

const PaymentProcessing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [emailModalData, setEmailModalData] = useState(null);
  const [processingInvoiceId, setProcessingInvoiceId] = useState(null);

  // URL Synchronization
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    const id = searchParams.get('id');

    if (id && payments.length > 0) {
      const row = payments.find(p => p.id === parseInt(id));
      if (row) {
        if (segments.includes('record')) {
          setSelectedInvoice({
            id: row.id,
            po_number: row.po_number,
            vendor_name: row.vendor_name,
            vendor_id: row.vendor_id,
            total_amount: row.total_amount,
            outstanding: row.total_amount,
            already_paid: 0,
            created_at: row.created_at
          });
          setIsPaymentModalOpen(true);
          setIsEmailModalOpen(false);
        } else if (segments.includes('email')) {
          handleSendEmailClick(row);
          setIsPaymentModalOpen(false);
        }
      }
    } else if (!path.includes('/record') && !path.includes('/email')) {
      setIsPaymentModalOpen(false);
      setIsEmailModalOpen(false);
      setSelectedInvoice(null);
      setEmailModalData(null);
    }
  }, [location.pathname, searchParams, payments]);

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      const pendingPayments = Array.isArray(data) ? data.filter(po => po.invoice_url && po.status !== 'PAID') : [];
      setPayments(pendingPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      errorToast('Failed to fetch payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailClick = (row) => {
    setEmailModalData({
      to: row.vendor_email || '',
      subject: `Payment Receipt: ${row.po_number}`,
      message: `Dear ${row.vendor_name},\n\nPlease find attached the payment receipt for ${row.po_number}.\n\nRegards,\nSPTECHPIONEER Accounts Team`,
      po_id: row.id,
      po_number: row.po_number,
      vendor_name: row.vendor_name
    });
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async (emailData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${emailModalData.po_id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          attachPDF: emailData.attachPDF
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send email');
      }

      successToast('Vendor invoice sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
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
      label: 'Invoice Date',
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
      label: 'Amount Due',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1  text-slate-900">
            <span className="text-rose-600">₹</span>
            <span>{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
            Awaiting Payment
          </span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <div className="flex items-center justify-center">
          <span className={`px-2 py-0.5 rounded text-[10px]  border bg-amber-50 text-amber-700 border-amber-100`}>
            {val === 'Sent ' ? 'PENDING' : val}
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
            onClick={() => handleSendEmailClick(row)}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="Send Receipt to Vendor"
          >
            <Send className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button
            onClick={() => window.open(`${API_BASE}/${row.invoice_url}`, '_blank')}
            className="p-2 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 group shadow-sm"
            title="Review Invoice"
          >
            <FileText className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button
            onClick={() => {
              setSelectedInvoice(row);
              setIsPaymentModalOpen(true);
            }}
            className="p-2 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 group shadow-sm"
            title="Process Payment"
          >
            <CreditCard className="w-4 h-4 group-hover:scale-110" />
          </button>
        </div>
      )
    }
  ];

  const totalPayments = payments.length;
  const totalValue = payments.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <Clock size={24} />
          </div>
          <div>
            <h1 className="text-xl   text-slate-900 ">Payment Processing</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs  text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                {totalPayments} Pending Payments
              </span>
              <span className="text-xs  text-rose-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-rose-500" />
                {formatCurrency(totalValue)} Total Outstanding
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchPendingPayments}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
            title="Refresh Data"
          />
        </div>
      </div>

      <div className="overflow-hidden my-4">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          searchPlaceholder="Search payments by PO number or supplier..."
          className="border-none"
        />
      </div>

      <ProcessPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        onSuccess={() => fetchPendingPayments()}
      />

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setEmailModalData(null);
        }}
        data={emailModalData}
        onSend={handleSendEmail}
        title="Send Receipt to Vendor"
        subTitle={`${emailModalData?.po_number} • ${emailModalData?.vendor_name}`}
        attachmentName={`Receipt-${emailModalData?.po_number}.pdf`}
      />
    </div>
  );
};

export default PaymentProcessing;
