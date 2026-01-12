import { useState, useEffect, useMemo } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const POMaterialRequest = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
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
        
        Swal.fire('Success', `PO ${actionText.toLowerCase()}ed successfully`, 'success');
        fetchRequests();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = 
        req.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.material_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'ALL' || req.store_acceptance_status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, filterStatus]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <Card title="PO Material Request" subtitle="Inventory Department - Review and Accept Purchase Orders">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by PO No, Vendor or Material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending Acceptance</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button 
              onClick={fetchRequests}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              🔄
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-500">No PO material requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-bold">
                <tr>
                  <th className="px-4 py-4">PO No</th>
                  <th className="px-4 py-4">PO Date</th>
                  <th className="px-4 py-4">Vendor</th>
                  <th className="px-4 py-4">Material / Item</th>
                  <th className="px-4 py-4 text-right">PO Qty</th>
                  <th className="px-4 py-4 text-right">Pending GRN</th>
                  <th className="px-4 py-4">Expected Date</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req, idx) => (
                  <tr key={`${req.po_id}-${req.po_item_id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-semibold text-slate-900">{req.po_number}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(req.po_date)}</td>
                    <td className="px-4 py-4 text-slate-700 font-medium">{req.vendor_name}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{req.material_name || req.item_code}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{req.description}</div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">
                      {parseFloat(req.po_qty || 0).toFixed(2)} {req.unit}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-blue-600">
                      {parseFloat(req.pending_grn_qty || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(req.expected_delivery_date)}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.store_acceptance_status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                        req.store_acceptance_status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {req.store_acceptance_status || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {req.store_acceptance_status === 'PENDING' ? (
                          <>
                            <button 
                              onClick={() => handleAcceptReject(req.po_id, 'ACCEPTED')}
                              className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleAcceptReject(req.po_id, 'REJECTED')}
                              className="px-3 py-1 bg-rose-500 text-white rounded-lg text-xs font-semibold hover:bg-rose-600 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        ) : req.store_acceptance_status === 'ACCEPTED' ? (
                          <button 
                            onClick={() => navigate('/grn', { state: { poNumber: req.po_number } })}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors"
                          >
                            Create GRN
                          </button>
                        ) : null}
                        <button className="p-1 text-slate-400 hover:text-slate-900 transition-colors">
                          👁️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default POMaterialRequest;
