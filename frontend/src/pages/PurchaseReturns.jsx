import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, FormControl } from '../components/ui.jsx';
import {
  RotateCcw, PackageX, Search, Plus, Eye, Download, Edit2, Truck, XCircle, RefreshCw, FileText, AlertTriangle, CheckCircle2
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { useCompanyFilter, CompanyFilterSelect } from '../components/CompanyFilter.jsx';

// Purchase Returns (Procurement): QC-rejected GRN material back to the supplier.
//   Pending Returns  → every rejected QC line not yet returned (automatic from Incoming QC "Reject")
//   Purchase Returns → PR-YYYY-NNNN: Draft → (Return Challan) Dispatched → Replacement / Debit Note → Closed
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken')}` });
const r3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;
const money = (n) => `₹${(parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().split('T')[0];

const STATUS_STYLE = {
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  DISPATCHED: 'bg-amber-50 text-amber-700 border-amber-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-600 border-rose-200'
};
const TYPE_LABEL = { REPLACEMENT: 'Replacement', DEBIT_NOTE: 'Debit Note' };

const PurchaseReturns = () => {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState(() => new Set());
  const [form, setForm] = useState(null); // { id?, return_no?, return_date, return_type, reason, vehicle_no, transporter, remarks, lines: [...] }
  const [saving, setSaving] = useState(false);
  const cf = useCompanyFilter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/purchase-returns/pending`, { headers: authHeaders() }),
        fetch(`${API_BASE}/purchase-returns`, { headers: authHeaders() })
      ]);
      const p = await pRes.json().catch(() => []);
      const r = await rRes.json().catch(() => []);
      if (!pRes.ok) throw new Error(p.message || 'Failed to load pending returns');
      if (!rRes.ok) throw new Error(r.message || 'Failed to load purchase returns');
      setPending(Array.isArray(p) ? p : []);
      setReturns(Array.isArray(r) ? r : []);
    } catch (e) {
      errorToast(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingCompany = useCallback((p) => cf.companyOf({ grn: p.grn_id, po: p.po_id }), [cf]);
  const returnCompany = useCallback((r) => cf.companyOf({ grn: (r.grn_ids || [])[0], po: r.po_id, fallback: r.host_company_id }), [cf]);

  const q = search.trim().toLowerCase();
  const pendingRows = useMemo(() => pending.filter(p => cf.matches(pendingCompany(p)) && (!q || [
    p.item_code, p.material_name, p.vendor_name, p.po_number, p.grn_no, p.size_text, p.qc_remarks
  ].some(v => String(v || '').toLowerCase().includes(q)))), [pending, cf, pendingCompany, q]);

  const returnRows = useMemo(() => returns.filter(r => cf.matches(returnCompany(r))
    && (statusFilter === 'ALL' || r.status === statusFilter)
    && (!q || [r.return_no, r.vendor_name, r.po_number, r.reason].some(v => String(v || '').toLowerCase().includes(q)))),
  [returns, cf, returnCompany, statusFilter, q]);

  const pendingById = useMemo(() => new Map(pending.map(p => [p.qc_item_id, p])), [pending]);
  const selectedLines = useMemo(() => [...selected].map(id => pendingById.get(id)).filter(Boolean), [selected, pendingById]);
  const anchor = selectedLines[0] || null;
  const canSelect = (p) => !anchor || (p.vendor_id === anchor.vendor_id && (p.po_id || null) === (anchor.po_id || null));
  const toggle = (p) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(p.qc_item_id)) next.delete(p.qc_item_id);
    else if (canSelect(p)) next.add(p.qc_item_id);
    return next;
  });

  const totals = useMemo(() => ({
    lines: pendingRows.length,
    qty: r3(pendingRows.reduce((s, p) => s + p.pending_qty, 0)),
    weight: r3(pendingRows.reduce((s, p) => s + p.pending_weight, 0)),
    value: pendingRows.reduce((s, p) => s + (p.pending_value || 0), 0)
  }), [pendingRows]);

  // ── Create / edit form ──
  const lineFromPending = (p, own = { q: 0, w: 0, remarks: undefined }) => {
    const availQty = r3(p.pending_qty + own.q);
    const availWt = r3(p.pending_weight + own.w);
    return {
      qc_item_id: p.qc_item_id,
      item_code: p.item_code,
      material_name: p.material_name,
      size_text: p.size_text,
      grn_no: p.grn_no,
      unit: p.unit,
      rate: p.rate,
      avail_qty: availQty,
      avail_weight: availWt,
      quantity: own.q || availQty,
      weight: own.w || availWt,
      remarks: own.remarks !== undefined ? own.remarks : (p.qc_remarks || '')
    };
  };

  const openCreate = () => {
    if (!selectedLines.length) return;
    setForm({
      return_date: today(),
      return_type: 'REPLACEMENT',
      reason: '',
      vehicle_no: '',
      transporter: '',
      remarks: '',
      vendor_name: anchor.vendor_name,
      po_number: anchor.po_number,
      lines: selectedLines.map(p => lineFromPending(p))
    });
  };

  const openEdit = async (r) => {
    try {
      const res = await fetch(`${API_BASE}/purchase-returns/${r.id}`, { headers: authHeaders() });
      const pr = await res.json();
      if (!res.ok) throw new Error(pr.message || 'Failed to load return');
      setForm({
        id: pr.id,
        return_no: pr.return_no,
        return_date: String(pr.return_date || '').slice(0, 10) || today(),
        return_type: pr.return_type,
        reason: pr.reason || '',
        vehicle_no: pr.vehicle_no || '',
        transporter: pr.transporter || '',
        remarks: pr.remarks || '',
        vendor_name: pr.vendor_name,
        po_number: pr.po_number,
        lines: pr.items.map(i => {
          const p = pendingById.get(i.qc_inspection_item_id) || {
            qc_item_id: i.qc_inspection_item_id, item_code: i.item_code, material_name: i.description, size_text: i.size_text,
            grn_no: i.grn_no, unit: i.unit, rate: i.rate, pending_qty: 0, pending_weight: 0, qc_remarks: ''
          };
          return lineFromPending(p, { q: parseFloat(i.quantity) || 0, w: parseFloat(i.weight) || 0, remarks: i.remarks || '' });
        })
      });
    } catch (e) {
      errorToast(e.message);
    }
  };

  const patchLine = (idx, patch) => setForm(prev => ({ ...prev, lines: prev.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const setLineQty = (idx, value) => setForm(prev => ({
    ...prev,
    lines: prev.lines.map((l, i) => {
      if (i !== idx) return l;
      const qty = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
      // weight follows the quantity proportionally (still editable)
      const wt = l.avail_qty > 0 && qty !== '' ? r3(l.avail_weight * (qty / l.avail_qty)) : l.weight;
      return { ...l, quantity: qty, weight: wt };
    })
  }));

  const lineErrors = (l) => {
    const qty = parseFloat(l.quantity) || 0;
    const wt = parseFloat(l.weight) || 0;
    if (qty <= 0 && wt <= 0) return 'Enter qty or weight';
    if (qty > l.avail_qty + 0.0005) return `Max ${l.avail_qty}`;
    if (wt > l.avail_weight + 0.0005) return `Max ${l.avail_weight} kg`;
    return '';
  };

  const saveForm = async () => {
    if (!form.reason.trim()) { errorToast('Enter the reason for the return'); return; }
    const bad = form.lines.find(l => lineErrors(l));
    if (bad) { errorToast(`${bad.item_code}: ${lineErrors(bad)}`); return; }
    setSaving(true);
    try {
      const body = {
        return_date: form.return_date,
        return_type: form.return_type,
        reason: form.reason,
        vehicle_no: form.vehicle_no,
        transporter: form.transporter,
        remarks: form.remarks,
        lines: form.lines.map(l => ({ qc_item_id: l.qc_item_id, quantity: parseFloat(l.quantity) || 0, weight: parseFloat(l.weight) || 0, remarks: l.remarks }))
      };
      const res = await fetch(`${API_BASE}/purchase-returns${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save return');
      successToast(form.id ? `${data.return_no} updated` : `${data.return_no} created (Draft)`);
      setForm(null);
      setSelected(new Set());
      setTab('returns');
      load();
    } catch (e) {
      errorToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Actions on a return ──
  const openPdf = async (r, mode = 'view') => {
    const win = mode === 'view' ? window.open('', '_blank') : null;
    try {
      const res = await fetch(`${API_BASE}/purchase-returns/${r.id}/pdf${mode === 'view' ? '?inline=1' : ''}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to generate Return Challan');
      const url = window.URL.createObjectURL(new Blob([await res.blob()], { type: 'application/pdf' }));
      if (win) { win.location.href = url; return; }
      const a = document.createElement('a');
      a.href = url;
      a.download = `Return_Challan_${r.return_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      if (win) win.close();
      errorToast(e.message);
    }
  };

  const dispatch = async (r) => {
    const result = await Swal.fire({
      title: `Dispatch ${r.return_no}?`,
      html: `
        <div style="text-align:left;font-size:13px;margin-bottom:8px">The rejected material leaves for <b>${r.vendor_name || 'the supplier'}</b>. A dispatched return can no longer be edited.</div>
        <input id="pr-vehicle" class="swal2-input" placeholder="Vehicle No." value="${r.vehicle_no || ''}" style="margin:6px 0;width:100%">
        <input id="pr-transporter" class="swal2-input" placeholder="Transporter (optional)" value="${r.transporter || ''}" style="margin:6px 0;width:100%">`,
      showCancelButton: true,
      confirmButtonText: 'Dispatch',
      confirmButtonColor: '#d97706',
      preConfirm: () => ({
        vehicle_no: document.getElementById('pr-vehicle').value,
        transporter: document.getElementById('pr-transporter').value
      })
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/purchase-returns/${r.id}/dispatch`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(result.value || {})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch');
      successToast(`${r.return_no} dispatched`);
      load();
    } catch (e) {
      errorToast(e.message);
    }
  };

  const cancel = async (r) => {
    const result = await Swal.fire({
      title: `Cancel ${r.return_no}?`,
      text: 'The items go back to Pending Returns.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel Return',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/purchase-returns/${r.id}/cancel`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to cancel');
      successToast(`${r.return_no} cancelled`);
      load();
    } catch (e) {
      errorToast(e.message);
    }
  };

  const th = 'px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
  const statusCounts = useMemo(() => returns.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}), [returns]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl text-slate-900">Purchase Returns</h1>
            <span className="px-2 py-1 bg-rose-50 text-rose-600 text-xs rounded border border-rose-100">QC Rejected Material</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Incoming QC Reject → Pending Returns → Return Challan → Replacement or Debit Note</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Pending lines', value: totals.lines, icon: PackageX, cls: 'text-rose-600 bg-rose-50' },
          { label: 'Pending qty / weight', value: `${totals.qty} NOS · ${totals.weight} KG`, icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
          { label: 'Pending value', value: money(totals.value), icon: FileText, cls: 'text-indigo-600 bg-indigo-50' },
          { label: 'Returns dispatched', value: statusCounts.DISPATCHED || 0, icon: Truck, cls: 'text-emerald-600 bg-emerald-50' }
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded p-3 flex items-center gap-3">
            <div className={`p-2 rounded ${s.cls}`}><s.icon className="w-4 h-4" /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400">{s.label}</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded">
        {/* Tabs + filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 border-b border-slate-100">
          <div className="flex items-center gap-1">
            {[
              { id: 'pending', label: 'Pending Returns', count: pending.length, icon: PackageX },
              { id: 'returns', label: 'Purchase Returns', count: returns.length, icon: RotateCcw }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs border-b-2 -mb-px ${tab === t.id ? 'border-indigo-600 text-indigo-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
                <span className={`px-1.5 rounded text-[10px] ${tab === t.id ? 'bg-indigo-100' : 'bg-slate-100'}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'pending' ? 'Search item, supplier, PO, GRN…' : 'Search return no., supplier, PO…'}
                className="w-[260px] pl-8 pr-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-400"
              />
            </div>
            <CompanyFilterSelect
              cf={cf}
              rows={tab === 'pending' ? pending : returns}
              getCompanyId={tab === 'pending' ? pendingCompany : returnCompany}
              className="py-1.5"
            />
            {tab === 'returns' && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-2 border border-slate-200 rounded text-xs outline-none">
                <option value="ALL">All statuses</option>
                {['DRAFT', 'DISPATCHED', 'CLOSED', 'CANCELLED'].map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()} ({statusCounts[s] || 0})</option>)}
              </select>
            )}
          </div>
        </div>

        {tab === 'pending' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50/60 border-b border-slate-100 text-xs">
              <span className="text-slate-500">
                {selectedLines.length
                  ? <>Selected <b className="text-slate-800">{selectedLines.length}</b> line(s) · <b>{anchor.vendor_name}</b> · PO {anchor.po_number} <span className="text-slate-400">(one supplier + PO per return)</span></>
                  : 'Tick the rejected lines to return — lines of one supplier and Purchase Order go on one return.'}
              </span>
              <div className="flex items-center gap-2">
                {selectedLines.length > 0 && (
                  <button onClick={() => setSelected(new Set())} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">Clear</button>
                )}
                <button
                  onClick={openCreate}
                  disabled={!selectedLines.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Purchase Return
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={`${th} w-10`}></th>
                    <th className={th}>GRN / QC</th>
                    <th className={th}>Supplier / PO</th>
                    <th className={th}>Item</th>
                    <th className={th}>QC Remark</th>
                    <th className={`${th} text-right`}>Rejected</th>
                    <th className={`${th} text-right`}>Returned</th>
                    <th className={`${th} text-right`}>Pending</th>
                    <th className={`${th} text-right`}>Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && !pendingRows.length ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">Loading…</td></tr>
                  ) : !pendingRows.length ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-400">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      No rejected material waiting to be returned
                    </td></tr>
                  ) : pendingRows.map(p => {
                    const checked = selected.has(p.qc_item_id);
                    const allowed = canSelect(p);
                    return (
                      <tr key={p.qc_item_id} onClick={() => allowed && toggle(p)} className={`${checked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} ${allowed ? 'cursor-pointer' : 'opacity-50'}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={checked} disabled={!allowed} onChange={() => toggle(p)} onClick={(e) => e.stopPropagation()} className="accent-indigo-600" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-indigo-600">{p.grn_no}</div>
                          <div className="text-[10px] text-slate-400">QC {fmtDate(p.inspection_date)}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-slate-800">{p.vendor_name || '—'}</div>
                          <div className="text-[10px] text-slate-500">{p.po_number}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{p.item_code}</div>
                          <div className="text-[10px] text-slate-500">{p.material_name}{p.size_text ? ` · ${p.size_text}` : ''}</div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded border bg-rose-50 text-rose-600 border-rose-200 mb-0.5">Rejected</span>
                          {p.qc_remarks && <div className="text-[10px] text-slate-500 truncate" title={p.qc_remarks}>{p.qc_remarks}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600">{p.rejected_qty} NOS<div className="text-[10px]">{p.rejected_weight} KG</div></td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-400">{p.returned_qty} NOS<div className="text-[10px]">{p.returned_weight} KG</div></td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-rose-600">{p.pending_qty} NOS<div className="text-[10px]">{p.pending_weight} KG</div></td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-700">{money(p.pending_value)}<div className="text-[10px] text-slate-400">@ {money(p.rate)}/{p.unit}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Return No.</th>
                  <th className={th}>Supplier / PO</th>
                  <th className={th}>GRN</th>
                  <th className={th}>Type</th>
                  <th className={th}>Reason</th>
                  <th className={`${th} text-right`}>Qty / Weight</th>
                  <th className={`${th} text-right`}>Value</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!returnRows.length ? (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-400">{loading ? 'Loading…' : 'No purchase returns yet'}</td></tr>
                ) : returnRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-indigo-600">{r.return_no}</div>
                      <div className="text-[10px] text-slate-400">{fmtDate(r.return_date)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-800">{r.vendor_name}</div>
                      <div className="text-[10px] text-slate-500">{r.po_number}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{(r.grn_ids || []).map(id => `GRN-${String(id).padStart(4, '0')}`).join(', ')}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${r.return_type === 'DEBIT_NOTE' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>{TYPE_LABEL[r.return_type] || r.return_type}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate text-slate-600" title={r.reason}>{r.reason}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{r.total_qty} NOS<div className="text-[10px] text-slate-500">{r.total_weight} KG · {r.line_count} line(s)</div></td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-700">{money(r.total_amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_STYLE[r.status] || STATUS_STYLE.DRAFT}`}>{r.status}</span>
                      {r.dispatched_at && <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(r.dispatched_at)}{r.vehicle_no ? ` · ${r.vehicle_no}` : ''}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openPdf(r, 'view')} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="View / Print Return Challan"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openPdf(r, 'download')} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Download Return Challan"><Download className="w-4 h-4" /></button>
                        {r.status === 'DRAFT' && (
                          <>
                            <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => dispatch(r)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="Dispatch (material leaves)"><Truck className="w-4 h-4" /></button>
                            <button onClick={() => cancel(r)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Cancel"><XCircle className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit */}
      <Modal
        isOpen={!!form}
        onClose={() => { if (!saving) setForm(null); }}
        title={form?.id ? `Edit Purchase Return ${form.return_no}` : 'Create Purchase Return'}
        maxWidth="max-w-5xl"
      >
        {form && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100 text-xs">
              <div className="p-2 bg-rose-100 text-rose-600 rounded"><PackageX className="w-5 h-5" /></div>
              <div>
                <div className="font-semibold text-slate-900">{form.vendor_name}</div>
                <div className="text-slate-500">PO {form.po_number} · {form.lines.length} rejected line(s) · no stock movement (rejected material never entered stock)</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormControl label="Return Date">
                <input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500" />
              </FormControl>
              <FormControl label="Settlement">
                <div className="flex gap-2">
                  {[['REPLACEMENT', 'Replacement', 'Supplier sends the material again'], ['DEBIT_NOTE', 'Debit Note', 'Credit from the supplier']].map(([v, l, hint]) => (
                    <label key={v} className={`flex-1 cursor-pointer px-2 py-1.5 rounded border text-xs ${form.return_type === v ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`} title={hint}>
                      <input type="radio" className="mr-1.5 accent-indigo-600" checked={form.return_type === v} onChange={() => setForm({ ...form, return_type: v })} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormControl>
              <FormControl label="Vehicle No.">
                <input value={form.vehicle_no} maxLength={50} placeholder="e.g. MH-14-AB-1234" onChange={(e) => setForm({ ...form, vehicle_no: e.target.value.toUpperCase() })}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500" />
              </FormControl>
              <div className="md:col-span-2">
                <FormControl label="Reason for Return *">
                  <input value={form.reason} maxLength={2000} placeholder="e.g. Dimension out of tolerance, surface defects…" onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className={`w-full p-2 border rounded text-xs outline-none focus:border-indigo-500 ${form.reason.trim() ? 'border-slate-200' : 'border-rose-300'}`} />
                </FormControl>
              </div>
              <FormControl label="Transporter">
                <input value={form.transporter} maxLength={150} onChange={(e) => setForm({ ...form, transporter: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500" />
              </FormControl>
            </div>

            <div className="border border-slate-200 rounded overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={th}>Item</th>
                    <th className={`${th} text-right`}>Available</th>
                    <th className={`${th} text-center`}>Return Qty</th>
                    <th className={`${th} text-center`}>Return Wt (KG)</th>
                    <th className={th}>Remarks (on challan)</th>
                    <th className={`${th} text-right`}>Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.lines.map((l, idx) => {
                    const err = lineErrors(l);
                    const byWeight = /^kg/i.test(String(l.unit || '')) && (parseFloat(l.weight) || 0) > 0;
                    const value = (parseFloat(l.rate) || 0) * (byWeight ? (parseFloat(l.weight) || 0) : (parseFloat(l.quantity) || 0));
                    return (
                      <tr key={l.qc_item_id} className="align-top">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{l.item_code}</div>
                          <div className="text-[10px] text-slate-500">{l.material_name}{l.size_text ? ` · ${l.size_text}` : ''} · {l.grn_no}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-slate-500">{l.avail_qty} NOS<div className="text-[10px]">{l.avail_weight} KG</div></td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max={l.avail_qty} step="1" value={l.quantity} onChange={(e) => setLineQty(idx, e.target.value)}
                            className={`w-20 p-1.5 border rounded text-center outline-none ${err ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max={l.avail_weight} step="0.001" value={l.weight} onChange={(e) => patchLine(idx, { weight: e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0) })}
                            className={`w-24 p-1.5 border rounded text-center outline-none ${err ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} />
                          {err && <div className="text-[10px] text-rose-600 mt-0.5">{err}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <input value={l.remarks} maxLength={500} placeholder="QC Rejected" onChange={(e) => patchLine(idx, { remarks: e.target.value })}
                            className="w-full p-1.5 border border-slate-200 rounded outline-none focus:border-indigo-500" />
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">{money(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <FormControl label="Note (printed on the challan)">
              <textarea rows="2" value={form.remarks} maxLength={2000} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 resize-none" />
            </FormControl>

            <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setForm(null)} disabled={saving} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
              <button onClick={saveForm} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60">
                <CheckCircle2 className="w-4 h-4" /> {saving ? 'Saving…' : (form.id ? 'Update Return' : 'Save as Draft')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseReturns;
