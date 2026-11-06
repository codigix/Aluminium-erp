import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Eye, Pencil, X, ChevronLeft, ChevronRight, Loader2, Layers, CheckCircle2, CircleDashed,
  FileText, ClipboardList, FileCheck, ShoppingBag, Receipt, RotateCcw, ExternalLink, Save, Boxes
} from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';
import { getFileUrl } from '../utils/url';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const PAGE_SIZE = 25;

const request = async (path, options = {}) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
};

// Dates arrive as 'YYYY-MM-DD HH:mm:ss' (or ISO)
const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const formatQty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
};
const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
};

// Where-used badges in the list (same order as the Sales workflow)
const USAGE_BADGES = [
  { key: 'quotes', label: 'Quote', title: 'Sales Quotations', on: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'customer_pos', label: 'PO', title: 'Customer POs', on: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'sales_orders', label: 'SO', title: 'Sales Orders', on: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'projects', label: 'Project', title: 'Project / Design Orders', on: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'invoices', label: 'Invoice', title: 'Sales Invoices', on: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

const statusTone = (status) => {
  const s = String(status || '').toUpperCase();
  if (/(PAID|APPROVED|COMPLETED|MATCHED|ACTIVE|POSTED|DISPATCHED|DELIVERED|SENT|ACCEPTED)/.test(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (/(CANCEL|REJECT)/.test(s)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (/(PENDING|DRAFT|REVIEW|PROGRESS|SUBMITTED)/.test(s)) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};
const StatusPill = ({ value }) => (
  value ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${statusTone(value)}`}>{String(value).replace(/_/g, ' ')}</span> : <span className="text-slate-400">—</span>
);

// One Sales stage in the View panel: title, count and its records
const StageSection = ({ icon: Icon, title, hint, rows, columns, accent }) => (
  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`p-1.5 rounded-lg ${accent}`}><Icon className="w-3.5 h-3.5" /></span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          {hint && <p className="text-[11px] text-slate-500 truncate">{hint}</p>}
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${rows.length ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
        {rows.length} {rows.length === 1 ? 'record' : 'records'}
      </span>
    </div>
    {rows.length === 0 ? (
      <div className="px-4 py-5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <CircleDashed className="w-4 h-4" /> Not used here yet
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500 font-semibold">
            <tr className="border-b border-slate-100">
              {columns.map(c => <th key={c.label} className={`px-3 py-2 whitespace-nowrap ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, i) => (
              <tr key={`${r.id}-${i}`} className="hover:bg-slate-50/60">
                {columns.map(c => (
                  <td key={c.label} className={`px-3 py-2 align-top ${c.right ? 'text-right font-mono' : ''} ${c.className || ''}`}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const PartTracking = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, used: 0, unused: 0, invoiced: 0 });
  const [filterOptions, setFilterOptions] = useState({ clients: [], types: [] });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [client, setClient] = useState('');
  const [type, setType] = useState('');
  const [usage, setUsage] = useState('');
  // Date range = Sales activity in the period (quotation / PO / sales order / invoice dates)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', revision: '', drawingType: 'Part', hsnCode: '' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchList = useCallback(async (opts) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(opts.page), limit: String(PAGE_SIZE) });
      if (opts.search.trim()) params.set('search', opts.search.trim());
      if (opts.client) params.set('client', opts.client);
      if (opts.type) params.set('type', opts.type);
      if (opts.usage) params.set('usage', opts.usage);
      if (opts.fromDate) params.set('fromDate', opts.fromDate);
      if (opts.toDate) params.set('toDate', opts.toDate);
      const data = await request(`/part-tracking?${params}`);
      setRows(Array.isArray(data.data) ? data.data : []);
      setStats(data.stats || { total: 0, used: 0, unused: 0, invoiced: 0 });
      setFilterOptions(data.filters || { clients: [], types: [] });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      errorToast(err.message || 'Failed to load drawings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Filters reload from page 1; typing in search is debounced
  useEffect(() => {
    if (fromDate && toDate && fromDate > toDate) return; // invalid range: wait until it is corrected
    const t = setTimeout(() => {
      setPage(1);
      fetchList({ search, client, type, usage, fromDate, toDate, page: 1 });
    }, 300);
    return () => clearTimeout(t);
  }, [search, client, type, usage, fromDate, toDate, fetchList]);

  const goToPage = (p) => {
    setPage(p);
    fetchList({ search, client, type, usage, fromDate, toDate, page: p });
  };

  // Quick date ranges (local calendar dates)
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === 'month') {
      setFromDate(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === 'quarter') {
      setFromDate(ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
      setToDate(ymd(now));
    } else if (preset === 'year') {
      setFromDate(ymd(new Date(now.getFullYear(), 0, 1)));
      setToDate(ymd(new Date(now.getFullYear(), 11, 31)));
    }
  };
  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);
  const hasDateRange = Boolean(fromDate || toDate);

  const openView = async (row) => {
    setViewData({ loadingFor: row });
    try {
      setViewLoading(true);
      const data = await request(`/part-tracking/where-used/${encodeURIComponent(row.drawing_no)}`);
      setViewData(data);
    } catch (err) {
      errorToast(err.message || 'Failed to load where-used details');
      setViewData(null);
    } finally {
      setViewLoading(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      description: row.description || '',
      revision: row.revision || '',
      drawingType: row.drawing_type || 'Part',
      hsnCode: row.hsn_code || ''
    });
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (editForm.hsnCode.trim() && !/^\d{4,8}$/.test(editForm.hsnCode.trim())) {
      setEditError('HSN Code must be 4 to 8 digits');
      return;
    }
    try {
      setSaving(true);
      setEditError('');
      const res = await request(`/part-tracking/drawings/${editRow.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      successToast(res.message || 'Drawing updated');
      setEditRow(null);
      fetchList({ search, client, type, usage, fromDate, toDate, page });
    } catch (err) {
      setEditError(err.message === 'Insufficient permissions'
        ? 'You do not have permission to edit drawings. Please ask the Design team.'
        : (err.message || 'Failed to update drawing'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white';
  // Small, equal-height controls for the one-line filter row (width set per control)
  const compactClass = 'h-8 px-2.5 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white';
  const typeOptions = Array.from(new Set(['Part', 'Assembly', ...(filterOptions.types || [])]));

  // ── View panel content ──
  const renderView = () => {
    if (!viewData) return null;
    const loadingRow = viewData.loadingFor;
    const drawing = viewData.drawing || loadingRow || {};
    const summary = viewData.summary || {};
    const stages = viewData.stages || {};
    const steps = [
      { label: 'Requirement', count: (stages.requirements || []).length, icon: ClipboardList },
      { label: 'Quotation', count: (stages.quotations || []).length, icon: FileText },
      { label: 'Customer PO', count: (stages.customerPos || []).length, icon: FileCheck },
      { label: 'Sales Order', count: (stages.salesOrders || []).length, icon: ShoppingBag },
      { label: 'Invoice', count: (stages.invoices || []).length, icon: Receipt }
    ];
    const lastReached = steps.reduce((acc, s, i) => (s.count > 0 ? i : acc), -1);
    // Cards: number of unique documents (big) and the quantity they carry (below)
    const plural = (n, one, many) => `${formatQty(n || 0)} ${Number(n) === 1 ? one : many}`;
    const tiles = [
      {
        label: 'Quotations',
        value: summary.quoteCount,
        unit: Number(summary.quoteCount) === 1 ? 'quote' : 'quotes',
        tone: 'text-violet-700',
        detail: `Qty ${formatQty(summary.quotedQty || 0)} (latest valid version)`
      },
      {
        label: 'Customer POs',
        value: summary.poCount,
        unit: Number(summary.poCount) === 1 ? 'PO' : 'POs',
        tone: 'text-blue-700',
        detail: [
          `Qty ${formatQty(summary.poQty || 0)} own line`,
          summary.subAssemblyQty > 0 ? `+${formatQty(summary.subAssemblyQty)} ${summary.subAssemblyUnits || ''} inside other drawings` : null
        ].filter(Boolean).join(' · '),
        hint: summary.duplicatePoUploads ? `${plural(summary.duplicatePoUploads, 'duplicate upload', 'duplicate uploads')} of the same PO not counted` : ''
      },
      {
        label: 'Sales Orders',
        value: summary.orderCount,
        unit: Number(summary.orderCount) === 1 ? 'order' : 'orders',
        tone: 'text-amber-700',
        detail: `Qty ${formatQty(summary.orderQty || 0)}`
      },
      {
        label: 'Invoices',
        value: summary.invoiceCount,
        unit: Number(summary.invoiceCount) === 1 ? 'invoice' : 'invoices',
        tone: 'text-emerald-700',
        detail: `Qty ${formatQty(summary.invoicedQty || 0)} invoiced`
      },
      {
        label: 'Pending to Invoice',
        value: summary.pendingToInvoice,
        unit: 'qty',
        tone: summary.pendingToInvoice > 0 ? 'text-rose-700' : 'text-slate-700',
        detail: 'Customer PO qty − invoiced qty'
      }
    ];

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-slate-900/30" onClick={() => setViewData(null)} />
        <div className="relative w-full max-w-5xl h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawing header */}
          <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Layers className="w-4 h-4" /></span>
                <h2 className="text-lg font-semibold text-slate-900 font-mono">{drawing.drawing_no}</h2>
                {drawing.revision && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">Rev {drawing.revision}</span>}
                {drawing.drawing_type && <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold">{drawing.drawing_type}</span>}
                {drawing.status && <StatusPill value={drawing.status} />}
              </div>
              <p className="text-sm text-slate-700 mt-1">{drawing.description || 'No description'}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[drawing.client_name, drawing.hsn_code ? `HSN ${drawing.hsn_code}` : null].filter(Boolean).join(' · ') || '—'}
                {drawing.file_path && (
                  <a href={getFileUrl(drawing.file_path)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-indigo-600 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Open drawing file
                  </a>
                )}
              </p>
            </div>
            <button type="button" onClick={() => setViewData(null)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {viewLoading ? (
              <div className="py-20 text-center text-slate-400 text-sm">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Finding where this drawing is used...
              </div>
            ) : (
              <>
                {/* Quantity summary */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {tiles.map(t => (
                    <div key={t.label} className="bg-white border border-slate-200 rounded-xl p-3" title={t.hint || ''}>
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">{t.label}</p>
                      <p className={`text-xl font-bold mt-1 ${t.tone}`}>
                        {formatQty(t.value || 0)} <span className="text-xs font-semibold text-slate-400">{t.unit}</span>
                      </p>
                      {t.detail && <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t.detail}</p>}
                      {t.hint && <p className="text-[10px] text-amber-700 mt-0.5 leading-tight">{t.hint}</p>}
                    </div>
                  ))}
                </div>

                {/* Journey through Sales */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-3">Sales journey of this part</p>
                  <div className="flex items-start">
                    {steps.map((s, i) => {
                      const done = s.count > 0;
                      const Icon = s.icon;
                      return (
                        <React.Fragment key={s.label}>
                          <div className="flex flex-col items-center text-center min-w-0 flex-1">
                            <span className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
                              {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                            </span>
                            <span className={`text-[11px] font-semibold mt-1.5 ${done ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
                            <span className="text-[10px] text-slate-500">{done ? `${s.count} found` : 'Not yet'}</span>
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`h-0.5 flex-1 mt-4 rounded ${i < lastReached ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <StageSection
                  icon={ClipboardList} title="1. Client Requirement" hint="Customer Drawings where this drawing was received"
                  accent="bg-slate-100 text-slate-600" rows={stages.requirements || []}
                  columns={[
                    { label: 'Project', render: r => <span className="font-semibold text-slate-800">{r.project_name || '—'}</span> },
                    { label: 'Client', render: r => r.client_name || '—' },
                    { label: 'Revision', render: r => r.revision || '—' },
                    { label: 'Qty', right: true, render: r => formatQty(r.qty) },
                    { label: 'Received', render: r => formatDate(r.created_at) },
                    { label: 'Status', render: r => <StatusPill value={r.status} /> }
                  ]}
                />
                <StageSection
                  icon={FileText} title="2. Sales Quotation" hint="Quotations sent to the customer for this drawing"
                  accent="bg-violet-50 text-violet-600" rows={stages.quotations || []}
                  columns={[
                    {
                      label: 'Quote',
                      render: r => (
                        <span className={r.is_current ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                          #{r.id}{r.version ? ` · v${r.version}` : ''}
                          {r.is_current
                            ? <span className="ml-1.5 px-1.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">Current</span>
                            : <span className="ml-1.5 px-1.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">Superseded</span>}
                        </span>
                      )
                    },
                    { label: 'Customer', render: r => r.customer || '—' },
                    { label: 'Project', render: r => r.project_name || '—' },
                    { label: 'Date', render: r => formatDate(r.doc_date) },
                    { label: 'Qty', right: true, render: r => formatQty(r.quantity) },
                    { label: 'Quote Value', right: true, render: r => formatMoney(r.total_amount) },
                    { label: 'Status', render: r => <StatusPill value={r.status} /> }
                  ]}
                />
                <StageSection
                  icon={FileCheck} title="3. Customer PO" hint="Purchase orders received from the customer (each PO once; sub-assembly lines included)"
                  accent="bg-blue-50 text-blue-600" rows={stages.customerPos || []}
                  columns={[
                    {
                      label: 'PO No.',
                      render: r => (
                        <div>
                          <span className="font-mono font-semibold text-blue-700">{r.doc_no || '—'}</span>
                          {r.linked_order_no && <div className="text-[10px] text-slate-500">→ {r.linked_order_no}</div>}
                          {r.duplicate_uploads > 0 && (
                            <div className="text-[10px] text-amber-700" title="The same PO number was uploaded again; the extra copies are not counted">
                              +{r.duplicate_uploads} duplicate upload{r.duplicate_uploads > 1 ? 's' : ''} ignored
                            </div>
                          )}
                        </div>
                      )
                    },
                    { label: 'Customer', render: r => r.customer || '—' },
                    { label: 'PO Date', render: r => formatDate(r.doc_date) },
                    {
                      label: 'Used As',
                      render: r => (r.line_type === 'Sub-assembly' ? (
                        <div className="text-[11px] leading-tight">
                          <span className="px-1.5 rounded bg-cyan-50 text-cyan-700 font-semibold">Inside {r.parent_drawing_no}</span>
                          {r.per_parent_qty != null && r.parent_qty != null && (
                            <div className="text-slate-500 mt-0.5">{formatQty(r.per_parent_qty)} {r.unit || ''} per unit × {formatQty(r.parent_qty)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="px-1.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">Own line</span>
                      ))
                    },
                    { label: 'Qty', right: true, render: r => `${formatQty(r.quantity)} ${r.unit || ''}` },
                    { label: 'Rate', right: true, render: r => formatMoney(r.rate) },
                    { label: 'Delivery', render: r => formatDate(r.delivery_date) },
                    { label: 'Status', render: r => <StatusPill value={r.status} /> }
                  ]}
                />
                <StageSection
                  icon={ShoppingBag} title="4. Sales Order" hint="Sales orders created for the customer"
                  accent="bg-amber-50 text-amber-600" rows={stages.salesOrders || []}
                  columns={[
                    { label: 'Order No.', render: r => <span className="font-mono font-semibold text-amber-700">{r.doc_no || '—'}</span> },
                    { label: 'Customer', render: r => r.customer || '—' },
                    { label: 'Against PO', render: r => (r.against_po_no ? <span className="font-mono text-blue-700">{r.against_po_no}</span> : '—') },
                    { label: 'Date', render: r => formatDate(r.doc_date) },
                    { label: 'Qty', right: true, render: r => formatQty(r.quantity) },
                    { label: 'Rate', right: true, render: r => formatMoney(r.rate) },
                    { label: 'Amount', right: true, render: r => formatMoney(r.amount) },
                    { label: 'Status', render: r => <StatusPill value={r.status} /> }
                  ]}
                />
                <StageSection
                  icon={Receipt} title="5. Sales Invoice" hint="Invoices raised to the customer"
                  accent="bg-emerald-50 text-emerald-600" rows={stages.invoices || []}
                  columns={[
                    { label: 'Invoice No.', render: r => <span className="font-mono font-semibold text-emerald-700">{r.doc_no}</span> },
                    { label: 'Customer', render: r => r.customer || '—' },
                    { label: 'Date', render: r => formatDate(r.doc_date) },
                    { label: 'Customer PO', render: r => r.customer_po_no || '—' },
                    { label: 'Qty', right: true, render: r => `${formatQty(r.quantity)} ${r.unit || ''}` },
                    { label: 'Amount', right: true, render: r => formatMoney(r.amount) },
                    { label: 'Status', render: r => <StatusPill value={r.status} /> }
                  ]}
                />
                {(stages.creditNotes || []).length > 0 && (
                  <StageSection
                    icon={RotateCcw} title="Credit Notes (Returns)" hint="Quantities returned or credited to the customer"
                    accent="bg-rose-50 text-rose-600" rows={stages.creditNotes || []}
                    columns={[
                      { label: 'Credit Note', render: r => <span className="font-mono font-semibold text-rose-700">{r.doc_no}</span> },
                      { label: 'Customer', render: r => r.customer || '—' },
                      { label: 'Date', render: r => formatDate(r.doc_date) },
                      { label: 'Against Invoice', render: r => r.reference_invoice_no || '—' },
                      { label: 'Qty', right: true, render: r => formatQty(r.quantity) },
                      { label: 'Amount', right: true, render: r => formatMoney(r.amount) },
                      { label: 'Status', render: r => <StatusPill value={r.status} /> }
                    ]}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const statCards = [
    { label: 'Total Drawings', value: stats.total, icon: Boxes, tone: 'bg-indigo-50 text-indigo-600', onClick: () => setUsage('') },
    { label: hasDateRange ? 'Used in Period' : 'Used in Sales', value: stats.used, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', onClick: () => setUsage('used') },
    { label: hasDateRange ? 'Not Used in Period' : 'Never Used', value: stats.unused, icon: CircleDashed, tone: 'bg-slate-100 text-slate-500', onClick: () => setUsage('unused') },
    { label: hasDateRange ? 'Invoiced in Period' : 'Invoiced', value: stats.invoiced, icon: Receipt, tone: 'bg-amber-50 text-amber-600' }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Part Tracking</h1>
        <nav className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <span>Home</span><ChevronRight className="w-3 h-3" /><span>Sales</span><ChevronRight className="w-3 h-3" />
          <span className="text-rose-600 font-medium">Part Tracking</span>
        </nav>
        <p className="text-xs text-slate-500 mt-1">See every Drawing Master part and where it is used — quotation, customer PO, sales order and invoice.</p>
      </div>

      {/* Summary cards (click to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              disabled={!card.onClick}
              className={`bg-white border border-slate-200 rounded-xl p-4 text-left flex items-center justify-between gap-2 shadow-xs ${card.onClick ? 'hover:border-indigo-300 cursor-pointer' : 'cursor-default'}`}
            >
              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatQty(card.value)}</p>
              </div>
              <span className={`p-2.5 rounded-xl ${card.tone}`}><Icon className="w-5 h-5" /></span>
            </button>
          );
        })}
      </div>

      {/* Listing */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* All filters in one compact row (wraps on small screens). Dates = Sales activity in the period */}
        <div className="p-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drawing, description, client..." className={`${compactClass} w-full pr-8`} />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <select value={client} onChange={(e) => setClient(e.target.value)} className={`${compactClass} w-[150px]`} aria-label="Client">
              <option value="">All Clients</option>
              {(filterOptions.clients || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={`${compactClass} w-[110px]`} aria-label="Type">
              <option value="">All Types</option>
              {(filterOptions.types || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={usage} onChange={(e) => setUsage(e.target.value)} className={`${compactClass} w-[150px]`} aria-label="Usage">
              <option value="">Used & Never Used</option>
              <option value="used">Used in Sales</option>
              <option value="unused">Never Used</option>
            </select>
            <div className="flex items-center gap-1" title="Sales activity (quotation / PO / sales order / invoice) between these dates">
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                className={`${compactClass} w-[128px] ${dateRangeInvalid ? 'border-rose-400' : ''}`}
                aria-label="From date"
              />
              <span className="text-[11px] text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className={`${compactClass} w-[128px] ${dateRangeInvalid ? 'border-rose-400' : ''}`}
                aria-label="To date"
              />
            </div>
            <div className="flex items-center gap-1">
              {[['month', 'This Month'], ['quarter', '3 Months'], ['year', 'This Year']].map(([key, label]) => (
                <button key={key} type="button" onClick={() => applyPreset(key)} className="h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 whitespace-nowrap">
                  {label}
                </button>
              ))}
              {hasDateRange && (
                <button type="button" onClick={() => { setFromDate(''); setToDate(''); }} className="h-8 px-2 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 whitespace-nowrap" title="Clear dates">
                  <X className="w-3.5 h-3.5 inline -mt-0.5" /> Clear
                </button>
              )}
            </div>
          </div>
          {dateRangeInvalid && <p className="text-[11px] text-rose-600 font-medium mt-1.5">From date must be on or before To date</p>}
          {hasDateRange && !dateRangeInvalid && <p className="text-[11px] text-slate-500 mt-1.5">Showing Sales activity in the selected period — where-used counts include only documents dated in it.</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-2.5">Drawing No.</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5">Where Used</th>
                <th className="px-3 py-2.5">Last Used</th>
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />Loading drawings...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Layers className="w-6 h-6 mx-auto mb-2 text-slate-300" />No drawings match your filters.</td></tr>
              )}
              {!loading && rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/70 align-top">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button type="button" onClick={() => openView(r)} className="font-mono font-semibold text-indigo-700 hover:underline">{r.drawing_no}</button>
                    <div className="flex items-center gap-1 mt-1">
                      {r.revision && <span className="px-1.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">Rev {r.revision}</span>}
                      {r.drawing_type && <span className="px-1.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">{r.drawing_type}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700 min-w-[180px] max-w-[280px]"><span className="line-clamp-2" title={r.description}>{r.description || '—'}</span></td>
                  <td className="px-3 py-3 text-slate-700 min-w-[130px]">{r.client_name || '—'}</td>
                  <td className="px-3 py-3 min-w-[260px]">
                    <div className="flex flex-wrap gap-1">
                      {USAGE_BADGES.map(b => (
                        <span key={b.key} title={`${b.title}: ${r[b.key]}`} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${r[b.key] > 0 ? b.on : 'bg-white text-slate-300 border-slate-200'}`}>
                          {b.label} {r[b.key]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.last_used ? formatDate(r.last_used) : <span className="text-slate-400">Never</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => openView(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-indigo-700 hover:bg-indigo-50 text-[11px] font-semibold" title="View where used">
                        <Eye className="w-4 h-4" /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>{total === 0 ? 'Showing 0 drawings' : `Showing ${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, total)} of ${total} drawings`}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="p-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-semibold text-slate-700">Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="p-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50" aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {renderView()}

      {/* Edit drawing details */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => !saving && setEditRow(null)} />
          <form onSubmit={handleSaveEdit} className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Edit Drawing</h2>
                <p className="text-xs text-slate-500 font-mono">{editRow.drawing_no}</p>
              </div>
              <button type="button" onClick={() => setEditRow(null)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} className={`${inputClass} resize-y`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Revision</label>
                  <input type="text" value={editForm.revision} onChange={(e) => setEditForm(f => ({ ...f, revision: e.target.value }))} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Type</label>
                  <select value={editForm.drawingType} onChange={(e) => setEditForm(f => ({ ...f, drawingType: e.target.value }))} className={inputClass}>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">HSN Code</label>
                  <input type="text" inputMode="numeric" value={editForm.hsnCode} onChange={(e) => setEditForm(f => ({ ...f, hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} className={`${inputClass} font-mono`} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">The drawing number cannot be changed here. Changes follow the Drawing Master rules (e.g. no edits after the BOM is submitted).</p>
              {editError && <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">{editError}</div>}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setEditRow(null)} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PartTracking;
