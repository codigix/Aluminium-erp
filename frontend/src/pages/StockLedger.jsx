import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const transactionTypeColors = {
  IN: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  OUT: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  ADJUSTMENT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  RETURN: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' }
};

const StockLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    itemCode: '',
    transactionType: 'IN',
    quantity: '',
    refDocType: '',
    refDocNumber: '',
    remarks: ''
  });

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async (filter = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      
      if (filter.itemCode) params.append('itemCode', filter.itemCode);
      if (filter.startDate) params.append('startDate', filter.startDate);
      if (filter.endDate) params.append('endDate', filter.endDate);

      const response = await fetch(`${API_BASE}/stock/ledger?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch Stock Ledger');
      const data = await response.json();
      setLedger(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchLedger({ itemCode, startDate, endDate });
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will delete the ledger entry and recalculate the stock balance!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/stock/ledger/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to delete ledger entry');

        await Swal.fire('Deleted!', 'Ledger entry has been deleted.', 'success');
        fetchLedger({ itemCode, startDate, endDate });
      } catch (error) {
        Swal.fire('Error', error.message || 'Failed to delete entry', 'error');
      }
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!formData.itemCode || !formData.quantity) {
      Swal.fire('Error', 'Item Code and Quantity are required', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/ledger/entry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemCode: formData.itemCode,
          transactionType: formData.transactionType,
          quantity: parseFloat(formData.quantity),
          refDocType: formData.refDocType || null,
          refDocNumber: formData.refDocNumber || null,
          remarks: formData.remarks || null
        })
      });

      if (!response.ok) throw new Error('Failed to add ledger entry');

      await Swal.fire('Success', 'Ledger entry added successfully', 'success');
      setShowModal(false);
      setFormData({
        itemCode: '',
        transactionType: 'IN',
        quantity: '',
        refDocType: '',
        refDocNumber: '',
        remarks: ''
      });
      fetchLedger({ itemCode, startDate, endDate });
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to add ledger entry', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Stock Ledger" subtitle="View and manage stock transactions">
        <div className="mb-6 space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Code</label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="Enter item code"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleFilter}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800"
            >
              Filter
            </button>
            <button
              onClick={() => {
                setItemCode('');
                setStartDate('');
                setEndDate('');
                fetchLedger({});
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300"
            >
              Reset
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 whitespace-nowrap"
            >
              + Add Entry
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading stock ledger...</p>
        ) : ledger.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No stock transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Item Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Material Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Material Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance After</th>
                  <th className="px-4 py-3 text-left font-semibold">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">{entry.item_code}</td>
                    <td className="px-4 py-4 text-slate-600">{entry.material_name || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{entry.material_type || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(entry.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${transactionTypeColors[entry.transaction_type]?.badge}`}>
                        {entry.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{parseFloat(entry.quantity).toFixed(3)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600">{parseFloat(entry.balance_after || 0).toFixed(3)}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {entry.reference_doc_type && entry.reference_doc_number 
                        ? `${entry.reference_doc_type} - ${entry.reference_doc_number}`
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-4 text-slate-600 text-xs">{entry.remarks || '—'}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Entry"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Add Stock Ledger Entry</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Code *</label>
                <input
                  type="text"
                  value={formData.itemCode}
                  onChange={(e) => setFormData({...formData, itemCode: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Type *</label>
                  <select
                    value={formData.transactionType}
                    onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                    <option value="ADJUSTMENT">ADJUSTMENT</option>
                    <option value="RETURN">RETURN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference Doc Type</label>
                  <input
                    type="text"
                    value={formData.refDocType}
                    onChange={(e) => setFormData({...formData, refDocType: e.target.value})}
                    placeholder="e.g., GRN, PO, SO"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference Doc Number</label>
                  <input
                    type="text"
                    value={formData.refDocNumber}
                    onChange={(e) => setFormData({...formData, refDocNumber: e.target.value})}
                    placeholder="e.g., GRN-0022"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  placeholder="Add any remarks"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Add Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockLedger;
