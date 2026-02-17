import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

// Robust URL construction
const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // 1. Determine base URL (priority: VITE_UPLOAD_URL -> API_BASE parent)
  let base = UPLOAD_BASE || (API_BASE.endsWith('/api') ? API_BASE.slice(0, -4) : API_BASE);
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
  DESIGN_APPROVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Design Approved' },
  BOM_APPROVED: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', label: 'BOM Approved' },
  BOM_SUBMITTED: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'BOM Submitted' },
  DESIGN_QUERY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'Design Query' },
  PROCUREMENT_IN_PROGRESS: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', label: 'Procurement' },
  MATERIAL_READY: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Material Ready' },
  IN_PRODUCTION: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', label: 'In Production' },
  PRODUCTION_COMPLETED: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-600', label: 'Prod. Done' },
};

const ProjectRequests = () => {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-slate-900">Project Requests</h2>
          <p className="text-sm text-slate-500 mt-1">New project requests from Sales department for production start</p>
        </div>
        <button 
          onClick={fetchRequests}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-2 text-left">SO Code</th>
                  <th className="p-2 text-left">Project / Customer</th>
                  <th className="p-2 text-left">Item Details</th>
                  <th className="p-2 text-left">Drawing No</th>
                  <th className="p-2 text-center">Drawings</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Target Date</th>
                  <th className="p-2 text-left">Priority</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((req, idx) => {
                  const statusInfo = statusColors[req.status] || { label: req.status, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' };
                  return (
                    <tr key={`${req.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 font-mono text-indigo-600 font-medium">
                        {formatOrderCode(req.id)}
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-900">{req.project_name || '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{req.company_name}</div>
                      </td>
                      <td className="p-2">
                        <div className="text-slate-900">{req.item_description}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Code: {req.item_code || '—'} | Qty: <span className="font-medium">{req.item_qty} {req.item_unit}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">
                          {req.drawing_no || 'N/A'}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {req.drawing_pdf ? (
                          <a 
                            href={getFileUrl(req.drawing_pdf)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No Drawing</span>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-[10px]  border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text} whitespace-nowrap`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600 whitespace-nowrap">
                        {formatDate(req.target_dispatch_date)}
                      </td>
                      <td className="p-2">
                        <span className={`text-xs  ${priorityColors[req.production_priority]}`}>
                          {req.production_priority || 'NORMAL'}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {!req.request_accepted ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleAction(req.id, 'accept')}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs  rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === req.id ? '...' : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleAction(req.id, 'reject')}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs  rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">Accepted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-20 text-center text-slate-400 italic bg-white">
                      No pending project requests for Production.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProjectRequests;

