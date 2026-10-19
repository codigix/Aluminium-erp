import React, { useState, useMemo } from 'react';
import {
  Plus, RefreshCw, Search, ChevronDown, ChevronRight, MoreVertical, Play, PlayCircle, PauseCircle, Truck, Eye, Pencil, Trash2,
  ClipboardEdit, UserCog, CalendarClock, AlertTriangle, PackageX, Puzzle, RotateCcw, CheckCircle2, Clock, Cpu, User
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast } from '../utils/toast';
import { cleanProjectName } from '../utils/formatters';
import ScheduleJobModal from './ScheduleJobModal.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` });

const num = v => parseFloat(v) || 0;
const isShipment = jc => ['shipment', 'dispatch'].includes(String(jc.operation_name || '').trim().toLowerCase());
const isSubcontract = jc => /^(outsourc|sub[\s-]?contract|vendor)/i.test(String(jc.execution_mode || jc.execution_type || '')) || Boolean(jc.outward_challan_id);
const isLate = jc => Boolean(jc.end_time && new Date(jc.end_time) < new Date() && !['COMPLETED', 'CANCELLED'].includes(jc.status));
const formatWhen = v => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const STATUS_STYLE = {
  DRAFT: 'bg-slate-100 text-slate-600', PENDING: 'bg-amber-50 text-amber-700', READY: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700', PAUSED: 'bg-orange-100 text-orange-700', ON_HOLD: 'bg-slate-200 text-slate-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-rose-50 text-rose-500'
};
const STATUS_LABEL = { PENDING: 'Waiting', READY: 'Ready', IN_PROGRESS: 'Running', PAUSED: 'Paused', ON_HOLD: 'On hold', COMPLETED: 'Done', DRAFT: 'Draft', CANCELLED: 'Cancelled' };

const FILTERS = [
  { id: 'ACTIVE', label: 'Active', match: jc => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(jc.status) },
  { id: 'WAITING', label: 'Waiting to start', match: jc => ['PENDING', 'READY'].includes(jc.status) },
  { id: 'RUNNING', label: 'Running', match: jc => ['IN_PROGRESS', 'PAUSED'].includes(jc.status) },
  { id: 'HOLD', label: 'On hold', match: jc => jc.status === 'ON_HOLD' },
  { id: 'REWORK', label: 'Rework', match: jc => Boolean(jc.is_rework) && !['COMPLETED', 'CANCELLED'].includes(jc.status) },
  { id: 'DONE', label: 'Completed', match: jc => jc.status === 'COMPLETED' },
  { id: 'ALL', label: 'All', match: () => true }
];

