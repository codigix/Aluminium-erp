import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import AuditTrail from '../../components/AuditTrail'
import './Buying.css'

export default function MaterialRequestForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [formData, setFormData] = useState({
    requested_by_id: '',
    department: '',
    required_by_date: '',
    purpose: '',
    items: []
  })

  const [materialRequest, setMaterialRequest] = useState(null)
  const [items, setItems] = useState([])
  const [contacts, setContacts] = useState([])
  const [departments, setDepartments] = useState(['Production', 'Maintenance', 'Store'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [newItem, setNewItem] = useState({ item_code: '', qty: 1, uom: 'pcs', purpose: '' })
  
  // Check if form should be disabled (not editable)
  const isFormDisabled = isEditMode && materialRequest && materialRequest.status !== 'draft'

  useEffect(() => {
    fetchItems()
    fetchContacts()
    if (isEditMode) {
      fetchMaterialRequest()
    }
  }, [])

  const fetchMaterialRequest = async () => {
    try {
      const response = await axios.get(`/api/material-requests/${id}`)
      const mr = response.data.data
      setMaterialRequest(mr)
      setFormData({
        requested_by_id: mr.requested_by_id,
        department: mr.department,
        required_by_date: mr.required_by_date,
        purpose: mr.purpose,
        items: mr.items || []
      })
    } catch (err) {
      setError('Failed to fetch material request')
    }
  }

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

    if (isFormDisabled) {
      setError('Cannot edit an approved material request. Only draft requests can be edited.')
      return
    }

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

      if (isEditMode) {
        await axios.put(`/api/material-requests/${id}`, submitData)
        setSuccess('Material request updated successfully')
      } else {
        await axios.post('/api/material-requests', submitData)
        setSuccess('Material request created successfully')
      }

      setTimeout(() => navigate('/buying/material-requests'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save material request')
    } finally {
      setLoading(false)
    }
  }

  const getItemName = (code) => {
    const item = items.find(i => i.item_code === code)
    return item ? item.name : code
  }

  return (
    <div className="buying-container">
      <Card>
        <div className="page-header">
          <h2>{isEditMode ? 'Edit Material Request' : 'Create Material Request'}</h2>
          <Button 
            onClick={() => navigate('/buying/material-requests')}
            variant="secondary"
          >
            Back
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {isEditMode && materialRequest && (
          <>
            {materialRequest.status !== 'draft' && (
              <Alert type="info">
                ⚠️ This material request is {materialRequest.status}. You can view the details but cannot edit it. Only draft requests can be edited.
              </Alert>
            )}
            <AuditTrail 
              createdAt={materialRequest.created_at}
              createdBy={materialRequest.created_by}
              updatedAt={materialRequest.updated_at}
              updatedBy={materialRequest.updated_by}
              status={materialRequest.status}
            />
          </>
        )}

        <form onSubmit={handleSubmit} className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label>Requested By *</label>
              <select 
                name="requested_by_id"
                value={formData.requested_by_id}
                onChange={handleChange}
                disabled={isFormDisabled}
                required
              >
                <option value="">Select Contact</option>
                {contacts.map(contact => (
                  <option key={contact.contact_id} value={contact.contact_id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Department *</label>
              <select 
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={isFormDisabled}
                required
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Required By Date *</label>
              <input 
                type="date"
                name="required_by_date"
                value={formData.required_by_date}
                onChange={handleChange}
                disabled={isFormDisabled}
                required
              />
            </div>

            <div className="form-group">
              <label>Purpose</label>
              <input 
                type="text"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                disabled={isFormDisabled}
                placeholder="e.g., Production, Maintenance"
              />
            </div>
          </div>

          <hr />

          <div className="items-section">
            <h3>Material Items</h3>
            
            <div className="add-item-section">
              <div className="form-row">
                <div className="form-group">
                  <label>Item *</label>
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
                    disabled={isFormDisabled}
                  >
                    <option value="">Select Item</option>
                    {items.map(item => (
                      <option key={item.item_code} value={item.item_code}>
                        {item.name} ({item.item_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity *</label>
                  <input 
                    type="number"
                    value={newItem.qty}
                    onChange={(e) => setNewItem({...newItem, qty: parseFloat(e.target.value)})}
                    disabled={isFormDisabled}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label>UOM</label>
                  <input 
                    type="text"
                    value={newItem.uom}
                    readOnly
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label>Purpose</label>
                  <input 
                    type="text"
                    value={newItem.purpose}
                    onChange={(e) => setNewItem({...newItem, purpose: e.target.value})}
                    disabled={isFormDisabled}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <Button 
                    onClick={handleAddItem}
                    variant="success"
                    type="button"
                    disabled={isFormDisabled}
                  >
                    Add Item
                  </Button>
                </div>
              </div>
            </div>

            {formData.items.length > 0 && (
              <div className="items-list">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>UOM</th>
                      <th>Purpose</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map(item => (
                      <tr key={item.id}>
                        <td>{getItemName(item.item_code)}</td>
                        <td>{item.qty}</td>
                        <td>{item.uom}</td>
                        <td>{item.purpose}</td>
                        <td>
                          <button 
                            type="button"
                            className="btn-sm btn-danger"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={isFormDisabled}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="form-actions">
            <Button 
              type="submit"
              variant="primary"
              disabled={loading || isFormDisabled}
            >
              {loading ? 'Saving...' : 'Save Material Request'}
            </Button>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => navigate('/buying/material-requests')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}