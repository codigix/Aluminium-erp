import React, { useState, useEffect } from 'react';
import { SearchableSelect } from './ui.jsx';
import { GitMerge, Search } from 'lucide-react';
import Swal from 'sweetalert2';
import { errorToast, successToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const rfqStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  RFQ_REQUESTED: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'RFQ Requested' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  PENDING_ITEMS: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending Items' },
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' }
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const MergeRfqModal = ({ isOpen, onClose, onSuccess }) => {
  const [mergeStep, setMergeStep] = useState(1);
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [eligibleRfqs, setEligibleRfqs] = useState([]);
  const [selectedRfqIds, setSelectedRfqIds] = useState([]);
  const [mergedItems, setMergedItems] = useState([]);
  const [mergeNotes, setMergeNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMergeStep(1);
      setSelectedVendorId('');
      setEligibleRfqs([]);
      setSelectedRfqIds([]);
      setMergedItems([]);
      setMergeNotes('');
      setSearchTerm('');
      fetchEligibleVendors();
    }
  }, [isOpen]);

  const fetchEligibleVendors = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/rfqs/merge/vendors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(Array.isArray(data) ? data : []);
      } else {
        errorToast('Failed to load eligible suppliers');
      }
    } catch (error) {
      console.error('Error fetching vendors for merge:', error);
      errorToast('Network error loading suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorChange = async (vendorId) => {
    setSelectedVendorId(vendorId);
    setSelectedRfqIds([]);
    setEligibleRfqs([]);
    if (!vendorId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/rfqs/merge/eligible?vendorId=${vendorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setEligibleRfqs(Array.isArray(data) ? data : []);
      } else {
        errorToast('Failed to fetch eligible RFQs for supplier');
      }
    } catch (error) {
      console.error('Error fetching eligible RFQs:', error);
      errorToast('Network error loading RFQs');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRfqSelection = (rfqId) => {
    setSelectedRfqIds(prev =>
      prev.includes(rfqId) ? prev.filter(id => id !== rfqId) : [...prev, rfqId]
    );
  };

  const handleSelectAllRfqs = () => {
    if (selectedRfqIds.length === eligibleRfqs.length) {
      setSelectedRfqIds([]);
    } else {
      setSelectedRfqIds(eligibleRfqs.map(r => r.id));
    }
  };

  const handleProceedToReview = () => {
    if (selectedRfqIds.length < 2) {
      return errorToast('Please select at least 2 RFQs to merge');
    }

    const selectedRfqs = eligibleRfqs.filter(r => selectedRfqIds.includes(r.id));
    
    // Line-by-line item collection preserving source RFQ traceability
    const consolidated = [];
    selectedRfqs.forEach(rfq => {
      const items = rfq.items || [];
      items.forEach(item => {
        // Pick latest quote_item (highest version) for rate data
        const quoteItems = Array.isArray(item.quote_items) ? item.quote_items : [];
        const latestQuote = quoteItems.length > 0
          ? quoteItems.reduce((best, qi) => (Number(qi.quote_version || 0) >= Number(best.quote_version || 0) ? qi : best), quoteItems[0])
          : null;

        consolidated.push({
          ...item,
          source_rfq_id: rfq.id,
          source_rfq_item_id: item.id,
          source_rfq_number: rfq.rfq_number,
          project_name: rfq.project_name || 'General Procurement',
          drawing_no: item.drawing_no || rfq.drawing_no || '—',
          quantity: parseFloat(item.quantity) || 0,
          planned_qty: parseFloat(item.planned_qty) || parseFloat(item.quantity) || 0,
          uom: item.uom || item.unit || 'NOS',
          // Quotation-derived fields
          design_qty: latestQuote ? parseFloat(latestQuote.design_qty) || parseFloat(item.planned_qty) || parseFloat(item.quantity) || 0 : (parseFloat(item.planned_qty) || parseFloat(item.quantity) || 0),
          design_uom: latestQuote?.uom || item.uom || item.unit || 'Nos',
          quoted_qty: latestQuote ? parseFloat(latestQuote.quantity) || 0 : 0,
          quoted_uom: latestQuote?.uom || item.uom || 'Kg',
          unit_rate: latestQuote ? parseFloat(latestQuote.unit_rate) || 0 : 0,
          amount: latestQuote ? parseFloat(latestQuote.amount) || 0 : 0,
        });
      });
    });

    if (consolidated.length === 0) {
      return errorToast('Selected RFQs contain no line items to merge');
    }

    setMergedItems(consolidated);
    setMergeNotes(`Merged from: ${selectedRfqs.map(r => r.rfq_number).join(', ')}`);
    setMergeStep(3);
  };

  const handleRemoveMergedItem = (idxToRemove) => {
    setMergedItems(prev => {
      const updated = prev.filter((_, idx) => idx !== idxToRemove);
      if (updated.length === 0) {
        errorToast('At least one item is required');
      }
      return updated;
    });
  };

  const handleMergedItemQuantityChange = (idx, value) => {
    const val = Math.max(0, parseFloat(value) || 0);
    setMergedItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: val };
      return copy;
    });
  };

  const handleCreateMergedRfq = async () => {
    if (selectedRfqIds.length < 2) {
      return errorToast('At least 2 source RFQs are required to merge');
    }
    if (mergedItems.length === 0) {
      return errorToast('At least one line item is required in the merged RFQ');
    }

    setMerging(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/rfqs/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          sourceRfqIds: selectedRfqIds,
          items: mergedItems,
          notes: mergeNotes
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.error || 'Failed to merge RFQs');
      }

      const selectedVendor = vendors.find(v => String(v.id) === String(selectedVendorId));

      await Swal.fire({
        icon: 'success',
        title: 'Merged RFQ Created',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6;">
            <div style="padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px;">
              <div><strong>New RFQ Number:</strong> <span style="color: #4f46e5; font-weight: 700; font-family: monospace;">${resData.data?.rfq_number}</span></div>
              <div><strong>Supplier:</strong> ${selectedVendor?.vendor_name || 'Selected Supplier'}</div>
              <div><strong>Consolidated Items:</strong> ${resData.data?.items_count || mergedItems.length} line item(s)</div>
            </div>
            <div>
              <p style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin: 0 0 4px 0;">Source RFQs Merged:</p>
              <div style="max-height: 90px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; background: #fff;">
                ${(resData.data?.source_rfqs || []).map(r => `<div style="padding: 2px 0; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-size: 12px; color: #334155;">${r.rfq_number}</div>`).join('')}
              </div>
            </div>
          </div>
        `,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Close & Refresh'
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Create Merged RFQ error:', error);
      errorToast(error.message || 'Failed to create Merged RFQ');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const selectedVendor = vendors.find(v => String(v.id) === String(selectedVendorId));
  const searchLower = searchTerm.toLowerCase().trim();
  const filteredRfqs = eligibleRfqs.filter(r =>
    String(r.rfq_number || '').toLowerCase().includes(searchLower) ||
    String(r.project_name || '').toLowerCase().includes(searchLower) ||
    String(r.drawing_no || '').toLowerCase().includes(searchLower)
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Merge RFQs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Consolidate multiple RFQs for a single vendor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps Progress Indicator */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-center gap-4 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mergeStep >= 1 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</span>
            <span className={mergeStep === 1 ? 'text-purple-600 font-bold' : ''}>Select Vendor</span>
          </div>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mergeStep >= 2 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
            <span className={mergeStep === 2 ? 'text-purple-600 font-bold' : ''}>Select Draft RFQs</span>
          </div>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mergeStep >= 3 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</span>
            <span className={mergeStep === 3 ? 'text-purple-600 font-bold' : ''}>Review Merged Form</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {/* STEP 1: Select Supplier */}
          {mergeStep === 1 && (
            <div className="space-y-4 max-w-md mx-auto py-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                  Supplier / Vendor *
                </label>
                <SearchableSelect
                  options={vendors.map(v => ({
                    ...v,
                    displayLabel: `${v.vendor_name} (${v.eligible_rfqs_count || 0} RFQs)`
                  }))}
                  value={selectedVendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  placeholder="Choose Supplier"
                  labelField="displayLabel"
                  valueField="id"
                  allowCustom={false}
                  openUpwards={true}
                />
              </div>

              {selectedVendorId && (
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl text-xs text-purple-700 animate-in fade-in duration-300">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Checking for eligible RFQs...
                    </span>
                  ) : eligibleRfqs.length >= 2 ? (
                    <span>Found <b>{eligibleRfqs.length}</b> eligible RFQs for this supplier. Click Next to select RFQs to merge.</span>
                  ) : eligibleRfqs.length === 1 ? (
                    <span className="text-amber-700">Found <b>1</b> eligible RFQ. (Note: At least 2 RFQs are required to perform a merge).</span>
                  ) : (
                    <span className="text-slate-500">No unmerged RFQs found for this supplier.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select RFQs */}
          {mergeStep === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Eligible RFQs</h3>
                  <button
                    type="button"
                    onClick={handleSelectAllRfqs}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 underline"
                  >
                    {selectedRfqIds.length === eligibleRfqs.length ? 'Clear Selection' : 'Select All'}
                  </button>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search RFQ no, project, drawing..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {selectedRfqIds.length} Selected (Min 2)
                  </span>
                </div>
              </div>

              {filteredRfqs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-xs text-slate-500 font-semibold">No eligible RFQs found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] z-10">
                      <tr>
                        <th className="p-3 w-12 text-center">Select</th>
                        <th className="p-3">RFQ No</th>
                        <th className="p-3">Project</th>
                        <th className="p-3">Drawing</th>
                        <th className="p-3 text-right">Items</th>
                        <th className="p-3">Created</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRfqs.map(rfq => {
                        const isChecked = selectedRfqIds.includes(rfq.id);
                        return (
                          <tr
                            key={rfq.id}
                            className={`hover:bg-slate-50/50 transition-all cursor-pointer ${isChecked ? 'bg-purple-50/20' : ''}`}
                            onClick={() => handleToggleRfqSelection(rfq.id)}
                          >
                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRfqSelection(rfq.id)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500/20 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-semibold text-slate-800 font-mono">{rfq.rfq_number}</td>
                            <td className="p-3 text-slate-600">{rfq.project_name || 'General Procurement'}</td>
                            <td className="p-3 text-slate-700 font-medium">{rfq.drawing_no || '—'}</td>
                            <td className="p-3 text-right text-slate-700 font-bold">{rfq.items_count || (rfq.items || []).length}</td>
                            <td className="p-3 text-slate-500">{formatDate(rfq.created_at)}</td>
                            <td className="p-3">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border ${rfqStatusColors[rfq.status]?.badge || 'bg-slate-100 text-slate-700'}`}>
                                {rfqStatusColors[rfq.status]?.label || rfq.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Review Merged Form */}
          {mergeStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Header Summary */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Supplier</span>
                  <span className="text-xs font-black text-slate-700">{selectedVendor?.vendor_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Consolidated Projects</span>
                  <span className="text-xs font-semibold text-slate-600">
                    {Array.from(new Set(mergedItems.map(i => i.project_name))).filter(Boolean).join(', ') || 'General Procurement'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Original RFQs Count</span>
                  <span className="text-xs font-semibold text-slate-600">{selectedRfqIds.length} RFQs to be merged</span>
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 block">Merge Notes / Remarks</label>
                <input
                  type="text"
                  value={mergeNotes}
                  onChange={(e) => setMergeNotes(e.target.value)}
                  placeholder="e.g. Consolidated RFQ for upcoming production cycle"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                />
              </div>

              {/* Consolidated Line Items Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Consolidated Line Items ({mergedItems.length})
                  </h4>
                  <span className="text-[10px] text-slate-400 italic">
                    Every item is preserved with its source RFQ reference for full traceability.
                  </span>
                </div>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-[45vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-xs text-left min-w-[780px]">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] z-10">
                      <tr>
                        <th className="p-3">Source RFQ</th>
                        <th className="p-3">Project</th>
                        <th className="p-3">Drawing</th>
                        <th className="p-3">Material / Description</th>
                        <th className="p-3 text-right">Design Qty</th>
                        <th className="p-3 text-right">Quoted Qty</th>
                        <th className="p-3 text-right">Unit Rate (₹/Kg)</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedItems.map((item, idx) => {
                        const hasRate = item.unit_rate > 0;
                        const amount = item.amount || (item.quoted_qty * item.unit_rate) || 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                            <td className="p-3">
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded font-mono text-[10px] font-bold whitespace-nowrap">
                                {item.source_rfq_number}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{item.project_name || '—'}</td>
                            <td className="p-3 font-mono text-slate-600 font-semibold whitespace-nowrap">{item.drawing_no || '—'}</td>
                            <td className="p-3 text-slate-700 font-medium">
                              <div className="font-semibold">{item.material_name || item.description || item.item_code || '—'}</div>
                              {item.item_code && <div className="text-[10px] text-slate-400 font-mono">{item.item_code}</div>}
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-bold text-slate-700">
                                {item.design_qty > 0 ? `${Number(item.design_qty).toFixed(3)} ${item.design_uom || 'Nos'}` : '—'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-bold text-slate-700">
                                {item.quoted_qty > 0 ? `${Number(item.quoted_qty).toFixed(3)} Kg` : '0 Kg'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {hasRate ? (
                                <span className="font-bold text-slate-700">{Number(item.unit_rate).toFixed(2)}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <span className={`font-bold ${amount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {amount > 0 ? `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMergedItem(idx)}
                                className="text-rose-400 hover:bg-rose-50 p-1 rounded-md transition-all"
                                title="Remove item"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Footer totals */}
                    {mergedItems.length > 0 && (() => {
                      const totalAmount = mergedItems.reduce((sum, item) => sum + (item.amount || (item.quoted_qty * item.unit_rate) || 0), 0);
                      return (
                        <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                          <tr>
                            <td colSpan={7} className="p-3 text-right text-xs font-black text-slate-600 uppercase tracking-wider">Total Amount</td>
                            <td className="p-3 text-right">
                              <span className="font-black text-emerald-700 text-sm">
                                {totalAmount > 0 ? `₹${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                              </span>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div>
            {mergeStep > 1 && (
              <button
                type="button"
                onClick={() => setMergeStep(prev => prev - 1)}
                className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all active:scale-98"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>

            {mergeStep === 1 && (
              <button
                type="button"
                disabled={!selectedVendorId || loading || eligibleRfqs.length < 2}
                onClick={() => setMergeStep(2)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200 active:scale-98"
                title={eligibleRfqs.length < 2 ? 'At least 2 eligible RFQs required' : 'Proceed to select RFQs'}
              >
                Next
              </button>
            )}

            {mergeStep === 2 && (
              <button
                type="button"
                disabled={selectedRfqIds.length < 2 || loading}
                onClick={handleProceedToReview}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200 active:scale-98"
                title={selectedRfqIds.length < 2 ? 'Please select at least 2 RFQs' : 'Proceed to review form'}
              >
                Next
              </button>
            )}

            {mergeStep === 3 && (
              <button
                type="button"
                disabled={merging || mergedItems.length === 0}
                onClick={handleCreateMergedRfq}
                className="flex items-center gap-1.5 px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-purple-200 active:scale-98"
              >
                {merging ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Creating Merged RFQ...</span>
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4" />
                    <span>Create Merged RFQ</span>
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

export default MergeRfqModal;
