import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/AuthContext'
import { 
  FileText, Send, DollarSign, Building2, Clipboard, Receipt,
  TrendingUp, Activity, Calendar, AlertCircle, Zap, Eye, Plus,
  ArrowUp, ArrowDown, Minus, BarChart3, Users, ShoppingCart, Package, Truck, CreditCard, CheckCircle
} from 'lucide-react'
import '../styles/Dashboard.css'

// Buying Department Dashboard
function BuyingDashboard({ user }) {
  const [stats, setStats] = useState({
    materialRequests: 0,
    rfqs: 0,
    quotations: 0,
    suppliers: 0,
    purchaseOrders: 0,
    invoices: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        const [mrRes, rfqRes, quotRes, supplierRes, poRes, invoiceRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/material-requests`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/rfqs`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/quotations`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/suppliers`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/purchase-orders`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/purchase-invoices`, { headers }).catch(() => ({}))
        ])

        const [mrs, rfqs, quotations, suppliers, pos, invoices] = await Promise.all([
          mrRes.json?.().catch(() => []),
          rfqRes.json?.().catch(() => []),
          quotRes.json?.().catch(() => []),
          supplierRes.json?.().catch(() => []),
          poRes.json?.().catch(() => []),
          invoiceRes.json?.().catch(() => [])
        ])

        setStats({
          materialRequests: Array.isArray(mrs) ? mrs.length : 0,
          rfqs: Array.isArray(rfqs) ? rfqs.length : 0,
          quotations: Array.isArray(quotations) ? quotations.length : 0,
          suppliers: Array.isArray(suppliers) ? suppliers.length : 0,
          purchaseOrders: Array.isArray(pos) ? pos.length : 0,
          invoices: Array.isArray(invoices) ? invoices.length : 0
        })

        setRecentActivity([
          { type: 'Material Request', action: 'Created', time: '2 hours ago', status: 'draft' },
          { type: 'RFQ', action: 'Sent to Suppliers', time: '4 hours ago', status: 'sent' },
          { type: 'Quotation', action: 'Received from Supplier', time: '6 hours ago', status: 'received' },
          { type: 'Purchase Order', action: 'Created', time: '1 day ago', status: 'draft' }
        ])
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Buying Module, {user?.full_name}! 👋</h1>
          <p>Manage your procurement operations with ease</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#4F46E5', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🔵 Buying Department
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon material-requests">
            <FileText size={28} />
          </div>
          <div className="stat-content">
            <h3>Material Requests</h3>
            <p className="stat-value">{stats.materialRequests}</p>
            <span className="stat-label">Total MRs</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon rfqs">
            <Send size={28} />
          </div>
          <div className="stat-content">
            <h3>RFQs</h3>
            <p className="stat-value">{stats.rfqs}</p>
            <span className="stat-label">Active RFQs</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon quotations">
            <DollarSign size={28} />
          </div>
          <div className="stat-content">
            <h3>Quotations</h3>
            <p className="stat-value">{stats.quotations}</p>
            <span className="stat-label">Supplier Quotes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon suppliers">
            <Building2 size={28} />
          </div>
          <div className="stat-content">
            <h3>Suppliers</h3>
            <p className="stat-value">{stats.suppliers}</p>
            <span className="stat-label">Active Suppliers</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purchase-orders">
            <Clipboard size={28} />
          </div>
          <div className="stat-content">
            <h3>Purchase Orders</h3>
            <p className="stat-value">{stats.purchaseOrders}</p>
            <span className="stat-label">Total POs</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon invoices">
            <Receipt size={28} />
          </div>
          <div className="stat-content">
            <h3>Invoices</h3>
            <p className="stat-value">{stats.invoices}</p>
            <span className="stat-label">Total Invoices</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/buying/material-requests/new" className="action-btn primary">
            <Plus size={18} /> Create Material Request
          </a>
          <a href="/buying/rfqs/new" className="action-btn secondary">
            <Send size={18} /> Create RFQ
          </a>
          <a href="/buying/quotations/new" className="action-btn tertiary">
            <DollarSign size={18} /> Add Quotation
          </a>
          <a href="/buying/material-requests" className="action-btn outline">
            <FileText size={18} /> View All Requests
          </a>
        </div>
      </div>
    </div>
  )
}

