const resolveTrendClass = trend => {
  if (trend > 0) return 'up'
  if (trend < 0) return 'down'
  return 'steady'
}

const formatTrend = trend => {
  if (trend === undefined || trend === null || Number.isNaN(trend)) return null
  const numeric = Number(trend)
  if (Number.isNaN(numeric)) return null
  const prefix = numeric > 0 ? '+' : ''
  return `${prefix}${numeric}%`
}

const KpiCard = ({
  label,
  value,
  helper,
  meta,
  trend,
  trendLabel,
  tone = 'default',
  icon,
  children
}) => {
  const formattedTrend = trendLabel || formatTrend(trend)
  const trendClass = resolveTrendClass(Number(trend))
  return (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-card-meta">
        {icon && <div className="kpi-card-icon">{icon}</div>}
        <div>
          <p>{label}</p>
          {meta && <span>{meta}</span>}
        </div>
      </div>
      <div className="kpi-card-value">{value}</div>
      {helper && <p className="kpi-card-helper">{helper}</p>}
      {formattedTrend && <div className={`kpi-card-trend ${trendClass}`}>{formattedTrend}</div>}
      {children && <div className="kpi-card-extra">{children}</div>}
    </div>
  )
}

export default KpiCard
