import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Truck } from 'lucide-react'
import * as productionService from '../../services/productionService'
import CreateWorkOrderModal from '../../components/Production/CreateWorkOrderModal'
import './Production.css'

export default function ProductionOrders() {
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchWorkOrders()
  }, [filters])

  const fetchWorkOrders = async () => {
    try {
      setLoading(true)
      const response = await productionService.getWorkOrders(filters)
      setWorkOrders(response.data || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to fetch work orders')
      setWorkOrders([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'status-draft',
      planned: 'status-planned',
      'in-progress': 'status-in-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    }
    return colors[status] || 'status-draft'
  }

  return (
    <div className="production-container">
      <div className="production-header">
        <div>
          <h1>🏭 Production Orders</h1>
          <p style={{ color: '#666', margin: '5px 0 0 0' }}>Manage work orders and production tasks</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-submit w-auto"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> New Order
        </button>
      </div>

      {/* Modal */}
      <CreateWorkOrderModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchWorkOrders}
      />

      {/* Filters */}
      <div className="filter-section">
        <div className="filter-group">
          <label>Status</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            name="search"
            placeholder="Search order ID or item..."
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
      </div>

      {/* Work Orders Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading work orders...</p>
        </div>
      ) : error ? (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '20px', color: '#dc2626' }}>
          {error}
        </div>
      ) : workOrders.length > 0 ? (
        <div className="work-orders-grid">
          {workOrders.map(order => (
            <div key={order.wo_id} className="work-order-card">
              <div className="work-order-header">
                <div className="work-order-id">{order.wo_id}</div>
                <div className={`work-order-status ${getStatusColor(order.status)}`}>
                  {order.status}
                </div>
              </div>

              <div className="work-order-details">
                <div className="detail-row">
                  <span className="detail-label">Item</span>
                  <span className="detail-value">{order.item_name || order.item_code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Quantity</span>
                  <span className="detail-value">{order.quantity}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Unit Cost</span>
                  <span className="detail-value">₹{order.unit_cost?.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total</span>
                  <span className="detail-value">₹{order.total_cost?.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Priority</span>
                  <span className="detail-value">{order.priority}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Due Date</span>
                  <span className="detail-value">{new Date(order.required_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="work-order-actions">
                <button className="btn-edit">
                  <Edit2 size={16} /> Edit
                </button>
                <button className="btn-track">
                  <Truck size={16} /> Track
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f9fafb', borderRadius: '8px' }}>
          <p style={{ color: '#666' }}>No production orders found</p>
        </div>
      )}
    </div>
  )
}