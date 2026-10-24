import React, { useState, useEffect, useMemo } from 'react';
import { FilePlus, RefreshCw, Printer, XCircle, History, Package, CheckSquare, Square, Download, X } from 'lucide-react';
import { SearchableSelect } from './ui.jsx';
import { errorToast, successToast } from '../utils/toast';

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

const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken')}` });

const REASONS = [
  { id: 'SALES_RETURN', label: 'Sales Return', ledger: 'Sales Returns' },
  { id: 'QUALITY_REJECTION', label: 'Quality Rejection by Customer', ledger: 'Sales Returns' },
  { id: 'SHORT_SUPPLY', label: 'Short Supply', ledger: 'Sales Returns' },
  { id: 'RATE_DIFFERENCE', label: 'Rate Difference', ledger: 'Sales Accounts' },
  { id: 'DISCOUNT', label: 'Discount / Rebate', ledger: 'Discount Allowed' },
  { id: 'OTHER', label: 'Other Adjustment', ledger: 'Sales Accounts' }
];

const LEDGERS = ['Sales Returns', 'Sales Accounts', 'Discount Allowed', 'Indirect Expenses'];

const GST_RATES = ['0', '5', '12', '18', '28'];

const ON_ACCOUNT = 'ON_ACCOUNT';

// Same copy set as the Sales Invoice PDF
const COPY_TYPES = [
  { value: 'Original for Recipient', description: 'For recipient / customer' },
  { value: 'Duplicate for Transporter', description: 'To accompany the goods during transit' },
  { value: 'Triplicate for Supplier', description: 'For supplier internal records & audit' },
  { value: 'Extra Copy', description: 'Extra copy for administrative or filing use' },
  { value: 'all', label: 'Download All Copies (Single PDF)', description: 'Complete set of 4 copies in 1 single PDF file' }
];

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
  reason: 'SALES_RETURN',
  ledger: 'Sales Returns',
  amount: '',
  gstType: 'INTRA',
  gstRate: '18',
  narration: ''
});

