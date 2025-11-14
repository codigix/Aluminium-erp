import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Modal from '../Modal/Modal'
import Button from '../Button/Button'
import Alert from '../Alert/Alert'

export default function CreateQuotationModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    supplier_id: '',
    rfq_id: '',
    items: [],
    notes: ''
  })

  const [suppliers, setSuppliers] = useState([])
  const [rfqs, setRfqs] = useState([])
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchRequiredData()
    }
  }, [isOpen])

  const fetchRequiredData = async () => {
    try {
      const [supRes, rfqRes, itemRes] = await Promise.all([
        axios.get('/api/suppliers?active=true'),
        axios.get('/api/rfqs?status=sent'),
        axios.get('/api/items?limit=1000')
      ])

      setSuppliers(supRes.data.data || [])
      setRfqs(rfqRes.data.data || [])
      setAllItems(itemRes.data.data || [])
    } catch (err) {
      console.error('Failed to fetch required data:', err)
    }
  }

  const handleRFQSelect = async (e) => {
    const rfqId = e.target.value
    setFormData({ ...formData, rfq_id: rfqId })

    if (rfqId) {
      try {
        const response = await axios.get(`/api/rfqs/${rfqId}`)
        const rfq = response.data.data
        setFormData({
          ...formData,
          rfq_id: rfqId,
          items: (rfq.items || []).map(item => ({
            item_code: item.item_code,
            qty: item.qty,
            rate: 0,
            lead_time_days: 0,
            min_qty: 1,
            id: Date.now() + Math.random()
          }))
        })
      } catch (err) {
        console.error('Failed to fetch RFQ details:', err)
      }
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleItemChange = (idx, field, value) => {
    const updatedItems = [...formData.items]
    updatedItems[idx] = {
      ...updatedItems[idx],
      [field]: field === 'rate' ? parseFloat(value) || 0 : value
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

    if (!formData.supplier_id || !formData.rfq_id || formData.items.length === 0) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        supplier_id: formData.supplier_id,
        rfq_id: formData.rfq_id,
        items: formData.items.map(({ id, ...item }) => item),
        total_value: calculateTotal()
      }

      await axios.post('/api/quotations', submitData)
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create quotation')
    } finally {
      setLoading(false)
    }
  }

  const getItemName = (code) => {
    const item = allItems.find(i => i.item_code === code)
    return item ? item.name : code
  }

  const handleClose = () => {
    setFormData({
      supplier_id: '',
      rfq_id: '',
      items: [],
      notes: ''
    })
    setError(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Supplier Quotation" size="lg">
      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {error && <Alert type="danger">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          {/* Supplier & RFQ Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Supplier *</label>
              <select 
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>RFQ *</label>
              <select 
                value={formData.rfq_id}
                onChange={handleRFQSelect}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Select RFQ</option>
                {rfqs.map(rfq => (
                  <option key={rfq.rfq_id} value={rfq.rfq_id}>
                    {rfq.rfq_id} - {rfq.supplier_count} suppliers
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quotation Items */}
          {formData.items.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Quotation Items</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ backgroundColor: '#f5f5f5' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Item</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '80px' }}>Qty</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #ddd', width: '100px' }}>Rate</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #ddd', width: '100px' }}>Amount</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '100px' }}>Lead Time (days)</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '80px' }}>Min Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => {
                      const amount = (item.qty || 0) * (item.rate || 0)
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '8px' }}>{getItemName(item.item_code)}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{item.qty}</td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="number"
                              value={item.rate || ''}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{amount.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="number"
                              value={item.lead_time_days || ''}
                              onChange={(e) => handleItemChange(idx, 'lead_time_days', e.target.value)}
                              placeholder="0"
                              min="0"
                              style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="number"
                              value={item.min_qty || ''}
                              onChange={(e) => handleItemChange(idx, 'min_qty', e.target.value)}
                              placeholder="1"
                              min="0"
                              step="0.01"
                              style={{ width: '100%', padding: '4px', borderRadius: '3px', border: '1px solid #ddd', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
                <p>Total Quotation Value: <span style={{ color: '#28a745' }}>₹{calculateTotal().toFixed(2)}</span></p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Notes & Comments</label>
            <textarea 
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes or comments about this quotation..."
              rows="4"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <Button 
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Quotation'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}