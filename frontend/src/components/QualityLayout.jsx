import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  Home,
  CheckSquare,
  AlertTriangle,
  RefreshCw,
  Calendar,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../hooks/AuthContext'

const QualityLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedMenu, setExpandedMenu] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()

  const menuItems = [
    {
      label: 'Dashboard',
      icon: Home,
      path: '/quality/dashboard',
      submenu: null
    },
    {
      label: 'Quality Checks',
      icon: CheckSquare,
      path: '/quality/checks',
      submenu: [
        { label: 'Incoming QC', path: '/quality/checks?type=incoming' },
        { label: 'In-Process QC', path: '/quality/checks?type=in_process' },
        { label: 'Final QC', path: '/quality/checks?type=final' }
      ]
    },
    {
      label: 'Non-Conformance',
      icon: AlertTriangle,
      path: '/quality/ncr',
      submenu: null
    },
    {
      label: 'Review & Action',
      icon: RefreshCw,
      path: '/quality/capa',
      submenu: null
    },
    {
      label: 'Quality Meetings',
      icon: Calendar,
      path: '/quality/meetings',
      submenu: null
    },
    {
      label: 'Supplier Quality',
      icon: TrendingUp,
      path: '/quality/supplier-quality',
      submenu: null
    },
    {
      label: 'Quality Feedback',
      icon: MessageSquare,
      path: '/quality/feedback',
      submenu: null
    },
    {
      label: 'Quality Reports',
      icon: BarChart3,
      path: '/quality/reports',
      submenu: null
    }
  ]

  const isActive = (path) => location.pathname === path

  const toggleSubmenu = (index) => {
    setExpandedMenu(expandedMenu === index ? null : index)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col fixed h-screen z-50`}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold">
                Q
              </div>
              <span className="font-bold text-lg">Quality</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className={`${sidebarOpen ? 'mb-8' : 'mb-4'}`}>
            {sidebarOpen && <p className="text-xs font-semibold text-gray-500 px-3 mb-4">MENU</p>}
            <ul className="space-y-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const hasSubmenu = item.submenu && item.submenu.length > 0
                const isMenuActive = isActive(item.path) || (hasSubmenu && item.submenu.some(sub => isActive(sub.path)))

                return (
                  <li key={index}>
                    {hasSubmenu ? (
                      <>
                        <button
                          onClick={() => toggleSubmenu(index)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                            isMenuActive
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-800 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5" />
                            {sidebarOpen && <span>{item.label}</span>}
                          </div>
                          {sidebarOpen && (
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                expandedMenu === index ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </button>
                        {sidebarOpen && expandedMenu === index && (
                          <ul className="pl-6 mt-2 space-y-1 border-l border-gray-700">
                            {item.submenu.map((subitem, subindex) => (
                              <li key={subindex}>
                                <a
                                  href={subitem.path}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    navigate(subitem.path)
                                  }}
                                  className={`block px-3 py-2 rounded text-sm transition-colors ${
                                    isActive(subitem.path)
                                      ? 'bg-blue-500 text-white'
                                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                  }`}
                                >
                                  {subitem.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <a
                        href={item.path}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(item.path)
                        }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive(item.path)
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-800 text-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {sidebarOpen && <span>{item.label}</span>}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom Menu */}
        <div className="border-t border-gray-700 p-3 space-y-2">
          <button
            onClick={() => navigate('/quality/settings')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 transition-colors"
          >
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span>Settings</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${sidebarOpen ? 'ml-64' : 'ml-20'} flex-1 flex flex-col transition-all duration-300`}>
        {/* Top Bar */}
        <div className="bg-white border-b shadow-sm sticky top-0 z-40">
          <div className="flex items-center justify-between h-16 px-6">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Quality Management System</h1>
              <p className="text-xs text-gray-600">{user?.name || 'Quality Officer'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                {user?.name?.charAt(0) || 'Q'}
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default QualityLayout
