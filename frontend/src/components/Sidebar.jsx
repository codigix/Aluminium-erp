import { NavLink } from 'react-router-dom'

const Sidebar = ({ items = [] }) => (
  <aside className="sidebar">
    <div className="sidebar-brand">
      <div className="brand-symbol">◢</div>
      <div className="sidebar-brand-text">
        <p>Illumium</p>
        <span>Aluminium Systems</span>
      </div>
    </div>
    <nav>
      {items.map(item => (
        <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <item.icon size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  </aside>
)

export default Sidebar
