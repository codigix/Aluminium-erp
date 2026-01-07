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
      {loading && hasOrders && <p className="text-xs text-slate-400">Refreshing latest sales orders…</p>}

      {hasOrders ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Sales Order</th>
                <th className="px-4 py-3 text-left font-semibold">Customer PO</th>
                <th className="px-4 py-3 text-left font-semibold">Company</th>
                <th className="px-4 py-3 text-left font-semibold">Priority</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(order => {
                const normalizedStatus = (order.status || 'DRAFT').toUpperCase()
                const badgeClasses = statusStyles[normalizedStatus] || 'bg-slate-100 border-slate-200 text-slate-600'
                const pdfUrl = typeof getPoPdfUrl === 'function' ? getPoPdfUrl(order.pdf_path) : null
                const netValue = Number(order.po_net_total)
                const hasNetValue = !Number.isNaN(netValue)
                const canViewPo = typeof onViewPo === 'function' && Boolean(order.customer_po_id)
                return (
                  <tr key={`sales-order-row-${order.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{formatOrderCode(order.id)}</p>
                      <p className="text-xs text-slate-400">#{order.customer_po_id}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-900 font-medium">{order.po_number || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500">PO Date: {formatDate(order.po_date)}</p>
                      {hasNetValue && <p className="text-xs text-slate-500">Value: {formatCurrency(netValue, order.po_currency)}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{order.company_name || '—'}</p>
                      <p className="text-xs text-slate-400">Project: {order.project_name || '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatPriority(order.production_priority)}</td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeClasses}`}>{formatStatus(order.status)}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {pdfUrl && (
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
                          >
                            PDF
                          </a>
                        )}
                        {canViewPo && (
                          <button
                            type="button"
                            className="px-3 py-2 rounded-xl border border-slate-900 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition"
                            onClick={() => onViewPo(order.customer_po_id)}
                          >
                            View
                          </button>
                        )}
                        {typeof onSendOrder === 'function' && normalizedStatus === 'CREATED' && (
                          <button
                            type="button"
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                            onClick={() => onSendOrder(order.id)}
                          >
                            Send
                          </button>
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
        <div className="p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">No Sales Orders yet</p>
          <p className="text-sm text-slate-500">Push a Customer PO or refresh to see new entries.</p>
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Syncing…' : 'Refresh List'}
          </button>
        </div>
      )}
    </Card>
  )
}

export default SalesOrders
