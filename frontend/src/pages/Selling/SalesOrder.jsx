import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import { Link, useNavigate } from 'react-router-dom'
import { 
  FileText, Edit2, Send, Download, Eye, Package, AlertCircle, CheckCircle, XCircle, 
  Clock, Plus, TrendingUp, AlertTriangle, Truck, Trash2
} from 'lucide-react'
import CreateSalesOrderModal from '../../components/Selling/CreateSalesOrderModal'
import ViewSalesOrderModal from '../../components/Selling/ViewSalesOrderModal'
import EditSalesOrderModal from '../../components/Selling/EditSalesOrderModal'
import './Selling.css'

export default function SalesOrder() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [viewOrderId, setViewOrderId] = useState(null)
  const [editOrderId, setEditOrderId] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    confirmed: 0,
    dispatched: 0,
    invoiced: 0,
    cancelled: 0,
    total_value: 0
  })
  const [filters, setFilters] = useState({
    status: '',
    customer: '',
    search: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [filters])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      )
      const res = await fetch(`http://localhost:5000/api/selling/sales-orders?${query}`)
      const data = await res.json()
      if (data.success) {
        setOrders(data.data || [])
        calculateStats(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch sales orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError('Error fetching sales orders')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    const newStats = {
      total: data.length,
      draft: 0,
      confirmed: 0,
      dispatched: 0,
      invoiced: 0,
      cancelled: 0,
      total_value: 0
    }

    data.forEach((order) => {
      if (order.status) {
        newStats[order.status] = (newStats[order.status] || 0) + 1
      }
      newStats.total_value += parseFloat(order.total_value || 0)
    })

    setStats(newStats)
  }

  const getStatusColor = (status) => {
    // Status colors with semantic meaning for sales order workflow
    switch (status) {
      case 'draft':
        // Yellow - Action Required: Order needs confirmation
        return 'warning'
      case 'confirmed':
        // Blue - In Progress: Order confirmed, awaiting dispatch
        return 'info'
      case 'dispatched':
        // Blue - In Progress: Goods dispatched, awaiting invoice
        return 'info'
      case 'invoiced':
        // Green - Success: Order completed and invoiced
        return 'success'
      case 'cancelled':
        // Red - Rejected: Order was cancelled
        return 'danger'
      default:
        return 'secondary'
    }
  }

  const handleConfirmOrder = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/selling/sales-orders/${id}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        fetchOrders()
      } else {
        alert('Failed to confirm order')
      }
    } catch (error) {
      console.error('Error confirming order:', error)
      alert('Error confirming order')
    }
  }

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sales order?')) return
    try {
      const res = await fetch(`http://localhost:5000/api/selling/sales-orders/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchOrders()
      } else {
        alert('Failed to delete order')
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('Error deleting order')
    }
  }

  const columns = [
    { label: 'Order ID', key: 'sales_order_id', searchable: true },
    { label: 'Customer', key: 'customer_name', searchable: true },
    { label: 'Amount', key: 'total_value', render: (val) => `₹${parseFloat(val || 0).toFixed(2)}` },
    { label: 'Delivery Date', key: 'delivery_date' },
    { label: 'Status', key: 'status', render: (val) => <Badge color={getStatusColor(val)}>{val}</Badge> },
    {
      label: 'Actions',
      render: (val, row) => (
        <div className="action-buttons">
          <button 
            onClick={() => setViewOrderId(row.sales_order_id)}
            className="flex items-center justify-center p-2 text-primary-600 hover:bg-primary-100 rounded transition-colors duration-200"
            title="View"
          >
            <Eye size={16} />
          </button>
          {row.status === 'draft' && (
            <>
              <button 
                onClick={() => setEditOrderId(row.sales_order_id)}
                className="flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleConfirmOrder(row.sales_order_id)}
                className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                title="Confirm"
              >
                <CheckCircle size={16} />
              </button>
            </>
          )}
          {row.status === 'confirmed' && (
            <button 
              onClick={() => navigate(`/selling/delivery-notes/new?order=${row.sales_order_id}`)}
              className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
              title="Create Delivery Note"
            >
              <Truck size={16} />
            </button>
          )}
          <button 
            onClick={() => handleDeleteOrder(row.sales_order_id)}
            className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="selling-container">
      {/* Page Header */}
      <div className="page-header">
        <h2>Sales Orders</h2>
        <Button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2"
        >
          <Plus size={18} /> New Sales Order
        </Button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h3>Total Orders</h3>
            <p>{stats.total}</p>
          </div>
          <div className="stat-icon primary">📦</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Draft</h3>
            <p>{stats.draft}</p>
          </div>
          <div className="stat-icon warning">✏️</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Confirmed</h3>
            <p>{stats.confirmed}</p>
          </div>
          <div className="stat-icon info">📋</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Dispatched</h3>
            <p>{stats.dispatched}</p>
          </div>
          <div className="stat-icon info">🚚</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Total Value</h3>
            <p>₹{stats.total_value.toFixed(0)}</p>
          </div>
          <div className="stat-icon primary">💰</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="dispatched">Dispatched</option>
            <option value="invoiced">Invoiced</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Order ID or Customer..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && <Card className="error-banner">{error}</Card>}

      {/* Data Table */}
      <div className="table-container">
        {loading ? (
          <div className="table-empty">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="table-empty">
            <Package size={48} />
            <p>No sales orders found. Create one to get started.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={orders} />
        )}
      </div>

      {/* Create Sales Order Modal */}
      <CreateSalesOrderModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchOrders}
      />

      {/* View Sales Order Modal */}
      <ViewSalesOrderModal 
        isOpen={!!viewOrderId}
        orderId={viewOrderId}
        onClose={() => setViewOrderId(null)}
      />

      {/* Edit Sales Order Modal */}
      <EditSalesOrderModal 
        isOpen={!!editOrderId}
        orderId={editOrderId}
        onClose={() => setEditOrderId(null)}
        onSuccess={() => {
          fetchOrders()
          setEditOrderId(null)
        }}
      />
    </div>
  )
}