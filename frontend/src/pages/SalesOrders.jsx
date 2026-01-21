import React, { useState } from 'react'
import { Card, FormControl, DataTable } from '../components/ui.jsx'
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—'
  const validCurrency = currency && ['USD', 'EUR', 'INR', 'GBP'].includes(currency.toUpperCase()) ? currency.toUpperCase() : 'INR'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: validCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatOrderCode = (id) => {
  return `SO-${String(id).padStart(4, '0')}`
}

const formatStatus = (s) => {
  if (!s) return 'DRAFT'
  return s.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
}

const formatPriority = (p) => {
  if (!p) return 'NORMAL'
  return p.toUpperCase()
}

const statusStyles = {
  DRAFT: 'bg-slate-100 border-slate-200 text-slate-600',
  CREATED: 'bg-blue-50 border-blue-200 text-blue-600',
  DESIGN_IN_REVIEW: 'bg-indigo-50 border-indigo-200 text-indigo-600',
  DESIGN_APPROVED: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  DESIGN_QUERY: 'bg-amber-50 border-amber-200 text-amber-600',
  PROCUREMENT_IN_PROGRESS: 'bg-purple-50 border-purple-200 text-purple-600',
  MATERIAL_PURCHASE_IN_PROGRESS: 'bg-orange-50 border-orange-200 text-orange-600',
  MATERIAL_READY: 'bg-cyan-50 border-cyan-200 text-cyan-600',
  IN_PRODUCTION: 'bg-red-50 border-red-200 text-red-600',
  PRODUCTION_COMPLETED: 'bg-lime-50 border-lime-200 text-lime-600',
}

