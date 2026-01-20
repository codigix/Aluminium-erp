import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { 
  Archive, 
  Shield, 
  Search, 
  Plus,
  Eye,
  Edit,
  X,
  Clock,
  RotateCcw,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  User,
  Inbox,
  ArrowUpRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const grnStatusColors = {
  PENDING: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
  RECEIVED: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Received' },
  INSPECTED: { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Inspected' },
  APPROVED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Approved' },
  REJECTED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' }
};

const qcStatusColors = {
  PENDING: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
  IN_PROGRESS: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
  PASSED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Passed' },
  FAILED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const QualityControl = () => {
  const [activeTab, setActiveTab] = useState('grn');
  const [grns, setGrns] = useState([]);
  const [qcInspections, setQcInspections] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);

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

      await Swal.fire({
        title: 'Success',
        text: 'GRN created successfully',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
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

      await Swal.fire({
        title: 'Success',
        text: 'QC Inspection created successfully',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
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

  const StatMiniCard = ({ label, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
          <button
            onClick={() => setActiveTab('grn')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'grn'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            GRN Processing
          </button>
          <button
            onClick={() => setActiveTab('qc')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'qc'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            QC Inspections
          </button>
        </div>

        <button
          onClick={() => activeTab === 'grn' ? setShowGRNModal(true) : setShowQCModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'grn' ? 'Create GRN' : 'New Inspection'}
        </button>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center pb-2">
            <div className="relative w-full md:w-96">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === 'grn' ? "Search PO number or vendor..." : "Search by GRN number..."}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-500">Retrieving quality data...</p>
            </div>
          ) : (activeTab === 'grn' ? grns : qcInspections).length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm text-slate-300 mb-4">
                <Inbox className="w-8 h-8" />
              </div>
              <p className="text-slate-900 font-bold">No records found</p>
              <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                {activeTab === 'grn' 
                  ? "Start by creating a Goods Received Note for incoming material."
                  : "Pending GRNs will appear here for quality inspection."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  {activeTab === 'grn' ? (
                    <tr>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">GRN #</th>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">PO Number</th>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">GRN Date</th>
                      <th className="p-2 text-right font-bold text-slate-600 uppercase tracking-wider text-[10px]">Received Qty</th>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="p-2 text-right font-bold text-slate-600 uppercase tracking-wider text-[10px]">Actions</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Inspection #</th>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">GRN #</th>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Inspection Date</th>
                      <th className="p-2 text-right font-bold text-slate-600 uppercase tracking-wider text-[10px]">Pass Qty</th>
                      <th className="p-2 text-right font-bold text-slate-600 uppercase tracking-wider text-[10px]">Fail Qty</th>
                      <th className="p-2 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="p-2 text-right font-bold text-slate-600 uppercase tracking-wider text-[10px]">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activeTab === 'grn' ? (
                    grns.map((grn) => (
                      <tr key={`grn-${grn.id}`} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="p-2 font-mono font-bold text-indigo-600">
                          GRN-{String(grn.id).padStart(4, '0')}
                        </td>
                        <td className="p-2 font-medium text-slate-700">{grn.poNumber}</td>
                        <td className="p-2 text-slate-500">{formatDate(grn.grnDate)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{grn.receivedQuantity}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${grnStatusColors[grn.status]?.badge}`}>
                            {grnStatusColors[grn.status]?.label || grn.status}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    qcInspections.map((qc) => (
                      <tr key={`qc-${qc.id}`} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="p-2 font-mono font-bold text-indigo-600">
                          QC-{String(qc.id).padStart(4, '0')}
                        </td>
                        <td className="p-2 font-mono text-slate-500">
                          GRN-{String(qc.grnId).padStart(4, '0')}
                        </td>
                        <td className="p-2 text-slate-500">{formatDate(qc.inspectionDate)}</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-600">{qc.passQuantity}</td>
                        <td className="p-2 text-right font-mono font-bold text-red-600">{qc.failQuantity || 0}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${qcStatusColors[qc.status]?.badge}`}>
                            {qcStatusColors[qc.status]?.label || qc.status}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatMiniCard 
            label="Pending GRNs" 
            value={stats.pendingGrns || 0} 
            icon={Clock} 
            colorClass="bg-amber-50 text-amber-600" 
          />
          <StatMiniCard 
            label="QC In Progress" 
            value={stats.inProgressQc || 0} 
            icon={RotateCcw} 
            colorClass="bg-blue-50 text-blue-600" 
          />
          <StatMiniCard 
            label="QC Passed" 
            value={stats.passedQc || 0} 
            icon={CheckCircle} 
            colorClass="bg-emerald-50 text-emerald-600" 
          />
          <StatMiniCard 
            label="QC Failed" 
            value={stats.failedQc || 0} 
            icon={XCircle} 
            colorClass="bg-red-50 text-red-600" 
          />
        </div>
      )}

      {/* GRN Modal */}
      {showGRNModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Goods Received Note</h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Inventory Inward</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGRNModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">PO Number *</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={grnFormData.poNumber}
                      onChange={(e) => setGrnFormData({...grnFormData, poNumber: e.target.value})}
                      placeholder="PO-2024-XXXX"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">GRN Date *</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={grnFormData.grnDate}
                      onChange={(e) => setGrnFormData({...grnFormData, grnDate: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Received Quantity *</label>
                  <div className="relative">
                    <ArchiveBoxIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={grnFormData.receivedQuantity}
                      onChange={(e) => setGrnFormData({...grnFormData, receivedQuantity: e.target.value})}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Notes (Optional)</label>
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={grnFormData.notes}
                      onChange={(e) => setGrnFormData({...grnFormData, notes: e.target.value})}
                      placeholder="Material condition, vehicle number, etc."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[80px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowGRNModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Complete Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC Modal */}
      {showQCModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <CheckBadgeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create QC Inspection</h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Quality Verification</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQCModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQC} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select GRN *</label>
                  <div className="relative">
                    <Inbox className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={qcFormData.grnId}
                      onChange={(e) => setQcFormData({...qcFormData, grnId: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                      required
                    >
                      <option value="">-- Choose a pending GRN --</option>
                      {grns.map(grn => (
                        <option key={grn.id} value={grn.id}>
                          GRN-{String(grn.id).padStart(4, '0')} ({grn.receivedQuantity} units)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Inspection Date *</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={qcFormData.inspectionDate}
                      onChange={(e) => setQcFormData({...qcFormData, inspectionDate: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Pass Quantity *</label>
                    <div className="relative">
                      <CheckCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      <input
                        type="number"
                        value={qcFormData.passQuantity}
                        onChange={(e) => setQcFormData({...qcFormData, passQuantity: e.target.value})}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Fail Quantity</label>
                    <div className="relative">
                      <XCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                      <input
                        type="number"
                        value={qcFormData.failQuantity}
                        onChange={(e) => setQcFormData({...qcFormData, failQuantity: e.target.value})}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Defects & Issues</label>
                  <div className="relative">
                    <ArrowUpRight className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={qcFormData.defects}
                      onChange={(e) => setQcFormData({...qcFormData, defects: e.target.value})}
                      placeholder="Specify visual defects, dimensional errors..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[60px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Remarks</label>
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={qcFormData.remarks}
                      onChange={(e) => setQcFormData({...qcFormData, remarks: e.target.value})}
                      placeholder="Final decision notes..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[60px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowQCModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  Submit Inspection
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
