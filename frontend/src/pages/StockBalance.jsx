import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';

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

  useEffect(() => {
    filterBalances();
  }, [balances, searchTerm]);

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

  const filterBalances = () => {
    if (!searchTerm) {
      setFilteredBalances(balances);
      return;
    }

    const filtered = balances.filter(item =>
      item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBalances(filtered);
  };

  const getStatusColor = (balance) => {
    const bal = parseFloat(balance) || 0;
    if (bal === 0) return { bg: 'bg-red-50', text: 'text-red-600', indicator: 'bg-red-500' };
    if (bal < 10) return { bg: 'bg-orange-50', text: 'text-orange-600', indicator: 'bg-orange-500' };
    return { bg: 'bg-emerald-50', text: 'text-emerald-600', indicator: 'bg-emerald-500' };
  };

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total Items</p>
            <p className="text-2xl font-bold text-blue-900">{stats.totalItems}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Total Balance</p>
            <p className="text-2xl font-bold text-emerald-900">{parseFloat(stats.totalBalance || 0).toFixed(2)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-xs text-orange-600 font-semibold uppercase tracking-wider mb-1">Low Stock Items</p>
            <p className="text-2xl font-bold text-orange-900">{stats.lowStock}</p>
          </div>
        </div>
      )}

      <Card title="Stock Balance" subtitle="View current stock levels for all items">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by item code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading stock balance...</p>
        ) : filteredBalances.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No stock items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Item Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">PO Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Received</th>
                  <th className="px-4 py-3 text-right font-semibold">Accepted</th>
                  <th className="px-4 py-3 text-right font-semibold">Issued</th>
                  <th className="px-4 py-3 text-right font-semibold">Current Balance</th>
                  <th className="px-4 py-3 text-left font-semibold">Unit</th>
                  <th className="px-4 py-3 text-left font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredBalances.map((item) => {
                  const statusColor = getStatusColor(item.current_balance);
                  return (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-900">{item.item_code}</td>
                      <td className="px-4 py-4 text-slate-600 text-xs max-w-xs truncate">{item.item_description || '—'}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{parseFloat(item.po_qty || 0).toFixed(3)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{parseFloat(item.received_qty || 0).toFixed(3)}</td>
                      <td className="px-4 py-4 text-right text-emerald-600 font-semibold">{parseFloat(item.accepted_qty || 0).toFixed(3)}</td>
                      <td className="px-4 py-4 text-right text-orange-600 font-semibold">{parseFloat(item.issued_qty || 0).toFixed(3)}</td>
                      <td className={`px-4 py-4 text-right font-bold ${statusColor.text}`}>
                        <span className="flex items-center justify-end gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${statusColor.indicator}`}></span>
                          {parseFloat(item.current_balance || 0).toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{item.unit || 'NOS'}</td>
                      <td className="px-4 py-4 text-slate-600 text-xs">
                        {new Date(item.last_updated).toLocaleDateString()}
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
