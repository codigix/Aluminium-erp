import { Card } from '../components/ui.jsx'

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

const SalesOrders = ({ orders, loading, onRefresh, onViewPo, getPoPdfUrl, onSendOrder }) => {
  const list = Array.isArray(orders) ? orders : []
  const hasOrders = list.length > 0

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

                return (
                  <tr key={`so-row-${order.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-5 align-middle">
                      <p className="font-bold text-slate-900">{formatOrderCode(order.id)}</p>
                    </td>
                    <td className="px-5 py-5 align-middle">
                      <p className="font-semibold text-slate-900">{order.company_name || '—'}</p>
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
                        {pdfUrl && (
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 transition"
                            title="View PDF"
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
