import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, RefreshCw, Plus, Calendar, CreditCard, User, FileText, Download, Trash2, Send } from 'lucide-react';
import { DataTable, Button } from '../components/ui.jsx';
import PaymentReceivedModal from '../components/PaymentReceivedModal.jsx';
import SendEmailModal from '../components/SendEmailModal.jsx';
import { errorToast, successToast } from '../utils/toast';
import Swal from 'sweetalert2';

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

const PaymentReceived = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalData, setEmailModalData] = useState(null);

  // URL Synchronization
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    const id = searchParams.get('id');

    if (segments.includes('add')) {
      setSelectedInvoice(null);
      setIsPaymentModalOpen(true);
      setIsEmailModalOpen(false);
    } else if (segments.includes('record') && id && payments.length > 0) {
      const row = payments.find(p => p.id === parseInt(id));
      if (row) {
        setSelectedInvoice({
          ...row,
          customer_id: row.company_id,
          customer_name: row.company_name,
          sales_order_id: row.source === 'SALES_INVOICE' ? (row.sales_order_id || row.order_id) : row.id,
          invoice_id: row.invoice_id || (row.source === 'SALES_INVOICE' ? row.id : null),
          sales_order_source: row.source,
          po_number: row.invoice_no || row.so_number,
          outstanding: row.outstanding,
          already_paid: row.paid_amount,
          total_amount: row.total_amount
        });
        setIsPaymentModalOpen(true);
        setIsEmailModalOpen(false);
      }
    } else if (segments.includes('email') && id && payments.length > 0) {
      const row = payments.find(p => p.id === parseInt(id));
      if (row) {
        handleSendEmailClick(row);
        setIsPaymentModalOpen(false);
      }
    } else if (!path.includes('/add') && !path.includes('/record') && !path.includes('/email')) {
      setIsPaymentModalOpen(false);
      setIsEmailModalOpen(false);
      setSelectedInvoice(null);
      setEmailModalData(null);
    }
  }, [location.pathname, searchParams, payments]);

  const handleSendEmailClick = (row) => {
    const docRef = row.invoice_no || row.so_number;
    setEmailModalData({
      to: row.customer_email || '',
      subject: `Invoice: ${docRef}`,
      message: `Dear ${row.company_name},\n\nPlease find attached the invoice ${docRef}.\n\nRegards,\nSPTECHPIONEER Accounts Team`,
      id: row.id,
      so_number: docRef,
      company_name: row.company_name,
      source: row.source
    });
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async (emailData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/invoice/${emailModalData.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          attachPDF: emailData.attachPDF,
          source: emailModalData.source,
          customAttachments: emailData.customAttachments
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send email');
      }

      successToast('Invoice sent successfully');
      setIsEmailModalOpen(false);
      setEmailModalData(null);
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
    }
  };

  useEffect(() => {
    fetchOutstandingInvoices();
  }, []);

  const fetchOutstandingInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-payments/outstanding`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      errorToast('Failed to fetch invoice data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (row) => {
    try {
      const token = localStorage.getItem('authToken');
      const endpoint = row.source === 'SALES_INVOICE'
        ? `${API_BASE}/sales-invoices/${row.id}/pdf`
        : row.source === 'SALES_ORDER' 
        ? `${API_BASE}/sales-orders/${row.id}/pdf` 
        : `${API_BASE}/order/${row.id}/pdf`;

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Invoice_${row.invoice_no || row.so_number || row.id}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      errorToast('Failed to download invoice');
    }
  };

  const handleDeleteInvoice = async (row) => {
    const docRef = row.invoice_no || row.so_number || `ID: ${row.id}`;
    const result = await Swal.fire({
      title: 'Remove from Customer Invoices?',
      text: `Invoice ${docRef} will be removed from Customer Invoices and reverted to Sales as 'Created'. It will NOT be deleted from the Sales Invoice page.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Remove Entry',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        let endpoint = '';
        let method = 'POST';

        if (row.source === 'SALES_INVOICE' || !row.source) {
          endpoint = `${API_BASE}/sales-invoices/${row.id}/revert-from-accounts`;
          method = 'POST';
        } else if (row.source === 'SALES_ORDER') {
          endpoint = `${API_BASE}/sales-orders/${row.id}`;
          method = 'DELETE';
        } else {
          endpoint = `${API_BASE}/order/${row.id}`;
          method = 'DELETE';
        }

        const response = await fetch(endpoint, {
          method,
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          successToast('Invoice entry removed from Customer Invoices and reverted to Sales');
          fetchOutstandingInvoices();
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to remove invoice');
        }
      } catch (err) {
        errorToast(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const columns = [
    {
      label: 'Invoice #',
      key: 'invoice_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-indigo-700 text-xs">
              {row.invoice_no || val || row.so_number}
            </span>
            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              INVOICE
            </span>
          </div>
          {row.so_number && (
            <span className="text-[11px] text-slate-500 font-mono mt-0.5">
              SO: {row.so_number}
            </span>
          )}
        </div>
      )
    },
    {
      label: 'Customer',
      key: 'company_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2.5 py-1">
          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs shadow-sm shrink-0">
            {val ? val.substring(0, 2).toUpperCase() : 'C'}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">{val}</span>
            {row.customer_po_no ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  PO
                </span>
                <span className="text-[11px] font-mono font-semibold text-indigo-700">
                  {row.customer_po_no}
                </span>
              </div>
            ) : null}
            <span className="text-[10px] text-slate-500 italic mt-0.5">
              Project: {row.project_name || 'N/A'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Date',
      key: 'created_at',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs">{formatDate(row.invoice_date || row.created_at)}</span>
        </div>
      )
    },
    {
      label: 'Invoice Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <span className="text-slate-900 font-medium">{formatCurrency(val)}</span>
      )
    },

    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={() => navigate(`/accounts/payment-received/email?id=${row.id}`)}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="Send Invoice Email"
          >
            <Send className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button
            onClick={() => handleDownloadInvoice(row)}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="Download Invoice"
          >
            <Download className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button
            onClick={() => handleDeleteInvoice(row)}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm cursor-pointer"
            title="Remove from Accounts & Revert to Sales"
          >
            <Trash2 className="w-4 h-4 group-hover:scale-110" />
          </button>
        </div>
      )
    }
  ];

  const totalOutstanding = payments.length;
  const totalValue = payments.reduce((sum, p) => sum + (parseFloat(p.outstanding) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-xl   text-slate-900 ">Customer Invoices</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs  text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                {totalOutstanding} Pending Collections
              </span>
              <span className="text-xs  text-rose-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded bg-rose-500" />
                {formatCurrency(totalValue)} Total Receivables
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchOutstandingInvoices}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 shadow-2xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Button
            variant="primary"
            onClick={() => navigate('/accounts/payment-received/add')}
            icon={Plus}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Add Payment
          </Button>
        </div>
      </div>

      <div className="overflow-hidden my-4">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          searchPlaceholder="Search by invoice #, SO #, PO #, or customer..."
          customFilter={(row, term) => 
            (row.invoice_no && row.invoice_no.toLowerCase().includes(term)) ||
            (row.so_number && row.so_number.toLowerCase().includes(term)) ||
            (row.customer_po_no && row.customer_po_no.toLowerCase().includes(term)) ||
            (row.company_name && row.company_name.toLowerCase().includes(term)) ||
            (row.project_name && row.project_name.toLowerCase().includes(term))
          }
          className="border-none"
        />
      </div>

      <PaymentReceivedModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          if (location.pathname !== '/accounts/payment-received' || searchParams.toString()) {
            navigate('/accounts/payment-received');
          }
        }}
        invoice={selectedInvoice}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          setSelectedInvoice(null);
          fetchOutstandingInvoices();
          if (location.pathname !== '/accounts/payment-received' || searchParams.toString()) {
            navigate('/accounts/payment-received');
          }
        }}
      />

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setEmailModalData(null);
          if (location.pathname !== '/accounts/payment-received' || searchParams.toString()) {
            navigate('/accounts/payment-received');
          }
        }}
        data={emailModalData}
        onSend={handleSendEmail}
        title="Send Invoice to Customer"
        subTitle={`${emailModalData?.so_number} • ${emailModalData?.company_name}`}
        attachmentName={`Invoice-${emailModalData?.so_number}.pdf`}
      />
    </div>
  );
};

export default PaymentReceived;
