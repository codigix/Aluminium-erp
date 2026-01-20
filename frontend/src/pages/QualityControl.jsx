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

const qcStatusColors = {
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  IN_PROGRESS: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  PASSED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Passed' },
  FAILED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700', label: 'Failed' }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const QualityControl = () => {
  const [activeTab, setActiveTab] = useState('grn');
  const [grns, setGrns] = useState([]);
  const [qcInspections, setQcInspections] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [selectedQC, setSelectedQC] = useState(null);

  const [grnFormData, setGrnFormData] = useState({
    poNumber: '',
    grnDate: new Date().toISOString().split('T')[0],
    receivedQuantity: '',
    notes: ''
  });

  const [qcFormData, setQcFormData] = useState({
    grnId: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    passQuantity: '',
    failQuantity: '',
    defects: '',
    remarks: ''
  });

  useEffect(() => {
    fetchGRNs();
    fetchQCInspections();
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

  const fetchQCInspections = async () => {
    try {
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

  const handleCreateGRN = async (e) => {
    e.preventDefault();

    if (!grnFormData.poNumber || !grnFormData.receivedQuantity) {
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
          poNumber: grnFormData.poNumber,
          grnDate: grnFormData.grnDate,
          receivedQuantity: parseInt(grnFormData.receivedQuantity),
          notes: grnFormData.notes || null
        })
      });

      if (!response.ok) throw new Error('Failed to create GRN');

      await Swal.fire('Success', 'GRN created successfully', 'success');
      setShowGRNModal(false);
      setGrnFormData({
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

  const handleCreateQC = async (e) => {
    e.preventDefault();

    if (!qcFormData.grnId || !qcFormData.passQuantity) {
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
          grnId: parseInt(qcFormData.grnId),
          inspectionDate: qcFormData.inspectionDate,
          passQuantity: parseInt(qcFormData.passQuantity),
          failQuantity: parseInt(qcFormData.failQuantity) || 0,
          defects: qcFormData.defects || null,
          remarks: qcFormData.remarks || null
        })
      });

      if (!response.ok) throw new Error('Failed to create QC Inspection');

      await Swal.fire('Success', 'QC Inspection created successfully', 'success');
      setShowQCModal(false);
      setQcFormData({
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

  return (
    <div className="space-y-6">
      <Card title="Quality Control" subtitle="Manage GRN Processing and QC Inspections">
        <div className="border-b border-slate-200 mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('grn')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                activeTab === 'grn'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 GRN Processing
            </button>
            <button
              onClick={() => setActiveTab('qc')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                activeTab === 'qc'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              ✓ QC Inspections
            </button>
          </div>
        </div>

        {activeTab === 'grn' ? (
          <div className="space-y-6">
            <div className="flex gap-4 justify-between items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search PO number or vendor..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={() => setShowGRNModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
              >
                + Create GRN
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading GRNs...</p>
            ) : grns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-3">No GRNs created yet</p>
                <button
                  type="button"
                  onClick={() => setShowGRNModal(true)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                >
                  + Create First GRN
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
                    {grns.map((grn) => (
                      <tr key={`grn-${grn.id}`} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-medium text-slate-900">GRN-{String(grn.id).padStart(4, '0')}</td>
                        <td className="px-4 py-4 text-slate-600">{grn.poNumber}</td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(grn.grnDate)}</td>
                        <td className="px-4 py-4 text-right text-slate-900 text-xs">{grn.receivedQuantity}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${grnStatusColors[grn.status]?.badge}`}>
                            {grnStatusColors[grn.status]?.label || grn.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right space-x-2">
                          <button className="px-3 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">👁 View</button>
                          <button className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium">✎ Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-4 justify-between items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by GRN number..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowQCModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                + Create QC Inspection
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading QC Inspections...</p>
            ) : qcInspections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-3">No QC Inspections created yet</p>
                <button
                  type="button"
                  onClick={() => setShowQCModal(true)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                >
                  + Create First QC Inspection
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Inspection #</th>
                      <th className="px-4 py-3 text-left font-semibold">GRN #</th>
                      <th className="px-4 py-3 text-left font-semibold">Inspection Date</th>
                      <th className="px-4 py-3 text-right font-semibold">Pass Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">Fail Qty</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qcInspections.map((qc) => (
                      <tr key={`qc-${qc.id}`} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-medium text-slate-900">QC-{String(qc.id).padStart(4, '0')}</td>
                        <td className="px-4 py-4 text-slate-600">GRN-{String(qc.grnId).padStart(4, '0')}</td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(qc.inspectionDate)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-emerald-600">{qc.passQuantity}</td>
                        <td className="px-4 py-4 text-right font-semibold text-red-600">{qc.failQuantity || 0}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${qcStatusColors[qc.status]?.badge}`}>
                            {qcStatusColors[qc.status]?.label || qc.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right space-x-2">
                          <button className="px-3 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">👁 View</button>
                          <button className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium">✎ Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-1">Pending GRNs</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pendingGrns || 0}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">QC In Progress</p>
            <p className="text-2xl font-bold text-blue-900">{stats.inProgressQc || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">QC Passed</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.passedQc || 0}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider mb-1">QC Failed</p>
            <p className="text-2xl font-bold text-red-900">{stats.failedQc || 0}</p>
          </div>
        </div>
      )}

      {showGRNModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-slate-900 text-xs">Create GRN (Goods Received Note)</h3>
              <button onClick={() => setShowGRNModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PO Number *</label>
                <input
                  type="text"
                  value={grnFormData.poNumber}
                  onChange={(e) => setGrnFormData({...grnFormData, poNumber: e.target.value})}
                  placeholder="Enter PO number"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GRN Date *</label>
                <input
                  type="date"
                  value={grnFormData.grnDate}
                  onChange={(e) => setGrnFormData({...grnFormData, grnDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Received Quantity *</label>
                <input
                  type="number"
                  value={grnFormData.receivedQuantity}
                  onChange={(e) => setGrnFormData({...grnFormData, receivedQuantity: e.target.value})}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={grnFormData.notes}
                  onChange={(e) => setGrnFormData({...grnFormData, notes: e.target.value})}
                  placeholder="Add any notes about the receipt"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows="3"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowGRNModal(false)}
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

      {showQCModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-slate-900 text-xs">Create QC Inspection</h3>
              <button onClick={() => setShowQCModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleCreateQC} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select GRN *</label>
                <select
                  value={qcFormData.grnId}
                  onChange={(e) => setQcFormData({...qcFormData, grnId: e.target.value})}
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
                  value={qcFormData.inspectionDate}
                  onChange={(e) => setQcFormData({...qcFormData, inspectionDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pass Quantity *</label>
                  <input
                    type="number"
                    value={qcFormData.passQuantity}
                    onChange={(e) => setQcFormData({...qcFormData, passQuantity: e.target.value})}
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
                    value={qcFormData.failQuantity}
                    onChange={(e) => setQcFormData({...qcFormData, failQuantity: e.target.value})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Defects/Issues</label>
                <textarea
                  value={qcFormData.defects}
                  onChange={(e) => setQcFormData({...qcFormData, defects: e.target.value})}
                  placeholder="Describe any defects or issues found"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={qcFormData.remarks}
                  onChange={(e) => setQcFormData({...qcFormData, remarks: e.target.value})}
                  placeholder="Add inspection remarks"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQCModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Create QC Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityControl;
