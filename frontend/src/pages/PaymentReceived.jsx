import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, RefreshCw, Plus, Calendar, CreditCard, User, FileText } from 'lucide-react';
import { DataTable, Button } from '../components/ui.jsx';
import PaymentReceivedModal from '../components/PaymentReceivedModal.jsx';
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

const PaymentReceived = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // URL Synchronization
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    const id = searchParams.get('id');

    if (segments.includes('add')) {
      setSelectedInvoice(null);
      setIsPaymentModalOpen(true);
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
      }
    } else if (!path.includes('/add') && !path.includes('/record')) {
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
    }
  }, [location.pathname, searchParams, payments]);

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

  const columns = [
    {
      label: 'Order Details',
      key: 'so_number',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className=" text-rose-600  ">
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
      label: 'Outstanding',
      key: 'outstanding',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1  text-slate-900">
            <span className="text-rose-600">₹</span>
            <span>{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
            Awaiting Collection
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
            onClick={() => navigate(`/payment-received/record?id=${row.id}`)}
            className="p-2 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 group shadow-sm"
            title="Record Payment"
          >
            <CreditCard className="w-4 h-4 group-hover:scale-110" />
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
            <h1 className="text-xl   text-slate-900 ">Payments Received</h1>
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
            onClick={() => navigate('/payment-received/add')}
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
        onClose={() => navigate('/payment-received')}
        invoice={selectedInvoice}
        onSuccess={() => fetchOutstandingInvoices()}
      />
    </div>
  );
};

export default PaymentReceived;
