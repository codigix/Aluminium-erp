import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

// Robust URL construction
const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // 1. Determine base URL (priority: VITE_UPLOAD_URL -> API_BASE)
  let base = UPLOAD_BASE || API_BASE;
  if (base.endsWith('/')) base = base.slice(0, -1);
  
  // 2. Clean the incoming path
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // 3. Prevent double 'uploads/' if base already includes it
  if (base.toLowerCase().endsWith('/uploads') && cleanPath.toLowerCase().startsWith('uploads/')) {
    cleanPath = cleanPath.slice(8);
  }
  
  const url = `${base}/${cleanPath}`;
  
  if (url.startsWith('http')) return url;
  return window.location.origin + (url.startsWith('/') ? url : '/' + url);
};

const priorityColors = {
  LOW: 'text-slate-500',
  NORMAL: 'text-slate-600',
  HIGH: 'text-red-600 ',
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatOrderCode = (id) => {
  return `SO-${String(id).padStart(4, '0')}`;
};

const statusColors = {
  CREATED: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Created' },
  DESIGN_IN_REVIEW: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Design Review' },
  DESIGN_Approved: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Design Approved' },
  BOM_Approved: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', label: 'BOM Approved' },
  BOM_SUBMITTED: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'BOM Submitted' },
  DESIGN_QUERY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'Design Query' },
  PROCUREMENT_IN_PROGRESS: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', label: 'Procurement' },
  MATERIAL_READY: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Material Ready' },
  IN_PRODUCTION: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', label: 'In Production' },
  PRODUCTION_COMPLETED: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-600', label: 'Prod. Done' },
};

const ProjectRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      // Fetch incoming orders specifically for PRODUCTION department, including accepted ones
      const url = `${API_BASE}/sales-orders/incoming?department=PRODUCTION&includeAccepted=true`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch project requests');
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching project requests:', error);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (orderId, type) => {
    if (type === 'reject' && !confirm('Reject this project request?')) return;
    try {
      setActionLoading(orderId);
      const token = localStorage.getItem('authToken');
      const endpoint = type === 'accept' ? 'accept' : 'reject';
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ departmentCode: 'PRODUCTION' }),
      });
      if (response.ok) {
        const result = await response.json();
        // Update the status in the local state instead of filtering out
        setRequests(prev => prev.map(r => r.id === orderId ? { 
          ...r, 
          status: result.status, 
          request_accepted: 1,
          current_department: result.currentDepartment 
        } : r));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const columns = useMemo(() => [
    {
      label: 'SO Code',
      key: 'id',
      sortable: true,
      render: (val) => <span className="text-indigo-600 font-medium">{formatOrderCode(val)}</span>
    },
    {
      label: 'Project / Customer',
      key: 'project_name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="text-slate-900 font-medium">{val || '—'}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{row.company_name}</div>
        </div>
      )
    },
    {
      label: 'Item Details',
      key: 'item_description',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="text-slate-900">{val}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Code: {row.item_code || '—'} | Qty: <span className="font-medium text-slate-700">{row.item_qty} {row.item_unit}</span>
          </div>
        </div>
      )
    },
    {
      label: 'Drawing No',
      key: 'drawing_no',
      sortable: true,
      render: (val) => (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
          {val || 'N/A'}
        </span>
      )
    },
    {
      label: 'Drawings',
      key: 'drawing_pdf',
      className: 'text-center',
      render: (val) => val ? (
        <a 
          href={getFileUrl(val)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View
        </a>
      ) : (
        <span className="text-slate-400 italic text-[10px]">No Drawing</span>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Target Date',
      key: 'target_dispatch_date',
      sortable: true,
      render: (val) => <span className="text-slate-600 whitespace-nowrap">{formatDate(val)}</span>
    },
    {
      label: 'Priority',
      key: 'production_priority',
      sortable: true,
      render: (val) => (
        <span className={`text-[10px]    ${priorityColors[val] || priorityColors.NORMAL}`}>
          {val || 'NORMAL'}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => !row.request_accepted ? (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleAction(row.id, 'accept')}
            disabled={actionLoading === row.id}
            className="px-3 py-1 bg-emerald-600 text-white text-[10px]    rounded hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            {actionLoading === row.id ? '...' : 'Accept'}
          </button>
          <button
            onClick={() => handleAction(row.id, 'reject')}
            disabled={actionLoading === row.id}
            className="px-3 py-1 border border-slate-200 text-slate-600 text-[10px]    rounded hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate('/production-plan', { state: { salesOrderId: row.id } })}
            className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px]    rounded border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm"
          >
            Plan
          </button>
          <button
            onClick={() => navigate('/work-order-form', { state: { salesOrderId: row.id, salesOrderItemId: row.item_id } })}
            className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px]    rounded border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-sm"
          >
            Work Order
          </button>
        </div>
      )
    }
  ], [actionLoading, navigate]);

  return (
    <div className="space-y-4 p-4 min-h-screen bg-slate-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl  text-slate-900 tracking-tight">Project Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Review and initiate production for new project requests from Sales</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs  text-slate-700  ">{requests.length} Requests Pending</span>
          </div>
          <button 
            onClick={fetchRequests}
            className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 rounded transition-all shadow-sm active:scale-95"
            title="Refresh"
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={requests}
          loading={isLoading}
          searchPlaceholder="Search by SO Code, Project, or Item..."
          searchKey="project_name"
        />
      </Card>
    </div>
  );
};

export default ProjectRequests;

