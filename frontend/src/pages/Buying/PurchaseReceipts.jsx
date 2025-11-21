import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Package, Inbox, CheckCircle, XCircle } from 'lucide-react'
import CreateGRNModal from '../../components/Buying/CreateGRNModal'
import './Buying.css'

export default function PurchaseReceipts() {
  const navigate = useNavigate()
  const [grns, setGrns] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    po_no: '',
    search: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState({
    total: 0,
    pending: 0,
    inspecting: 0,
    approved: 0,
    rejected: 0,
    totalValue: 0
  })

  useEffect(() => {
    fetchGRNs()
  }, [filters])

  const fetchGRNs = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      )
      const res = await fetch(`${import.meta.env.VITE_API_URL}/purchase-receipts?${query}`)
      const data = await res.json()
      if (data.success) {
        const grnData = data.data || []
        setGrns(grnData)
        calculateMetrics(grnData)
      } else {
        setError(data.error || 'Failed to fetch receipts')
      }
    } catch (error) {
      console.error('Error fetching GRNs:', error)
      setError('Error fetching purchase receipts')
    } finally {
      setLoading(false)
    }
  }

  const calculateMetrics = (data) => {
    const newMetrics = {
      total: data.length,
      pending: 0,
      inspecting: 0,
      approved: 0,
      rejected: 0,
      totalValue: 0
    }

    data.forEach((grn) => {
      if (grn.status === 'pending') newMetrics.pending++
      else if (grn.status === 'inspecting') newMetrics.inspecting++
      else if (grn.status === 'approved') newMetrics.approved++
      else if (grn.status === 'rejected') newMetrics.rejected++
      newMetrics.totalValue += parseFloat(grn.total_value || 0)
    })

    setMetrics(newMetrics)
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',                  // Yellow - Action Required
      inspecting: 'info',                  // Blue - Under Inspection
      awaiting_inventory_approval: 'info', // Blue - Awaiting Inventory
      approved: 'success',                 // Green - Approved
      rejected: 'danger',                  // Red - Rejected
      sent_back: 'warning',                // Yellow - Sent Back
      draft: 'warning',
      submitted: 'info',
      inspected: 'info',
      accepted: 'success'
    }
    return colors[status] || 'secondary'
  }

  const filterConfig = [
    { key: 'search', label: 'Search', type: 'text', placeholder: 'GRN #, PO, Supplier...' },
    { 
      key: 'status', 
      label: 'Status', 
      type: 'select',
      options: [
        { value: '', label: 'All Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'inspecting', label: 'Inspecting' },
        { value: 'awaiting_inventory_approval', label: 'Awaiting Inventory' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'sent_back', label: 'Sent Back' }
      ]
    },
    { 
      key: 'po_no', 
      label: 'PO Number', 
      type: 'text',
      placeholder: 'Search PO...'
    }
  ]

  const columns = [
    { key: 'grn_no', label: 'GRN Number', width: '13%' },
    { key: 'po_no', label: 'PO Number', width: '11%' },
    { key: 'supplier_name', label: 'Supplier', width: '16%' },
    { 
      key: 'receipt_date', 
      label: 'Receipt Date', 
      width: '12%',
      render: (val) => val ? new Date(val).toLocaleDateString() : '—'
    },
    { 
      key: 'total_items', 
      label: 'Items', 
      width: '8%',
      render: (val) => (
        <span style={{ fontWeight: 600, color: '#0284c7' }}>
          {val || '0'}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Status', 
      width: '14%',
      render: (val) => (
        <Badge color={getStatusColor(val)} variant="solid">
          {val?.replace('_', ' ').toUpperCase()}
        </Badge>
      )
    },
    { 
      key: 'created_at', 
      label: 'Created', 
      width: '13%',
      render: (val) => val ? new Date(val).toLocaleDateString() : '—'
    },
    { 
      key: 'created_by', 
      label: 'Created By', 
      width: '13%',
      render: (val) => val || 'System'
    }
  ]

  const renderActions = (row) => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Button
        size="sm"
        variant="icon"
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/buying/grn-requests/${row.grn_no}`)
        }}
        title="View GRN"
        className="flex items-center justify-center p-2"
      >
        <Eye size={16} />
      </Button>
    </div>
  )

  const MetricCard = ({ label, value, borderColor, icon }) => (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg p-6 border-l-4 transition-all hover:shadow-lg`} style={{ borderLeftColor: borderColor }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
            {typeof value === 'number' && value > 999999 ? `₹${(value / 100000).toFixed(1)}L` : value}
          </p>
        </div>
        <div className="text-4xl opacity-20">
          {icon}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Goods Receipt Notes</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2 text-base">Track and manage purchase receipts • {grns.length} {grns.length === 1 ? 'item' : 'items'} total</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          variant="primary" 
          className="flex items-center gap-2 px-6 py-3"
        >
          <Plus size={20} /> Create GRN
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="mb-6 p-5 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
          <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
        </Card>
      )}

      {/* Metrics Cards */}
      {!loading && grns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard label="Total GRNs" value={metrics.total} borderColor="#3b82f6" icon="📦" />
          <MetricCard label="Pending" value={metrics.pending} borderColor="#f59e0b" icon="⏳" />
          <MetricCard label="Inspecting" value={metrics.inspecting} borderColor="#06b6d4" icon="🔍" />
          <MetricCard label="Approved" value={metrics.approved} borderColor="#10b981" icon="✅" />
          <MetricCard label="Rejected" value={metrics.rejected} borderColor="#ef4444" icon="❌" />
          <MetricCard label="Total Value" value={metrics.totalValue} borderColor="#8b5cf6" icon="💰" />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <AdvancedFilters
          filters={filters}
          onFilterChange={setFilters}
          filterConfig={filterConfig}
          showPresets={true}
        />
      </div>

      {/* Data Table */}
      <Card>
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-neutral-600 dark:text-neutral-400 mt-3">Loading receipts...</p>
            </div>
          </div>
        ) : grns.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={48} className="mx-auto text-neutral-400 mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-base">No purchase receipts found</p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              variant="primary" 
              size="sm"
            >
              Create First GRN
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={grns}
            renderActions={renderActions}
            filterable={true}
            sortable={true}
            pageSize={10}
            onRowClick={(row) => navigate(`/buying/grn-requests/${row.grn_no}`)}
          />
        )}
      </Card>

      {/* Create GRN Modal */}
      <CreateGRNModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchGRNs}
      />
    </div>
  )
}