export const Card = ({ id, title, subtitle, action, children }) => (
  <div id={id} >
    {(title || subtitle || action) && (
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between p-2 border-b border-slate-100/80 rounded-t-[32px]">
        <div>
          {subtitle && <p className="text-sm text-slate-400 ">{subtitle}</p>}
          {title && <h2 className="text-xl text-slate-900 text-xs">{title}</h2>}
        </div>
        {action}
      </div>
    )}
    <div className="p-2">{children}</div>
  </div>
)

export const FormControl = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className="text-[0.65rem] text-slate-500 ">{label}</span>
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
    <span className={`px-3 py-1 rounded-full text-[10px]  border  tracking-wider ${getStatusStyles(normalized)}`}>
      {formatStatus(normalized)}
    </span>
  )
}

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-md shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-2 flex items-center justify-between rounded-sm">
          <h2 className="text-lg  text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
