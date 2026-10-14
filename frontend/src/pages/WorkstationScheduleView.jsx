import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Wrench, Clock, CalendarDays, Activity } from 'lucide-react';
import { Badge } from '../components/ui.jsx';
import { errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const parse = (value) => (value ? new Date(String(value).replace(' ', 'T')) : null);
const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatTime = (value) => {
  const d = parse(value);
  if (!d) return '-';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
};
const formatDateTime = (value) => {
  const d = parse(value);
  if (!d) return '-';
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${formatTime(value)}`;
};
const formatDuration = (minutes) => {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
};

const STATE_STYLES = {
  AVAILABLE: { label: 'Available now', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RUNNING: { label: 'Running', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  BOOKED: { label: 'Booked', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  INACTIVE: { label: 'Inactive', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
};

const SEGMENT_STYLES = {
  IN_PROGRESS: 'bg-indigo-500 border-indigo-700 text-white',
  PAUSED: 'bg-orange-400 border-orange-600 text-white',
  ON_HOLD: 'bg-slate-300 border-slate-500 text-slate-700 opacity-80',
  DEFAULT: 'bg-amber-400 border-amber-600 text-amber-950'
};
const PRIORITY_VARIANT = { URGENT: 'danger', HIGH: 'warning', NORMAL: 'default', LOW: 'default' };

const WorkstationScheduleView = ({ workstationId }) => {
  const [startDate, setStartDate] = useState(() => toDateKey(new Date()));
  const [days, setDays] = useState(7);
  const [dayStart, setDayStart] = useState(8);
  const [dayEnd, setDayEnd] = useState(18);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workstationId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const query = new URLSearchParams({ from: startDate, days: String(days), dayStart: String(dayStart), dayEnd: String(dayEnd) });
      const response = await fetch(`${API_BASE}/workstations/${workstationId}/schedule?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || 'Failed to load schedule');
      setData(body);
    } catch (error) {
      errorToast(error.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [workstationId, startDate, days, dayStart, dayEnd]);

  useEffect(() => { load(); }, [load]);

  const shiftRange = (direction) => {
    const d = new Date(`${startDate}T00:00:00`);
    d.setDate(d.getDate() + direction * days);
    setStartDate(toDateKey(d));
  };

  // One row per distinct job for the table below the timeline
  const jobs = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    data.days.forEach(day => day.segments.forEach(seg => {
      if (!map.has(seg.jobCardId)) map.set(seg.jobCardId, seg);
    }));
    return Array.from(map.values()).sort((a, b) => a.fullStart.localeCompare(b.fullStart));
  }, [data]);

  const hourTicks = useMemo(() => {
    if (!data) return [];
    const { dayStartHour, dayEndHour } = data.range;
    const ticks = [];
    for (let h = Math.ceil(dayStartHour); h <= Math.floor(dayEndHour); h += 2) ticks.push(h);
    return ticks;
  }, [data]);

  if (!data) {
    return <div className="p-8 text-center text-sm text-slate-500">{loading ? 'Loading schedule...' : 'No schedule data'}</div>;
  }

  const { workstation, now, maintenance, summary } = data;
  const stateStyle = STATE_STYLES[now.state] || STATE_STYLES.AVAILABLE;
  const spanHours = data.range.dayEndHour - data.range.dayStartHour;
  const pctOf = (value, day) => {
    const ws = parse(day.windowStart).getTime();
    const we = parse(day.windowEnd).getTime();
    return ((parse(value).getTime() - ws) / (we - ws)) * 100;
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Machine header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base text-slate-900">{workstation.name} <span className="text-xs text-indigo-600">({workstation.code})</span></div>
          <div className="text-xs text-slate-500">
            {[workstation.type, workstation.location, `Capacity ${workstation.capacity} at a time`, `Target ${workstation.targetUtilization}% utilisation`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`border rounded p-3 ${stateStyle.cls}`}>
          <div className="flex items-center gap-1 text-xs"><Activity className="w-3 h-3" /> Status now</div>
          <div className="text-base mt-1">{stateStyle.label}</div>
          {now.currentJob && (
            <div className="text-xs mt-1">{now.currentJob.jobCardNo} · {now.currentJob.operation || 'Operation'} ({now.currentJob.woNumber})</div>
          )}
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3 h-3" /> Next free from</div>
          <div className="text-base mt-1 text-slate-900">{now.state === 'INACTIVE' ? 'Not schedulable' : formatDateTime(now.nextFreeAt)}</div>
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="w-3 h-3" /> Booked in range</div>
          <div className="text-base mt-1 text-slate-900">{summary.bookedPercent}%</div>
          <div className="text-xs text-slate-500">{formatDuration(summary.bookedMinutes)} of {formatDuration(summary.workingMinutes)} · {summary.upcomingJobs} job(s){summary.heldJobs ? ` · ${summary.heldJobs} on hold` : ''}</div>
        </div>
        <div className={`border rounded p-3 ${maintenance.overdue ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-1 text-xs text-slate-500"><Wrench className="w-3 h-3" /> Maintenance</div>
          {maintenance.nextDue ? (
            <>
              <div className={`text-base mt-1 ${maintenance.overdue ? 'text-rose-700' : 'text-slate-900'}`}>
                {maintenance.overdue ? `Overdue by ${Math.abs(maintenance.daysToDue)} day(s)` : maintenance.daysToDue === 0 ? 'Due today' : `Due in ${maintenance.daysToDue} day(s)`}
              </div>
              <div className="text-xs text-slate-500">{maintenance.frequency} · next {maintenance.nextDue}</div>
            </>
          ) : (
            <div className="text-xs text-slate-500 mt-1">No maintenance date recorded</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => shiftRange(-1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50" title="Previous"><ChevronLeft className="w-4 h-4" /></button>
        <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs" />
        <button onClick={() => shiftRange(1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50" title="Next"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => setStartDate(toDateKey(new Date()))} className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50">Today</button>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-slate-200 rounded px-2 py-1 text-xs">
          {[1, 3, 7, 14, 28].map(n => <option key={n} value={n}>{n === 1 ? '1 day' : `${n} days`}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-2">Working hours</span>
        <select value={dayStart} onChange={(e) => setDayStart(Math.min(Number(e.target.value), dayEnd - 1))} className="border border-slate-200 rounded px-2 py-1 text-xs">
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}:00</option>)}
        </select>
        <span className="text-xs text-slate-500">to</span>
        <select value={dayEnd} onChange={(e) => setDayEnd(Math.max(Number(e.target.value), dayStart + 1))} className="border border-slate-200 rounded px-2 py-1 text-xs">
          {Array.from({ length: 24 }, (_, h) => h + 1).map(h => <option key={h} value={h}>{pad(h % 24)}:00{h === 24 ? ' (midnight)' : ''}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" /> Free</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500" /> Running</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Scheduled</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400" /> Paused</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-300" /> On hold (slot kept, machine free)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border-2 border-rose-500" /> Rework</span>
      </div>

      {/* Day timeline */}
      <div className="border border-slate-200 rounded">
        <div className="flex items-end border-b border-slate-100 bg-slate-50 text-[10px] text-slate-500">
          <div className="w-24 shrink-0 p-2">Day</div>
          <div className="relative flex-1 h-6 mr-2">
            {hourTicks.map(h => (
              <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - data.range.dayStartHour) / spanHours) * 100}%` }}>{pad(h % 24)}:00</span>
            ))}
          </div>
          <div className="w-20 shrink-0 p-2 text-right">Booked</div>
        </div>

        {data.days.map(day => (
          <div key={day.date} className="border-b border-slate-100 last:border-b-0">
            <div className="flex items-center">
              <div className="w-24 shrink-0 p-2">
                <div className="text-xs text-slate-900">{day.weekday}</div>
                <div className="text-[10px] text-slate-500">{day.date}</div>
              </div>
              <div className="relative flex-1 h-10 my-1 mr-2 rounded bg-emerald-50 border border-emerald-200 overflow-hidden">
                {hourTicks.map(h => (
                  <span key={h} className="absolute top-0 bottom-0 border-l border-emerald-100" style={{ left: `${((h - data.range.dayStartHour) / spanHours) * 100}%` }} />
                ))}
                {day.segments.map(seg => {
                  const left = pctOf(seg.start, day);
                  const width = Math.max(0.8, pctOf(seg.end, day) - left);
                  return (
                    <div
                      key={`${seg.jobCardId}-${seg.start}`}
                      className={`absolute top-1 bottom-1 rounded border px-1 overflow-hidden text-[10px] leading-tight ${SEGMENT_STYLES[seg.status] || SEGMENT_STYLES.DEFAULT} ${seg.isRework ? '!border-rose-500 border-2' : ''}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${seg.jobCardNo} · ${seg.operation || ''}\n${seg.woNumber} · ${seg.itemCode || ''}\n${formatDateTime(seg.fullStart)} - ${formatDateTime(seg.fullEnd)}\nStatus: ${seg.status}${seg.priority ? ` · ${seg.priority}` : ''}${seg.operator ? `\nOperator: ${seg.operator}` : ''}${seg.holdReason ? `\nHold: ${seg.holdReason}` : ''}`}
                    >
                      <div className="truncate">{seg.jobCardNo}</div>
                      <div className="truncate opacity-80">{seg.operation}</div>
                    </div>
                  );
                })}
              </div>
              <div className="w-20 shrink-0 p-2 text-right">
                <div className={`text-xs ${day.bookedPercent >= 90 ? 'text-rose-600' : day.bookedPercent >= 60 ? 'text-amber-600' : 'text-emerald-600'}`}>{day.bookedPercent}%</div>
                {day.actualRunMinutes > 0 && <div className="text-[10px] text-slate-400">ran {formatDuration(day.actualRunMinutes)}</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 px-24 pb-2 -mt-0.5">
              {day.free.length === 0 ? (
                <span className="text-[10px] text-rose-500">No free time{day.segments.length === 0 ? ' (day already over)' : ''}</span>
              ) : (
                <>
                  <span className="text-[10px] text-slate-400 mr-1">Free:</span>
                  {day.free.map(w => (
                    <span key={w.start} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {formatTime(w.start)} – {formatTime(w.end)} ({formatDuration(w.minutes)})
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Job list */}
      <div>
        <div className="text-xs text-slate-700 mb-1">Scheduled jobs in this range</div>
        {jobs.length === 0 ? (
          <div className="text-xs text-slate-500 border border-dashed border-slate-200 rounded p-4 text-center">Nothing scheduled — this machine is free for the whole range.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="p-2">Job card</th><th className="p-2">Work order</th><th className="p-2">Operation</th>
                  <th className="p-2">Operator</th><th className="p-2">Start</th><th className="p-2">End</th>
                  <th className="p-2">Priority</th><th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.jobCardId} className="border-t border-slate-100">
                    <td className="p-2 text-indigo-600">{job.jobCardNo}{job.isRework ? ' (rework)' : ''}</td>
                    <td className="p-2">{job.woNumber}<div className="text-[10px] text-slate-400">{job.itemCode}</div></td>
                    <td className="p-2">{job.operation || '-'}</td>
                    <td className="p-2">{job.operator || '-'}</td>
                    <td className="p-2 whitespace-nowrap">{formatDateTime(job.fullStart)}</td>
                    <td className="p-2 whitespace-nowrap">{formatDateTime(job.fullEnd)}</td>
                    <td className="p-2"><Badge variant={PRIORITY_VARIANT[job.priority] || 'default'}>{job.priority || 'NORMAL'}</Badge></td>
                    <td className="p-2">{job.status.replace('_', ' ')}{job.holdReason ? <div className="text-[10px] text-slate-400">{job.holdReason}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkstationScheduleView;
