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
      const res = await fetch(`http://localhost:5000/api/purchase-receipts?${query}`)
      const data = await res.json()
      if (data.success) {
        setGrns(data.data || [])
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

  const getStatusColor = (status) => {
    const colors = {
      draft: 'warning',           // Yellow - Action Required
      submitted: 'info',          // Blue - Submitted for Review
      inspected: 'info',          // Blue - Under Inspection
      accepted: 'success',        // Green - Goods Accepted
      rejected: 'danger'          // Red - Goods Rejected
    }
    return colors[status] || 'secondary'
  }

  const filterConfig = [
    { key: 'search', label: 'Search GRN', type: 'text', placeholder: 'GRN #, Supplier...' },
    { 
      key: 'status', 
      label: 'Status', 
      type: 'select',
      options: [
        { value: '', label: 'All Status' },
        { value: 'draft', label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'inspected', label: 'Inspected' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'rejected', label: 'Rejected' }
      ]
    },
    { 
      key: 'po_no', 
      label: 'PO Number', 
      type: 'text',
      placeholder: 'PO #...'
    }
  ]

  const columns = [
    { key: 'grn_no', label: 'GRN Number', width: '12%' },
    { key: 'po_no', label: 'PO Number', width: '12%' },
    { key: 'supplier_name', label: 'Supplier', width: '15%' },
    { 
      key: 'receipt_date', 
      label: 'Receipt Date', 
      width: '12%',
      render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A'
    },
    { 
      key: 'item_count', 
      label: 'Items', 
      width: '8%',
      render: (val) => val || '0'
    },
    { 
      key: 'status', 
      label: 'Status', 
      width: '12%',
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
      render: (val) => val ? new Date(val).toLocaleString() : 'N/A'
    },
    { 
      key: 'created_by', 
      label: 'Created By', 
      width: '12%',
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
          navigate(`/buying/purchase-receipt/${row.grn_no}`)
        }}
        title="View Receipt"
        className="flex items-center justify-center p-2"
      >
        <Eye size={16} />
      </Button>
    </div>
  )

  return (
    <div>
      <div className="flex-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Goods Receipt Notes (GRN)</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">Track and manage all purchase receipts</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          variant="primary" 
          className="flex items-center gap-2"
        >
          <Plus size={20} /> Create GRN
        </Button>
      </div>

      {error && (
        <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </Card>
      )}

      <AdvancedFilters
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        showPresets={true}
      />

      <Card>
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-neutral-600 dark:text-neutral-400 mt-2">Loading receipts...</p>
            </div>
          </div>
        ) : grns.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">No purchase receipts found</p>
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
            onRowClick={(row) => navigate(`/buying/purchase-receipt/${row.grn_no}`)}
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