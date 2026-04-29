const toneMap = {
  optimal: 'success',
  stable: 'info',
  monitor: 'warning',
  alert: 'danger',
  draft: 'info',
  submitted: 'info',
  issued: 'info',
  completed: 'success',
  inbound: 'info',
  outbound: 'warning',
  transfer: 'info',
  'in-transit': 'warning',
  received: 'success',
  cancelled: 'danger',
  packing: 'warning',
  documenting: 'info',
  released: 'info',
  variance: 'danger'
}

const normalizeLabel = status => {
  if (status && typeof status === 'object') {
    return status.label || status.text || status.value || ''
  }
  return status || ''
}

const StatusBadge = ({ status, tone, children }) => {
  const label = normalizeLabel(status)
  const variant = tone || toneMap[label?.toLowerCase?.()] || 'muted'
  
  const variants = {
    success: 'bg-emerald-500 text-white border-emerald-600 shadow-sm',
    warning: 'bg-amber-500 text-white border-amber-600 shadow-sm',
    danger: 'bg-rose-500 text-white border-rose-600 shadow-sm',
    info: 'bg-blue-500 text-white border-blue-600 shadow-sm',
    indigo: 'bg-indigo-600 text-white border-indigo-700 shadow-sm',
    sky: 'bg-sky-500 text-white border-sky-600 shadow-sm',
    muted: 'bg-white text-slate-700 border-slate-200 shadow-sm'
  };

  return (
    <span className={`px-2 py-1 rounded-md text-[10px]  uppercase tracking-wider border inline-flex items-center justify-center min-w-[70px] ${variants[variant] || variants.muted}`}>
      {children || label || '—'}
    </span>
  )
}

export default StatusBadge
