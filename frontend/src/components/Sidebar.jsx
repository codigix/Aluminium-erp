import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/AuthContext'
import ThemeToggle from './ThemeToggle'
import '../styles/Sidebar.css'
import {
  LayoutDashboard,
  ShoppingCart,
  Settings,
  TrendingUp,
  FileText,
  Send,
  DollarSign,
  Clipboard,
  Package,
  Receipt,
  Building2,
  ChevronRight,
  Menu,
  X,
  LogOut
} from 'lucide-react'

export default function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedMenu, setExpandedMenu] = useState(null)

  const isActive = (path) => location.pathname.startsWith(path)

  const toggleMenu = (menu) => {
    setExpandedMenu(expandedMenu === menu ? null : menu)
  }

  const handleLinkClick = () => {
    // Only close sidebar on mobile devices (screen width <= 768px)
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard'
    },
    {
      id: 'buying',
      label: 'Buying Module',
      icon: ShoppingCart,
      submenu: [
        { label: 'Material Requests', path: '/buying/material-requests', icon: FileText },
        { label: 'RFQs', path: '/buying/rfqs', icon: Send },
        { label: 'Quotations', path: '/buying/quotations', icon: DollarSign },
        { label: 'Purchase Orders', path: '/buying/purchase-orders', icon: Clipboard },
        { label: 'Purchase Receipts', path: '/buying/purchase-receipts', icon: Package },
        { label: 'Purchase Invoices', path: '/buying/purchase-invoices', icon: Receipt }
      ]
    },
    {
      id: 'selling',
      label: 'Selling Module',
      icon: TrendingUp,
      submenu: [
        { label: 'Quotations', path: '/selling/quotations', icon: DollarSign },
        { label: 'Sales Orders', path: '/selling/sales-orders', icon: Clipboard },
        { label: 'Delivery Notes', path: '/selling/delivery-notes', icon: Package },
        { label: 'Sales Invoices', path: '/selling/sales-invoices', icon: Receipt },
        { label: 'Customers', path: '/selling/customers', icon: Building2 }
      ]
    },
    {
      id: 'masters',
      label: 'Masters',
      icon: Settings,
      submenu: [
        { label: 'Suppliers', path: '/masters/suppliers', icon: Building2 },
        { label: 'Items', path: '/masters/items', icon: Package }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      path: '/analytics',
      submenu: [
        { label: 'Buying Analytics', path: '/analytics/buying', icon: TrendingUp },
        { label: 'Selling Analytics', path: '/analytics/selling', icon: TrendingUp }
      ]
    }
  ]

  return (
    <>
      {/* Sidebar Toggle Button (Mobile) */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay (Mobile) */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <Link to="/dashboard">
            <span className="brand-icon">🏭</span>
            <span className="brand-text">Aluminium ERP</span>
          </Link>
        </div>

        {/* User Info */}
        <div className="user-section">
          <div className="user-avatar">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.full_name}</p>
            <p className="user-email">{user?.email}</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const IconComponent = item.icon
            return (
            <div key={item.id} className="nav-group">
              {item.submenu ? (
                <div>
                  <button
                    className={`nav-item submenu-toggle ${expandedMenu === item.id ? 'expanded' : ''}`}
                    onClick={() => toggleMenu(item.id)}
                  >
                    <IconComponent className="nav-icon-lucide" size={20} />
                    <span className="nav-label">{item.label}</span>
                    <ChevronRight className="submenu-arrow-icon" size={18} />
                  </button>
                  {expandedMenu === item.id && (
                    <div className="submenu">
                      {item.submenu.map((subitem) => {
                        const SubIconComponent = subitem.icon
                        return (
                        <Link
                          key={subitem.path}
                          to={subitem.path}
                          className={`nav-subitem ${isActive(subitem.path) ? 'active' : ''}`}
                          onClick={handleLinkClick}
                        >
                          <SubIconComponent className="nav-icon-lucide" size={18} />
                          <span className="nav-label">{subitem.label}</span>
                        </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <IconComponent className="nav-icon-lucide" size={20} />
                  <span className="nav-label">{item.label}</span>
                </Link>
              )}
            </div>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="sidebar-divider"></div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <ThemeToggle />
          <button
            className="btn-logout"
            onClick={() => {
              logout()
              handleLinkClick()
            }}
          >
            <LogOut className="logout-icon" size={20} />
            <span className="logout-text">Logout</span>
          </button>
          <p className="version">v1.0.0</p>
        </div>
      </aside>
    </>
  )
}