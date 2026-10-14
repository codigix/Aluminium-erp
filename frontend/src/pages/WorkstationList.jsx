import React, { useState, useMemo } from 'react';
import { Plus, RefreshCw, Search, MoreVertical, CalendarClock, Pencil, Trash2, Wrench, Cpu, Activity } from 'lucide-react';

const num = v => parseFloat(v) || 0;
const formatWhen = v => {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const STATE = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-100 text-emerald-700' },
  RUNNING: { label: 'Running', cls: 'bg-indigo-100 text-indigo-700' },
  BOOKED: { label: 'Booked', cls: 'bg-amber-100 text-amber-700' },
  INACTIVE: { label: 'Inactive', cls: 'bg-slate-100 text-slate-500' }
};

const stateOf = (w, o) => {
  if (String(w.status || 'Active').toLowerCase() !== 'active') return 'INACTIVE';
  return o && !o.error ? o.state : null;
};
const maintenanceDue = (o) => Boolean(o && !o.error && o.maintenance && o.maintenance.nextDue && (o.maintenance.overdue || o.maintenance.daysToDue <= 7));

const FILTERS = [
  { id: 'ALL', label: 'All', match: () => true },
  { id: 'AVAILABLE', label: 'Available now', match: (w, o) => stateOf(w, o) === 'AVAILABLE' },
  { id: 'RUNNING', label: 'Running', match: (w, o) => stateOf(w, o) === 'RUNNING' },
  { id: 'BOOKED', label: 'Booked', match: (w, o) => stateOf(w, o) === 'BOOKED' },
  { id: 'MAINT', label: 'Maintenance due', match: (w, o) => maintenanceDue(o) },
  { id: 'INACTIVE', label: 'Inactive', match: (w, o) => stateOf(w, o) === 'INACTIVE' }
];

const WorkstationList = ({ workstations, overview, loading, onNew, onRefresh, onSchedule, onEdit, onDelete }) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.id, workstations.filter(w => f.match(w, overview[w.id])).length])), [workstations, overview]);
  const liveAvailable = Object.keys(overview).length > 0 && Object.values(overview).some(o => !o.error);

  const visible = useMemo(() => {
    const active = FILTERS.find(f => f.id === filter);
    const q = search.trim().toLowerCase();
    return workstations.filter(w => active.match(w, overview[w.id]) && (!q || [w.workstation_code, w.workstation_name, w.workstation_type, w.location, w.department].some(v => String(v || '').toLowerCase().includes(q))));
  }, [workstations, overview, filter, search]);

  return (
    <div className="space-y-3" onClick={() => setMenuFor(null)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Workstations</h1>
          <p className="text-xs text-slate-500">Every machine and station, what it is doing right now, and when it is next free. Press Schedule to see its full timetable.</p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onRefresh} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={onNew} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><Plus className="w-4 h-4" /> Add workstation</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.filter(f => liveAvailable || ['ALL', 'INACTIVE'].includes(f.id)).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 text-xs rounded-full border ${filter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f.label} <span className={filter === f.id ? 'opacity-80' : 'text-slate-400'}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search machine, code, type, location..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-72" />
        </div>
      </div>
      {!liveAvailable && !loading && workstations.length > 0 && <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">Live status is not available right now, so only the machine details are shown.</div>}

      {loading && workstations.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading workstations...</div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center text-sm text-slate-500">{workstations.length === 0 ? 'No workstations yet. Add the first machine to start scheduling.' : 'No workstations match.'}</div>
      ) : (
        <div className="space-y-2">
          {visible.map(w => {
            const o = overview[w.id];
            const st = stateOf(w, o);
            const stateStyle = st ? STATE[st] : null;
            const live = o && !o.error;
            const maint = live ? o.maintenance : null;
            return (
              <div key={w.id} className="bg-white border border-slate-200 rounded px-3 py-3 flex flex-wrap items-center gap-4">
                <div className="min-w-[13rem] flex-1">
                  <div className="text-sm text-slate-900 flex items-center gap-2"><Cpu className="w-4 h-4 text-slate-400" />{w.workstation_name} <span className="text-xs text-indigo-600">{w.workstation_code}</span></div>
                  <div className="text-[11px] text-slate-500">{[w.workstation_type, w.location, w.department].filter(Boolean).join(' · ')}</div>
                  <div className="text-[11px] text-slate-400">Capacity {num(w.capacity) || 1} at a time · target {num(w.target_utilization)}% · ₹{num(w.hourly_rate)}/hr</div>
                </div>

                <div className="w-44">
                  {stateStyle ? <span className={`text-[11px] px-2 py-0.5 rounded ${stateStyle.cls}`}>{stateStyle.label}</span> : <span className="text-[11px] text-slate-400">Status not available</span>}
                  {live && o.currentJob && <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1"><Activity className="w-3 h-3" />{o.currentJob.jobCardNo} · {o.currentJob.operation}</div>}
                  {live && st !== 'INACTIVE' && <div className="text-[11px] text-slate-500">{st === 'AVAILABLE' ? 'Free now' : `Free from ${formatWhen(o.nextFreeAt) || '—'}`}</div>}
                </div>

                <div className="w-40">
                  {live && st !== 'INACTIVE' ? (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-500"><span>Booked today</span><span>{o.bookedPercentToday}%</span></div>
                      <div className="h-1.5 bg-slate-100 rounded overflow-hidden"><div className={`h-full ${o.bookedPercentToday >= 90 ? 'bg-rose-500' : o.bookedPercentToday >= 60 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, o.bookedPercentToday)}%` }} /></div>
                      <div className="text-[10px] text-slate-400">{o.upcomingJobs} job(s) coming up{o.heldJobs ? ` · ${o.heldJobs} held` : ''}</div>
                    </>
                  ) : <div className="text-[11px] text-slate-300">—</div>}
                </div>

                <div className="w-40 text-[11px]">
                  {maint && maint.nextDue ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${maint.overdue ? 'bg-rose-100 text-rose-700' : maint.daysToDue <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      <Wrench className="w-3 h-3" />{maint.overdue ? `Service overdue ${Math.abs(maint.daysToDue)}d` : maint.daysToDue === 0 ? 'Service today' : `Service in ${maint.daysToDue}d`}
                    </span>
                  ) : <span className="text-slate-300">No service date</span>}
                </div>

                <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                  <button onClick={() => onSchedule(w)} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><CalendarClock className="w-4 h-4" />Schedule</button>
                  <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === w.id ? null : w.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="More"><MoreVertical className="w-4 h-4" /></button>
                    {menuFor === w.id && (
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded shadow-lg z-20 text-xs">
                        <button onClick={() => { setMenuFor(null); onEdit(w); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit details</button>
                        <button onClick={() => { setMenuFor(null); onDelete(w); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600"><Trash2 className="w-3 h-3" /> Delete</button>
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
};

export default WorkstationList;
