import React, { useState, useEffect } from 'react'
import { AlertCircle, Package, Plus, Trash2 } from 'lucide-react'
import Modal from '../Modal'

export default function CreateGRNModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [poDetails, setPoDetails] = useState(null)
  const [formData, setFormData] = useState({
    po_no: '',
    supplier_id: '',
    supplier_name: '',
    receipt_date: '',
    items: [{ item_code: '', item_name: '', ordered_qty: '', received_qty: '', remarks: '' }],
    item_count: 0
  })

  useEffect(() => {
    if (isOpen) {
      fetchPurchaseOrders()
      // Set today's date as default
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, receipt_date: today }))
    }
  }, [isOpen])

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/purchase-orders')
      const data = await res.json()
      if (data.success) {
        // Show all POs (draft and submitted)
        setPurchaseOrders(data.data?.filter(po => ['draft', 'submitted', 'to_receive', 'partially_received'].includes(po.status)) || [])
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    }
  }

  const fetchPODetails = async (poNo) => {
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${poNo}`)
      const data = await res.json()
      if (data.success) {
        setPoDetails(data.data)
        // Auto-populate items from PO
        if (data.data?.items && Array.isArray(data.data.items)) {
          const poItems = data.data.items.map(item => ({
            item_code: item.item_code,
            item_name: item.item_name || '',
            ordered_qty: item.qty,
            received_qty: '',
            remarks: ''
          }))
          setFormData(prev => ({
            ...prev,
            supplier_id: data.data.supplier_id,
            items: poItems,
            item_count: poItems.length
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching PO details:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError(null)
  }

  const handlePOChange = (e) => {
    const poNo = e.target.value
    const po = purchaseOrders.find(p => p.po_no === poNo)
    setFormData(prev => ({
      ...prev,
      po_no: poNo,
      supplier_name: po?.supplier_name || ''
    }))
    
    if (poNo) {
      fetchPODetails(poNo)
    } else {
      setPoDetails(null)
      setFormData(prev => ({
        ...prev,
        supplier_id: '',
        items: [{ item_code: '', item_name: '', ordered_qty: '', received_qty: '', remarks: '' }],
        item_count: 0
      }))
    }
    setError(null)
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = value
    setFormData(prev => ({
      ...prev,
      items: newItems,
      item_count: newItems.length
    }))
    setError(null)
  }

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', ordered_qty: '', received_qty: '', remarks: '' }],
      item_count: prev.items.length + 1
    }))
  }

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      items: newItems,
      item_count: newItems.length
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.po_no || !formData.receipt_date) {
        throw new Error('Please fill in all required fields')
      }

      if (formData.items.length === 0 || formData.items.some(item => !item.item_code || !item.received_qty)) {
        throw new Error('Please add at least one item with quantity received')
      }

      // Validate that all received_qty are valid numbers
      const invalidItems = formData.items.filter(item => {
        const qty = parseFloat(item.received_qty)
        return isNaN(qty) || qty < 0
      })
      if (invalidItems.length > 0) {
        throw new Error('All items must have valid received quantities (greater than 0)')
      }

      const res = await fetch('http://localhost:5000/api/purchase-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_no: formData.po_no,
          supplier_id: formData.supplier_id,
          receipt_date: formData.receipt_date,
          items: formData.items.map(item => ({
            item_code: item.item_code || null,
            received_qty: Math.max(0, parseFloat(item.received_qty) || 0),
            accepted_qty: 0
          })),
          item_count: formData.items.length,
          status: 'draft'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create GRN')
      }

      // Reset form
      setFormData({
        po_no: '',
        supplier_id: '',
        supplier_name: '',
        receipt_date: new Date().toISOString().split('T')[0],
        items: [{ item_code: '', item_name: '', ordered_qty: '', received_qty: '', remarks: '' }],
        item_count: 0
      })
      setPoDetails(null)
      
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create GRN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 Create Goods Receipt Note (GRN)" size="xl">
      <form onSubmit={handleSubmit}>
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

        {/* PO Selection and Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
              Purchase Order *
            </label>
            <select
              name="po_no"
              value={formData.po_no}
              onChange={handlePOChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                backgroundColor: '#fff'
              }}
            >
              <option value="">Select Purchase Order</option>
              {purchaseOrders.map(po => (
                <option key={po.po_no} value={po.po_no}>
                  {po.po_no} - {po.supplier_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
              Receipt Date *
            </label>
            <input
              type="date"
              name="receipt_date"
              value={formData.receipt_date}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Supplier Info */}
        {formData.supplier_name && (
          <div style={{
            backgroundColor: '#e0f2fe',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.95rem'
          }}>
            <div style={{ color: '#0284c7', fontSize: '1.2rem' }}>🏢</div>
            <div>
              <strong style={{ color: '#0284c7' }}>Supplier:</strong>
              <div style={{ color: '#0c4a6e' }}>{formData.supplier_name}</div>
            </div>
          </div>
        )}

        {/* Items Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <label style={{ fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>
              📦 Received Items *
            </label>
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #0ea5e9',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: '#0284c7',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#bae6fd'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#e0f2fe'}
            >
              <Plus size={16} /> Add Item
            </button>
          </div>

          {!formData.po_no && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
              padding: '12px 16px',
              color: '#92400e',
              fontSize: '0.9rem'
            }}>
              📌 Select a Purchase Order above to auto-populate items
            </div>
          )}

          {formData.po_no && (
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
              {formData.items.map((item, index) => (
                <div key={index} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                  gap: '12px',
                  marginBottom: index < formData.items.length - 1 ? '12px' : '0',
                  paddingBottom: index < formData.items.length - 1 ? '12px' : '0',
                  borderBottom: index < formData.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                  alignItems: 'start'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', color: '#666' }}>
                      Item Code & Name
                    </label>
                    <div style={{
                      padding: '8px 10px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      color: '#374151'
                    }}>
                      <strong>{item.item_code}</strong>
                      {item.item_name && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.item_name}</div>}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', color: '#666' }}>
                      Qty Ordered
                    </label>
                    <div style={{
                      padding: '8px 10px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      color: '#374151',
                      textAlign: 'center',
                      fontWeight: 500
                    }}>
                      {item.ordered_qty}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', color: '#666' }}>
                      Qty Received *
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={item.received_qty}
                      onChange={(e) => handleItemChange(index, 'received_qty', e.target.value)}
                      step="0.01"
                      min="0"
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px', color: '#666' }}>
                      Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="Issues..."
                      value={item.remarks}
                      onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={formData.items.length === 1}
                  style={{
                    marginTop: '24px',
                    padding: '8px 10px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    cursor: formData.items.length === 1 ? 'not-allowed' : 'pointer',
                    opacity: formData.items.length === 1 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                  title={formData.items.length === 1 ? 'At least one item required' : 'Remove item'}
                >
                  <Trash2 size={16} color="#dc2626" />
                </button>
              </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          padding: '12px 16px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#0284c7' }}>
            <strong>Total Items:</strong> {formData.items.length} | 
            <strong style={{ marginLeft: '12px' }}>Total Quantity:</strong> {
              formData.items.reduce((sum, item) => sum + (parseInt(item.received_qty) || 0), 0)
            } units
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
          <button
            type="button"
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: 600,
              opacity: loading ? 0.65 : 1,
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Creating GRN...' : '✓ Create GRN'}
          </button>
        </div>
      </form>
    </Modal>
  )
}