import { Bell, UserRound } from 'lucide-react'

const TopBar = () => (
  <header className="top-bar">
    <div className="brand-mark">
      <span className="brand-symbol">◢</span>
      <span className="brand-name">Illumium</span>
    </div>
    <div className="top-bar-title">Inventory Dashboard</div>
    <div className="top-bar-actions">
      <button type="button" className="icon-button" aria-label="View notifications">
        <Bell size={18} />
        <span className="badge-dot" />
      </button>
      <button type="button" className="icon-button profile" aria-label="Open profile">
        <UserRound size={18} />
      </button>
    </div>
  </header>
)

export default TopBar
