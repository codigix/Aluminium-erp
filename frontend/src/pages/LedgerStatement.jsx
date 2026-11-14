// Accounts → Ledger Statement: Tally "Ledger Vouchers" style statement of any ledger (read-only)
import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Users, Truck, Landmark, Wallet, Layers, Search, RefreshCw, Printer, Eye, X, FileText,
  ArrowDownRight, ArrowUpRight, Scale, CalendarDays, Building2, Download
} from 'lucide-react';
import { SearchableSelect } from '../components/ui.jsx';
import { errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('authToken')}` });

const money = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(parseFloat(n) || 0));
const drCr = (n) => {
  const v = parseFloat(n) || 0;
  if (Math.abs(v) < 0.005) return '0.00';
  return `${money(v)} ${v > 0 ? 'Dr' : 'Cr'}`;
};
const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m, 10) - 1] || m;
  return `${day}-${mon}-${String(y).slice(2)}`;
};
const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Indian financial years (Apr–Mar): current and the 4 before it
const financialYears = () => {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const today = toYMD(now);
  return Array.from({ length: 5 }, (_, i) => {
    const y = start - i;
    const fyEnd = `${y + 1}-03-31`;
    // Current FY runs up to today (latest date), past FYs to 31 March
    return { id: `${y}`, label: `FY ${y}-${String(y + 1).slice(2)}`, from: `${y}-04-01`, to: fyEnd > today ? today : fyEnd };
  });
};

const LEDGER_TYPES = [
  { id: 'CUSTOMER', label: 'Customer', icon: Users, key: 'customers' },
  { id: 'SUPPLIER', label: 'Supplier', icon: Truck, key: 'suppliers' },
  { id: 'BANK', label: 'Bank', icon: Landmark, key: 'banks' },
  { id: 'CASH', label: 'Cash', icon: Wallet, key: 'cash' },
  { id: 'OTHER', label: 'Other Ledger', icon: Layers, key: 'others' }
];

const TYPE_STYLE = {
  Sales: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Purchase: 'bg-orange-50 text-orange-700 border-orange-200',
  Receipt: 'bg-teal-50 text-teal-700 border-teal-200',
  Payment: 'bg-blue-50 text-blue-700 border-blue-200',
  'Debit Note': 'bg-rose-50 text-rose-700 border-rose-200',
  'Credit Note': 'bg-violet-50 text-violet-700 border-violet-200',
  Journal: 'bg-amber-50 text-amber-700 border-amber-200',
  Contra: 'bg-slate-100 text-slate-700 border-slate-200'
};

// Existing PDF of the original voucher, where the ERP has one
const PDF_URL = {
  SALES_INVOICE: (id) => `${API_BASE}/sales-invoices/${id}/pdf`,
  RECEIPT: (id) => `${API_BASE}/customer-payments/${id}/pdf`,
  PAYMENT: (id) => `${API_BASE}/payments/${id}/pdf`,
  CREDIT_NOTE: (id) => `${API_BASE}/customer-payments/credit-notes/${id}/pdf`,
  PURCHASE_BILL: (id) => `${API_BASE}/payments/vendor-invoice/${id}/pdf`
};

const VOUCHER_TITLE = {
  SALES_INVOICE: 'Sales Invoice', PURCHASE_BILL: 'Purchase Bill', RECEIPT: 'Receipt Voucher', PAYMENT: 'Payment Voucher',
  DEBIT_NOTE: 'Debit Note', CREDIT_NOTE: 'Credit Note', JOURNAL: 'Journal Voucher', CONTRA: 'Contra Voucher'
};

const LedgerStatement = () => {
  const fys = useMemo(financialYears, []);
  const [options, setOptions] = useState(null);
  const [hostCompanies, setHostCompanies] = useState([]);
  const [hostId, setHostId] = useState('');
  // One search across every ledger: value = 'TYPE|id' (e.g. 'CUSTOMER|12', 'BANK|2', 'CASH|CASH', 'OTHER|Purchase Returns')
  const [ledgerKey, setLedgerKey] = useState('');
  const sep = ledgerKey.indexOf('|');
  const ledgerType = sep > 0 ? ledgerKey.slice(0, sep) : '';
  const ledgerId = sep > 0 ? ledgerKey.slice(sep + 1) : '';
  const [fy, setFy] = useState(fys[0].id);
  const [from, setFrom] = useState(fys[0].from);
  const [to, setTo] = useState(fys[0].to);
  const [preset, setPreset] = useState('FY');
  const [vchType, setVchType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [o, h] = await Promise.all([
          fetch(`${API_BASE}/ledger-statement/options`, { headers: authHeaders() }),
          fetch(`${API_BASE}/admin-company-master/options`, { headers: authHeaders() })
        ]);
        if (o.ok) setOptions(await o.json());
        else errorToast((await o.json().catch(() => ({}))).message || 'Could not load ledgers');
        if (h.ok) { const d = await h.json(); setHostCompanies(Array.isArray(d) ? d : []); }
      } catch (e) {
        errorToast('Could not load ledgers');
      }
    })();
  }, []);

  // All ledgers in one list; each shows its group (Sundry Debtors / Sundry Creditors / Bank / Cash / General)
  const ledgerList = useMemo(() => {
    if (!options) return [];
    const GROUP = { CUSTOMER: 'Customer · Sundry Debtors', SUPPLIER: 'Supplier · Sundry Creditors', BANK: 'Bank Account', CASH: 'Cash-in-Hand', OTHER: 'General Ledger' };
    const all = [];
    LEDGER_TYPES.forEach(t => {
      (options[t.key] || []).forEach(l => {
        const party = t.id === 'CUSTOMER' || t.id === 'SUPPLIER';
        if (onlyActive && party && !l.has_entries) return;
        all.push({
          value: `${t.id}|${l.id}`,
          label: l.name,
          sublabel: `${GROUP[t.id]}${party ? (l.has_entries ? ' · has vouchers' : ' · no posted vouchers yet') : ''}`,
          active: !party || l.has_entries
        });
      });
    });
    // Ledgers with vouchers first, then A–Z
    return all.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || String(a.label).localeCompare(String(b.label)));
  }, [options, onlyActive]);

  const load = async () => {
    if (!ledgerId) { setData(null); return; }
    try {
      setLoading(true);
      const qs = new URLSearchParams({ ledgerType, ledgerId });
      if (hostId) qs.set('hostCompanyId', hostId);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`${API_BASE}/ledger-statement?${qs}`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not load the ledger');
      setData(json);
    } catch (e) {
      errorToast(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ledgerType, ledgerId, hostId, from, to]);

  const applyPreset = (p) => {
    setPreset(p);
    const now = new Date();
    if (p === 'ALL') { setFrom(''); setTo(''); }
    else if (p === 'MONTH') { setFrom(toYMD(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0))); }
    else if (p === 'TODAY') { setFrom(toYMD(now)); setTo(toYMD(now)); }
    else if (p === 'FY') { const f = fys.find(x => x.id === fy) || fys[0]; setFrom(f.from); setTo(f.to); }
  };

  const onFyChange = (id) => {
    setFy(id);
    const f = fys.find(x => x.id === id);
    if (f) { setFrom(f.from); setTo(f.to); setPreset('FY'); }
  };

  // Every voucher type is always listed (count 0 when this ledger has none)
  const voucherTypes = ['Sales', 'Purchase', 'Receipt', 'Payment', 'Debit Note', 'Credit Note', 'Journal', 'Contra'];
  // Combined views: invoices together with the money received / paid against them
  const COMBINED = {
    'SALES_RECEIPT': { label: 'Sales + Receipts', types: ['Sales', 'Receipt'] },
    'PURCHASE_PAYMENT': { label: 'Purchase + Payments', types: ['Purchase', 'Payment'] }
  };
  const typeCount = (types) => types.reduce((s, t) => s + (data?.by_type?.[t]?.count || 0), 0);
  const matchesType = (t) => vchType === 'ALL' || (COMBINED[vchType] ? COMBINED[vchType].types.includes(t) : t === vchType);

  // Voucher type + search narrow the table; the balance column keeps the full running balance
  const shownRows = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      matchesType(r.voucher_type) &&
      (!q || [r.voucher_no, r.ref_no, r.particulars, r.sub, r.narration].some(v => String(v || '').toLowerCase().includes(q))));
  }, [data, vchType, search]);
  const filtered = vchType !== 'ALL' || search.trim() !== '';
  const shownDr = shownRows.reduce((s, r) => s + r.debit, 0);
  const shownCr = shownRows.reduce((s, r) => s + r.credit, 0);

  const companyName = hostId ? (hostCompanies.find(h => String(h.id) === String(hostId))?.company_name || 'Company') : 'All Companies';
  const periodLabel = from || to ? `${fmtDate(from) || 'Beginning'} to ${fmtDate(to) || 'Today'}` : 'All Time';

  const openVoucher = async (row) => {
    try {
      setVoucherLoading(true);
      setVoucher({ row, kind: row.doc.kind, header: null, lines: [] });
      const res = await fetch(`${API_BASE}/ledger-statement/voucher/${row.doc.kind}/${row.doc.id}`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not open the voucher');
      setVoucher({ row, ...json });
    } catch (e) {
      errorToast(e.message);
      setVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  };

  const openPdf = async (kind, id) => {
    const make = PDF_URL[kind];
    if (!make) return;
    const win = window.open('', '_blank');
    try {
      const res = await fetch(make(id), { headers: authHeaders() });
      if (!res.ok) throw new Error('PDF not available for this voucher');
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (e) {
      if (win) win.close();
      errorToast(e.message);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Ledger', data.ledger.name], ['Company', companyName], ['Period', periodLabel], [],
      ['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Ref No.', 'Debit', 'Credit', 'Balance'],
      ['', 'Opening Balance', '', '', '', data.opening_balance > 0 ? data.opening_balance : '', data.opening_balance < 0 ? -data.opening_balance : '', drCr(data.opening_balance)],
      ...shownRows.map(r => [r.date, r.particulars, r.voucher_type, r.voucher_no, r.ref_no || '', r.debit || '', r.credit || '', drCr(r.balance)]),
      ['', 'Closing Balance', '', '', '', '', '', drCr(data.closing_balance)]
    ];
    const blob = new Blob([lines.map(l => l.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Ledger_${String(data.ledger.name).replace(/[^\w]+/g, '_')}.csv`;
    a.click();
  };

  const printStatement = () => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) return;
    const rowsHtml = shownRows.map(r => `<tr><td>${fmtDate(r.date)}</td><td><b>${r.particulars}</b>${r.narration ? `<div class="n">${r.narration}</div>` : ''}</td>
      <td>${r.voucher_type}</td><td>${r.voucher_no}</td><td>${r.ref_no || ''}</td><td class="r">${r.debit ? money(r.debit) : ''}</td>
      <td class="r">${r.credit ? money(r.credit) : ''}</td><td class="r">${drCr(r.balance)}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>Ledger – ${data.ledger.name}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#0f172a;padding:20px}h2{margin:0}.m{color:#64748b;margin:2px 0 12px}
      table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{background:#f1f5f9;font-size:11px;text-transform:uppercase}.r{text-align:right;white-space:nowrap}.n{color:#64748b;font-size:10px}
      .t td{font-weight:bold;border-top:2px solid #94a3b8}</style></head><body>
      <h2>${data.ledger.name}</h2><div class="m">${companyName} · Ledger Vouchers · ${periodLabel}</div>
      <table><thead><tr><th>Date</th><th>Particulars</th><th>Vch Type</th><th>Vch No.</th><th>Ref No.</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead>
      <tbody>${rowsHtml}
      <tr class="t"><td></td><td>Opening Balance</td><td></td><td></td><td></td><td class="r">${data.opening_balance > 0 ? money(data.opening_balance) : ''}</td><td class="r">${data.opening_balance < 0 ? money(data.opening_balance) : ''}</td><td></td></tr>
      <tr class="t"><td></td><td>Current Total</td><td></td><td></td><td></td><td class="r">${money(shownDr)}</td><td class="r">${money(shownCr)}</td><td></td></tr>
      <tr class="t"><td></td><td>Closing Balance</td><td></td><td></td><td></td><td></td><td></td><td class="r">${drCr(data.closing_balance)}</td></tr>
      </tbody></table><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const card = (label, value, Icon, cls, sub) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs px-4 py-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cls}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-lg font-bold font-mono text-slate-900 truncate">{value}</div>
        {sub && <div className="text-[10.5px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );

  const closing = data?.closing_balance || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm"><BookOpen className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Ledger Account</h1>
            <p className="text-xs text-slate-500">Ledger Vouchers — every posted voucher of a ledger with running balance (Tally style)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={!ledgerId} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Excel (CSV)
          </button>
          <button type="button" onClick={printStatement} disabled={!data} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Ledger + filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ledger Account</label>
              <label className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 cursor-pointer select-none">
                <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} className="accent-indigo-600" />
                Only with vouchers
              </label>
            </div>
            <SearchableSelect
              options={ledgerList}
              value={ledgerKey}
              onChange={(e) => { setLedgerKey(e.target.value || ''); setData(null); setVchType('ALL'); setSearch(''); }}
              placeholder={options ? `Search any ledger — customer, supplier, bank, cash… (${ledgerList.length})` : 'Loading ledgers…'}
              labelField="label"
              valueField="value"
              subLabelField="sublabel"
              allowCustom={false}
              showSearchIcon={true}
              className="w-full text-sm py-2 px-3 border-slate-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Company</label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <select value={hostId} onChange={e => setHostId(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">All Companies</option>
                {hostCompanies.map(h => <option key={h.id} value={h.id}>{h.company_name}</option>)}
              </select>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Financial Year</label>
            <select value={fy} onChange={e => onFyChange(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              {fys.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Period</label>
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('CUSTOM'); }} className="w-full text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('CUSTOM'); }} className="w-full text-xs border border-slate-300 rounded-lg px-2 py-2 bg-white" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {[['FY', 'This FY'], ['ALL', 'All Time'], ['MONTH', 'This Month'], ['TODAY', 'Today']].map(([id, label], i) => (
              <button key={id} type="button" onClick={() => applyPreset(id)}
                className={`px-3 py-1.5 text-xs font-semibold cursor-pointer ${i ? 'border-l border-slate-200' : ''} ${preset === id ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={vchType} onChange={e => setVchType(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
            <option value="ALL">All Voucher Types</option>
            <optgroup label="Combined">
              {Object.entries(COMBINED).map(([id, c]) => <option key={id} value={id}>{c.label} ({typeCount(c.types)})</option>)}
            </optgroup>
            <optgroup label="Single type">
              {voucherTypes.map(t => <option key={t} value={t}>{t} ({data?.by_type?.[t]?.count || 0})</option>)}
            </optgroup>
          </select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voucher no., invoice no., reference, particulars…"
              className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
        </div>
      </div>

      {!ledgerId ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <BookOpen className="w-10 h-10 text-slate-200 mx-auto" />
          <p className="text-sm font-semibold text-slate-600 mt-3">Select a ledger account</p>
          <p className="text-xs text-slate-400 mt-1">Type any name in Ledger Account — customer, supplier, bank, Cash or another ledger — to see its vouchers.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {card('Opening Balance', data ? drCr(data.opening_balance) : '—', Scale, 'bg-slate-100 text-slate-600', from ? `as on ${fmtDate(from)}` : 'start of records')}
            {card('Total Debit', data ? money(data.total_debit) : '—', ArrowUpRight, 'bg-rose-50 text-rose-600', 'in this period')}
            {card('Total Credit', data ? money(data.total_credit) : '—', ArrowDownRight, 'bg-emerald-50 text-emerald-600', 'in this period')}
            {card('Closing Balance', data ? drCr(closing) : '—', BookOpen, closing > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600',
              data ? (ledgerType === 'CUSTOMER' ? (closing > 0 ? 'receivable from customer' : closing < 0 ? 'advance / excess received' : 'settled')
                : ledgerType === 'SUPPLIER' ? (closing < 0 ? 'payable to supplier' : closing > 0 ? 'advance / recoverable' : 'settled') : `as on ${to ? fmtDate(to) : 'today'}`) : null)}
          </div>

          {/* Statement */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Ledger : {data?.ledger?.group || ''}</div>
                <div className="text-base font-bold text-slate-900">{data?.ledger?.name || '…'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {companyName}</div>
                <div className="text-xs text-slate-500 inline-flex items-center gap-1 ml-3"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {periodLabel}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white text-slate-500 text-[10.5px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 w-24">Date</th>
                    <th className="px-3 py-2.5">Particulars</th>
                    <th className="px-3 py-2.5 w-28">Vch Type</th>
                    <th className="px-3 py-2.5 w-36">Vch No.</th>
                    <th className="px-3 py-2.5 w-32">Ref No.</th>
                    <th className="px-3 py-2.5 w-32 text-right">Debit</th>
                    <th className="px-3 py-2.5 w-32 text-right">Credit</th>
                    <th className="px-3 py-2.5 w-36 text-right">Balance</th>
                    <th className="px-2 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!filtered && data && (
                    <tr className="bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{from ? fmtDate(from) : ''}</td>
                      <td className="px-3 py-2 font-semibold text-slate-600 italic">Opening Balance</td>
                      <td colSpan={3} />
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{data.opening_balance > 0 ? money(data.opening_balance) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{data.opening_balance < 0 ? money(data.opening_balance) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">{drCr(data.opening_balance)}</td>
                      <td />
                    </tr>
                  )}
                  {loading && !data && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Loading ledger…</td></tr>
                  )}
                  {data && shownRows.map(r => (
                    <tr key={`${r.doc.kind}-${r.doc.id}-${r.sr}`} onClick={() => openVoucher(r)} className="hover:bg-indigo-50/50 cursor-pointer group">
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-mono">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-800">{r.particulars}</div>
                        {(r.sub || r.narration) && (
                          <div className="text-[10.5px] text-slate-400 truncate max-w-[420px]" title={r.narration || r.sub}>
                            {[r.sub, r.narration].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${TYPE_STYLE[r.voucher_type] || TYPE_STYLE.Contra}`}>{r.voucher_type}</span>
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-indigo-700 whitespace-nowrap">{r.voucher_no}</td>
                      <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{r.ref_no || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{r.debit ? money(r.debit) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{r.credit ? money(r.credit) : ''}</td>
                      <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${r.balance > 0 ? 'text-indigo-700' : r.balance < 0 ? 'text-teal-700' : 'text-slate-400'}`}>{drCr(r.balance)}</td>
                      <td className="px-2 py-2 text-slate-300 group-hover:text-indigo-600"><Eye className="w-4 h-4" /></td>
                    </tr>
                  ))}
                  {data && shownRows.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 italic">
                      {filtered ? 'No voucher matches the filter.' : 'No vouchers in this period.'}
                    </td></tr>
                  )}
                </tbody>
                {data && (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 text-xs">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold text-slate-600">Opening Balance :</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{data.opening_balance > 0 ? money(data.opening_balance) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{data.opening_balance < 0 ? money(data.opening_balance) : ''}</td>
                      <td colSpan={2} />
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold text-slate-600">
                        {filtered ? `Total of ${shownRows.length} shown voucher(s) :` : 'Current Total :'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{money(filtered ? shownDr : data.total_debit)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{money(filtered ? shownCr : data.total_credit)}</td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="border-t border-slate-300">
                      <td colSpan={5} className="px-3 py-2.5 text-right font-bold text-slate-900">Closing Balance :</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{closing > 0 ? money(closing) : ''}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{closing < 0 ? money(closing) : ''}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700">{drCr(closing)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {filtered && data && (
              <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
                Filter applied — Balance column shows the ledger's running balance on that date; the closing balance is for all vouchers in the period.
              </div>
            )}
          </div>
        </>
      )}

      {/* Voucher detail */}
      {voucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setVoucher(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{VOUCHER_TITLE[voucher.kind] || 'Voucher'}</div>
                <div className="text-lg font-bold font-mono text-indigo-700">{voucher.row.voucher_no}</div>
              </div>
              <div className="flex items-center gap-2">
                {PDF_URL[voucher.kind] && (
                  <button type="button" onClick={() => openPdf(voucher.kind, voucher.row.doc.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
                    <FileText className="w-3.5 h-3.5" /> Open PDF
                  </button>
                )}
                <button type="button" onClick={() => setVoucher(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {voucherLoading || !voucher.header ? (
                <div className="py-10 text-center text-slate-400 text-sm">Loading voucher…</div>
              ) : (
                <VoucherBody v={voucher} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Original voucher: header facts + its lines
const VoucherBody = ({ v }) => {
  const h = v.header || {};
  const r = v.row;
  const facts = [
    ['Date', fmtDate(r.date)],
    ['Party', h.party_name || h.vendor_name || null],
    ['Amount', `₹ ${money(r.debit || r.credit)}`],
    ['Effect on this ledger', r.debit ? 'Debit' : 'Credit'],
    ['Reference', r.ref_no],
    ['Bank', h.bank_name ? `${h.bank_name}${h.account_number ? ` (${h.account_number})` : ''}` : (h.manual_bank_account || null)],
    ['Mode', h.payment_mode],
    ['Cheque / Txn', h.cheque_number || h.transaction_ref_no || h.reference_no],
    ['Sales Order', h.order_no],
    ['Customer PO', h.customer_po_no],
    ['PO', h.po_number],
    ['Ledger affected', h.affected_ledger],
    ['From → To', v.kind === 'CONTRA' ? `${h.from_account} → ${h.to_account}` : null],
    ['Taxable', h.taxable_amount != null ? `₹ ${money(h.taxable_amount)}` : (h.subtotal != null ? `₹ ${money(h.subtotal)}` : null)],
    ['GST', (h.cgst_amount != null || h.igst_amount != null) ? `₹ ${money((parseFloat(h.cgst_amount) || 0) + (parseFloat(h.sgst_amount) || 0) + (parseFloat(h.igst_amount) || 0))}` : null],
    ['Status', h.status]
  ].filter(([, val]) => val !== null && val !== undefined && val !== '');
  const isDrCr = v.kind === 'JOURNAL' || v.kind === 'CONTRA';
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        {facts.map(([k, val]) => (
          <div key={k}>
            <div className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">{k}</div>
            <div className="text-sm font-semibold text-slate-800 break-words">{val}</div>
          </div>
        ))}
      </div>
      {(h.narration || h.remarks || h.notes) && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="font-semibold text-slate-500">Narration: </span>{h.narration || h.remarks || h.notes}
        </div>
      )}
      {v.lines && v.lines.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10.5px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">{isDrCr ? 'Ledger' : 'Item / Particulars'}</th>
                {!isDrCr && <th className="px-3 py-2 text-right">Qty</th>}
                {!isDrCr && <th className="px-3 py-2 text-right">Rate</th>}
                <th className="px-3 py-2 text-right">{isDrCr ? 'Debit' : 'Amount'}</th>
                {isDrCr && <th className="px-3 py-2 text-right">Credit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {v.lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-800">{l.description || l.item_code || '—'}</div>
                    {l.item_code && l.description && <div className="text-[10px] font-mono text-slate-400">{l.item_code}{l.drawing_no ? ` · ${l.drawing_no}` : ''}</div>}
                  </td>
                  {!isDrCr && <td className="px-3 py-2 text-right font-mono">{l.quantity != null ? `${parseFloat(l.quantity)} ${l.unit || ''}` : ''}</td>}
                  {!isDrCr && <td className="px-3 py-2 text-right font-mono">{l.rate != null ? money(l.rate) : ''}</td>}
                  <td className="px-3 py-2 text-right font-mono font-semibold">{isDrCr ? (parseFloat(l.debit) ? money(l.debit) : '') : money(l.amount)}</td>
                  {isDrCr && <td className="px-3 py-2 text-right font-mono font-semibold">{parseFloat(l.credit) ? money(l.credit) : ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default LedgerStatement;
