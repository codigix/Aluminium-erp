import React, { useState } from 'react'
import { Card, FormControl } from '../components/ui.jsx'
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const MaterialInputTable = ({ materials, onAdd, onDelete }) => {
  const [newMat, setNewMat] = useState({ materialName: '', materialType: 'RAW', qtyPerPc: '', uom: 'KG' });

  return (
    <div className="mt-3 bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Item Bill of Materials (BOM)</h5>
        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          {materials?.length || 0} Materials Defined
        </span>
      </div>

      <div className="p-4">
        {/* Rapid Entry Form */}
        <div className="grid grid-cols-12 gap-2 mb-4 items-end bg-slate-50/50 p-3 rounded-lg border border-dashed border-slate-200">
          <div className="col-span-5 space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Material Name</label>
            <input 
              placeholder="e.g. MS Plate 10mm" 
              className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
              value={newMat.materialName}
              onChange={e => setNewMat({...newMat, materialName: e.target.value})}
            />
          </div>
          <div className="col-span-3 space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Type</label>
            <select 
              className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
              value={newMat.materialType}
              onChange={e => setNewMat({...newMat, materialType: e.target.value})}
            >
              <option value="RAW">RAW MATERIAL</option>
              <option value="BOUGHT">BOUGHT OUT</option>
              <option value="SERVICE">SERVICE / JOBWORK</option>
              <option value="CONSUMABLE">CONSUMABLE</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Qty/Pc</label>
            <input 
              placeholder="0.000" 
              type="number"
              step="0.001"
              className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-mono"
              value={newMat.qtyPerPc}
              onChange={e => setNewMat({...newMat, qtyPerPc: e.target.value})}
            />
          </div>
          <div className="col-span-2">
            <button 
              type="button"
              onClick={() => {
                if (newMat.materialName && newMat.qtyPerPc) {
                  onAdd(newMat);
                  setNewMat({ materialName: '', materialType: 'RAW', qtyPerPc: '', uom: 'KG' });
                }
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] py-2 rounded font-bold uppercase transition-colors shadow-sm"
            >
              Add Row
            </button>
          </div>
        </div>

        {/* Material List */}
        {materials && materials.length > 0 ? (
          <div className="overflow-hidden border border-slate-100 rounded-lg">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-400 uppercase tracking-tighter border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Material</th>
                  <th className="px-3 py-2 text-left font-bold">Category</th>
                  <th className="px-3 py-2 text-right font-bold">Qty/Pc</th>
                  <th className="px-3 py-2 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {materials.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-3 py-2 font-semibold text-slate-700">{m.materialName}</td>
                    <td className="px-3 py-2">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                         m.materialType === 'RAW' ? 'bg-blue-50 text-blue-600' : 
                         m.materialType === 'BOUGHT' ? 'bg-purple-50 text-purple-600' :
                         'bg-slate-100 text-slate-600'
                       }`}>
                         {m.materialType}
                       </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 font-mono">{parseFloat(m.qtyPerPc).toFixed(3)}</td>
                    <td className="px-3 py-2 text-right">
                      <button 
                        type="button" 
                        onClick={() => onDelete(i)} 
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                        title="Remove Material"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50/30 rounded-lg border border-dashed border-slate-100">
            <p className="text-[10px] text-slate-400 italic">No materials defined for this drawing yet. Use the form above to add.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const statusStyles = {
  CREATED: 'bg-blue-50 border-blue-200 text-blue-600',
  DESIGN_IN_REVIEW: 'bg-indigo-50 border-indigo-200 text-indigo-600',
  DESIGN_APPROVED: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  DESIGN_QUERY: 'bg-amber-50 border-amber-200 text-amber-600',
  PROCUREMENT_IN_PROGRESS: 'bg-purple-50 border-purple-200 text-purple-600',
  MATERIAL_PURCHASE_IN_PROGRESS: 'bg-orange-50 border-orange-200 text-orange-600',
  MATERIAL_READY: 'bg-cyan-50 border-cyan-200 text-cyan-600',
  IN_PRODUCTION: 'bg-red-50 border-red-200 text-red-600',
  PRODUCTION_COMPLETED: 'bg-lime-50 border-lime-200 text-lime-600',
  CLOSED: 'bg-slate-50 border-slate-200 text-slate-600',
  DRAFT: 'bg-slate-100 border-slate-200 text-slate-600'
}

const formatStatus = status =>
  (status || 'DRAFT')
    .split('_')
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ')

const formatPriority = priority => {
  const value = (priority || 'NORMAL').toUpperCase()
  return value.charAt(0) + value.slice(1).toLowerCase()
}

const formatDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatOrderCode = id => {
  if (!id && id !== 0) return '—'
  return `SO-${String(id).padStart(4, '0')}`
}

const formatCurrency = (value, currency = 'INR') => {
  const normalized = (currency || 'INR').toUpperCase()
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: normalized, minimumFractionDigits: 2 }).format(Number(value) || 0)
  } catch {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value) || 0)
  }
}

const SalesOrders = ({ 
  orders, 
  loading, 
  onRefresh, 
  onViewPo, 
  getPoPdfUrl, 
  onSendOrder,
  showSalesOrderForm,
  salesOrderForm,
  onFieldChange,
  onSubmit,
  onResetForm,
  companies,
  customerPos,
  selectedPoForSo,
  soItems,
  setSoItems,
  poItemsLoading,
  fieldInputClass
}) => {
  const [expandedItems, setExpandedItems] = useState({})
  const list = Array.isArray(orders) ? orders : []
  const hasOrders = list.length > 0

  if (showSalesOrderForm) {
    const filteredPos = (customerPos || []).filter(po => String(po.company_id) === String(salesOrderForm.companyId))
    const selectedCompany = (companies || []).find(c => String(c.id) === String(salesOrderForm.companyId))

    return (
      <div className="space-y-8">
        <Card id="new-sales-order" title="Create New Sales Order" subtitle="Workflow Intake">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* --- Section 1: Customer Selection & Details --- */}
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Customer Details</h3>
              
              <FormControl label="Company *">
                <select
                  className={fieldInputClass}
                  value={salesOrderForm.companyId}
                  onChange={e => {
                    onFieldChange('companyId', e.target.value)
                    onFieldChange('customerPoId', '')
                  }}
                >
                  <option value="">Select Company</option>
                  {(companies || []).map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </FormControl>

              <div className="grid grid-cols-2 gap-4">
                <FormControl label="Customer Type">
                  <input
                    readOnly
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed`}
                    value={selectedCompany?.customer_type || '—'}
                  />
                </FormControl>
                <FormControl label="Currency">
                  <input
                    readOnly
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed`}
                    value={selectedCompany?.currency || '—'}
                  />
                </FormControl>
              </div>

              <FormControl label="GSTIN">
                <input
                  readOnly
                  className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed uppercase`}
                  value={selectedCompany?.gstin || '—'}
                />
              </FormControl>
            </div>

            {/* --- Section 2: PO Selection & Details --- */}
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Purchase Order Information</h3>
              
              <FormControl label="Customer PO *">
                <select
                  className={fieldInputClass}
                  value={salesOrderForm.customerPoId}
                  onChange={e => onFieldChange('customerPoId', e.target.value)}
                  disabled={!salesOrderForm.companyId}
                >
                  <option value="">Select Customer PO</option>
                  {filteredPos.map(po => (
                    <option key={po.id} value={po.id}>{po.po_number} ({formatDate(po.po_date)})</option>
                  ))}
                </select>
              </FormControl>

              <div className="grid grid-cols-2 gap-4">
                <FormControl label="PO Date">
                  <input
                    readOnly
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed`}
                    value={selectedPoForSo ? formatDate(selectedPoForSo.po_date) : '—'}
                  />
                </FormControl>
                <FormControl label="PO Total">
                  <input
                    readOnly
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed font-semibold`}
                    value={selectedPoForSo ? formatCurrency(selectedPoForSo.net_total, selectedPoForSo.currency) : '—'}
                  />
                </FormControl>
              </div>

              <FormControl label="Payment Terms">
                <input
                  readOnly
                  className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed`}
                  value={selectedPoForSo?.payment_terms || '—'}
                />
              </FormControl>
            </div>

            {/* --- Section 3: Project & Production Setup --- */}
            <div className="col-span-full border-t border-slate-100 pt-6 mt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Production & Project Setup</h3>
              <div className="grid gap-5 lg:grid-cols-3">
                <FormControl label="Project / Job Code">
                  <input
                    readOnly
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed font-bold uppercase`}
                    value={salesOrderForm.projectName || '—'}
                    placeholder="Auto-filled from PO"
                  />
                </FormControl>

                <FormControl label="Production Priority">
                  <select
                    className={fieldInputClass}
                    value={salesOrderForm.productionPriority}
                    onChange={e => onFieldChange('productionPriority', e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                  </select>
                </FormControl>

                <FormControl label="Target Dispatch Date">
                  <input
                    type="date"
                    className={fieldInputClass}
                    value={salesOrderForm.targetDispatchDate}
                    onChange={e => onFieldChange('targetDispatchDate', e.target.value)}
                  />
                </FormControl>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={salesOrderForm.drawingRequired}
                    onChange={e => onFieldChange('drawingRequired', e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-slate-700">Drawing Required</span>
                </label>
              </div>
            </div>

            {poItemsLoading && (
              <div className="col-span-full py-8 flex flex-col items-center justify-center gap-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching PO Details...</p>
              </div>
            )}

            {selectedPoForSo && !poItemsLoading && (
              <div className="col-span-full mt-6 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Review Items from {selectedPoForSo.po_number}</h4>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                      {soItems?.length || 0} Items
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/30 text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left font-bold">Description</th>
                          <th className="px-5 py-3 text-left font-bold w-[180px]">Drawing No</th>
                          <th className="px-5 py-3 text-right font-bold">Qty</th>
                          <th className="px-5 py-3 text-left font-bold">Unit</th>
                          <th className="px-5 py-3 text-right font-bold">Rate</th>
                          <th className="px-5 py-3 text-right font-bold">Basic Amount</th>
                          <th className="px-5 py-3 text-right font-bold w-[120px]">BOM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(soItems || []).map((item, idx) => (
                          <React.Fragment key={`so-item-wrapper-${idx}`}>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-4">
                                <p className="font-semibold text-slate-900 text-xs">{item.description}</p>
                                {item.item_code && <p className="text-[10px] text-slate-400 mt-0.5">{item.item_code}</p>}
                              </td>
                              <td className="px-5 py-4">
                                <input 
                                  className="w-full p-1.5 border border-slate-200 rounded text-[11px] font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                                  value={item.drawing_no || ''}
                                  onChange={e => {
                                    const newItems = [...soItems]
                                    newItems[idx] = { ...newItems[idx], drawing_no: e.target.value }
                                    setSoItems(newItems)
                                  }}
                                  placeholder="Enter Drawing #"
                                />
                              </td>
                              <td className="px-5 py-4 text-right text-slate-900 font-bold">{item.quantity}</td>
                              <td className="px-5 py-4 text-slate-500 font-medium">{item.unit}</td>
                              <td className="px-5 py-4 text-right text-slate-600 font-medium">
                                {formatCurrency(item.rate, selectedPoForSo.currency)}
                              </td>
                              <td className="px-5 py-4 text-right text-slate-900 font-bold">
                                {formatCurrency(item.basic_amount || (item.quantity * item.rate), selectedPoForSo.currency)}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button 
                                  type="button"
                                  onClick={() => setExpandedItems(prev => ({...prev, [idx]: !prev[idx]}))}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                    expandedItems[idx] ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {expandedItems[idx] ? 'Close' : 'Add Materials'}
                                </button>
                              </td>
                            </tr>
                            {expandedItems[idx] && (
                              <tr className="bg-slate-50/30 border-none">
                                <td colSpan="7" className="px-5 pb-4">
                                  <MaterialInputTable 
                                    materials={item.materials} 
                                    onAdd={(mat) => {
                                      const newItems = [...soItems]
                                      newItems[idx] = { 
                                        ...newItems[idx], 
                                        materials: [...(newItems[idx].materials || []), mat] 
                                      }
                                      setSoItems(newItems)
                                    }}
                                    onDelete={(matIdx) => {
                                      const newItems = [...soItems]
                                      newItems[idx] = { 
                                        ...newItems[idx], 
                                        materials: (newItems[idx].materials || []).filter((_, i) => i !== matIdx) 
                                      }
                                      setSoItems(newItems)
                                    }}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-4 bg-slate-900 flex justify-between items-center">
                    <div className="flex gap-6">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Subtotal</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(selectedPoForSo.subtotal, selectedPoForSo.currency)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tax Total</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(selectedPoForSo.tax_total, selectedPoForSo.currency)}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Net Payable</p>
                      <p className="text-lg font-black text-white">{formatCurrency(selectedPoForSo.net_total, selectedPoForSo.currency)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Auto-sync Active:</strong> All items, quantities, and tax configurations listed above will be automatically synchronized into the new Sales Order. Ensure the details match your requirements before proceeding.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-slate-300"
              onClick={onResetForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Sales Order'}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <Card id="sales-orders" title="Sales Order Board" subtitle="Downstream Workflow">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Refreshing board...</p>
          </div>
        </div>
      )}

      {!loading && hasOrders ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-500 uppercase tracking-[0.2em] text-[0.65rem]">
              <tr>
                <th className="px-5 py-4 text-left font-semibold">Order Code</th>
                <th className="px-5 py-4 text-left font-semibold">Customer / Project</th>
                <th className="px-5 py-4 text-left font-semibold">PO Number</th>
                <th className="px-5 py-4 text-left font-semibold">PO Date</th>
                <th className="px-5 py-4 text-left font-semibold">Net Value</th>
                <th className="px-5 py-4 text-left font-semibold">Priority</th>
                <th className="px-5 py-4 text-left font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(order => {
                const normalizedStatus = (order.status || 'DRAFT').toUpperCase()
                const badgeClasses = statusStyles[normalizedStatus] || 'bg-slate-100 border-slate-200 text-slate-600'
                const netValue = Number(order.po_net_total)
                const hasNetValue = !Number.isNaN(netValue)
                const canViewPo = typeof onViewPo === 'function' && Boolean(order.customer_po_id)
                const pdfUrl = typeof getPoPdfUrl === 'function' ? getPoPdfUrl(order.pdf_path) : null
                const soPdfUrl = `${API_BASE}/sales-orders/${order.id}/pdf`

                return (
                  <tr key={`so-row-${order.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-5 align-middle">
                      <p className="font-bold text-slate-900">{formatOrderCode(order.id)}</p>
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <p className="font-semibold text-slate-900 text-xs">{order.company_name || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{order.project_name || '—'}</p>
                    </td>
                    <td className="px-5 py-5 text-slate-600 align-middle">
                      {order.po_number || '—'}
                    </td>
                    <td className="px-5 py-5 text-slate-600 align-middle">
                      {formatDate(order.po_date)}
                    </td>
                    <td className="px-5 py-5 text-slate-900 font-semibold align-middle">
                      {hasNetValue ? formatCurrency(netValue, order.po_currency) : '—'}
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                        {formatPriority(order.production_priority)}
                      </span>
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClasses}`}>
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <div className="flex justify-end gap-2">
                        {canViewPo && (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                            onClick={() => onViewPo(order.customer_po_id)}
                          >
                            Details
                          </button>
                        )}
                        {normalizedStatus === 'CREATED' && typeof onSendOrder === 'function' && (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm"
                            onClick={() => onSendOrder(order.id)}
                          >
                            Send
                          </button>
                        )}
                        {soPdfUrl && (
                          <a
                            href={soPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-xl border border-indigo-200 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="View Sales Order PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                        )}
                        {pdfUrl && (
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 transition"
                            title="View Customer PO PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="py-20 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">No Sales Orders Found</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">Push a Customer PO to start the workflow or refresh the list.</p>
            </div>
            <button
              type="button"
              className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              onClick={onRefresh}
            >
              Refresh List
            </button>
          </div>
        )
      )}
    </Card>
  )
}

export default SalesOrders
