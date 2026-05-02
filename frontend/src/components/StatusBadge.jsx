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
    success: 'text-emerald-500  ',
    warning: 'text-amber-500  ',
    danger: 'text-rose-500  ',
    info: 'text-blue-500  ',
    indigo: 'text-indigo-600  ',
    sky: 'text-sky-500  ',
    muted: 'text-slate-700  '
  };

  return (
    <span className={`text-xs inline-flex items-center justify-center  ${variants[variant] || variants.muted}`}>
      {children || label || '—'}
    </span>
  )
}

export default StatusBadge
