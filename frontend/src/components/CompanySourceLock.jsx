import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

// Shows which Sales Order a procurement / inventory / QC document belongs to and that Sales Order's issuing company.
// Current Sales Orders (Customer PO based) are locked: the company can only change through
// "Request Company Change" → Admin → Approvals → Company Changes.
// Older Sales Orders (previous module) only pre-select their Customer PO company (no lock, no request).
//
// Props: mrId | poId | receiptId | grnId, hostCompanies (Company Master list), onResolved(source|null)
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const isCompanySourceLocked = (source) => Boolean(source && source.found && source.kind === 'ORDER');

const CompanySourceLock = ({ mrId, poId, receiptId, grnId, hostCompanies = [], onResolved, className = '' }) => {
  const [source, setSource] = useState(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (mrId) params.set('mrId', mrId);
    if (poId) params.set('poId', poId);
    if (receiptId) params.set('receiptId', receiptId);
    if (grnId) params.set('grnId', grnId);
    if (![...params.keys()].length) { setSource(null); if (onResolved) onResolved(null); return; }
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/company-change-requests/source?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = res.ok ? await res.json() : null;
      const resolved = data && data.found ? data : null;
      setSource(resolved);
      if (onResolved) onResolved(resolved);
    } catch {
      setSource(null);
      if (onResolved) onResolved(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrId, poId, receiptId, grnId]);

  useEffect(() => { load(); }, [load]);

  if (!source) return null;
  const locked = isCompanySourceLocked(source);
  const st = source.status;
  const canRequest = locked && st && st.locked && !st.pending && !(st.invoices && st.invoices.length);

  const handleRequest = async () => {
    const options = hostCompanies.filter(h => String(h.id) !== String(source.company_id));
    if (!options.length) return errorToast('No other company profile available in Company Master');
    const preview = (h) => h ? `GSTIN: <b>${esc(h.gstin || '—')}</b> · PAN: <b>${esc(h.pan || '—')}</b><br/>${esc(h.company_address || '')}<br/>Bank: ${esc(h.bank_name || '—')} ${esc(h.account_number || '')}` : '';
    const res = await Swal.fire({
      title: 'Request Company Change',
      width: 620,
      html: `<div style="text-align:left;font-size:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-bottom:10px">
          <div><span style="color:#64748b">Sales Order:</span> <b>${esc(source.order_no || '—')}</b></div>
          <div><span style="color:#64748b">Material Request:</span> <b>${esc(source.mr_number || '—')}</b></div>
          <div style="grid-column:span 2"><span style="color:#64748b">Current company:</span> <b>${esc(source.company_name || '—')}</b></div>
        </div>
        <label style="display:block;font-weight:600;margin-bottom:4px">Requested company *</label>
        <select id="csl-company" class="swal2-select" style="width:100%;margin:0 0 6px;font-size:12px">
          ${options.map(h => `<option value="${h.id}">${esc(h.company_name)}${h.status === 'ACTIVE' ? ' (ACTIVE)' : ''}</option>`).join('')}
        </select>
        <div id="csl-preview" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;color:#475569;margin-bottom:10px">${preview(options[0])}</div>
        <label style="display:block;font-weight:600;margin-bottom:4px">Reason for the change *</label>
        <textarea id="csl-reason" class="swal2-textarea" style="width:100%;margin:0;font-size:12px" placeholder="Why should this order be issued under another company?"></textarea>
        <div style="margin-top:8px;color:#64748b;font-size:11px">Sent to Admin for approval. On approval the Sales Order company changes for all linked documents opened afterwards.</div>
      </div>`,
      didOpen: () => {
        const sel = document.getElementById('csl-company');
        sel.addEventListener('change', () => {
          const h = options.find(o => String(o.id) === String(sel.value));
          document.getElementById('csl-preview').innerHTML = preview(h);
        });
      },
      preConfirm: () => {
        const requestedCompanyId = document.getElementById('csl-company').value;
        const reason = document.getElementById('csl-reason').value;
        if (!reason || !reason.trim()) { Swal.showValidationMessage('Please enter the reason'); return false; }
        return { requestedCompanyId, reason: reason.trim() };
      },
      showCancelButton: true,
      confirmButtonText: 'Send for Admin Approval',
      confirmButtonColor: '#4f46e5'
    });
    if (!res.isConfirmed) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/company-change-requests`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: source.order_id, ...res.value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to submit request');
      successToast('Company change request sent for Admin approval');
      load();
    } catch (err) {
      errorToast(err.message);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded bg-indigo-50/60 border border-indigo-100 text-slate-600 ${className}`}>
      <div className="space-y-0.5">
        <div>
          {locked ? '🔒 ' : ''}Company from Sales Order <b>{source.order_no || '—'}</b>
          {source.mr_number ? <> (Material Request {source.mr_number})</> : null}
          {source.customer_po_number ? <> · Customer PO {source.customer_po_number}</> : null}: <b className="text-indigo-700">{source.company_name || '—'}</b>
        </div>
        {st?.pending && <div className="text-amber-700">⏳ Change to <b>{st.pending.requested_company_name}</b> pending Admin approval</div>}
        {!st?.pending && st?.latest?.status === 'REJECTED' && <div className="text-rose-600">Last request rejected: “{st.latest.decision_remarks}”</div>}
        {st?.invoices?.length > 0 && <div className="text-slate-500">Invoice {st.invoices.map(i => i.invoice_no).join(', ')} exists — company cannot be changed.</div>}
        {!locked && <div className="text-slate-400">Older Sales Order — company taken from its Customer PO.</div>}
      </div>
      {locked && (
        <button
          type="button"
          onClick={handleRequest}
          disabled={!canRequest}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canRequest ? (st?.pending ? 'A company change is already pending Admin approval' : st?.invoices?.length ? 'An invoice exists for the Sales Order' : 'Company change applies to Customer PO based Sales Orders') : 'Ask Admin to change the Sales Order company'}
        >
          Request Company Change
        </button>
      )}
    </div>
  );
};

export default CompanySourceLock;
