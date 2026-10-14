import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, StatusBadge, FormControl, Modal, DataTable } from '../components/ui.jsx';
import { 
  RefreshCw, 
  Layers, 
  FileText, 
  ArrowUpRight, 
  AlertCircle, 
  CheckCircle2, 
  Activity, 
  Briefcase, 
  Package,
  ArrowRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const MaterialRequirements = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const deptPrefix = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '/production';
  })();
  const [view, setView] = useState('plan');
  const [plans, setPlans] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMat, setSelectedMat] = useState(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [issueData, setIssueData] = useState({
    workOrderId: '',
    quantity: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchRequirements();
    fetchWorkOrders();
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_BASE}/production-plans`, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
      if (response.ok) setPlans(await response.json());
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchRequirements = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requirements/global`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRequirements(data);
      } else {
        throw new Error('Failed to fetch material requirements');
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const handleShowDetails = (mat) => {
    setSelectedMat(mat);
    setIsDetailsModalOpen(true);
  };

  // Work orders that belong to a plan needing the selected material
  const issuableWorkOrders = useMemo(() => {
    if (!selectedMat) return [];
    const planCodes = new Set((selectedMat.details || []).map(d => d.plan_code));
    return workOrders.filter(wo => wo.plan_code && planCodes.has(wo.plan_code) && !['COMPLETED', 'CANCELLED'].includes(wo.status));
  }, [selectedMat, workOrders]);

  const handleOpenIssue = (mat) => {
    setSelectedMat(mat);
    setIssueData({
      workOrderId: '',
      quantity: Math.min(mat.available_qty, mat.required_qty),
      remarks: `Material issue for ${mat.material_name}`
    });
    setIsIssueModalOpen(true);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueData.workOrderId) return errorToast('Please select a work order');
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workOrderId: issueData.workOrderId,
          remarks: issueData.remarks,
          items: [{
            materialName: selectedMat.material_name,
            materialType: selectedMat.material_type,
            quantity: issueData.quantity,
            uom: selectedMat.uom
          }]
        })
      });

      if (response.ok) {
        successToast('Material issued successfully');
        setIsIssueModalOpen(false);
        fetchRequirements();
      } else {
        const err = await response.json();
        errorToast(err.error || 'Failed to issue material');
      }
    } catch (error) {
      errorToast('Network error');
    }
  };

  const materialTypes = ['ALL', ...new Set(requirements.map(r => r.material_type))];

  const columns = [
    {
      label: 'Material Name',
      key: 'material_name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-slate-900">{val}</div>
          <div className="text-xs text-slate-400">{row.details.length} linked project(s)</div>
        </div>
      )
    },
    {
      label: 'Type',
      key: 'material_type',
      sortable: true,
      render: (val) => (
        <span className="px-2 py-1 bg-slate-100 text-slate-600 roundedtext-xs  ">
          {val}
        </span>
      )
    },
    {
      label: 'Required Qty',
      key: 'required_qty',
      sortable: true,
      className: 'text-center',
      render: (val, row) => `${parseFloat(val || 0).toFixed(2)} ${row.uom}`
    },
    {
      label: 'Stock Available',
      key: 'available_qty',
      sortable: true,
      className: 'text-center',
      render: (val, row) => (
        <span className=" text-slate-700">
          {parseFloat(val || 0).toFixed(2)} {row.uom}
        </span>
      )
    },
    {
      label: 'Shortage',
      key: 'shortage',
      sortable: true,
      className: 'text-center',
      render: (val, row) => val > 0 ? (
        <span className="text-rose-600 ">{parseFloat(val || 0).toFixed(2)} {row.uom}</span>
      ) : (
        <span className="text-emerald-600">—</span>
      )
    },
    {
      label: 'Status',
      key: 'shortage',
      render: (val) => val > 0 ? (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-600 rounded text-xs  border border-rose-100">
          <AlertCircle className="w-3 h-3" />
          SHORTAGE
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs  border border-emerald-100">
          <CheckCircle2 className="w-3 h-3" />
          AVAILABLE
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: '',
      render: (_, row) => (
        <div className="flex items-center  gap-2  group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => handleShowDetails(row)}
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-900  text-xs "
          >
            <FileText className="w-3.5 h-3.5" />
            Details
          </button>
          {row.available_qty > 0 && (
            <button 
              onClick={() => handleOpenIssue(row)}
              className="flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 text-xs  px-2 py-1 rounded   shadow-emerald-100"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Issue
            </button>
          )}
        </div>
      )
    }
  ];

  const activePlans = useMemo(() => plans.filter(p => !['CANCELLED', 'COMPLETED', 'DELETED'].includes(String(p.status || '').toUpperCase())), [plans]);
  // plan_code -> its materials, each carrying the stock shortage of that material overall
  const materialsByPlan = useMemo(() => {
    const map = new Map();
    requirements.forEach(req => (req.details || []).forEach(d => {
      if (!map.has(d.plan_code)) map.set(d.plan_code, []);
      // Each plan's own share of the common stock, not the overall total
      map.get(d.plan_code).push({
        material_name: req.material_name, material_type: req.material_type, uom: req.uom, qty: d.qty,
        released: d.released_qty || 0, covered: d.covered_qty || 0, shortage: d.short_qty || 0
      });
    }));
    return map;
  }, [requirements]);

  const totalRequired = requirements.length;
  const withShortage = requirements.filter(r => r.shortage > 0).length;

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-slate-900">Material Requirements</h2>
          <p className="text-xs text-slate-500">Plan and allocate materials for active production orders</p>
        </div>
        <button 
          onClick={fetchRequirements}
          className="p-2  border border-slate-200 text-slate-600 rounded  hover:bg-slate-50 transition-colors text-sm  flex items-center gap-2 "
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Card className="bg-white">
          <div className="p-2">
            <p className="text-xs text-slate-500   ">Total Items Needed</p>
            <p className="text-xl text-slate-900 mt-1">{totalRequired}</p>
          </div>
        </Card>
        <Card className="bg-white">
          <div className="p-2">
            <p className="text-xs text-slate-500   ">Items with Shortage</p>
            <p className="text-xl   text-rose-600 mt-1">{withShortage}</p>
          </div>
        </Card>
        <Card className="bg-white">
          <div className="p-2">
            <p className="text-xs text-slate-500   ">Stock Health</p>
            <p className="text-xl   text-emerald-600 mt-1">
              {totalRequired ? Math.round(((totalRequired - withShortage) / totalRequired) * 100) : 100}%
            </p>
          </div>
        </Card>
        <Card className="bg-white">
          <div className="p-2">
            <p className="text-xs text-slate-500   ">Active Plans</p>
            <p className="text-xl   text-indigo-600 mt-1">
              {[...new Set(requirements.flatMap(r => r.details.map(d => d.plan_code)))].length}
            </p>
          </div>
        </Card>
      </div>


      {/* View switch */}
      <div className="flex gap-1 border-b border-slate-200">
        {[['plan', 'By production plan'], ['material', 'By material']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} className={`px-4 py-2 text-sm border-b-2 -mb-px ${view === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </div>

      {view === 'plan' && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">For each plan: is the material requested, released by Stores, and covered by stock? Plans share one stock, so it is handed out in order of plan start date. Material already released to a plan no longer counts against stock.</div>
          {activePlans.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded p-8 text-center text-sm text-slate-500">No active production plans.</div>
          ) : activePlans.map(plan => {
            const mats = materialsByPlan.get(plan.plan_code) || [];
            const live = Number(plan.live_mr_count) || 0;
            const released = Number(plan.released_mr_count) || 0;
            const state = live === 0 ? { label: 'Material not requested', cls: 'bg-rose-50 text-rose-700' }
              : released >= live ? { label: 'Released by Stores', cls: 'bg-emerald-50 text-emerald-700' }
              : { label: released > 0 || Number(plan.partial_mr_count) > 0 ? 'Partly released' : 'Requested — waiting for Stores', cls: 'bg-amber-50 text-amber-700' };
            const planWos = workOrders.filter(w => w.plan_code === plan.plan_code && !['COMPLETED', 'CANCELLED'].includes(w.status));
            const short = mats.filter(m => m.shortage > 0).length;
            return (
              <div key={plan.id} className="bg-white border border-slate-200 rounded">
                <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-100 rounded-t">
                  <div className="min-w-[11rem]">
                    <div className="text-sm text-indigo-700">{plan.plan_code}</div>
                    <div className="text-[11px] text-slate-500">{plan.project_name || plan.company_name || ''} · {plan.drawing_no || plan.item_code || ''}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${state.cls}`}>{state.label}</span>
                  {short > 0 && <span className="text-[11px] px-2 py-0.5 rounded bg-rose-50 text-rose-700">{short} material(s) short in stock</span>}
                  <div className="ml-auto flex gap-2">
                    {live === 0 && <button onClick={() => navigate(`${deptPrefix}/production-plan`)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Request material on the plan</button>}
                    {planWos.length > 0 && <button onClick={() => navigate(`${deptPrefix}/work-order?plan=${encodeURIComponent(plan.plan_code)}`)} className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50">Work orders ({planWos.length})</button>}
                  </div>
                </div>
                <div className="px-3 py-2">
                  {mats.length === 0 ? <div className="text-xs text-slate-400">No bill-of-material rows found for this plan.</div> : (
                    <table className="w-full text-xs">
                      <thead className="text-slate-400 text-left"><tr><th className="py-1">Material</th><th className="py-1 text-right">Needed</th><th className="py-1 text-right">Already released</th><th className="py-1 text-right">Covered by stock</th><th className="py-1">Status</th></tr></thead>
                      <tbody>
                        {mats.map((m, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-1.5 text-slate-800">{m.material_name}<span className="text-[10px] text-slate-400 ml-1">{m.material_type}</span></td>
                            <td className="py-1.5 text-right">{parseFloat(m.qty || 0).toFixed(2)} {m.uom}</td>
                            <td className="py-1.5 text-right">{parseFloat(m.released || 0).toFixed(2)} {m.uom}</td>
                            <td className="py-1.5 text-right">{parseFloat(m.covered || 0).toFixed(2)} {m.uom}</td>
                            <td className="py-1.5">{m.shortage > 0.0005 ? <span className="text-rose-600">Short by {parseFloat(m.shortage).toFixed(2)} {m.uom}</span> : <span className="text-emerald-600">Covered</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {planWos.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      Issue, use and return material per work order:
                      {planWos.map(w => (
                        <button key={w.id} onClick={() => navigate(`${deptPrefix}/work-order/edit-work?id=${w.id}`)} className="px-2 py-1 border border-slate-200 rounded hover:bg-indigo-50 text-indigo-700">{w.wo_number}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'material' && (
      <Card>
        <DataTable 
          columns={columns}
          data={requirements.filter(req => typeFilter === 'ALL' || req.material_type === typeFilter)}
          loading={loading}
          searchPlaceholder="Search materials, projects..."
          actions={
            <div className="w-48">
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded  text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {materialTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          }
        />
      </Card>
      )}

      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Material Details: ${selectedMat?.material_name}`}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-slate-50 rounded ">
              <p className="text-slate-500 text-xs">Total Required</p>
              <p className=" text-lg">{selectedMat?.required_qty} {selectedMat?.uom}</p>
            </div>
            <div className="p-2 bg-slate-50 rounded ">
              <p className="text-slate-500 text-xs">Stock Available</p>
              <p className=" text-lg text-emerald-600">{selectedMat?.available_qty} {selectedMat?.uom}</p>
            </div>
          </div>
          
          <h4 className=" text-slate-800 text-sm border-b pb-2">Linked Projects & Plans</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {selectedMat?.details.map((d, i) => (
              <div key={i} className="flex justify-between items-center p-2 border rounded  text-sm">
                <div>
                  <div className="">{d.project_name}</div>
                  <div className="text-xs text-slate-500">Plan: {d.plan_code} | Item: {d.item_code}</div>
                </div>
                <div className=" text-indigo-600">{d.qty} {selectedMat.uom}</div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title={`Issue Material: ${selectedMat?.material_name}`}
      >
        <form onSubmit={handleIssueSubmit} className="space-y-2">
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
            Stores release material on the production plan first. Issuing here hands that released material to one work order.
            {issuableWorkOrders.length === 0 && <span className="block text-amber-700 mt-1">No active work order needs this material yet. Create the plan's work orders first.</span>}
          </div>
          <FormControl label="Work Order">
            <select 
              value={issueData.workOrderId}
              onChange={(e) => setIssueData(prev => ({ ...prev, workOrderId: e.target.value }))}
              className="w-full p-2 border border-slate-200 rounded  text-sm bg-white"
              required
            >
              <option value="">Select Work Order</option>
              {issuableWorkOrders.map(wo => (
                <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.item_name || wo.item_code} ({wo.status})</option>
              ))}
            </select>
          </FormControl>

          <div className="grid grid-cols-2 gap-2">
            <FormControl label="Issue Quantity">
              <div className="relative">
                <input 
                  type="number" 
                  step="0.001"
                  max={selectedMat?.available_qty}
                  value={issueData.quantity}
                  onChange={(e) => setIssueData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded  text-sm"
                  required
                />
                <span className="absolute right-3 top-2 text-slate-400 text-xs">{selectedMat?.uom}</span>
              </div>
            </FormControl>
            <div className="flex flex-col justify-end pb-1 text-xs text-slate-500">
              <p>Available: {selectedMat?.available_qty}</p>
              <p>Required: {selectedMat?.required_qty}</p>
            </div>
          </div>

          <FormControl label="Remarks">
            <input 
              type="text" 
              value={issueData.remarks}
              onChange={(e) => setIssueData(prev => ({ ...prev, remarks: e.target.value }))}
              className="w-full p-2 border border-slate-200 rounded  text-sm"
              placeholder="E.g., Floor issue for production"
            />
          </FormControl>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button 
              type="button"
              onClick={() => setIsIssueModalOpen(false)}
              className="p-2  border border-slate-200 text-slate-600 rounded  hover:bg-slate-50 transition-colors text-sm "
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="p-2 bg-emerald-600 text-white rounded  hover:bg-emerald-700 transition-colors text-sm  "
            >
              Confirm Issue
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MaterialRequirements;

