export const Card = ({ id, title, subtitle, action, children }) => (
  <div id={id} className="bg-white border border-slate-200/80 rounded-[32px] shadow-lg">
    {(title || subtitle || action) && (
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between px-8 py-6 border-b border-slate-100/80 rounded-t-[32px]">
        <div>
          {subtitle && <p className="text-[0.65rem] font-semibold tracking-[0.35em] text-slate-400 uppercase">{subtitle}</p>}
          {title && <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>}
        </div>
        {action}
      </div>
    )}
    <div className="px-8 py-8 space-y-6">{children}</div>
  </div>
)

export const FormControl = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className="text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase">{label}</span>
    {children}
  </label>
)

export const StatusBadge = ({ status }) => {
  const normalized = (status || 'ACTIVE').toUpperCase()
  
  const getStatusStyles = (s) => {
    switch (s) {
      case 'DRAFT':
      case 'CREATED':
        return 'bg-amber-50 border-amber-200 text-amber-600'
      case 'DESIGN_IN_REVIEW':
      case 'IN_DESIGN':
        return 'bg-blue-50 border-blue-200 text-blue-600'
      case 'BOM_SUBMITTED':
        return 'bg-indigo-50 border-indigo-200 text-indigo-600'
      case 'ACTIVE':
      case 'DESIGN_APPROVED':
      case 'BOM_APPROVED':
      case 'COMPLETED':
      case 'PRODUCTION_COMPLETED':
        return 'bg-emerald-50 border-emerald-200 text-emerald-600'
      case 'DESIGN_QUERY':
      case 'INACTIVE':
      case 'REJECTED':
      case 'BLOCKED':
        return 'bg-rose-50 border-rose-200 text-rose-600'
      default:
        return 'bg-slate-50 border-slate-200 text-slate-600'
    }
  }

  const formatStatus = (s) => {
    return s.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
  }

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusStyles(normalized)}`}>
      {formatStatus(normalized)}
    </span>
  )
}
