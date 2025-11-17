import React, { useState, useEffect } from 'react'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import Modal from '../Modal'

export default function CreatePurchaseOrderModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_name: '',
    order_date: '',
    expected_date: '',
    currency: 'INR',
    items: [{ item_code: '', item_name: '', qty: '', uom: '', rate: '', schedule_date: '' }],
    item_count: 0
  })

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      fetchItems()
      // Set today's date as default
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, order_date: today }))
    }
  }, [isOpen])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/suppliers`)
      const data = await res.json()
      if (data.success) {
        setSuppliers(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/items`)
      const data = await res.json()
      if (data.success) {
        setItems(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching items:', error)
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

  const handleSupplierChange = (e) => {
    const supplierId = e.target.value
    const supplier = suppliers.find(s => s.supplier_id === supplierId)
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: supplier?.name || ''
    }))
    setError(null)
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    
    // If changing item_code, auto-populate item_name and uom
    if (field === 'item_code') {
      const item = items.find(i => i.item_code === value)
      newItems[index] = {
        ...newItems[index],
        item_code: value,
        item_name: item?.name || '',
        uom: item?.uom || ''
      }
    } else {
      newItems[index][field] = value
    }

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
      items: [...prev.items, { item_code: '', item_name: '', qty: '', uom: '', rate: '', schedule_date: '' }],
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

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      const qty = parseFloat(item.qty) || 0
      const rate = parseFloat(item.rate) || 0
      return total + (qty * rate)
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.supplier_id || !formData.order_date || !formData.expected_date) {
        throw new Error('Please fill in all required fields')
      }

      if (formData.items.length === 0 || formData.items.some(item => !item.item_code || !item.qty || !item.rate)) {
        throw new Error('Please add at least one item with item code, quantity, and rate')
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: formData.supplier_id,
          order_date: formData.order_date,
          expected_date: formData.expected_date,
          currency: formData.currency,
          items: formData.items.map(item => ({
            item_code: item.item_code,
            qty: parseInt(item.qty),
            uom: item.uom,
            rate: parseFloat(item.rate),
            schedule_date: item.schedule_date || formData.expected_date
          })),
          item_count: formData.items.length,
          status: 'draft'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create purchase order')
      }

      // Reset form
      setFormData({
        supplier_id: '',
        supplier_name: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_date: '',
        currency: 'INR',
        items: [{ item_code: '', item_name: '', qty: '', uom: '', rate: '', schedule_date: '' }],
        item_count: 0
      })
      
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create purchase order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📋 Create New Purchase Order" size="xl">
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

        {/* Header Section - Supplier & Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
              Supplier *
            </label>
            <select
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleSupplierChange}
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
              <option value="">Select Supplier</option>
              {suppliers.map(supplier => (
                <option key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
              Order Date *
            </label>
            <input
              type="date"
              name="order_date"
              value={formData.order_date}
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

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
              Expected Delivery *
            </label>
            <input
              type="date"
              name="expected_date"
              value={formData.expected_date}
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

        {/* Items Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <label style={{ fontWeight: 600, color: '#333', fontSize: '0.95rem' }}>
              📦 Items *
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

          <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
            {formData.items.map((item, index) => (
              <div key={index} style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr auto',
                gap: '12px',
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                {/* Item Code */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
                    Item Code *
                  </label>
                  <select
                    value={item.item_code}
                    onChange={(e) => handleItemChange(index, 'item_code', e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      backgroundColor: '#fff'
                    }}
                  >
                    <option value="">Select Item</option>
                    {items.map(it => (
                      <option key={it.item_code} value={it.item_code}>
                        {it.item_code} - {it.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
                    Qty *
                  </label>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                    required
                    min="0"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* UOM */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
                    UOM
                  </label>
                  <input
                    type="text"
                    placeholder="UOM"
                    value={item.uom}
                    onChange={(e) => handleItemChange(index, 'uom', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      backgroundColor: '#f3f4f6'
                    }}
                    disabled
                  />
                </div>

                {/* Rate */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
                    Rate *
                  </label>
                  <input
                    type="number"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                    required
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Schedule Date */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    value={item.schedule_date}
                    onChange={(e) => handleItemChange(index, 'schedule_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={formData.items.length === 1}
                  style={{
                    padding: '8px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    cursor: formData.items.length === 1 ? 'not-allowed' : 'pointer',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: formData.items.length === 1 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (formData.items.length > 1) {
                      e.target.style.backgroundColor = '#fecaca'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#fee2e2'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Card */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Total Items</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0284c7' }}>
                {formData.items.length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Estimated Amount</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0284c7' }}>
                ₹{calculateTotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 500,
              color: '#374151',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 24px',
              backgroundColor: loading ? '#d1d5db' : '#0284c7',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#fff',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.backgroundColor = '#0369a1'
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.backgroundColor = '#0284c7'
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></span>
                Creating...
              </>
            ) : (
              '✓ Create Purchase Order'
            )}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  )
}