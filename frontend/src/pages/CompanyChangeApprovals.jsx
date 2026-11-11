import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle2, XCircle, Clock, Search, RefreshCw, Eye, ArrowRight } from 'lucide-react';
import { Modal } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';

// Admin: Sales Order issuing-company change requests (Customer PO linked Sales Orders).
// Approve → Sales Order issuing company updated (Customer PO company unchanged). Reject → company unchanged.

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const TABS = [
  { id: 'PENDING', label: 'Pending', icon: Clock, tone: 'text-amber-600' },
  { id: 'APPROVED', label: 'Approved', icon: CheckCircle2, tone: 'text-emerald-600' },
  { id: 'REJECTED', label: 'Rejected', icon: XCircle, tone: 'text-rose-600' }
];

const formatDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

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

const CompanyCard = ({ title, tone, name, gstin, pan, address, bank, account, ifsc }) => (
  <div className={`flex-1 rounded-lg border p-3 ${tone}`}>
    <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">{title}</div>
    <div className="font-semibold text-slate-900 text-sm">{name || '—'}</div>
    <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
      <div>GSTIN: <span className="font-mono font-semibold text-slate-800">{gstin || '—'}</span></div>
      <div>PAN: <span className="font-mono font-semibold text-slate-800">{pan || '—'}</span></div>
      <div>{address || '—'}</div>
      <div>Bank: {bank || '—'} {account ? `· ${account}` : ''} {ifsc ? `· IFSC ${String(ifsc).toUpperCase()}` : ''}</div>
    </div>
  </div>
);

