import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const qcStatusColors = {
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  IN_PROGRESS: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  PASSED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Passed' },
  FAILED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700', label: 'Failed' },
  SHORTAGE: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'Shortage' },
  ACCEPTED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Accepted' }
};

const QCInspections = () => {
  const [qcInspections, setQcInspections] = useState([]);
  const [grns, setGrns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedQC, setSelectedQC] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [formData, setFormData] = useState({
    grnId: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    passQuantity: '',
    failQuantity: '',
    defects: '',
    remarks: ''
  });

  const [editFormData, setEditFormData] = useState({
    inspectionDate: '',
    passQuantity: '',
    failQuantity: '',
    defects: '',
    remarks: '',
    status: ''
  });

  useEffect(() => {
    fetchQCInspections();
    fetchGRNs();
    fetchStats();
  }, []);

  const fetchQCInspections = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        setQcInspections([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch QC Inspections');
      const data = await response.json();
      setQcInspections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching QC Inspections:', error);
      setQcInspections([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGRNs = async () => {
    try {
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
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-stats`, {
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

  const handleCreateQC = async (e) => {
    e.preventDefault();

    if (!formData.grnId || !formData.passQuantity) {
      Swal.fire('Error', 'Please fill in required fields', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grnId: parseInt(formData.grnId),
          inspectionDate: formData.inspectionDate,
          passQuantity: parseInt(formData.passQuantity),
          failQuantity: parseInt(formData.failQuantity) || 0,
          defects: formData.defects || null,
          remarks: formData.remarks || null
        })
      });

      if (!response.ok) throw new Error('Failed to create QC Inspection');

      await Swal.fire('Success', 'QC Inspection created successfully', 'success');
      setShowModal(false);
      setFormData({
        grnId: '',
        inspectionDate: new Date().toISOString().split('T')[0],
        passQuantity: '',
        failQuantity: '',
        defects: '',
        remarks: ''
      });
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to create QC Inspection', 'error');
    }
  };

  const handleViewQC = (qc) => {
    setSelectedQC(qc);
    setShowViewModal(true);
  };

  const handleEditQC = (qc) => {
    setSelectedQC(qc);
    setEditFormData({
      inspectionDate: qc.inspection_date || '',
      passQuantity: qc.pass_quantity || '',
      failQuantity: qc.fail_quantity || '',
      defects: qc.defects || '',
      remarks: qc.remarks || '',
      status: qc.status || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateQC = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${selectedQC.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: editFormData.status
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update QC Inspection');
      }

      await Swal.fire('Success', 'QC Inspection updated successfully', 'success');
      setShowEditModal(false);
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update QC Inspection', 'error');
    }
  };

  const handleDeleteQC = async (qcId) => {
    const result = await Swal.fire({
      title: 'Delete QC Inspection?',
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
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete QC Inspection');

      await Swal.fire('Success', 'QC Inspection deleted successfully', 'success');
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete QC Inspection', 'error');
    }
  };

  const filteredQC = qcInspections.filter(qc =>
    qc.id?.toString().includes(searchTerm) || 
    qc.grn_id?.toString().includes(searchTerm) ||
    qc.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    qc.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card title="QC Inspections" subtitle="Manage Quality Control Inspections">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search inspection, GRN, PO or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            + Create Inspection
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading QC Inspections...</p>
        ) : filteredQC.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No QC Inspections {searchTerm ? 'found' : 'created yet'}</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              + Create Inspection
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">GRN #</th>
                  <th className="px-4 py-3 text-left font-semibold">PO No</th>
                  <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-4 py-3 text-right font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Accepted</th>
                  <th className="px-4 py-3 text-right font-semibold">Shortage</th>
                  <th className="px-4 py-3 text-right font-semibold">Overage</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQC.map((qc) => (
                  <tr key={`qc-${qc.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">GRN-{String(qc.grn_id).padStart(4, '0')}</td>
                    <td className="px-4 py-4 text-slate-600">{qc.po_number || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{qc.vendor_name || '—'}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900 text-xs">{qc.items || 0}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600">{qc.accepted_quantity || 0}</td>
                    <td className="px-4 py-4 text-right font-semibold text-orange-600">{qc.shortage || 0}</td>
                    <td className="px-4 py-4 text-right font-semibold text-blue-600">{qc.overage || 0}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${qcStatusColors[qc.status]?.badge}`}>
                        {qcStatusColors[qc.status]?.label || qc.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button onClick={() => handleViewQC(qc)} className="px-3 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">👁 View</button>
                      <button onClick={() => handleEditQC(qc)} className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium">✎ Edit</button>
                      <button onClick={() => handleDeleteQC(qc.id)} className="px-3 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pendingQc || 0}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">In Progress</p>
            <p className="text-2xl font-bold text-blue-900">{stats.inProgressQc || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Passed</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.passedQc || 0}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider mb-1">Failed</p>
            <p className="text-2xl font-bold text-red-900">{stats.failedQc || 0}</p>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 text-xs">Create QC Inspection</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleCreateQC} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select GRN *</label>
                <select
                  value={formData.grnId}
                  onChange={(e) => setFormData({...formData, grnId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select a GRN --</option>
                  {grns.map(grn => (
                    <option key={grn.id} value={grn.id}>
                      GRN-{String(grn.id).padStart(4, '0')} - {grn.poNumber} ({grn.receivedQuantity} items)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Date *</label>
                <input
                  type="date"
                  value={formData.inspectionDate}
                  onChange={(e) => setFormData({...formData, inspectionDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pass Quantity *</label>
                  <input
                    type="number"
                    value={formData.passQuantity}
                    onChange={(e) => setFormData({...formData, passQuantity: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fail Quantity</label>
                  <input
                    type="number"
                    value={formData.failQuantity}
                    onChange={(e) => setFormData({...formData, failQuantity: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Defects/Issues</label>
                <textarea
                  value={formData.defects}
                  onChange={(e) => setFormData({...formData, defects: e.target.value})}
                  placeholder="Describe any defects or issues found"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  placeholder="Add inspection remarks"
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
                  Create Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedQC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-slate-900 text-xs">QC Inspection - GRN-{String(selectedQC.grn_id).padStart(4, '0')}</h3>
              <button onClick={() => setShowViewModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">PO Number</p>
                <p className="text-lg font-bold text-slate-900">{selectedQC.po_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Vendor</p>
                <p className="text-lg font-bold text-slate-900">{selectedQC.vendor_name || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${qcStatusColors[selectedQC.status]?.badge}`}>
                  {qcStatusColors[selectedQC.status]?.label || selectedQC.status}
                </span>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-1">Items (Ordered)</p>
                <p className="text-lg font-bold text-blue-600">{selectedQC.items || 0}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded">
                <p className="text-xs text-emerald-600 uppercase tracking-wider font-semibold mb-1">Accepted Qty</p>
                <p className="text-lg font-bold text-emerald-600">{selectedQC.accepted_quantity || 0}</p>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <p className="text-xs text-orange-600 uppercase tracking-wider font-semibold mb-1">Shortage</p>
                <p className="text-lg font-bold text-orange-600">{selectedQC.shortage || 0}</p>
              </div>
              <div className="bg-cyan-50 p-3 rounded">
                <p className="text-xs text-cyan-600 uppercase tracking-wider font-semibold mb-1">Overage</p>
                <p className="text-lg font-bold text-cyan-600">{selectedQC.overage || 0}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded">
                <p className="text-xs text-emerald-600 uppercase tracking-wider font-semibold mb-1">Pass Quantity</p>
                <p className="text-lg font-bold text-emerald-600">{selectedQC.pass_quantity || 0}</p>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <p className="text-xs text-red-600 uppercase tracking-wider font-semibold mb-1">Fail Quantity</p>
                <p className="text-lg font-bold text-red-600">{selectedQC.fail_quantity || 0}</p>
              </div>
            </div>

            {selectedQC.items_detail && selectedQC.items_detail.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-900 text-xs mb-3">Items Inspection</h4>
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-widest">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Item Details</th>
                        <th className="px-3 py-2 text-right font-semibold">Expected</th>
                        <th className="px-3 py-2 text-center font-semibold">Invoice Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Received</th>
                        <th className="px-3 py-2 text-right font-semibold">Shortage</th>
                        <th className="px-3 py-2 text-right font-semibold">Overage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQC.items_detail.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">{item.item_code || 'N/A'}</p>
                            {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 text-xs">{item.ordered_qty}</td>
                          <td className="px-3 py-2 text-center font-semibold text-slate-900 text-xs">{item.ordered_qty}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">{item.received_qty}</td>
                          <td className="px-3 py-2 text-right font-semibold text-orange-600">{item.shortage || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold text-cyan-600">{item.overage || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(selectedQC.defects || selectedQC.remarks) && (
              <div className="mb-6 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 text-xs mb-3">General Remarks</h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedQC.defects && (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                      <p className="text-xs text-yellow-600 uppercase tracking-wider font-semibold mb-2">Defects</p>
                      <p className="text-slate-700 text-sm">{selectedQC.defects}</p>
                    </div>
                  )}

                  {selectedQC.remarks && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                      <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-2">Remarks</p>
                      <p className="text-slate-700 text-sm">{selectedQC.remarks}</p>
                    </div>
                  )}
                </div>
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

      {showEditModal && selectedQC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900 text-xs">Edit QC Inspection</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleUpdateQC} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded text-sm">
                <p className="text-slate-600"><span className="font-medium">Inspection #:</span> QC-{String(selectedQC.id).padStart(4, '0')}</p>
                <p className="text-slate-600"><span className="font-medium">GRN #:</span> GRN-{String(selectedQC.grn_id).padStart(4, '0')}</p>
                <p className="text-slate-600"><span className="font-medium">Pass Qty:</span> {selectedQC.pass_quantity}</p>
                <p className="text-slate-600"><span className="font-medium">Fail Qty:</span> {selectedQC.fail_quantity || 0}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select Status --</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PASSED">Passed</option>
                  <option value="FAILED">Failed</option>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Update Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QCInspections;
