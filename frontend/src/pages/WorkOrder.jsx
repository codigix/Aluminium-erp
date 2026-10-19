import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { StatusBadge } from '../components/ui.jsx';
import {
  Plus, RefreshCw, Search, ChevronDown, ChevronRight, MoreVertical, Rocket, Activity, PauseCircle, PlayCircle,
  Pencil, Trash2, XCircle, AlertTriangle, Layers, Puzzle, Box, CornerDownRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';
import { cleanProjectName } from '../utils/formatters.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatDate = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const isLate = wo => Boolean(wo.end_date && new Date(wo.end_date) < new Date(new Date().toDateString()) && !['COMPLETED', 'CANCELLED'].includes(wo.status));

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'RELEASED', label: 'Released' },
  { id: 'IN_PROGRESS', label: 'In progress' },
  { id: 'ON_HOLD', label: 'On hold' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' }
];

const PRIORITY_CLS = { URGENT: 'bg-rose-100 text-rose-700', HIGH: 'bg-amber-100 text-amber-700' };

// What kind of work order is this, in plain words
const describeType = (wo, hasChildren) => {
  const code = String(wo.item_code || '').toUpperCase();
  if (code.startsWith('BO-')) return { label: 'Bought-out', icon: Box, cls: 'text-amber-700 bg-amber-50' };
  if (wo.source_type === 'SA') return { label: 'Sub-assembly', icon: Puzzle, cls: 'text-sky-700 bg-sky-50' };
  if (wo.source_type === 'PART') return { label: 'Part', icon: Box, cls: 'text-slate-700 bg-slate-100' };
  return hasChildren ? { label: 'Assembly', icon: Layers, cls: 'text-indigo-700 bg-indigo-50' } : { label: 'Finished item', icon: Layers, cls: 'text-indigo-700 bg-indigo-50' };
};

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` });

const WorkOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const deptPrefix = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '/production';
  })();

  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [lateOnly, setLateOnly] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('plan') || '');
  const [collapsed, setCollapsed] = useState({});
  const [menuFor, setMenuFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageMenu, setPageMenu] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/work-orders`, { headers: authHeaders() });
      if (response.ok) setWorkOrders(await response.json());
      else errorToast('Could not load work orders');
    } catch (error) {
      errorToast('Network error while loading work orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { ALL: workOrders.length };
    workOrders.forEach(w => { c[w.status] = (c[w.status] || 0) + 1; });
    return c;
  }, [workOrders]);
  const lateCount = useMemo(() => workOrders.filter(isLate).length, [workOrders]);
  const draftCount = counts.DRAFT || 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workOrders.filter(w =>
      (statusFilter === 'ALL' || w.status === statusFilter) &&
      (!lateOnly || isLate(w)) &&
      (!q || [w.wo_number, w.item_name, w.item_code, w.project_name, w.client_name, w.plan_code, w.bom_no].some(v => String(v || '').toLowerCase().includes(q)))
    );
  }, [workOrders, statusFilter, lateOnly, search]);

  // Group by production plan (or by itself), then nest components under their assembly
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(wo => {
      const key = wo.plan_id ? `plan_${wo.plan_id}` : wo.parent_wo_id ? `parent_${wo.parent_wo_id}` : `wo_${wo.id}`;
      if (!map.has(key)) map.set(key, { key, items: [], latestId: 0 });
      const g = map.get(key);
      g.items.push(wo);
      g.latestId = Math.max(g.latestId, Number(wo.id) || 0);
    });

    return Array.from(map.values()).sort((a, b) => b.latestId - a.latestId).map(g => {
      const ids = new Set(g.items.map(i => i.id));
      const childrenOf = new Map();
      g.items.forEach(i => {
        if (i.parent_wo_id && ids.has(i.parent_wo_id)) {
          if (!childrenOf.has(i.parent_wo_id)) childrenOf.set(i.parent_wo_id, []);
          childrenOf.get(i.parent_wo_id).push(i);
        }
      });
      const roots = g.items.filter(i => !(i.parent_wo_id && ids.has(i.parent_wo_id)))
        .sort((a, b) => (a.source_type === 'FG' ? 1 : 0) - (b.source_type === 'FG' ? 1 : 0) || a.id - b.id);

      const rows = [];
      roots.forEach(r => {
        const kids = (childrenOf.get(r.id) || []).sort((a, b) => a.id - b.id);
        rows.push({ wo: r, depth: 0, hasChildren: kids.length > 0 });
        kids.forEach(k => rows.push({ wo: k, depth: 1, hasChildren: false }));
      });

      const totalJcs = g.items.reduce((s, i) => s + (Number(i.total_job_cards) || 0), 0);
      const doneJcs = g.items.reduce((s, i) => s + (Number(i.completed_job_cards) || 0), 0);
      const first = g.items[0];
      return {
        ...g, rows,
        planCode: first.plan_code,
        title: cleanProjectName(first.project_name, first.client_name) || first.item_name || first.wo_number,
        progress: totalJcs ? Math.round((doneJcs / totalJcs) * 100) : 0,
        drafts: g.items.filter(i => i.status === 'DRAFT'),
        late: g.items.filter(isLate).length,
        held: g.items.reduce((s, i) => s + (Number(i.held_job_cards) || 0), 0),
        due: g.items.map(i => i.end_date).filter(Boolean).sort().slice(-1)[0],
        allDone: g.items.every(i => ['COMPLETED', 'CANCELLED'].includes(i.status))
      };
    });
  }, [filtered]);

  const explain = (result) => Swal.fire({
    icon: 'warning', title: "That can't be done yet", text: result.error || result.message || 'The action was refused', confirmButtonColor: '#4f46e5'
  });

  const changeStatus = async (wo, status, reason) => {
    const response = await fetch(`${API_BASE}/work-orders/${wo.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status, reason }) });
    if (!response.ok) {
      await explain(await response.json().catch(() => ({})));
      return false;
    }
    return true;
  };

  const release = async (wo) => {
    setBusy(true);
    if (await changeStatus(wo, 'RELEASED')) { successToast(`${wo.wo_number} released — job cards are now active`); await load(); }
    setBusy(false);
  };

  const releaseAll = async (group) => {
    const ok = await Swal.fire({
      title: `Release ${group.drafts.length} draft work order(s)?`, text: 'Their job cards become active and can be scheduled and started.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Release all', confirmButtonColor: '#059669'
    });
    if (!ok.isConfirmed) return;
    setBusy(true);
    let released = 0;
    for (const wo of group.drafts) {
      if (await changeStatus(wo, 'RELEASED')) released += 1; else break;
    }
    if (released) successToast(`${released} work order(s) released`);
    await load();
    setBusy(false);
  };

  const askReason = async (title, button, color) => {
    const { value } = await Swal.fire({
      title, input: 'text', inputLabel: 'Reason (required)', showCancelButton: true, confirmButtonText: button, confirmButtonColor: color,
      inputValidator: v => (!v || !v.trim() ? 'Please give a reason' : null)
    });
    return value || null;
  };

  const hold = async (wo) => {
    const reason = await askReason(`Put ${wo.wo_number} on hold?`, 'Hold', '#d97706');
    if (reason && await changeStatus(wo, 'ON_HOLD', reason)) { successToast('Work order on hold'); await load(); }
  };
  const resume = async (wo) => {
    if (await changeStatus(wo, Number(wo.completed_job_cards) > 0 || Number(wo.running_job_cards) > 0 ? 'IN_PROGRESS' : 'RELEASED', 'Resumed')) { successToast('Work order resumed'); await load(); }
  };
  const cancel = async (wo) => {
    const reason = await askReason(`Cancel ${wo.wo_number}?`, 'Cancel work order', '#e11d48');
    if (reason && await changeStatus(wo, 'CANCELLED', reason)) { successToast('Work order cancelled'); await load(); }
  };
  const remove = async (wo) => {
    const ok = await Swal.fire({ title: `Delete ${wo.wo_number}?`, text: 'Deletes this work order along with its job cards and linked material issues/history.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Delete' });
    if (!ok.isConfirmed) return;
    const response = await fetch(`${API_BASE}/work-orders/${wo.id}`, { method: 'DELETE', headers: authHeaders() });
    if (response.ok) { successToast('Work order deleted'); await load(); } else await explain(await response.json().catch(() => ({})));
  };
  const resetQueue = async () => {
    const ok = await Swal.fire({
      title: 'Reset the whole queue?', text: 'Deletes ALL work orders, job cards, and linked material issues/history. This action cannot be undone.',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete all', confirmButtonColor: '#e11d48'
    });
    if (!ok.isConfirmed) return;
    const response = await fetch(`${API_BASE}/work-orders/delete-all`, { method: 'DELETE', headers: authHeaders() });
    if (response.ok) { successToast('All work orders deleted'); await load(); } else await explain(await response.json().catch(() => ({})));
  };

  const openJobCards = wo => navigate(`${deptPrefix}/job-card?filter_work_order=${wo.wo_number}`);
  const edit = wo => navigate(`${deptPrefix}/work-order/edit-work?id=${wo.id}`);

  const primaryAction = (wo) => {
    if (wo.status === 'DRAFT') return { label: 'Release', icon: Rocket, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white', run: () => release(wo) };
    if (wo.status === 'ON_HOLD') return { label: 'Resume', icon: PlayCircle, cls: 'bg-amber-500 hover:bg-amber-600 text-white', run: () => resume(wo) };
    if (['RELEASED', 'IN_PROGRESS'].includes(wo.status)) return { label: 'Job cards', icon: Activity, cls: 'border border-indigo-200 text-indigo-700 hover:bg-indigo-50', run: () => openJobCards(wo) };
    return { label: 'View', icon: Activity, cls: 'border border-slate-200 text-slate-600 hover:bg-slate-50', run: () => openJobCards(wo) };
  };

  return (
    <div className="space-y-3" onClick={() => { setMenuFor(null); setPageMenu(false); }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Work Orders</h1>
          <p className="text-xs text-slate-500">Grouped by production plan. Components sit under the assembly that needs them.</p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={load} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => navigate(`${deptPrefix}/work-order/edit-work`)} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><Plus className="w-4 h-4" /> New work order</button>
          <div className="relative">
            <button onClick={() => setPageMenu(v => !v)} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="More"><MoreVertical className="w-4 h-4" /></button>
            {pageMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg z-20">
                <button onClick={resetQueue} disabled={workOrders.length === 0} className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40 flex items-center gap-2"><Trash2 className="w-3 h-3" /> Reset queue (delete all)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next step */}
      {draftCount > 0 && statusFilter !== 'DRAFT' && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-indigo-200 bg-indigo-50 p-3">
          <Rocket className="w-5 h-5 text-indigo-600" />
          <div className="flex-1 min-w-[14rem]">
            <div className="text-sm text-slate-900">{draftCount} work order(s) are still in draft</div>
            <div className="text-xs text-slate-500">Release a work order to make its job cards active. Material must be released by Stores before work can start.</div>
          </div>
          <button onClick={() => setStatusFilter('DRAFT')} className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-700 rounded hover:bg-white">Show drafts</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-full border ${statusFilter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f.label} <span className={statusFilter === f.id ? 'opacity-80' : 'text-slate-400'}>{counts[f.id] || 0}</span>
            </button>
          ))}
          <button onClick={() => setLateOnly(v => !v)}
            className={`px-3 py-1.5 text-xs rounded-full border flex items-center gap-1 ${lateOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}>
            <AlertTriangle className="w-3 h-3" /> Late {lateCount}
          </button>
        </div>
        <div className="relative ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work order, item, project, plan..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-72" />
        </div>
      </div>

      {/* Groups */}
      {loading && workOrders.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading work orders...</div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center">
          <div className="text-sm text-slate-700">{workOrders.length === 0 ? 'No work orders yet' : 'No work orders match these filters'}</div>
          <div className="text-xs text-slate-500 mt-1">{workOrders.length === 0 ? 'Create them from a production plan, or add one manually.' : 'Try another status or clear the search.'}</div>
        </div>
      ) : groups.map(g => {
        const isCollapsed = collapsed[g.key] ?? g.allDone;
        return (
          <div key={g.key} className="bg-white border border-slate-200 rounded">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t cursor-pointer" onClick={(e) => { e.stopPropagation(); setCollapsed(c => ({ ...c, [g.key]: !isCollapsed })); }}>
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              <div className="min-w-[10rem]">
                <div className="text-sm text-slate-900 leading-tight">{g.title}</div>
                <div className="text-[11px] text-slate-500">{g.planCode ? `Plan ${g.planCode} · ` : ''}{g.items.length} work order(s)</div>
              </div>
              <div className="flex items-center gap-2 w-44">
                <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${g.progress}%` }} /></div>
                <span className="text-xs text-slate-600 w-9 text-right">{g.progress}%</span>
              </div>
              <div className="text-xs text-slate-500">Due {formatDate(g.due)}</div>
              {g.late > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">{g.late} late</span>}
              {g.held > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{g.held} job(s) held</span>}
              {g.drafts.length > 0 && (
                <button disabled={busy} onClick={(e) => { e.stopPropagation(); releaseAll(g); }} className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50">
                  <Rocket className="w-3 h-3" /> Release all drafts ({g.drafts.length})
                </button>
              )}
            </div>

            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {g.rows.map(({ wo, depth, hasChildren }) => {
                  const type = describeType(wo, hasChildren);
                  const TypeIcon = type.icon;
                  const total = Number(wo.total_job_cards) || 0;
                  const done = Number(wo.completed_job_cards) || 0;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const late = isLate(wo);
                  const action = primaryAction(wo);
                  const ActionIcon = action.icon;
                  return (
                    <div key={wo.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${wo.status === 'CANCELLED' ? 'opacity-50' : ''}`} style={{ paddingLeft: depth ? '2.25rem' : undefined }}>
                      {depth > 0 && <CornerDownRight className="w-4 h-4 text-slate-300 -ml-5" />}
                      <span className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded w-28 shrink-0 ${type.cls}`}><TypeIcon className="w-3 h-3" />{type.label}</span>
                      <div className="min-w-[11rem] flex-1">
                        <div className="text-sm text-slate-900 leading-tight">{wo.item_name || wo.item_code}
                          {PRIORITY_CLS[wo.priority] && <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_CLS[wo.priority]}`}>{wo.priority}</span>}
                        </div>
                        <div className="text-[11px] text-slate-500"><span className="text-indigo-600">{wo.wo_number}</span> · BOM {wo.bom_no || 'NA'}{wo.source_type === 'SA' && wo.source_fg ? ` · for ${wo.source_fg}` : ''}</div>
                      </div>
                      <div className="w-16 text-sm text-slate-900 text-right">{parseFloat(wo.quantity)}<span className="text-[10px] text-slate-400 ml-0.5">pcs</span></div>
                      <div className="w-36">
                        <div className="flex justify-between text-[11px] text-slate-500"><span>{done}/{total} operations</span><span>{pct}%</span></div>
                        <div className="h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                      <div className={`w-24 text-xs ${late ? 'text-rose-600' : 'text-slate-500'}`}>{late ? 'Late · ' : 'Due '}{formatDate(wo.end_date)}</div>
                      <div className="w-24"><StatusBadge status={wo.status} />{Number(wo.held_job_cards) > 0 && <div className="text-[10px] text-amber-600">{wo.held_job_cards} held</div>}</div>
                      <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                        <button disabled={busy} onClick={action.run} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded disabled:opacity-50 ${action.cls}`}><ActionIcon className="w-3.5 h-3.5" />{action.label}</button>
                        <div className="relative">
                          <button onClick={() => setMenuFor(menuFor === wo.id ? null : wo.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="More actions"><MoreVertical className="w-4 h-4" /></button>
                          {menuFor === wo.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded shadow-lg z-20 text-xs">
                              {['DRAFT', 'RELEASED', 'ON_HOLD'].includes(wo.status) && <button onClick={() => { setMenuFor(null); edit(wo); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit</button>}
                              {['RELEASED', 'IN_PROGRESS'].includes(wo.status) && <button onClick={() => { setMenuFor(null); hold(wo); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-amber-700"><PauseCircle className="w-3 h-3" /> Put on hold</button>}
                              {!['COMPLETED', 'CANCELLED'].includes(wo.status) && <button onClick={() => { setMenuFor(null); cancel(wo); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600"><XCircle className="w-3 h-3" /> Cancel work order</button>}
                              {wo.status === 'DRAFT' && <button onClick={() => { setMenuFor(null); remove(wo); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600"><Trash2 className="w-3 h-3" /> Delete</button>}
                              <button onClick={() => { setMenuFor(null); openJobCards(wo); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Activity className="w-3 h-3" /> Open job cards</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkOrder;
