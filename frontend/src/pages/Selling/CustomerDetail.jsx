import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import Alert from '../../components/Alert/Alert'
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import EditCustomerModal from '../../components/Selling/EditCustomerModal'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    fetchCustomerDetails()
  }, [id])

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/customers/${id}`)
      const data = await res.json()
      if (data.success) {
        setCustomer(data.data)
      } else {
        setError(data.error || 'Failed to fetch customer')
      }
    } catch (err) {
      setError('Error fetching customer details')
      console.error('Error fetching customer:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'inactive':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const handleDeleteCustomer = async () => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/customers/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        navigate('/selling/customers')
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      setError('Failed to delete customer')
    }
  }

  const handleEditSuccess = () => {
    fetchCustomerDetails()
    setShowEditModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading customer details...</p>
        </div>
      </div>
    )
  }

  if (error && !customer) {
    return (
      <div>
        <Alert variant="danger" className="mb-6">{error}</Alert>
        <Button variant="secondary" onClick={() => navigate('/selling/customers')}>
          <ArrowLeft size={18} /> Back to Customers
        </Button>
      </div>
    )
  }

  if (!customer) {
    return (
      <div>
        <Alert variant="warning" className="mb-6">Customer not found</Alert>
        <Button variant="secondary" onClick={() => navigate('/selling/customers')}>
          <ArrowLeft size={18} /> Back to Customers
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/selling/customers')}
              className="text-primary-600 hover:text-primary-700 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">{customer.name}</h1>
          </div>
          <p className="text-[var(--text-secondary)] ml-9">Customer ID: {customer.customer_id}</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="primary"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2"
          >
            <Edit2 size={18} /> Edit
          </Button>
          <Button 
            variant="danger"
            onClick={handleDeleteCustomer}
            className="flex items-center gap-2"
          >
            <Trash2 size={18} /> Delete
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-2">Status</p>
            <Badge color={getStatusColor(customer.status)}>
              {customer.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-1">Credit Limit</p>
            <p className="text-2xl font-bold">₹{parseFloat(customer.credit_limit || 0).toFixed(0)}</p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-1">Contact</p>
            <p className="text-lg font-semibold">{customer.phone || 'N/A'}</p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-1">GSTIN</p>
            <p className="text-lg font-mono font-semibold">{customer.gstin || 'N/A'}</p>
          </div>
        </Card>
      </div>

      {/* Basic Information */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold mb-6">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Customer Name</label>
            <p className="text-[var(--text-primary)]">{customer.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">GSTIN</label>
            <p className="font-mono text-[var(--text-primary)]">{customer.gstin || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
            <p className="text-[var(--text-primary)]">{customer.email || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Phone</label>
            <p className="text-[var(--text-primary)]">{customer.phone || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Credit Limit</label>
            <p className="text-[var(--text-primary)] font-semibold">₹{parseFloat(customer.credit_limit || 0).toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Status</label>
            <Badge color={getStatusColor(customer.status)}>
              {customer.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Address Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {customer.billing_address && (
          <Card>
            <h2 className="text-xl font-bold mb-4">Billing Address</h2>
            <p className="text-[var(--text-primary)] whitespace-pre-line">{customer.billing_address}</p>
          </Card>
        )}

        {customer.shipping_address && (
          <Card>
            <h2 className="text-xl font-bold mb-4">Shipping Address</h2>
            <p className="text-[var(--text-primary)] whitespace-pre-line">{customer.shipping_address}</p>
          </Card>
        )}
      </div>

      {/* Metadata */}
      {customer.created_at && (
        <div className="text-sm text-[var(--text-secondary)] flex justify-between items-center">
          <span>Created on {new Date(customer.created_at).toLocaleDateString()}</span>
          {customer.updated_at && <span>Updated on {new Date(customer.updated_at).toLocaleDateString()}</span>}
        </div>
      )}

      {/* Edit Customer Modal */}
      <EditCustomerModal
        isOpen={showEditModal}
        customerId={id}
        initialData={customer}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}
