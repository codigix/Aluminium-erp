import React, { useState, useMemo } from 'react';
import { Plus, RefreshCw, Search, MoreVertical, CalendarClock, History, Pencil, User, Cpu, Activity, Clock, CheckCircle } from 'lucide-react';

const formatDuration = (mins) => {
  const m = Math.round(mins || 0);
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
};

const formatTimeOnly = (val) => {
  if (!val) return '';
  const d = new Date(String(val).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const STATE = {
  AVAILABLE: { label: 'Available now', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  RUNNING: { label: 'Running on Machine', cls: 'bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold' },
  BOOKED: { label: 'Booked / Scheduled', cls: 'bg-amber-100 text-amber-800 border border-amber-200' },
  INACTIVE: { label: 'Inactive', cls: 'bg-slate-100 text-slate-500 border border-slate-200' }
};

const stateOf = (op, overview) => {
  if (String(op.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return 'INACTIVE';
  const ov = overview[op.id];
  return ov && !ov.error ? ov.state : 'AVAILABLE';
};

const FILTERS = [
  { id: 'ALL', label: 'All', match: () => true },
  { id: 'AVAILABLE', label: 'Available now', match: (op, ov) => stateOf(op, ov) === 'AVAILABLE' },
  { id: 'RUNNING', label: 'Running on machine', match: (op, ov) => stateOf(op, ov) === 'RUNNING' },
  { id: 'BOOKED', label: 'Booked / Scheduled', match: (op, ov) => stateOf(op, ov) === 'BOOKED' },
  { id: 'INACTIVE', label: 'Inactive', match: (op, ov) => stateOf(op, ov) === 'INACTIVE' }
];

const OperatorList = ({
  operators = [],
  overview = {},
  loading = false,
  onNew,
  onRefresh,
  onSchedule,
  onHistory,
  onEdit
}) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState(null);

  const counts = useMemo(() => {
    return Object.fromEntries(FILTERS.map(f => [f.id, operators.filter(op => f.match(op, overview)).length]));
  }, [operators, overview]);

  const visible = useMemo(() => {
    const active = FILTERS.find(f => f.id === filter);
    const q = search.trim().toLowerCase();
    return operators.filter(op => {
      const matchesFilter = active ? active.match(op, overview) : true;
      if (!matchesFilter) return false;
      if (!q) return true;
      const fullName = `${op.first_name || ''} ${op.last_name || ''}`.toLowerCase();
      const currentMachine = overview[op.id]?.currentJob?.workstationName?.toLowerCase() || '';
      return (
        fullName.includes(q) ||
        String(op.username || '').toLowerCase().includes(q) ||
        String(op.role_name || '').toLowerCase().includes(q) ||
        String(op.phone || '').toLowerCase().includes(q) ||
        currentMachine.includes(q)
      );
    });
  }, [operators, overview, filter, search]);

  return (
    <div className="space-y-3" onClick={() => setMenuFor(null)}>
      {/* Title & Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900 font-bold">Operators</h1>
          <p className="text-xs text-slate-500">
            Real-time operator status, current machine allocations, production logs, and timetable schedules.
          </p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={onRefresh}
            className="p-2 border border-slate-200 rounded hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Operator
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                filter === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className={filter === f.id ? 'opacity-90' : 'text-slate-400 font-semibold'}>{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search operator, machine, role..."
            className="pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg w-72 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main List */}
      {loading && operators.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading operators...</div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500 bg-white">
          {operators.length === 0 ? 'No operators found. Click "Add Operator" to create one.' : 'No operators match your filter criteria.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(op => {
            const ov = overview[op.id] || {};
            const st = stateOf(op, overview);
            const stateStyle = STATE[st] || STATE.AVAILABLE;
            const currentJob = ov.currentJob;
            const fullName = `${op.first_name || ''} ${op.last_name || ''}`.trim() || op.username;

            return (
              <div
                key={op.id}
                className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-4 hover:shadow-sm transition-all"
              >
                {/* Operator Identity */}
                <div className="min-w-[14rem] flex-1">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>{fullName}</span>
                    <span className="text-[11px] text-slate-400 font-normal">@{op.username}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {[op.role_name || 'Machine Operator', op.department_name || 'Production', op.phone].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {op.email ? op.email : 'No email registered'}
                  </div>
                </div>

                {/* Status & Current Machine Info */}
                <div className="w-64">
                  <div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${stateStyle.cls}`}>
                      {stateStyle.label}
                    </span>
                  </div>
                  {currentJob ? (
                    <div className="mt-1.5 text-xs text-slate-800">
                      <div className="font-semibold text-indigo-900 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{currentJob.workstationName} ({currentJob.workstationCode})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Activity className="w-3 h-3 text-slate-400" />
                        <span>{currentJob.jobCardNo} · {currentJob.operation}</span>
                      </div>
                      {currentJob.startTime && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Started: {formatTimeOnly(currentJob.startTime)}
                        </div>
                      )}
                    </div>
                  ) : st !== 'INACTIVE' ? (
                    <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      <span>Ready for next machine assignment</span>
                    </div>
                  ) : (
                    <div className="mt-1.5 text-xs text-slate-400">Offline / Inactive</div>
                  )}
                </div>

                {/* Today's Logged Load */}
                <div className="w-40 text-xs">
                  <div className="text-slate-500 text-[11px]">Today's Production:</div>
                  <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{formatDuration(ov.minutesLoggedToday || 0)}</span>
                    <span className="text-slate-400 font-normal">({ov.piecesProducedToday || 0} pcs)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {ov.upcomingJobs || 0} upcoming job(s)
                  </div>
                </div>

                {/* Machine History Count */}
                <div className="w-40 text-xs">
                  <div className="text-slate-500 text-[11px]">Machine Allocation:</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {op.machines_worked_count || 0} workstation(s)
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {op.total_pieces_produced || 0} pcs lifetime output
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onSchedule(op)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm transition-colors"
                  >
                    <CalendarClock className="w-3.5 h-3.5" /> Schedule
                  </button>
                  <button
                    onClick={() => onHistory(op)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-700 transition-colors"
                    title="View Machine & Production History"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" /> History
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setMenuFor(menuFor === op.id ? null : op.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                      title="More"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuFor === op.id && (
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 text-xs py-1">
                        <button
                          onClick={() => { setMenuFor(null); onSchedule(op); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                        >
                          <CalendarClock className="w-3.5 h-3.5 text-indigo-600" /> View Timetable
                        </button>
                        <button
                          onClick={() => { setMenuFor(null); onHistory(op); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                        >
                          <History className="w-3.5 h-3.5 text-sky-600" /> Machine History
                        </button>
                        <button
                          onClick={() => { setMenuFor(null); onEdit(op); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit Operator
                        </button>
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

export default OperatorList;
