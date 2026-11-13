import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle2, XCircle, Clock, Search, RefreshCw, Eye, FileText, TrendingDown, Download } from 'lucide-react';
import { Modal } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';
import { getFileUrl } from '../utils/url';
import { formatDimensions } from '../utils/formatters';
import POApprovals from './POApprovals.jsx';
import CompanyChangeApprovals from './CompanyChangeApprovals.jsx';

// Admin: RFQ Vendor Quotation approval queue.
// Approve → status REVIEWED (shown as Approved) + approval reference code. Approval does NOT create a PO;
// Procurement creates the Purchase Order separately from approved quotations.

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const TABS = [
  { id: 'PENDING_APPROVAL', label: 'Pending', icon: Clock, tone: 'text-amber-600' },
  { id: 'REVIEWED', label: 'Approved', icon: CheckCircle2, tone: 'text-emerald-600' },
  { id: 'REJECTED', label: 'Rejected', icon: XCircle, tone: 'text-rose-600' }
];

const formatCurrency = (value) => {
  const n = Number(value);
  if (!value || isNaN(n)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
};
const formatDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const authFetch = async (path, options = {}) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
};

const itemKey = (i) => String(i.drawing_no || i.item_code || i.description || '').trim().toUpperCase();

const QuotationApprovals = () => {
  // Opens on the Purchase Orders queue when linked with ?type=po (Admin Dashboard banner)
  // ?type=po | ?type=company opens that queue directly (Admin Dashboard banners)
  const [kind, setKind] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('type');
      return t === 'po' ? 'PO' : t === 'company' ? 'COMPANY' : 'QUOTATION';
    } catch { return 'QUOTATION'; }
  });
  const [poPendingCount, setPoPendingCount] = useState(0);
  const [companyPendingCount, setCompanyPendingCount] = useState(0);
  useEffect(() => {
    let explicitType = null;
    try { explicitType = new URLSearchParams(window.location.search).get('type'); } catch { /* ignore */ }
    Promise.all([
      authFetch('/purchase-orders/approvals/pending-count').catch(() => null),
      authFetch('/quotations/approvals/pending-count').catch(() => null),
      authFetch('/company-change-requests/pending-count').catch(() => null)
    ]).then(([poCount, quoteCount, companyCount]) => {
      const poPending = poCount?.count || 0;
      const companyPending = companyCount?.count || 0;
      setPoPendingCount(poPending);
      setCompanyPendingCount(companyPending);
      // No explicit tab requested: open the first queue that has work waiting
      if (!explicitType && !(quoteCount?.count > 0)) {
        if (poPending > 0) setKind('PO');
        else if (companyPending > 0) setKind('COMPANY');
      }
    });
  }, []);
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        authFetch(`/quotations/approvals?status=${tab}`),
        authFetch('/quotations/approvals/pending-count')
      ]);
      setRows(Array.isArray(list) ? list : []);
      setPendingCount(count?.count || 0);
    } catch (error) {
      errorToast(error.message || 'Failed to load quotation approvals');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.quote_number, r.vendor_name, r.mr_number, r.approval_code, r.client_name, r.project_name]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const openDetail = async (row) => {
    setDetail({ ...row, items: [], competitors: [], history: [] });
    setDetailLoading(true);
    try {
      setDetail(await authFetch(`/quotations/${row.id}/approval-detail`));
    } catch (error) {
      errorToast(error.message || 'Failed to load quotation');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (row) => {
    const res = await Swal.fire({
      title: `Approve ${row.quote_number}?`,
      html: `<div style="font-size:13px">Vendor: <b>${row.vendor_name || '—'}</b><br/>Grand Total: <b>${formatCurrency(row.grand_total)}</b><br/><br/>An approval reference code will be generated. No Purchase Order is created — Procurement creates it separately.</div>`,
      input: 'textarea',
      inputPlaceholder: 'Approval remarks (optional)',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#059669'
    });
    if (!res.isConfirmed) return;
    setActing(true);
    try {
      const data = await authFetch(`/quotations/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ remarks: res.value || null }) });
      await Swal.fire({ icon: 'success', title: 'Quotation Approved', html: `Approval Reference Code<br/><b style="font-size:18px;font-family:monospace">${data.data?.approval_code || ''}</b>` });
      setDetail(null);
      load();
    } catch (error) {
      errorToast(error.message || 'Approval failed');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (row) => {
    const res = await Swal.fire({
      title: `Reject ${row.quote_number}?`,
      input: 'textarea',
      inputPlaceholder: 'Reason for rejection (required)',
      inputValidator: (v) => (!v || !v.trim() ? 'Please enter a reason' : undefined),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#e11d48'
    });
    if (!res.isConfirmed) return;
    setActing(true);
    try {
      await authFetch(`/quotations/${row.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: res.value }) });
      successToast('Quotation rejected');
      setDetail(null);
      load();
    } catch (error) {
      errorToast(error.message || 'Rejection failed');
    } finally {
      setActing(false);
    }
  };

  // Download the system-generated quotation PDF (same endpoint the Purchase RFQs page uses)
  const [downloadingId, setDownloadingId] = useState(null);
  const handleDownloadPDF = async (row) => {
    setDownloadingId(row.id);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${row.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation_${row.quote_number || row.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      errorToast('Could not download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // Lowest competing unit rate per item (for the comparison column)
  const lowestRates = useMemo(() => {
    const map = new Map();
    if (!detail) return map;
    const all = [{ vendor_name: detail.vendor_name, items: detail.items || [] }, ...(detail.competitors || [])];
    all.forEach(q => (q.items || []).forEach(i => {
      const rate = Number(i.unit_rate) || 0;
      if (rate <= 0) return;
      const k = itemKey(i);
      const cur = map.get(k);
      if (!cur || rate < cur.rate) map.set(k, { rate, vendor: q.vendor_name });
    }));
    return map;
  }, [detail]);

  const kindSwitch = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Approvals</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {kind === 'QUOTATION'
            ? 'Review vendor quotations sent by Procurement. Approval generates a QA reference code; Purchase Orders are created separately by Procurement.'
            : kind === 'PO'
              ? 'Review Purchase Orders sent by Procurement. Approval generates a PA reference code and the PO becomes Ordered; Procurement then sends it to the vendor.'
              : 'Review requests from Sales to issue a Customer PO based Sales Order under a different company. The Customer PO company is never changed.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'QUOTATION', label: 'Quotations', count: pendingCount },
            { id: 'PO', label: 'Purchase Orders', count: poPendingCount },
            { id: 'COMPANY', label: 'Company Changes', count: companyPendingCount }
          ].map(k => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${kind === k.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {k.label}
              {k.count > 0 && <span className="px-1.5 rounded-full bg-amber-500 text-white text-[10px]">{k.count}</span>}
            </button>
          ))}
        </div>
        {kind === 'QUOTATION' && (
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      </div>
    </div>
  );

  if (kind === 'PO') {
    return (
      <div className="space-y-4">
        {kindSwitch}
        <POApprovals onCountChange={setPoPendingCount} />
      </div>
    );
  }

  if (kind === 'COMPANY') {
    return (
      <div className="space-y-4">
        {kindSwitch}
        <CompanyChangeApprovals onCountChange={setCompanyPendingCount} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {kindSwitch}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-100">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${t.tone}`} />
                  {t.label}
                  {t.id === 'PENDING_APPROVAL' && pendingCount > 0 && (
                    <span className="ml-0.5 px-1.5 rounded-full bg-amber-500 text-white text-[10px]">{pendingCount}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quote, vendor, MR, code…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                <th className="p-3 font-semibold">Quote No.</th>
                <th className="p-3 font-semibold">Vendor</th>
                <th className="p-3 font-semibold">MR / Project</th>
                <th className="p-3 font-semibold text-center">Items</th>
                <th className="p-3 font-semibold text-right">Grand Total</th>
                <th className="p-3 font-semibold">{tab === 'PENDING_APPROVAL' ? 'Submitted' : tab === 'REVIEWED' ? 'Approval' : 'Rejection'}</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && rows.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400 italic">
                  {tab === 'PENDING_APPROVAL' ? 'No quotations waiting for approval.' : 'No records.'}
                </td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{r.quote_number}</div>
                    {r.version > 1 && <div className="text-[10px] text-slate-400">Version {r.version}</div>}
                  </td>
                  <td className="p-3 text-slate-700">{r.vendor_name || '—'}</td>
                  <td className="p-3">
                    <div className="text-slate-700">{r.mr_number || '—'}</div>
                    <div className="text-[10px] text-slate-400">{r.project_name || r.client_name || ''}</div>
                  </td>
                  <td className="p-3 text-center text-slate-700">{r.items_count}</td>
                  <td className="p-3 text-right font-semibold text-indigo-700">{formatCurrency(r.grand_total)}</td>
                  <td className="p-3">
                    {tab === 'PENDING_APPROVAL' && (
                      <>
                        <div className="text-slate-700">{r.submitted_by_name || '—'}</div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(r.submitted_for_approval_at)}</div>
                      </>
                    )}
                    {tab === 'REVIEWED' && (
                      <>
                        <div className="font-mono font-semibold text-emerald-700">{r.approval_code}</div>
                        <div className="text-[10px] text-slate-500">{r.approved_by_name || '—'} · {formatDateTime(r.approved_at)}</div>
                        <div className="text-[10px] text-indigo-600">{r.po_number ? `PO: ${r.po_number}` : 'PO not created yet'}</div>
                      </>
                    )}
                    {tab === 'REJECTED' && (
                      <>
                        <div className="text-rose-600 max-w-[220px] truncate" title={r.approval_remarks}>{r.approval_remarks || '—'}</div>
                        <div className="text-[10px] text-slate-400">{r.rejected_by_name || '—'} · {formatDateTime(r.rejected_at)}</div>
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openDetail(r)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50" title="Review">
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                      <button disabled={downloadingId === r.id} onClick={() => handleDownloadPDF(r)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50" title="Download Quotation PDF">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      {tab === 'PENDING_APPROVAL' && (
                        <>
                          <button disabled={acting} onClick={() => handleApprove(r)} className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                          <button disabled={acting} onClick={() => handleReject(r)} className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50">Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Quotation ${detail.quote_number || ''}`} size="5xl">
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-slate-400">Vendor</div><div className="font-semibold text-slate-800">{detail.vendor_name || '—'}</div></div>
              <div><div className="text-slate-400">MR / Project</div><div className="font-semibold text-slate-800">{detail.mr_number || '—'}</div><div className="text-slate-500">{detail.project_name || detail.client_name || ''}</div></div>
              <div><div className="text-slate-400">Status</div><div className="font-semibold text-slate-800">{detail.status === 'REVIEWED' ? 'Approved' : detail.status === 'PENDING_APPROVAL' ? 'Pending Approval' : detail.status}</div>{detail.approval_code && <div className="font-mono text-emerald-700">{detail.approval_code}</div>}</div>
              <div><div className="text-slate-400">Submitted</div><div className="font-semibold text-slate-800">{detail.submitted_by_name || '—'}</div><div className="text-slate-500">{formatDateTime(detail.submitted_for_approval_at)}</div></div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={downloadingId === detail.id}
                onClick={() => handleDownloadPDF(detail)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> {downloadingId === detail.id ? 'Downloading…' : 'Download Quotation PDF'}
              </button>
              {detail.received_pdf_path && String(detail.received_pdf_path).split(',').map(p => p.trim()).filter(Boolean).map((p, i) => (
                  <a key={i} href={getFileUrl(p)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-indigo-600 hover:bg-indigo-50">
                    <FileText className="w-3.5 h-3.5" /> Vendor document {i + 1}
                  </a>
                ))}
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Quoted Items</h3>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="p-2 font-semibold">Item / Drawing</th>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold text-right">Qty</th>
                      <th className="p-2 font-semibold text-right">Unit Rate</th>
                      <th className="p-2 font-semibold text-right">GST %</th>
                      <th className="p-2 font-semibold text-right">Total</th>
                      <th className="p-2 font-semibold">Lowest Quoted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLoading && <tr><td colSpan="7" className="p-4 text-center text-slate-400">Loading…</td></tr>}
                    {(detail.items || []).map(i => {
                      const low = lowestRates.get(itemKey(i));
                      const rate = Number(i.unit_rate) || 0;
                      const isLowest = low && rate > 0 && rate <= low.rate;
                      return (
                        <tr key={i.id} className={`border-t border-slate-50 ${i.is_selected === 0 ? 'opacity-50' : ''}`}>
                          <td className="p-2 font-medium text-slate-800">{i.drawing_no || i.item_code || '—'}{i.is_selected === 0 && <span className="ml-1 text-[10px] text-slate-400">(not awarded)</span>}</td>
                          <td className="p-2 text-slate-600">
                            {i.description || i.material_name || '—'}
                            {formatDimensions(i) && (
                              <div className="text-[11px] font-mono text-indigo-600 mt-0.5">{formatDimensions(i)}</div>
                            )}
                            {i.item_note && (
                              <div className="text-[11px] text-slate-800 font-medium mt-0.5 break-words">({i.item_note})</div>
                            )}
                          </td>
                          <td className="p-2 text-right">{Number(i.quantity || 0).toFixed(3)}</td>
                          <td className={`p-2 text-right ${isLowest ? 'text-emerald-700 font-semibold' : ''}`}>{formatCurrency(i.unit_rate)}</td>
                          <td className="p-2 text-right">{(Number(i.cgst_percent) || 0) + (Number(i.sgst_percent) || 0)}%</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(i.total_amount || i.amount)}</td>
                          <td className="p-2">
                            {low ? (
                              isLowest
                                ? <span className="text-emerald-700">Lowest</span>
                                : <span className="flex items-center gap-1 text-amber-700"><TrendingDown className="w-3 h-3" />{formatCurrency(low.rate)} · {low.vendor}</span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-6 mt-2 pr-2">
                <span className="text-slate-500">Subtotal: <b className="text-slate-800">{formatCurrency(detail.total_amount)}</b></span>
                <span className="text-slate-500">Tax: <b className="text-slate-800">{formatCurrency(detail.tax_amount)}</b></span>
                <span className="text-slate-500">Grand Total: <b className="text-indigo-700 text-sm">{formatCurrency(detail.grand_total)}</b></span>
              </div>
              {detail.notes && (
                <div className="mt-3 p-2 bg-slate-50 border border-slate-100 rounded text-slate-700 whitespace-pre-wrap">
                  <span className="font-semibold text-slate-500">Notes: </span>{detail.notes}
                </div>
              )}
            </div>

            {(detail.competitors || []).length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Vendor Comparison (same RFQ / MR)</h3>
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-600">
                        <th className="p-2 font-semibold">Vendor</th>
                        <th className="p-2 font-semibold">Quote No.</th>
                        <th className="p-2 font-semibold">Status</th>
                        <th className="p-2 font-semibold text-right">Grand Total</th>
                        <th className="p-2 font-semibold text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-50 bg-indigo-50/40">
                        <td className="p-2 font-semibold">{detail.vendor_name} (this quote)</td>
                        <td className="p-2">{detail.quote_number}</td>
                        <td className="p-2">{detail.status === 'REVIEWED' ? 'Approved' : detail.status}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(detail.grand_total)}</td>
                        <td className="p-2 text-right">—</td>
                      </tr>
                      {detail.competitors.map(c => {
                        const diff = (Number(c.grand_total) || 0) - (Number(detail.grand_total) || 0);
                        return (
                          <tr key={c.id} className="border-t border-slate-50">
                            <td className="p-2">{c.vendor_name || '—'}</td>
                            <td className="p-2">{c.quote_number}</td>
                            <td className="p-2">{c.status === 'REVIEWED' ? 'Approved' : c.status}</td>
                            <td className="p-2 text-right">{formatCurrency(c.grand_total)}</td>
                            <td className={`p-2 text-right ${diff < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{diff < 0 ? `${formatCurrency(Math.abs(diff))} cheaper` : diff > 0 ? `+${formatCurrency(diff)}` : 'Same'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Approval History</h3>
              {(detail.history || []).length === 0 ? (
                <p className="text-slate-400 italic">No history.</p>
              ) : (
                <ol className="space-y-1.5">
                  {detail.history.map(h => (
                    <li key={h.id} className="flex flex-wrap gap-2">
                      <span className={`font-semibold ${h.action === 'APPROVED' ? 'text-emerald-700' : h.action === 'REJECTED' ? 'text-rose-600' : 'text-amber-700'}`}>{h.action}</span>
                      <span className="text-slate-500">{h.quote_number}</span>
                      <span className="text-slate-500">{h.acted_by_name || '—'} · {formatDateTime(h.acted_at)}</span>
                      {h.approval_code && <span className="font-mono text-emerald-700">{h.approval_code}</span>}
                      {h.remarks && <span className="text-slate-600">“{h.remarks}”</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {detail.status === 'PENDING_APPROVAL' && (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button disabled={acting} onClick={() => handleReject(detail)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold disabled:opacity-50">Reject</button>
                <button disabled={acting} onClick={() => handleApprove(detail)} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold disabled:opacity-50">Approve & Generate Code</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default QuotationApprovals;