const MaterialInputTable = ({ materials = [], onAdd, onDelete }) => {
  const [newMat, setNewMat] = useState({ material_name: '', qty: '', uom: 'Kg' })

  return (
    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-[10px]">
        <thead className="bg-slate-50 text-slate-500  ">
          <tr>
            <th className="px-4 py-2 text-left">Material Name</th>
            <th className="px-4 py-2 text-right w-20">Qty</th>
            <th className="px-4 py-2 text-left w-20">UOM</th>
            <th className="px-4 py-2 text-right w-16">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {materials.map((mat, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-slate-900 font-medium">{mat.material_name}</td>
              <td className="px-4 py-2 text-right ">{mat.qty}</td>
              <td className="px-4 py-2 text-slate-500">{mat.uom}</td>
              <td className="px-4 py-2 text-right">
                <button 
                  onClick={() => onDelete(i)} 
                  className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50/50">
            <td className="px-4 py-2">
              <input 
                className="w-full bg-transparent border-none focus:ring-0 p-0 text-[10px]"
                placeholder="New Material..."
                value={newMat.material_name}
                onChange={e => setNewMat({...newMat, material_name: e.target.value})}
              />
            </td>
            <td className="px-4 py-2 text-right">
              <input 
                className="w-full bg-transparent border-none focus:ring-0 p-0 text-[10px] text-right"
                placeholder="0"
                value={newMat.qty}
                onChange={e => setNewMat({...newMat, qty: e.target.value})}
              />
            </td>
            <td className="px-4 py-2">
              <select 
                className="w-full bg-transparent border-none focus:ring-0 p-0 text-[10px]"
                value={newMat.uom}
                onChange={e => setNewMat({...newMat, uom: e.target.value})}
              >
                <option value="Kg">Kg</option>
                <option value="Nos">Nos</option>
                <option value="Mtr">Mtr</option>
              </select>
            </td>
            <td className="px-4 py-2 text-right">
              <button 
                onClick={() => {
                  if (newMat.material_name && newMat.qty) {
                    onAdd(newMat)
                    setNewMat({ material_name: '', qty: '', uom: 'Kg' })
                  }
                }}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Add Material"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const SalesOrders = ({ 
  orders, 
  loading, 
  onRefresh, 
  onViewPo, 
  getPoPdfUrl, 
  onSendOrder,
  onDeleteOrder,
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
  customerPosLoading,
  fieldInputClass
}) => {
  const [expandedItems, setExpandedItems] = useState({})
  const list = Array.isArray(orders) ? orders : []

  const columns = [
    {
      label: 'Client / Order ID',
      key: 'company_name',
      sortable: true,
      render: (val, row) => (
        <div>
          <p className="text-slate-900 font-bold">{val || '—'}</p>
          <p className="text-[10px] text-indigo-600 font-mono">{formatOrderCode(row.id)}</p>
        </div>
      )
    },
    {
      label: 'Date',
      key: 'po_date',
      sortable: true,
      render: (val) => <span className="text-slate-600 text-xs">{formatDate(val)}</span>
    },
    {
      label: 'PO Number',
      key: 'po_number',
      sortable: true,
      render: (val) => <span className="text-slate-600 text-xs">{val || '—'}</span>
    },
    {
      label: 'Net Value',
      key: 'po_net_total',
      sortable: true,
      render: (val, row) => <span className="text-slate-900 font-medium">{!Number.isNaN(Number(val)) ? formatCurrency(val, row.po_currency) : '—'}</span>
    },
    {
      label: 'Priority',
      key: 'production_priority',
      sortable: true,
      render: (val) => <span className="text-xs text-slate-600">{formatPriority(val)}</span>
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => {
        const normalizedStatus = (val || 'DRAFT').toUpperCase()
        const badgeClasses = statusStyles[normalizedStatus] || 'bg-slate-100 border-slate-200 text-slate-600'
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${badgeClasses}`}>
            {formatStatus(val).toUpperCase()}
          </span>
        )
      }
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, order) => {
        const normalizedStatus = (order.status || 'DRAFT').toUpperCase()
        const canViewPo = typeof onViewPo === 'function' && Boolean(order.customer_po_id)
        const soPdfUrl = `${API_BASE}/sales-orders/${order.id}/pdf`
        
        return (
          <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
            {canViewPo && (
              <button
                type="button"
                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-white shadow-sm transition"
                onClick={() => onViewPo(order.customer_po_id)}
                title="View PO Details"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
            )}
            {normalizedStatus === 'CREATED' && typeof onSendOrder === 'function' && (
              <button
                type="button"
                className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
                onClick={() => onSendOrder(order.id)}
                title="Send Order"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
            {soPdfUrl && (
              <a
                href={soPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg border border-indigo-200 text-indigo-500 hover:bg-indigo-50 transition shadow-sm"
                title="View Sales Order PDF"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            )}
            {typeof onDeleteOrder === 'function' && (
              <button
                type="button"
                onClick={() => onDeleteOrder(order.id)}
                className="p-1.5 rounded-lg border border-rose-100 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition shadow-sm"
                title="Delete Order"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )
      }
    }
  ];

  const renderExpandedRow = (order) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mx-4">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
          <tr>
            <th className="px-4 py-2 text-left">Drawing No</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-center">Qty</th>
            <th className="px-4 py-2 text-right">Unit Rate</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order.items && order.items.length > 0 ? (
            order.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 font-mono text-indigo-600">{item.drawing_no || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-600">{item.description}</td>
                <td className="px-4 py-2 text-center font-bold">{item.quantity} {item.unit}</td>
                <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(item.rate, order.po_currency)}</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(item.quantity * item.rate, order.po_currency)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="px-4 py-6 text-center text-slate-400 italic">No items found for this order</td>
            </tr>
          )}
        </tbody>
        {order.items && order.items.length > 0 && (
          <tfoot className="bg-slate-50/50">
            <tr>
              <td colSpan="4" className="px-4 py-2 text-right font-bold text-slate-500">Total Amount:</td>
              <td className="px-4 py-2 text-right font-black text-indigo-600 text-sm">
                {formatCurrency(Number(order.po_net_total), order.po_currency)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  // Group orders by company to support "Single Request" view
  const groupedOrders = list.reduce((acc, order) => {
    const key = order.company_id || 'unassigned'
    if (!acc[key]) {
      acc[key] = {
        ...order,
        all_items: [...(order.items || [])],
        all_pos: [order.po_number],
        total_net_value: Number(order.po_net_total) || 0,
        order_count: 1
      }
    } else {
      acc[key].all_items = [...acc[key].all_items, ...(order.items || [])]
      if (order.po_number && !acc[key].all_pos.includes(order.po_number)) {
        acc[key].all_pos.push(order.po_number)
      }
      acc[key].total_net_value += Number(order.po_net_total) || 0
      acc[key].order_count += 1
      // Keep the most recent status/priority or similar logic if needed
    }
    return acc
  }, {})

  const displayList = Object.values(groupedOrders)
  const hasOrders = displayList.length > 0

  if (showSalesOrderForm) {
    const filteredPos = (customerPos || []).filter(po => String(po.company_id) === String(salesOrderForm.companyId))
    const selectedCompany = (companies || []).find(c => String(c.id) === String(salesOrderForm.companyId))

    return (
      <div className="space-y-8">
        
        <Card id="new-sales-order" title="Create New Sales Order" subtitle="Workflow Intake">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* --- Section 1: Customer Selection & Details --- */}
            <div className="space-y-5">
              <h3 className="text-xs  text-slate-400  tracking-[0.2em] mb-4">Customer Details</h3>
              
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
                  className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed `}
                  value={selectedCompany?.gstin || '—'}
                />
              </FormControl>
            </div>

            {/* --- Section 2: PO Selection & Details --- */}
            <div className="space-y-5">
              <h3 className="text-xs  text-slate-400  tracking-[0.2em] mb-4">Purchase Order Information</h3>
              
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
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed `}
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
              <h3 className="text-xs  text-slate-400  tracking-[0.2em] mb-6">Production & Project Setup</h3>
              <div className="grid gap-5 lg:grid-cols-3">
                <FormControl label="Project / Job Code">
                  <input
                    readOnly
                    className={`${fieldInputClass} bg-slate-50 text-slate-500 cursor-not-allowed  `}
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
                  <span className="text-sm  text-slate-700">Drawing Required</span>
                </label>
              </div>
            </div>

            {customerPosLoading && (
              <div className="col-span-full py-8 flex flex-col items-center justify-center gap-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-xs  text-slate-400  tracking-widest">Fetching PO Details...</p>
              </div>
            )}

            {selectedPoForSo && !customerPosLoading && (
              <div className="col-span-full mt-6 ">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="text-[10px]  text-slate-400  tracking-[0.2em]">Review Items from {selectedPoForSo.po_number}</h4>
                    <span className="text-[10px]  text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ">
                      {soItems?.length || 0} Items
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/30 text-slate-400  tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left ">Description</th>
                          <th className="px-5 py-3 text-left  w-[180px]">Drawing No</th>
                          <th className="px-5 py-3 text-right ">Qty</th>
                          <th className="px-5 py-3 text-left ">Unit</th>
                          <th className="px-5 py-3 text-right ">Rate</th>
                          <th className="px-5 py-3 text-right ">Basic Amount</th>
                          <th className="px-5 py-3 text-right  w-[120px]">BOM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(soItems || []).map((item, idx) => (
                          <React.Fragment key={`so-item-wrapper-${idx}`}>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2">
                                <p className="text-slate-900 text-xs">{item.description}</p>
                                {item.item_code && <p className="text-[10px] text-slate-400 mt-0.5">{item.item_code}</p>}
                              </td>
                              <td className="p-2">
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
                              <td className="p-2 text-right text-slate-900 ">{item.quantity}</td>
                              <td className="p-2 text-slate-500 font-medium">{item.unit}</td>
                              <td className="p-2 text-right text-slate-600 font-medium">
                                {formatCurrency(item.rate, selectedPoForSo.currency)}
                              </td>
                              <td className="p-2 text-right text-slate-900 ">
                                {formatCurrency(item.basic_amount || (item.quantity * item.rate), selectedPoForSo.currency)}
                              </td>
                              <td className="p-2 text-right">
                                <button 
                                  type="button"
                                  onClick={() => setExpandedItems(prev => ({...prev, [idx]: !prev[idx]}))}
                                  className={`px-3 py-1.5 rounded-lg text-[10px]   transition-all ${
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
                  <div className="p-2 bg-slate-900 flex justify-between items-center">
                    <div className="flex gap-6">
                      <div className="space-y-0.5">
                        <p className="text-[9px]  text-slate-400  tracking-widest">Subtotal</p>
                        <p className="text-sm  text-white">{formatCurrency(selectedPoForSo.subtotal, selectedPoForSo.currency)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px]  text-slate-400  tracking-widest">Tax Total</p>
                        <p className="text-sm  text-white">{formatCurrency(selectedPoForSo.tax_total, selectedPoForSo.currency)}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[9px]  text-indigo-400  tracking-widest">Net Payable</p>
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
              className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm  hover:border-slate-300"
              onClick={onResetForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-sm  shadow-sm hover:bg-slate-800 disabled:opacity-60"
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
    <>
    <h1 className="text-xl text-slate-900 mb-1">Sales Orders</h1>
    <p className="text-slate-600 text-xs">Manage all sales order</p>

      {!loading && hasOrders ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs bg-white">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Client / Order ID</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Net Value</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(order => {
                const normalizedStatus = (order.status || 'DRAFT').toUpperCase()
                const badgeClasses = statusStyles[normalizedStatus] || 'bg-slate-100 border-slate-200 text-slate-600'
                const netValue = Number(order.po_net_total)
                const hasNetValue = !Number.isNaN(netValue)
                const canViewPo = typeof onViewPo === 'function' && Boolean(order.customer_po_id)
                const soPdfUrl = `${API_BASE}/sales-orders/${order.id}/pdf`
                const isExpanded = expandedItems[order.id]

                return (
                  <React.Fragment key={`so-row-group-${order.id}`}>
                    <tr 
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                      onClick={() => setExpandedItems(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-slate-900 font-bold">{order.company_name || '—'}</p>
                            <p className="text-[10px] text-indigo-600 font-mono">{formatOrderCode(order.id)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 align-middle text-xs">
                        {formatDate(order.po_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 align-middle text-xs">
                        {order.po_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium align-middle">
                        {hasNetValue ? formatCurrency(netValue, order.po_currency) : '—'}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="text-xs text-slate-600">
                          {formatPriority(order.production_priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${badgeClasses}`}>
                          {formatStatus(order.status).toUpperCase()}
                        </span>
                        {normalizedStatus === 'DESIGN_QUERY' && order.rejection_reason && (
                          <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-700 leading-relaxed max-w-[200px]">
                            <span className="font-bold text-amber-800">Reason:</span> {order.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          {canViewPo && (
                            <button
                              type="button"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-white shadow-sm transition"
                              onClick={() => onViewPo(order.customer_po_id)}
                              title="View PO Details"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                            </button>
                          )}
                          {normalizedStatus === 'CREATED' && typeof onSendOrder === 'function' && (
                            <button
                              type="button"
                              className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
                              onClick={() => onSendOrder(order.id)}
                              title="Send Order"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </button>
                          )}
                          {soPdfUrl && (
                            <a
                              href={soPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-indigo-200 text-indigo-500 hover:bg-indigo-50 transition shadow-sm"
                              title="View Sales Order PDF"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </a>
                          )}
                          {typeof onDeleteOrder === 'function' && (
                            <button
                              type="button"
                              onClick={() => onDeleteOrder(order.id)}
                              className="p-1.5 rounded-lg border border-rose-100 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition shadow-sm"
                              title="Delete Order"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="7" className="px-8 py-4 bg-slate-50/50">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                <tr>
                                  <th className="px-4 py-2 text-left">Drawing No</th>
                                  <th className="px-4 py-2 text-left">Description</th>
                                  <th className="px-4 py-2 text-center">Qty</th>
                                  <th className="px-4 py-2 text-right">Unit Rate</th>
                                  <th className="px-4 py-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {order.items && order.items.length > 0 ? (
                                  order.items.map((item, idx) => (
                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.status === 'REJECTED' ? 'bg-red-50/50' : ''}`}>
                                      <td className="px-4 py-2 font-mono text-indigo-600">
                                        {item.drawing_no || 'N/A'}
                                        {item.status === 'REJECTED' && (
                                          <div className="flex flex-col gap-1 mt-1">
                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[8px] font-bold uppercase w-fit">Rejected</span>
                                            {item.rejection_reason && (
                                              <span className="text-[9px] text-red-600 italic leading-tight">
                                                Reason: {item.rejection_reason}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-slate-600">{item.description}</td>
                                      <td className="px-4 py-2 text-center font-bold">{item.quantity} {item.unit}</td>
                                      <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(item.rate, order.po_currency)}</td>
                                      <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(item.quantity * item.rate, order.po_currency)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan="5" className="px-4 py-6 text-center text-slate-400 italic">No items found for this order</td>
                                  </tr>
                                )}
                              </tbody>
                              {order.items && order.items.length > 0 && (
                                <tfoot className="bg-slate-50/50">
                                  <tr>
                                    <td colSpan="4" className="px-4 py-2 text-right font-bold text-slate-500">Total Amount:</td>
                                    <td className="px-4 py-2 text-right font-black text-indigo-600 text-sm">
                                      {formatCurrency(netValue, order.po_currency)}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="py-20 text-center ">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-base text-slate-900">No Sales Orders Found</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">Push a Customer PO to start the workflow or refresh the list.</p>
            </div>
            <button
              type="button"
              className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-sm  text-slate-700 shadow-sm hover:bg-slate-50 transition"
              onClick={onRefresh}
            >
              Refresh List
            </button>
          </div>
        )
      )}
    </>
  )
}

export default SalesOrders
