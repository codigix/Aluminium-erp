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
    <div className="space-y-3">
      <Card title="Stock Ledger" subtitle="View and manage stock transactions">
        <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Item Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="Enter item code"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
              </button>
              <button
                onClick={() => {
                  setItemCode('');
                  setStartDate('');
                  setEndDate('');
                  fetchLedger({});
                }}
                className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
                title="Reset Filters"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div>
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Entry
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : ledger.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <div className="p-3 bg-white rounded-full shadow-sm w-fit mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No stock transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-[10px] font-bold ">
                <tr>
                  <th className="px-4 py-4 text-left ">Item Code</th>
                  <th className="px-4 py-4 text-left ">Material</th>
                  <th className="px-4 py-4 text-left ">Date</th>
                  <th className="px-4 py-4 text-left ">Type</th>
                  <th className="px-4 py-4 text-right ">Quantity</th>
                  <th className="px-4 py-4 text-right ">Balance</th>
                  <th className="px-4 py-4 text-left ">Reference</th>
                  <th className="px-4 py-4 text-right ">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4 font-semibold text-slate-900">{entry.item_code}</td>
                    <td className="px-4 py-4">
                      <div className="text-slate-600 font-medium">{entry.material_name || '—'}</div>
                      <div className="text-[10px] text-slate-400 font-semibold ">{entry.material_type || '—'}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      {new Date(entry.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider  ${transactionTypeColors[entry.transaction_type]?.badge}`}>
                        {entry.transaction_type}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-mono font-bold ${entry.transaction_type === 'IN' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {entry.transaction_type === 'IN' ? '+' : '-'}{parseFloat(entry.quantity).toFixed(3)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                      {parseFloat(entry.balance_after || 0).toFixed(3)}
                    </td>
                    <td className="px-4 py-4">
                      {entry.reference_doc_type && entry.reference_doc_number 
                        ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-600">
                            <span className="text-slate-400">{entry.reference_doc_type}:</span>
                            {entry.reference_doc_number}
                          </div>
                        )
                        : <span className="text-slate-300">—</span>
                      }
                      {entry.remarks && (
                        <div className="text-[10px] text-slate-400 mt-1 italic max-w-[150px] truncate" title={entry.remarks}>
                          {entry.remarks}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Entry"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-2 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900  tracking-wider">Add Stock Ledger Entry</h3>
                <p className="text-[10px] text-slate-500 font-medium">Create a new manual inventory transaction</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="p-6 space-y-3">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Item Code *</label>
                  <input
                    type="text"
                    value={formData.itemCode}
                    onChange={(e) => setFormData({...formData, itemCode: e.target.value})}
                    placeholder="e.g. RM-AL-001"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Transaction Type *</label>
                    <select
                      value={formData.transactionType}
                      onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    >
                      <option value="IN">IN (Purchase/Return)</option>
                      <option value="OUT">OUT (Issue/Sale)</option>
                      <option value="ADJUSTMENT">ADJUSTMENT</option>
                      <option value="RETURN">RETURN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Quantity *</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                        placeholder="0.000"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Ref Doc Type</label>
                    <input
                      type="text"
                      value={formData.refDocType}
                      onChange={(e) => setFormData({...formData, refDocType: e.target.value})}
                      placeholder="e.g. GRN, PO, SO"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Ref Doc Number</label>
                    <input
                      type="text"
                      value={formData.refDocNumber}
                      onChange={(e) => setFormData({...formData, refDocNumber: e.target.value})}
                      placeholder="e.g. GRN-0022"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500  tracking-widest mb-1.5 ml-1">Remarks</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    placeholder="Add any additional notes or justification"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Add Ledger Entry
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
