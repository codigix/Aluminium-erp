import React, { useState, useEffect, useMemo } from 'react';
import { FileMinus, RefreshCw, Printer, XCircle, History, Package, CheckSquare, Square } from 'lucide-react';
import { SearchableSelect } from './ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import { formatDimensions, isWeightBasedItem } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value) => {
  const n = parseFloat(value);
  if (isNaN(n)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatNum = (n) => String(Math.round((parseFloat(n) || 0) * 1000) / 1000);

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// Same display rules as Purchase Order Detail
const getDesignQty = (it) => {
  const design = parseFloat(it.design_qty);
  const planned = parseFloat(it.planned_qty);
  if (design > 0) return design;
  if (planned > 0) return planned;
  return parseFloat(it.quantity) || 0;
};

const getDrawingNo = (it) => {
  const dwg = (it.drawing_no || '').trim();
  const isCode = /^(RM-|OTH-|SFG-|FG-|GEN-|CAT-)/i.test(dwg);
  return dwg && dwg !== '—' && dwg !== '_' && !isCode ? dwg : '';
};

const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken')}` });

const REASONS = [
  { id: 'PURCHASE_RETURN', label: 'Purchase Return', ledger: 'Purchase Returns' },
  { id: 'SHORTAGE', label: 'Short Supply / Shortage', ledger: 'Purchase Returns' },
  { id: 'QUALITY_REJECTION', label: 'Quality Rejection', ledger: 'Purchase Returns' },
  { id: 'DAMAGE', label: 'Damaged in Transit', ledger: 'Purchase Returns' },
  { id: 'RATE_DIFFERENCE', label: 'Rate Difference', ledger: 'Purchase Accounts' },
  { id: 'OTHER', label: 'Other Adjustment', ledger: 'Purchase Accounts' }
];

const LEDGERS = ['Purchase Returns', 'Purchase Accounts', 'Discount Received', 'Freight Inward', 'Indirect Incomes'];

const GST_RATES = ['0', '5', '12', '18', '28'];

const ON_ACCOUNT = 'ON_ACCOUNT';

// Max qty that can be debited for an item under the chosen reason
const getLimit = (row, reason) => (reason === 'SHORTAGE' ? row.shortageClaimable : row.returnable);

const inputClass = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';
const labelClass = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1';

const Field = ({ label, required, children, hint }) => (
  <div>
    <label className={labelClass}>{label}{required && <span className="text-rose-500"> *</span>}</label>
    {children}
    {hint && <p className="text-[11px] mt-1 text-slate-400">{hint}</p>}
  </div>
);

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  reference: '',
  reason: 'PURCHASE_RETURN',
  ledger: 'Purchase Returns',
  amount: '',
  gstType: 'INTRA',
  gstRate: '18',
  narration: ''
});

