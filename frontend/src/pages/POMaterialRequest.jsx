import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const POMaterialRequest = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [expandedPos, setExpandedPos] = useState(new Set());
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
      
      // Auto-expand all for now
      const poIds = new Set(data.map(req => req.po_id));
      setExpandedPos(poIds);
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

  const togglePo = (poId) => {
    const newExpanded = new Set(expandedPos);
    if (newExpanded.has(poId)) {
      newExpanded.delete(poId);
    } else {
      newExpanded.add(poId);
    }
    setExpandedPos(newExpanded);
  };

  // Group requests by PO ID
  const groupedRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      const matchesSearch = 
        req.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.material_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'ALL' || req.store_acceptance_status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });

    const groups = {};
    filtered.forEach(req => {
      if (!groups[req.po_id]) {
        groups[req.po_id] = {
          po_id: req.po_id,
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
        ) : groupedRequests.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-500">No PO material requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedRequests.map((group) => (
              <div key={group.po_id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                {/* PO Header */}
                <div 
                  className={`p-2 flex items-center justify-between cursor-pointer select-none transition-colors ${expandedPos.has(group.po_id) ? 'bg-slate-50 border-b border-slate-200' : 'bg-white hover:bg-slate-50/50'}`}
                  onClick={() => togglePo(group.po_id)}
                >
                  <div className="flex items-center gap-6">
                    <div className="text-lg text-slate-900 flex items-center gap-2">
                      <span className="text-slate-400 text-xs">{expandedPos.has(group.po_id) ? '▼' : '▶'}</span>
                      {group.po_number}
                    </div>
                    <div className="h-4 w-[1px] bg-slate-200"></div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PO Date</p>
                      <p className="text-sm font-semibold text-slate-700">{formatDate(group.po_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vendor</p>
                      <p className="text-sm font-semibold text-slate-700">{group.vendor_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        group.store_acceptance_status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                        group.store_acceptance_status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {group.store_acceptance_status || 'PENDING'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {group.store_acceptance_status === 'PENDING' ? (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleAcceptReject(group.po_id, 'ACCEPTED'); }}
                          className="px-4 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm active:scale-95"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleAcceptReject(group.po_id, 'REJECTED'); }}
                          className="px-4 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-all shadow-sm active:scale-95"
                        >
                          Reject
                        </button>
                      </>
                    ) : group.store_acceptance_status === 'ACCEPTED' ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate('/grn', { state: { poNumber: group.po_number } }); }}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                      >
                        Create GRN
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Items Table */}
                {expandedPos.has(group.po_id) && (
                  <div className="p-0 bg-white">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50/50 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                        <tr>
                          <th className="p-2">Material / Item</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Drawing No</th>
                          <th className="p-2 text-right">PO Quantity</th>
                          <th className="p-2 text-right">Pending GRN</th>
                          <th className="p-2">Exp. Delivery</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((item, idx) => (
                          <tr key={`${item.po_item_id}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-2">
                              <div className="text-slate-900 text-xs">{item.material_name || '—'}</div>
                              <div className="text-xs text-slate-500 line-clamp-1 max-w-xl">{item.description}</div>
                            </td>
                            <td className="p-2 text-slate-600">{item.material_type || '—'}</td>
                            <td className="p-2 text-slate-600">{item.drawing_no || '—'}</td>
                            <td className="p-2 text-right font-medium text-slate-700">
                              {parseFloat(item.po_qty || 0).toFixed(2)} <span className="text-[10px] text-slate-400">{item.unit}</span>
                            </td>
                            <td className="p-2 text-right">
                              <span className="font-bold text-blue-600">
                                {parseFloat(item.pending_grn_qty || 0).toFixed(2)}
                              </span>
                            </td>
                            <td className="p-2 text-slate-600">
                              {formatDate(item.expected_delivery_date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default POMaterialRequest;
