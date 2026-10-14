import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '../components/ui.jsx';
import { Play, PauseCircle, PlayCircle, PackagePlus, ShieldCheck, CheckCircle2, Truck, RefreshCw, Search, AlertTriangle, Clock, User, Cpu } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` });

// Every call returns { ok, data }; the server's message is shown as-is because it already says what to do next
const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: authHeaders(), body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

const currentUserId = () => {
  try {
    const payload = JSON.parse(atob(localStorage.getItem('authToken').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.id ?? null;
  } catch (e) { return null; }
};

const pad = n => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toLocalSql = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const formatDateTime = v => {
  if (!v) return '-';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const isShipmentOp = jc => ['shipment', 'dispatch'].includes(String(jc.operation_name || '').trim().toLowerCase());
const isOutsourced = jc => /^(outsourc|sub[\s-]?contract|vendor)/i.test(String(jc.execution_mode || ''));
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const PRIORITY_CLS = { URGENT: 'bg-rose-100 text-rose-700', HIGH: 'bg-amber-100 text-amber-700', NORMAL: 'bg-slate-100 text-slate-600', LOW: 'bg-slate-50 text-slate-400' };

const TABS = [
  { id: 'running', label: 'Running', match: jc => jc.status === 'IN_PROGRESS' || jc.status === 'PAUSED' },
  { id: 'ready', label: 'Ready to start', match: jc => ['PENDING', 'READY'].includes(jc.status) },
  { id: 'hold', label: 'On hold', match: jc => jc.status === 'ON_HOLD' }
];

// ---------------------------------------------------------------------------
const ShopFloor = () => {
  const [jobCards, setJobCards] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [users, setUsers] = useState([]);
  const [flow, setFlow] = useState({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('ready');
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type, jc }
  const me = useMemo(currentUserId, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [jcs, ws, us] = await Promise.all([api('/job-cards'), api('/workstations'), api('/users')]);
    if (jcs.ok) setJobCards(Array.isArray(jcs.data) ? jcs.data : []);
    else errorToast(jcs.data.error || 'Could not load job cards');
    if (ws.ok) setWorkstations(Array.isArray(ws.data) ? ws.data.filter(w => (w.status || 'Active') === 'Active') : []);
    if (us.ok) setUsers(Array.isArray(us.data) ? us.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const workable = useMemo(() => jobCards.filter(jc =>
    !['DRAFT', 'COMPLETED', 'CANCELLED'].includes(jc.status) &&
    ['RELEASED', 'IN_PROGRESS'].includes(jc.wo_status) && !isOutsourced(jc)
  ), [jobCards]);

  const visible = useMemo(() => {
    const active = TABS.find(t => t.id === tab);
    const q = search.trim().toLowerCase();
    return workable
      .filter(jc => active.match(jc))
      .filter(jc => !onlyMine || (me && Number(jc.assigned_to) === Number(me)))
      .filter(jc => !q || [jc.job_card_no, jc.wo_number, jc.item_name, jc.item_code, jc.operation_name, jc.workstation_name, jc.client_name].some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || String(a.end_time || 'z').localeCompare(String(b.end_time || 'z')));
  }, [workable, tab, onlyMine, search, me]);

  // How many pieces each visible card may work on right now (explains "why can't I start?")
  useEffect(() => {
    let cancelled = false;
    const missing = visible.filter(jc => !flow[jc.id]).slice(0, 30);
    if (missing.length === 0) return undefined;
    Promise.all(missing.map(async jc => {
      const r = await api(`/job-cards/${jc.id}/quantity-availability`);
      return [jc.id, r.ok ? r.data : null];
    })).then(pairs => {
      if (!cancelled) setFlow(prev => ({ ...prev, ...Object.fromEntries(pairs.filter(([, v]) => v)) }));
    });
    return () => { cancelled = true; };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, workable.filter(t.match).length])), [workable]);

  const refreshAfter = async (message) => {
    if (message) successToast(message);
    setModal(null);
    setFlow({});
    await loadAll();
  };

  const act = async (promise, successMessage) => {
    const result = await promise;
    if (!result.ok) {
      await Swal.fire({ icon: 'warning', title: "That can't be done yet", text: result.data.error || result.data.message || 'The action was refused', confirmButtonColor: '#4f46e5' });
      return false;
    }
    await refreshAfter(successMessage);
    return true;
  };

  const hold = async (jc) => {
    const { value } = await Swal.fire({
      title: `Put ${jc.job_card_no} on hold?`, input: 'text', inputLabel: 'Reason (required)', inputPlaceholder: 'e.g. machine breakdown, waiting for drawing change',
      showCancelButton: true, confirmButtonText: 'Hold job', confirmButtonColor: '#d97706', inputValidator: v => (!v || !v.trim() ? 'Please give a reason' : null)
    });
    if (value) await act(api(`/job-cards/${jc.id}/hold`, { method: 'POST', body: { reason: value } }), 'Job put on hold');
  };

  const resume = jc => act(api(`/job-cards/${jc.id}/resume`, { method: 'POST' }), 'Job resumed');

  const complete = async (jc) => {
    const ok = await Swal.fire({
      title: `Complete ${jc.job_card_no}?`, text: 'Make sure all output is logged and inspected. The next operation will be released.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, complete', confirmButtonColor: '#059669'
    });
    if (ok.isConfirmed) await act(api(`/job-cards/${jc.id}/progress`, { method: 'PATCH', body: { status: 'COMPLETED' } }), 'Operation completed');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg text-slate-900">Shop Floor</h1>
          <p className="text-xs text-slate-500">Pick a job, press the big button. Anything blocking a job is explained on its card.</p>
        </div>
        <button onClick={loadAll} className="flex items-center gap-1 px-2 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-slate-200 overflow-hidden">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              {t.label} <span className={`ml-1 text-xs px-1.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-slate-100'}`}>{counts[t.id] || 0}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> Only jobs assigned to me
        </label>
        <div className="relative ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job, work order, item..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-64" />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center text-sm text-slate-500">
          {loading ? 'Loading jobs...' : tab === 'ready' ? 'No jobs are waiting to start.' : tab === 'running' ? 'Nothing is running right now.' : 'No jobs on hold.'}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(jc => (
            <JobTile key={jc.id} jc={jc} flow={flow[jc.id]} onAction={(type) => type === 'hold' ? hold(jc) : type === 'resume' ? resume(jc) : type === 'complete' ? complete(jc) : setModal({ type, jc })} />
          ))}
        </div>
      )}

      {modal?.type === 'start' && <StartModal jc={modal.jc} flow={flow[modal.jc.id]} workstations={workstations} users={users} onClose={() => setModal(null)} onDone={refreshAfter} act={act} />}
      {modal?.type === 'output' && <OutputModal jc={modal.jc} flow={flow[modal.jc.id]} workstations={workstations} users={users} onClose={() => setModal(null)} act={act} />}
      {modal?.type === 'qc' && <QcModal jc={modal.jc} onClose={() => setModal(null)} act={act} />}
      {modal?.type === 'ship' && <ShipModal jc={modal.jc} flow={flow[modal.jc.id]} onClose={() => setModal(null)} act={act} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
const JobTile = ({ jc, flow, onAction }) => {
  const planned = parseFloat(jc.planned_qty) || 0;
  const shipment = isShipmentOp(jc);
  const done = shipment ? (flow?.used ?? 0) : (parseFloat(jc.produced_qty) || 0);
  const percent = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
  const waiting = flow && flow.remaining <= 0 && !['IN_PROGRESS', 'PAUSED'].includes(jc.status);
  const overdue = jc.end_time && new Date(jc.end_time) < new Date();

  let guidance = null;
  if (jc.status === 'ON_HOLD') guidance = { cls: 'text-slate-600 bg-slate-100', text: jc.hold_reason ? `On hold: ${jc.hold_reason}` : 'On hold' };
  else if (waiting) {
    guidance = { cls: 'text-amber-800 bg-amber-50', text: flow.basis === 'COMPONENTS'
      ? 'Waiting for components — the sub-assemblies have not delivered enough yet.'
      : flow.basis === 'PREVIOUS_OPERATION' ? 'Waiting for the previous operation to pass pieces on (accepted by QC).' : 'No quantity available yet.' };
  } else if (flow && flow.available > 0 && flow.available < planned) {
    guidance = { cls: 'text-indigo-800 bg-indigo-50', text: `${flow.remaining} of ${planned} can be worked on now (partial release).` };
  }
  if (!jc.workstation_id && jc.status !== 'ON_HOLD' && !guidance) guidance = { cls: 'text-slate-600 bg-slate-50', text: 'Choose a machine and operator when you start.' };

  const primary = (() => {
    if (jc.status === 'ON_HOLD') return { type: 'resume', label: 'Resume job', icon: PlayCircle, cls: 'bg-emerald-600 hover:bg-emerald-700' };
    if (shipment) return { type: 'ship', label: 'Ship goods', icon: Truck, cls: 'bg-sky-600 hover:bg-sky-700', disabled: waiting };
    if (['IN_PROGRESS', 'PAUSED'].includes(jc.status)) return { type: 'output', label: 'Log output', icon: PackagePlus, cls: 'bg-indigo-600 hover:bg-indigo-700' };
    return { type: 'start', label: 'Start job', icon: Play, cls: 'bg-emerald-600 hover:bg-emerald-700', disabled: waiting };
  })();
  const PrimaryIcon = primary.icon;
  const running = ['IN_PROGRESS', 'PAUSED'].includes(jc.status);

  return (
    <div className={`rounded border bg-white p-3 flex flex-col gap-2 ${jc.priority === 'URGENT' ? 'border-rose-300' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm text-indigo-700">{jc.job_card_no} {jc.is_rework ? <span className="text-rose-600 text-xs">(rework)</span> : null}</div>
          <div className="text-base text-slate-900 leading-tight">{jc.operation_name || 'Operation'}</div>
          <div className="text-xs text-slate-500">{jc.wo_number} · {jc.item_name || jc.item_code}</div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_CLS[jc.priority] || PRIORITY_CLS.NORMAL}`}>{jc.priority || 'NORMAL'}</span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{shipment ? 'Shipped' : 'Produced'} {done} of {planned}</span><span>{percent}%</span>
        </div>
        <div className="h-2 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} /></div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{jc.workstation_name || 'No machine yet'}</span>
        <span className="flex items-center gap-1"><User className="w-3 h-3" />{jc.operator_name || 'No operator yet'}</span>
        <span className={`flex items-center gap-1 ${overdue ? 'text-rose-600' : ''}`}><Clock className="w-3 h-3" />{jc.end_time ? `Due ${formatDateTime(jc.end_time)}` : 'Not scheduled'}{overdue ? ' (late)' : ''}</span>
      </div>

      {guidance && <div className={`text-xs rounded px-2 py-1.5 flex gap-1 ${guidance.cls}`}><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{guidance.text}</div>}

      <div className="flex gap-2 mt-auto pt-1">
        <button disabled={primary.disabled} onClick={() => onAction(primary.type)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm text-white rounded disabled:opacity-40 disabled:cursor-not-allowed ${primary.cls}`}>
          <PrimaryIcon className="w-5 h-5" /> {primary.label}
        </button>
        {running && !shipment && (
          <>
            <button onClick={() => onAction('qc')} title="Send pieces for quality inspection" className="px-3 py-3 text-xs border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center"><ShieldCheck className="w-4 h-4 text-emerald-600" />QC</button>
            <button onClick={() => onAction('complete')} title="Complete this operation" className="px-3 py-3 text-xs border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center"><CheckCircle2 className="w-4 h-4 text-indigo-600" />Done</button>
          </>
        )}
        {jc.status !== 'ON_HOLD' && !shipment && (
          <button onClick={() => onAction('hold')} title="Put on hold" className="px-3 py-3 text-xs border border-slate-200 rounded hover:bg-slate-50 flex flex-col items-center"><PauseCircle className="w-4 h-4 text-amber-600" />Hold</button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-xs text-slate-600">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);
const inputCls = 'w-full mt-1 border border-slate-200 rounded px-2 py-2 text-sm';

// Start: choose machine + operator, see availability first, then start, book another slot, or pre-empt
const StartModal = ({ jc, flow, workstations, users, onClose, act }) => {
  const [workstationId, setWorkstationId] = useState(jc.workstation_id || '');
  const [operatorId, setOperatorId] = useState(jc.assigned_to || '');
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!workstationId) { setCheck(null); return undefined; }
    let cancelled = false;
    setChecking(true);
    const query = new URLSearchParams({ workstationId, start: toLocalSql(new Date()) });
    if (operatorId) query.set('assignedTo', operatorId);
    api(`/job-cards/${jc.id}/availability?${query}`).then(r => {
      if (!cancelled) { setCheck(r.ok ? r.data : { error: r.data.error }); setChecking(false); }
    });
    return () => { cancelled = true; };
  }, [workstationId, operatorId, jc.id]);

  const start = () => act(api(`/job-cards/${jc.id}/progress`, { method: 'PATCH', body: { status: 'IN_PROGRESS', workstationId: Number(workstationId), assignedTo: operatorId ? Number(operatorId) : undefined } }), 'Job started');
  const book = (slot, preempt = false) => act(api(`/job-cards/${jc.id}/schedule`, {
    method: 'POST', body: { workstationId: Number(workstationId), assignedTo: operatorId ? Number(operatorId) : undefined, start: slot?.start || toLocalSql(new Date()), preempt, reason }
  }), preempt ? 'Booked — lower-priority jobs were put on hold' : 'Slot booked');

  return (
    <Modal isOpen onClose={onClose} title={`Start ${jc.job_card_no} — ${jc.operation_name || ''}`} size="2xl">
      <div className="space-y-3 p-1">
        <div className="text-xs text-slate-500">Step 1: choose the machine and operator. Step 2: we check they are free right now.</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Machine">
            <select className={inputCls} value={workstationId} onChange={e => setWorkstationId(e.target.value)}>
              <option value="">Select machine</option>
              {workstations.map(w => <option key={w.id} value={w.id}>{w.workstation_name}</option>)}
            </select>
          </Field>
          <Field label="Operator">
            <select className={inputCls} value={operatorId} onChange={e => setOperatorId(e.target.value)}>
              <option value="">Select operator</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </Field>
        </div>

        {flow && <div className="text-xs text-slate-600">Pieces available to work on: <b>{flow.remaining}</b> of {parseFloat(jc.planned_qty) || 0}</div>}
        {checking && <div className="text-xs text-slate-500">Checking availability...</div>}
        {check?.error && <div className="text-xs text-rose-600">{check.error}</div>}

        {check && !check.error && check.available && (
          <div className="rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">Machine and operator are free. You can start now.</div>
        )}
        {check && !check.error && !check.available && (
          <div className="rounded bg-amber-50 border border-amber-200 p-3 space-y-2">
            <div className="text-sm text-amber-900">Not free right now.</div>
            {[...check.conflicts.machine, ...check.conflicts.operator].map(c => (
              <div key={`${c.jobCardId}-${c.start}`} className="text-xs text-amber-800">{c.jobCardNo} ({c.operation}) is using it until {formatDateTime(c.end)} — priority {c.priority}</div>
            ))}
            {check.suggestions.length > 0 && (
              <div>
                <div className="text-xs text-slate-600 mb-1">Next free slots — pick one to book it:</div>
                <div className="flex flex-wrap gap-2">
                  {check.suggestions.map(s => (
                    <button key={s.start} onClick={() => book(s)} className="px-2 py-1 text-xs bg-white border border-amber-300 rounded hover:bg-amber-100">{formatDateTime(s.start)} → {formatDateTime(s.end)}</button>
                  ))}
                </div>
              </div>
            )}
            {check.canPreempt && (
              <div className="border-t border-amber-200 pt-2 space-y-1">
                <div className="text-xs text-slate-700">This job has higher priority than what is running. You can hold the lower-priority job and take the machine now — it goes back in the queue automatically.</div>
                <input className={inputCls} placeholder="Reason for pre-empting (required)" value={reason} onChange={e => setReason(e.target.value)} />
                <button disabled={!reason.trim()} onClick={() => book(null, true)} className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded disabled:opacity-40">Hold the other job and use this machine now</button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded">Cancel</button>
          <button disabled={!workstationId || !operatorId || !check?.available} onClick={start} className="px-5 py-2 text-sm bg-emerald-600 text-white rounded disabled:opacity-40 flex items-center gap-1"><Play className="w-4 h-4" /> Start now</button>
        </div>
      </div>
    </Modal>
  );
};

const OutputModal = ({ jc, flow, workstations, users, onClose, act }) => {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);
  const sameDay = hourAgo.getDate() === now.getDate();
  const [form, setForm] = useState({
    logDate: todayKey(), startTime: sameDay ? hhmm(hourAgo) : '00:00', endTime: hhmm(now), producedQty: '',
    shift: 'SHIFT_A', workstationId: jc.workstation_id || '', operatorId: jc.assigned_to || ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const remaining = flow ? flow.remaining : null;
  const qty = parseFloat(form.producedQty);
  const tooMany = remaining !== null && qty > remaining + 0.001;

  const submit = () => act(api(`/job-cards/${jc.id}/time-logs`, {
    method: 'POST',
    body: { logDate: form.logDate, startTime: `${form.startTime}:00`, endTime: `${form.endTime}:00`, producedQty: qty, shift: form.shift, workstationId: Number(form.workstationId) || null, operatorId: Number(form.operatorId) || null }
  }), 'Output logged');

  return (
    <Modal isOpen onClose={onClose} title={`Log output — ${jc.job_card_no}`} size="xl">
      <div className="space-y-3 p-1">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={form.logDate} onChange={e => set('logDate', e.target.value)} /></Field>
          <Field label="From"><input type="time" className={inputCls} value={form.startTime} onChange={e => set('startTime', e.target.value)} /></Field>
          <Field label="To" hint="A later day is not needed for night shifts — an earlier 'To' time is treated as next morning"><input type="time" className={inputCls} value={form.endTime} onChange={e => set('endTime', e.target.value)} /></Field>
        </div>
        <Field label="Pieces made in this period" hint={remaining !== null ? `You can log up to ${remaining} more piece(s) on this operation.` : undefined}>
          <input type="number" min="0" step="any" autoFocus className={`${inputCls} text-lg`} value={form.producedQty} onChange={e => set('producedQty', e.target.value)} />
        </Field>
        {tooMany && <div className="text-xs text-rose-600">That is more than is available to this operation right now.</div>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Shift">
            <select className={inputCls} value={form.shift} onChange={e => set('shift', e.target.value)}>
              <option value="SHIFT_A">Shift A</option><option value="SHIFT_B">Shift B</option><option value="SHIFT_C">Shift C</option>
            </select>
          </Field>
          <Field label="Machine">
            <select className={inputCls} value={form.workstationId} onChange={e => set('workstationId', e.target.value)}>
              <option value="">Select</option>{workstations.map(w => <option key={w.id} value={w.id}>{w.workstation_name}</option>)}
            </select>
          </Field>
          <Field label="Operator">
            <select className={inputCls} value={form.operatorId} onChange={e => set('operatorId', e.target.value)}>
              <option value="">Select</option>{users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded">Cancel</button>
          <button disabled={!(qty >= 0) || form.producedQty === '' || tooMany || !form.workstationId || !form.operatorId} onClick={submit} className="px-5 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-40">Save output</button>
        </div>
      </div>
    </Modal>
  );
};

const QcModal = ({ jc, onClose, act }) => {
  const [qty, setQty] = useState(parseFloat(jc.produced_qty) || '');
  const submit = () => act(api('/quality-queue', { method: 'POST', body: { jcId: jc.id, inspectedQty: parseFloat(qty), date: todayKey(), shift: 'A', status: 'PENDING' } }), 'Sent to QC');
  return (
    <Modal isOpen onClose={onClose} title={`Send to QC — ${jc.job_card_no}`} size="md">
      <div className="space-y-3 p-1">
        <div className="text-xs text-slate-500">QC will inspect these pieces. Accepted pieces move on to the next operation; rejected pieces become rework or scrap.</div>
        <Field label="Pieces to inspect" hint={`Produced so far: ${parseFloat(jc.produced_qty) || 0}`}>
          <input type="number" min="0" step="any" className={`${inputCls} text-lg`} value={qty} onChange={e => setQty(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded">Cancel</button>
          <button disabled={!(parseFloat(qty) > 0)} onClick={submit} className="px-5 py-2 text-sm bg-emerald-600 text-white rounded disabled:opacity-40">Send to QC</button>
        </div>
      </div>
    </Modal>
  );
};

const ShipModal = ({ jc, flow, onClose, act }) => {
  const remaining = flow ? flow.remaining : 0;
  const [form, setForm] = useState({ qty: remaining || '', carrier: '', tracking: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const qty = parseFloat(form.qty);
  const planned = parseFloat(jc.planned_qty) || 0;
  const alreadyShipped = flow ? flow.used : 0;
  const isFull = alreadyShipped + qty + 0.001 >= planned;
  const submit = () => act(api(`/job-cards/${jc.id}/progress`, {
    method: 'PATCH',
    body: { dispatchQty: alreadyShipped + qty, dispatchDate: todayKey(), dispatchMode: isFull ? 'Full' : 'Partial', carrierName: form.carrier || undefined, trackingNumber: form.tracking || undefined, shippingNotes: form.notes || undefined }
  }), isFull ? 'Full shipment created' : 'Partial shipment created');

  return (
    <Modal isOpen onClose={onClose} title={`Ship goods — ${jc.job_card_no}`} size="lg">
      <div className="space-y-3 p-1">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded bg-slate-50 p-2"><div className="text-slate-500">Ordered</div><div className="text-base">{planned}</div></div>
          <div className="rounded bg-slate-50 p-2"><div className="text-slate-500">Already shipped</div><div className="text-base">{alreadyShipped}</div></div>
          <div className="rounded bg-emerald-50 p-2"><div className="text-emerald-700">Ready to ship now</div><div className="text-base text-emerald-800">{remaining}</div></div>
        </div>
        <Field label="Quantity to ship now" hint={Number.isFinite(qty) && qty > 0 ? (isFull ? 'This completes the order: a FULL shipment.' : `A PARTIAL shipment. ${Math.max(0, planned - alreadyShipped - qty)} will still be left to ship.`) : undefined}>
          <input type="number" min="0" step="any" className={`${inputCls} text-lg`} value={form.qty} onChange={e => set('qty', e.target.value)} />
        </Field>
        {qty > remaining + 0.001 && <div className="text-xs text-rose-600">Only {remaining} accepted piece(s) are ready to ship.</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Transporter / carrier"><input className={inputCls} value={form.carrier} onChange={e => set('carrier', e.target.value)} /></Field>
          <Field label="Tracking / LR number"><input className={inputCls} value={form.tracking} onChange={e => set('tracking', e.target.value)} /></Field>
        </div>
        <Field label="Notes"><input className={inputCls} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded">Cancel</button>
          <button disabled={!(qty > 0) || qty > remaining + 0.001} onClick={submit} className="px-5 py-2 text-sm bg-sky-600 text-white rounded disabled:opacity-40">Create {isFull ? 'full' : 'partial'} shipment</button>
        </div>
      </div>
    </Modal>
  );
};

export default ShopFloor;
