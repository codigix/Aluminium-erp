import React, { useState, useEffect } from 'react';
import { Modal } from '../components/ui.jsx';
import { CalendarClock, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` });
const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: headers(), body: options.body ? JSON.stringify(options.body) : undefined });
  return { ok: response.ok, data: await response.json().catch(() => ({})) };
};

const pad = n => String(n).padStart(2, '0');
const toInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toSql = value => `${String(value).replace('T', ' ')}${String(value).length === 16 ? ':00' : ''}`;
const show = v => {
  if (!v) return '-';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const inputCls = 'w-full mt-1 border border-slate-200 rounded px-2 py-2 text-sm';
const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-xs text-slate-600">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);

// Estimated minutes: setup + cycle time for the pieces still to make
const estimateMinutes = jc => {
  const remaining = Math.max(0, (parseFloat(jc.planned_qty) || 0) - (parseFloat(jc.produced_qty) || 0));
  const estimate = (parseFloat(jc.setup_time) || 0) + (parseFloat(jc.cycle_time) || 0) * remaining;
  return estimate > 0 ? Math.ceil(estimate) : 60;
};

const ScheduleJobModal = ({ jc, onClose, onDone }) => {
  const [workstations, setWorkstations] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    workstationId: jc.workstation_id || '', assignedTo: jc.assigned_to || '',
    start: toInput(jc.start_time ? new Date(jc.start_time) : new Date()), durationMin: estimateMinutes(jc)
  });
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api('/workstations').then(r => r.ok && setWorkstations((r.data || []).filter(w => (w.status || 'Active') === 'Active')));
    api('/users').then(r => r.ok && setUsers(Array.isArray(r.data) ? r.data : []));
  }, []);

  // Re-check whenever the choice changes (small delay so typing a duration does not spam the server)
  useEffect(() => {
    if (!form.workstationId || !form.start || !(form.durationMin > 0)) { setCheck(null); return undefined; }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      const query = new URLSearchParams({ workstationId: form.workstationId, start: toSql(form.start), durationMin: String(form.durationMin) });
      if (form.assignedTo) query.set('assignedTo', form.assignedTo);
      const r = await api(`/job-cards/${jc.id}/availability?${query}`);
      if (!cancelled) { setCheck(r.ok ? r.data : { error: r.data.error }); setChecking(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.workstationId, form.assignedTo, form.start, form.durationMin, jc.id]);

  const book = async (slotStart, preempt = false) => {
    setSaving(true);
    const r = await api(`/job-cards/${jc.id}/schedule`, {
      method: 'POST',
      body: {
        workstationId: Number(form.workstationId), assignedTo: form.assignedTo ? Number(form.assignedTo) : undefined,
        start: slotStart || toSql(form.start), durationMin: Number(form.durationMin), preempt, reason
      }
    });
    setSaving(false);
    if (!r.ok) {
      await Swal.fire({ icon: 'warning', title: "Couldn't book that slot", text: r.data.error || 'The booking was refused', confirmButtonColor: '#4f46e5' });
      if (r.data.suggestions) setCheck(prev => ({ ...(prev || {}), available: false, suggestions: r.data.suggestions, conflicts: r.data.conflicts || prev?.conflicts }));
      return;
    }
    successToast(preempt ? 'Booked — lower-priority jobs were put on hold' : 'Machine and time booked');
    onDone();
  };

  const conflicts = check ? [...(check.conflicts?.machine || []), ...(check.conflicts?.operator || [])] : [];

  return (
    <Modal isOpen onClose={onClose} title={`Schedule ${jc.job_card_no} — ${jc.operation_name || ''}`} size="2xl">
      <div className="space-y-3 p-1">
        <div className="text-xs text-slate-500">Pick a machine, operator and start time. We check they are free for the whole duration before booking.</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Machine">
            <select className={inputCls} value={form.workstationId} onChange={e => set('workstationId', e.target.value)}>
              <option value="">Select machine</option>
              {workstations.map(w => <option key={w.id} value={w.id}>{w.workstation_name}</option>)}
            </select>
          </Field>
          <Field label="Operator">
            <select className={inputCls} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}>
              <option value="">Select operator</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </Field>
          <Field label="Start">
            <input type="datetime-local" className={inputCls} value={form.start} onChange={e => set('start', e.target.value)} />
          </Field>
          <Field label="How long (minutes)" hint="Estimated from setup + cycle time × pieces remaining">
            <input type="number" min="1" className={inputCls} value={form.durationMin} onChange={e => set('durationMin', e.target.value)} />
          </Field>
        </div>

        {checking && <div className="text-xs text-slate-500">Checking availability...</div>}
        {check?.error && <div className="text-xs text-rose-600">{check.error}</div>}

        {check && !check.error && check.shiftedForSequence && (
          <div className="text-xs rounded bg-sky-50 text-sky-800 p-2">The start was moved to {show(check.start)} because the previous operation of this work order finishes then.</div>
        )}

        {check && !check.error && check.available && !checking && (
          <div className="flex items-center gap-2 rounded bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Free from {show(check.start)} to {show(check.end)}.
          </div>
        )}

        {check && !check.error && !check.available && !checking && (
          <div className="rounded bg-amber-50 border border-amber-200 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-900"><AlertTriangle className="w-4 h-4" /> Not free in that slot.</div>
            {conflicts.map(c => (
              <div key={`${c.jobCardId}-${c.start}`} className="text-xs text-amber-800">{c.jobCardNo} ({c.operation}) is booked {show(c.start)} – {show(c.end)}, priority {c.priority}</div>
            ))}
            {check.suggestions?.length > 0 && (
              <div>
                <div className="text-xs text-slate-600 mb-1">Next free slots — click one to book it:</div>
                <div className="flex flex-wrap gap-2">
                  {check.suggestions.map(s => (
                    <button key={s.start} disabled={saving} onClick={() => book(s.start)} className="px-2 py-1 text-xs bg-white border border-amber-300 rounded hover:bg-amber-100">{show(s.start)} → {show(s.end)}</button>
                  ))}
                </div>
              </div>
            )}
            {check.canPreempt && (
              <div className="border-t border-amber-200 pt-2 space-y-1">
                <div className="text-xs text-slate-700">This job has higher priority ({check.priority}) than what is booked. You can hold the lower-priority job and take the slot — it is re-queued right after this one.</div>
                <input className={inputCls} placeholder="Reason for pre-empting (required)" value={reason} onChange={e => setReason(e.target.value)} />
                <button disabled={!reason.trim() || saving} onClick={() => book(null, true)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-rose-600 text-white rounded disabled:opacity-40"><Zap className="w-3 h-3" /> Hold the other job and book this slot</button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded">Cancel</button>
          <button disabled={!form.workstationId || !form.assignedTo || !check?.available || saving} onClick={() => book(null)}
            className="flex items-center gap-1 px-5 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-40"><CalendarClock className="w-4 h-4" /> Book machine &amp; time</button>
        </div>
      </div>
    </Modal>
  );
};

export default ScheduleJobModal;