const CompanyChangeApprovals = ({ onCountChange }) => {
  const [tab, setTab] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [detail, setDetail] = useState(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        authFetch(`/company-change-requests?status=${tab}`),
        authFetch('/company-change-requests/pending-count')
      ]);
      setRows(Array.isArray(list) ? list : []);
      setPendingCount(count?.count || 0);
      if (onCountChange) onCountChange(count?.count || 0);
    } catch (error) {
      errorToast(error.message || 'Failed to load company change requests');
    } finally {
      setLoading(false);
    }
  }, [tab, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.order_no, r.customer_po_number, r.current_company_name, r.requested_company_name, r.project_name, r.requested_by_name]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const openDetail = async (row) => {
    setDetail({ ...row, requests: [], history: [] });
    try {
      setDetail(await authFetch(`/company-change-requests/${row.id}`));
    } catch (error) {
      errorToast(error.message || 'Failed to load request');
    }
  };

  const handleApprove = async (row) => {
    const res = await Swal.fire({
      title: 'Approve company change?',
      html: `<div style="font-size:13px">Sales Order <b>${esc(row.order_no)}</b> (Customer PO ${esc(row.customer_po_number || '—')})<br/><br/>${esc(row.current_company_name || '—')} → <b>${esc(row.requested_company_name)}</b><br/><br/>The Sales Order will use the new company's GSTIN, PAN, address and bank details. The Customer PO company is not changed.</div>`,
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
      await authFetch(`/company-change-requests/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ remarks: res.value || null }) });
      successToast('Company change approved');
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
      title: 'Reject company change?',
      text: 'The Sales Order keeps its current company. Sales can submit a new request.',
      input: 'textarea',
      inputPlaceholder: 'Rejection remarks (required)',
      inputValidator: (v) => (!v || !v.trim() ? 'Please enter rejection remarks' : undefined),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#e11d48'
    });
    if (!res.isConfirmed) return;
    setActing(true);
    try {
      await authFetch(`/company-change-requests/${row.id}/reject`, { method: 'POST', body: JSON.stringify({ remarks: res.value }) });
      successToast('Company change rejected');
      setDetail(null);
      load();
    } catch (error) {
      errorToast(error.message || 'Rejection failed');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-3">
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
                  {t.id === 'PENDING' && pendingCount > 0 && (
                    <span className="ml-0.5 px-1.5 rounded-full bg-amber-500 text-white text-[10px]">{pendingCount}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SO, Customer PO, company…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <button onClick={load} className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                <th className="p-3 font-semibold">Sales Order / Customer PO</th>
                <th className="p-3 font-semibold">Company Change</th>
                <th className="p-3 font-semibold">Reason</th>
                <th className="p-3 font-semibold">Requested</th>
                <th className="p-3 font-semibold">{tab === 'PENDING' ? 'Invoice' : 'Decision'}</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && rows.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">{tab === 'PENDING' ? 'No company change requests waiting for approval.' : 'No records.'}</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{r.order_no || `#${r.order_id}`}</div>
                    <div className="text-[10px] text-slate-500">PO {r.customer_po_number || '—'}{r.project_name ? ` · ${r.project_name}` : ''}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-600">{r.current_company_name || '—'}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold text-indigo-700">{r.requested_company_name}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">{r.current_gstin || '—'} → {r.requested_gstin || '—'}</div>
                  </td>
                  <td className="p-3 text-slate-600 max-w-[240px] truncate" title={r.reason}>{r.reason}</td>
                  <td className="p-3">
                    <div className="text-slate-700">{r.requested_by_name || '—'}</div>
                    <div className="text-[10px] text-slate-400">{formatDateTime(r.requested_at)}</div>
                  </td>
                  <td className="p-3">
                    {tab === 'PENDING' ? (
                      Number(r.invoice_count) > 0
                        ? <span className="text-rose-600 font-semibold">Invoice exists</span>
                        : <span className="text-slate-400">None</span>
                    ) : (
                      <>
                        <div className={tab === 'APPROVED' ? 'text-emerald-700' : 'text-rose-600'}>{r.decided_by_name || '—'} · {formatDateTime(r.decided_at)}</div>
                        {r.decision_remarks && <div className="text-[10px] text-slate-500 max-w-[200px] truncate" title={r.decision_remarks}>“{r.decision_remarks}”</div>}
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openDetail(r)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50">
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                      {tab === 'PENDING' && (
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
        <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Company Change · ${detail.order_no || ''}`} size="4xl">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-slate-400">Sales Order</div><div className="font-semibold text-slate-800">{detail.order_no || `#${detail.order_id}`}</div></div>
              <div><div className="text-slate-400">Customer PO</div><div className="font-semibold text-slate-800">{detail.customer_po_number || '—'}</div></div>
              <div><div className="text-slate-400">Requested by</div><div className="font-semibold text-slate-800">{detail.requested_by_name || '—'}</div><div className="text-slate-500">{formatDateTime(detail.requested_at)}</div></div>
              <div><div className="text-slate-400">Status</div><div className="font-semibold text-slate-800">{detail.status}</div>{Number(detail.invoice_count) > 0 && <div className="text-rose-600">Invoice exists</div>}</div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-3">
              <CompanyCard title="Current company" tone="border-slate-200 bg-slate-50" name={detail.current_company_live_name || detail.current_company_name} gstin={detail.current_gstin} pan={detail.current_pan} address={detail.current_address} bank={detail.current_bank_name} account={detail.current_account_number} ifsc={detail.current_ifsc} />
              <div className="hidden md:flex items-center text-slate-400"><ArrowRight className="w-5 h-5" /></div>
              <CompanyCard title="Requested company" tone="border-indigo-200 bg-indigo-50/40" name={detail.requested_company_live_name || detail.requested_company_name} gstin={detail.requested_gstin} pan={detail.requested_pan} address={detail.requested_address} bank={detail.requested_bank_name} account={detail.requested_account_number} ifsc={detail.requested_ifsc} />
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Reason</div>
              <div className="p-2 rounded border border-slate-100 bg-slate-50 text-slate-700">{detail.reason}</div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Requests for this Sales Order</div>
              <ol className="space-y-1">
                {(detail.requests || []).map(q => (
                  <li key={q.id} className="flex flex-wrap gap-2">
                    <span className={`font-semibold ${q.status === 'APPROVED' ? 'text-emerald-700' : q.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-700'}`}>{q.status}</span>
                    <span className="text-slate-600">{q.current_company_name || '—'} → {q.requested_company_name}</span>
                    <span className="text-slate-400">{q.requested_by_name || '—'} · {formatDateTime(q.requested_at)}</span>
                    {q.decision_remarks && <span className="text-slate-600">“{q.decision_remarks}”</span>}
                  </li>
                ))}
              </ol>
            </div>

            {(detail.history || []).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Company change history</div>
                <ol className="space-y-1">
                  {detail.history.map(h => (
                    <li key={h.id} className="text-slate-600">
                      {formatDateTime(h.changed_at)} · {h.old_company_name || '—'} ({h.old_gstin || '—'}) → <b>{h.new_company_name}</b> ({h.new_gstin || '—'}) · by {h.changed_by_name || '—'}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {detail.status === 'PENDING' && (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button disabled={acting} onClick={() => handleReject(detail)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold disabled:opacity-50">Reject</button>
                <button disabled={acting || Number(detail.invoice_count) > 0} onClick={() => handleApprove(detail)} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold disabled:opacity-50" title={Number(detail.invoice_count) > 0 ? 'An invoice exists for this Sales Order — reject this request' : undefined}>Approve Company Change</button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CompanyChangeApprovals;