// Selling Department Dashboard
function SellingDashboard({ user }) {
  const [stats, setStats] = useState({
    quotations: 0,
    salesOrders: 0,
    deliveryNotes: 0,
    invoices: 0,
    customers: 0,
    totalSales: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        setStats({
          quotations: 12,
          salesOrders: 8,
          deliveryNotes: 15,
          invoices: 20,
          customers: 45,
          totalSales: 950000
        })

        setRecentActivity([
          { type: 'Quotation', action: 'Sent to Customer', time: '2 hours ago', status: 'sent' },
          { type: 'Sales Order', action: 'Confirmed', time: '4 hours ago', status: 'confirmed' },
          { type: 'Delivery Note', action: 'Created', time: '6 hours ago', status: 'draft' },
          { type: 'Invoice', action: 'Paid', time: '1 day ago', status: 'paid' }
        ])
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Selling Module, {user?.full_name}! 📈</h1>
          <p>Manage your sales pipeline and customer relationships</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#7C3AED', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🟣 Selling Department
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#7C3AED', backgroundColor: '#7C3AED15' }}>
            <DollarSign size={28} />
          </div>
          <div className="stat-content">
            <h3>Quotations</h3>
            <p className="stat-value">{stats.quotations}</p>
            <span className="stat-label">Active Quotes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#7C3AED', backgroundColor: '#7C3AED15' }}>
            <ShoppingCart size={28} />
          </div>
          <div className="stat-content">
            <h3>Sales Orders</h3>
            <p className="stat-value">{stats.salesOrders}</p>
            <span className="stat-label">Pending Orders</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#7C3AED', backgroundColor: '#7C3AED15' }}>
            <Truck size={28} />
          </div>
          <div className="stat-content">
            <h3>Deliveries</h3>
            <p className="stat-value">{stats.deliveryNotes}</p>
            <span className="stat-label">Delivery Notes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#7C3AED', backgroundColor: '#7C3AED15' }}>
            <CreditCard size={28} />
          </div>
          <div className="stat-content">
            <h3>Invoices</h3>
            <p className="stat-value">{stats.invoices}</p>
            <span className="stat-label">Total Invoices</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#7C3AED', backgroundColor: '#7C3AED15' }}>
            <Users size={28} />
          </div>
          <div className="stat-content">
            <h3>Customers</h3>
            <p className="stat-value">{stats.customers}</p>
            <span className="stat-label">Total Customers</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#7C3AED', backgroundColor: '#7C3AED15' }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Sales</h3>
            <p className="stat-value">₹{(stats.totalSales / 100000).toFixed(1)}L</p>
            <span className="stat-label">This Month</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/selling/quotations/new" className="action-btn primary" style={{ backgroundColor: '#7C3AED' }}>
            <Plus size={18} /> Create Quotation
          </a>
          <a href="/selling/sales-orders/new" className="action-btn secondary" style={{ backgroundColor: '#7C3AED' }}>
            <ShoppingCart size={18} /> Create Sales Order
          </a>
          <a href="/selling/customers/new" className="action-btn tertiary" style={{ backgroundColor: '#7C3AED' }}>
            <Users size={18} /> Add Customer
          </a>
          <a href="/selling/quotations" className="action-btn outline">
            <DollarSign size={18} /> View All Quotations
          </a>
        </div>
      </div>
    </div>
  )
}

// Admin Department Dashboard
function AdminDashboard({ user }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeDepartments: 3,
    systemHealth: '98%',
    lastBackup: 'Today'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStats({
          totalUsers: 25,
          activeDepartments: 3,
          systemHealth: '98%',
          lastBackup: 'Today 3:45 PM'
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Admin Panel, {user?.full_name}! ⚙️</h1>
          <p>System administration and user management</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#DC2626', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🔴 Admin Department
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <Users size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Users</h3>
            <p className="stat-value">{stats.totalUsers}</p>
            <span className="stat-label">Active & Inactive</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <Building2 size={28} />
          </div>
          <div className="stat-content">
            <h3>Departments</h3>
            <p className="stat-value">{stats.activeDepartments}</p>
            <span className="stat-label">Active Departments</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>System Health</h3>
            <p className="stat-value">{stats.systemHealth}</p>
            <span className="stat-label">All Systems OK</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <Package size={28} />
          </div>
          <div className="stat-content">
            <h3>Last Backup</h3>
            <p className="stat-value">Today</p>
            <span className="stat-label">{stats.lastBackup}</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Admin Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/admin/users" className="action-btn primary" style={{ backgroundColor: '#DC2626' }}>
            <Users size={18} /> Manage Users
          </a>
          <a href="/admin/departments" className="action-btn secondary" style={{ backgroundColor: '#DC2626' }}>
            <Building2 size={18} /> Manage Departments
          </a>
          <a href="/admin/system" className="action-btn tertiary" style={{ backgroundColor: '#DC2626' }}>
            <Activity size={18} /> System Settings
          </a>
          <a href="/admin/reports" className="action-btn outline">
            <BarChart3 size={18} /> View Reports
          </a>
        </div>
      </div>
    </div>
  )
}

// Inventory/Stock Department Dashboard
function InventoryDashboard({ user }) {
  const [stats, setStats] = useState({
    warehouseLocations: 0,
    totalStock: 0,
    lowStockItems: 0,
    stockMovements: 0,
    stockTransfers: 0,
    reconciliations: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        // Fetch warehouse and stock statistics
        const [warehouseRes, balanceRes, ledgerRes, transferRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/stock/warehouses`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/stock/stock-balance`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/stock/ledger`, { headers }).catch(() => ({})),
          fetch(`${import.meta.env.VITE_API_URL}/stock/transfers`, { headers }).catch(() => ({}))
        ])

        const [warehouses, balances, ledger, transfers] = await Promise.all([
          warehouseRes.json?.().catch(() => []),
          balanceRes.json?.().catch(() => []),
          ledgerRes.json?.().catch(() => []),
          transferRes.json?.().catch(() => [])
        ])

        // Calculate low stock items
        const lowStockCount = Array.isArray(balances) 
          ? balances.filter(item => item.reorder_level && item.quantity_on_hand < item.reorder_level).length 
          : 0

        setStats({
          warehouseLocations: Array.isArray(warehouses) ? warehouses.length : 0,
          totalStock: Array.isArray(balances) ? balances.length : 0,
          lowStockItems: lowStockCount,
          stockMovements: Array.isArray(ledger) ? ledger.length : 0,
          stockTransfers: Array.isArray(transfers) ? transfers.length : 0,
          reconciliations: 0
        })

        setRecentActivity([
          { type: 'Stock Entry', action: 'Goods Received', time: '1 hour ago', status: 'completed' },
          { type: 'Stock Transfer', action: 'Inter-warehouse Movement', time: '3 hours ago', status: 'completed' },
          { type: 'Low Stock Alert', action: '5 items below reorder level', time: '2 hours ago', status: 'alert' },
          { type: 'Stock Reconciliation', action: 'Physical count initiated', time: '5 hours ago', status: 'in-progress' }
        ])
      } catch (error) {
        console.error('Error fetching inventory stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Inventory Module, {user?.full_name}! 📦</h1>
          <p>Manage warehouse stock, transfers, and inventory reconciliation</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#059669', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🟢 Inventory/Stock Department
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#059669', backgroundColor: '#05966915' }}>
            <Building2 size={28} />
          </div>
          <div className="stat-content">
            <h3>Warehouse Locations</h3>
            <p className="stat-value">{stats.warehouseLocations}</p>
            <span className="stat-label">Total Warehouses</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#059669', backgroundColor: '#05966915' }}>
            <Package size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Stock Items</h3>
            <p className="stat-value">{stats.totalStock}</p>
            <span className="stat-label">Items in Stock</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <AlertCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Low Stock Items</h3>
            <p className="stat-value">{stats.lowStockItems}</p>
            <span className="stat-label">Below Reorder Level</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#059669', backgroundColor: '#05966915' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>Stock Movements</h3>
            <p className="stat-value">{stats.stockMovements}</p>
            <span className="stat-label">Total Transactions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#059669', backgroundColor: '#05966915' }}>
            <Truck size={28} />
          </div>
          <div className="stat-content">
            <h3>Stock Transfers</h3>
            <p className="stat-value">{stats.stockTransfers}</p>
            <span className="stat-label">Inter-warehouse Moves</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#059669', backgroundColor: '#05966915' }}>
            <BarChart3 size={28} />
          </div>
          <div className="stat-content">
            <h3>Reconciliations</h3>
            <p className="stat-value">{stats.reconciliations}</p>
            <span className="stat-label">Physical Counts</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <div className="activity-header">
          <Activity size={24} />
          <h2>Recent Activity</h2>
        </div>
        <div className="activity-list">
          {recentActivity.map((activity, idx) => {
            let IconComponent = Activity
            if (activity.type === 'Stock Entry') IconComponent = FileText
            else if (activity.type === 'Stock Transfer') IconComponent = Truck
            else if (activity.type === 'Low Stock Alert') IconComponent = AlertCircle
            else if (activity.type === 'Stock Reconciliation') IconComponent = BarChart3
            
            return (
            <div key={idx} className="activity-item">
              <div className="activity-icon">
                <IconComponent size={20} />
              </div>
              <div className="activity-details">
                <h4>{activity.type}</h4>
                <p>{activity.action}</p>
              </div>
              <div className="activity-meta">
                <span className={`status ${activity.status}`}>{activity.status}</span>
                <span className="time">{activity.time}</span>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/inventory/stock-entries/new" className="action-btn primary" style={{ backgroundColor: '#059669' }}>
            <Plus size={18} /> Create Stock Entry
          </a>
          <a href="/inventory/transfers/new" className="action-btn secondary" style={{ backgroundColor: '#059669' }}>
            <Truck size={18} /> Stock Transfer
          </a>
          <a href="/inventory/reconciliation/new" className="action-btn tertiary" style={{ backgroundColor: '#059669' }}>
            <BarChart3 size={18} /> Stock Reconciliation
          </a>
          <a href="/inventory/stock-balance" className="action-btn outline">
            <Package size={18} /> View Stock Balance
          </a>
        </div>
      </div>
    </div>
  )
}

// Production Department Dashboard
function ProductionDashboard({ user }) {
  const [stats, setStats] = useState({
    activeOrders: 0,
    completedToday: 0,
    inProgress: 0,
    quality: 0,
    downtime: 0,
    efficiency: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStats({
      activeOrders: 12,
      completedToday: 8,
      inProgress: 5,
      quality: '98.5%',
      downtime: '0.5h',
      efficiency: '92%'
    })
    setLoading(false)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Production, {user?.full_name}! 🏭</h1>
          <p>Manage manufacturing orders and production schedules</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#F59E0B', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🟡 Production/Manufacturing
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#F59E0B', backgroundColor: '#F59E0B15' }}>
            <Clipboard size={28} />
          </div>
          <div className="stat-content">
            <h3>Active Orders</h3>
            <p className="stat-value">{stats.activeOrders}</p>
            <span className="stat-label">Production Orders</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#F59E0B', backgroundColor: '#F59E0B15' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Completed Today</h3>
            <p className="stat-value">{stats.completedToday}</p>
            <span className="stat-label">Finished Orders</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#F59E0B', backgroundColor: '#F59E0B15' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>In Progress</h3>
            <p className="stat-value">{stats.inProgress}</p>
            <span className="stat-label">Currently Running</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10B981', backgroundColor: '#10B98115' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Quality Rate</h3>
            <p className="stat-value">{stats.quality}</p>
            <span className="stat-label">Pass Rate</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <AlertCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Downtime</h3>
            <p className="stat-value">{stats.downtime}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#F59E0B', backgroundColor: '#F59E0B15' }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-content">
            <h3>Efficiency</h3>
            <p className="stat-value">{stats.efficiency}</p>
            <span className="stat-label">Line Efficiency</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/production/orders/new" className="action-btn primary" style={{ backgroundColor: '#F59E0B' }}>
            <Plus size={18} /> Create Production Order
          </a>
          <a href="/production/schedules" className="action-btn secondary" style={{ backgroundColor: '#F59E0B' }}>
            <Calendar size={18} /> View Schedule
          </a>
          <a href="/production/batch-tracking" className="action-btn tertiary" style={{ backgroundColor: '#F59E0B' }}>
            <Package size={18} /> Batch Tracking
          </a>
          <a href="/production/analytics" className="action-btn outline">
            <BarChart3 size={18} /> Production Analytics
          </a>
        </div>
      </div>
    </div>
  )
}

// Quality Control Dashboard
function QualityDashboard({ user }) {
  const [stats, setStats] = useState({
    inspections: 0,
    passed: 0,
    rejected: 0,
    defectRate: 0,
    samplesChecked: 0,
    certifications: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStats({
      inspections: 45,
      passed: 44,
      rejected: 1,
      defectRate: '2.2%',
      samplesChecked: 320,
      certifications: 98
    })
    setLoading(false)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Quality Control, {user?.full_name}! ✓</h1>
          <p>Monitor and ensure product quality standards</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#06B6D4', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🔵 Quality Control/QC
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#06B6D4', backgroundColor: '#06B6D415' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Inspections</h3>
            <p className="stat-value">{stats.inspections}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10B981', backgroundColor: '#10B98115' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Passed</h3>
            <p className="stat-value">{stats.passed}</p>
            <span className="stat-label">Quality OK</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <AlertCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Rejected</h3>
            <p className="stat-value">{stats.rejected}</p>
            <span className="stat-label">Failed Inspection</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#06B6D4', backgroundColor: '#06B6D415' }}>
            <BarChart3 size={28} />
          </div>
          <div className="stat-content">
            <h3>Defect Rate</h3>
            <p className="stat-value">{stats.defectRate}</p>
            <span className="stat-label">Overall</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#06B6D4', backgroundColor: '#06B6D415' }}>
            <Package size={28} />
          </div>
          <div className="stat-content">
            <h3>Samples Checked</h3>
            <p className="stat-value">{stats.samplesChecked}</p>
            <span className="stat-label">This Week</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10B981', backgroundColor: '#10B98115' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Certifications</h3>
            <p className="stat-value">{stats.certifications}</p>
            <span className="stat-label">Valid</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/quality/inspections/new" className="action-btn primary" style={{ backgroundColor: '#06B6D4' }}>
            <Plus size={18} /> Create Inspection
          </a>
          <a href="/quality/defects" className="action-btn secondary" style={{ backgroundColor: '#06B6D4' }}>
            <AlertCircle size={18} /> Log Defect
          </a>
          <a href="/quality/reports" className="action-btn tertiary" style={{ backgroundColor: '#06B6D4' }}>
            <BarChart3 size={18} /> Quality Reports
          </a>
          <a href="/quality/certifications" className="action-btn outline">
            <CheckCircle size={18} /> Certifications
          </a>
        </div>
      </div>
    </div>
  )
}

// Dispatch/Logistics Dashboard
function DispatchDashboard({ user }) {
  const [stats, setStats] = useState({
    pendingShipments: 0,
    shipped: 0,
    delivered: 0,
    inTransit: 0,
    routes: 0,
    vehicles: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStats({
      pendingShipments: 8,
      shipped: 15,
      delivered: 42,
      inTransit: 6,
      routes: 12,
      vehicles: 8
    })
    setLoading(false)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Dispatch & Logistics, {user?.full_name}! 🚚</h1>
          <p>Manage shipments, deliveries, and vehicle fleet</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#EC4899', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🟩 Dispatch/Logistics
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#EC4899', backgroundColor: '#EC489915' }}>
            <FileText size={28} />
          </div>
          <div className="stat-content">
            <h3>Pending Shipments</h3>
            <p className="stat-value">{stats.pendingShipments}</p>
            <span className="stat-label">Awaiting Pickup</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#EC4899', backgroundColor: '#EC489915' }}>
            <Send size={28} />
          </div>
          <div className="stat-content">
            <h3>Shipped</h3>
            <p className="stat-value">{stats.shipped}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10B981', backgroundColor: '#10B98115' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Delivered</h3>
            <p className="stat-value">{stats.delivered}</p>
            <span className="stat-label">This Month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#EC4899', backgroundColor: '#EC489915' }}>
            <Truck size={28} />
          </div>
          <div className="stat-content">
            <h3>In Transit</h3>
            <p className="stat-value">{stats.inTransit}</p>
            <span className="stat-label">Active Shipments</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#EC4899', backgroundColor: '#EC489915' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>Active Routes</h3>
            <p className="stat-value">{stats.routes}</p>
            <span className="stat-label">Delivery Routes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#EC4899', backgroundColor: '#EC489915' }}>
            <Truck size={28} />
          </div>
          <div className="stat-content">
            <h3>Vehicles</h3>
            <p className="stat-value">{stats.vehicles}</p>
            <span className="stat-label">Active Fleet</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/dispatch/shipments/new" className="action-btn primary" style={{ backgroundColor: '#EC4899' }}>
            <Plus size={18} /> Create Shipment
          </a>
          <a href="/dispatch/routes" className="action-btn secondary" style={{ backgroundColor: '#EC4899' }}>
            <Activity size={18} /> Manage Routes
          </a>
          <a href="/dispatch/vehicles" className="action-btn tertiary" style={{ backgroundColor: '#EC4899' }}>
            <Truck size={18} /> Vehicle Fleet
          </a>
          <a href="/dispatch/tracking" className="action-btn outline">
            <Eye size={18} /> Track Shipments
          </a>
        </div>
      </div>
    </div>
  )
}

// Accounts/Finance Dashboard
function AccountsDashboard({ user }) {
  const [stats, setStats] = useState({
    revenue: 0,
    expenses: 0,
    balance: 0,
    invoices: 0,
    payments: 0,
    accounts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStats({
      revenue: 2500000,
      expenses: 1800000,
      balance: 700000,
      invoices: 145,
      payments: 89,
      accounts: 45
    })
    setLoading(false)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Accounts & Finance, {user?.full_name}! 💰</h1>
          <p>Manage financial operations and accounting</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#14B8A6', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🟢 Accounts/Finance
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#14B8A6', backgroundColor: '#14B8A615' }}>
            <DollarSign size={28} />
          </div>
          <div className="stat-content">
            <h3>Revenue</h3>
            <p className="stat-value">₹{(stats.revenue / 100000).toFixed(1)}L</p>
            <span className="stat-label">This Month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#14B8A6', backgroundColor: '#14B8A615' }}>
            <DollarSign size={28} />
          </div>
          <div className="stat-content">
            <h3>Expenses</h3>
            <p className="stat-value">₹{(stats.expenses / 100000).toFixed(1)}L</p>
            <span className="stat-label">This Month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10B981', backgroundColor: '#10B98115' }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-content">
            <h3>Balance</h3>
            <p className="stat-value">₹{(stats.balance / 100000).toFixed(1)}L</p>
            <span className="stat-label">Net Profit</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#14B8A6', backgroundColor: '#14B8A615' }}>
            <Receipt size={28} />
          </div>
          <div className="stat-content">
            <h3>Invoices</h3>
            <p className="stat-value">{stats.invoices}</p>
            <span className="stat-label">Total Invoices</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#14B8A6', backgroundColor: '#14B8A615' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Payments Received</h3>
            <p className="stat-value">{stats.payments}</p>
            <span className="stat-label">This Month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#14B8A6', backgroundColor: '#14B8A615' }}>
            <Building2 size={28} />
          </div>
          <div className="stat-content">
            <h3>Accounts</h3>
            <p className="stat-value">{stats.accounts}</p>
            <span className="stat-label">Ledger Accounts</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/accounts/invoices/new" className="action-btn primary" style={{ backgroundColor: '#14B8A6' }}>
            <Plus size={18} /> Create Invoice
          </a>
          <a href="/accounts/payments" className="action-btn secondary" style={{ backgroundColor: '#14B8A6' }}>
            <DollarSign size={18} /> Record Payment
          </a>
          <a href="/accounts/statements" className="action-btn tertiary" style={{ backgroundColor: '#14B8A6' }}>
            <FileText size={18} /> Financial Statements
          </a>
          <a href="/accounts/reports" className="action-btn outline">
            <BarChart3 size={18} /> Financial Reports
          </a>
        </div>
      </div>
    </div>
  )
}

// HR/Payroll Dashboard
function HRDashboard({ user }) {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    attendanceRate: 0,
    pendingSalaries: 0,
    leaves: 0,
    performances: 0,
    trainings: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStats({
      totalEmployees: 125,
      attendanceRate: '94.5%',
      pendingSalaries: 45,
      leaves: 12,
      performances: 8,
      trainings: 3
    })
    setLoading(false)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to HR & Payroll, {user?.full_name}! 👥</h1>
          <p>Manage employees, payroll, and human resources</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#3B82F6', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🔵 HR/Payroll
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#3B82F6', backgroundColor: '#3B82F615' }}>
            <Users size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Employees</h3>
            <p className="stat-value">{stats.totalEmployees}</p>
            <span className="stat-label">Active Staff</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10B981', backgroundColor: '#10B98115' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Attendance Rate</h3>
            <p className="stat-value">{stats.attendanceRate}</p>
            <span className="stat-label">This Month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#3B82F6', backgroundColor: '#3B82F615' }}>
            <DollarSign size={28} />
          </div>
          <div className="stat-content">
            <h3>Pending Salaries</h3>
            <p className="stat-value">{stats.pendingSalaries}</p>
            <span className="stat-label">To be Processed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#F59E0B', backgroundColor: '#F59E0B15' }}>
            <Calendar size={28} />
          </div>
          <div className="stat-content">
            <h3>Leave Applications</h3>
            <p className="stat-value">{stats.leaves}</p>
            <span className="stat-label">Pending Approval</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#3B82F6', backgroundColor: '#3B82F615' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>Performances</h3>
            <p className="stat-value">{stats.performances}</p>
            <span className="stat-label">Pending Reviews</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#3B82F6', backgroundColor: '#3B82F615' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Trainings</h3>
            <p className="stat-value">{stats.trainings}</p>
            <span className="stat-label">Scheduled</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/hr/employees/new" className="action-btn primary" style={{ backgroundColor: '#3B82F6' }}>
            <Plus size={18} /> Add Employee
          </a>
          <a href="/hr/attendance" className="action-btn secondary" style={{ backgroundColor: '#3B82F6' }}>
            <CheckCircle size={18} /> Manage Attendance
          </a>
          <a href="/hr/payroll/new" className="action-btn tertiary" style={{ backgroundColor: '#3B82F6' }}>
            <DollarSign size={18} /> Process Payroll
          </a>
          <a href="/hr/analytics" className="action-btn outline">
            <BarChart3 size={18} /> HR Analytics
          </a>
        </div>
      </div>
    </div>
  )
}

// ToolRoom Department Dashboard
function ToolRoomDashboard({ user }) {
  const [stats, setStats] = useState({
    totalTools: 0,
    dieInUse: 0,
    maintenanceDue: 0,
    utilization: 0,
    reworks: 0,
    downtime: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStats({
      totalTools: 285,
      dieInUse: 42,
      maintenanceDue: 8,
      utilization: '87%',
      reworks: 3,
      downtime: '2.5h'
    })
    setLoading(false)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome to Tool Room, {user?.full_name}! 🔧</h1>
          <p>Manage tools, dies, maintenance, and equipment</p>
        </div>
        <div className="header-date" style={{ backgroundColor: '#8B5CF6', color: 'white', padding: '8px 16px', borderRadius: '8px' }}>
          🟣 Tool Room/Maintenance
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#8B5CF6', backgroundColor: '#8B5CF615' }}>
            <Package size={28} />
          </div>
          <div className="stat-content">
            <h3>Total Tools</h3>
            <p className="stat-value">{stats.totalTools}</p>
            <span className="stat-label">In Inventory</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#8B5CF6', backgroundColor: '#8B5CF615' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>Dies In Use</h3>
            <p className="stat-value">{stats.dieInUse}</p>
            <span className="stat-label">Active Dies</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#DC2626', backgroundColor: '#DC262615' }}>
            <AlertCircle size={28} />
          </div>
          <div className="stat-content">
            <h3>Maintenance Due</h3>
            <p className="stat-value">{stats.maintenanceDue}</p>
            <span className="stat-label">Scheduled</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#8B5CF6', backgroundColor: '#8B5CF615' }}>
            <TrendingUp size={28} />
          </div>
          <div className="stat-content">
            <h3>Utilization Rate</h3>
            <p className="stat-value">{stats.utilization}</p>
            <span className="stat-label">Tool Usage</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#8B5CF6', backgroundColor: '#8B5CF615' }}>
            <Clipboard size={28} />
          </div>
          <div className="stat-content">
            <h3>Reworks</h3>
            <p className="stat-value">{stats.reworks}</p>
            <span className="stat-label">Pending Rework</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#8B5CF6', backgroundColor: '#8B5CF615' }}>
            <Activity size={28} />
          </div>
          <div className="stat-content">
            <h3>Downtime</h3>
            <p className="stat-value">{stats.downtime}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <div className="action-header">
          <Zap size={24} />
          <h2>Quick Actions</h2>
        </div>
        <div className="action-buttons">
          <a href="/toolroom/tools/new" className="action-btn primary" style={{ backgroundColor: '#8B5CF6' }}>
            <Plus size={18} /> Add Tool
          </a>
          <a href="/toolroom/maintenance/new" className="action-btn secondary" style={{ backgroundColor: '#8B5CF6' }}>
            <AlertCircle size={18} /> Schedule Maintenance
          </a>
          <a href="/toolroom/die-register" className="action-btn tertiary" style={{ backgroundColor: '#8B5CF6' }}>
            <Package size={18} /> Die Register
          </a>
          <a href="/toolroom/analytics" className="action-btn outline">
            <BarChart3 size={18} /> Analytics
          </a>
        </div>
      </div>
    </div>
  )
}

// Main Department Dashboard Component
export default function DepartmentDashboard() {
  const { user } = useAuth()

  if (!user) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
  }

  const department = user.department || 'buying'

  switch (department) {
    case 'selling':
      return <SellingDashboard user={user} />
    case 'admin':
      return <AdminDashboard user={user} />
    case 'inventory':
      return <InventoryDashboard user={user} />
    case 'production':
      return <ProductionDashboard user={user} />
    case 'toolroom':
      return <ToolRoomDashboard user={user} />
    case 'quality':
      return <QualityDashboard user={user} />
    case 'dispatch':
      return <DispatchDashboard user={user} />
    case 'accounts':
      return <AccountsDashboard user={user} />
    case 'hr':
      return <HRDashboard user={user} />
    case 'buying':
    default:
      return <BuyingDashboard user={user} />
  }
}