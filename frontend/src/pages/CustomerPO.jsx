import React, { useState, useMemo } from 'react'
import { Card, FormControl } from '../components/ui.jsx'

const CustomerPO = ({
  companies,
  poForm,
  fieldInputClass,
  onFieldChange,
  poCompanyLocked,
  onUnlockCompany,
  poPdfFile,
  poParseLoading,
  poParseResult,
  onTriggerUpload,
  poItems,
  onItemChange,
  onRemoveItem,
  onAddItem,
  poSummary,
  formatCurrency,
  parseIndianNumber,
  onPushToSalesOrder,
  poSaving,
  editingPoId,
  onResetForm,
  showPoForm,
  poQuotePrices,
  onQuotePriceChange,
  onApproveQuotation,
  onSendToDesign,
  onUpdateQuotationRates,
  quotationRequests,
  quotationRequestsLoading
}) => {
  const [expandedQuoteKey, setExpandedQuoteKey] = useState(null)

  // Group quotation requests by company/batch for "Received" tab
  const groupedQuotes = useMemo(() => {
    const grouped = {}
    quotationRequests.forEach(quote => {
      const key = quote.company_id
      if (!grouped[key]) {
        grouped[key] = {
          id: quote.id,
          company_name: quote.company_name,
          company_id: quote.company_id,
          created_at: quote.created_at,
          status: quote.status,
          total_amount: 0,
          quotes: []
        }
      }
      grouped[key].quotes.push(quote)
      grouped[key].total_amount += parseFloat(quote.total_amount) || 0
    })
    return Object.values(grouped)
  }, [quotationRequests])

  if (showPoForm) {
    return (
      <div className="space-y-8">
        <Card id="customer-po-upload" title={editingPoId ? "Edit Customer PO" : "Upload Customer PO (PDF or Excel)"} subtitle={editingPoId ? `Editing PO ID: ${editingPoId}` : "Auto Read & Fill"}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.35em] text-slate-400 uppercase">Step 1 • File Intake</p>
              <p className="text-sm text-slate-500 mt-1">
                {editingPoId 
                  ? "You are currently editing an existing PO. You can still upload a file to auto-fill fields if needed."
                  : "Upload SIDEL / Phoenix / Bossar PO PDFs or Excel files to auto-fill the header and line items below."}
              </p>
              <p className="text-xs text-slate-400 mt-1">{poPdfFile ? `Attached: ${poPdfFile.name}` : 'No file attached yet.'}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-slate-300"
                onClick={onResetForm}
              >
                Cancel & Back
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
                onClick={onTriggerUpload}
                disabled={poParseLoading}
              >
                {poParseLoading ? 'Reading…' : 'Upload File'}
              </button>
            </div>
          </div>

          {poParseResult && (
            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-600 mt-4">
              <p><span className="font-semibold text-slate-900 text-xs">Detected Company:</span> {poParseResult.companyName || '—'}</p>
              <p><span className="font-semibold text-slate-900 text-xs">GSTIN:</span> {poParseResult.customerGstin || '—'}</p>
              <p><span className="font-semibold text-slate-900 text-xs">PO Number:</span> {poParseResult.poNumber || '—'}</p>
              <p><span className="font-semibold text-slate-900 text-xs">PO Date:</span> {poParseResult.poDate || '—'}</p>
            </div>
          )}
        </Card>

        <Card id="customer-po-header" title="Customer PO Header" subtitle="Manual Entry + Auto Fill">
          <div className="grid gap-5 lg:grid-cols-3">
            <FormControl label="Company *">
              <div className="flex items-center gap-2">
                <select
                  className={`${fieldInputClass} flex-1`}
                  value={poForm.companyId}
                  onChange={e => onFieldChange('companyId', e.target.value)}
                  disabled={poCompanyLocked}
                >
                  <option value="">Select company</option>
                  {companies.map(company => (
                    <option key={`po-company-${company.id}`} value={company.id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
                {poCompanyLocked && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    onClick={onUnlockCompany}
                  >
                    ✏️
                  </button>
                )}
              </div>
              {poCompanyLocked && <p className="text-xs text-slate-400 mt-1">Auto-detected from PDF. Tap to override.</p>}
            </FormControl>
            <FormControl label="PO Number *">
              <input className={fieldInputClass} value={poForm.poNumber} onChange={e => onFieldChange('poNumber', e.target.value)} placeholder="Purchase order number" />
            </FormControl>
            <FormControl label="PO Date *">
              <input type="date" className={fieldInputClass} value={poForm.poDate} onChange={e => onFieldChange('poDate', e.target.value)} />
            </FormControl>
            <FormControl label="Payment Terms">
              <input className={fieldInputClass} value={poForm.paymentTerms} onChange={e => onFieldChange('paymentTerms', e.target.value)} placeholder="45 days" />
            </FormControl>
            <FormControl label="Credit Days">
              <input type="number" className={fieldInputClass} value={poForm.creditDays} onChange={e => onFieldChange('creditDays', e.target.value)} placeholder="45" />
            </FormControl>
            <FormControl label="Currency">
              <select className={fieldInputClass} value={poForm.currency} onChange={e => onFieldChange('currency', e.target.value)}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </FormControl>
            <FormControl label="Freight Terms">
              <input className={fieldInputClass} value={poForm.freightTerms} onChange={e => onFieldChange('freightTerms', e.target.value)} placeholder="Included / Ex Works" />
            </FormControl>
            <FormControl label="Packing & Forwarding">
              <input className={fieldInputClass} value={poForm.packingForwarding} onChange={e => onFieldChange('packingForwarding', e.target.value)} />
            </FormControl>
            <FormControl label="Insurance">
              <input className={fieldInputClass} value={poForm.insuranceTerms} onChange={e => onFieldChange('insuranceTerms', e.target.value)} />
            </FormControl>
          </div>
          <div className="grid gap-5 lg:grid-cols-2 mt-5">
            <FormControl label="Delivery Terms">
              <input className={fieldInputClass} value={poForm.deliveryTerms} onChange={e => onFieldChange('deliveryTerms', e.target.value)} placeholder="As per item" />
            </FormControl>
            <FormControl label="Remarks">
              <textarea className={`${fieldInputClass} min-h-[96px]`} value={poForm.remarks} onChange={e => onFieldChange('remarks', e.target.value)} placeholder="Internal notes or customer remarks" />
            </FormControl>
          </div>
        </Card>

        <Card id="customer-po-items" title="Line Items" subtitle="Auto + Manual">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-500 uppercase tracking-[0.2em] text-[0.65rem]">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Drawing No</th>
                  <th className="px-3 py-3 text-left font-semibold">Description</th>
                  <th className="px-3 py-3 text-left font-semibold">Qty</th>
                  <th className="px-3 py-3 text-left font-semibold">Rate</th>
                  <th className="px-3 py-3 text-left font-semibold">CGST %</th>
                  <th className="px-3 py-3 text-left font-semibold">SGST %</th>
                  <th className="px-3 py-3 text-left font-semibold">IGST %</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {poItems.map((item, index) => (
                  <tr key={`po-item-${index}`} className="border-t border-slate-100">
                    <td className="p-2">
                      <input className={`${fieldInputClass} py-2`} value={item.drawingNo} onChange={e => onItemChange(index, 'drawingNo', e.target.value)} placeholder="Drawing No" />
                    </td>
                    <td className="p-2">
                      <input className={`${fieldInputClass} py-2`} value={item.description} onChange={e => onItemChange(index, 'description', e.target.value)} placeholder="Description" />
                    </td>
                    <td className="p-2">
                      <input type="number" className={`${fieldInputClass} py-2`} value={item.quantity} onChange={e => onItemChange(index, 'quantity', e.target.value)} min="0" />
                    </td>
                    <td className="p-2">
                      <input type="number" className={`${fieldInputClass} py-2`} value={item.rate} onChange={e => onItemChange(index, 'rate', e.target.value)} min="0" />
                    </td>
                    <td className="p-2">
                      <input type="number" className={`${fieldInputClass} py-2`} value={item.cgstPercent} onChange={e => onItemChange(index, 'cgstPercent', e.target.value)} min="0" />
                    </td>
                    <td className="p-2">
                      <input type="number" className={`${fieldInputClass} py-2`} value={item.sgstPercent} onChange={e => onItemChange(index, 'sgstPercent', e.target.value)} min="0" />
                    </td>
                    <td className="p-2">
                      <input type="number" className={`${fieldInputClass} py-2`} value={item.igstPercent} onChange={e => onItemChange(index, 'igstPercent', e.target.value)} min="0" />
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-900 text-xs">
                      {formatCurrency((parseIndianNumber(item.quantity) || 0) * (parseIndianNumber(item.rate) || 0))}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="px-3 py-2 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:opacity-40"
                          onClick={() => onRemoveItem(index)}
                          disabled={poItems.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="mt-4 px-4 py-2 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300" onClick={onAddItem}>
            + Add Line Item
          </button>
        </Card>

        <Card id="customer-po-summary" title="Tax & Summary" subtitle="Review & Confirm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900 text-xs">{formatCurrency(poSummary.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>CGST</span>
                <span className="font-semibold text-slate-900 text-xs">{formatCurrency(poSummary.cgst)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>SGST</span>
                <span className="font-semibold text-slate-900 text-xs">{formatCurrency(poSummary.sgst)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>IGST</span>
                <span className="font-semibold text-slate-900 text-xs">{formatCurrency(poSummary.igst)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-sm text-slate-500">Net Value</p>
              <p className="text-3xl font-semibold text-slate-900 text-xs">{formatCurrency(poSummary.net)}</p>
              <p className="text-xs text-slate-500">Totals auto-update as you tweak line items.</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">Validate the PO, then push it forward to Sales Order.</p>
            <button
              type="button"
              className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
              onClick={onPushToSalesOrder}
              disabled={poSaving}
            >
              {poSaving ? 'Saving…' : (editingPoId ? 'Update Customer PO' : 'Push to Sales Order')}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Customer Purchase Orders</h1>
            <p className="text-slate-600 text-xs">Manage and track purchase orders received from customers</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-2">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Received Quotations (Send for Approval)
              </h2>
            </div>
          </div>

          <div className="p-0">
            {quotationRequestsLoading ? (
              <div className="py-12 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-600 font-semibold text-sm">Loading quotations...</p>
              </div>
            ) : groupedQuotes.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p className="text-slate-500 font-semibold">No received quotations found</p>
                <p className="text-slate-400 text-sm mt-1">Quotations sent from the Sales module will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-100">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Quote ID / Client</th>
                      <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Sent Date</th>
                      <th className="p-2 text-center text-xs font-bold text-slate-700 uppercase">Status</th>
                      <th className="p-2 text-right text-xs font-bold text-slate-700 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {groupedQuotes.map((group) => {
                      const isExpanded = expandedQuoteKey === group.company_id;
                      return (
                        <React.Fragment key={group.company_id}>
                          <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setExpandedQuoteKey(isExpanded ? null : group.company_id)}>
                            <td className="p-2">
                              <div className="font-semibold text-indigo-600 text-xs flex items-center gap-2">
                                <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                QRT-{group.id.toString().padStart(4, '0')}
                              </div>
                              <div className="text-[0.65rem] text-slate-500 mt-0.5 ml-4 font-bold">{group.company_name}</div>
                            </td>
                            <td className="p-2">
                              <div className="text-xs text-slate-600 font-semibold">
                                {new Date(group.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider ${
                                group.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                                group.status === 'APPROVAL' ? 'bg-blue-100 text-blue-700' :
                                group.status === 'COMPLETED' ? 'bg-slate-100 text-slate-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {group.status}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              {group.status === 'APPROVAL' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSendToDesign(group.quotes);
                                  }}
                                  className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm inline-flex items-center justify-center"
                                  title="Send to Design"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                  </svg>
                                </button>
                              ) : group.status === 'PENDING' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onApproveQuotation(group.quotes);
                                  }}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded text-[0.65rem] font-bold hover:bg-indigo-700 transition-colors uppercase"
                                >
                                  Create Quotation
                                </button>
                              ) : (
                                <span className="text-[0.65rem] text-slate-400 font-bold uppercase px-2">Completed</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="4" className="bg-slate-50 p-4">
                                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <table className="w-full text-[0.65rem]">
                                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                                      <tr>
                                        <th className="p-2 text-left">Drawing No</th>
                                        <th className="p-2 text-left">Description</th>
                                        <th className="p-2 text-center">Qty</th>
                                        <th className="p-2 text-right">Quoted Rate</th>
                                        <th className="p-2 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {group.quotes.map(item => {
                                        const rate = poQuotePrices[`q-${item.id}`] || '';
                                        const amount = (parseFloat(item.item_qty) || 0) * (parseFloat(rate) || 0);
                                        return (
                                          <tr key={`quote-item-${item.id}`} className="hover:bg-slate-50">
                                            <td className="p-2 font-bold text-slate-900">{item.drawing_no}</td>
                                            <td className="p-2 text-slate-600">{item.item_description || '—'}</td>
                                            <td className="p-2 text-center font-semibold">
                                              {item.item_qty !== null ? Number(item.item_qty).toFixed(0) : '0'} {item.item_unit || 'NOS'}
                                            </td>
                                            <td className="p-2 text-right">
                                              <input
                                                type="number"
                                                placeholder="₹ 0.00"
                                                className="w-24 p-1 border border-slate-200 rounded text-right text-[0.65rem] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={rate}
                                                onChange={(e) => onQuotePriceChange(`q-${item.id}`, e.target.value)}
                                              />
                                            </td>
                                            <td className="p-2 text-right font-bold text-slate-900">
                                              {formatCurrency(amount)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                      <tr>
                                        <td colSpan="4" className="p-2 text-right font-bold text-slate-600 uppercase tracking-wider">Total Amount:</td>
                                        <td className="p-2 text-right font-bold text-indigo-600 text-sm">
                                          {formatCurrency(group.quotes.reduce((sum, item) => {
                                            const rate = poQuotePrices[`q-${item.id}`] || 0;
                                            return sum + ((parseFloat(item.item_qty) || 0) * (parseFloat(rate) || 0));
                                          }, 0))}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                                <div className="mt-3 flex justify-end gap-3">
                                  <button
                                    onClick={() => onUpdateQuotationRates(group.quotes)}
                                    className="px-4 py-1.5 border border-indigo-600 text-indigo-600 rounded-lg text-[0.65rem] font-bold hover:bg-indigo-50 transition-colors uppercase tracking-wider"
                                  >
                                    Update Quotation
                                  </button>
                                  {group.status === 'APPROVAL' ? (
                                    <button
                                      onClick={() => onSendToDesign(group.quotes)}
                                      className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[0.65rem] font-bold hover:bg-emerald-700 transition-colors uppercase tracking-wider flex items-center gap-2"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                      </svg>
                                      Send to Design
                                    </button>
                                  ) : group.status === 'PENDING' && (
                                    <button
                                      onClick={() => onApproveQuotation(group.quotes)}
                                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[0.65rem] font-bold hover:bg-indigo-700 transition-colors uppercase tracking-wider"
                                    >
                                      Create Quotation
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerPO
