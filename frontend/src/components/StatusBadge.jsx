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
  return (
    <span className={`stat-badge ${variant}`}>
      {children || label || '—'}
    </span>
  )
}

export default StatusBadge
