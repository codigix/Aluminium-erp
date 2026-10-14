import React, { useState, useMemo } from 'react';
import { Search, Truck, Package, Download, Eye, AlertTriangle, Clock, CheckCircle2, Building2, History } from 'lucide-react';

const num = v => parseFloat(v) || 0;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const formatDate = v => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const daysBetween = (from, to) => Math.round((to - from) / 86400000);

// Where is each challan: at the vendor, due soon, overdue, or back
const analyse = (c) => {
  const sent = num(c.dispatch_qty);
  const back = num(c.received_qty);
  const balance = Math.max(0, sent - back);
  const closed = c.status === 'RECEIVED' || (c.status !== 'DISPATCHED' && balance <= 0.0005) || balance <= 0.0005;
  const today = startOfToday();
  const due = c.expected_return_date ? new Date(c.expected_return_date) : null;
  const daysToDue = due ? daysBetween(today, new Date(due.getFullYear(), due.getMonth(), due.getDate())) : null;
  const daysOut = c.dispatch_date ? Math.max(0, daysBetween(new Date(c.dispatch_date), today)) : null;
  let state = 'RETURNED';
  if (!closed) state = daysToDue !== null && daysToDue < 0 ? 'OVERDUE' : daysToDue !== null && daysToDue <= 3 ? 'DUE_SOON' : 'AT_VENDOR';
  if (c.status === 'CANCELLED') state = 'CANCELLED';
  return { sent, back, balance, state, daysToDue, daysOut };
};

