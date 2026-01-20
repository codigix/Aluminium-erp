import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { 
  Search, 
  Plus,
  Eye,
  Edit,
  Trash2,
  X,
  Clock,
  RotateCcw,
  CheckCircle,
  XCircle,
  Inbox,
  Calendar,
  User,
  ListTodo,
  MessageSquare,
  AlertTriangle,
  FileText
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const qcStatusColors = {
  PENDING: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
  IN_PROGRESS: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
  PASSED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Passed' },
  FAILED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' },
  SHORTAGE: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Shortage' },
  ACCEPTED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Accepted' }
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

      await Swal.fire({
        title: 'Success',
        text: 'QC Inspection created successfully',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
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

      await Swal.fire({
        title: 'Updated',
        text: 'Inspection status updated successfully',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
      setShowEditModal(false);
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update QC Inspection', 'error');
    }
  };

  const handleDeleteQC = async (qcId) => {
    const result = await Swal.fire({
      title: 'Delete Inspection?',
      text: 'This action cannot be undone and will affect inventory records.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#94a3b8'
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

      await Swal.fire({
        title: 'Deleted',
        text: 'QC Inspection has been removed',
        icon: 'success',
        confirmButtonColor: '#4f46e5'
      });
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

  const StatMiniCard = ({ label, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500  tracking-wider">{label}</p>
        <p className="text-sm text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">QC Inspections</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Create Inspection
        </button>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search inspection, GRN, PO or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-500">Retrieving inspection records...</p>
            </div>
          ) : filteredQC.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm text-slate-300 mb-4">
                <Inbox className="w-8 h-8" />
              </div>
              <p className="text-slate-900 font-bold">No inspections found</p>
              <p className="text-slate-500 text-sm mt-1">
                {searchTerm ? "Try adjusting your search terms." : "Start by creating your first quality inspection."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-2 font-bold text-slate-600  tracking-wider text-[10px]">GRN #</th>
                    <th className="p-2 font-bold text-slate-600  tracking-wider text-[10px]">PO & Vendor</th>
                    <th className="p-2 text-right font-bold text-slate-600  tracking-wider text-[10px]">Total Qty</th>
                    <th className="p-2 text-right font-bold text-slate-600  tracking-wider text-[10px]">Pass/Fail</th>
                    <th className="p-2 font-bold text-slate-600  tracking-wider text-[10px]">Status</th>
                    <th className="p-2 text-right font-bold text-slate-600  tracking-wider text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredQC.map((qc) => (
                    <tr key={`qc-${qc.id}`} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="p-2 font-mono font-bold text-indigo-600">
                        GRN-{String(qc.grn_id).padStart(4, '0')}
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-900">{qc.po_number || '—'}</div>
                        <div className="text-xs text-slate-500">{qc.vendor_name || '—'}</div>
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {qc.items || 0}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-600 font-bold">{qc.pass_quantity || qc.accepted_quantity || 0}</span>
                          <span className="text-red-500 text-[10px] font-bold">Fail: {qc.fail_quantity || 0}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold  tracking-wider border ${qcStatusColors[qc.status]?.badge}`}>
                          {qcStatusColors[qc.status]?.label || qc.status}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleViewQC(qc)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shadow-sm bg-white border border-slate-100">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEditQC(qc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm bg-white border border-slate-100">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteQC(qc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shadow-sm bg-white border border-slate-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatMiniCard 
            label="Pending" 
            value={stats.pendingQc || 0} 
            icon={Clock} 
            colorClass="bg-amber-50 text-amber-600" 
          />
          <StatMiniCard 
            label="In Progress" 
            value={stats.inProgressQc || 0} 
            icon={RotateCcw} 
            colorClass="bg-blue-50 text-blue-600" 
          />
          <StatMiniCard 
            label="Passed" 
            value={stats.passedQc || 0} 
            icon={CheckCircle} 
            colorClass="bg-emerald-50 text-emerald-600" 
          />
          <StatMiniCard 
            label="Failed" 
            value={stats.failedQc || 0} 
            icon={XCircle} 
            colorClass="bg-red-50 text-red-600" 
          />
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">New QC Inspection</h3>
                  <p className="text-[10px] text-slate-500 font-medium  tracking-wider">Quality Assurance</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQC} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 tracking-wider ml-1">Select GRN *</label>
                <div className="relative">
                  <Inbox className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={formData.grnId}
                    onChange={(e) => setFormData({...formData, grnId: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    required
                  >
                    <option value="">-- Choose a pending GRN --</option>
                    {grns.map(grn => (
                      <option key={grn.id} value={grn.id}>
                        GRN-{String(grn.id).padStart(4, '0')} - {grn.poNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 tracking-wider ml-1">Inspection Date *</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={formData.inspectionDate}
                    onChange={(e) => setFormData({...formData, inspectionDate: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 tracking-wider ml-1">Pass Qty *</label>
                  <div className="relative">
                    <CheckCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input
                      type="number"
                      value={formData.passQuantity}
                      onChange={(e) => setFormData({...formData, passQuantity: e.target.value})}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                      min="0"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500 tracking-wider ml-1">Fail Qty</label>
                  <div className="relative">
                    <XCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                    <input
                      type="number"
                      value={formData.failQuantity}
                      onChange={(e) => setFormData({...formData, failQuantity: e.target.value})}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 tracking-wider ml-1">Defects Found</label>
                <div className="relative">
                  <AlertTriangle className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <textarea
                    value={formData.defects}
                    onChange={(e) => setFormData({...formData, defects: e.target.value})}
                    placeholder="Describe any quality issues..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[60px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 tracking-wider ml-1">Remarks</label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    placeholder="General inspection notes..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[60px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Create Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedQC && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <EyeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Inspection Details</h3>
                  <p className="text-[10px] text-slate-500 font-medium  tracking-wider">GRN-{String(selectedQC.grn_id).padStart(4, '0')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500  tracking-wider">PO Number</p>
                    <p className="text-sm font-bold text-slate-900">{selectedQC.po_number || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500  tracking-wider">Vendor</p>
                    <p className="text-sm font-bold text-slate-900">{selectedQC.vendor_name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500  tracking-wider">Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold  tracking-wider border ${qcStatusColors[selectedQC.status]?.badge}`}>
                      {qcStatusColors[selectedQC.status]?.label || selectedQC.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatMiniCard label="Items Ordered" value={selectedQC.items || 0} icon={ListTodo} colorClass="bg-blue-50 text-blue-600" />
                <StatMiniCard label="Accepted" value={selectedQC.accepted_quantity || 0} icon={CheckCircle} colorClass="bg-emerald-50 text-emerald-600" />
                <StatMiniCard label="Pass Qty" value={selectedQC.pass_quantity || 0} icon={CheckCircle} colorClass="bg-indigo-50 text-indigo-600" />
                <StatMiniCard label="Fail Qty" value={selectedQC.fail_quantity || 0} icon={XCircle} colorClass="bg-red-50 text-red-600" />
                <StatMiniCard label="Shortage" value={selectedQC.shortage || 0} icon={AlertTriangle} colorClass="bg-orange-50 text-orange-600" />
              </div>

              {selectedQC.items_detail && selectedQC.items_detail.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900  tracking-[0.2em]">Items Verification</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-bold text-slate-600  tracking-wider text-[10px]">Item Code</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-600  tracking-wider text-[10px]">Ordered</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-600  tracking-wider text-[10px]">Received</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-600  tracking-wider text-[10px]">Shortage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedQC.items_detail.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{item.item_code || 'N/A'}</p>
                              {item.description && <p className="text-[10px] text-slate-500 ">{item.description}</p>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">{item.ordered_qty}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{item.received_qty}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-orange-600">{item.shortage || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600  tracking-wider mb-2">Defects Identified</p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {selectedQC.defects || "No specific defects reported."}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600  tracking-wider mb-2">Final Remarks</p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    {selectedQC.remarks || "No additional remarks."}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedQC && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Update Status</h3>
                  <p className="text-[10px] text-slate-500 font-medium  tracking-wider">QC-{String(selectedQC.id).padStart(4, '0')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateQC} className="p-6 space-y-3">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold  tracking-wider">Pass Quantity:</span>
                  <span className="text-emerald-600 font-bold">{selectedQC.pass_quantity}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-bold  tracking-wider">Fail Quantity:</span>
                  <span className="text-red-500 font-bold">{selectedQC.fail_quantity || 0}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 tracking-wider ml-1">Update Decision Status *</label>
                <div className="relative">
                  <RotateCcw className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    required
                  >
                    <option value="">-- Select Status --</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PASSED">Passed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Update Decision
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
