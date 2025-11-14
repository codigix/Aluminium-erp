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
  LogOut,
  Users,
  Warehouse,
  AlertCircle,
  BarChart3,
  Truck,
  CheckCircle,
  Calendar,
  Activity,
  Eye
} from 'lucide-react'

/**
 * DepartmentLayout Component
 * Provides department-aware navigation and layout
 * Shows different menu items based on user's department
 */
export default function DepartmentLayout({ children }) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedMenu, setExpandedMenu] = useState(null)

  const userDept = user?.department?.toLowerCase() || 'buying'

  const isActive = (path) => location.pathname.startsWith(path)

  const toggleMenu = (menu) => {
    setExpandedMenu(expandedMenu === menu ? null : menu)
  }

  const handleLinkClick = () => {
    // Only close sidebar on mobile devices
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }

  // Define menu items for each department
  const getDepartmentMenuItems = () => {
    const dashboardItem = {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard'
    }

    const masterItems = {
      id: 'masters',
      label: 'Masters',
      icon: Settings,
      submenu: [
        { label: 'Suppliers', path: '/masters/suppliers', icon: Building2 },
        { label: 'Items', path: '/masters/items', icon: Package }
      ]
    }

    // BUYING DEPARTMENT MENU
    if (userDept === 'buying') {
      return [
        dashboardItem,
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
        masterItems,
        {
          id: 'analytics',
          label: 'Analytics',
          icon: TrendingUp,
          submenu: [
            { label: 'Buying Analytics', path: '/analytics/buying', icon: TrendingUp }
          ]
        }
      ]
    }

    // SELLING DEPARTMENT MENU
    if (userDept === 'selling') {
      return [
        dashboardItem,
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
          id: 'analytics',
          label: 'Analytics',
          icon: TrendingUp,
          submenu: [
            { label: 'Sales Analytics', path: '/analytics/selling', icon: TrendingUp }
          ]
        }
      ]
    }

    // INVENTORY DEPARTMENT MENU
    if (userDept === 'inventory') {
      return [
        dashboardItem,
        {
          id: 'inventory',
          label: 'Inventory Module',
          icon: Warehouse,
          submenu: [
            { label: 'Warehouses', path: '/inventory/warehouses', icon: Warehouse },
            { label: 'Stock Balance', path: '/inventory/stock-balance', icon: Package },
            { label: 'Stock Entries', path: '/inventory/stock-entries', icon: FileText },
            { label: 'Stock Ledger', path: '/inventory/stock-ledger', icon: BarChart3 },
            { label: 'Stock Transfers', path: '/inventory/stock-transfers', icon: Truck },
            { label: 'Batch Tracking', path: '/inventory/batch-tracking', icon: Package },
            { label: 'Reconciliation', path: '/inventory/reconciliation', icon: BarChart3 },
            { label: 'Reorder Management', path: '/inventory/reorder-management', icon: AlertCircle }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: TrendingUp,
          submenu: [
            { label: 'Inventory Analytics', path: '/analytics/inventory', icon: TrendingUp }
          ]
        }
      ]
    }

    // ADMIN DEPARTMENT MENU - Full Access
    if (userDept === 'admin') {
      return [
        dashboardItem,
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
          id: 'inventory',
          label: 'Inventory Module',
          icon: Warehouse,
          submenu: [
            { label: 'Warehouses', path: '/inventory/warehouses', icon: Warehouse },
            { label: 'Stock Balance', path: '/inventory/stock-balance', icon: Package },
            { label: 'Stock Entries', path: '/inventory/stock-entries', icon: FileText },
            { label: 'Stock Ledger', path: '/inventory/stock-ledger', icon: BarChart3 },
            { label: 'Stock Transfers', path: '/inventory/stock-transfers', icon: Truck },
            { label: 'Batch Tracking', path: '/inventory/batch-tracking', icon: Package },
            { label: 'Reconciliation', path: '/inventory/reconciliation', icon: BarChart3 },
            { label: 'Reorder Management', path: '/inventory/reorder-management', icon: AlertCircle }
          ]
        },
        masterItems,
        {
          id: 'analytics',
          label: 'Analytics',
          icon: TrendingUp,
          submenu: [
            { label: 'Buying Analytics', path: '/analytics/buying', icon: TrendingUp },
            { label: 'Sales Analytics', path: '/analytics/selling', icon: TrendingUp },
            { label: 'Inventory Analytics', path: '/analytics/inventory', icon: TrendingUp }
          ]
        },
        {
          id: 'admin',
          label: 'Administration',
          icon: Users,
          submenu: [
            { label: 'User Management', path: '/admin/users', icon: Users },
            { label: 'Settings', path: '/admin/settings', icon: Settings }
          ]
        }
      ]
    }

    // PRODUCTION DEPARTMENT MENU
    if (userDept === 'production') {
      return [
        dashboardItem,
        {
          id: 'production',
          label: 'Production Module',
          icon: Clipboard,
          submenu: [
            { label: 'Production Orders', path: '/production/orders', icon: Clipboard },
            { label: 'Production Schedule', path: '/production/schedule', icon: Calendar },
            { label: 'Daily Entries', path: '/production/entries', icon: Activity },
            { label: 'Batch Tracking', path: '/production/batch-tracking', icon: Package },
            { label: 'Quality Records', path: '/production/quality', icon: CheckCircle }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          submenu: [
            { label: 'Production Analytics', path: '/analytics/production', icon: TrendingUp }
          ]
        }
      ]
    }

    // TOOLROOM DEPARTMENT MENU
    if (userDept === 'toolroom') {
      return [
        dashboardItem,
        {
          id: 'toolroom',
          label: 'Tool Room Module',
          icon: Settings,
          submenu: [
            { label: 'Tools', path: '/toolroom/tools', icon: Package },
            { label: 'Die Register', path: '/toolroom/die-register', icon: Clipboard },
            { label: 'Maintenance', path: '/toolroom/maintenance', icon: AlertCircle },
            { label: 'Rework Logs', path: '/toolroom/reworks', icon: FileText }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          submenu: [
            { label: 'Tool Analytics', path: '/analytics/toolroom', icon: TrendingUp }
          ]
        }
      ]
    }

    // QUALITY CONTROL DEPARTMENT MENU
    if (userDept === 'quality') {
      return [
        dashboardItem,
        {
          id: 'quality',
          label: 'Quality Control Module',
          icon: CheckCircle,
          submenu: [
            { label: 'Inspections', path: '/quality/inspections', icon: FileText },
            { label: 'Defects Log', path: '/quality/defects', icon: AlertCircle },
            { label: 'Reports', path: '/quality/reports', icon: BarChart3 },
            { label: 'Certifications', path: '/quality/certifications', icon: CheckCircle }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          submenu: [
            { label: 'Quality Analytics', path: '/analytics/quality', icon: TrendingUp }
          ]
        }
      ]
    }

    // DISPATCH DEPARTMENT MENU
    if (userDept === 'dispatch') {
      return [
        dashboardItem,
        {
          id: 'dispatch',
          label: 'Dispatch & Logistics',
          icon: Truck,
          submenu: [
            { label: 'Shipments', path: '/dispatch/shipments', icon: FileText },
            { label: 'Routes', path: '/dispatch/routes', icon: Activity },
            { label: 'Vehicle Fleet', path: '/dispatch/vehicles', icon: Truck },
            { label: 'Tracking', path: '/dispatch/tracking', icon: Eye }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          submenu: [
            { label: 'Dispatch Analytics', path: '/analytics/dispatch', icon: TrendingUp }
          ]
        }
      ]
    }

    // ACCOUNTS/FINANCE DEPARTMENT MENU
    if (userDept === 'accounts') {
      return [
        dashboardItem,
        {
          id: 'accounts',
          label: 'Accounts & Finance',
          icon: DollarSign,
          submenu: [
            { label: 'Invoices', path: '/accounts/invoices', icon: Receipt },
            { label: 'Payments', path: '/accounts/payments', icon: DollarSign },
            { label: 'Statements', path: '/accounts/statements', icon: FileText },
            { label: 'Reports', path: '/accounts/reports', icon: BarChart3 }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          submenu: [
            { label: 'Financial Reports', path: '/analytics/accounts', icon: TrendingUp }
          ]
        }
      ]
    }

    // HR/PAYROLL DEPARTMENT MENU
    if (userDept === 'hr') {
      return [
        dashboardItem,
        {
          id: 'hr',
          label: 'HR & Payroll',
          icon: Users,
          submenu: [
            { label: 'Employees', path: '/hr/employees', icon: Users },
            { label: 'Attendance', path: '/hr/attendance', icon: CheckCircle },
            { label: 'Payroll', path: '/hr/payroll', icon: DollarSign },
            { label: 'Leave Management', path: '/hr/leaves', icon: Calendar }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          submenu: [
            { label: 'HR Analytics', path: '/analytics/hr', icon: TrendingUp }
          ]
        }
      ]
    }

    // Default fallback to buying menu
    return [dashboardItem]
  }

  const menuItems = getDepartmentMenuItems()

  // Get department badge color
  const getDepartmentBadgeColor = () => {
    const colors = {
      'buying': '#4F46E5',       // Blue
      'selling': '#7C3AED',      // Purple
      'inventory': '#059669',    // Green
      'production': '#F59E0B',   // Amber
      'toolroom': '#8B5CF6',     // Violet
      'quality': '#06B6D4',      // Cyan
      'dispatch': '#EC4899',     // Pink
      'accounts': '#14B8A6',     // Teal
      'hr': '#3B82F6',           // Blue
      'admin': '#DC2626'         // Red
    }
    return colors[userDept] || '#4F46E5'
  }

  const getDepartmentLabel = () => {
    const labels = {
      'buying': 'Buying/Procurement',
      'selling': 'Selling/Sales',
      'inventory': 'Inventory/Stock',
      'production': 'Production/Manufacturing',
      'toolroom': 'Tool Room/Maintenance',
      'quality': 'Quality Control',
      'dispatch': 'Dispatch/Logistics',
      'accounts': 'Accounts/Finance',
      'hr': 'HR/Payroll',
      'admin': 'Administration'
    }
    return labels[userDept] || 'Unknown'
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar Toggle Button (Mobile) */}
      <button 
        className="sidebar-toggle" 
        onClick={() => setSidebarOpen(!sidebarOpen)} 
        aria-label="Toggle sidebar"
      >
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

        {/* User Info with Department Badge */}
        <div className="user-section">
          <div className="user-avatar" style={{ backgroundColor: getDepartmentBadgeColor() }}>
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.full_name}</p>
            <p className="user-email">{user?.email}</p>
            <p style={{
              fontSize: '12px',
              marginTop: '4px',
              padding: '4px 8px',
              backgroundColor: getDepartmentBadgeColor() + '15',
              color: getDepartmentBadgeColor(),
              borderRadius: '4px',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              {getDepartmentLabel()}
            </p>
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

      {/* Main Content */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {children}
      </main>
    </div>
  )
}