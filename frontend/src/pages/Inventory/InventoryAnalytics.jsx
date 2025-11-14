import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Card from '../../components/Card/Card'
import Alert from '../../components/Alert/Alert'
import { TrendingUp, Boxes, AlertTriangle, DollarSign } from 'lucide-react'
import './Inventory.css'

export default function InventoryAnalytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/analytics/inventory')
      setAnalytics(response.data.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="inventory-container">
        <h1>Inventory Analytics</h1>
        <div className="no-data">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="inventory-container">
        <h1>Inventory Analytics</h1>
        <Alert type="danger">{error}</Alert>
      </div>
    )
  }

  return (
    <div className="inventory-container">
      <h1>📊 Inventory Analytics</h1>

      {/* Key Metrics */}
      <div className="inventory-stats">
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="inventory-stat-label">Total Inventory Value</div>
              <div className="inventory-stat-value" style={{ color: '#059669' }}>
                ₹{analytics?.total_value?.toLocaleString() || '0'}
              </div>
            </div>
            <DollarSign size={40} style={{ color: '#059669', opacity: 0.5 }} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="inventory-stat-label">Total Items</div>
              <div className="inventory-stat-value">{analytics?.total_items || 0}</div>
            </div>
            <Boxes size={40} style={{ color: '#3b82f6', opacity: 0.5 }} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="inventory-stat-label">Low Stock Items</div>
              <div className="inventory-stat-value" style={{ color: '#ef4444' }}>
                {analytics?.low_stock_items || 0}
              </div>
            </div>
            <AlertTriangle size={40} style={{ color: '#ef4444', opacity: 0.5 }} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="inventory-stat-label">Stock Turnover Rate</div>
              <div className="inventory-stat-value">{analytics?.turnover_rate?.toFixed(2) || '0'}x</div>
            </div>
            <TrendingUp size={40} style={{ color: '#10b981', opacity: 0.5 }} />
          </div>
        </Card>
      </div>

      {/* Warehouse Distribution */}
      <Card title="Inventory by Warehouse">
        <table className="inventory-items-table">
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>Total Items</th>
              <th>Value</th>
              <th>Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {analytics?.warehouse_distribution?.map((wh, idx) => (
              <tr key={idx}>
                <td>{wh.warehouse_name}</td>
                <td>{wh.item_count}</td>
                <td>₹{wh.value?.toLocaleString()}</td>
                <td>{wh.occupancy}%</td>
              </tr>
            )) || (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Top Items by Value */}
      <Card title="Top Items by Inventory Value">
        <table className="inventory-items-table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {analytics?.top_items?.map((item, idx) => (
              <tr key={idx}>
                <td>{item.item_code}</td>
                <td>{item.item_name}</td>
                <td>{item.quantity}</td>
                <td>₹{item.value?.toLocaleString()}</td>
              </tr>
            )) || (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Stock Movement Trend */}
      <Card title="Stock Movement (Last 30 Days)">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="inventory-stat-value">{analytics?.stock_movements_count || 0}</div>
          <div className="inventory-stat-label">Total Transactions</div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Inward: {analytics?.inward_qty || 0} | Outward: {analytics?.outward_qty || 0}
          </div>
        </div>
      </Card>
    </div>
  )
}