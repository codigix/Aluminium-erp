import { useState, useEffect, useCallback } from 'react';
import { Card, DataTable } from '../components/ui.jsx';
import { AlertCircle, FileText, Calendar, User, ShoppingBag, Hash, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const QualityRejections = () => {
  const [rejections, setRejections] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRejections = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/rejections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch rejections');
      const data = await response.json();
      setRejections(data);
    } catch (error) {
      console.error('Error fetching rejections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRejections();
  }, [fetchRejections]);

  const columns = [
    {
      label: 'Item Details',
      key: 'material_name',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 text-xs">{val || row.item_code}</span>
          <span className="text-[10px] text-indigo-600 font-mono">{row.item_code}</span>
        </div>
      )
    },
    {
      label: 'Rejected Qty',
      key: 'rejected_qty',
      className: 'text-center',
      render: (val) => (
        <span className="font-black text-rose-600">
          {parseFloat(val || 0).toFixed(3)}
        </span>
      )
    },
    {
      label: 'Reference',
      key: 'reference_number',
      render: (val, row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-black text-slate-700">{val}</span>
            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${row.ref_type === 'GRN' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
              {row.ref_type}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">{row.po_number || '—'}</span>
          </div>
        </div>
      )
    },
    {
      label: 'Source',
      key: 'source_name',
      render: (val) => (
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-600">{val || '—'}</span>
        </div>
      )
    },
    {
      label: 'Date',
      key: 'date',
      render: (val) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">
            {val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'item_status',
      render: (val) => {
        const colors = {
          SHORTAGE: 'bg-rose-50 text-rose-600 border-rose-100',
          REJECTED: 'bg-red-50 text-red-600 border-red-100',
          OVERAGE: 'bg-orange-50 text-orange-600 border-orange-100',
          FAILED: 'bg-red-50 text-red-600 border-red-100',
          PENDING: 'bg-amber-50 text-amber-600 border-amber-100'
        };
        
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black tracking-wider border ${colors[val] || colors.REJECTED}`}>
            {val || 'REJECTED'}
          </span>
        );
      }
    },
    {
      label: 'Reason/Remarks',
      key: 'item_remarks',
      render: (val) => (
        <p className="text-[10px] text-slate-500 italic max-w-xs truncate">
          {val || 'No remarks provided'}
        </p>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Quality Rejections</h1>
          <p className="text-sm text-slate-500">Analysis and tracking of non-conforming materials and products</p>
        </div>
        <button 
          onClick={fetchRejections}
          className="p-2.5 text-slate-500 hover:text-indigo-600 rounded-xl hover:bg-slate-50 transition-all border border-slate-100 bg-white shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={rejections}
          loading={loading}
          searchPlaceholder="Search by item, GRN, or PO..."
          emptyMessage="No quality rejections found."
        />
      </Card>
    </div>
  );
};

export default QualityRejections;

