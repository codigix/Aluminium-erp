import { NavLink } from 'react-router-dom'
import spEmblem from '../assets/sp_emblem_clean.png'

const Sidebar = ({ items = [] }) => (
  <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200/60 shadow-sm flex flex-col z-50">
    <div className="p-4 border-b border-slate-100 flex items-center bg-white">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Left: Square SP/TP Logo */}
        <div className="w-11 h-11 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          <img src={spEmblem} alt="SP TECHPIONEER" className="w-full h-full object-contain" />
        </div>

        {/* Right: Branding Text Block */}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <span className="text-[12.5px] font-black text-slate-900 tracking-[0.03em] leading-tight font-serif truncate uppercase">
            SP TECHPIONEER
          </span>
          <span className="text-[7.5px] font-bold text-amber-700 tracking-[0.14em] uppercase leading-tight mt-0.5 truncate">
            PRIVATE LIMITED
          </span>
          <span className="text-[5.8px] font-bold text-slate-400 tracking-[0.08em] uppercase leading-tight mt-0.5 truncate">
            ENGINEERING A BETTER TOMORROW
          </span>
        </div>
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
