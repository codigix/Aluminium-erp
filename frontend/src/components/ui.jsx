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
  if (normalized === 'DRAFT') {
    return <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 border-amber-200 text-amber-600">Draft</span>
  }
  const isActive = normalized === 'ACTIVE'
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
        isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
