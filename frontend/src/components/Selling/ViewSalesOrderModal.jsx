import React, { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'
import Modal from '../Modal'

export default function ViewSalesOrderModal({ isOpen, orderId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrder()
    }
  }, [isOpen, orderId])

  const fetchOrder = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/sales-orders/${orderId}`)
      const data = await res.json()
      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || 'Failed to fetch order')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      setError('Error fetching order details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return '#fbbf24'
      case 'confirmed':
        return '#3b82f6'
      case 'dispatched':
        return '#3b82f6'
      case 'invoiced':
        return '#10b981'
      case 'cancelled':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  if (!order && loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="📦 View Sales Order" size="lg">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p>Loading order details...</p>
        </div>
      </Modal>
    )
  }

  if (!order) {
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 View Sales Order" size="lg">
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Order ID
            </label>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
              {order.sales_order_id}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Status
            </label>
            <div style={{
              display: 'inline-block',
              background: getStatusColor(order.status),
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}>
              {order.status}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Customer
            </label>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
              {order.customer_name || 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Order Amount
            </label>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
              ₹{parseFloat(order.order_amount || order.total_value || 0).toFixed(2)}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Delivery Date
            </label>
            <p style={{ fontSize: '1rem', color: '#1f2937' }}>
              {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Quotation ID
            </label>
            <p style={{ fontSize: '1rem', color: '#1f2937' }}>
              {order.quotation_id || 'N/A'}
            </p>
          </div>
        </div>

        {order.order_terms && (
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
              Terms & Conditions
            </label>
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '0.95rem',
              color: '#374151',
              lineHeight: '1.5'
            }}>
              {order.order_terms}
            </div>
          </div>
        )}

        {order.created_at && (
          <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#9ca3af' }}>
            Created on {new Date(order.created_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 24px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  )
}