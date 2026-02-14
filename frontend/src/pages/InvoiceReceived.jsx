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

const VendorInvoices = () => {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch POs');
      const data = await response.json();
      const invoicePOs = Array.isArray(data) ? data.filter(po => po.invoice_url) : [];
      setPos(invoicePOs);
    } catch (error) {
      console.error('Error fetching POs:', error);
      errorToast('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      label: 'PO Number',
      key: 'po_number',
      sortable: true,
      className: 'font-bold text-blue-600'
    },
    {
      label: 'Supplier',
      key: 'vendor_name',
      sortable: true
    },
    {
      label: 'Date',
      key: 'created_at',
      sortable: true,
      render: (val) => formatDate(val)
    },
    {
      label: 'Amount',
      key: 'total_amount',
      sortable: true,
      render: (val) => formatCurrency(val)
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => (
        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
          {val}
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
            onClick={() => window.open(`${API_BASE}/${row.invoice_url}`, '_blank')}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Invoice
          </button>
        </div>
      )
    }
  ];

  const filteredData = pos.filter(po => 
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Vendor Invoices</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage and view vendor invoices</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all w-64 shadow-sm"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button 
            onClick={fetchPOs}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          hideHeader={true}
          emptyMessage="No vendor invoices found."
        />
      </div>
    </div>
  );
};

export default VendorInvoices;
