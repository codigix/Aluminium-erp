import { useState, useEffect, useCallback } from 'react';
import { Card, DataTable, Modal, FormControl } from '../components/ui.jsx';
import { Beaker, Clock, Inbox, Search, CheckCircle2, Eye, Edit, Trash2, ListTodo, AlertTriangle, RefreshCw, X, CheckCircle, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const qcStatusColors = {
  PENDING: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
  IN_PROGRESS: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
  PASSED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Passed' },
  FAILED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' },
  SHORTAGE: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Shortage' },
  ACCEPTED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Accepted' }
};

const IncomingQC = ({ initialTab = 'incoming' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [qcInspections, setQcInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedQC, setSelectedQC] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    status: '',
    remarks: '',
    defects: '',
    passQuantity: '',
    failQuantity: ''
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchQCInspections = useCallback(async () => {
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
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          totalInspections: data.totalQc || 0,
          passed: (data.passedQc || 0) + (data.acceptedQc || 0),
          failed: data.failedQc || 0,
          pending: data.pendingQc || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'incoming') {
      fetchQCInspections();
      fetchStats();
    }
  }, [activeTab, fetchQCInspections, fetchStats]);

  const handleViewQC = (qc) => {
    setSelectedQC(qc);
    setShowViewModal(true);
  };

  const handleEditQC = (qc) => {
    setSelectedQC(qc);
    setEditFormData({
      status: qc.status || 'PENDING',
      remarks: qc.remarks || '',
      defects: qc.defects || '',
      passQuantity: qc.pass_quantity || qc.accepted_quantity || 0,
      failQuantity: qc.fail_quantity || 0
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
        body: JSON.stringify(editFormData)
      });

      if (!response.ok) throw new Error('Failed to update inspection');

      successToast('Inspection updated successfully');
      setShowEditModal(false);
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDeleteQC = async (qcId) => {
    const result = await Swal.fire({
      title: 'Delete Inspection?',
      text: 'This action cannot be undone.',
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

      successToast('QC Inspection has been removed');
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const columns = [
    {
      label: 'GRN #',
      key: 'grn_id',
      sortable: true,
      render: (val) => (
        <span className="font-mono font-medium text-indigo-600">
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
          <div className="font-medium text-slate-900">{val || '—'}</div>
          <div className="text-[10px] text-slate-500">{row.vendor_name || '—'}</div>
        </div>
      )
    },
    {
      label: 'Pass/Fail',
      key: 'pass_quantity',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex flex-col items-end">
          <span className="text-emerald-600 font-medium">{val || row.accepted_quantity || 0}</span>
          <span className="text-red-500 text-[10px]">Fail: {row.fail_quantity || 0}</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider border ${qcStatusColors[val]?.badge}`}>
          {qcStatusColors[val]?.label || val}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); handleViewQC(row); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors bg-white border border-slate-100">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEditQC(row); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors bg-white border border-slate-100">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteQC(val); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-white border border-slate-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  const tabs = [
    { id: 'incoming', label: 'Incoming QC', icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'in-process', label: 'In-Process QC', icon: Search, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'final', label: 'Final QC', icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'incoming':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Inspections</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalInspections || qcInspections.length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Passed</p>
                <p className="text-2xl font-bold text-emerald-600">{stats?.passed || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats?.failed || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</p>
              </div>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Incoming Inspection Queue</h3>
                <button 
                  onClick={() => { fetchQCInspections(); fetchStats(); }}
                  className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <DataTable
                columns={columns}
                data={qcInspections}
                loading={loading}
                searchPlaceholder="Search by GRN or PO..."
              />
            </Card>
          </div>
        );
      case 'in-process':
        return (
          <Card title="In-Process Quality Control" subtitle="Real-time production quality monitoring and line inspections">
            <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Beaker className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <h3 className="text-slate-900 font-bold">In-Process Quality Control</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-xs text-center">
                The real-time production monitoring module is currently under development.
              </p>
              <div className="mt-6 px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-200">
                Feature Coming Soon
              </div>
            </div>
          </Card>
        );
      case 'final':
        return (
          <Card title="Final Quality Control" subtitle="Post-production quality clearance and certification">
            <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="relative mb-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Beaker className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <h3 className="text-slate-900 font-bold">Final Quality Control</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-xs text-center">
                The post-production quality clearance module is currently under development.
              </p>
              <div className="mt-6 px-4 py-1.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-indigo-200">
                Feature Coming Soon
              </div>
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Quality Control</h1>
        <p className="text-sm text-slate-500">Manage raw material, in-process, and final quality inspections.</p>
      </div>

      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
        {renderContent()}
      </div>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Inspection Details - GRN-${String(selectedQC?.grn_id).padStart(4, '0')}`}
        size="6xl"
      >
        {selectedQC && (
          <div className="space-y-8 p-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black tracking-wider border ${qcStatusColors[selectedQC.status]?.badge}`}>
                  {qcStatusColors[selectedQC.status]?.label || selectedQC.status}
                </span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">PO Number</p>
                <p className="text-sm font-black text-slate-900">{selectedQC.po_number || '—'}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Pass Quantity</p>
                <p className="text-sm font-black text-emerald-600">{selectedQC.pass_quantity || selectedQC.accepted_quantity || 0}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Fail Quantity</p>
                <p className="text-sm font-black text-red-600">{selectedQC.fail_quantity || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                    <ListTodo className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Items Verification</h4>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Item wise quality check results</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80">
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                        <th className="px-6 py-4">Item Details</th>
                        <th className="px-4 py-4">Warehouse</th>
                        <th className="px-4 py-4 text-center">Design Qty</th>
                        <th className="px-4 py-4 text-center">Received</th>
                        <th className="px-4 py-4 text-center">Accepted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedQC.items_detail?.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50/30 transition-all">
                          <td className="px-6 py-4">
                            <div className="font-black text-slate-900 text-xs">{item.item_code}</div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 truncate max-w-[200px]">{item.material_name || item.description}</div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                              {item.warehouse_name || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-black text-slate-400 text-xs">{parseFloat(item.ordered_qty || 0).toFixed(3)}</td>
                          <td className="px-4 py-4 text-center font-black text-slate-600 text-xs">{parseFloat(item.received_qty || 0).toFixed(3)}</td>
                          <td className="px-4 py-4 text-center font-black text-emerald-600 text-xs">{parseFloat(item.accepted_qty || 0).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-100/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Defects</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white/50 p-4 rounded-2xl border border-amber-50">
                    {selectedQC.defects || "No specific defects reported."}
                  </p>
                </div>

                <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                      <Beaker className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Remarks</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic font-medium bg-white/50 p-4 rounded-2xl border border-blue-50">
                    "{selectedQC.remarks || 'Auto-created inspection record.'}"
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-50">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Update QC Inspection"
      >
        <form onSubmit={handleUpdateQC} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Pass Quantity">
              <input
                type="number"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={editFormData.passQuantity}
                onChange={(e) => setEditFormData({ ...editFormData, passQuantity: e.target.value })}
                required
              />
            </FormControl>
            <FormControl label="Fail Quantity">
              <input
                type="number"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={editFormData.failQuantity}
                onChange={(e) => setEditFormData({ ...editFormData, failQuantity: e.target.value })}
              />
            </FormControl>
          </div>

          <FormControl label="Inspection Status">
            <select
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              required
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PASSED">Passed</option>
              <option value="FAILED">Failed</option>
              <option value="ACCEPTED">Accepted (with minor defects)</option>
              <option value="SHORTAGE">Shortage</option>
            </select>
          </FormControl>

          <FormControl label="Defects identified">
            <textarea
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
              value={editFormData.defects}
              onChange={(e) => setEditFormData({ ...editFormData, defects: e.target.value })}
              placeholder="Describe any quality issues..."
            />
          </FormControl>

          <FormControl label="Additional Remarks">
            <textarea
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={editFormData.remarks}
              onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
            >
              Update Inspection
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default IncomingQC;
