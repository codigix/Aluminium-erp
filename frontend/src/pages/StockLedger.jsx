import { useState, useEffect } from 'react';
import { Card, Modal, DataTable, FormControl } from '../components/ui.jsx';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Tag,
  ClipboardList,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

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
      const filteredData = (Array.isArray(data) ? data : []).filter(entry => {
        const type = (entry.material_type || '').toUpperCase();
        return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
      });
      setLedger(filteredData);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      errorToast(error.message || 'Failed to load stock ledger');
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchLedger({ itemCode, startDate, endDate });
  };

  const columns = [
    {
      key: 'item_code',
      label: 'Item Code',
      sortable: true,
      render: (val) => <span className="font-black text-slate-900">{val}</span>
    },
    {
      key: 'material_name',
      label: 'Material',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-600 ">{val || '—'}</span>
          <span className="text-[10px] text-slate-400  tracking-widest uppercase">{row.material_type || '—'}</span>
        </div>
      )
    },
    {
      key: 'transaction_date',
      label: 'Date',
      sortable: true,
      render: (val) => (
        <span className="text-slate-500 ">
          {new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      )
    },
    {
      key: 'transaction_type',
      label: 'Type',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex px-2.5 py-1 rounded text-[10px] font-black tracking-widest border ${transactionTypeColors[val]?.badge}`}>
          {val}
        </span>
      )
    },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      className: 'text-right',
      render: (val, row) => (
        <span className={`font-black ${row.transaction_type === 'IN' ? 'text-emerald-600' : 'text-slate-900'}`}>
          {row.transaction_type === 'IN' ? '+' : '-'}{parseFloat(val).toFixed(3)}
        </span>
      )
    },
    {
      key: 'balance_after',
      label: 'Balance',
      sortable: true,
      className: 'text-right',
      render: (val) => (
        <span className="font-black text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-100">
          {parseFloat(val || 0).toFixed(3)}
        </span>
      )
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (_, row) => (
        <div className="space-y-1">
          {row.reference_doc_type && row.reference_doc_number ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black text-slate-600 uppercase tracking-tighter">
              <span className="text-slate-400">{row.reference_doc_type}:</span>
              {row.reference_doc_number}
            </div>
          ) : <span className="text-slate-300">—</span>}
          {row.remarks && (
            <div className="text-[9px] text-slate-400  italic max-w-[150px] truncate" title={row.remarks}>
              {row.remarks}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.id)}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
          title="Delete Entry"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ];

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

        successToast('Ledger entry has been deleted.');
        fetchLedger({ itemCode, startDate, endDate });
      } catch (error) {
        errorToast(error.message || 'Failed to delete entry');
      }
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!formData.itemCode || !formData.quantity) {
      errorToast('Item Code and Quantity are required');
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

      successToast('Ledger entry added successfully');
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
      errorToast(error.message || 'Failed to add ledger entry');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card 
        title="Stock Ledger" 
        subtitle="Detailed history of inventory movements and adjustments"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        }
      >
        <div className="mb-6 p-4 bg-slate-50/50 rounded border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <FormControl label="Item Code">
              <div className="relative">
                <Tag className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="Enter item code..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </FormControl>
            <FormControl label="Start Date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>
            <FormControl label="End Date">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded text-xs font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-95"
              >
                <Filter className="w-4 h-4" />
                Apply Filter
              </button>
              <button
                onClick={() => {
                  setItemCode('');
                  setStartDate('');
                  setEndDate('');
                  fetchLedger({});
                }}
                className="p-2 bg-white text-slate-400 border border-slate-200 rounded hover:bg-slate-50 hover:text-indigo-600 transition-all active:scale-95"
                title="Reset Filters"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={ledger}
          loading={loading}
          hideHeader={true}
          emptyMessage="No stock transactions found for the selected criteria"
        />
      </Card>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Add Stock Ledger Entry"
        size="2xl"
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div className="p-1 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-400 font-black tracking-widest uppercase">Manual Transaction</p>
                <p className="text-xs text-indigo-900 ">Create a new manual inventory movement</p>
              </div>
            </div>
          </div>

          <FormControl label="Item Code *">
            <input
              type="text"
              value={formData.itemCode}
              onChange={(e) => setFormData({...formData, itemCode: e.target.value})}
              placeholder="e.g. RM-AL-001"
              className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              required
            />
          </FormControl>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Transaction Type *">
              <select
                value={formData.transactionType}
                onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="IN">IN (Purchase/Return)</option>
                <option value="OUT">OUT (Issue/Sale)</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="RETURN">RETURN</option>
              </select>
            </FormControl>
            <FormControl label="Quantity *">
              <input
                type="number"
                step="0.001"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                placeholder="0.000"
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                required
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Ref Doc Type">
              <input
                type="text"
                value={formData.refDocType}
                onChange={(e) => setFormData({...formData, refDocType: e.target.value})}
                placeholder="e.g. GRN, PO, SO"
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>
            <FormControl label="Ref Doc Number">
              <input
                type="text"
                value={formData.refDocNumber}
                onChange={(e) => setFormData({...formData, refDocNumber: e.target.value})}
                placeholder="e.g. GRN-0022"
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>
          </div>

          <FormControl label="Remarks">
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({...formData, remarks: e.target.value})}
              placeholder="Add any additional notes..."
              className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              rows="3"
            />
          </FormControl>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Create Entry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StockLedger;

