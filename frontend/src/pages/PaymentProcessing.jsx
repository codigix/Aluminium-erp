import React, { useState, useEffect } from 'react';
import { DataTable } from '../components/ui.jsx';
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

const PaymentProcessing = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      // For now, fetching POs with invoices that might need payment
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      // Filter for POs with invoices that are Sent  or SUBMITTED (placeholder logic)
      const pendingPayments = Array.isArray(data) ? data.filter(po => po.invoice_url && po.status !== 'PAID') : [];
      setPayments(pendingPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      errorToast('Failed to fetch payment data');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      label: 'PO Number',
      key: 'po_number',
      sortable: true,
      className: ' text-blue-600'
    },
    {
      label: 'Supplier',
      key: 'vendor_name',
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
      key: 'total_amount',
      sortable: true,
      render: (val) => formatCurrency(val)
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <span className="px-2 py-1 rounded text-xs   bg-amber-50 text-amber-700 border border-amber-100 ">
          {val === 'Sent ' ? 'PENDING PAYMENT' : val}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => window.open(`${API_BASE}/${row.invoice_url}`, '_blank')}
            className="flex items-center gap-1 p-2 .5 bg-slate-50 text-slate-700 rounded  text-xs  hover:bg-slate-100 transition-all border border-slate-100"
          >
            Review
          </button>
          <button
            className="flex items-center gap-1 p-2 .5 bg-blue-600 text-white rounded  text-xs  hover:bg-blue-700 transition-all "
          >
            Process Payment
          </button>
        </div>
      )
    }
  ];

  const filteredData = payments.filter(po => 
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Processing</h1>
          <p className="text-xs text-slate-500  mt-1">Process pending vendor payments</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded  text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all w-64 "
            />
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button 
            onClick={fetchPendingPayments}
            className="p-2 bg-white border border-slate-200 rounded  text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all "
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded  border border-slate-200  overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          hideHeader={true}
          emptyMessage="No pending payments found."
        />
      </div>
    </div>
  );
};

export default PaymentProcessing;
