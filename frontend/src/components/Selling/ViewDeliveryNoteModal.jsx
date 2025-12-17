import React, { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'
import Modal from '../Modal'

export default function ViewDeliveryNoteModal({ isOpen, noteId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)

  useEffect(() => {
    if (isOpen && noteId) {
      fetchDeliveryNote()
    }
  }, [isOpen, noteId])

  const fetchDeliveryNote = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/selling/delivery-notes/${noteId}`)
      const data = await res.json()
      if (data.success) {
        setNote(data.data)
      } else {
        setError(data.error || 'Failed to fetch delivery note')
      }
    } catch (error) {
      console.error('Error fetching delivery note:', error)
      setError('Error fetching delivery note details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return '#fbbf24'
      case 'submitted':
        return '#3b82f6'
      case 'delivered':
        return '#10b981'
      case 'partially_delivered':
        return '#f59e0b'
      case 'cancelled':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  if (!note && loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="📦 View Delivery Note" size="lg">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p>Loading delivery note details...</p>
        </div>
      </Modal>
    )
  }

  if (!note) {
    return null
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 View Delivery Note" size="lg">
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
              Delivery ID
            </label>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
              {note.delivery_note_id}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Status
            </label>
            <div style={{
              display: 'inline-block',
              background: getStatusColor(note.status),
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}>
              {note.status?.replace('_', ' ')}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Sales Order ID
            </label>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
              {note.sales_order_id || 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Customer
            </label>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
              {note.customer_name || 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Delivery Date
            </label>
            <p style={{ fontSize: '1rem', color: '#1f2937' }}>
              {note.delivery_date ? new Date(note.delivery_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Quantity
            </label>
            <p style={{ fontSize: '1rem', color: '#1f2937' }}>
              {note.quantity || 0} units
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Driver Name
            </label>
            <p style={{ fontSize: '1rem', color: '#1f2937' }}>
              {note.driver_name || 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>
              Vehicle Info
            </label>
            <p style={{ fontSize: '1rem', color: '#1f2937' }}>
              {note.vehicle_info || 'N/A'}
            </p>
          </div>
        </div>

        {note.remarks && (
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>
              Remarks
            </label>
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '0.95rem',
              color: '#374151',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap'
            }}>
              {note.remarks}
            </div>
          </div>
        )}

        {note.created_at && (
          <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#9ca3af' }}>
            Created on {new Date(note.created_at).toLocaleDateString()}
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
