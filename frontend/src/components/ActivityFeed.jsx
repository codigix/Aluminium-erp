import StatusBadge from './StatusBadge'

const toDate = value => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const formatRelativeTime = value => {
  const date = toDate(value)
  if (!date) return value || ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const ActivityFeed = ({
  items = [],
  loading,
  skeletonCount = 4,
  emptyLabel = 'No recent activity',
  onItemClick
}) => {
  if (loading) {
    return (
      <div className="activity-feed">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div key={index} className="activity-skeleton" />
        ))}
      </div>
    )
  }

  if (!items.length) {
    return <div className="activity-feed empty">{emptyLabel}</div>
  }

  return (
    <div className="activity-feed">
      {items.map(item => (
        <button
          key={item.id || `${item.title}-${item.timestamp}`}
          type="button"
          className="activity-item"
          onClick={() => onItemClick?.(item)}
        >
          <div className="activity-item-text">
            <p>{item.title}</p>
            {item.subtitle && <span>{item.subtitle}</span>}
          </div>
          <div className="activity-item-meta">
            {item.status && <StatusBadge status={item.status} />}
            {item.meta && <span>{item.meta}</span>}
            {item.timestamp && <time>{formatRelativeTime(item.timestamp)}</time>}
          </div>
        </button>
      ))}
    </div>
  )
}

export default ActivityFeed
