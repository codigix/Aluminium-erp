import React, { useState, useEffect, useMemo } from 'react';
import { GitMerge, X, AlertCircle, FileText, CheckCircle2, ChevronRight, Layers, Tag, ShieldCheck, DollarSign, ArrowLeft, Search } from 'lucide-react';
import Swal from 'sweetalert2';
import { errorToast, successToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(val);
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const MergeReceivedQuotesModal = ({
  isOpen,
  onClose,
  onSuccess,
  selectedQuoteIds = [],
  quotations = [],
  vendors = []
}) => {
  // Step 1: Select Vendor & Quotes (if not already selected), Step 2: Review & Confirm
  const [step, setStep] = useState(1);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [internalSelectedQuoteIds, setInternalSelectedQuoteIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [fullQuotes, setFullQuotes] = useState([]);
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Eligible received quotations: status === 'RECEIVED' or 'REVIEWED', not already merged
  const eligibleQuotes = useMemo(() => {
    const eligibleStatuses = ['RECEIVED', 'REVIEWED'];
    return (quotations || []).filter(q => {
      if (q.isRFQOnly) return false;
      if (q.status === 'MERGED' || q.is_merged === 1 || q.merged_into_quotation_id) return false;
      if (['REJECTED', 'CLOSED', 'SUPERSEDED'].includes(q.status)) return false;
      return eligibleStatuses.includes(q.status);
    });
  }, [quotations]);

  // Full vendor list with their count of eligible RECEIVED/REVIEWED quotations
  const vendorDropdownList = useMemo(() => {
    const counts = {};
    eligibleQuotes.forEach(q => {
      if (q.vendor_id) {
        counts[q.vendor_id] = (counts[q.vendor_id] || 0) + 1;
      }
    });

    const vendorMap = new Map();
    (vendors || []).forEach(v => {
      vendorMap.set(String(v.id), {
        id: v.id,
        vendor_name: v.vendor_name || v.name || `Vendor #${v.id}`,
        quote_count: counts[v.id] || 0
      });
    });

    (quotations || []).forEach(q => {
      if (q.vendor_id && !vendorMap.has(String(q.vendor_id))) {
        vendorMap.set(String(q.vendor_id), {
          id: q.vendor_id,
          vendor_name: q.vendor_name || `Vendor #${q.vendor_id}`,
          quote_count: counts[q.vendor_id] || 0
        });
      }
    });

    return Array.from(vendorMap.values()).sort((a, b) => {
      if (b.quote_count !== a.quote_count) {
        return b.quote_count - a.quote_count;
      }
      return (a.vendor_name || '').localeCompare(b.vendor_name || '');
    });
  }, [eligibleQuotes, vendors, quotations]);

  // Initialize modal state on open
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedVendorId('');
      setInternalSelectedQuoteIds([]);
      setFullQuotes([]);
      setNotes('');
      setSearchTerm('');
      return;
    }

    // Check if initial selectedQuoteIds has >= 2 valid quotes from same vendor
    if (selectedQuoteIds && selectedQuoteIds.length >= 2) {
      const selectedObjs = eligibleQuotes.filter(q => selectedQuoteIds.includes(q.id));
      const firstVendorId = selectedObjs[0]?.vendor_id;
      const allSameVendor = selectedObjs.length >= 2 && selectedObjs.every(q => q.vendor_id === firstVendorId);

      if (allSameVendor) {
        setSelectedVendorId(String(firstVendorId));
        setInternalSelectedQuoteIds(selectedQuoteIds);
        setStep(2);
        loadFullDetails(selectedQuoteIds);
        return;
      }
    }

    // Otherwise, start on Step 1
    setStep(1);
    if (selectedQuoteIds && selectedQuoteIds.length > 0) {
      const firstQuote = eligibleQuotes.find(q => selectedQuoteIds.includes(q.id));
      if (firstQuote && firstQuote.vendor_id) {
        setSelectedVendorId(String(firstQuote.vendor_id));
        setInternalSelectedQuoteIds(selectedQuoteIds.filter(id => {
          const q = eligibleQuotes.find(item => item.id === id);
          return q && String(q.vendor_id) === String(firstQuote.vendor_id);
        }));
        return;
      }
    }

    // Default to first vendor with eligible quotes if available, otherwise first vendor
    const firstEligible = vendorDropdownList.find(v => v.quote_count >= 2) || vendorDropdownList.find(v => v.quote_count > 0);
    if (firstEligible) {
      setSelectedVendorId(String(firstEligible.id));
    } else if (vendorDropdownList.length > 0) {
      setSelectedVendorId(String(vendorDropdownList[0].id));
    }
  }, [isOpen, selectedQuoteIds, eligibleQuotes, vendorDropdownList]);

  // Quotes available for the currently selected vendor in Step 1
  const vendorQuotes = useMemo(() => {
    if (!selectedVendorId) return [];
    return eligibleQuotes.filter(q => String(q.vendor_id) === String(selectedVendorId));
  }, [eligibleQuotes, selectedVendorId]);

  // Filter vendor quotes by search term
  const filteredVendorQuotes = useMemo(() => {
    if (!searchTerm.trim()) return vendorQuotes;
    const lower = searchTerm.toLowerCase();
    return vendorQuotes.filter(q => {
      const matchesQuote = String(q.quote_number || '').toLowerCase().includes(lower);
      const matchesProject = String(q.project_name || '').toLowerCase().includes(lower);
      const matchesDrawing = String(q.drawing_no || '').toLowerCase().includes(lower);
      return matchesQuote || matchesProject || matchesDrawing;
    });
  }, [vendorQuotes, searchTerm]);

  // Load detailed items for the selected quotes
  const loadFullDetails = async (quoteIds) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const quotePromises = quoteIds.map(async (id) => {
        const res = await fetch(`${API_BASE}/quotations/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) throw new Error(`Failed to load quotation #${id}`);
        return await res.json();
      });

      const results = await Promise.all(quotePromises);
      setFullQuotes(results);

      const quoteNumbers = results.map(q => q.quote_number).join(', ');
      setNotes(`Consolidated merged received quote from: ${quoteNumbers}`);
    } catch (err) {
      console.error('Error fetching quotation details:', err);
      errorToast(err.message || 'Error loading quotation details');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToReview = () => {
    if (internalSelectedQuoteIds.length < 2) {
      errorToast('Please select at least 2 received quotations to merge');
      return;
    }
    setStep(2);
    loadFullDetails(internalSelectedQuoteIds);
  };

  // Vendor Information
  const currentVendor = useMemo(() => {
    if (!selectedVendorId) return null;
    const found = vendors.find(v => String(v.id) === String(selectedVendorId));
    return found || { id: selectedVendorId, vendor_name: `Vendor #${selectedVendorId}` };
  }, [selectedVendorId, vendors]);

  // Flatten and prepare consolidated line items
  const consolidatedItems = useMemo(() => {
    if (!fullQuotes || fullQuotes.length === 0) return [];
    const items = [];

    fullQuotes.forEach((quote) => {
      const quoteItems = Array.isArray(quote.items) ? quote.items : [];
      quoteItems.forEach((item) => {
        const designQty = (item.design_qty !== null && item.design_qty !== undefined)
          ? parseFloat(item.design_qty)
          : (parseFloat(item.quantity) || 0);

        const quotedQty = (item.quantity !== null && item.quantity !== undefined)
          ? parseFloat(item.quantity)
          : designQty;

        const uom = item.uom || item.unit || 'NOS';
        const rate = parseFloat(item.unit_rate) || 0;

        let amount = parseFloat(item.amount);
        if (isNaN(amount) || amount === 0) {
          amount = Number((quotedQty * rate).toFixed(2));
        }

        const gstPercent = parseFloat(item.cgst_percent || 0) + parseFloat(item.sgst_percent || 0) || parseFloat(quote.gst_percentage || 18);
        let cgstAmount = parseFloat(item.cgst_amount) || 0;
        let sgstAmount = parseFloat(item.sgst_amount) || 0;
        if (!cgstAmount && !sgstAmount && gstPercent > 0) {
          cgstAmount = Number(((amount * (gstPercent / 2)) / 100).toFixed(2));
          sgstAmount = Number(((amount * (gstPercent / 2)) / 100).toFixed(2));
        }

        let totalAmount = parseFloat(item.total_amount);
        if (isNaN(totalAmount) || totalAmount === 0) {
          totalAmount = Number((amount + cgstAmount + sgstAmount).toFixed(2));
        }

        items.push({
          ...item,
          source_quote_id: quote.id,
          source_quote_number: quote.quote_number,
          source_project_name: quote.project_name || quote.project_details || 'General Procurement',
          client_name: quote.company_name || quote.client_name || '—',
          source_rfq_number: quote.rfq_number || quote.rfq_id || '—',
          designQty,
          quotedQty,
          uom,
          rate,
          amount,
          gstPercent,
          cgstAmount,
          sgstAmount,
          totalAmount
        });
      });
    });

    return items;
  }, [fullQuotes]);

  // Financial summary
  const financials = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let grandTotal = 0;

    consolidatedItems.forEach(i => {
      subtotal += (i.amount || 0);
      tax += ((i.cgstAmount || 0) + (i.sgstAmount || 0));
      grandTotal += (i.totalAmount || 0);
    });

    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2))
    };
  }, [consolidatedItems]);

  const handleMergeSubmit = async () => {
    if (!internalSelectedQuoteIds || internalSelectedQuoteIds.length < 2) {
      errorToast('Please select at least 2 received quotations to merge');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Confirm Merge Received Quotes',
      text: `Are you sure you want to merge ${fullQuotes.length} quotations from ${currentVendor?.vendor_name} into ONE consolidated Received Quote?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Merge Quotes',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#64748b'
    });

    if (!confirm.isConfirmed) return;

    try {
      setMerging(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceQuotationIds: internalSelectedQuoteIds,
          notes: notes.trim()
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.error || 'Failed to merge quotations');
      }

      successToast(`Successfully merged into quotation ${resData.data?.quote_number || 'new quote'}!`);
      if (onSuccess) {
        onSuccess(resData.data);
      }
      onClose();
    } catch (err) {
      console.error('Merge quotations error:', err);
      Swal.fire({
        title: 'Merge Failed',
        text: err.message || 'Could not merge quotations. Please try again.',
        icon: 'error',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Merge Received Quotations</h2>
                <div className="flex items-center gap-1 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${step === 1 ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
                    1. Select Quotes
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className={`px-2 py-0.5 rounded-full font-bold ${step === 2 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    2. Review & Merge
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidates multiple vendor quotations into ONE single Received Quote record.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Select Vendor & Eligible Received Quotes */}
        {step === 1 && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Vendor Selector */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Select Supplier / Vendor
              </label>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    const newVId = e.target.value;
                    setSelectedVendorId(newVId);
                    setInternalSelectedQuoteIds([]);
                  }}
                  className="flex-1 text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendorDropdownList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vendor_name} ({v.quote_count})
                    </option>
                  ))}
                </select>
                {currentVendor && (
                  <span className="text-xs text-slate-500">
                    <span className="font-semibold text-purple-700">{vendorQuotes.length}</span> received/reviewed quotes available
                  </span>
                )}
              </div>
            </div>

            {/* Quotations List */}
            {selectedVendorId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Eligible Received Quotes
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                      {internalSelectedQuoteIds.length} Selected (Min 2 required)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search quotes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (internalSelectedQuoteIds.length === vendorQuotes.length) {
                          setInternalSelectedQuoteIds([]);
                        } else {
                          setInternalSelectedQuoteIds(vendorQuotes.map(q => q.id));
                        }
                      }}
                      className="text-xs font-semibold text-purple-700 hover:text-purple-800 hover:underline px-2 py-1"
                    >
                      {internalSelectedQuoteIds.length === vendorQuotes.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">Select</th>
                          <th className="py-2.5 px-3">Quote No.</th>
                          <th className="py-2.5 px-3">Client</th>
                          <th className="py-2.5 px-3">Project</th>
                          <th className="py-2.5 px-3">Drawing / Part</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Items</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredVendorQuotes.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                              No received/reviewed quotations available for this vendor.
                            </td>
                          </tr>
                        ) : (
                          filteredVendorQuotes.map((q) => {
                            const isSelected = internalSelectedQuoteIds.includes(q.id);
                            return (
                              <tr
                                key={q.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setInternalSelectedQuoteIds(prev => prev.filter(id => id !== q.id));
                                  } else {
                                    setInternalSelectedQuoteIds(prev => [...prev, q.id]);
                                  }
                                }}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50/70 hover:bg-purple-100/50' : 'hover:bg-slate-50'}`}
                              >
                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setInternalSelectedQuoteIds(prev => [...prev, q.id]);
                                      } else {
                                        setInternalSelectedQuoteIds(prev => prev.filter(id => id !== q.id));
                                      }
                                    }}
                                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-purple-900">
                                  {q.quote_number}
                                  {q.version && (
                                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 text-[10px] font-normal border border-indigo-100">
                                      V{q.version}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 font-bold truncate max-w-[150px]" title={q.company_name || q.client_name}>
                                  {q.company_name || q.client_name || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 font-medium truncate max-w-[160px]" title={q.project_name}>
                                  {q.project_name || 'General'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-mono">
                                  {q.drawing_no || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {q.status === 'REVIEWED' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      Reviewed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                      Received
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-600">
                                  {q.items?.length || 1}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {formatDate(q.created_at)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                  {formatCurrency(q.grand_total || q.total_amount)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Please select a vendor above to see their received/reviewed quotations.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Review Consolidated Items & Confirm */}
        {step === 2 && (
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
                <p className="text-xs text-slate-500 font-medium">Loading quotation line items...</p>
              </div>
            ) : (
              <>
                {/* Vendor & Source Quotes Overview */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vendor:</span>
                      <span className="text-sm font-bold text-slate-800">{currentVendor?.vendor_name}</span>
                      <span className="text-xs text-slate-400">ID: #{currentVendor?.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Output Result:</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Status: RECEIVED
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        <GitMerge className="w-3 h-3" />
                        MERGED QUOTE
                      </span>
                    </div>
                  </div>

                  {/* Source Quotes Badges */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-600">Source Quotations to be Consolidated:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {fullQuotes.map((q) => (
                        <div
                          key={q.id}
                          className="bg-white p-2.5 rounded-lg border border-purple-100 shadow-sm flex flex-col justify-between hover:border-purple-300 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{q.quote_number}</span>
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              {formatCurrency(q.grand_total || q.total_amount)}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 truncate" title={q.company_name || q.client_name}>
                            Client: <span className="text-slate-800 font-bold">{q.company_name || q.client_name || '—'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate" title={q.project_name || q.project_details}>
                            Project: <span className="text-slate-700 font-medium">{q.project_name || q.project_details || 'General'}</span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400 flex items-center justify-between">
                            <span>{q.items?.length || 0} line item{(q.items?.length || 0) !== 1 ? 's' : ''}</span>
                            <span>{formatDate(q.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Consolidated Line Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Consolidated Line Items ({consolidatedItems.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      All quantities and rates preserved directly from source received quotes
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3">Client / Project / Source</th>
                            <th className="py-2.5 px-3">Drawing / Code</th>
                            <th className="py-2.5 px-3">Material Name</th>
                            <th className="py-2.5 px-3 text-right">Design Qty</th>
                            <th className="py-2.5 px-3 text-right">Quoted Qty</th>
                            <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                            <th className="py-2.5 px-3 text-right">GST</th>
                            <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                            <th className="py-2.5 px-3 text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {consolidatedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 text-[11px]">{item.client_name || '—'}</span>
                                  <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={item.source_project_name}>
                                    {item.source_project_name}
                                  </span>
                                  <span className="font-semibold text-purple-700 text-[10px]">{item.source_quote_number}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {item.drawing_no || item.item_code || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-[160px] truncate" title={item.material_name}>
                                {item.material_name || item.description || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                {item.designQty} <span className="text-[10px] text-slate-400 font-normal">{item.uom}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                {item.quotedQty} <span className="text-[10px] text-purple-600 font-medium">{item.uom}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                                ₹{item.rate.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 text-[11px]">
                                {item.gstPercent}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                ₹{item.amount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                ₹{item.totalAmount.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Remarks & Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
                  <div className="md:col-span-7 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Merge Notes / Remarks</label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any notes or justification for this merged received quotation..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Source quotations will be marked as <span className="font-semibold text-purple-700">MERGED</span> and archived from the active Received Quotes list.
                    </p>
                  </div>

                  <div className="md:col-span-5 bg-gradient-to-br from-purple-50/60 to-indigo-50/40 p-4 rounded-xl border border-purple-100 shadow-sm space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Total Line Items:</span>
                      <span className="font-bold text-slate-800">{consolidatedItems.length}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Taxable Subtotal:</span>
                      <span className="font-mono font-medium text-slate-800">{formatCurrency(financials.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Estimated Tax (GST):</span>
                      <span className="font-mono font-medium text-slate-800">{formatCurrency(financials.tax)}</span>
                    </div>
                    <div className="border-t border-purple-200/80 pt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                      <span className="text-lg font-bold font-mono text-purple-700">
                        {formatCurrency(financials.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Database transaction ensures complete atomic merge or rollback on error.</span>
          </div>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={merging}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={merging}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>

            {step === 1 ? (
              <button
                type="button"
                onClick={handleProceedToReview}
                disabled={internalSelectedQuoteIds.length < 2}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-md shadow-purple-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Next: Review Items ({internalSelectedQuoteIds.length})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMergeSubmit}
                disabled={loading || merging || consolidatedItems.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-md shadow-purple-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {merging ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Merging Quotes...</span>
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4" />
                    <span>Merge Received Quotes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MergeReceivedQuotesModal;
