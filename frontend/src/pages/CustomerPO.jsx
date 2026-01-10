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
  customerPos,
  customerPosLoading,
  onEditPo,
  onDeletePo,
  onViewPo,
  editingPoId,
  onResetForm,
  showPoForm
}) => (
  <div className="space-y-8">
    {showPoForm ? (
      <>
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
          {editingPoId && (
            <button
              type="button"
              className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-slate-300"
              onClick={onResetForm}
            >
              Cancel Edit
            </button>
          )}
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
          <p><span className="font-semibold text-slate-900">Detected Company:</span> {poParseResult.companyName || '—'}</p>
          <p><span className="font-semibold text-slate-900">GSTIN:</span> {poParseResult.customerGstin || '—'}</p>
          <p><span className="font-semibold text-slate-900">PO Number:</span> {poParseResult.poNumber || '—'}</p>
          <p><span className="font-semibold text-slate-900">PO Date:</span> {poParseResult.poDate || '—'}</p>
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
                <td className="p-2 text-right font-semibold text-slate-900">
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
            <span className="font-semibold text-slate-900">{formatCurrency(poSummary.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>CGST</span>
            <span className="font-semibold text-slate-900">{formatCurrency(poSummary.cgst)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>SGST</span>
            <span className="font-semibold text-slate-900">{formatCurrency(poSummary.sgst)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>IGST</span>
            <span className="font-semibold text-slate-900">{formatCurrency(poSummary.igst)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm text-slate-500">Net Value</p>
          <p className="text-3xl font-semibold text-slate-900">{formatCurrency(poSummary.net)}</p>
          <p className="text-xs text-slate-500">Totals auto-update as you tweak line items.</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-4 border-t border-slate-100">
        <p className="text-sm text-slate-500">Validate the PO, then push it forward to Sales Order. The workflow automatically hands off to Design → Production → Dispatch → Invoice.</p>
        <button
          type="button"
          className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-50"
          onClick={onPushToSalesOrder}
          disabled={poSaving}
        >
          {poSaving ? 'Saving…' : (editingPoId ? 'Update Customer PO' : 'Push to Sales Order')}
        </button>
      </div>
    </Card>
      </>
    ) : (
    <Card id="customer-po-list" title="Customer PO List" subtitle="Recent entries and actions">
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-500 uppercase tracking-[0.2em] text-[0.65rem]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">PO No</th>
              <th className="px-4 py-3 text-left font-semibold">Company</th>
              <th className="px-4 py-3 text-left font-semibold">PO Date</th>
              <th className="px-4 py-3 text-left font-semibold">Delivery</th>
              <th className="px-4 py-3 text-center font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Value</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customerPosLoading ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-slate-400">Loading records...</td>
              </tr>
            ) : customerPos.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-slate-400">No Customer POs found.</td>
              </tr>
            ) : (
              customerPos.map(po => {
                const poDate = po.po_date ? new Date(po.po_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                const deliveryTerms = po.delivery_terms || '—'
                
                return (
                  <tr key={`po-row-${po.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{po.po_number}</td>
                    <td className="px-4 py-3 text-slate-600">{po.company_name}</td>
                    <td className="px-4 py-3 text-slate-600">{poDate}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">{deliveryTerms}</td>
                    <td className="px-4 py-3 text-center text-slate-600 font-semibold">
                      {po.total_qty || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(po.net_total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-[0.65rem] font-bold uppercase tracking-wider ${
                        po.status === 'DRAFT' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                          onClick={() => onViewPo(po.id)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                          onClick={() => onEditPo(po)}
                          title="Edit PO"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => onDeletePo(po.id)}
                          title="Delete PO"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
    )}
  </div>
)

export default CustomerPO
