import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, BarChart3, AlertCircle, TrendingUp, FileText, Eye } from 'lucide-react'
import * as productionService from '../../services/productionService'
import DataTable from '../../components/Table/DataTable'
import './Production.css'

export default function SalesOrder() {
  const navigate = useNavigate()
  const location = useLocation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(location.state?.success || null)
  const [stats, setStats] = useState({
    totalOrders: 0,
    confirmedOrders: 0,
    draftOrders: 0,
    totalValue: 0
  })
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })

  useEffect(() => {
    fetchOrders()
  }, [filters])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await productionService.getSalesOrders(filters)
      const orderData = response.data || []
      setOrders(orderData)
      
      const allResponse = await productionService.getSalesOrders({})
      const allOrders = allResponse.data || []
      const confirmedOrders = allOrders.filter(o => o.status === 'confirmed').length
      const draftOrders = allOrders.filter(o => o.status === 'draft').length
      const totalValue = allOrders.reduce((sum, o) => sum + (parseFloat(o.order_amount || o.total_value) || 0), 0)
      
      setStats({
        totalOrders: allOrders.length,
        confirmedOrders,
        draftOrders,
        totalValue
      })
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to fetch sales orders')
      setOrders([])
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

  const handleDelete = async (sales_order_id) => {
    if (window.confirm('Delete this sales order?')) {
      try {
        await productionService.deleteSalesOrder(sales_order_id)
        setSuccess('Sales Order deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchOrders()
      } catch (err) {
        setError(err.message || 'Failed to delete sales order')
      }
    }
  }

  const handleEdit = (order) => {
    navigate(`/production/sales-orders/${order.sales_order_id}`)
  }

  const handleView = (order) => {
    navigate(`/production/sales-orders/${order.sales_order_id}`)
  }

  const getStatusColor = (status) => {
    const colors = {
      confirmed: 'status-completed',
      draft: 'status-draft',
      partial: 'status-pending',
      delivered: 'status-completed',
      cancelled: 'status-cancelled'
    }
    return colors[status?.toLowerCase()] || 'status-draft'
  }

  const columns = [
    {
      key: 'sales_order_id',
      label: 'ID',
      width: '100px'
    },
    {
      key: 'customer_name',
      label: 'Customer',
      width: '180px'
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (value, row) => (
        <span className={`work-order-status ${getStatusColor(row.status)}`} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', display: 'inline-block', textTransform: 'capitalize' }}>
          {row.status || 'Draft'}
        </span>
      )
    },
    {
      key: 'order_date',
      label: 'Order Date',
      width: '120px',
      render: (value, row) => (
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          {row.order_date ? new Date(row.order_date).toLocaleDateString('en-IN') : 'N/A'}
        </div>
      )
    },
    {
      key: 'order_amount',
      label: 'Order Value',
      width: '120px',
      render: (value, row) => (
        <div style={{ textAlign: 'right' }}>₹{parseFloat(row.order_amount || row.total_value || 0).toFixed(2)}</div>
      )
    },
    {
      key: 'quantity',
      label: 'Qty',
      width: '80px',
      render: (value, row) => (
        <div style={{ textAlign: 'center' }}>{row.quantity || row.qty || 0}</div>
      )
    },
    {
      key: 'updated_at',
      label: 'Last Updated On',
      width: '140px',
      render: (value, row) => (
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          {row.updated_at ? new Date(row.updated_at).toLocaleDateString('en-IN') : 'N/A'}
        </div>
      )
    }
  ]

  const renderActions = (row) => (
    <div className="action-buttons">
      <button 
        className="btn-icon btn-view" 
        onClick={() => handleView(row)}
        title="View"
      >
        <Eye size={16} />
      </button>
      <button 
        className="btn-icon btn-edit" 
        onClick={() => handleEdit(row)}
        title="Edit"
      >
        <Edit2 size={16} />
      </button>
      <button 
        className="btn-icon btn-delete" 
        onClick={() => handleDelete(row.sales_order_id)}
        title="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1>Sales Orders</h1>
          <p>Manage customer sales orders and fulfillment</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/production/sales-orders/form')}>
          <Plus size={20} /> New Sales Order
        </button>
      </div>

      {success && (
        <div className="alert alert-success" role="alert">
          <AlertCircle size={18} />
          {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="content-container">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.confirmedOrders}</div>
            <div className="stat-label">Confirmed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.draftOrders}</div>
            <div className="stat-label">Draft</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">₹{(stats.totalValue / 100000).toFixed(1)}L</div>
            <div className="stat-label">Total Value</div>
          </div>
        </div>

        <div className="filters-container" style={{ marginTop: '20px' }}>
          <div className="search-group">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by customer name or order ID"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>
          <select 
            name="status" 
            value={filters.status} 
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="partial">Partial</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            Loading sales orders...
          </div>
        ) : orders.length > 0 ? (
          <DataTable 
            columns={columns} 
            data={orders}
            renderActions={renderActions}
            rowKey="sales_order_id"
          />
        ) : (
          <div className="no-data-container">
            <FileText size={40} />
            <p>No sales orders found</p>
            <button className="btn btn-secondary" onClick={() => navigate('/production/sales-orders/form')}>
              Create First Sales Order
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
