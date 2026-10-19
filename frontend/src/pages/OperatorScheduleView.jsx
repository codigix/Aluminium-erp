import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Clock, CalendarDays, Activity, User, Cpu, ArrowLeft } from 'lucide-react';
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
  RUNNING: { label: 'Running on Machine', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  BOOKED: { label: 'Booked / Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  INACTIVE: { label: 'Inactive', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
};

const SEGMENT_STYLES = {
  IN_PROGRESS: 'bg-indigo-500 border-indigo-700 text-white',
  PAUSED: 'bg-orange-400 border-orange-600 text-white',
  ON_HOLD: 'bg-slate-300 border-slate-500 text-slate-700 opacity-80',
  DEFAULT: 'bg-amber-400 border-amber-600 text-amber-950'
};

const PRIORITY_VARIANT = { URGENT: 'danger', HIGH: 'warning', NORMAL: 'default', LOW: 'default' };

const OperatorScheduleView = ({ operatorId, onBack }) => {
  const [startDate, setStartDate] = useState(() => toDateKey(new Date()));
  const [days, setDays] = useState(7);
  const [dayStart, setDayStart] = useState(8);
  const [dayEnd, setDayEnd] = useState(18);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!operatorId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const query = new URLSearchParams({ from: startDate, days: String(days), dayStart: String(dayStart), dayEnd: String(dayEnd) });
      const response = await fetch(`${API_BASE}/operators/${operatorId}/schedule?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || 'Failed to load operator schedule');
      setData(body);
    } catch (error) {
      errorToast(error.message || 'Failed to load operator schedule');
    } finally {
      setLoading(false);
    }
  }, [operatorId, startDate, days, dayStart, dayEnd]);

  useEffect(() => { load(); }, [load]);

  const shiftRange = (direction) => {
    const d = new Date(`${startDate}T00:00:00`);
    d.setDate(d.getDate() + direction * days);
    setStartDate(toDateKey(d));
  };

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

  const { operator, now, summary } = data;
  const stateStyle = STATE_STYLES[now.state] || STATE_STYLES.AVAILABLE;
  const spanHours = data.range.dayEndHour - data.range.dayStartHour;

  const pct = (timeStr) => {
    const d = parse(timeStr);
    if (!d) return 0;
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, Math.min(100, ((h - data.range.dayStartHour) / spanHours) * 100));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-600" title="Back to operators">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-lg text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <span>{operator.name}</span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">@{operator.username}</span>
            </h2>
            <p className="text-xs text-slate-500">
              Department: {operator.department || 'Production'} · Role: {operator.role || 'Operator'}
            </p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-700">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Top Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`border rounded-lg p-3 ${stateStyle.cls}`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Activity className="w-3.5 h-3.5" /> Current Status</div>
          <div className="text-base font-bold mt-1">{stateStyle.label}</div>
          {now.currentJob ? (
            <div className="text-xs mt-1.5 text-slate-700 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>{now.currentJob.workstationName || 'Machine'} ({now.currentJob.jobCardNo})</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-1">Ready for next assignment</div>
          )}
        </div>

        <div className="border border-slate-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="w-3.5 h-3.5 text-indigo-600" /> Booked in range</div>
          <div className="text-base font-bold mt-1 text-slate-900">{summary.bookedPercent}%</div>
          <div className="text-xs text-slate-500 mt-1">
            {formatDuration(summary.bookedMinutes)} of {formatDuration(summary.workingMinutes)} · {summary.upcomingJobs} job(s)
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="w-3.5 h-3.5 text-emerald-600" /> Logged Production Time</div>
          <div className="text-base font-bold mt-1 text-slate-900">{formatDuration(summary.actualRunMinutes)}</div>
          <div className="text-xs text-slate-500 mt-1">Actual time logged by operator in range</div>
        </div>
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-2.5">
        <button onClick={() => shiftRange(-1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50" title="Previous"><ChevronLeft className="w-4 h-4" /></button>
        <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs" />
        <button onClick={() => shiftRange(1)} className="p-1.5 border border-slate-200 rounded hover:bg-slate-50" title="Next"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => setStartDate(toDateKey(new Date()))} className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50">Today</button>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-slate-200 rounded px-2 py-1 text-xs">
          {[1, 3, 7, 14, 28].map(n => <option key={n} value={n}>{n === 1 ? '1 day' : `${n} days`}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-2">Shift hours:</span>
        <select value={dayStart} onChange={(e) => setDayStart(Math.min(Number(e.target.value), dayEnd - 1))} className="border border-slate-200 rounded px-2 py-1 text-xs">
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}:00</option>)}
        </select>
        <span className="text-xs text-slate-500">to</span>
        <select value={dayEnd} onChange={(e) => setDayEnd(Math.max(Number(e.target.value), dayStart + 1))} className="border border-slate-200 rounded px-2 py-1 text-xs">
          {Array.from({ length: 24 }, (_, h) => h + 1).map(h => <option key={h} value={h}>{pad(h % 24)}:00{h === 24 ? ' (midnight)' : ''}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 px-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" /> Free Window</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500" /> In Progress (Working)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Scheduled / Booked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400" /> Paused</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-300" /> On Hold</span>
      </div>

      {/* Timetable Bars */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex items-end border-b border-slate-100 bg-slate-50 text-[10px] text-slate-500 font-semibold">
          <div className="w-24 shrink-0 p-2.5">Date</div>
          <div className="relative flex-1 h-6 mr-2">
            {hourTicks.map(h => (
              <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - data.range.dayStartHour) / spanHours) * 100}%` }}>
                {pad(h % 24)}:00
              </span>
            ))}
          </div>
          <div className="w-24 shrink-0 p-2.5 text-right">Booked %</div>
        </div>

        <div className="divide-y divide-slate-100">
          {data.days.map(d => {
            const isToday = d.date === toDateKey(new Date());
            return (
              <div key={d.date} className={`flex items-center text-xs ${isToday ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                <div className="w-24 shrink-0 p-2.5">
                  <div className={`font-semibold ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>
                    {d.weekday} {d.date.slice(5)}
                  </div>
                  {isToday && <span className="text-[10px] text-indigo-500 font-medium">Today</span>}
                </div>

                <div className="relative flex-1 h-9 bg-slate-100/60 rounded my-1 mr-2 overflow-hidden border border-slate-200/40">
                  {/* Free Windows */}
                  {d.free.map((w, idx) => {
                    const left = pct(w.start);
                    const right = pct(w.end);
                    return (
                      <div
                        key={`free-${idx}`}
                        className="absolute top-0 bottom-0 bg-emerald-100/60 hover:bg-emerald-200/80 transition-colors"
                        style={{ left: `${left}%`, width: `${Math.max(0.5, right - left)}%` }}
                        title={`Free: ${formatTime(w.start)} – ${formatTime(w.end)} (${formatDuration(w.minutes)})`}
                      />
                    );
                  })}

                  {/* Scheduled Segments */}
                  {d.segments.map(seg => {
                    const left = pct(seg.start);
                    const right = pct(seg.end);
                    const width = Math.max(0.5, right - left);
                    const styleClass = SEGMENT_STYLES[seg.status] || SEGMENT_STYLES.DEFAULT;
                    return (
                      <div
                        key={seg.jobCardId}
                        className={`absolute top-1 bottom-1 rounded px-1.5 text-[10px] flex items-center justify-between border overflow-hidden shadow-sm ${styleClass}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${seg.jobCardNo}: ${seg.operation} on ${seg.workstationName || 'Machine'}\n${formatTime(seg.start)} – ${formatTime(seg.end)}`}
                      >
                        <span className="truncate font-medium">{seg.jobCardNo} · {seg.workstationName || seg.operation}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="w-24 shrink-0 p-2.5 text-right font-medium text-slate-700">
                  {d.bookedPercent}%
                  <div className="text-[10px] text-slate-400 font-normal">{formatDuration(d.bookedMinutes)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jobs Table below timeline */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 font-semibold text-xs text-slate-700">
          Job Cards Allocated in Range ({jobs.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50/50 text-slate-600 text-left">
              <tr>
                <th className="py-2.5 px-3">Job Card No</th>
                <th className="py-2.5 px-3">Work Order / Item</th>
                <th className="py-2.5 px-3">Operation</th>
                <th className="py-2.5 px-3">Allocated Machine</th>
                <th className="py-2.5 px-3">Scheduled Time</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No job cards scheduled for this operator in this time window.
                  </td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j.jobCardId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-indigo-600">{j.jobCardNo}</td>
                    <td className="py-2.5 px-3 text-slate-600">{j.woNumber} · {j.itemCode || '—'}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{j.operation}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {j.workstationName ? (
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{j.workstationName} ({j.workstationCode})</span>
                        </div>
                      ) : <span className="text-slate-400">Not assigned</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{formatDateTime(j.fullStart)} – {formatTime(j.fullEnd)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${SEGMENT_STYLES[j.status] || 'bg-slate-100 text-slate-700'}`}>
                        {j.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OperatorScheduleView;
