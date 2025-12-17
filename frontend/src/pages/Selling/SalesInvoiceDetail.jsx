import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import Alert from '../../components/Alert/Alert'
import { ArrowLeft, Edit2, Trash2, Send, Download } from 'lucide-react'

export default function SalesInvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchInvoiceDetails()
  }, [id])

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/sales-invoices/${id}`)
      const data = await res.json()
      if (data.success) {
        setInvoice(data.data)
      } else {
        setError(data.error || 'Failed to fetch invoice')
      }
    } catch (err) {
      setError('Error fetching invoice details')
      console.error('Error fetching invoice:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'warning'
      case 'issued':
        return 'info'
      case 'paid':
        return 'success'
      case 'cancelled':
        return 'danger'
      default:
        return 'secondary'
    }
  }

  const handleSubmitInvoice = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/sales-invoices/${id}/submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        fetchInvoiceDetails()
      }
    } catch (error) {
      console.error('Error submitting invoice:', error)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/sales-invoices/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        navigate('/selling/sales-invoices')
      }
    } catch (error) {
      console.error('Error deleting invoice:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading invoice details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <Alert variant="danger" className="mb-6">{error}</Alert>
        <Button variant="secondary" onClick={() => navigate('/selling/sales-invoices')}>
          <ArrowLeft size={18} /> Back to Invoices
        </Button>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div>
        <Alert variant="warning" className="mb-6">Invoice not found</Alert>
        <Button variant="secondary" onClick={() => navigate('/selling/sales-invoices')}>
          <ArrowLeft size={18} /> Back to Invoices
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
              onClick={() => navigate('/selling/sales-invoices')}
              className="text-primary-600 hover:text-primary-700 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">{invoice.invoice_id}</h1>
          </div>
          <p className="text-[var(--text-secondary)] ml-9">Sales Invoice</p>
        </div>
        <div className="flex gap-3">
          {invoice.status === 'draft' && (
            <>
              <Button 
                variant="primary" 
                onClick={handleSubmitInvoice}
                className="flex items-center gap-2"
              >
                <Send size={18} /> Submit
              </Button>
              <Button 
                variant="secondary"
                onClick={() => navigate(`/selling/sales-invoices/${id}/edit`)}
                className="flex items-center gap-2"
              >
                <Edit2 size={18} /> Edit
              </Button>
            </>
          )}
          <Button 
            variant="danger"
            onClick={handleDeleteInvoice}
            className="flex items-center gap-2"
          >
            <Trash2 size={18} /> Delete
          </Button>
        </div>
      </div>

      {/* Status and Key Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-2">Status</p>
            <Badge color={getStatusColor(invoice.status)} className="text-center flex justify-center">
              {invoice.status?.toUpperCase() || 'N/A'}
            </Badge>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-1">Amount</p>
            <p className="text-2xl font-bold text-green-600">₹{parseFloat(invoice.amount || 0).toFixed(2)}</p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-1">Invoice Date</p>
            <p className="text-lg font-semibold">
              {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-1">Tax Rate</p>
            <p className="text-2xl font-bold">{invoice.tax_rate || 0}%</p>
          </div>
        </Card>
      </div>

      {/* Basic Information */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold mb-6">Invoice Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Invoice ID</label>
            <p className="text-[var(--text-primary)] font-mono">{invoice.invoice_id}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Customer</label>
            <p className="text-[var(--text-primary)]">{invoice.customer_name || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Invoice Date</label>
            <p className="text-[var(--text-primary)]">
              {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Due Date</label>
            <p className="text-[var(--text-primary)]">
              {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Invoice Type</label>
            <p className="text-[var(--text-primary)] capitalize">{invoice.invoice_type?.replace(/_/g, ' ') || 'Standard'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Status</label>
            <Badge color={getStatusColor(invoice.status)}>
              {invoice.status?.toUpperCase() || 'N/A'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Amount Summary */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold mb-6">Amount Summary</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-[var(--text-secondary)]">Base Amount:</span>
            <span className="text-lg font-semibold">₹{parseFloat(invoice.amount || 0).toFixed(2)}</span>
          </div>

          {invoice.tax_rate > 0 && (
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-[var(--text-secondary)]">Tax ({invoice.tax_rate}%):</span>
              <span className="text-lg font-semibold text-green-600">
                ₹{(parseFloat(invoice.amount || 0) * (invoice.tax_rate / 100)).toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <span className="text-[var(--text-primary)] font-bold text-lg">Total Amount:</span>
            <span className="text-2xl font-bold text-primary-600">
              ₹{(parseFloat(invoice.amount || 0) * (1 + (invoice.tax_rate || 0) / 100)).toFixed(2)}
            </span>
          </div>
        </div>
      </Card>

      {/* Related Information */}
      {(invoice.delivery_note_id || invoice.sales_order_id) && (
        <Card className="mb-8">
          <h2 className="text-xl font-bold mb-6">Related Documents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {invoice.delivery_note_id && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Delivery Note ID</label>
                <p className="text-[var(--text-primary)] font-mono">{invoice.delivery_note_id}</p>
              </div>
            )}

            {invoice.sales_order_id && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Sales Order ID</label>
                <p className="text-[var(--text-primary)] font-mono">{invoice.sales_order_id}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Metadata */}
      {invoice.created_at && (
        <div className="text-sm text-[var(--text-secondary)] flex justify-between items-center">
          <span>Created on {new Date(invoice.created_at).toLocaleDateString()}</span>
          {invoice.updated_at && <span>Updated on {new Date(invoice.updated_at).toLocaleDateString()}</span>}
        </div>
      )}
    </div>
  )
}
