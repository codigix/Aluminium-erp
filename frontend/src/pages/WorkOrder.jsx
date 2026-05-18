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
import { cleanProjectName } from '../utils/formatters.js';

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
    navigate('/production/work-order/edit-work');
  };

  const handleEdit = (id) => {
    navigate(`/production/work-order/edit-work?id=${id}`);
  };

  const sortedWorkOrders = React.useMemo(() => {
    const getSourcePriority = (type) => {
      const t = (type || '').toLowerCase();
      if (t.includes('assembly') || t === 'sa') return 1;
      if (t.includes('finish') || t === 'fg') return 2;
      return 3;
    };

    // 1. Group items by batch and find the latest ID in each batch
    const groups = {};
    workOrders.forEach(wo => {
      const groupKey = wo.plan_id ? `plan_${wo.plan_id}` : (wo.parent_wo_id ? `parent_${wo.parent_wo_id}` : `wo_${wo.id}`);
      if (!groups[groupKey]) {
        groups[groupKey] = { latestId: 0, items: [] };
      }
      groups[groupKey].items.push(wo);
      const currentId = Number(wo.id) || 0;
      if (currentId > groups[groupKey].latestId) {
        groups[groupKey].latestId = currentId;
      }
    });

    // 2. Sort groups by their latest ID (newest batch first)
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => groups[b].latestId - groups[a].latestId);

    // 3. Within each group, sort by SA first, then ID ASC
    const result = [];
    sortedGroupKeys.forEach(key => {
      const groupedItems = groups[key].items.sort((a, b) => {
        const aPrio = getSourcePriority(a.source_type);
        const bPrio = getSourcePriority(b.source_type);
        if (aPrio !== bPrio) return aPrio - bPrio;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      });
      result.push(...groupedItems);
    });

    return result;
  }, [workOrders]);

  const columns = [
    {
      label: 'Work Order ID',
      key: 'wo_number',
      sortable: true,
      render: (val) => <span className="text-indigo-600 ">{val}</span>
    },
    {
      label: 'Project / Client',
      key: 'project_name',
      sortable: true,
      render: (val, row) => {
        const displayProject = cleanProjectName(row.project_name, row.client_name);
        return (
          <div className="flex flex-col">
            <span className="text-xs text-slate-900 leading-tight " title={displayProject}>{displayProject}</span>
          </div>
        );
      }
    },
    {
      label: 'Specification',
      key: 'source_type',
      render: (val) => (
        <span className={`text-[10px]  ${
          val === 'SA' ? 'text-amber-600' : 'text-indigo-600'
        }`}>
          {val === 'ASSEMBLY' || val === 'SA' ? 'ASSEMBLY' : 'PART'}
        </span>
      )
    },
    {
      label: 'Item To Manufacture',
      key: 'item_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900 leading-tight">{val || row.item_code}</span>
          {row.source_type === 'SA' && row.source_fg && (
            <span className="text-[9px] text-slate-500 italic mt-0.5">
              <span className="text-indigo-600 not-italic ">{row.source_fg}</span>
            </span>
          )}
          <span className="text-[9px] text-slate-400 mt-0.5">BOM-{row.bom_no || 'NA'}</span>
        </div>
      )
    },
    {
      label: 'Qty',
      key: 'quantity',
      sortable: true,
      render: (val) => <span className="text-slate-900 ">{val} <span className="text-slate-400 font-normal text-xs ">units</span></span>
    },
    {
      label: 'Planned Start',
      key: 'start_date',
      render: (val) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-300" />
          {formatDisplayDate(val)}
        </div>
      )
    },
    {
      label: 'Progress',
      key: 'progress',
      sortable: true,
      render: (_, row) => {
        const progress = row.total_job_cards > 0 ? Math.round((row.completed_job_cards / row.total_job_cards) * 100) : 0;
        return (
          <div className="w-full ">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs  text-slate-500">
                {row.completed_job_cards || 0}/{row.total_job_cards || 0}
              </span>
              <span className="text-xs   text-blue-600">{progress}%</span>
            </div>
            <div className="h-1 w-full ">
              <div 
                className="h-full bg-blue-500  transition-all duration-500" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        );
      }
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={() => navigate(`/production/job-card?filter_work_order=${row.wo_number}`)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
            title="Track Production"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleEdit(row.id)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleDelete(row.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover: rounded transition-all"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
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
    <div className="min-h-screen">
      {/* Header Section */}
      <div className="">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl  text-slate-900 ">Active Work Orders</h1>
            <p className="text-slate-500 text-xs  mt-1">Real-time production tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2  p-2 .5 bg-emerald-50 text-emerald-600 rounded  border border-emerald-100">
              <div className="w-2 h-2 bg-emerald-500 rounded  animate-pulse"></div>
              <span className="text-xs   ">{workOrders.length} Orders Active</span>
            </div>
            <button 
              onClick={handleCreateNew}
              className="flex items-center gap-2  p-2  bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-all  hover:shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs ">New Work Order</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-8">
          {[
            { label: 'Total Orders', value: workOrders.length, icon: FileText, color: 'indigo' },
            { label: 'In Progress', value: workOrders.filter(w => w.status === 'IN_PROGRESS').length, icon: Activity, color: 'blue' },
            { label: 'Pending', value: workOrders.filter(w => w.status === 'DRAFT' || w.status === 'RELEASED').length, icon: Clock, color: 'amber' },
            { label: 'Completed', value: workOrders.filter(w => w.status === 'COMPLETED').length, icon: CheckCircle2, color: 'emerald' }
          ].map((stat, i) => (
            <Card key={i} className="border-none  bg-white overflow-hidden group hover: transition-all">
              <div className="p-2 flex items-center gap-2">
                <div className={`p-2 bg-${stat.color}-50 text-${stat.color}-600 rounded  flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-3 h-3" />
                </div>
                <div>
                  <p className="text-xs  text-slate-400  ">{stat.label}</p>
                  <p className="text-xl  text-slate-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Work Orders List */}
       
          <DataTable
            columns={columns}
            data={sortedWorkOrders}
            loading={loading}
            searchPlaceholder="Search by Work Order, Project, or Item..."
            searchKey="wo_number"
          />
        
      </div>

      {/* Work Order Record View Modal */}
      <Modal
        isOpen={!!viewingWorkOrder}
        onClose={() => setViewingWorkOrder(null)}
        title="Work Order Record"
        maxWidth="max-w-6xl"
      >
        {viewingWorkOrder && (
          <div className="space-y-2">
            {/* Header with Status */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center">
                  <FileText className="p-2" />
                </div>
                <div>
                  <h3 className="text-md  text-slate-900">{viewingWorkOrder.wo_number}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{cleanProjectName(viewingWorkOrder.project_name, viewingWorkOrder.client_name)} • {formatDisplayDate(viewingWorkOrder.created_at)}</p>
                </div>
              </div>
              <span className={`p-2 rounded text-xs  ${
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
                  className={`p-1 text-xs  border-b-2 transition-colors ${
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
            <div className="space-y-2">
              {woViewTab === 'foundation' && (
                <>
                  {/* Foundation Setup */}
                  <div className="border border-slate-200 rounded  p-5">
                    <h4 className="text-xs  text-slate-900 mb-4 flex items-center gap-2">
                      <span>01</span>
                      Foundation Setup
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs text-slate-500   ">Target Item to Manufacture</label>
                        <p className="text-sm  text-slate-900 mt-2">{viewingWorkOrder.item_name || 'N/A'}</p>
                        <p className="text-xs text-slate-400">{viewingWorkOrder.item_code}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500   ">Bill of Materials (BOM)</label>
                        <p className="text-sm  text-slate-900 mt-2">BOM-{viewingWorkOrder.bom_no || 'NA'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500   ">Quantity to Produce</label>
                        <p className="text-sm  text-slate-900 mt-2">{viewingWorkOrder.quantity || 0} <span className="text-slate-400">UNIT</span></p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500   ">Priority Level</label>
                        <p className="text-sm  text-slate-900 mt-2">{viewingWorkOrder.priority || 'Normal'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sales Order Reference */}
                  <div className="border border-slate-200 rounded  p-5">
                    <label className="text-xs text-slate-500   ">Sales Order Reference</label>
                    <p className="text-sm  text-slate-900 mt-2">{cleanProjectName(viewingWorkOrder.project_name, viewingWorkOrder.client_name)}</p>
                  </div>
                </>
              )}

              {woViewTab === 'timeline' && (
                <>
                  <div className="border border-slate-200 rounded  p-5">
                    <h4 className="text-xs  text-slate-900 mb-4 flex items-center gap-2">
                      <span>02</span>
                      Production Timeline
                    </h4>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="text-xs text-slate-500   ">Planned Start Date</label>
                        <p className="text-sm  text-slate-900 mt-2">{formatDisplayDate(viewingWorkOrder.start_date)}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500   ">Planned Completion Date</label>
                        <p className="text-sm  text-slate-900 mt-2">{formatDisplayDate(viewingWorkOrder.end_date)}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500   ">Delivery Commitment</label>
                        <p className="text-sm  text-amber-600 mt-2">Pending Schedule</p>
                      </div>
                    </div>
                  </div>

                  {/* Efficiency Projection */}
                  <div className="border border-slate-200 rounded  p-5">
                    <h4 className="text-xs  text-slate-900 mb-4 flex items-center gap-2">
                      <span>🎯</span>
                      Efficiency Projection
                    </h4>
                    <p className="text-xl  text-slate-900">0%</p>
                    <p className="text-xs text-slate-400 mt-2">Predicted production efficiency based on workstation load.</p>
                  </div>
                </>
              )}

              {woViewTab === 'operations' && (
                <>
                  <div className="border border-slate-200 rounded  overflow-hidden">
                    <div className="bg-slate-50 px-5 p-2 border-b border-slate-200">
                      <h4 className="text-xs  text-slate-900 flex items-center gap-2">
                        <span>03</span>
                        Operation Sequence
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="p-2 text-left text-xs  text-slate-500">Phase</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Assignment</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Status</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Time & Cost</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2">
                              <span className="text-slate-900 ">No operations defined yet</span>
                            </td>
                            <td colSpan="4" className="p-2 text-center text-slate-500">Create job cards from this work order to define operations</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {woViewTab === 'inventory' && (
                <>
                  <div className="border border-slate-200 rounded  p-5">
                    <h4 className="text-xs  text-slate-900 mb-4 flex items-center gap-2">
                      <span>04</span>
                      Required Inventory
                    </h4>
                    <p className="text-sm text-slate-500">Material requirements will be displayed based on the BOM.</p>
                  </div>

                  {/* Inventory Advisory */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded  p-5">
                    <div className="flex gap-2">
                      <span className="text-xl">ℹ️</span>
                      <div>
                        <h5 className=" text-indigo-900 mb-1">Inventory Advisory</h5>
                        <p className="text-sm text-indigo-700">System tracks real-time material transfers. Ensure all raw materials are transferred from "Stores" to "Production" before consumption.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {woViewTab === 'report' && (
                <>
                  <div className="border border-slate-200 rounded  overflow-hidden">
                    <div className="bg-slate-50 px-5 p-2 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs  text-slate-900 flex items-center gap-2">
                        <span>05</span>
                        Daily Production History
                      </h4>
                      <button className="text-xs bg-indigo-600 text-white p-1.5 rounded hover:bg-indigo-700">
                        📥 Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="p-2 text-left text-xs  text-slate-500">Date</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Shift</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Operation</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Operator</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Produced</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Accepted</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Rejected</th>
                            <th className="p-2 text-left text-xs  text-slate-500">Downtime</th>
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
                className="p-2 text-xs text-slate-600 hover:text-slate-900 "
              >
                Close
              </button>
              <button
                onClick={() => {
                  setViewingWorkOrder(null);
                  handleEdit(viewingWorkOrder.id);
                }}
                className="flex items-center gap-2 p-2 bg-indigo-600 text-white rounded  hover:bg-indigo-700  text-sm"
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

