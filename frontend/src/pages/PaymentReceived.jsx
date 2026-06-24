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
          sales_order_id: row.id,
          sales_order_source: row.source,
          po_number: row.so_number,
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
    setEmailModalData({
      to: row.customer_email || '',
      subject: `Invoice: ${row.so_number}`,
      message: `Dear ${row.company_name},\n\nPlease find attached the invoice for your order ${row.so_number}.\n\nRegards,\nSPTECHPIONEER Accounts Team`,
      id: row.id,
      so_number: row.so_number,
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
      const endpoint = row.source === 'SALES_ORDER' 
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
      const fileName = `Invoice_${row.so_number || row.id}.pdf`;
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
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete this invoice (${row.so_number || `ID: ${row.id}`})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const endpoint = row.source === 'SALES_ORDER'
          ? `${API_BASE}/sales-orders/${row.id}`
          : `${API_BASE}/order/${row.id}`;

        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast('Invoice has been deleted');
          fetchOutstandingInvoices();
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to delete invoice');
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
      label: 'Order Details',
      key: 'so_number',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className=" text-rose-600 font-semibold ">
            {val}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 ">
              {row.source === 'SALES_ORDER' ? 'DESIGN BASED' : 'DIRECT ORDER'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Customer',
      key: 'company_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600  text-xs shadow-sm">
            {val ? val.substring(0, 2).toUpperCase() : 'C'}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">{val}</span>
            <span className="text-[10px] text-slate-500 italic">
              Project: {row.project_name || 'N/A'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Order Date',
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
      label: 'Invoice Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => (
        <span className="text-slate-900 font-medium">{formatCurrency(val)}</span>
      )
    },
    {
      label: 'Received Amount',
      key: 'paid_amount',
      sortable: true,
      render: (val) => (
        <span className="text-emerald-600 font-medium">{formatCurrency(val)}</span>
      )
    },
    {
      label: 'Outstanding Amount',
      key: 'outstanding',
      sortable: true,
      render: (val) => (
        <span className="text-rose-600 font-semibold">{formatCurrency(val)}</span>
      )
    },
    {
      label: 'Payment %',
      key: 'paid_amount',
      sortable: true,
      render: (_, row) => {
        const total = parseFloat(row.total_amount) || 0;
        const paid = parseFloat(row.paid_amount) || 0;
        const percentage = total > 0 ? Math.round((paid / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <span className="text-slate-600 font-medium">{percentage}%</span>
          </div>
        );
      }
    },
    {
      label: 'Status',
      key: 'outstanding',
      sortable: true,
      render: (_, row) => {
        const outstanding = parseFloat(row.outstanding) || 0;
        const received = parseFloat(row.paid_amount) || 0;
        if (outstanding === 0) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              COMPLETED
            </span>
          );
        } else if (outstanding > 0 && received > 0) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 font-medium border border-amber-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Partial Paid
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-rose-50 text-rose-700 font-medium border border-rose-100">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Pending Payment
            </span>
          );
        }
      }
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
          {parseFloat(row.outstanding) > 0 && (
            <button
              onClick={() => navigate(`/payment-received/record?id=${row.id}`)}
              className="p-2 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 group shadow-sm"
              title="Record Payment"
            >
              <CreditCard className="w-4 h-4 group-hover:scale-110" />
            </button>
          )}
          <button
            onClick={() => handleDeleteInvoice(row)}
            className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="Delete Invoice"
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
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchOutstandingInvoices}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
            title="Refresh Data"
          />
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
          searchPlaceholder="Search by order number or customer..."
          className="border-none"
        />
      </div>

      <PaymentReceivedModal
        isOpen={isPaymentModalOpen}
        onClose={() => navigate('/accounts/payment-received')}
        invoice={selectedInvoice}
        onSuccess={() => fetchOutstandingInvoices()}
      />

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => navigate('/accounts/payment-received')}
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
