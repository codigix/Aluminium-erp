import { useState, useEffect } from 'react';
import { Card, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalBalance: 0,
    lowStock: 0
  });

  useEffect(() => {
    fetchStockBalance();
  }, []);

  const fetchStockBalance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch Stock Balance');
      const data = await response.json();
      setBalances(Array.isArray(data) ? data : []);

      const totalBalance = data.reduce((sum, item) => sum + (parseFloat(item.current_balance) || 0), 0);
      const lowStock = data.filter(item => (parseFloat(item.current_balance) || 0) < 10).length;

      setStats({
        totalItems: data.length,
        totalBalance,
        lowStock
      });
    } catch (error) {
      console.error('Error fetching stock balance:', error);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will remove the item from stock balance! (Ledger history remains)",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/stock/balance/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to delete stock balance');

        successToast('Stock balance has been removed');
        fetchStockBalance();
      } catch (error) {
        errorToast(error.message || 'Failed to delete balance');
      }
    }
  };

  const columns = [
    {
      label: 'Item Code',
      key: 'item_code',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    {
      label: 'Material Name',
      key: 'material_name',
      sortable: true,
      render: (val) => <span className="text-slate-600 font-medium">{val || '—'}</span>
    },
    {
      label: 'Material Type',
      key: 'material_type',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs">{val || '—'}</span>
    },
    {
      label: 'Current Balance',
      key: 'current_balance',
      sortable: true,
      className: 'text-right',
      render: (val) => {
        const statusColor = getStatusColor(val);
        return (
          <div className="flex items-center justify-end gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColor.indicator}`}></span>
            <span className={`font-mono  text-sm ${statusColor.text}`}>
              {parseFloat(val || 0).toFixed(3)}
            </span>
          </div>
        );
      }
    },
    {
      label: 'Unit',
      key: 'unit',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs font-medium">{val || 'NOS'}</span>
    },
    {
      label: 'Last Updated',
      key: 'last_updated',
      sortable: true,
      render: (val) => <span className="text-slate-400 text-xs">{new Date(val).toLocaleDateString()}</span>
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, item) => (
        <button
          onClick={() => handleDelete(item.id)}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
          title="Remove from Balance"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-3">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-indigo-600    mb-1">Total Items</p>
              <p className="text-2xl  text-indigo-900">{stats.totalItems}</p>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-600    mb-1">Total Balance</p>
              <p className="text-2xl  text-emerald-900">{parseFloat(stats.totalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-rose-600    mb-1">Low Stock Items</p>
              <p className="text-2xl  text-rose-900">{stats.lowStock}</p>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={balances}
        loading={loading}
        searchPlaceholder="Search by item code or description..."
        emptyMessage="No stock items found"
      />
    </div>
  );
};

export default StockBalance;

