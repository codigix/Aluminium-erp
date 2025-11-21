import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import { Link, useNavigate } from 'react-router-dom'
import { 
  FileText, Edit2, Send, Download, Eye, Package, AlertCircle, CheckCircle, XCircle, 
  Clock, Plus, TrendingUp, AlertTriangle, Mail, Trash2
} from 'lucide-react'

import './Selling.css'

export default function Quotation() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    converted: 0,
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
    fetchQuotations()
  }, [filters])

  const fetchQuotations = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      )
      const res = await fetch(`http://localhost:5000/api/selling/quotations?${query}`)
      const data = await res.json()
      if (data.success) {
        setQuotations(data.data || [])
        calculateStats(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch quotations')
      }
    } catch (error) {
      console.error('Error fetching quotations:', error)
      setError('Error fetching quotations')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    const newStats = {
      total: data.length,
      draft: 0,
      sent: 0,
      accepted: 0,
      converted: 0,
      cancelled: 0,
      total_value: 0
    }

    data.forEach((quotation) => {
      if (quotation.status) {
        newStats[quotation.status] = (newStats[quotation.status] || 0) + 1
      }
      newStats.total_value += parseFloat(quotation.amount || 0)
    })

    setStats(newStats)
  }

  const getStatusColor = (status) => {
    // Status colors with semantic meaning for workflow stages
    switch (status) {
      case 'draft':
        // Yellow - Action Required: Quote needs to be finalized and sent
        return 'warning'
      case 'sent':
        // Blue - In Progress: Awaiting customer response
        return 'info'
      case 'accepted':
        // Green - Success: Customer accepted, ready for conversion
        return 'success'
      case 'converted':
        // Gray - Processing: Converted to Sales Order, no action needed
        return 'secondary'
      case 'cancelled':
        // Red - Rejected: Quote was rejected or cancelled
        return 'danger'
      default:
        return 'secondary'
    }
  }

  const handleSendQuotation = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/selling/quotations/${id}/send`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        fetchQuotations()
      }
    } catch (error) {
      console.error('Error sending quotation:', error)
    }
  }

  const handleDeleteQuotation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return
    try {
      const res = await fetch(`http://localhost:5000/api/selling/quotations/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchQuotations()
      }
    } catch (error) {
      console.error('Error deleting quotation:', error)
    }
  }

  const columns = [
    { label: 'Quote ID', key: 'quotation_id', searchable: true },
    { label: 'Customer', key: 'customer_name', searchable: true },
    { label: 'Amount', key: 'amount', render: (val) => `₹${parseFloat(val || 0).toFixed(2)}` },
    { label: 'Valid Till', key: 'validity_date' },
    { label: 'Status', key: 'status', render: (val) => <Badge color={getStatusColor(val)}>{val}</Badge> },
    {
      label: 'Actions',
      render: (val, row) => (
        <div className="action-buttons">
          <button 
            onClick={() => navigate(`/selling/quotations/${row.quotation_id}`)}
            className="flex items-center justify-center p-2 text-primary-600 hover:bg-primary-100 rounded transition-colors duration-200"
            title="View"
          >
            <Eye size={16} />
          </button>
          {row.status === 'draft' && (
            <>
              <button 
                onClick={() => navigate(`/selling/quotations/${row.quotation_id}/edit`)}
                className="flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleSendQuotation(row.quotation_id)}
                className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                title="Send"
              >
                <Mail size={16} />
              </button>
            </>
          )}
          {row.status === 'accepted' && (
            <button 
              onClick={() => navigate(`/selling/sales-orders/new?quote=${row.quotation_id}`)}
              className="flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
              title="Convert to Sales Order"
            >
              <FileText size={16} />
            </button>
          )}
          <button 
            onClick={() => handleDeleteQuotation(row.quotation_id)}
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
        <h2>Sales Quotations</h2>
        <Button 
          onClick={() => navigate('/selling/quotations/new')}
          className="flex items-center gap-2"
        >
          <Plus size={18} /> New Quotation
        </Button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h3>Total Quotations</h3>
            <p>{stats.total}</p>
          </div>
          <div className="stat-icon primary">📋</div>
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
            <h3>Sent</h3>
            <p>{stats.sent}</p>
          </div>
          <div className="stat-icon info">📤</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>Accepted</h3>
            <p>{stats.accepted}</p>
          </div>
          <div className="stat-icon success">✅</div>
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
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="converted">Converted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Quote ID or Customer..."
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
        ) : quotations.length === 0 ? (
          <div className="table-empty">
            <FileText size={48} />
            <p>No quotations found. Create one to get started.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={quotations} />
        )}
      </div>


    </div>
  )
}