import { NavLink } from 'react-router-dom'

const Sidebar = ({ items = [] }) => (
  <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200/60 shadow-sm flex flex-col z-50">
    <div className="p-6 border-b border-slate-100 flex items-center gap-3.5">
      <div className="h-9 w-9 rounded-xl bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
        <span className="text-white  text-lg">I</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm  text-slate-900  leading-none">ILLUMIUM</p>
        <p className="text-[9px] text-rose-500  uppercase tracking-[0.15em] mt-1.5 truncate">Aluminium Systems</p>
      </div>
    </div>
    <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar">
      {items.map(item => (
        <NavLink 
          key={item.path} 
          to={item.path} 
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px]  transition-all duration-200 group relative
            ${isActive 
              ? 'bg-rose-50 text-rose-600 shadow-sm' 
              : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/30'}
          `}
        >
          <item.icon className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110`} />
          <span className="flex-1 truncate">{item.label}</span>
          {({ isActive }) => isActive && (
            <div className="absolute right-2 w-1.5 h-1.5 rounded bg-rose-500" />
          )}
        </NavLink>
      ))}
    </nav>
  </aside>
)

export default Sidebar
