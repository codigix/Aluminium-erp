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
    item_count: 0,
    tax_category: '',
    tax_rate: 0,
    shipping_rule: '',
    incoterm: '',
    advance_paid: 0,
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: '',
    payment_terms_description: '',
    due_date: '',
    invoice_portion: 100,
    payment_amount: 0
  })

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
      fetchItems()
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, order_date: today }))
    }
  }, [isOpen])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/suppliers')
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
      const res = await fetch('http://localhost:5000/api/items')
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
      [name]: name === 'tax_rate' || name === 'advance_paid' ? parseFloat(value) || 0 : value
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

  const calculateSubtotal = () => {
    return formData.items.reduce((total, item) => {
      const qty = parseFloat(item.qty) || 0
      const rate = parseFloat(item.rate) || 0
      return total + (qty * rate)
    }, 0)
  }

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal()
    return (subtotal * (parseFloat(formData.tax_rate) || 0)) / 100
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const taxAmount = calculateTaxAmount()
    return subtotal + taxAmount - (parseFloat(formData.advance_paid) || 0)
  }

  const getTotalQty = () => {
    return formData.items.reduce((total, item) => total + (parseFloat(item.qty) || 0), 0)
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

      const res = await fetch('http://localhost:5000/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: formData.supplier_id,
          supplier_name: formData.supplier_name,
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
          tax_category: formData.tax_category,
          tax_rate: formData.tax_rate,
          shipping_rule: formData.shipping_rule,
          incoterm: formData.incoterm,
          advance_paid: formData.advance_paid,
          subtotal: calculateSubtotal(),
          tax_amount: calculateTaxAmount(),
          final_amount: calculateTotal(),
          shipping_address_line1: formData.shipping_address_line1,
          shipping_address_line2: formData.shipping_address_line2,
          shipping_city: formData.shipping_city,
          shipping_state: formData.shipping_state,
          shipping_pincode: formData.shipping_pincode,
          shipping_country: formData.shipping_country,
          payment_terms_description: formData.payment_terms_description,
          due_date: formData.due_date,
          invoice_portion: formData.invoice_portion,
          payment_amount: formData.payment_amount,
          accounting_emails: ['accounts@company.com'],
          status: 'draft'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create purchase order')
      }

      setFormData({
        supplier_id: '',
        supplier_name: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_date: '',
        currency: 'INR',
        items: [{ item_code: '', item_name: '', qty: '', uom: '', rate: '', schedule_date: '' }],
        item_count: 0,
        tax_category: '',
        tax_rate: 0,
        shipping_rule: '',
        incoterm: '',
        advance_paid: 0,
        shipping_address_line1: '',
        shipping_address_line2: '',
        shipping_city: '',
        shipping_state: '',
        shipping_pincode: '',
        shipping_country: '',
        payment_terms_description: '',
        due_date: '',
        invoice_portion: 100,
        payment_amount: 0
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
                gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr auto',
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

                {/* Amount (Auto-calculated) */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>
                    Amount
                  </label>
                  <div style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    ₹{((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
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

        {/* Items Summary */}
        <div style={{
          backgroundColor: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Total Items</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#374151' }}>
                {formData.items.length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Total Quantity</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#374151' }}>
                {getTotalQty().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Subtotal Amount</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0284c7' }}>
                ₹{calculateSubtotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Tax & Charges Section */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '16px', fontWeight: 600, color: '#333' }}>Tax & Charges</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Tax Category
              </label>
              <select
                name="tax_category"
                value={formData.tax_category}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit'
                }}
              >
                <option value="">Select Tax Category</option>
                <option value="GST">GST</option>
                <option value="VAT">VAT</option>
                <option value="ST">Service Tax</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Tax Rate (%)
              </label>
              <input
                type="number"
                name="tax_rate"
                value={formData.tax_rate}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Tax Amount
              </label>
              <div style={{
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.85rem',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                fontWeight: 600
              }}>
                ₹{calculateTaxAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Shipping Rule
              </label>
              <input
                type="text"
                name="shipping_rule"
                value={formData.shipping_rule}
                onChange={handleInputChange}
                placeholder="e.g., FOB, CIF"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Incoterm
              </label>
              <select
                name="incoterm"
                value={formData.incoterm}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit'
                }}
              >
                <option value="">Select Incoterm</option>
                <option value="EXW">EXW - Ex Works</option>
                <option value="FCA">FCA - Free Carrier</option>
                <option value="FAS">FAS - Free Alongside Ship</option>
                <option value="FOB">FOB - Free on Board</option>
                <option value="CFR">CFR - Cost and Freight</option>
                <option value="CIF">CIF - Cost, Insurance & Freight</option>
                <option value="DAP">DAP - Delivered at Place</option>
                <option value="DDP">DDP - Delivered Duty Paid</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Advance Paid (₹)
              </label>
              <input
                type="number"
                name="advance_paid"
                value={formData.advance_paid}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Advance Paid</p>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                  ₹{(parseFloat(formData.advance_paid) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Final Amount Summary */}
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '2px solid #10b981',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Subtotal</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>
                ₹{calculateSubtotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Tax ({formData.tax_rate || 0}%)</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>
                ₹{calculateTaxAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Final Amount (After Advance)</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>
                ₹{calculateTotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Shipping Address Section */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '16px', fontWeight: 600, color: '#333' }}>Shipping Address</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Address Line 1
              </label>
              <input
                type="text"
                name="shipping_address_line1"
                value={formData.shipping_address_line1}
                onChange={handleInputChange}
                placeholder="Street address"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Address Line 2
              </label>
              <input
                type="text"
                name="shipping_address_line2"
                value={formData.shipping_address_line2}
                onChange={handleInputChange}
                placeholder="Apartment, suite, etc."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                City
              </label>
              <input
                type="text"
                name="shipping_city"
                value={formData.shipping_city}
                onChange={handleInputChange}
                placeholder="City"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                State
              </label>
              <input
                type="text"
                name="shipping_state"
                value={formData.shipping_state}
                onChange={handleInputChange}
                placeholder="State/Province"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Pincode
              </label>
              <input
                type="text"
                name="shipping_pincode"
                value={formData.shipping_pincode}
                onChange={handleInputChange}
                placeholder="Postal code"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Country
              </label>
              <input
                type="text"
                name="shipping_country"
                value={formData.shipping_country}
                onChange={handleInputChange}
                placeholder="Country"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* Payment Terms Section */}
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '16px', fontWeight: 600, color: '#333' }}>Payment Terms</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Payment Terms Description
              </label>
              <input
                type="text"
                name="payment_terms_description"
                value={formData.payment_terms_description}
                onChange={handleInputChange}
                placeholder="e.g., Net 30, Net 60, etc."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Due Date
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Invoice Portion (%)
              </label>
              <input
                type="number"
                name="invoice_portion"
                value={formData.invoice_portion}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333', fontSize: '0.9rem' }}>
                Payment Amount (₹)
              </label>
              <input
                type="number"
                name="payment_amount"
                value={formData.payment_amount}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '12px', marginBottom: 0 }}>
            💡 Reminders will be sent to Accounts Department on the due date
          </p>
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
              backgroundColor: loading ? '#d1d5db' : '#10b981',
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
              if (!loading) e.target.style.backgroundColor = '#059669'
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.backgroundColor = '#10b981'
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
