import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [filteredBalances, setFilteredBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalItems: 0,
    totalBalance: 0,
    lowStock: 0
  });

  useEffect(() => {
    fetchStockBalance();
  }, []);

  const filterBalances = useCallback(() => {
    if (!searchTerm) {
      setFilteredBalances(balances);
      return;
    }

    const filtered = balances.filter(item =>
      item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBalances(filtered);
  }, [balances, searchTerm]);

  useEffect(() => {
    filterBalances();
  }, [balances, searchTerm, filterBalances]);

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

        await Swal.fire('Deleted!', 'Stock balance has been removed.', 'success');
        fetchStockBalance();
      } catch (error) {
        Swal.fire('Error', error.message || 'Failed to delete balance', 'error');
      }
    }
  };

  const getStatusColor = (balance) => {
    const bal = parseFloat(balance) || 0;
    if (bal === 0) return { bg: 'bg-red-50', text: 'text-red-600', indicator: 'bg-red-500' };
    if (bal < 10) return { bg: 'bg-orange-50', text: 'text-orange-600', indicator: 'bg-orange-500' };
    return { bg: 'bg-emerald-50', text: 'text-emerald-600', indicator: 'bg-emerald-500' };
  };

  return (
    <div className="space-y-3">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-indigo-600 font-bold tracking-widest  mb-1">Total Items</p>
              <p className="text-2xl font-bold text-indigo-900">{stats.totalItems}</p>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-600 font-bold tracking-widest  mb-1">Total Balance</p>
              <p className="text-2xl font-bold text-emerald-900">{parseFloat(stats.totalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-rose-600 font-bold tracking-widest  mb-1">Low Stock Items</p>
              <p className="text-2xl font-bold text-rose-900">{stats.lowStock}</p>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <Card title="Stock Balance" subtitle="View current stock levels for all items">
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by item code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filteredBalances.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <div className="p-3 bg-white rounded-full shadow-sm w-fit mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No stock items found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-[10px] font-bold ">
                <tr>
                  <th className="px-4 py-4 text-left ">Item Code</th>
                  <th className="px-4 py-4 text-left ">Material Name</th>
                  <th className="px-4 py-4 text-left ">Material Type</th>
                  <th className="px-4 py-4 text-right ">Current Balance</th>
                  <th className="px-4 py-4 text-left ">Unit</th>
                  <th className="px-4 py-4 text-left ">Last Updated</th>
                  <th className="px-4 py-4 text-right ">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBalances.map((item) => {
                  const statusColor = getStatusColor(item.current_balance);
                  return (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-slate-900">{item.item_code}</td>
                      <td className="px-4 py-4 text-slate-600 font-medium">{item.material_name || '—'}</td>
                      <td className="px-4 py-4 text-slate-500 text-xs">{item.material_type || '—'}</td>
                      <td className={`px-4 py-4 text-right ${statusColor.text}`}>
                        <div className="flex items-center justify-end gap-2">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColor.indicator}`}></span>
                          <span className="font-mono font-bold text-sm">
                            {parseFloat(item.current_balance || 0).toFixed(3)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-xs font-medium">{item.unit || 'NOS'}</td>
                      <td className="px-4 py-4 text-slate-400 text-xs">
                        {new Date(item.last_updated).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Remove from Balance"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default StockBalance;
