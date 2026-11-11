import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle2, XCircle, Clock, Search, RefreshCw, Eye, Download } from 'lucide-react';
import { Modal } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';

// Admin: Purchase Order approval queue.
// Approve → PO status ORDERED + PO approval code (PA-YYYY-MM-####). Reject → back to Draft with remarks.
// Approval does NOT email the vendor; Procurement sends the PO after approval.

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const TABS = [
  { id: 'PENDING_APPROVAL', label: 'Pending', icon: Clock, tone: 'text-amber-600' },
  { id: 'APPROVED', label: 'Approved', icon: CheckCircle2, tone: 'text-emerald-600' },
  { id: 'REJECTED', label: 'Rejected', icon: XCircle, tone: 'text-rose-600' }
];

const formatCurrency = (value) => {
  const n = Number(value);
  if (!value || isNaN(n)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
};
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
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

const POApprovals = ({ onCountChange }) => {
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
        authFetch(`/purchase-orders/approvals?status=${tab}`),
        authFetch('/purchase-orders/approvals/pending-count')
      ]);
      setRows(Array.isArray(list) ? list : []);
      setPendingCount(count?.count || 0);
      if (onCountChange) onCountChange(count?.count || 0);
    } catch (error) {
      errorToast(error.message || 'Failed to load PO approvals');
    } finally {
      setLoading(false);
    }
  }, [tab, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.po_number, r.vendor_name, r.mr_number, r.po_approval_code, r.quote_number, r.quotation_approval_code]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const openDetail = async (row) => {
    setDetail({ ...row, items: [], history: [] });
    setDetailLoading(true);
    try {
      setDetail(await authFetch(`/purchase-orders/${row.id}/approval-detail`));
    } catch (error) {
      errorToast(error.message || 'Failed to load Purchase Order');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadPDF = async (row) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${row.id}/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to fetch PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PurchaseOrder_${row.po_number || row.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      errorToast('Could not download PDF');
    }
  };

  const handleApprove = async (row) => {
    const res = await Swal.fire({
      title: `Approve ${esc(row.po_number)}?`,
      html: `<div style="font-size:13px">Vendor: <b>${esc(row.vendor_name || '—')}</b><br/>PO Value: <b>${formatCurrency(row.total_amount)}</b>${row.quotation_approval_code ? `<br/>Quotation approval: <b>${esc(row.quotation_approval_code)}</b>` : ''}<br/><br/>A PO approval code will be generated and the PO becomes <b>Ordered</b>. The vendor is not emailed automatically.</div>`,
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
      const data = await authFetch(`/purchase-orders/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ remarks: res.value || null }) });
      await Swal.fire({ icon: 'success', title: 'Purchase Order Approved', html: `PO Approval Code<br/><b style="font-size:18px;font-family:monospace">${esc(data.approval_code || '')}</b>` });
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
      title: `Reject ${esc(row.po_number)}?`,
      text: 'The PO goes back to Draft so Procurement can correct it and resubmit.',
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
      await authFetch(`/purchase-orders/${row.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: res.value }) });
      successToast('Purchase Order rejected and returned to Draft');
      setDetail(null);
      load();
    } catch (error) {
      errorToast(error.message || 'Rejection failed');
    } finally {
      setActing(false);
    }
  };

  const detailItems = Array.isArray(detail?.items) ? detail.items : [];
  const subtotal = detailItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const taxTotal = detailItems.reduce((s, i) => s + (Number(i.cgst_amount) || 0) + (Number(i.sgst_amount) || 0) + (Number(i.igst_amount) || 0), 0);

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
                  {t.id === 'PENDING_APPROVAL' && pendingCount > 0 && (
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
                placeholder="Search PO, vendor, MR, code…"
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
                <th className="p-3 font-semibold">PO No.</th>
                <th className="p-3 font-semibold">Vendor</th>
                <th className="p-3 font-semibold">Source</th>
                <th className="p-3 font-semibold text-center">Items</th>
                <th className="p-3 font-semibold text-right">PO Value</th>
                <th className="p-3 font-semibold">{tab === 'PENDING_APPROVAL' ? 'Submitted' : tab === 'APPROVED' ? 'Approval' : 'Rejection'}</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && rows.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400 italic">
                  {tab === 'PENDING_APPROVAL' ? 'No Purchase Orders waiting for approval.' : 'No records.'}
                </td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{r.po_number}</div>
                    <div className="text-[10px] text-slate-400">{formatDate(r.created_at)}</div>
                  </td>
                  <td className="p-3 text-slate-700">{r.vendor_name || '—'}</td>
                  <td className="p-3">
                    <div className="text-slate-700">{r.quote_number || (r.po_type === 'DIRECT_COMPANY' ? 'Direct Company PO' : r.is_merged ? 'Merged PO' : 'Manual PO')}</div>
                    <div className="text-[10px] text-slate-400">
                      {r.mr_number || ''}
                      {r.quotation_approval_code && <span className="ml-1 font-mono text-emerald-700">{r.quotation_approval_code}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-center text-slate-700">{r.items_count}</td>
                  <td className="p-3 text-right font-semibold text-indigo-700">{formatCurrency(r.total_amount)}</td>
                  <td className="p-3">
                    {tab === 'PENDING_APPROVAL' && (
                      <>
                        <div className="text-slate-700">{r.submitted_by_name || '—'}</div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(r.submitted_for_approval_at)}</div>
                      </>
                    )}
                    {tab === 'APPROVED' && (
                      <>
                        <div className="font-mono font-semibold text-emerald-700">{r.po_approval_code}</div>
                        <div className="text-[10px] text-slate-500">{r.approved_by_name || '—'} · {formatDateTime(r.approved_at)}</div>
                      </>
                    )}
                    {tab === 'REJECTED' && (
                      <>
                        <div className="text-rose-600 max-w-[220px] truncate" title={r.po_approval_remarks}>{r.po_approval_remarks || '—'}</div>
                        <div className="text-[10px] text-slate-400">{r.rejected_by_name || '—'} · {formatDateTime(r.rejected_at)}</div>
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openDetail(r)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50" title="Review">
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                      <button onClick={() => handleDownloadPDF(r)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-indigo-600 hover:bg-indigo-50" title="Download PO PDF">
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
        <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Purchase Order ${detail.po_number || ''}`} size="5xl">
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-slate-400">Vendor</div><div className="font-semibold text-slate-800">{detail.vendor_name || '—'}</div></div>
              <div>
                <div className="text-slate-400">Source</div>
                <div className="font-semibold text-slate-800">{detail.quote_number || (detail.po_type === 'DIRECT_COMPANY' ? 'Direct Company PO' : detail.is_merged ? 'Merged PO' : 'Manual PO')}</div>
                <div className="text-slate-500">{detail.mr_number || ''}</div>
                {detail.quotation_approval_code && <div className="font-mono text-emerald-700">Quote approval: {detail.quotation_approval_code}</div>}
              </div>
              <div>
                <div className="text-slate-400">Status</div>
                <div className="font-semibold text-slate-800">{detail.status === 'PENDING_APPROVAL' ? 'Pending Approval' : detail.status}</div>
                {detail.po_approval_code && <div className="font-mono text-emerald-700">{detail.po_approval_code}</div>}
              </div>
              <div>
                <div className="text-slate-400">Submitted</div>
                <div className="font-semibold text-slate-800">{detail.submitted_by_name || '—'}</div>
                <div className="text-slate-500">{formatDateTime(detail.submitted_for_approval_at)}</div>
              </div>
              <div><div className="text-slate-400">Expected Delivery</div><div className="font-semibold text-slate-800">{formatDate(detail.expected_delivery_date)}</div></div>
              <div><div className="text-slate-400">Customer PO</div><div className="font-semibold text-slate-800">{detail.customer_po_no || '—'}</div></div>
              <div className="md:col-span-2"><div className="text-slate-400">Notes</div><div className="text-slate-700">{detail.notes || '—'}</div></div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleDownloadPDF(detail)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
                <Download className="w-3.5 h-3.5" /> Download PO PDF
              </button>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Items</h3>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="p-2 font-semibold">#</th>
                      <th className="p-2 font-semibold">Item / Drawing</th>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold text-right">Qty</th>
                      <th className="p-2 font-semibold text-right">Rate</th>
                      <th className="p-2 font-semibold text-right">GST %</th>
                      <th className="p-2 font-semibold text-right">Amount</th>
                      <th className="p-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLoading && <tr><td colSpan="8" className="p-4 text-center text-slate-400">Loading…</td></tr>}
                    {detailItems.map((i, idx) => (
                      <tr key={i.id || idx} className="border-t border-slate-50">
                        <td className="p-2 text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-medium text-slate-800">{i.drawing_no || i.item_code || '—'}</td>
                        <td className="p-2 text-slate-600">{i.description || i.material_name || '—'}</td>
                        <td className="p-2 text-right">{Number(i.quantity || 0).toFixed(3)} {i.unit || ''}</td>
                        <td className="p-2 text-right">{formatCurrency(i.unit_rate)}</td>
                        <td className="p-2 text-right">{(Number(i.cgst_percent) || 0) + (Number(i.sgst_percent) || 0) + (Number(i.igst_percent) || 0)}%</td>
                        <td className="p-2 text-right">{formatCurrency(i.amount)}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(i.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end flex-wrap gap-6 mt-2 pr-2">
                <span className="text-slate-500">Subtotal: <b className="text-slate-800">{formatCurrency(subtotal)}</b></span>
                {Number(detail.discount_amount) > 0 && <span className="text-slate-500">Discount: <b className="text-slate-800">{formatCurrency(detail.discount_amount)}</b></span>}
                <span className="text-slate-500">Tax: <b className="text-slate-800">{formatCurrency(taxTotal)}</b></span>
                <span className="text-slate-500">PO Total: <b className="text-indigo-700 text-sm">{formatCurrency(detail.total_amount)}</b></span>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Approval History</h3>
              {(detail.history || []).length === 0 ? (
                <p className="text-slate-400 italic">No history.</p>
              ) : (
                <ol className="space-y-1.5">
                  {detail.history.map(h => (
                    <li key={h.id} className="flex flex-wrap gap-2">
                      <span className={`font-semibold ${h.action === 'APPROVED' ? 'text-emerald-700' : h.action === 'REJECTED' ? 'text-rose-600' : h.action === 'REVISED' ? 'text-orange-600' : 'text-amber-700'}`}>{h.action}</span>
                      <span className="text-slate-500">{h.acted_by_name || '—'} · {formatDateTime(h.acted_at)}</span>
                      {h.total_amount !== null && h.total_amount !== undefined && <span className="text-slate-500">{formatCurrency(h.total_amount)}</span>}
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

export default POApprovals;
