import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Modal from '../Modal/Modal'
import Button from '../Button/Button'
import Alert from '../Alert/Alert'
import { Plus, X } from 'lucide-react'

export default function CreateMaterialRequestModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    requested_by_id: '',
    department: '',
    required_by_date: '',
    purpose: '',
    items: []
  })

  const [items, setItems] = useState([])
  const [contacts, setContacts] = useState([])
  const [departments, setDepartments] = useState(['Production', 'Maintenance', 'Store'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [newItem, setNewItem] = useState({ item_code: '', qty: 1, uom: 'pcs', purpose: '' })

  useEffect(() => {
    if (isOpen) {
      fetchItems()
      fetchContacts()
    }
  }, [isOpen])

  const fetchItems = async () => {
    try {
      const response = await axios.get('/api/items?limit=1000')
      setItems(response.data.data || [])
    } catch (err) {
      console.error('Failed to fetch items:', err)
    }
  }

  const fetchContacts = async () => {
    try {
      const response = await axios.get('/api/suppliers/contacts/all')
      setContacts(response.data.data || [])
    } catch (err) {
      console.error('Failed to fetch contacts:', err)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleAddItem = () => {
    if (!newItem.item_code || !newItem.qty) {
      setError('Please select item and enter quantity')
      return
    }

    const itemExists = formData.items.some(i => i.item_code === newItem.item_code)
    if (itemExists) {
      setError('Item already added')
      return
    }

    setFormData({
      ...formData,
      items: [...formData.items, { ...newItem, id: Date.now() }]
    })

    setNewItem({ item_code: '', qty: 1, uom: 'pcs', purpose: '' })
    setError(null)
  }

  const handleRemoveItem = (id) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.id !== id)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.requested_by_id || !formData.department || formData.items.length === 0) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        ...formData,
        items: formData.items.map(({ id, ...item }) => item)
      }

      await axios.post('/api/material-requests', submitData)
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create material request')
    } finally {
      setLoading(false)
    }
  }

  const getItemName = (code) => {
    const item = items.find(i => i.item_code === code)
    return item ? item.name : code
  }

  const handleClose = () => {
    setFormData({
      requested_by_id: '',
      department: '',
      required_by_date: '',
      purpose: '',
      items: []
    })
    setError(null)
    setNewItem({ item_code: '', qty: 1, uom: 'pcs', purpose: '' })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Material Request" size="lg">
      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {error && <Alert type="danger">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          {/* Requested By & Department */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Requested By *</label>
              <select 
                name="requested_by_id"
                value={formData.requested_by_id}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Select Contact</option>
                {contacts.map(contact => (
                  <option key={contact.contact_id} value={contact.contact_id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Department *</label>
              <select 
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Required By Date & Purpose */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Required By Date *</label>
              <input 
                type="date"
                name="required_by_date"
                value={formData.required_by_date}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Purpose</label>
              <input 
                type="text"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="e.g., Production, Maintenance"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>

          {/* Add Items */}
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h4 style={{ marginTop: 0 }}>Add Material Items</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Item *</label>
                <select 
                  value={newItem.item_code}
                  onChange={(e) => {
                    const item = items.find(i => i.item_code === e.target.value)
                    setNewItem({ 
                      ...newItem, 
                      item_code: e.target.value,
                      uom: item?.uom || 'pcs'
                    })
                  }}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                >
                  <option value="">Select</option>
                  {items.map(item => (
                    <option key={item.item_code} value={item.item_code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Qty *</label>
                <input 
                  type="number"
                  value={newItem.qty}
                  onChange={(e) => setNewItem({...newItem, qty: parseFloat(e.target.value)})}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>UOM</label>
                <input 
                  type="text"
                  value={newItem.uom}
                  readOnly
                  disabled
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px', backgroundColor: '#e8e8e8' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Purpose</label>
                <input 
                  type="text"
                  value={newItem.purpose}
                  onChange={(e) => setNewItem({...newItem, purpose: e.target.value})}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button 
                  onClick={handleAddItem}
                  variant="success"
                  type="button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} /> Add
                </Button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {formData.items.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Selected Items ({formData.items.length})</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ backgroundColor: '#f5f5f5' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Item</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', width: '80px' }}>Qty</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd', width: '80px' }}>UOM</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Purpose</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '50px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '8px' }}>{getItemName(item.item_code)}</td>
                        <td style={{ padding: '8px' }}>{item.qty}</td>
                        <td style={{ padding: '8px' }}>{item.uom}</td>
                        <td style={{ padding: '8px' }}>{item.purpose}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button 
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545' }}
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
              {loading ? 'Creating...' : 'Create Material Request'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}