import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/AuthContext'
import { 
  FileText, Send, DollarSign, Building2, Clipboard, Receipt,
  TrendingUp, Activity, Calendar, AlertCircle, Zap, Eye, Plus,
  ArrowUp, ArrowDown, Minus, BarChart3
} from 'lucide-react'
import '../styles/Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
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
    // Fetch dashboard statistics
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        // Fetch all stats in parallel
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

        // Sample recent activity
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
          <h1>Welcome, {user?.full_name}! 👋</h1>
          <p>Here's an overview of your procurement system</p>
        </div>
        <div className="header-date">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Statistics Cards */}
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

      {/* Recent Activity */}
      <div className="recent-activity">
        <div className="activity-header">
          <Activity size={24} />
          <h2>Recent Activity</h2>
        </div>
        <div className="activity-list">
          {recentActivity.map((activity, idx) => {
            let IconComponent = Activity
            if (activity.type === 'Material Request') IconComponent = FileText
            else if (activity.type === 'RFQ') IconComponent = Send
            else if (activity.type === 'Quotation') IconComponent = DollarSign
            else if (activity.type === 'Purchase Order') IconComponent = Clipboard
            
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

      {/* Quick Actions */}
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

      {/* Key Metrics */}
      <div className="key-metrics">
        <div className="metrics-header">
          <BarChart3 size={24} />
          <h2>Key Metrics</h2>
        </div>
        <div className="metrics-grid">
          <div className="metric-box">
            <h4>Procurement Cycle Time</h4>
            <p className="metric-value">4.2 days</p>
            <span className="metric-trend"><ArrowDown size={14} style={{display: 'inline'}} /> 12% from last month</span>
          </div>
          <div className="metric-box">
            <h4>Supplier Response Rate</h4>
            <p className="metric-value">94.5%</p>
            <span className="metric-trend"><ArrowUp size={14} style={{display: 'inline'}} /> 5% from last month</span>
          </div>
          <div className="metric-box">
            <h4>Average Quote Value</h4>
            <p className="metric-value">₹2,45,000</p>
            <span className="metric-trend"><Minus size={14} style={{display: 'inline'}} /> No change</span>
          </div>
          <div className="metric-box">
            <h4>Active Suppliers</h4>
            <p className="metric-value">{stats.suppliers}</p>
            <span className="metric-trend"><ArrowUp size={14} style={{display: 'inline'}} /> 3 new suppliers added</span>
          </div>
        </div>
      </div>
    </div>
  )
}
