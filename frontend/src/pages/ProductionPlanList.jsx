import React, { useState, useMemo } from 'react';
import {
  Plus, RefreshCw, Search, MoreVertical, Send, Rocket, Eye, Pencil, Settings, Trash2, PackageCheck, Activity, CheckCircle2,
  Hourglass, ArrowRight, AlertTriangle, Layers
} from 'lucide-react';
import { cleanProjectName } from '../utils/formatters';

const num = v => parseFloat(v) || 0;
const formatDate = v => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Where is this plan in the flow, and what is the one thing to do next
const STAGES = {
  REQUEST: { label: 'Request material', short: 'Material not requested' },
  RELEASE: { label: 'Waiting for Stores', short: 'Waiting for Stores to release material' },
  CREATE: { label: 'Create work orders', short: 'Material released — ready for work orders' },
  PRODUCTION: { label: 'In production', short: 'Work orders running' },
  DONE: { label: 'Completed', short: 'All work orders completed' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled' }
};

const analysePlan = (p) => {
  const wo = num(p.wo_count);
  const doneWo = num(p.completed_wo_count);
  const live = num(p.live_mr_count);
  const released = num(p.released_mr_count);
  const status = String(p.status || '').toUpperCase();

  let stage;
  if (status === 'CANCELLED') stage = 'CANCELLED';
  else if (wo > 0 && doneWo >= wo) stage = 'DONE';
  else if (status === 'COMPLETED') stage = 'DONE';
  else if (wo > 0) stage = 'PRODUCTION';
  else if (live === 0) stage = 'REQUEST';
  else if (released < live) stage = 'RELEASE';
  else stage = 'CREATE';

  const materialState = live === 0 ? 'none' : released >= live ? 'released' : (released > 0 || num(p.partial_mr_count) > 0) ? 'partial' : 'requested';
  const warnings = [];
  if (stage === 'PRODUCTION' && materialState !== 'released') warnings.push(live === 0 ? 'Work orders exist but no material request was made.' : 'Some material is not released yet — job cards cannot start until it is.');
  if (num(p.late_wo_count) > 0) warnings.push(`${p.late_wo_count} work order(s) are past their end date.`);
  if (num(p.held_ops) > 0) warnings.push(`${p.held_ops} operation(s) on hold.`);
  return { stage, materialState, wo, doneWo, live, released, warnings };
};

const FILTERS = [
  { id: 'ACTION', label: 'Needs action', match: a => ['REQUEST', 'CREATE'].includes(a.stage) },
  { id: 'MATERIAL', label: 'Waiting for material', match: a => a.stage === 'RELEASE' },
  { id: 'PRODUCTION', label: 'In production', match: a => a.stage === 'PRODUCTION' },
  { id: 'DONE', label: 'Completed', match: a => a.stage === 'DONE' },
  { id: 'ALL', label: 'All', match: () => true }
];

const TRACK = ['Planned', 'Material', 'Work orders', 'Production', 'Done'];
// How many tracker steps are finished, per stage
const TRACK_DONE = { REQUEST: 1, RELEASE: 1, CREATE: 2, PRODUCTION: 3, DONE: 5, CANCELLED: 0 };

const Tracker = ({ a }) => {
  const done = TRACK_DONE[a.stage];
  return (
    <div className="flex items-center gap-1">
      {TRACK.map((label, i) => {
        const finished = i < done;
        const current = i === done && a.stage !== 'CANCELLED';
        const warn = i === 1 && ['requested', 'partial'].includes(a.materialState) && a.stage !== 'PRODUCTION' && a.stage !== 'DONE';
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center w-14">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${finished ? 'bg-emerald-500 text-white' : current ? (warn || a.stage === 'RELEASE' ? 'bg-amber-400 text-white ring-2 ring-amber-200' : 'bg-indigo-600 text-white ring-2 ring-indigo-200') : 'bg-slate-200 text-slate-400'}`}>
                {finished ? '✓' : i + 1}
              </span>
              <span className={`mt-0.5 text-[10px] leading-tight text-center ${finished ? 'text-emerald-700' : current ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            </div>
            {i < TRACK.length - 1 && <span className={`w-3 h-px -mt-3 ${i < done - 1 ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ProductionPlanList = ({
  plans, loading, selectedIds, setSelectedIds,
  onNew, onRefresh, onView, onConfig, onRequestMaterial, onCreateWorkOrders, onOpenWorkOrders, onTrackMaterial, onEdit, onDelete, onBulkMaterialRequest
}) => {
  const [filter, setFilter] = useState('ACTION');
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState(null);

  const analysed = useMemo(() => plans.map(p => ({ plan: p, a: analysePlan(p) })), [plans]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.id, analysed.filter(x => f.match(x.a)).length])), [analysed]);

  const visible = useMemo(() => {
    const active = FILTERS.find(f => f.id === filter);
    const q = search.trim().toLowerCase();
    return analysed.filter(({ plan, a }) => active.match(a) && (!q || [plan.plan_code, plan.order_no, plan.project_name, plan.company_name, plan.drawing_no, plan.item_code, plan.item_description].some(v => String(v || '').toLowerCase().includes(q))));
  }, [analysed, filter, search]);

  // The plans that can take a bulk material request are the ones still at the "Request material" step
  const selectable = id => analysed.find(x => x.plan.id === id)?.a.stage === 'REQUEST';
  const toggle = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const primary = ({ plan, a }) => {
    switch (a.stage) {
      case 'REQUEST': return { label: 'Request material', icon: Send, cls: 'bg-indigo-600 hover:bg-indigo-700 text-white', run: () => onRequestMaterial(plan.id) };
      case 'RELEASE': return { label: 'Track material', icon: Hourglass, cls: 'bg-amber-500 hover:bg-amber-600 text-white', run: () => onTrackMaterial(plan) };
      case 'CREATE': return { label: 'Create work orders', icon: Rocket, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white', run: () => onCreateWorkOrders(plan.id) };
      case 'PRODUCTION': return { label: 'Work orders', icon: Activity, cls: 'border border-indigo-200 text-indigo-700 hover:bg-indigo-50', run: () => onOpenWorkOrders(plan) };
      default: return { label: 'View', icon: Eye, cls: 'border border-slate-200 text-slate-600 hover:bg-slate-50', run: () => onView(plan.id) };
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-3" onClick={() => setMenuFor(null)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Production Plans</h1>
          <p className="text-xs text-slate-500">Plan → request material → Stores release → create work orders → produce. Each plan shows where it is and what to do next.</p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onRefresh} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={onNew} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><Plus className="w-4 h-4" /> New production plan</button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-indigo-200 bg-indigo-50 p-3">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">{selectedCount}</span>
          <span className="text-sm text-slate-900">{selectedCount} plan(s) selected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-white rounded">Clear</button>
            <button onClick={onBulkMaterialRequest} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"><Send className="w-3 h-3" /> Request material for all selected</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-full border ${filter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f.label} <span className={filter === f.id ? 'opacity-80' : 'text-slate-400'}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plan, order, project, drawing..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-72" />
        </div>
      </div>

      {loading && plans.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading production plans...</div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center">
          <div className="text-sm text-slate-700">{plans.length === 0 ? 'No production plans yet' : filter === 'ACTION' ? 'Nothing needs your action here' : 'No plans match'}</div>
          <div className="text-xs text-slate-500 mt-1">{plans.length === 0 ? 'Create one from an approved sales order.' : 'Try another filter, or look at All.'}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(({ plan, a }) => {
            const act = primary({ plan, a });
            const ActIcon = act.icon;
            const totalOps = num(plan.total_ops);
            const doneOps = num(plan.completed_ops);
            const pct = a.wo > 0 ? Math.round((a.doneWo / a.wo) * 100) : 0;
            const canSelect = selectable(plan.id);
            const locked = a.wo > 0;
            return (
              <div key={plan.id} className={`bg-white border rounded ${selectedIds.has(plan.id) ? 'border-indigo-400' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-4 px-3 py-3">
                  <input type="checkbox" disabled={!canSelect} checked={selectedIds.has(plan.id)} onChange={() => toggle(plan.id)}
                    title={canSelect ? 'Select for bulk material request' : 'Only plans waiting for a material request can be selected'} className="shrink-0" />
                  <div className="min-w-[10rem]">
                    <div className="text-sm text-indigo-700">{plan.plan_code}</div>
                    <div className="text-[11px] text-slate-500">{formatDate(plan.plan_date)}</div>
                    <div className="text-[11px] text-slate-400">{plan.order_no || 'Direct order'}</div>
                  </div>
                  <div className="min-w-[14rem] flex-1">
                    <div className="text-sm text-slate-900 leading-tight flex items-center gap-1"><Layers className="w-3 h-3 text-slate-400" />{plan.drawing_no || plan.item_code || plan.bom_no || '—'}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{plan.item_description || '—'}</div>
                    <div className="text-[11px] text-slate-400">{cleanProjectName(plan.project_name, plan.company_name) || plan.company_name || ''}</div>
                  </div>
                  <div className="w-20 text-center"><div className="text-lg text-slate-900 leading-none">{num(plan.target_qty)}</div><div className="text-[10px] text-slate-400">to make</div></div>
                  <Tracker a={a} />
                  <div className="w-36">
                    {a.wo > 0 ? (
                      <>
                        <div className="flex justify-between text-[11px] text-slate-500"><span>{a.doneWo}/{a.wo} work orders</span><span>{pct}%</span></div>
                        <div className="h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                        <div className="text-[10px] text-slate-400">{doneOps}/{totalOps} operations done</div>
                      </>
                    ) : <div className="text-[11px] text-slate-400">{STAGES[a.stage].short}</div>}
                  </div>
                  <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                    <button onClick={act.run} className={`flex items-center gap-1 px-3 py-2 text-xs rounded ${act.cls}`}><ActIcon className="w-3.5 h-3.5" />{act.label}</button>
                    <div className="relative">
                      <button onClick={() => setMenuFor(menuFor === plan.id ? null : plan.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="More"><MoreVertical className="w-4 h-4" /></button>
                      {menuFor === plan.id && (
                        <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded shadow-lg z-20 text-xs">
                          <button onClick={() => { setMenuFor(null); onView(plan.id); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Eye className="w-3 h-3" /> View plan details</button>
                          <button onClick={() => { setMenuFor(null); onConfig(plan); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Settings className="w-3 h-3" /> Materials &amp; operations</button>
                          {a.live > 0 && <button onClick={() => { setMenuFor(null); onTrackMaterial(plan); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><PackageCheck className="w-3 h-3" /> Track material</button>}
                          {a.stage !== 'REQUEST' && a.stage !== 'DONE' && <button onClick={() => { setMenuFor(null); onRequestMaterial(plan.id); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Send className="w-3 h-3" /> Request more material</button>}
                          {a.wo > 0 && <button onClick={() => { setMenuFor(null); onOpenWorkOrders(plan); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><ArrowRight className="w-3 h-3" /> Open work orders</button>}
                          {!locked && <button onClick={() => { setMenuFor(null); onEdit(plan.id); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit plan</button>}
                          <button onClick={() => { setMenuFor(null); onDelete(plan.id); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600"><Trash2 className="w-3 h-3" /> Delete plan</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {a.warnings.length > 0 && (
                  <div className="px-3 pb-2 flex flex-wrap gap-2">
                    {a.warnings.map(w => <span key={w} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800"><AlertTriangle className="w-3 h-3" />{w}</span>)}
                  </div>
                )}
                {a.stage === 'DONE' && <div className="px-3 pb-2 text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> All work orders completed</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductionPlanList;
