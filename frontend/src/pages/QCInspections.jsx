import { useState, useEffect } from 'react';
import { Card, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { 
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
  ListTodo,
  MessageSquare,
  AlertTriangle,
  FileText,
  User
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

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
      errorToast('Please fill in required fields');
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

      successToast('QC Inspection created successfully');
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
      errorToast(error.message || 'Failed to create QC Inspection');
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

      successToast('Inspection status updated successfully');
      setShowEditModal(false);
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update QC Inspection');
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

      successToast('QC Inspection has been removed');
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete QC Inspection');
    }
  };

  const columns = [
    {
      label: 'GRN #',
      key: 'grn_id',
      sortable: true,
      render: (val) => (
        <span className="   text-indigo-600">
          GRN-{String(val).padStart(4, '0')}
        </span>
      )
    },
    {
      label: 'PO & Vendor',
      key: 'po_number',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-slate-900">{val || '—'}</div>
          <div className="text-xs text-slate-500">{row.vendor_name || '—'}</div>
        </div>
      )
    },
    {
      label: 'Total Qty',
      key: 'items',
      className: 'text-right',
      sortable: true,
      render: (val) => <span className="   text-slate-900">{val || 0}</span>
    },
    {
      label: 'Pass/Fail',
      key: 'pass_quantity',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex flex-col items-end">
          <span className="text-emerald-600 ">
            {row.status === 'PENDING' ? 'Pending' : (val || row.accepted_quantity || 0)}
          </span>
          <span className="text-red-500text-xs  ">Fail: {row.fail_quantity || 0}</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs    border ${qcStatusColors[val]?.badge}`}>
          {qcStatusColors[val]?.label || val}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); handleViewQC(row); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-colors  bg-white border border-slate-100">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEditQC(row); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded  transition-colors  bg-white border border-slate-100">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteQC(val); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded  transition-colors  bg-white border border-slate-100">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const renderExpanded = (qc) => (
    <div className="p-6 bg-slate-50/50 rounded  m-2 border border-slate-200 animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2  mb-2">
            <ListTodo className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs  text-slate-900  ">Items Verification</h4>
          </div>
          
          {qc.items_detail && qc.items_detail.length > 0 ? (
            <div className="bg-white rounded  border border-slate-200 overflow-hidden ">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200text-xs   text-slate-500 ">
                  <tr>
                    <th className="p-2  text-left">Item Code</th>
                    <th className="p-2  text-right">Ordered</th>
                    <th className="p-2  text-right">Received</th>
                    <th className="p-2  text-right">Shortage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {qc.items_detail.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 ">
                        <div className=" text-slate-900">{item.item_code}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{item.description}</div>
                      </td>
                      <td className="p-2  text-right   text-slate-600">{item.ordered_qty}</td>
                      <td className="p-2  text-right    text-emerald-600">{item.received_qty}</td>
                      <td className="p-2  text-right    text-orange-600">{item.shortage || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 bg-white rounded  border border-slate-200 border-dashed">
              <p className="text-xs text-slate-400 ">No item breakdown available</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded  border border-slate-200 ">
              <p className="text-[10px]  text-slate-400   mb-1">Pass Quantity</p>
              <p className="text-sm  text-emerald-600">
                {qc.status === 'PENDING' ? 'Pending' : (qc.pass_quantity || qc.accepted_quantity || 0)}
              </p>
            </div>
            <div className="p-3 bg-white rounded  border border-slate-200 ">
              <p className="text-[10px]  text-slate-400   mb-1">Fail Quantity</p>
              <p className="text-sm  text-red-600">{qc.fail_quantity || 0}</p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded  border border-amber-100">
            <div className="flex items-center gap-2  mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-[10px]  text-amber-600  ">Defects Identified</p>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed ">
              {qc.defects || "No specific defects reported."}
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded  border border-blue-100">
            <div className="flex items-center gap-2  mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-[10px]  text-blue-600  ">Final Remarks</p>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed ">
              {qc.remarks || "No additional remarks."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const StatMiniCard = ({ label, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-4 rounded  border border-slate-200  flex items-center gap-4 transition-all hover:shadow-md hover:border-indigo-100 group">
      <div className={`p-2.5 rounded  transition-colors ${colorClass} group-hover:scale-110 duration-300`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px]  text-slate-500  ">{label}</p>
        <p className="text-sm  text-slate-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl text-slate-900">QC Inspections</h2>
          <p className="text-xs text-slate-500 ">Monitor and manage quality control checks</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded  text-sm  shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Create Inspection
        </button>
      </div>

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

      <DataTable
        columns={columns}
        data={qcInspections}
        loading={loading}
        searchPlaceholder="Search inspection, GRN, PO or vendor..."
        renderExpanded={renderExpanded}
      />

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded  shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2 ">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm  text-slate-900">New QC Inspection</h3>
                  <p className="text-[10px] text-slate-500  ">Quality Assurance</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQC} className="p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500  ml-1">Select GRN *</label>
                  <div className="relative">
                    <Inbox className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={formData.grnId}
                      onChange={(e) => setFormData({...formData, grnId: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
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
                  <label className="text-xs text-slate-500  ml-1">Inspection Date *</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={formData.inspectionDate}
                      onChange={(e) => setFormData({...formData, inspectionDate: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500  ml-1">Pass Qty *</label>
                    <div className="relative">
                      <CheckCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      <input
                        type="number"
                        value={formData.passQuantity}
                        onChange={(e) => setFormData({...formData, passQuantity: e.target.value})}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        required
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-500  ml-1">Fail Qty</label>
                    <div className="relative">
                      <XCircle className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                      <input
                        type="number"
                        value={formData.failQuantity}
                        onChange={(e) => setFormData({...formData, failQuantity: e.target.value})}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500  ml-1">Defects Found</label>
                  <div className="relative">
                    <AlertTriangle className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={formData.defects}
                      onChange={(e) => setFormData({...formData, defects: e.target.value})}
                      placeholder="Describe any quality issues..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[60px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-500  ml-1">Remarks</label>
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                      placeholder="General inspection notes..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[60px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 text-sm  text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 text-white rounded  text-sm  shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
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
          <div className="bg-white rounded  shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-2 ">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm  text-slate-900">Inspection Details</h3>
                  <p className="text-[10px] text-slate-500  ">GRN-{String(selectedQC.grn_id).padStart(4, '0')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded  text-slate-500">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px]  text-slate-500  ">PO Number</p>
                    <p className="text-sm  text-slate-900">{selectedQC.po_number || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded  text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px]  text-slate-500  ">Vendor</p>
                    <p className="text-sm  text-slate-900">{selectedQC.vendor_name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded  text-slate-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px]  text-slate-500  ">Status</p>
                    <span className={`inline-flex items-center p-1  rounded text-xs    border ${qcStatusColors[selectedQC.status]?.badge}`}>
                      {qcStatusColors[selectedQC.status]?.label || selectedQC.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatMiniCard label="Items Ordered" value={selectedQC.items || 0} icon={ListTodo} colorClass="bg-blue-50 text-blue-600" />
                <StatMiniCard label="Accepted" value={selectedQC.status === 'PENDING' ? 'Pending' : (selectedQC.accepted_quantity || 0)} icon={CheckCircle} colorClass="bg-emerald-50 text-emerald-600" />
                <StatMiniCard label="Pass Qty" value={selectedQC.status === 'PENDING' ? 'Pending' : (selectedQC.pass_quantity || 0)} icon={CheckCircle} colorClass="bg-indigo-50 text-indigo-600" />
                <StatMiniCard label="Fail Qty" value={selectedQC.fail_quantity || 0} icon={XCircle} colorClass="bg-red-50 text-red-600" />
                <StatMiniCard label="Shortage" value={selectedQC.shortage || 0} icon={AlertTriangle} colorClass="bg-orange-50 text-orange-600" />
              </div>

              {selectedQC.items_detail && selectedQC.items_detail.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs  text-slate-900 tracking-[0.2em] ">Items Verification</h4>
                  <div className="overflow-hidden rounded  border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2   text-slate-600 text-xs  ">Item Code</th>
                          <th className="p-2  text-right  text-slate-600 text-xs  ">Ordered</th>
                          <th className="p-2  text-right  text-slate-600 text-xs  ">Received</th>
                          <th className="p-2  text-right  text-slate-600 text-xs  ">Shortage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedQC.items_detail.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 ">
                              <p className=" text-slate-900">{item.item_code || 'N/A'}</p>
                              {item.description && <p className="text-[10px] text-slate-500 truncate max-w-xs">{item.description}</p>}
                            </td>
                            <td className="p-2  text-right   text-slate-600">{item.ordered_qty}</td>
                            <td className="p-2  text-right    text-emerald-600">{item.received_qty}</td>
                            <td className="p-2  text-right    text-orange-600">{item.shortage || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                <div className="p-4 bg-amber-50 rounded  border border-amber-100">
                  <p className="text-[10px]  text-amber-600   mb-2">Defects Identified</p>
                  <p className="text-sm text-slate-700 leading-relaxed ">
                    {selectedQC.defects || "No specific defects reported."}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded  border border-blue-100">
                  <p className="text-[10px]  text-blue-600   mb-2">Final Remarks</p>
                  <p className="text-sm text-slate-700 leading-relaxed ">
                    {selectedQC.remarks || "No additional remarks."}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 bg-white border border-slate-200 text-slate-700 rounded  text-sm   hover:bg-slate-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedQC && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded  shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2 ">
                <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm  text-slate-900">Update Status</h3>
                  <p className="text-[10px] text-slate-500  ">QC-{String(selectedQC.id).padStart(4, '0')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateQC} className="p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500  ml-1">Inspection Status *</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                      required
                    >
                      {Object.keys(qcStatusColors).map(status => (
                        <option key={status} value={status}>
                          {qcStatusColors[status].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded  border border-slate-100">
                  <p className="text-[10px]  text-slate-500   mb-2">Note</p>
                  <p className="text-xs text-slate-600 italic">
                    Updating the status will affect the inventory availability and quality reports.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-sm  text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 text-white rounded  text-sm  shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Update Status
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