const STATE = {
  OVERDUE: { label: 'Overdue', cls: 'bg-rose-100 text-rose-700' },
  DUE_SOON: { label: 'Due soon', cls: 'bg-amber-100 text-amber-700' },
  AT_VENDOR: { label: 'At vendor', cls: 'bg-sky-100 text-sky-700' },
  RETURNED: { label: 'Returned', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' }
};

const FILTERS = [
  { id: 'OPEN', label: 'At vendors', match: a => ['AT_VENDOR', 'DUE_SOON', 'OVERDUE'].includes(a.state) },
  { id: 'OVERDUE', label: 'Overdue', match: a => a.state === 'OVERDUE' },
  { id: 'RETURNED', label: 'Returned', match: a => a.state === 'RETURNED' },
  { id: 'ALL', label: 'All', match: () => true }
];

const SubcontractTracker = ({ activeTab, onTabChange, outward, inward, loading, onViewOutward, onViewInward, onPdf, onRecordInward }) => {
  const [filter, setFilter] = useState('OPEN');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const matches = (...vals) => !q || vals.some(v => String(v || '').toLowerCase().includes(q));

  const analysed = useMemo(() => outward.map(c => ({ c, a: analyse(c) })), [outward]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.id, analysed.filter(x => f.match(x.a)).length])), [analysed]);
  const piecesOut = useMemo(() => analysed.filter(x => FILTERS[0].match(x.a)).reduce((s, x) => s + x.a.balance, 0), [analysed]);
  const vendorsHolding = useMemo(() => new Set(analysed.filter(x => FILTERS[0].match(x.a)).map(x => x.c.vendor_name)).size, [analysed]);

  const visible = useMemo(() => {
    const active = FILTERS.find(f => f.id === filter);
    return analysed.filter(x => active.match(x.a) && matches(x.c.challan_number, x.c.vendor_name, x.c.job_card_no, x.c.wo_number, x.c.operation_name, x.c.item_name));
  }, [analysed, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // One block per vendor, most overdue first
  const byVendor = useMemo(() => {
    const map = new Map();
    visible.forEach(x => {
      const key = x.c.vendor_name || 'No vendor';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(x);
    });
    return Array.from(map.entries()).map(([vendor, rows]) => ({
      vendor, rows: rows.sort((a, b) => (a.a.daysToDue ?? 9999) - (b.a.daysToDue ?? 9999)),
      pieces: rows.reduce((s, x) => s + x.a.balance, 0), overdue: rows.filter(x => x.a.state === 'OVERDUE').length
    })).sort((a, b) => b.overdue - a.overdue || b.pieces - a.pieces);
  }, [visible]);

  const receipts = useMemo(() => inward.filter(r => matches(r.inward_number, r.outward_challan_no, r.vendor_name, r.job_card_no)), [inward, q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl text-slate-900">Subcontracting</h1>
          <p className="text-xs text-slate-500">Work sent to vendors: what is still with them, what is overdue, and what has come back. Start from a subcontract job card to send work out.</p>
        </div>
        <div className="flex rounded border border-slate-200 overflow-hidden">
          {[['outward', 'Sent to vendors', Truck], ['inward', 'Receipts', History]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => onTabChange(id)} className={`flex items-center gap-1 px-4 py-2 text-sm ${activeTab === id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}><Icon className="w-4 h-4" />{label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'outward' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><Package className="w-3 h-3" />Pieces at vendors</div><div className="text-2xl text-slate-900">{Math.round(piecesOut * 1000) / 1000}</div><div className="text-xs text-slate-500">{counts.OPEN} open challan(s)</div></div>
          <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" />Vendors holding work</div><div className="text-2xl text-slate-900">{vendorsHolding}</div></div>
          <div className={`bg-white border rounded p-3 ${counts.OVERDUE > 0 ? 'border-rose-200' : 'border-slate-200'}`}><div className="text-xs text-slate-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</div><div className={`text-2xl ${counts.OVERDUE > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{counts.OVERDUE}</div><div className="text-xs text-slate-500">past the expected return date</div></div>
          <div className="bg-white border border-slate-200 rounded p-3"><div className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Returned</div><div className="text-2xl text-slate-900">{counts.RETURNED}</div></div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {activeTab === 'outward' && (
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 text-xs rounded-full border ${filter === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {f.label} <span className={filter === f.id ? 'opacity-80' : 'text-slate-400'}>{counts[f.id]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="relative ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, challan, job card, work order..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded w-72" />
        </div>
      </div>

      {loading && (activeTab === 'outward' ? outward.length === 0 : inward.length === 0) ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading...</div>
      ) : activeTab === 'outward' ? (
        byVendor.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded p-10 text-center">
            <div className="text-sm text-slate-700">{outward.length === 0 ? 'Nothing has been sent to a vendor yet' : filter === 'OPEN' ? 'No work is out with vendors right now' : 'No challans match'}</div>
            <div className="text-xs text-slate-500 mt-1">{outward.length === 0 ? 'Open a subcontract job card and use "Challan" to send material out.' : 'Try another filter, or look at All.'}</div>
          </div>
        ) : byVendor.map(g => (
          <div key={g.vendor} className="bg-white border border-slate-200 rounded">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-100 rounded-t">
              <Building2 className="w-4 h-4 text-slate-400" />
              <div className="text-sm text-slate-900">{g.vendor}</div>
              <span className="text-xs text-slate-500">{g.rows.length} challan(s) · {Math.round(g.pieces * 1000) / 1000} pieces still with them</span>
              {g.overdue > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">{g.overdue} overdue</span>}
            </div>
            <div className="divide-y divide-slate-100">
              {g.rows.map(({ c, a }) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-[10rem]">
                    <div className="text-sm text-indigo-700">{c.challan_number}</div>
                    <div className="text-[11px] text-slate-500">Sent {formatDate(c.dispatch_date)}{a.daysOut !== null && a.state !== 'RETURNED' ? ` · ${a.daysOut} day(s) out` : ''}</div>
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <div className="text-sm text-slate-900">{c.operation_name || 'Operation'}</div>
                    <div className="text-[11px] text-slate-500">{c.wo_number} · {c.job_card_no}{c.item_name ? ` · ${c.item_name}` : ''}</div>
                  </div>
                  <div className="w-44">
                    <div className="flex justify-between text-[11px] text-slate-500"><span>Back {Math.round(a.back * 1000) / 1000} of {Math.round(a.sent * 1000) / 1000}</span><span>{a.sent > 0 ? Math.round((a.back / a.sent) * 100) : 0}%</span></div>
                    <div className="h-1.5 bg-slate-100 rounded overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${a.sent > 0 ? Math.min(100, (a.back / a.sent) * 100) : 0}%` }} /></div>
                    {a.balance > 0.0005 && <div className="text-[10px] text-slate-400">{Math.round(a.balance * 1000) / 1000} still to come back</div>}
                  </div>
                  <div className="w-36 text-xs">
                    <span className={`px-2 py-0.5 rounded ${STATE[a.state].cls}`}>{STATE[a.state].label}</span>
                    <div className={`mt-0.5 text-[11px] flex items-center gap-1 ${a.state === 'OVERDUE' ? 'text-rose-600' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3" />
                      {a.state === 'RETURNED' || a.state === 'CANCELLED' ? '' : c.expected_return_date ? (a.daysToDue < 0 ? `${Math.abs(a.daysToDue)} day(s) late` : a.daysToDue === 0 ? 'Due today' : `Due in ${a.daysToDue} day(s)`) : 'No return date set'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    {['AT_VENDOR', 'DUE_SOON', 'OVERDUE'].includes(a.state) && (
                      <button onClick={() => onRecordInward(c)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded"><Package className="w-3.5 h-3.5" />Record receipt</button>
                    )}
                    <button onClick={() => onViewOutward(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50"><Eye className="w-3.5 h-3.5" />View</button>
                    <button onClick={() => onPdf(c)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50"><Download className="w-3.5 h-3.5" />PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : receipts.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded p-10 text-center text-sm text-slate-500">{inward.length === 0 ? 'No receipts have been recorded yet.' : 'No receipts match.'}</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="p-2">Receipt</th><th className="p-2">Against challan</th><th className="p-2">Job card</th><th className="p-2">Vendor</th><th className="p-2 text-right">Received</th><th className="p-2">Date</th><th className="p-2" /></tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2 text-emerald-700">{r.inward_number}</td>
                  <td className="p-2">{r.outward_challan_no || '—'}</td>
                  <td className="p-2">{r.job_card_no}</td>
                  <td className="p-2">{r.vendor_name}</td>
                  <td className="p-2 text-right">{Math.round(num(r.total_received_qty) * 1000) / 1000}</td>
                  <td className="p-2">{formatDate(r.received_date)}</td>
                  <td className="p-2 text-right"><button onClick={() => onViewInward(r)} className="flex items-center gap-1 ml-auto px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"><Eye className="w-3.5 h-3.5" />View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubcontractTracker;
