import React, { useState, useEffect } from 'react';
import { Modal } from '../components/ui.jsx';
import { Cpu, Calendar, Clock, Layers, Award, CheckCircle2, History } from 'lucide-react';
import { errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatDuration = (mins) => {
  const m = Math.round(mins || 0);
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
};

const formatTimeOnly = (val) => {
  if (!val) return '—';
  const d = new Date(String(val).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const OperatorHistoryModal = ({ operator, isOpen, onClose }) => {
  const [tab, setTab] = useState('machines'); // 'machines' | 'logs'
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null);

  useEffect(() => {
    if (!isOpen || !operator?.id) return;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE}/operators/${operator.id}/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load operator history');
        const data = await res.json();
        setHistoryData(data);
      } catch (err) {
        errorToast(err.message || 'Error loading history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [isOpen, operator?.id]);

  if (!isOpen || !operator) return null;

  const summary = historyData?.summary || {
    distinctMachinesCount: 0,
    totalSessionsCount: 0,
    totalMinutes: 0,
    totalProduced: 0
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Operator Allocation & Production History: ${operator.first_name || ''} ${operator.last_name || ''} (${operator.username})`}
      size="5xl"
    >
      <div className="space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-600" /> Machines Operated</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{summary.distinctMachinesCount}</div>
            <div className="text-[11px] text-slate-400">Distinct workstations</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-sky-600" /> Total Logged Time</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{formatDuration(summary.totalMinutes)}</div>
            <div className="text-[11px] text-slate-400">{summary.totalSessionsCount} recorded session(s)</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-emerald-600" /> Pieces Produced</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{summary.totalProduced}</div>
            <div className="text-[11px] text-slate-400">Total verified output</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-amber-600" /> Current Department</div>
            <div className="text-base font-semibold text-slate-800 mt-1">{operator.department_name || 'Production'}</div>
            <div className="text-[11px] text-slate-400">{operator.role_name || 'Operator'}</div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
          <button
            onClick={() => setTab('machines')}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${tab === 'machines' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Cpu className="w-3.5 h-3.5" /> Allocated Machines Summary ({historyData?.allocatedMachines?.length || 0})
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${tab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Chronological Production Logs ({historyData?.logs?.length || 0})
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading history logs...</div>
        ) : tab === 'machines' ? (
          /* TAB 1: ALLOCATED MACHINES */
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 text-left font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Workstation / Machine</th>
                  <th className="py-2.5 px-3">Type & Location</th>
                  <th className="py-2.5 px-3 text-center">Job Cards</th>
                  <th className="py-2.5 px-3 text-center">Sessions</th>
                  <th className="py-2.5 px-3 text-right">Total Time</th>
                  <th className="py-2.5 px-3 text-right">Produced Qty</th>
                  <th className="py-2.5 px-3 text-right">Last Worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(!historyData?.allocatedMachines || historyData.allocatedMachines.length === 0) ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No machine allocations recorded yet for this operator.
                    </td>
                  </tr>
                ) : (
                  historyData.allocatedMachines.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{m.workstation_name}</div>
                        <div className="text-[11px] text-indigo-600 font-mono">{m.workstation_code}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        <div>{m.workstation_type || 'Machine'}</div>
                        <div className="text-[11px] text-slate-400">{m.location || 'Shop floor'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">{m.job_cards_count}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{m.sessions_count}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800">{formatDuration(m.total_minutes)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{m.total_produced}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{m.last_worked_date ? String(m.last_worked_date).slice(0, 10) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: DETAILED PRODUCTION LOGS */
          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 text-left font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Date / Shift</th>
                  <th className="py-2.5 px-3">Job Card & Work Order</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Time Window</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3 text-right">Produced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(!historyData?.logs || historyData.logs.length === 0) ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No production time logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyData.logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{String(l.log_date || '').slice(0, 10)}</div>
                        <div className="text-[11px] text-slate-500">{l.shift || 'Shift A'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-indigo-600">{l.job_card_no}</div>
                        <div className="text-[11px] text-slate-500">{l.wo_number}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{l.operation_name || '—'}</td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800">{l.workstation_name || 'N/A'}</div>
                        <div className="text-[11px] text-slate-400">{l.workstation_code}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatTimeOnly(l.start_time)} – {formatTimeOnly(l.end_time)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                        {formatDuration(l.duration_minutes)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                        {l.produced_qty} pcs
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OperatorHistoryModal;
