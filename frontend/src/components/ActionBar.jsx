const ActionBar = ({
  title,
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  searchValue,
  onSearch,
  searchPlaceholder = 'Search',
  periodOptions = [],
  selectedPeriod,
  onPeriodChange,
  actions,
  children
}) => {
  return (
    <div className="action-bar">
      {(title || subtitle || actions) && (
        <div className="action-bar-heading">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="action-bar-actions">{actions}</div>}
        </div>
      )}
      {tabs.length > 0 && (
        <div className="action-tabs">
          {tabs.map(tab => (
            <button
              key={tab.value || tab}
              type="button"
              className={`action-tab ${tab.value === activeTab || tab === activeTab ? 'active' : ''}`}
              onClick={() => onTabChange?.(tab.value || tab)}
            >
              {tab.label || tab}
            </button>
          ))}
        </div>
      )}
      {(onSearch || periodOptions.length > 0 || children) && (
        <div className="action-bar-controls">
          {onSearch && (
            <input
              type="search"
              value={searchValue ?? ''}
              placeholder={searchPlaceholder}
              onChange={event => onSearch(event.target.value)}
            />
          )}
          {periodOptions.length > 0 && (
            <select value={selectedPeriod ?? ''} onChange={event => onPeriodChange?.(event.target.value)}>
              {periodOptions.map(option => (
                <option key={option.value || option} value={option.value || option}>
                  {option.label || option}
                </option>
              ))}
            </select>
          )}
          {children}
        </div>
      )}
    </div>
  )
}

export default ActionBar
