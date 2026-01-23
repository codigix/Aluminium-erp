import { useState, useEffect, useMemo } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const POMaterialRequest = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/material-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch Material Requests');
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching material requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptReject = async (poId, status) => {
    const actionText = status === 'ACCEPTED' ? 'Accept' : 'Reject';
    const { value: notes } = await Swal.fire({
      title: `${actionText} Purchase Order`,
      input: 'textarea',
      inputLabel: 'Add notes (optional)',
      inputPlaceholder: 'Enter any remarks here...',
      showCancelButton: true,
      confirmButtonText: actionText,
      confirmButtonColor: status === 'ACCEPTED' ? '#10b981' : '#ef4444',
    });

    if (notes !== undefined) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/purchase-orders/${poId}/store-acceptance`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status, notes })
        });

        if (!response.ok) throw new Error(`Failed to ${actionText.toLowerCase()} PO`);
        
        successToast(`PO ${actionText.toLowerCase()}ed successfully`);
        fetchRequests();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const groupedRequests = useMemo(() => {
    const groups = {};
    requests.forEach(req => {
      if (!groups[req.po_id]) {
        groups[req.po_id] = {
          id: req.po_id,
          po_number: req.po_number,
          po_date: req.po_date,
          vendor_name: req.vendor_name,
          expected_delivery_date: req.expected_delivery_date,
          store_acceptance_status: req.store_acceptance_status,
          items: []
        };
      }
      groups[req.po_id].items.push(req);
    });

    return Object.values(groups).sort((a, b) => new Date(b.po_date) - new Date(a.po_date));
  }, [requests]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const columns = [
    {
      key: 'po_number',
      label: 'PO Number',
      sortable: true,
      render: (val) => <span className="font-bold text-slate-900">{val}</span>
    },
    {
      key: 'po_date',
      label: 'PO Date',
      sortable: true,
      render: (val) => formatDate(val)
    },
    { key: 'vendor_name', label: 'Vendor', sortable: true },
    {
      key: 'store_acceptance_status',
      label: 'Status',
      sortable: true,
      render: (val) => <StatusBadge status={val || 'PENDING'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.store_acceptance_status === 'PENDING' || !row.store_acceptance_status ? (
            <>
              <button 
                onClick={() => handleAcceptReject(row.id, 'ACCEPTED')}
                className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-200"
              >
                Accept
              </button>
              <button 
                onClick={() => handleAcceptReject(row.id, 'REJECTED')}
                className="px-3 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-bold hover:bg-rose-600 transition-all shadow-sm shadow-rose-200"
              >
                Reject
              </button>
            </>
          ) : row.store_acceptance_status === 'ACCEPTED' ? (
            <button 
              onClick={() => navigate('/grn', { state: { poNumber: row.po_number } })}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
            >
              Create GRN
            </button>
          ) : null}
        </div>
      )
    }
  ];

  const renderExpanded = (group) => (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mx-4">
      <div className="bg-white px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Requested Materials</h4>
        <span className="text-[10px] text-slate-400 font-medium">Expected by: {formatDate(group.expected_delivery_date)}</span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase tracking-widest font-bold">
          <tr>
            <th className="px-4 py-2">Material / Item</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Drawing No</th>
            <th className="px-4 py-2 text-right">PO Qty</th>
            <th className="px-4 py-2 text-right">Pending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {group.items.map((item, idx) => (
            <tr key={`${item.po_item_id}-${idx}`} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2">
                <div className="text-slate-900 font-medium">{item.material_name || '—'}</div>
                <div className="text-[10px] text-slate-500 line-clamp-1">{item.description}</div>
              </td>
              <td className="px-4 py-2 text-slate-500">{item.material_type || '—'}</td>
              <td className="px-4 py-2 text-slate-600 font-mono">{item.drawing_no || '—'}</td>
              <td className="px-4 py-2 text-right font-bold text-slate-700">
                {parseFloat(item.po_qty || 0).toFixed(2)} <span className="text-[9px] text-slate-400 font-normal">{item.unit}</span>
              </td>
              <td className="px-4 py-2 text-right text-indigo-600 font-bold">
                {parseFloat(item.pending_grn_qty || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">PO Material Request</h1>
          <p className="text-slate-500 text-xs font-medium">Inventory Department - Review and Accept Purchase Orders</p>
        </div>

        <DataTable
          columns={columns}
          data={groupedRequests}
          loading={loading}
          renderExpanded={renderExpanded}
          searchPlaceholder="Search by PO No, Vendor or Material..."
          emptyMessage="No PO material requests found"
          actions={
            <button
              onClick={fetchRequests}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors group"
              title="Refresh Data"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          }
        />
      </div>
    </div>
  );
};

export default POMaterialRequest;