// Why can't this job move right now, and what is the one thing to do about it
const analyse = (jc, { isPlanFulfilled }) => {
  const shipment = isShipment(jc);
  const sub = isSubcontract(jc);
  const hasMachine = shipment || sub || (jc.workstation_id !== null && jc.workstation_id !== undefined && jc.workstation_id !== '');
  const hasPerson = sub ? Boolean(jc.vendor_id) : Boolean(jc.assigned_to);
  const live = !['COMPLETED', 'CANCELLED'].includes(jc.status);

  if (jc.status === 'COMPLETED') return { primary: { key: 'view', label: 'View', icon: Eye, tone: 'ghost' } };
  if (jc.status === 'CANCELLED') return { primary: { key: 'view', label: 'View', icon: Eye, tone: 'ghost' } };
  if (jc.status === 'ON_HOLD') return { hint: jc.hold_reason ? `On hold: ${jc.hold_reason}` : 'On hold', hintTone: 'slate', primary: { key: 'resume', label: 'Resume', icon: PlayCircle, tone: 'amber' } };
  if (live && jc.wo_status === 'ON_HOLD') return { hint: 'The work order is on hold.', hintTone: 'slate', primary: { key: 'view', label: 'View', icon: Eye, tone: 'ghost' } };
  if (live && jc.wo_status === 'DRAFT') return { hint: 'The work order is still a draft. Release it first.', hintTone: 'amber', primary: { key: 'view', label: 'View', icon: Eye, tone: 'ghost' } };
  if (live && !isPlanFulfilled(jc)) return { hint: 'Material has not been released by Stores yet.', hintTone: 'rose', icon: PackageX, primary: { key: 'view', label: 'Waiting for material', icon: PackageX, tone: 'disabled', disabled: true } };
  if (live && jc.is_assembly_waiting) return { hint: 'Waiting for components from the sub-assemblies.', hintTone: 'rose', icon: Puzzle, primary: { key: 'view', label: 'Waiting for components', icon: Puzzle, tone: 'disabled', disabled: true } };
  if (sub) return { hint: jc.status === 'IN_PROGRESS' ? 'Sent to vendor. Record the inward challan when goods return.' : null, hintTone: 'sky', primary: { key: 'outward', label: 'Challan', icon: Truck, tone: 'sky' } };
  if (!hasMachine || !hasPerson) {
    const missing = [!hasMachine && 'machine', !hasPerson && 'operator'].filter(Boolean).join(' and ');
    return { hint: `Choose a ${missing} before this can start.`, hintTone: 'amber', primary: { key: 'edit', label: 'Assign', icon: UserCog, tone: 'amber' } };
  }
  if (['IN_PROGRESS', 'PAUSED'].includes(jc.status)) return { primary: { key: 'production', label: shipment ? 'Ship / track' : 'Production entry', icon: ClipboardEdit, tone: 'indigo' } };
  return { primary: { key: 'start', label: 'Start', icon: Play, tone: 'green' } };
};

const TONE = {
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white', indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white', amber: 'bg-amber-500 hover:bg-amber-600 text-white',
  sky: 'bg-sky-600 hover:bg-sky-700 text-white', ghost: 'border border-slate-200 text-slate-600 hover:bg-slate-50', disabled: 'bg-slate-100 text-slate-400 cursor-not-allowed'
};
const HINT_TONE = { rose: 'text-rose-700 bg-rose-50', amber: 'text-amber-800 bg-amber-50', slate: 'text-slate-600 bg-slate-100', sky: 'text-sky-800 bg-sky-50' };
const PRIORITY_CLS = { URGENT: 'bg-rose-100 text-rose-700', HIGH: 'bg-amber-100 text-amber-700' };

