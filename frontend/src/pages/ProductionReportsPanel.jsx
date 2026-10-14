import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = v => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');
const dayTime = v => (v ? new Date(String(v).replace(' ', 'T')).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const hours = m => `${Math.round((Number(m) || 0) / 6) / 10} h`;
const pct = v => (v === null || v === undefined ? '—' : `${v}%`);

const Bar = ({ value, tone = 'bg-indigo-500' }) => (
  <div className="flex items-center gap-2 min-w-[7rem]">
    <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, value || 0)}%` }} /></div>
    <span className="text-[11px] text-slate-500 w-9 text-right">{pct(value)}</span>
  </div>
);

// Each report: where to fetch, which table to show, and its columns
const REPORTS = [
  {
    id: 'plan', label: 'Plan vs actual', path: '/production-reports/plan-vs-actual', csv: 'plan-vs-actual', ranged: true,
    help: 'Every work order: what was planned, what QC accepted, what was shipped, and how late it is.',
    rows: d => d.rows,
    columns: [
      { label: 'Work order', render: r => <span className="text-indigo-600">{r.wo_number}</span> },
      { label: 'Item', render: r => r.item_name || r.item_code },
      { label: 'Plan', render: r => r.plan_code || '—' },
      { label: 'Status', render: r => r.status },
      { label: 'Planned', align: 'right', render: r => r.planned_qty },
      { label: 'Accepted', align: 'right', render: r => r.accepted_qty },
      { label: 'Shipped', align: 'right', render: r => r.dispatched_qty },
      { label: 'Complete', render: r => <Bar value={r.completion_percent} /> },
      { label: 'Operations', render: r => `${r.operations_done}/${r.operations}` },
      { label: 'Due', render: r => day(r.planned_end) },
      { label: 'Delay', render: r => (r.delay_days > 0 ? <span className="text-rose-600">{r.delay_days} d</span> : '—') }
    ]
  },
  {
    id: 'util', label: 'Machines & operators', path: '/production-reports/utilisation', csv: 'utilisation', ranged: true,
    help: 'Run time against available hours (8 h day, 6-day week). Machines under their target are highlighted.',
    rows: d => d.machines,
    columns: [
      { label: 'Machine', render: r => r.name },
      { label: 'Run time', align: 'right', render: r => hours(r.run_minutes) },
      { label: 'Downtime', align: 'right', render: r => hours(r.downtime_minutes) },
      { label: 'Idle', align: 'right', render: r => hours(r.idle_minutes) },
      { label: 'Utilisation', render: r => <Bar value={r.utilisation_percent} tone={r.below_target ? 'bg-amber-400' : 'bg-emerald-500'} /> },
      { label: 'Target', align: 'right', render: r => `${r.target_percent}%` },
      { label: 'Pieces made', align: 'right', render: r => r.produced_qty }
    ],
    extra: d => (d.operators?.length ? {
      title: 'Operators',
      rows: d.operators,
      columns: [
        { label: 'Operator', render: r => r.name },
        { label: 'Job cards', align: 'right', render: r => r.job_cards },
        { label: 'Run time', align: 'right', render: r => hours(r.run_minutes) },
        { label: 'Utilisation', render: r => <Bar value={r.utilisation_percent} /> },
        { label: 'Pieces made', align: 'right', render: r => r.produced_qty }
      ]
    } : null)
  },
  {
    id: 'quality', label: 'Quality & rework', path: '/production-reports/quality-rework', csv: 'quality', ranged: true,
    help: 'Approved inspections only. Yield is accepted ÷ inspected.',
    rows: d => d.byOperation,
    columns: [
      { label: 'Operation', render: r => r.operation },
      { label: 'Inspected', align: 'right', render: r => r.inspected },
      { label: 'Accepted', align: 'right', render: r => r.accepted },
      { label: 'Rejected', align: 'right', render: r => r.rejected },
      { label: 'Scrap', align: 'right', render: r => r.scrap },
      { label: 'Yield', render: r => <Bar value={r.yield_percent} tone="bg-emerald-500" /> },
      { label: 'Rejection', align: 'right', render: r => (r.rejection_percent > 5 ? <span className="text-rose-600">{pct(r.rejection_percent)}</span> : pct(r.rejection_percent)) }
    ],
    extra: d => [
      d.topReasons?.length ? { title: 'Top rejection reasons', rows: d.topReasons, columns: [
        { label: 'Reason', render: r => r.reason }, { label: 'Pieces rejected', align: 'right', render: r => r.rejected }, { label: 'Times', align: 'right', render: r => r.occurrences }
      ] } : null,
      d.openRework?.length ? { title: 'Open rework job cards', rows: d.openRework, columns: [
        { label: 'Job card', render: r => <span className="text-indigo-600">{r.job_card_no}</span> }, { label: 'Work order', render: r => r.wo_number },
        { label: 'Reworking', render: r => r.source_job_card_no || '—' }, { label: 'Planned', align: 'right', render: r => r.planned_qty },
        { label: 'Done', align: 'right', render: r => r.accepted_qty }, { label: 'Status', render: r => r.status }
      ] } : null
    ].filter(Boolean)
  },
  {
    id: 'material', label: 'Material', path: '/production-reports/material-variance', csv: 'materials', ranged: false,
    help: 'Per work order: issued, used, returned and what is still on the floor. Material left on a closed work order is a loss to explain.',
    rows: d => d.items,
    columns: [
      { label: 'Work order', render: r => <span className="text-indigo-600">{r.wo_number}</span> },
      { label: 'Material', render: r => r.material_name || r.item_code },
      { label: 'Issued', align: 'right', render: r => r.issued },
      { label: 'Used', align: 'right', render: r => r.consumed },
      { label: 'Returned', align: 'right', render: r => r.returned },
      { label: 'Scrapped', align: 'right', render: r => r.scrapped },
      { label: 'On the floor', align: 'right', render: r => r.on_floor },
      { label: 'Unaccounted', align: 'right', render: r => (r.unaccounted > 0 ? <span className="text-rose-600">{r.unaccounted}</span> : '—') }
    ]
  },
  {
    id: 'ship', label: 'Shipments', path: '/production-reports/shipments', csv: 'shipments', ranged: true,
    help: 'Full, partial or not yet shipped, for every work order that ends in a shipment.',
    rows: d => d.rows,
    columns: [
      { label: 'Work order', render: r => <span className="text-indigo-600">{r.wo_number}</span> },
      { label: 'Item', render: r => r.item_name || r.item_code },
      { label: 'Ordered', align: 'right', render: r => r.ordered_qty },
      { label: 'Shipped', align: 'right', render: r => r.dispatched_qty },
      { label: 'Balance', align: 'right', render: r => r.balance_qty },
      { label: 'Shipped %', render: r => <Bar value={r.shipped_percent} tone="bg-sky-500" /> },
      { label: 'State', render: r => <span className={r.shipment_state === 'FULL' ? 'text-emerald-600' : r.shipment_state === 'PARTIAL' ? 'text-amber-600' : 'text-slate-400'}>{r.shipment_state.replace('_', ' ')}</span> },
      { label: 'Shipments', align: 'right', render: r => r.shipment_count }
    ],
    summary: d => `${d.totals.full} fully shipped · ${d.totals.partial} partially · ${d.totals.notShipped} not shipped`
  },
  {
    id: 'delayed', label: 'Delayed', path: '/production-reports/delayed', csv: 'delayed', ranged: false,
    help: 'Work orders past their end date and job cards past their scheduled end.',
    rows: d => d.workOrders,
    columns: [
      { label: 'Work order', render: r => <span className="text-indigo-600">{r.wo_number}</span> },
      { label: 'Item', render: r => r.item_code },
      { label: 'Priority', render: r => r.priority },
      { label: 'Status', render: r => r.status },
      { label: 'Was due', render: r => day(r.end_date) },
      { label: 'Days late', align: 'right', render: r => <span className="text-rose-600">{r.days_late}</span> },
      { label: 'Open operations', align: 'right', render: r => r.open_operations }
    ],
    extra: d => [
      d.jobCards?.length ? { title: 'Job cards past their scheduled end', rows: d.jobCards, columns: [
        { label: 'Job card', render: r => <span className="text-indigo-600">{r.job_card_no}</span> }, { label: 'Operation', render: r => r.operation_name },
        { label: 'Work order', render: r => r.wo_number }, { label: 'Machine', render: r => r.workstation_name || '—' },
        { label: 'Was due', render: r => dayTime(r.end_time) }, { label: 'Hours late', align: 'right', render: r => <span className="text-rose-600">{r.hours_late}</span> }
      ] } : null,
      d.onHold?.length ? { title: 'Held jobs', rows: d.onHold, columns: [
        { label: 'Job card', render: r => <span className="text-indigo-600">{r.job_card_no}</span> }, { label: 'Operation', render: r => r.operation_name },
        { label: 'Work order', render: r => r.wo_number }, { label: 'Held by', render: r => r.held_by_job_card_no || 'Manual hold' },
        { label: 'Reason', render: r => r.hold_reason || '—' }, { label: 'Since', render: r => dayTime(r.held_at) }
      ] } : null
    ].filter(Boolean)
  }
];

const Grid = ({ columns, rows, empty }) => (
  <div className="overflow-x-auto border border-slate-200 rounded bg-white">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 text-slate-500">
        <tr>{columns.map(c => <th key={c.label} className={`p-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="p-6 text-center text-slate-500">{empty}</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
            {columns.map(c => <td key={c.label} className={`p-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.render(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ProductionReportsPanel = () => {
  const [active, setActive] = useState('plan');
  const [range, setRange] = useState(() => ({ from: dateKey(new Date(Date.now() - 29 * 86400000)), to: dateKey(new Date()) }));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const report = REPORTS.find(r => r.id === active);

  const url = useCallback((extra = '') => {
    const q = report.ranged ? `?from=${range.from}&to=${range.to}${extra}` : (extra ? `?${extra.slice(1)}` : '');
    return `${API_BASE}${report.path}${q}`;
  }, [report, range]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(url(), { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load the report');
      setData(body);
    } catch (error) {
      setData(null);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { setData(null); load(); }, [load]);

  const exportCsv = async () => {
    const response = await fetch(url('&format=csv'), { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
    if (!response.ok) return errorToast('Could not export the report');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `production-${report.csv}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const rows = data ? report.rows(data) || [] : [];
  const extras = data && report.extra ? [].concat(report.extra(data) || []).filter(Boolean) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActive(r.id)} className={`px-3 py-1.5 text-xs rounded-full border ${active === r.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{r.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {report.ranged && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <input type="date" value={range.from} max={range.to} onChange={e => e.target.value && setRange(r => ({ ...r, from: e.target.value }))} className="border border-slate-200 rounded px-2 py-1.5" />
              <span>to</span>
              <input type="date" value={range.to} min={range.from} onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))} className="border border-slate-200 rounded px-2 py-1.5" />
            </div>
          )}
          <button onClick={load} className="p-2 border border-slate-200 rounded hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </div>

      <div className="text-xs text-slate-500">{report.help}{data && report.summary ? ` — ${report.summary(data)}` : ''}</div>

      {loading && !data ? <div className="p-10 text-center text-sm text-slate-500">Loading report...</div> : data && (
        <>
          <Grid columns={report.columns} rows={rows} empty="Nothing to show for this period." />
          {extras.map(x => (
            <div key={x.title} className="space-y-1">
              <div className="text-sm text-slate-900">{x.title}</div>
              <Grid columns={x.columns} rows={x.rows} empty="None" />
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default ProductionReportsPanel;
