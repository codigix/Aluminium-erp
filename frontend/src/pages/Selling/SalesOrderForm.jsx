import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import AuditTrail from '../../components/AuditTrail'
import './Selling.css'

export default function SalesOrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    delivery_date: '',
    terms_conditions: '',
    items: [],
    notes: '',
    tax_rate: 0,
    discount_type: 'percentage',
    discount_value: 0
  })

  const [customers, setCustomers] = useState([])
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [order, setOrder] = useState(null)

  useEffect(() => {
    fetchRequiredData()
    if (isEditMode) {
      fetchOrder()
    }
  }, [])

  const fetchRequiredData = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([
        axios.get('http://localhost:5000/api/selling/customers'),
        axios.get('/api/items?limit=1000')
      ])

      setCustomers(custRes.data.data || [])
      setAllItems(itemRes.data.data || [])
    } catch (err) {
      console.error('Failed to fetch required data:', err)
    }
  }

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/selling/sales-orders/${id}`)
      const orderData = response.data.data
      setOrder(orderData)
      setFormData({
        customer_id: orderData.customer_id,
        customer_name: orderData.customer_name || '',
        customer_email: orderData.customer_email || '',
        customer_phone: orderData.customer_phone || '',
        delivery_date: orderData.delivery_date || '',
        terms_conditions: orderData.terms_conditions || '',
        items: orderData.items || [],
        notes: orderData.notes || '',
        tax_rate: orderData.tax_rate || 0,
        discount_type: orderData.discount_type || 'percentage',
        discount_value: orderData.discount_value || 0
      })
    } catch (err) {
      setError('Failed to fetch sales order')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleCustomerChange = (e) => {
    const customerId = e.target.value
    const customer = customers.find(c => c.customer_id === customerId)
    setFormData({
      ...formData,
      customer_id: customerId,
      customer_name: customer?.name || '',
      customer_email: customer?.email || '',
      customer_phone: customer?.phone || ''
    })
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          item_code: '',
          item_name: '',
          qty: 1,
          size: '',
          color: '',
          specifications: '',
          special_requirements: '',
          rate: 0,
          id: Date.now() + Math.random()
        }
      ]
    })
  }

  const handleRemoveItem = (idx) => {
    const updatedItems = formData.items.filter((_, i) => i !== idx)
    setFormData({ ...formData, items: updatedItems })
  }

  const handleItemChange = (idx, field, value) => {
    const updatedItems = [...formData.items]
    updatedItems[idx] = {
      ...updatedItems[idx],
      [field]: field === 'rate' || field === 'qty' ? parseFloat(value) || 0 : value
    }
    setFormData({ ...formData, items: updatedItems })
  }

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      const qty = item.qty || 0
      const rate = item.rate || 0
      return sum + (qty * rate)
    }, 0)
  }

  const calculateTaxAmount = (subtotal) => {
    return (subtotal * (formData.tax_rate || 0)) / 100
  }

  const calculateDiscountAmount = (subtotal) => {
    if (formData.discount_type === 'percentage') {
      return (subtotal * (formData.discount_value || 0)) / 100
    } else {
      return formData.discount_value || 0
    }
  }

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal()
    const discountAmount = calculateDiscountAmount(subtotal)
    const subtotalAfterDiscount = subtotal - discountAmount
    const taxAmount = calculateTaxAmount(subtotalAfterDiscount)
    return subtotalAfterDiscount + taxAmount
  }

  const calculateTotal = () => {
    return calculateSubtotal()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.customer_id || formData.items.length === 0 || !formData.delivery_date) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const subtotal = calculateSubtotal()
      const discountAmount = calculateDiscountAmount(subtotal)
      const subtotalAfterDiscount = subtotal - discountAmount
      const taxAmount = calculateTaxAmount(subtotalAfterDiscount)
      const grandTotal = calculateGrandTotal()

      const submitData = {
        customer_id: formData.customer_id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        items: formData.items.map(({ id, ...item }) => item),
        subtotal: subtotal,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        discount_amount: discountAmount,
        tax_rate: formData.tax_rate,
        tax_amount: taxAmount,
        total_value: grandTotal,
        delivery_date: formData.delivery_date,
        terms_conditions: formData.terms_conditions,
        notes: formData.notes,
        status: 'draft'
      }

      if (isEditMode) {
        await axios.put(`http://localhost:5000/api/selling/sales-orders/${id}`, submitData)
        setSuccess('Sales order updated successfully')
      } else {
        await axios.post('http://localhost:5000/api/selling/sales-orders', submitData)
        setSuccess('Sales order created successfully')
      }

      setTimeout(() => navigate('/selling/sales-orders'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save sales order')
    } finally {
      setLoading(false)
    }
  }

  const getItemName = (code) => {
    const item = allItems.find(i => i.item_code === code)
    return item ? item.name : code
  }

  return (
    <div className="selling-container">
      <Card>
        <div className="page-header">
          <h2>{isEditMode ? 'Edit Sales Order' : 'Create Sales Order'}</h2>
          <Button 
            onClick={() => navigate('/selling/sales-orders')}
            variant="secondary"
          >
            Back
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {isEditMode && order && (
          <AuditTrail 
            createdAt={order.created_at}
            createdBy={order.created_by}
            updatedAt={order.updated_at}
            updatedBy={order.updated_by}
            status={order.status}
          />
        )}

        <form onSubmit={handleSubmit} className="form-section">
          {/* Customer Details Section */}
          <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>Customer Details</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Customer *</label>
                <select 
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleCustomerChange}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer.customer_id} value={customer.customer_id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleChange}
                  placeholder="customer@example.com"
                  readOnly
                  style={{ backgroundColor: '#e9ecef' }}
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input 
                  type="tel"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleChange}
                  placeholder="+91 XXXXX XXXXX"
                  readOnly
                  style={{ backgroundColor: '#e9ecef' }}
                />
              </div>
            </div>
          </div>

          <hr />

          {/* Delivery & Terms Section */}
          <div className="form-row">
            <div className="form-group">
              <label>Delivery Date *</label>
              <input 
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Terms & Conditions</label>
              <input 
                type="text"
                name="terms_conditions"
                value={formData.terms_conditions}
                onChange={handleChange}
                placeholder="Payment terms, delivery conditions..."
              />
            </div>
          </div>

          <hr />

          {/* Items Requirements Section */}
          <div className="items-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>Order Items - Product Requirements</h3>
              <Button 
                type="button"
                variant="primary"
                onClick={handleAddItem}
                style={{ fontSize: '0.9rem', padding: '6px 12px' }}
              >
                + Add Item
              </Button>
            </div>

            {formData.items.length > 0 ? (
              <div>
                {formData.items.map((item, idx) => {
                  const amount = (item.qty || 0) * (item.rate || 0)
                  return (
                    <div key={idx} style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '8px', 
                      padding: '20px', 
                      marginBottom: '20px',
                      backgroundColor: '#fafafa'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: '#333' }}>Item #{idx + 1}</h4>
                        <Button 
                          type="button"
                          variant="danger"
                          onClick={() => handleRemoveItem(idx)}
                          style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                        >
                          Remove Item
                        </Button>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Product/Item Name *</label>
                          <input 
                            type="text"
                            value={item.item_name || ''}
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                            placeholder="e.g., Plastic Bottle, Aluminum Sheet, Steel Pipe, etc."
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Quantity *</label>
                          <input 
                            type="number"
                            value={item.qty || ''}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Rate (₹)</label>
                          <input 
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Size/Dimensions</label>
                          <input 
                            type="text"
                            value={item.size || ''}
                            onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                            placeholder="e.g., 10x20cm, Large, L, XL, etc."
                          />
                        </div>

                        <div className="form-group">
                          <label>Color/Finish</label>
                          <input 
                            type="text"
                            value={item.color || ''}
                            onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                            placeholder="e.g., Blue, Red, Matte, Glossy, etc."
                          />
                        </div>

                        <div className="form-group">
                          <label>Material/Grade</label>
                          <input 
                            type="text"
                            value={item.specifications || ''}
                            onChange={(e) => handleItemChange(idx, 'specifications', e.target.value)}
                            placeholder="e.g., Stainless Steel, Aluminum, Plastic, etc."
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Special Requirements & Specifications</label>
                        <textarea 
                          value={item.special_requirements || ''}
                          onChange={(e) => handleItemChange(idx, 'special_requirements', e.target.value)}
                          placeholder="Add detailed specifications like: Brand requirements, Quality standards, Packaging requirements, Delivery instructions, Custom markings, etc."
                          rows="3"
                          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>

                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '15px',
                        padding: '15px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '6px'
                      }}>
                        <div>
                          <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Quantity × Rate:</p>
                          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#1976d2' }}>
                            {item.qty || 0} × ₹{(item.rate || 0).toFixed(2)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9rem' }}>Item Total:</p>
                          <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: '#2e7d32' }}>
                            ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
                <p>No items added yet. Click "Add Item" to add products with detailed specifications.</p>
              </div>
            )}
          </div>

          {/* Tax & Discount Section */}
          <div style={{ backgroundColor: '#fafafa', padding: '20px', borderRadius: '8px', marginTop: '20px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>Tax & Discount</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Tax Rate (%)</label>
                <input 
                  type="number"
                  name="tax_rate"
                  value={formData.tax_rate}
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Discount Type</label>
                <select 
                  name="discount_type"
                  value={formData.discount_type}
                  onChange={handleChange}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Discount Value</label>
                <input 
                  type="number"
                  name="discount_value"
                  value={formData.discount_value}
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </div>

          {formData.items.length > 0 && (
            <div style={{ marginTop: '20px', marginBottom: '20px', backgroundColor: '#f0f8ff', border: '2px solid #0ea5e9', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1976d2' }}>Order Summary</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ borderRight: '1px solid #ddd' }}>
                  <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.95rem', color: '#666' }}>Subtotal:</label>
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                      ₹{calculateSubtotal().toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {formData.discount_value > 0 && (
                    <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.95rem', color: '#666' }}>
                        Discount ({formData.discount_type === 'percentage' ? formData.discount_value + '%' : '₹' + formData.discount_value}):
                      </label>
                      <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444', margin: 0 }}>
                        -₹{calculateDiscountAmount(calculateSubtotal()).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}

                  <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.95rem', color: '#666' }}>Subtotal after Discount:</label>
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                      ₹{(calculateSubtotal() - calculateDiscountAmount(calculateSubtotal())).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div>
                  {formData.tax_rate > 0 && (
                    <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.95rem', color: '#666' }}>Tax ({formData.tax_rate}%):</label>
                      <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#059669', margin: 0 }}>
                        +₹{calculateTaxAmount(calculateSubtotal() - calculateDiscountAmount(calculateSubtotal())).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}

                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #0ea5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937' }}>Grand Total:</label>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5e9', margin: 0 }}>
                      ₹{calculateGrandTotal().toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <hr />

          {/* Notes Section */}
          <div className="form-group">
            <label>Notes & Special Instructions</label>
            <textarea 
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any special instructions, specifications, or notes about this order..."
              rows="4"
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div className="form-actions">
            <Button 
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Create Sales Order'}
            </Button>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => navigate('/selling/sales-orders')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