const JobCardList = ({
  jobCards, loading, searchQuery, setSearchQuery, isPlanFulfilled,
  onView, onStart, onProduction, onOutward, onEdit, onDelete, onCreate, onResetQueue, onRefresh
}) => {
  const [filter, setFilter] = useState('ACTIVE');
  const [lateOnly, setLateOnly] = useState(false);
  const [machine, setMachine] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [menuFor, setMenuFor] = useState(null);
  const [pageMenu, setPageMenu] = useState(false);
  const [scheduling, setScheduling] = useState(null);
  const [reroutingRework, setReroutingRework] = useState(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.id, jobCards.filter(f.match).length])), [jobCards]);
  const lateCount = useMemo(() => jobCards.filter(isLate).length, [jobCards]);
  const machines = useMemo(() => Array.from(new Set(jobCards.map(j => j.workstation_name).filter(Boolean))).sort(), [jobCards]);

  const visible = useMemo(() => {
    const active = FILTERS.find(f => f.id === filter);
    return jobCards.filter(jc => active.match(jc) && (!lateOnly || isLate(jc)) && (!machine || jc.workstation_name === machine));
  }, [jobCards, filter, lateOnly, machine]);

  // One card per work order, operations in routing order inside it
  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach(jc => {
      const key = String(jc.work_order_id);
      if (!map.has(key)) map.set(key, { key, wo: jc, jobs: [] });
      map.get(key).jobs.push(jc);
    });
    return Array.from(map.values()).map(g => ({
      ...g,
      jobs: g.jobs.sort((a, b) => (num(a.sequence_no) - num(b.sequence_no)) || a.id - b.id),
      all: jobCards.filter(j => String(j.work_order_id) === g.key)
    }));
  }, [visible, jobCards]);

  const call = async (path, body, okMessage) => {
    const response = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await Swal.fire({ icon: 'warning', title: "That can't be done yet", text: data.error || data.message || 'The action was refused', confirmButtonColor: '#4f46e5' });
      return;
    }
    successToast(okMessage);
    onRefresh();
  };
  const hold = async (jc) => {
    const { value } = await Swal.fire({
      title: `Put ${jc.job_card_no} on hold?`, input: 'text', inputLabel: 'Reason (required)', showCancelButton: true, confirmButtonText: 'Hold', confirmButtonColor: '#d97706',
      inputValidator: v => (!v || !v.trim() ? 'Please give a reason' : null)
    });
    if (value) await call(`/job-cards/${jc.id}/hold`, { reason: value }, 'Job put on hold');
  };
  const resume = jc => call(`/job-cards/${jc.id}/resume`, null, 'Job resumed');

  const runPrimary = (jc, key) => {
    if (key === 'start') return onStart(jc);
    if (key === 'production') return onProduction(jc);
    if (key === 'outward') return onOutward(jc);
    if (key === 'edit') return onEdit(jc);
    if (key === 'resume') return resume(jc);
    return onView(jc);
  };

  return (
    <div className="space-y-3" onClick={() => { setMenuFor(null); setPageMenu(false); }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Job Cards</h1>
          <p className="text-xs text-slate-500">Each work order's operations in order. The button on each row is the next thing to do.</p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onRefresh} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={onCreate} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><Plus className="w-4 h-4" /> Create job card</button>
          <div className="relative">
            <button onClick={() => setPageMenu(v => !v)} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="More"><MoreVertical className="w-4 h-4" /></button>
            {pageMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg z-20">
                <button onClick={onResetQueue} disabled={jobCards.length === 0} className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40 flex items-center gap-2"><Trash2 className="w-3 h-3" /> Reset queue (delete all)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-full border ${filter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f.label} <span className={filter === f.id ? 'opacity-80' : 'text-slate-400'}>{counts[f.id]}</span>
            </button>
          ))}
          <button onClick={() => setLateOnly(v => !v)}
            className={`px-3 py-1.5 text-xs rounded-full border flex items-center gap-1 ${lateOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}>
            <AlertTriangle className="w-3 h-3" /> Late {lateCount}
          </button>
        </div>
        <select value={machine} onChange={e => setMachine(e.target.value)} className="ml-auto border border-slate-200 rounded px-2 py-1.5 text-xs">
          <option value="">All machines</option>
          {machines.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={searchQuery || ''} onChange={e => setSearchQuery(e.target.value)} placeholder="Search job card, work order, operation, operator..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-72" />
        </div>
      </div>

      {loading && jobCards.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading job cards...</div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center">
          <div className="text-sm text-slate-700">{jobCards.length === 0 ? 'No job cards yet' : 'No job cards match these filters'}</div>
          <div className="text-xs text-slate-500 mt-1">{jobCards.length === 0 ? 'Job cards appear when a work order is released.' : 'Try another filter or clear the search.'}</div>
        </div>
      ) : groups.map(g => {
        const total = g.all.filter(j => j.status !== 'CANCELLED').length;
        const done = g.all.filter(j => j.status === 'COMPLETED').length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const isCollapsed = collapsed[g.key] ?? false;
        const wo = g.wo;
        return (
          <div key={g.key} className="bg-white border border-slate-200 rounded">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-100 rounded-t cursor-pointer" onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [g.key]: !isCollapsed })); }}>
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              <div className="min-w-[12rem]">
                <div className="text-sm text-slate-900 leading-tight">{wo.item_name || wo.item_code}
                  {PRIORITY_CLS[wo.priority] && <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_CLS[wo.priority]}`}>{wo.priority}</span>}
                </div>
                <div className="text-[11px] text-slate-500"><span className="text-indigo-600">{wo.wo_number}</span> · {cleanProjectName(wo.project_name, wo.client_name) || 'No project'} · qty {num(wo.wo_quantity)}</div>
              </div>
              <div className="flex items-center gap-2 w-40">
                <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                <span className="text-xs text-slate-600">{done}/{total}</span>
              </div>
            </div>

            {!isCollapsed && (
              <ol className="divide-y divide-slate-100">
                {g.jobs.map(jc => {
                  const a = analyse(jc, { isPlanFulfilled });
                  const P = a.primary.icon;
                  const planned = num(jc.planned_qty);
                  const produced = num(jc.produced_qty);
                  const pctDone = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
                  const late = isLate(jc);
                  const due = formatWhen(jc.end_time);
                  return (
                    <li key={jc.id} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${jc.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : jc.status === 'IN_PROGRESS' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {jc.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : jc.sequence_no}
                        </span>
                        <div className="min-w-[11rem] flex-1">
                          <div className="text-sm text-slate-900 leading-tight">{jc.operation_name}
                            {jc.is_rework ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 inline-flex items-center gap-0.5"><RotateCcw className="w-2.5 h-2.5" />Rework</span> : null}
                            {isSubcontract(jc) ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Subcontract</span> : null}
                          </div>
                          <div className="text-[11px] text-slate-500">{jc.job_card_no}</div>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded w-20 text-center ${STATUS_STYLE[jc.status] || ''}`}>{STATUS_LABEL[jc.status] || jc.status}</span>
                        <div className="w-40">
                          <div className="flex justify-between text-[11px] text-slate-500"><span>{isShipment(jc) ? 'Shipped' : 'Made'} {produced} / {planned}</span><span>{pctDone}%</span></div>
                          <div className="h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${pctDone}%` }} /></div>
                          {(num(jc.accepted_qty) > 0 || num(jc.rejected_qty) > 0) && <div className="text-[10px] text-slate-400">{num(jc.accepted_qty)} accepted{num(jc.rejected_qty) > 0 ? ` · ${num(jc.rejected_qty)} rejected` : ''}</div>}
                        </div>
                        <div className="w-44 text-[11px] text-slate-500 space-y-0.5">
                          <div className="flex items-center gap-1"><Cpu className="w-3 h-3" />{isShipment(jc) ? 'Dispatch' : isSubcontract(jc) ? (jc.vendor_name || 'Vendor not set') : (jc.workstation_name || 'No machine')}</div>
                          <div className="flex items-center gap-1"><User className="w-3 h-3" />{isSubcontract(jc) ? 'Vendor' : (jc.operator_name || 'No operator')}</div>
                        </div>
                        <div className={`w-28 text-[11px] flex items-center gap-1 ${late ? 'text-rose-600' : 'text-slate-500'}`}><Clock className="w-3 h-3" />{due ? `${late ? 'Late · ' : ''}${due}` : 'Not scheduled'}</div>
                        <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                          <button disabled={a.primary.disabled} onClick={() => runPrimary(jc, a.primary.key)} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded ${TONE[a.primary.tone]}`}><P className="w-3.5 h-3.5" />{a.primary.label}</button>
                          <div className="relative">
                            <button onClick={() => setMenuFor(menuFor === jc.id ? null : jc.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="More"><MoreVertical className="w-4 h-4" /></button>
                            {menuFor === jc.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded shadow-lg z-20 text-xs">
                                <button onClick={() => { setMenuFor(null); onView(jc); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Eye className="w-3 h-3" /> View details</button>
                                {['IN_PROGRESS', 'COMPLETED'].includes(jc.status) && !isSubcontract(jc) && <button onClick={() => { setMenuFor(null); onProduction(jc); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><ClipboardEdit className="w-3 h-3" /> Production &amp; quality logs</button>}
                                {jc.is_rework && (!jc.produced_qty || parseFloat(jc.produced_qty) === 0) && (
                                  <button onClick={() => { setMenuFor(null); setReroutingRework(jc); }} className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 text-indigo-700 font-medium">
                                    <RotateCcw className="w-3 h-3 text-indigo-600" /> Re-route rework to...
                                  </button>
                                )}
                                {!['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(jc.status) && !isShipment(jc) && !isSubcontract(jc) && <button onClick={() => { setMenuFor(null); setScheduling(jc); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><CalendarClock className="w-3 h-3" /> Schedule machine &amp; time</button>}
                                {!['COMPLETED', 'CANCELLED'].includes(jc.status) && <button onClick={() => { setMenuFor(null); onEdit(jc); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit / assign</button>}
                                {['PENDING', 'READY', 'IN_PROGRESS', 'PAUSED'].includes(jc.status) && !isShipment(jc) && <button onClick={() => { setMenuFor(null); hold(jc); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-amber-700"><PauseCircle className="w-3 h-3" /> Put on hold</button>}
                                {!isShipment(jc) && jc.status !== 'COMPLETED' && <button onClick={() => { setMenuFor(null); onDelete(jc.id); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600"><Trash2 className="w-3 h-3" /> Delete</button>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {a.hint && <div className={`mt-1.5 ml-10 text-xs rounded px-2 py-1 inline-block ${HINT_TONE[a.hintTone] || HINT_TONE.slate}`}>{a.hint}</div>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
      {scheduling && <ScheduleJobModal jc={scheduling} onClose={() => setScheduling(null)} onDone={() => { setScheduling(null); onRefresh(); }} />}

      {/* Re-route Rework Modal */}
      {reroutingRework && (() => {
        const woOps = jobCards
          .filter(j => String(j.work_order_id) === String(reroutingRework.work_order_id) && !j.is_rework && j.status !== 'CANCELLED')
          .sort((a, b) => (num(a.sequence_no) - num(b.sequence_no)));
        const firstOp = woOps[0];

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-indigo-600" /> Re-route Rework Operation
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {reroutingRework.job_card_no} · Qty: {reroutingRework.planned_qty} pcs
                  </p>
                </div>
                <button onClick={() => setReroutingRework(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
              </div>

              <div className="p-4 space-y-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200/60 rounded text-amber-800 text-[11px]">
                  <b>Current Rework Step:</b> {reroutingRework.operation_name} (Sequence {reroutingRework.sequence_no})
                  <div className="text-amber-700 mt-0.5">
                    Choose which operation should perform this rework (e.g. send back to the First Operation if the defect requires re-machining the base geometry).
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-700 block text-xs">Target Operation in Work Order:</label>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {firstOp && (
                      <label className="flex items-start gap-2.5 p-2 rounded border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="targetOp"
                          defaultChecked
                          value={firstOp.id}
                          id="first-op-choice"
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-900">
                              (1) First Operation: {firstOp.operation_name}
                            </span>
                            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold">Recommended</span>
                          </div>
                          <p className="text-[10px] text-indigo-600 mt-0.5">
                            Re-machines from the initial stage ({firstOp.workstation_name || 'Machine 1'}), passing output downstream.
                          </p>
                        </div>
                      </label>
                    )}

                    {woOps.filter(op => !firstOp || op.id !== firstOp.id).map(op => (
                      <label key={op.id} className="flex items-start gap-2.5 p-2 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="targetOp"
                          value={op.id}
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-slate-800">
                            ({op.sequence_no}) {op.operation_name}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {op.workstation_name || 'No machine'} · {op.job_card_no}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReroutingRework(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const selected = document.querySelector('input[name="targetOp"]:checked');
                    if (!selected) {
                      Swal.fire({ icon: 'warning', title: 'Please select an operation', confirmButtonColor: '#4f46e5' });
                      return;
                    }
                    const targetId = parseInt(selected.value, 10);
                    const isFirst = firstOp && targetId === firstOp.id;
                    await call(
                      `/job-cards/${reroutingRework.id}/re-route-rework`,
                      { targetJobCardId: targetId, reworkRoutingType: isFirst ? 'FIRST_OPERATION' : 'SELECT_OPERATION' },
                      'Rework job card successfully moved to target operation!'
                    );
                    setReroutingRework(null);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Move Rework to Selected Operation
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default JobCardList;
