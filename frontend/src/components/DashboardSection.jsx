const DashboardSection = ({
  title,
  subtitle,
  actions,
  footer,
  columns,
  children,
  compact
}) => {
  const contentClass = columns ? 'dashboard-section-content grid' : 'dashboard-section-content'
  const contentStyle = columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined
  return (
    <section className={`dashboard-section${compact ? ' compact' : ''}`}>
      {(title || subtitle || actions) && (
        <div className="dashboard-section-header">
          <div>
            {title && <p>{title}</p>}
            {subtitle && <span>{subtitle}</span>}
          </div>
          {actions && <div className="dashboard-section-actions">{actions}</div>}
        </div>
      )}
      <div className={contentClass} style={contentStyle}>
        {children}
      </div>
      {footer && <div className="dashboard-section-footer">{footer}</div>}
    </section>
  )
}

export default DashboardSection
