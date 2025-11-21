import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import AuditTrail from '../../components/AuditTrail'
import './Selling.css'

export default function SalesQuotationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [formData, setFormData] = useState({
    customer_id: '',
    items: [],
    notes: '',
    valid_till: '',
    customer_name: ''
  })

  const [customers, setCustomers] = useState([])
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [quotation, setQuotation] = useState(null)

  useEffect(() => {
    fetchRequiredData()
    if (isEditMode) {
      fetchQuotation()
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

  const fetchQuotation = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/selling/quotations/${id}`)
      const quotationData = response.data.data
      setQuotation(quotationData)
      setFormData({
        customer_id: quotationData.customer_id,
        items: quotationData.items || [],
        notes: quotationData.notes || '',
        valid_till: quotationData.validity_date || '',
        customer_name: quotationData.customer_name || ''
      })
    } catch (err) {
      setError('Failed to fetch quotation')
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
      customer_name: customer?.name || ''
    })
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          item_code: '',
          qty: 1,
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

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const qty = item.qty || 0
      const rate = item.rate || 0
      return sum + (qty * rate)
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.customer_id || formData.items.length === 0 || !formData.valid_till) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        customer_id: formData.customer_id,
        customer_name: formData.customer_name,
        items: formData.items.map(({ id, ...item }) => item),
        total_value: calculateTotal(),
        notes: formData.notes,
        validity_date: formData.valid_till,
        status: 'draft'
      }

      if (isEditMode) {
        await axios.put(`http://localhost:5000/api/selling/quotations/${id}`, submitData)
        setSuccess('Quotation updated successfully')
      } else {
        await axios.post('http://localhost:5000/api/selling/quotations', submitData)
        setSuccess('Quotation created successfully')
      }

      setTimeout(() => navigate('/selling/quotations'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save quotation')
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
          <h2>{isEditMode ? 'Edit Sales Quotation' : 'Create Sales Quotation'}</h2>
          <Button 
            onClick={() => navigate('/selling/quotations')}
            variant="secondary"
          >
            Back
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {isEditMode && quotation && (
          <AuditTrail 
            createdAt={quotation.created_at}
            createdBy={quotation.created_by}
            updatedAt={quotation.updated_at}
            updatedBy={quotation.updated_by}
            status={quotation.status}
          />
        )}

        <form onSubmit={handleSubmit} className="form-section">
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
              <label>Valid Till *</label>
              <input 
                type="date"
                name="valid_till"
                value={formData.valid_till}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <hr />

          <div className="items-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>Quotation Items</h3>
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
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th style={{ width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => {
                      const amount = (item.qty || 0) * (item.rate || 0)
                      return (
                        <tr key={idx}>
                          <td>
                            <select 
                              value={item.item_code}
                              onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                              style={{ width: '100%' }}
                            >
                              <option value="">Select Item</option>
                              {allItems.map(itm => (
                                <option key={itm.item_code} value={itm.item_code}>
                                  {itm.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input 
                              type="number"
                              value={item.qty || ''}
                              onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                              placeholder="0"
                              min="0"
                              step="0.01"
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              value={item.rate || ''}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td>₹{amount.toFixed(2)}</td>
                          <td>
                            <Button 
                              type="button"
                              variant="danger"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ fontSize: '0.85rem', padding: '4px 8px', width: '100%' }}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <p>No items added yet. Click "Add Item" to get started.</p>
              </div>
            )}

            {formData.items.length > 0 && (
              <div style={{ marginTop: '20px', textAlign: 'right', fontSize: '18px', fontWeight: 'bold' }}>
                <p>Total Quotation Value: <span style={{ color: '#28a745' }}>₹{calculateTotal().toFixed(2)}</span></p>
              </div>
            )}
          </div>

          <hr />

          <div className="form-group">
            <label>Notes & Comments</label>
            <textarea 
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes or comments about this quotation..."
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
              {loading ? 'Saving...' : 'Save Quotation'}
            </Button>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => navigate('/selling/quotations')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
