import { useState, useEffect } from 'react';
import { Card, DataTable } from '../components/ui.jsx';
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  FileEdit, 
  Trash2,
  X,
  ClipboardList
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const grnStatusColors = {
  PENDING: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', label: 'Pending' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Received' },
  INSPECTED: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Inspected' },
  Approved : { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
  REJECTED: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700', label: 'Rejected' }
};

const StatMiniCard = ({ title, count, color, icon }) => {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };
  
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]} flex flex-col items-center text-center transition-all hover:shadow-md`}>
      <div className="p-2.5 bg-white rounded-lg mb-2 shadow-sm">{icon}</div>
      <p className="text-[10px]  uppercase tracking-wider opacity-80 mb-0.5">{title}</p>
      <p className="text-xl ">{count || 0}</p>
    </div>
  );
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const GRN = () => {
  const [grns, setGrns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [formData, setFormData] = useState({
    poNumber: '',
    grnDate: new Date().toISOString().split('T')[0],
    receivedQuantity: '',
    notes: ''
  });

  const [editFormData, setEditFormData] = useState({
    grnDate: '',
    receivedQuantity: '',
    notes: '',
    status: ''
  });

  useEffect(() => {
    fetchGRNs();
    fetchStats();
  }, []);

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        setGrns([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch GRNs');
      const data = await response.json();
      setGrns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching GRNs:', error);
      setGrns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grn-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateGRN = async (e) => {
    e.preventDefault();

    if (!formData.poNumber || !formData.receivedQuantity) {
      errorToast('Please fill in required fields');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poNumber: formData.poNumber,
          grnDate: formData.grnDate,
          receivedQuantity: parseInt(formData.receivedQuantity),
          notes: formData.notes || null
        })
      });

      if (!response.ok) throw new Error('Failed to create GRN');

      successToast('GRN created successfully');
      setShowModal(false);
      setFormData({
        poNumber: '',
        grnDate: new Date().toISOString().split('T')[0],
        receivedQuantity: '',
        notes: ''
      });
      fetchGRNs();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to create GRN');
    }
  };

  const handleViewGRN = (grn) => {
    setSelectedGRN(grn);
    setShowViewModal(true);
  };

  const handleEditGRN = (grn) => {
    setSelectedGRN(grn);
    setEditFormData({
      grnDate: grn.grnDate || '',
      receivedQuantity: grn.receivedQuantity || '',
      notes: grn.notes || '',
      status: grn.status || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateGRN = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns/${selectedGRN.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: editFormData.status
        })
      });

      if (!response.ok) throw new Error('Failed to update GRN');

      successToast('GRN updated successfully');
      setShowEditModal(false);
      fetchGRNs();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update GRN');
    }
  };

  const handleDeleteGRN = async (grnId) => {
    const result = await Swal.fire({
      title: 'Delete GRN?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns/${grnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete GRN');

      successToast('GRN deleted successfully');
      fetchGRNs();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete GRN');
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'GRN #',
      sortable: true,
      render: (val) => (
        <div className=" text-slate-900 tracking-tight">
          GRN-{String(val).padStart(4, '0')}
        </div>
      )
    },
    {
      key: 'poNumber',
      label: 'PO Number',
      sortable: true,
      render: (val) => (
        <div className="inline-flex p-1  bg-indigo-50 text-indigo-700 roundedtext-xs    border border-indigo-100">
          {val}
        </div>
      )
    },
    {
      key: 'grnDate',
      label: 'GRN Date',
      sortable: true,
      render: (val) => formatDate(val)
    },
    {
      key: 'receivedQuantity',
      label: 'Received Qty',
      sortable: true,
      className: 'text-right',
      render: (val) => (
        <span className="   text-slate-900">{val}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex px-2.5 py-1 rounded text-xs    ${grnStatusColors[val]?.badge}`}>
          {grnStatusColors[val]?.label || val}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right',
      render: (_, grn) => (
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => handleViewGRN(grn)} 
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          <button 
            onClick={() => handleEditGRN(grn)} 
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Edit GRN"
          >
            <FileEdit size={16} />
          </button>
          <button 
            onClick={() => handleDeleteGRN(grn.id)} 
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
            title="Delete GRN"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl  text-slate-900">GRN Records</h1>
            <p className="text-sm text-slate-500 font-medium">History of all Goods Received Notes</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus size={18} />
          Create GRN
        </button>
      </div>

      <DataTable 
        columns={columns}
        data={grns}
        loading={loading}
        loadingMessage="Fetching GRN records..."
        searchPlaceholder="Search by PO number, status..."
        emptyMessage="No GRNs found"
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatMiniCard title="Total GRNs" count={stats.totalGrns} color="indigo" icon={<FileText size={18} />} />
          <StatMiniCard title="Pending" count={stats.pendingGrns} color="amber" icon={<Clock size={18} />} />
          <StatMiniCard title="Received" count={stats.receivedGrns} color="cyan" icon={<CheckCircle size={18} />} />
          <StatMiniCard title="Approved" count={stats.approvedGrns} color="emerald" icon={<CheckCircle size={18} />} />
          <StatMiniCard title="Rejected" count={stats.rejectedGrns} color="rose" icon={<XCircle size={18} />} />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-base  text-slate-900">Create Goods Received Note</h3>
                <p className="text-xs text-slate-500 font-medium tracking-wide mt-0.5">Record incoming material from vendor</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="blocktext-xs   text-slate-500   mb-1.5 ml-1">PO Number *</label>
                  <input
                    type="text"
                    value={formData.poNumber}
                    onChange={(e) => setFormData({...formData, poNumber: e.target.value})}
                    placeholder="Enter PO number"
                    className="w-full p-2 .5 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="blocktext-xs   text-slate-500   mb-1.5 ml-1">GRN Date *</label>
                  <input
                    type="date"
                    value={formData.grnDate}
                    onChange={(e) => setFormData({...formData, grnDate: e.target.value})}
                    className="w-full p-2 .5 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="blocktext-xs   text-slate-500   mb-1.5 ml-1">Received Quantity *</label>
                <input
                  type="number"
                  value={formData.receivedQuantity}
                  onChange={(e) => setFormData({...formData, receivedQuantity: e.target.value})}
                  placeholder="0"
                  className="w-full p-2 .5 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="blocktext-xs   text-slate-500   mb-1.5 ml-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any notes about the receipt"
                  className="w-full p-2 .5 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  rows="3"
                />
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 text-white rounded  text-sm  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Create GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedGRN && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded  shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-2 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-sm  text-slate-900  ">GRN Details</h3>
                <p className="text-[10px] text-slate-500  tracking-wide mt-0.5">Goods Received Note Information</p>
              </div>
              <button 
                onClick={() => setShowViewModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded  transition-all border border-transparent hover:border-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded  border border-slate-100">
                  <p className="text-[10px]  text-slate-400   mb-1">GRN Number</p>
                  <p className="text-sm  text-slate-900">GRN-{String(selectedGRN.id).padStart(4, '0')}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded  border border-slate-100">
                  <p className="text-[10px]  text-slate-400   mb-1">PO Number</p>
                  <p className="text-sm  text-indigo-600">{selectedGRN.poNumber}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded  border border-slate-100">
                  <p className="text-[10px]  text-slate-400   mb-1">GRN Date</p>
                  <p className="text-sm  text-slate-900">{formatDate(selectedGRN.grnDate)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded  border border-slate-100">
                  <p className="text-[10px]  text-slate-400   mb-1">Received Qty</p>
                  <p className="text-sm  text-slate-900">{selectedGRN.receivedQuantity}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded  border border-slate-100 col-span-2">
                  <p className="text-[10px]  text-slate-400   mb-2">Current Status</p>
                  <span className={`inline-flex p-2  rounded text-xs     ${grnStatusColors[selectedGRN.status]?.badge}`}>
                    {grnStatusColors[selectedGRN.status]?.label || selectedGRN.status}
                  </span>
                </div>
              </div>

              {selectedGRN.notes && (
                <div className="mb-6 bg-indigo-50 border border-indigo-100 p-4 rounded ">
                  <p className="text-[10px]  text-indigo-600   mb-2">Notes</p>
                  <p className="text-sm text-slate-700  leading-relaxed">{selectedGRN.notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-8 py-2.5 bg-slate-900 text-white rounded  text-sm  hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedGRN && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded  shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-2 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-sm  text-slate-900  ">Update GRN Status</h3>
                <p className="text-[10px] text-slate-500  tracking-wide mt-0.5">Modify progress of Goods Received Note</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded  transition-all border border-transparent hover:border-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateGRN} className="p-6 space-y-3">
              <div className="bg-slate-50 p-4 rounded  border border-slate-200 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px]  text-slate-400   mb-1">GRN ID</p>
                  <p className="text-xs  text-slate-700">GRN-{String(selectedGRN.id).padStart(4, '0')}</p>
                </div>
                <div>
                  <p className="text-[10px]  text-slate-400   mb-1">PO Number</p>
                  <p className="text-xs  text-indigo-600">{selectedGRN.poNumber}</p>
                </div>
                <div>
                  <p className="text-[10px]  text-slate-400   mb-1">Received Qty</p>
                  <p className="text-xs  text-slate-700">{selectedGRN.receivedQuantity}</p>
                </div>
              </div>

              <div>
                <label className="blocktext-xs   text-slate-500   mb-1.5 ml-1">Update Status *</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full p-2 .5 border border-slate-200 rounded  text-sm  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  required
                >
                  <option value="">-- Select Status --</option>
                  <option value="PENDING">Pending</option>
                  <option value="RECEIVED">Received</option>
                  <option value="INSPECTED">Inspected</option>
                  <option value="Approved ">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-2 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 text-white rounded  text-sm  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Update GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GRN;