const CreditNoteEntry = ({ initialCustomerId = '', onPosted }) => {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ? String(initialCustomerId) : '');
  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [itemRows, setItemRows] = useState([]);
  const [nextNo, setNextNo] = useState('');
  const [posting, setPosting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [copyModalNote, setCopyModalNote] = useState(null);
  const [selectedCopy, setSelectedCopy] = useState(COPY_TYPES[0].value);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    fetchBankAccounts();
    fetchCustomers();
    fetchNextNo();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (initialCustomerId) setCustomerId(String(initialCustomerId));
  }, [initialCustomerId]);

  useEffect(() => {
    setForm(f => ({ ...f, reference: '' }));
    if (customerId) fetchSources(customerId);
    else setSources([]);
  }, [customerId]);

  const selectedInvoice = useMemo(
    () => sources.find(s => String(s.id) === String(form.reference)) || null,
    [sources, form.reference]
  );

  // Load the selected invoice's drawings into the item panel and take GST from the invoice
  useEffect(() => {
    const items = selectedInvoice?.items || [];
    setItemRows(items.map(it => ({
      invoiceItemId: it.id,
      drawingNo: (it.drawing_no || it.item_code || '').trim(),
      name: (it.description || '').trim() || '—',
      unit: it.uom || 'Nos',
      invoiceQty: parseFloat(it.invoice_qty) || 0,
      returnable: parseFloat(it.returnable_qty) || 0,
      rate: parseFloat(it.rate) || 0,
      selected: false,
      qty: ''
    })));
    if (selectedInvoice) {
      const igst = parseFloat(selectedInvoice.igst_rate) || 0;
      const intra = (parseFloat(selectedInvoice.cgst_rate) || 0) + (parseFloat(selectedInvoice.sgst_rate) || 0);
      if (igst > 0) setForm(f => ({ ...f, gstType: 'INTER', gstRate: GST_RATES.includes(String(igst)) ? String(igst) : f.gstRate }));
      else if (intra > 0) setForm(f => ({ ...f, gstType: 'INTRA', gstRate: GST_RATES.includes(String(intra)) ? String(intra) : f.gstRate }));
    }
  }, [selectedInvoice]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/companies`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/bank-accounts`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        setBankAccounts(list.filter(b => b.is_active !== false && b.is_active !== 0));
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    }
  };

  const fetchNextNo = async () => {
    try {
      const res = await fetch(`${API_BASE}/customer-payments/credit-notes/next-voucher-no`, { headers: authHeaders() });
      if (res.ok) setNextNo((await res.json()).voucherNo || '');
    } catch (err) {
      console.error('Error fetching next credit note no:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/customer-payments/credit-notes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching credit notes:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSources = async (cId) => {
    try {
      setSourcesLoading(true);
      const res = await fetch(`${API_BASE}/customer-payments/credit-notes/sources?customerId=${cId}`, { headers: authHeaders() });
      const data = res.ok ? await res.json() : [];
      setSources(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching customer invoices:', err);
      setSources([]);
    } finally {
      setSourcesLoading(false);
    }
  };

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleReasonChange = (reasonId) => {
    const r = REASONS.find(x => x.id === reasonId);
    setForm(f => ({ ...f, reason: reasonId, ledger: r ? r.ledger : f.ledger }));
  };

  const toggleItem = (id) => {
    setItemRows(rows => rows.map(row => {
      if (row.invoiceItemId !== id) return row;
      if (row.selected) return { ...row, selected: false, qty: '' };
      return row.returnable > 0 ? { ...row, selected: true, qty: formatNum(row.returnable) } : row;
    }));
  };

  const setItemQty = (id, value) => {
    setItemRows(rows => rows.map(row => (row.invoiceItemId === id ? { ...row, qty: value, selected: parseFloat(value) > 0 } : row)));
  };

  const selectAll = () => setItemRows(rows => rows.map(row => (
    row.returnable > 0 ? { ...row, selected: true, qty: formatNum(row.returnable) } : row
  )));

  const clearItems = () => setItemRows(rows => rows.map(row => ({ ...row, selected: false, qty: '' })));

  const bankOptions = useMemo(() => [
    { value: '', label: 'Not linked to a bank', sublabel: 'No bank account for this credit note' },
    ...bankAccounts.map(b => ({
      value: String(b.id),
      label: b.bank_name || b.account_name || 'Bank Account',
      sublabel: [b.account_number ? `A/c ${b.account_number}` : '', b.branch_name, b.ifsc_code ? `IFSC ${b.ifsc_code}` : ''].filter(Boolean).join(' • ')
    }))
  ], [bankAccounts]);

  const customerOptions = useMemo(() => customers.map(c => ({
    value: String(c.id),
    label: c.company_name || 'Unnamed Customer',
    sublabel: [c.gstin ? `GSTIN: ${c.gstin}` : '', c.city].filter(Boolean).join(' • ')
  })), [customers]);

  const referenceOptions = useMemo(() => [
    ...sources.map(inv => ({
      value: String(inv.id),
      label: inv.invoice_no,
      sublabel: `${formatDate(inv.invoice_date)} · ${inv.items.length} drawing${inv.items.length === 1 ? '' : 's'} · Total ${formatCurrency(inv.total_amount)} · Outstanding ${formatCurrency(inv.outstanding)}`
    })),
    { value: ON_ACCOUNT, label: 'On Account (no invoice)', sublabel: 'Reduce customer balance without a specific invoice' }
  ], [sources]);

  const selectedCustomer = customers.find(c => String(c.id) === String(customerId)) || null;

  const selectedItems = itemRows.filter(r => r.selected && parseFloat(r.qty) > 0);
  const itemMode = selectedItems.length > 0;

  // ── Credit calculation (same rules as the server: GST per line, then summed) ──
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
    .filter(r => parseFloat(r.qty) > r.returnable + 0.0005)
    .map(r => `${r.drawingNo || r.name}: max ${formatNum(r.returnable)} ${r.unit}`);

  const invOutstanding = selectedInvoice ? (parseFloat(selectedInvoice.outstanding) || 0) : null;
  const invCreditable = selectedInvoice ? (parseFloat(selectedInvoice.total_amount) || 0) - (parseFloat(selectedInvoice.credit_note_amount) || 0) : null;
  const exceedsInvoice = selectedInvoice && calc.total > invCreditable + 0.01;
  const afterCredit = selectedInvoice ? invOutstanding - calc.total : null;

  const reasonLabel = REASONS.find(r => r.id === form.reason)?.label || 'Credit Note';
  const refLabel = selectedInvoice ? selectedInvoice.invoice_no : null;
  const defaultNarration = `Being ${reasonLabel.toLowerCase()} credit note issued to ${selectedCustomer?.company_name || 'customer'}${refLabel ? ` against ${refLabel}` : ''}${itemMode ? ` (${selectedItems.map(r => `${r.drawingNo || r.name} ${formatNum(r.qty)} ${r.unit}`).join(', ')})` : ''}.`;

  const handleReset = () => {
    setForm(f => ({ ...emptyForm(), reference: f.reference }));
    clearItems();
  };

  const handlePost = async () => {
    if (!customerId) return errorToast('Select a customer');
    if (!form.reference) return errorToast('Select the sales invoice, or On Account');
    if (calc.taxable <= 0) return errorToast(selectedInvoice ? 'Select drawings to return or enter a credit amount' : 'Enter a credit amount greater than 0');
    if (qtyErrors.length) return errorToast(`Qty exceeds limit – ${qtyErrors[0]}`);
    if (exceedsInvoice) return errorToast(`Credit note ${formatCurrency(calc.total)} exceeds invoice value available for credit ${formatCurrency(invCreditable)}`);
    try {
      setPosting(true);
      const res = await fetch(`${API_BASE}/customer-payments/credit-notes`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          customerId,
          salesInvoiceId: selectedInvoice ? selectedInvoice.id : null,
          reason: form.reason,
          entryMode: itemMode ? 'ITEM' : 'LEDGER',
          affectedLedger: form.ledger,
          gstType: form.gstType,
          items: itemMode
            ? selectedItems.map(r => ({ invoiceItemId: r.invoiceItemId, quantity: parseFloat(r.qty), rate: r.rate, gstPercent: calc.rate }))
            : [],
          ledgerAmount: itemMode ? null : calc.taxable,
          ledgerGstPercent: itemMode ? null : calc.rate,
          narration: form.narration.trim() || defaultNarration,
          bankAccountId: bankAccountId || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to post credit note');
      successToast(`Credit Note ${data.data.voucherNo} posted for ${formatCurrency(data.data.totalAmount)}`);
      setForm(emptyForm());
      fetchNextNo();
      fetchHistory();
      fetchSources(customerId);
      if (onPosted) onPosted(data.data);
    } catch (err) {
      errorToast(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleCancelNote = async (cn) => {
    if (!window.confirm(`Cancel Credit Note ${cn.voucher_no}? The customer outstanding will be restored.`)) return;
    try {
      const res = await fetch(`${API_BASE}/customer-payments/credit-notes/${cn.id}/cancel`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to cancel credit note');
      successToast(`Credit Note ${cn.voucher_no} cancelled`);
      fetchHistory();
      if (customerId) fetchSources(customerId);
    } catch (err) {
      errorToast(err.message);
    }
  };

  // Fetch the credit note PDF (same layout as the tax invoice) for the chosen copy
  const fetchCreditNotePdf = async (cn, copyType) => {
    const res = await fetch(`${API_BASE}/customer-payments/credit-notes/${cn.id}/pdf?copyType=${encodeURIComponent(copyType)}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to generate Credit Note PDF');
    return window.URL.createObjectURL(new Blob([await res.blob()], { type: 'application/pdf' }));
  };

  const handlePrint = async (cn, copyType) => {
    setCopyModalNote(null);
    try {
      setPdfBusy(true);
      const blobUrl = await fetchCreditNotePdf(cn, copyType);
      // Print from a hidden iframe once the PDF has loaded. Printing a new tab fires before
      // the PDF viewer (or a PDF extension such as Acrobat) renders it and gives a blank page.
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          // Viewer blocked printing from the frame – open the PDF so it can be printed from there
          console.error(e);
          window.open(blobUrl, '_blank');
        }
      }, 500);
      setTimeout(() => {
        iframe.remove();
        window.URL.revokeObjectURL(blobUrl);
      }, 120000);
    } catch (err) {
      errorToast(err.message || 'Unable to print Credit Note PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownload = async (cn, copyType) => {
    setCopyModalNote(null);
    try {
      setPdfBusy(true);
      const blobUrl = await fetchCreditNotePdf(cn, copyType);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanNo = (cn.voucher_no || `CreditNote-${cn.id}`).replace(/[/\\?%*:|"<>]/g, '-');
      const cleanCopy = copyType === 'all' ? 'All_Copies' : copyType.replace(/\s+/g, '_');
      link.download = `${cleanNo}_${cleanCopy}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 15000);
    } catch (err) {
      errorToast(err.message || 'Unable to download Credit Note PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const openCopyModal = (cn) => {
    setSelectedCopy(COPY_TYPES[0].value);
    setCopyModalNote(cn);
  };

  const displayedHistory = useMemo(
    () => (customerId ? history.filter(cn => String(cn.customer_id) === String(customerId)) : history),
    [history, customerId]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* ── Left: Entry Form ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilePlus className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Credit Note Entry</h3>
            </div>
            <span className="font-mono text-sm font-bold text-emerald-700">{nextNo || 'CN-—'}</span>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Credit Note No.">
              <input type="text" value={nextNo} readOnly className={`${inputClass} bg-slate-50 font-mono text-slate-600`} />
            </Field>
            <Field label="Date" required>
              <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className={inputClass} />
            </Field>

            <div className="md:col-span-2">
              <Field label="Customer" required>
                <SearchableSelect
                  options={customerOptions}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="Select customer"
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
              <Field label="Against Sales Invoice" required
                hint={selectedInvoice
                  ? <span className={exceedsInvoice ? 'text-rose-600 font-semibold' : ''}>
                      Invoice outstanding {formatCurrency(invOutstanding)} → after credit {formatCurrency(afterCredit)}
                      {!exceedsInvoice && afterCredit < -0.01 ? ' (payable / refundable to customer)' : ''}
                      {exceedsInvoice ? ` — exceeds invoice value available for credit ${formatCurrency(invCreditable)}` : ''}
                    </span>
                  : (customerId && !sourcesLoading && sources.length === 0 ? 'No invoices sent to Accounts for this customer — use On Account' : null)}>
                <SearchableSelect
                  options={referenceOptions}
                  value={form.reference}
                  onChange={(e) => setField('reference', e.target.value)}
                  placeholder={!customerId ? 'Select a customer first' : sourcesLoading ? 'Loading invoices…' : 'Select Invoice Number'}
                  labelField="label"
                  valueField="value"
                  subLabelField="sublabel"
                  allowCustom={false}
                  disabled={!customerId}
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
              <Field label="Company Bank Account" hint="Bank account this credit amount relates to (e.g. refund paid to customer)">
                <SearchableSelect
                  options={bankOptions}
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  placeholder="Search bank name or account number"
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
              <Field label="Narration">
                <textarea rows={2} value={form.narration} onChange={(e) => setField('narration', e.target.value)}
                  placeholder={defaultNarration} className={`${inputClass} resize-none`} />
              </Field>
            </div>
          </div>

          {/* ── Total + actions ── */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 rounded-b-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Credit Note</div>
                <div className="text-2xl font-bold font-mono text-emerald-700">{formatCurrency(calc.total)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleReset}
                  className="px-4 py-2.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={handlePost} disabled={posting}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50">
                  {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />}
                  {posting ? 'Posting…' : 'Post Credit Note'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Drawings of the selected invoice ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden xl:sticky xl:top-4">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-800 truncate">
                {selectedInvoice ? `Drawings in ${refLabel}` : 'Invoice Drawings'}
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
                {form.reference === ON_ACCOUNT ? 'On Account credit — no drawings' : 'Select a Sales Invoice'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {form.reference === ON_ACCOUNT ? 'Enter the credit amount below.' : 'Its drawings appear here. Tick only the drawings being returned.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[10.5px] uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8" />
                      <th className="px-2 py-2 text-left">Drawing No</th>
                      <th className="px-2 py-2 text-left">Drawing Name</th>
                      <th className="px-2 py-2 text-right w-28">Qty</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemRows.map(r => {
                      const qty = parseFloat(r.qty) || 0;
                      const over = qty > r.returnable + 0.0005;
                      const unavailable = r.returnable <= 0 && !r.selected;
                      const amount = r.selected ? qty * r.rate : r.invoiceQty * r.rate;
                      return (
                        <tr key={r.invoiceItemId}
                          onClick={(e) => { if (!unavailable && e.target.tagName !== 'INPUT') toggleItem(r.invoiceItemId); }}
                          className={`${unavailable ? 'opacity-45' : 'cursor-pointer hover:bg-slate-50'} ${r.selected ? 'bg-emerald-50/60' : ''}`}>
                          <td className="px-3 py-2.5 align-top">
                            {r.selected
                              ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                              : <Square className="w-4 h-4 text-slate-300" />}
                          </td>
                          <td className="px-2 py-2.5 align-top font-mono font-bold text-slate-900 whitespace-nowrap">{r.drawingNo || '—'}</td>
                          <td className="px-2 py-2.5 align-top text-slate-700">{r.name}</td>
                          <td className="px-2 py-2.5 align-top text-right whitespace-nowrap">
                            {r.selected ? (
                              <input type="number" min="0" step="any" value={r.qty}
                                onChange={(e) => setItemQty(r.invoiceItemId, e.target.value)}
                                className={`w-20 text-right font-mono border rounded-md px-1.5 py-1 focus:outline-none ${over ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 focus:border-blue-500'}`} />
                            ) : (
                              <span className="font-mono font-semibold text-slate-800">{formatNum(r.invoiceQty)}</span>
                            )}
                            <div className={`text-[10px] mt-0.5 ${over ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                              {r.selected ? `of ${formatNum(r.returnable)} ${r.unit}` : r.unit}{unavailable ? ' · fully credited' : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top text-right">
                            <div className={`font-mono font-semibold ${r.selected ? 'text-emerald-700' : 'text-slate-700'}`}>{formatCurrency(amount)}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@ {formatCurrency(r.rate)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!itemMode && (
                <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">Tick the drawings being returned</div>
              )}
            </>
          )}

          {/* ── Credit amount & GST ── */}
          <div className="border-t border-slate-200 px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
            <div className="sm:col-span-2">
              <Field label="Credit Amount (₹, before GST)" required
                hint={itemMode ? `Auto-calculated from ${selectedItems.length} selected drawing${selectedItems.length === 1 ? '' : 's'}` : (selectedInvoice ? 'Tick drawings above, or enter an amount' : null)}>
                <input type="number" min="0" step="0.01"
                  value={itemMode ? calc.taxable.toFixed(2) : form.amount}
                  readOnly={itemMode}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} font-mono font-semibold ${itemMode ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : ''}`} />
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
                  <td className="pt-2 text-right text-lg font-bold text-emerald-700">{formatCurrency(calc.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Credit Note History ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Credit Note History {selectedCustomer ? `· ${selectedCustomer.company_name}` : ''} ({displayedHistory.length})
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
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Reference Invoice</th>
                <th className="px-3 py-2">Bank</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedHistory.map(cn => {
                const cancelled = cn.status === 'CANCELLED';
                return (
                  <tr key={cn.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-mono font-bold text-emerald-700 whitespace-nowrap">{cn.voucher_no}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(cn.voucher_date)}</td>
                    <td className="px-3 py-2 text-slate-800">{cn.customer_name}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{cn.reference_invoice_no || 'On Account'}</td>
                    <td className="px-3 py-2 text-slate-600">{cn.bank_name || '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${cancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>{formatCurrency(cn.total_amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cancelled ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {cancelled ? 'Cancelled' : 'Posted'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button type="button" onClick={() => openCopyModal(cn)} disabled={pdfBusy} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer disabled:opacity-50" title="Print / Download PDF">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {!cancelled && (
                          <button type="button" onClick={() => handleCancelNote(cn)} className="p-1 rounded hover:bg-rose-50 text-rose-500 cursor-pointer" title="Cancel credit note">
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
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400 italic">
                    {historyLoading ? 'Loading…' : 'No credit notes recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Copy type picker (Print / Download PDF) ── */}
      {copyModalNote && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCopyModalNote(null)}>
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700"><FilePlus className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Select Credit Note Copy Type</h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Credit Note: <span className="font-semibold text-slate-700 font-mono">{copyModalNote.voucher_no}</span>
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setCopyModalNote(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Choose the copy type to print or download:</p>
              {COPY_TYPES.map(type => {
                const isSelected = selectedCopy === type.value;
                return (
                  <label key={type.value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none ${isSelected ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'}`}>
                    <input type="radio" name="creditNoteCopyType" value={type.value} checked={isSelected}
                      onChange={() => setSelectedCopy(type.value)}
                      className="mt-0.5 h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer" />
                    <div className="flex-1">
                      <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>{type.label || type.value}</div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">{type.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
              <button type="button" onClick={() => setCopyModalNote(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={() => handlePrint(copyModalNote, selectedCopy)} disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-bold bg-slate-700 hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button type="button" onClick={() => handleDownload(copyModalNote, selectedCopy)} disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditNoteEntry;
