import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  FileText, Edit2, Trash2, Activity, Clock, 
  AlertCircle, CheckCircle2, MoreVertical, Search, Filter, Plus
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatDisplayDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const WorkOrder = () => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingWorkOrder, setViewingWorkOrder] = useState(null);
  const [woViewTab, setWoViewTab] = useState('foundation');

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate('/work-order-form');
  };

  const handleEdit = (id) => {
    navigate('/work-order-form', { state: { workOrderId: id } });
  };

  const columns = [
    {
      label: 'WO Number',
      key: 'wo_number',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    {
      label: 'Project / SO',
      key: 'project_name',
      sortable: true,
      render: (val) => <span className=" text-slate-800">{val}</span>
    },
    {
      label: 'Item Details',
      key: 'item_code',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-indigo-600">{val}</div>
          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{row.description}</div>
        </div>
      )
    },
    {
      label: 'Qty',
      key: 'quantity',
      sortable: true,
      render: (val) => <span className=" text-slate-700">{val} NOS</span>
    },
    {
      label: 'Schedule',
      key: 'start_date',
      render: (_, row) => (
        <div className="text-xs text-slate-600">
          <div>Start: {formatDisplayDate(row.start_date)}</div>
          <div>End: {formatDisplayDate(row.end_date)}</div>
        </div>
      )
    },
    {
      label: 'Progress',
      key: 'progress',
      sortable: true,
      render: (val) => (
        <div>
          <div className="w-full bg-slate-100 rounded  h-1.5 mb-1 max-w-[100px]">
            <div 
              className={`h-1.5 rounded  ${val > 80 ? 'bg-emerald-500' : val > 40 ? 'bg-blue-500' : 'bg-amber-500'}`} 
              style={{ width: `${val || 0}%` }}
            ></div>
          </div>
          <span className="text-[10px]  text-slate-500">{val || 0}%</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },

  ];

  const handleDelete = async (id) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Work Order?',
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/work-orders/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast('Work Order deleted');
          fetchWorkOrders();
        } else {
          const errorData = await response.json();
          errorToast(errorData.error || 'Failed to delete');
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl  text-slate-900 tracking-tight">Active Work Orders</h1>
            <p className="text-slate-500 text-sm  mt-1">Real-time production tracking</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2  p-2 .5 bg-emerald-50 text-emerald-600 rounded  border border-emerald-100">
              <div className="w-2 h-2 bg-emerald-500 rounded  animate-pulse"></div>
              <span className="text-xs   ">{workOrders.length} Orders Active</span>
            </div>
            <button 
              onClick={handleCreateNew}
              className="flex items-center gap-2  p-2  bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all  hover:shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm ">New Work Order</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Orders', value: workOrders.length, icon: FileText, color: 'indigo' },
            { label: 'In Progress', value: workOrders.filter(w => w.status === 'IN_PROGRESS').length, icon: Activity, color: 'blue' },
            { label: 'Pending', value: workOrders.filter(w => w.status === 'DRAFT' || w.status === 'RELEASED').length, icon: Clock, color: 'amber' },
            { label: 'Completed', value: workOrders.filter(w => w.status === 'COMPLETED').length, icon: CheckCircle2, color: 'emerald' }
          ].map((stat, i) => (
            <Card key={i} className="border-none  bg-white overflow-hidden group hover:shadow-md transition-all">
              <div className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 bg-${stat.color}-50 text-${stat.color}-600 rounded  flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px]  text-slate-400  tracking-widest">{stat.label}</p>
                  <p className="text-2xl  text-slate-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Work Orders List */}
        <Card className="border-none bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item To Manufacture</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty To Manufacture</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Planned Start Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manufacturing Progress</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Process Loss</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Work Order ID</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((wo) => {
                  const progress = wo.total_job_cards > 0 ? Math.round((wo.completed_job_cards / wo.total_job_cards) * 100) : 0;
                  return (
                    <tr key={wo.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-900 leading-tight">{wo.item_name || wo.item_code}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">BOM-{wo.bom_no || 'NA'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[11px] font-semibold ${
                          wo.status === 'IN_PROGRESS' ? 'text-amber-600' : 
                          wo.status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-500'
                        }`}>
                          {wo.status === 'IN_PROGRESS' ? 'In-Progress' : wo.status?.charAt(0) + wo.status?.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] font-bold text-slate-900">
                          {wo.quantity || 0} <span className="text-slate-400 font-normal">units</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                          {formatDisplayDate(wo.start_date)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="w-full max-w-[120px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium text-slate-600">
                              {wo.completed_job_cards || 0} / {wo.total_job_cards || 0}
                            </span>
                            <span className="text-[10px] font-bold text-blue-600">{progress}%</span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-600">
                        {wo.process_loss || '0.0'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] font-medium text-indigo-600">
                          {wo.wo_number}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => navigate(`/job-card?filter_work_order=${wo.wo_number}`)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                            title="Track Production"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleEdit(wo.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(wo.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {workOrders.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" className="px-6 p-2 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded  flex items-center justify-center">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-slate-400 text-sm italic ">No manufacturing sequences found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows per page:</span>
                <select className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer">
                  <option>50</option>
                  <option>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <span className="text-xs text-slate-500 font-medium">
                Page 1 of 1 <span className="text-slate-400 ml-1">({workOrders.length} total)</span>
              </span>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                  ← Prev
                </button>
                <button className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors border border-slate-200 rounded-md bg-white shadow-sm">
                  Next →
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Work Order Record View Modal */}
      <Modal
        isOpen={!!viewingWorkOrder}
        onClose={() => setViewingWorkOrder(null)}
        title="Work Order Record"
        maxWidth="max-w-6xl"
      >
        {viewingWorkOrder && (
          <div className="space-y-6">
            {/* Header with Status */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{viewingWorkOrder.wo_number}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{viewingWorkOrder.project_name} • {formatDisplayDate(viewingWorkOrder.created_at)}</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                viewingWorkOrder.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                viewingWorkOrder.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {viewingWorkOrder.status}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'foundation', label: '📋 Foundation', icon: true },
                { id: 'timeline', label: '📅 Timeline', icon: true },
                { id: 'operations', label: '⚙️ Operations', icon: true },
                { id: 'inventory', label: '📦 Inventory', icon: true },
                { id: 'report', label: '📊 Daily Report', icon: true }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setWoViewTab(tab.id)}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    woViewTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {woViewTab === 'foundation' && (
                <>
                  {/* Foundation Setup */}
                  <div className="border border-slate-200 rounded-lg p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span>01</span>
                      Foundation Setup
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Target Item to Manufacture</label>
                        <p className="text-sm font-semibold text-slate-900 mt-2">{viewingWorkOrder.item_name || 'N/A'}</p>
                        <p className="text-xs text-slate-400">{viewingWorkOrder.item_code}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Bill of Materials (BOM)</label>
                        <p className="text-sm font-semibold text-slate-900 mt-2">BOM-{viewingWorkOrder.bom_no || 'NA'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Quantity to Produce</label>
                        <p className="text-sm font-semibold text-slate-900 mt-2">{viewingWorkOrder.quantity || 0} <span className="text-slate-400">UNIT</span></p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Priority Level</label>
                        <p className="text-sm font-semibold text-slate-900 mt-2">{viewingWorkOrder.priority || 'Normal'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sales Order Reference */}
                  <div className="border border-slate-200 rounded-lg p-5">
                    <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Sales Order Reference</label>
                    <p className="text-sm font-semibold text-slate-900 mt-2">{viewingWorkOrder.project_name || 'N/A'}</p>
                  </div>
                </>
              )}

              {woViewTab === 'timeline' && (
                <>
                  <div className="border border-slate-200 rounded-lg p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span>02</span>
                      Production Timeline
                    </h4>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Planned Start Date</label>
                        <p className="text-sm font-semibold text-slate-900 mt-2">{formatDisplayDate(viewingWorkOrder.start_date)}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Planned Completion Date</label>
                        <p className="text-sm font-semibold text-slate-900 mt-2">{formatDisplayDate(viewingWorkOrder.end_date)}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Delivery Commitment</label>
                        <p className="text-sm font-semibold text-amber-600 mt-2">Pending Schedule</p>
                      </div>
                    </div>
                  </div>

                  {/* Efficiency Projection */}
                  <div className="border border-slate-200 rounded-lg p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span>🎯</span>
                      Efficiency Projection
                    </h4>
                    <p className="text-3xl font-bold text-slate-900">0%</p>
                    <p className="text-xs text-slate-400 mt-2">Predicted production efficiency based on workstation load.</p>
                  </div>
                </>
              )}

              {woViewTab === 'operations' && (
                <>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>03</span>
                        Operation Sequence
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Phase</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Assignment</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Time & Cost</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <span className="text-slate-900 font-semibold">No operations defined yet</span>
                            </td>
                            <td colSpan="4" className="px-4 py-2 text-center text-slate-500">Create job cards from this work order to define operations</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {woViewTab === 'inventory' && (
                <>
                  <div className="border border-slate-200 rounded-lg p-5">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span>04</span>
                      Required Inventory
                    </h4>
                    <p className="text-sm text-slate-500">Material requirements will be displayed based on the BOM.</p>
                  </div>

                  {/* Inventory Advisory */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
                    <div className="flex gap-3">
                      <span className="text-xl">ℹ️</span>
                      <div>
                        <h5 className="font-semibold text-indigo-900 mb-1">Inventory Advisory</h5>
                        <p className="text-sm text-indigo-700">System tracks real-time material transfers. Ensure all raw materials are transferred from "Stores" to "Production" before consumption.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {woViewTab === 'report' && (
                <>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>05</span>
                        Daily Production History
                      </h4>
                      <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">
                        📥 Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Shift</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Operation</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Operator</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Produced</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Accepted</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Rejected</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Downtime</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-center text-slate-500 py-8">
                            <td colSpan="8" className="px-4 py-8">
                              No production logs found for this work order yet.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <button
                onClick={() => setViewingWorkOrder(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setViewingWorkOrder(null);
                  handleEdit(viewingWorkOrder.id);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit Work Order
              </button>
            </div>
          </div>
        )}
      </Modal>


    </div>
  );
};

export default WorkOrder;