const DebitNoteEntry = ({ initialVendorId = '', onPosted }) => {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState(initialVendorId ? String(initialVendorId) : '');
  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [itemRows, setItemRows] = useState([]);
  const [nextNo, setNextNo] = useState('');
  const [posting, setPosting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
    fetchNextNo();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (initialVendorId) setVendorId(String(initialVendorId));
  }, [initialVendorId]);

  useEffect(() => {
    setForm(f => ({ ...f, reference: '' }));
    if (vendorId) fetchSources(vendorId);
    else setSources([]);
  }, [vendorId]);

  const selectedSource = useMemo(
    () => sources.find(s => String(s.po_id) === String(form.reference)) || null,
    [sources, form.reference]
  );

  // Load the selected PO's items into the item panel
  useEffect(() => {
    const items = selectedSource?.items || [];
    setItemRows(items.map(it => ({
      poItemId: it.id,
      name: (it.material_name || it.description || it.item_code || `Item #${it.id}`).trim(),
      code: it.item_code || '',
      drawingNo: getDrawingNo(it),
      dimension: formatDimensions(it) || '—',
      unit: it.unit || 'NOS',
      designUnit: (it.unit || it.uom || 'NOS').trim().toUpperCase(),
      // Weight-billed items: quantity is the weight (Kg), design qty is the piece count
      isWeight: isWeightBasedItem(it),
      designQty: getDesignQty(it),
      billedQty: parseFloat(it.quantity) || 0,
      returnable: parseFloat(it.returnable_qty) || 0,
      shortageClaimable: parseFloat(it.shortage_claimable_qty) || 0,
      rate: parseFloat(it.unit_rate) || 0,
      selected: false,
      qty: ''
    })));
    const gst = items.length ? (parseFloat(items[0].cgst_percent) || 0) + (parseFloat(items[0].sgst_percent) || 0) : 0;
    if (GST_RATES.includes(String(gst)) && gst > 0) setForm(f => ({ ...f, gstRate: String(gst) }));
  }, [selectedSource]);

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_BASE}/vendors`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setVendors(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchNextNo = async () => {
    try {
      const res = await fetch(`${API_BASE}/payments/debit-notes/next-voucher-no`, { headers: authHeaders() });
      if (res.ok) setNextNo((await res.json()).voucherNo || '');
    } catch (err) {
      console.error('Error fetching next debit note no:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/payments/debit-notes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching debit notes:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSources = async (vId) => {
    try {
      setSourcesLoading(true);
      const res = await fetch(`${API_BASE}/payments/debit-notes/sources?vendorId=${vId}`, { headers: authHeaders() });
      const data = res.ok ? await res.json() : [];
      setSources(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching supplier bills:', err);
      setSources([]);
    } finally {
      setSourcesLoading(false);
    }
  };

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleReasonChange = (reasonId) => {
    const r = REASONS.find(x => x.id === reasonId);
    setForm(f => ({ ...f, reason: reasonId, ledger: r ? r.ledger : f.ledger }));
    // Keep ticked quantities within the new reason's limit
    setItemRows(rows => rows.map(row => {
      if (!row.selected) return row;
      const limit = getLimit(row, reasonId);
      return limit > 0 ? { ...row, qty: formatNum(Math.min(parseFloat(row.qty) || limit, limit)) } : { ...row, selected: false, qty: '' };
    }));
  };

  const toggleItem = (poItemId) => {
    setItemRows(rows => rows.map(row => {
      if (row.poItemId !== poItemId) return row;
      if (row.selected) return { ...row, selected: false, qty: '' };
      const limit = getLimit(row, form.reason);
      return limit > 0 ? { ...row, selected: true, qty: formatNum(limit) } : row;
    }));
  };

  const setItemQty = (poItemId, value) => {
    setItemRows(rows => rows.map(row => (row.poItemId === poItemId ? { ...row, qty: value, selected: parseFloat(value) > 0 } : row)));
  };

  const selectAll = () => setItemRows(rows => rows.map(row => {
    const limit = getLimit(row, form.reason);
    return limit > 0 ? { ...row, selected: true, qty: formatNum(limit) } : row;
  }));

  const clearItems = () => setItemRows(rows => rows.map(row => ({ ...row, selected: false, qty: '' })));

  const vendorOptions = useMemo(() => vendors.map(v => ({
    value: String(v.id),
    label: v.vendor_name || 'Unnamed Vendor',
    sublabel: [v.vendor_code, v.gstin ? `GST: ${v.gstin}` : ''].filter(Boolean).join(' • ')
  })), [vendors]);

  const referenceOptions = useMemo(() => [
    ...sources.map(src => ({
      value: String(src.po_id),
      label: src.bill && src.bill.display_invoice_no !== src.po_number
        ? `${src.bill.display_invoice_no} (${src.po_number})`
        : src.po_number,
      sublabel: `${src.bill ? 'Bill' : 'PO · not billed'} · ${formatDate(src.po_date)} · ${src.items.length} item${src.items.length === 1 ? '' : 's'}${src.bill ? ` · Outstanding ${formatCurrency(src.bill.outstanding)}` : ''}`
    })),
    { value: ON_ACCOUNT, label: 'On Account (no bill)', sublabel: 'Reduce supplier balance without a specific bill' }
  ], [sources]);

  const selectedVendor = vendors.find(v => String(v.id) === String(vendorId)) || null;

  // Same supplier registered twice (same GSTIN) – common reason for "no bills found"
  const duplicateVendor = useMemo(() => {
    if (!selectedVendor?.gstin) return null;
    return vendors.find(v => String(v.id) !== String(selectedVendor.id) && v.gstin === selectedVendor.gstin) || null;
  }, [vendors, selectedVendor]);

  const selectedItems = itemRows.filter(r => r.selected && parseFloat(r.qty) > 0);
  const itemMode = selectedItems.length > 0;

  // ── Debit calculation (same rules as the server: GST per line, then summed) ──
  const calc = useMemo(() => {
    const rate = form.gstType === 'NONE' ? 0 : (parseFloat(form.gstRate) || 0);
    const lines = itemMode
      ? selectedItems.map(r => round2((parseFloat(r.qty) || 0) * r.rate))
      : [round2(form.amount)];
    const taxable = round2(lines.reduce((s, t) => s + t, 0));
    const gst = round2(lines.reduce((s, t) => s + round2(t * rate / 100), 0));
    const cgst = form.gstType === 'INTRA' ? round2(gst / 2) : 0;
    const sgst = form.gstType === 'INTRA' ? round2(gst - cgst) : 0;
    const igst = form.gstType === 'INTER' ? gst : 0;
    return { taxable, rate, cgst, sgst, igst, total: round2(taxable + gst) };
  }, [itemMode, selectedItems, form.amount, form.gstType, form.gstRate]);

  const qtyErrors = selectedItems
    .filter(r => parseFloat(r.qty) > getLimit(r, form.reason) + 0.0005)
    .map(r => `${r.name}: max ${formatNum(getLimit(r, form.reason))} ${r.unit}`);

  const bill = selectedSource?.bill || null;
  const billOutstanding = bill ? (parseFloat(bill.outstanding) || 0) : null;
  const billDebitable = bill ? (parseFloat(bill.bill_amount) || 0) - (parseFloat(bill.debit_note_amount) || 0) : null;
  const exceedsBill = bill && calc.total > billDebitable + 0.01;
  const afterDebit = bill ? billOutstanding - calc.total : null;

  const reasonLabel = REASONS.find(r => r.id === form.reason)?.label || 'Debit Note';
  const refLabel = selectedSource ? (bill?.display_invoice_no || selectedSource.po_number) : null;
  const defaultNarration = `Being ${reasonLabel.toLowerCase()} debit note issued to ${selectedVendor?.vendor_name || 'supplier'}${refLabel ? ` against ${refLabel}` : ''}${itemMode ? ` (${selectedItems.map(r => `${r.name} ${formatNum(r.qty)} ${r.unit}`).join(', ')})` : ''}.`;

  const handleReset = () => {
    setForm(f => ({ ...emptyForm(), reference: f.reference }));
    clearItems();
  };

  const handlePost = async () => {
    if (!vendorId) return errorToast('Select a supplier');
    if (!form.reference) return errorToast('Select the purchase bill / PO, or On Account');
    if (calc.taxable <= 0) return errorToast(selectedSource ? 'Select items to return or enter a debit amount' : 'Enter a debit amount greater than 0');
    if (qtyErrors.length) return errorToast(`Qty exceeds limit – ${qtyErrors[0]}`);
    if (exceedsBill) return errorToast(`Debit note ${formatCurrency(calc.total)} exceeds bill value available for debit ${formatCurrency(billDebitable)}`);
    try {
      setPosting(true);
      const res = await fetch(`${API_BASE}/payments/debit-notes`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          vendorId,
          poId: selectedSource ? selectedSource.po_id : null,
          vendorInvoiceId: bill ? bill.id : null,
          reason: form.reason,
          entryMode: itemMode ? 'ITEM' : 'LEDGER',
          affectedLedger: form.ledger,
          gstType: form.gstType,
          items: itemMode
            ? selectedItems.map(r => ({ poItemId: r.poItemId, quantity: parseFloat(r.qty), rate: r.rate, gstPercent: calc.rate }))
            : [],
          ledgerAmount: itemMode ? null : calc.taxable,
          ledgerGstPercent: itemMode ? null : calc.rate,
          narration: form.narration.trim() || defaultNarration
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to post debit note');
      successToast(`Debit Note ${data.data.voucherNo} posted for ${formatCurrency(data.data.totalAmount)}`);
      setForm(emptyForm());
      fetchNextNo();
      fetchHistory();
      fetchSources(vendorId);
      if (onPosted) onPosted(data.data);
    } catch (err) {
      errorToast(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleCancelNote = async (dn) => {
    if (!window.confirm(`Cancel Debit Note ${dn.voucher_no}? The supplier outstanding will be restored.`)) return;
    try {
      const res = await fetch(`${API_BASE}/payments/debit-notes/${dn.id}/cancel`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to cancel debit note');
      successToast(`Debit Note ${dn.voucher_no} cancelled`);
      fetchHistory();
      if (vendorId) fetchSources(vendorId);
    } catch (err) {
      errorToast(err.message);
    }
  };

  const handlePrint = (dn) => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    const itemRowsHtml = (dn.items || []).map(it => `<tr><td>${it.description || ''}${it.item_code ? ` <small>(${it.item_code})</small>` : ''}</td>
      <td class="r">${it.po_item_id ? `${formatNum(it.quantity)} ${it.unit || ''}` : ''}</td><td class="r">${formatCurrency(it.taxable_amount)}</td></tr>`).join('');
    const gstRows = [
      parseFloat(dn.cgst_amount) > 0 ? `<tr><td colspan="2">CGST</td><td class="r">${formatCurrency(dn.cgst_amount)}</td></tr>` : '',
      parseFloat(dn.sgst_amount) > 0 ? `<tr><td colspan="2">SGST</td><td class="r">${formatCurrency(dn.sgst_amount)}</td></tr>` : '',
      parseFloat(dn.igst_amount) > 0 ? `<tr><td colspan="2">IGST</td><td class="r">${formatCurrency(dn.igst_amount)}</td></tr>` : ''
    ].join('');
    w.document.write(`<!doctype html><html><head><title>${dn.voucher_no}</title><style>
      body{font-family:Arial,sans-serif;font-size:13px;color:#0f172a;padding:28px}h1{font-size:20px;margin:0}
      table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border:1px solid #cbd5e1;padding:7px;text-align:left}
      th{background:#f1f5f9}.r{text-align:right}.muted{color:#64748b}.b td{font-weight:bold}</style></head><body>
      <h1>DEBIT NOTE</h1><p class="muted">${dn.reason_label}${dn.status === 'CANCELLED' ? ' — CANCELLED' : ''}</p>
      <p><b>No:</b> ${dn.voucher_no} &nbsp; <b>Date:</b> ${formatDate(dn.voucher_date)}<br/>
      <b>To:</b> ${dn.vendor_name}${dn.vendor_gstin ? ` (GSTIN ${dn.vendor_gstin})` : ''}<br/>
      <b>Against:</b> ${dn.reference_invoice_no || 'On Account'} &nbsp; <b>Ledger:</b> ${dn.affected_ledger}</p>
      <table><thead><tr><th>Particulars</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>
      ${itemRowsHtml}${gstRows}
      <tr class="b"><td colspan="2">Total Debit</td><td class="r">${formatCurrency(dn.total_amount)}</td></tr></tbody></table>
      <p><b>Narration:</b> ${dn.narration || ''}</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const displayedHistory = useMemo(
    () => (vendorId ? history.filter(dn => String(dn.vendor_id) === String(vendorId)) : history),
    [history, vendorId]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* ── Left: Entry Form ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileMinus className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-800">Debit Note Entry</h3>
            </div>
            <span className="font-mono text-sm font-bold text-rose-700">{nextNo || 'DN-—'}</span>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Voucher No.">
              <input type="text" value={nextNo} readOnly className={`${inputClass} bg-slate-50 font-mono text-slate-600`} />
            </Field>
            <Field label="Date" required>
              <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className={inputClass} />
            </Field>

            <div className="md:col-span-2">
              <Field label="Supplier" required
                hint={duplicateVendor && !sourcesLoading && sources.length === 0
                  ? <span className="text-amber-700">No bills under this record. A duplicate supplier ({duplicateVendor.vendor_code}) has the same GSTIN — <button type="button" className="underline font-semibold cursor-pointer" onClick={() => setVendorId(String(duplicateVendor.id))}>switch</button>.</span>
                  : null}>
                <SearchableSelect
                  options={vendorOptions}
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  placeholder="Select supplier"
                  labelField="label"
                  valueField="value"
                  subLabelField="sublabel"
                  allowCustom={false}
                  showSearchIcon={true}
                  className="w-full text-sm py-2 px-3 border-slate-300 rounded-lg"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Against Purchase Bill / PO" required
                hint={bill
                  ? <span className={exceedsBill ? 'text-rose-600 font-semibold' : ''}>
                      Bill outstanding {formatCurrency(billOutstanding)} → after debit {formatCurrency(afterDebit)}
                      {!exceedsBill && afterDebit < -0.01 ? ' (recoverable from supplier)' : ''}
                      {exceedsBill ? ` — exceeds bill value available for debit ${formatCurrency(billDebitable)}` : ''}
                    </span>
                  : (selectedSource ? 'Not billed yet — will be deducted when the bill is booked' : null)}>
                <SearchableSelect
                  options={referenceOptions}
                  value={form.reference}
                  onChange={(e) => setField('reference', e.target.value)}
                  placeholder={!vendorId ? 'Select a supplier first' : sourcesLoading ? 'Loading bills…' : 'Select PO or Bill Number'}
                  labelField="label"
                  valueField="value"
                  subLabelField="sublabel"
                  allowCustom={false}
                  disabled={!vendorId}
                  className="w-full text-sm py-2 px-3 border-slate-300 rounded-lg"
                />
              </Field>
            </div>

            <Field label="Reason">
              <select value={form.reason} onChange={(e) => handleReasonChange(e.target.value)} className={inputClass}>
                {REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Ledger Account" required>
              <select value={form.ledger} onChange={(e) => setField('ledger', e.target.value)} className={inputClass}>
                {LEDGERS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Narration">
                <textarea rows={2} value={form.narration} onChange={(e) => setField('narration', e.target.value)}
                  placeholder={defaultNarration} className={`${inputClass} resize-none`} />
              </Field>
            </div>
          </div>

          {/* ── Calculation + actions ── */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 rounded-b-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Debit Note</div>
                <div className="text-2xl font-bold font-mono text-rose-700">{formatCurrency(calc.total)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleReset}
                  className="px-4 py-2.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={handlePost} disabled={posting}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50">
                  {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileMinus className="w-4 h-4" />}
                  {posting ? 'Posting…' : 'Post Debit Note'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Items of the selected PO ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden xl:sticky xl:top-4">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-800 truncate">
                {selectedSource ? `Items in ${refLabel}` : 'PO Items'}
              </h3>
              {itemRows.length > 0 && (
                <span className="text-[11px] text-slate-500 shrink-0">{selectedItems.length}/{itemRows.length} selected</span>
              )}
            </div>
            {itemRows.length > 0 && (
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={selectAll} className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer">Select all</button>
                <button type="button" onClick={clearItems} className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer">Clear</button>
              </div>
            )}
          </div>

          {itemRows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Package className="w-8 h-8 text-slate-200 mx-auto" />
              <p className="text-sm font-semibold text-slate-500 mt-2">
                {form.reference === ON_ACCOUNT ? 'On Account debit — no items' : 'Select a Purchase Bill / PO'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {form.reference === ON_ACCOUNT ? 'Enter the debit amount in the form.' : 'Its items appear here. Tick only the items being returned.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[10.5px] uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8" />
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-left">Dimension</th>
                      <th className="px-2 py-2 text-right">Design Qty</th>
                      <th className="px-2 py-2 text-right">Weight</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemRows.map(r => {
                      const limit = getLimit(r, form.reason);
                      const qty = parseFloat(r.qty) || 0;
                      const over = qty > limit + 0.0005;
                      const unavailable = limit <= 0 && !r.selected;
                      const amount = r.selected ? qty * r.rate : r.billedQty * r.rate;
                      return (
                        <tr key={r.poItemId}
                          onClick={(e) => { if (!unavailable && e.target.tagName !== 'INPUT') toggleItem(r.poItemId); }}
                          className={`${unavailable ? 'opacity-45' : 'cursor-pointer hover:bg-slate-50'} ${r.selected ? 'bg-rose-50/60' : ''}`}>
                          <td className="px-3 py-2.5 align-top">
                            {r.selected
                              ? <CheckSquare className="w-4 h-4 text-rose-600" />
                              : <Square className="w-4 h-4 text-slate-300" />}
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="font-semibold text-slate-800">{r.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{r.code}</div>
                            {r.drawingNo && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Dwg: <span className="font-semibold text-slate-700">{r.drawingNo}</span></div>
                            )}
                          </td>
                          <td className="px-2 py-2.5 align-top text-slate-600 font-mono text-[11px] whitespace-nowrap">{r.dimension}</td>
                          {(() => {
                            // The billed quantity is editable: weight (Kg) for weight-billed items, design qty (Nos) otherwise
                            const qtyCell = (
                              <>
                                {r.selected ? (
                                  <input type="number" min="0" step="any" value={r.qty}
                                    onChange={(e) => setItemQty(r.poItemId, e.target.value)}
                                    className={`w-20 text-right font-mono border rounded-md px-1.5 py-1 focus:outline-none ${over ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 focus:border-blue-500'}`} />
                                ) : (
                                  <span className="font-mono font-semibold text-slate-800">{formatNum(r.billedQty)}</span>
                                )}
                                <div className={`text-[10px] mt-0.5 ${over ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                                  {r.selected ? `of ${formatNum(limit)} ${r.unit}` : r.unit}{unavailable ? ' · fully returned' : ''}
                                </div>
                              </>
                            );
                            const returnPcs = r.selected && r.billedQty > 0 && r.designQty > 0
                              ? Math.round((r.designQty * qty / r.billedQty) * 100) / 100
                              : null;
                            return r.isWeight ? (
                              <>
                                <td className="px-2 py-2.5 align-top text-right whitespace-nowrap">
                                  {r.designQty > 0 ? (
                                    <>
                                      <span className="font-mono font-semibold text-slate-800">{formatNum(r.designQty)}</span>
                                      <span className="text-[10px] text-slate-400 ml-1">{r.designUnit}</span>
                                      {returnPcs !== null && <div className="text-[10px] mt-0.5 text-rose-500">return {formatNum(returnPcs)}</div>}
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-2 py-2.5 align-top text-right whitespace-nowrap">{qtyCell}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-2.5 align-top text-right whitespace-nowrap">{qtyCell}</td>
                                <td className="px-2 py-2.5 align-top text-right text-slate-300">—</td>
                              </>
                            );
                          })()}
                          <td className="px-3 py-2.5 align-top text-right">
                            <div className={`font-mono font-semibold ${r.selected ? 'text-rose-700' : 'text-slate-700'}`}>{formatCurrency(amount)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@ {formatCurrency(r.rate)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!itemMode && (
                <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">Tick the items being returned</div>
              )}
            </>
          )}

          {/* ── Debit amount & GST ── */}
          <div className="border-t border-slate-200 px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
            <div className="sm:col-span-2">
              <Field label="Debit Amount (₹, before GST)" required
                hint={itemMode ? `Auto-calculated from ${selectedItems.length} selected item${selectedItems.length === 1 ? '' : 's'}` : (selectedSource ? 'Tick items above, or enter an amount' : null)}>
                <input type="number" min="0" step="0.01"
                  value={itemMode ? calc.taxable.toFixed(2) : form.amount}
                  readOnly={itemMode}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} font-mono font-semibold ${itemMode ? 'bg-rose-50 border-rose-200 text-rose-800' : ''}`} />
              </Field>
            </div>
            <Field label="GST Rate">
              <select value={form.gstRate} onChange={(e) => setField('gstRate', e.target.value)} disabled={form.gstType === 'NONE'}
                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
            <div className="sm:col-span-3">
              <Field label="GST">
                <div className="grid grid-cols-3 rounded-lg border border-slate-300 overflow-hidden">
                  {[['INTRA', 'CGST + SGST'], ['INTER', 'IGST'], ['NONE', 'None']].map(([id, label], i) => (
                    <button key={id} type="button" onClick={() => setField('gstType', id)}
                      className={`px-3 py-2 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${i > 0 ? 'border-l border-slate-300' : ''} ${form.gstType === id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* ── GST summary ── */}
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex justify-end">
            <table className="text-sm w-full max-w-xs">
              <tbody>
                <tr>
                  <td className="py-1 text-slate-600">Subtotal:</td>
                  <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(calc.taxable)}</td>
                </tr>
                {form.gstType === 'INTRA' && (
                  <>
                    <tr>
                      <td className="py-1 text-slate-600">CGST ({(calc.rate / 2).toFixed(2)}%):</td>
                      <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(calc.cgst)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-600">SGST ({(calc.rate / 2).toFixed(2)}%):</td>
                      <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(calc.sgst)}</td>
                    </tr>
                  </>
                )}
                {form.gstType === 'INTER' && (
                  <tr>
                    <td className="py-1 text-slate-600">IGST ({calc.rate.toFixed(2)}%):</td>
                    <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(calc.igst)}</td>
                  </tr>
                )}
                <tr className="border-t border-slate-300">
                  <td className="pt-2 font-bold text-slate-900">GRAND TOTAL:</td>
                  <td className="pt-2 text-right text-lg font-bold text-rose-700">{formatCurrency(calc.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Debit Note History ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Debit Note History {selectedVendor ? `· ${selectedVendor.vendor_name}` : ''} ({displayedHistory.length})
            </h3>
          </div>
          <button type="button" onClick={fetchHistory} className="p-1.5 rounded-md hover:bg-slate-100 cursor-pointer" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${historyLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10.5px] uppercase">
              <tr>
                <th className="px-3 py-2">Voucher No.</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Reference Bill</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedHistory.map(dn => {
                const cancelled = dn.status === 'CANCELLED';
                return (
                  <tr key={dn.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-mono font-bold text-rose-700 whitespace-nowrap">{dn.voucher_no}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(dn.voucher_date)}</td>
                    <td className="px-3 py-2 text-slate-800">{dn.vendor_name}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{dn.reference_invoice_no || 'On Account'}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${cancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>{formatCurrency(dn.total_amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cancelled ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {cancelled ? 'Cancelled' : 'Posted'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button type="button" onClick={() => handlePrint(dn)} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {!cancelled && (
                          <button type="button" onClick={() => handleCancelNote(dn)} className="p-1 rounded hover:bg-rose-50 text-rose-500 cursor-pointer" title="Cancel debit note">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedHistory.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400 italic">
                    {historyLoading ? 'Loading…' : 'No debit notes recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DebitNoteEntry;
