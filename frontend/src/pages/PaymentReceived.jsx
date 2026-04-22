import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable } from '../components/ui.jsx';
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
      label: 'Sales Order',
      key: 'so_number',
      sortable: true,
      className: ' text-emerald-600'
    },
    {
      label: 'Customer',
      key: 'company_name',
      sortable: true
    },
    {
      label: 'Invoice Date',
      key: 'created_at',
      sortable: true,
      render: (val) => formatDate(val)
    },
    {
      label: 'Amount Due',
      key: 'outstanding',
      sortable: true,
      render: (val) => formatCurrency(val)
    },
    {
      label: 'Status',
      key: 'source',
      render: (val) => (
        <span className="px-2 py-1 rounded text-xs  bg-amber-50 text-amber-700 border border-amber-100 ">
          {val === 'SALES_ORDER' ? 'DESIGN BASED' : 'DIRECT ORDER'}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              navigate(`/payment-received/record?id=${row.id}`);
            }}
            className="flex items-center gap-1 p-1.5 bg-emerald-600 text-white rounded  text-xs  hover:bg-emerald-700 transition-all shadow-sm"
          >
            Record Payment
          </button>
        </div>
      )
    }
  ];

  const filteredData = payments.filter(so => 
    so.so_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    so.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePaymentSuccess = async (result) => {
    fetchOutstandingInvoices();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl  text-slate-900 ">Payment Received</h1>
          <p className="text-xs text-slate-500 mt-1">Record customer payments and monitor receivables</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded text-xs focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all w-64 shadow-sm"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button 
            onClick={fetchOutstandingInvoices}
            className="p-2 bg-white border border-slate-200 rounded  text-slate-500 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button 
            onClick={() => {
              navigate('/payment-received/add');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-xs  hover:bg-emerald-700 transition-all "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Payment Received
          </button>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          hideHeader={true}
          emptyMessage="No outstanding invoices found."
        />
      </div>

      <PaymentReceivedModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          navigate('/payment-received');
        }}
        invoice={selectedInvoice}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default PaymentReceived;
