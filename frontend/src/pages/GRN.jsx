import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const grnStatusColors = {
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Received' },
  INSPECTED: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Inspected' },
  APPROVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
  REJECTED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700', label: 'Rejected' }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const GRN = () => {
  const [grns, setGrns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
      Swal.fire('Error', 'Please fill in required fields', 'error');
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

      await Swal.fire('Success', 'GRN created successfully', 'success');
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
      Swal.fire('Error', error.message || 'Failed to create GRN', 'error');
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

      await Swal.fire('Success', 'GRN updated successfully', 'success');
      setShowEditModal(false);
      fetchGRNs();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update GRN', 'error');
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

      await Swal.fire('Success', 'GRN deleted successfully', 'success');
      fetchGRNs();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete GRN', 'error');
    }
  };

  const filteredGRNs = grns.filter(grn =>
    grn.poNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card title="GRN Processing" subtitle="Manage Goods Received Notes">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search PO number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
          >
            + Create GRN
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading GRNs...</p>
        ) : filteredGRNs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No GRNs {searchTerm ? 'found' : 'created yet'}</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              + Create GRN
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">GRN #</th>
                  <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                  <th className="px-4 py-3 text-left font-semibold">GRN Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Received Qty</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGRNs.map((grn) => (
                  <tr key={`grn-${grn.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">GRN-{String(grn.id).padStart(4, '0')}</td>
                    <td className="px-4 py-4 text-slate-600">{grn.poNumber}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(grn.grnDate)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900 text-xs">{grn.receivedQuantity}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${grnStatusColors[grn.status]?.badge}`}>
                        {grnStatusColors[grn.status]?.label || grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button onClick={() => handleViewGRN(grn)} className="px-3 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">👁 View</button>
                      <button onClick={() => handleEditGRN(grn)} className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium">✎ Edit</button>
                      <button onClick={() => handleDeleteGRN(grn.id)} className="px-3 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total GRNs</p>
            <p className="text-2xl font-bold text-blue-900">{stats.totalGrns || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pendingGrns || 0}</p>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <p className="text-xs text-cyan-600 font-semibold uppercase tracking-wider mb-1">Received</p>
            <p className="text-2xl font-bold text-cyan-900">{stats.receivedGrns || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Approved</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.approvedGrns || 0}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider mb-1">Rejected</p>
            <p className="text-2xl font-bold text-red-900">{stats.rejectedGrns || 0}</p>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 text-xs">Create GRN (Goods Received Note)</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PO Number *</label>
                <input
                  type="text"
                  value={formData.poNumber}
                  onChange={(e) => setFormData({...formData, poNumber: e.target.value})}
                  placeholder="Enter PO number"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GRN Date *</label>
                <input
                  type="date"
                  value={formData.grnDate}
                  onChange={(e) => setFormData({...formData, grnDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Received Quantity *</label>
                <input
                  type="number"
                  value={formData.receivedQuantity}
                  onChange={(e) => setFormData({...formData, receivedQuantity: e.target.value})}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any notes about the receipt"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows="3"
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
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
                >
                  Create GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 text-xs">GRN Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">GRN Number</p>
                <p className="text-lg font-bold text-slate-900">GRN-{String(selectedGRN.id).padStart(4, '0')}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">PO Number</p>
                <p className="text-lg font-bold text-slate-900">{selectedGRN.poNumber}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">GRN Date</p>
                <p className="text-lg font-bold text-slate-900">{formatDate(selectedGRN.grnDate)}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Received Qty</p>
                <p className="text-lg font-bold text-slate-900">{selectedGRN.receivedQuantity}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded col-span-2">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${grnStatusColors[selectedGRN.status]?.badge}`}>
                  {grnStatusColors[selectedGRN.status]?.label || selectedGRN.status}
                </span>
              </div>
            </div>

            {selectedGRN.notes && (
              <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded">
                <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-2">Notes</p>
                <p className="text-slate-700">{selectedGRN.notes}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 text-xs">Edit GRN</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleUpdateGRN} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded text-sm">
                <p className="text-slate-600"><span className="font-medium">GRN Number:</span> GRN-{String(selectedGRN.id).padStart(4, '0')}</p>
                <p className="text-slate-600"><span className="font-medium">PO Number:</span> {selectedGRN.poNumber}</p>
                <p className="text-slate-600"><span className="font-medium">Received Qty:</span> {selectedGRN.receivedQuantity}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Select Status --</option>
                  <option value="PENDING">Pending</option>
                  <option value="RECEIVED">Received</option>
                  <option value="INSPECTED">Inspected</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
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
