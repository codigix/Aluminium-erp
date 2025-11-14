import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import './Buying.css'

export default function RFQForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [formData, setFormData] = useState({
    created_by_id: '',
    valid_till: '',
    items: [],
    suppliers: []
  })

  const [approvedMRs, setApprovedMRs] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [allItems, setAllItems] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [newSupplier, setNewSupplier] = useState('')

  useEffect(() => {
    fetchRequiredData()
    if (isEditMode) {
      fetchRFQ()
    }
  }, [])

  const fetchRequiredData = async () => {
    try {
      const [mrRes, supRes, itemRes, contRes] = await Promise.all([
        axios.get('/api/material-requests/approved'),
        axios.get('/api/suppliers?active=true'),
        axios.get('/api/items?limit=1000'),
        axios.get('/api/suppliers/contacts/all')
      ])

      setApprovedMRs(mrRes.data.data || [])
      setSuppliers(supRes.data.data || [])
      setAllItems(itemRes.data.data || [])
      setContacts(contRes.data.data || [])
    } catch (err) {
      console.error('Failed to fetch required data:', err)
    }
  }

  const fetchRFQ = async () => {
    try {
      const response = await axios.get(`/api/rfqs/${id}`)
      const rfq = response.data.data
      setFormData({
        created_by_id: rfq.created_by_id,
        valid_till: rfq.valid_till,
        items: rfq.items || [],
        suppliers: rfq.suppliers || []
      })
    } catch (err) {
      setError('Failed to fetch RFQ')
    }
  }

  const handleLoadFromMR = (mrId) => {
    const mr = approvedMRs.find(m => m.mr_id === mrId)
    if (mr) {
      // Fetch full MR with items
      axios.get(`/api/material-requests/${mrId}`).then(res => {
        const items = res.data.data.items || []
        setFormData({
          ...formData,
          items: items.map(item => ({
            item_code: item.item_code,
            qty: item.qty,
            uom: item.uom
          }))
        })
      })
    }
  }

  const handleAddSupplier = () => {
    if (!newSupplier) {
      setError('Please select a supplier')
      return
    }

    const supplierExists = formData.suppliers.some(s => s.supplier_id === newSupplier)
    if (supplierExists) {
      setError('Supplier already added')
      return
    }

    setFormData({
      ...formData,
      suppliers: [...formData.suppliers, { supplier_id: newSupplier, id: Date.now() }]
    })
    setNewSupplier('')
    setError(null)
  }

  const handleRemoveSupplier = (id) => {
    setFormData({
      ...formData,
      suppliers: formData.suppliers.filter(s => s.id !== id)
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.created_by_id || !formData.valid_till || formData.items.length === 0 || formData.suppliers.length === 0) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        created_by_id: formData.created_by_id,
        valid_till: formData.valid_till,
        items: formData.items.map(({ id, ...item }) => item),
        suppliers: formData.suppliers.map(({ id, ...supplier }) => supplier)
      }

      if (isEditMode) {
        await axios.put(`/api/rfqs/${id}`, submitData)
        setSuccess('RFQ updated successfully')
      } else {
        await axios.post('/api/rfqs', submitData)
        setSuccess('RFQ created successfully')
      }

      setTimeout(() => navigate('/buying/rfqs'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save RFQ')
    } finally {
      setLoading(false)
    }
  }

  const getSupplierName = (id) => {
    const supplier = suppliers.find(s => s.supplier_id === id)
    return supplier ? supplier.name : id
  }

  const getItemName = (code) => {
    const item = allItems.find(i => i.item_code === code)
    return item ? item.name : code
  }

  return (
    <div className="buying-container">
      <Card>
        <div className="page-header">
          <h2>{isEditMode ? 'Edit RFQ' : 'Create RFQ'}</h2>
          <Button 
            onClick={() => navigate('/buying/rfqs')}
            variant="secondary"
          >
            Back
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <form onSubmit={handleSubmit} className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label>Created By *</label>
              <select 
                name="created_by_id"
                value={formData.created_by_id}
                onChange={handleChange}
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
            <h3>Items for Quotation</h3>
            
            {!isEditMode && (
              <div className="load-from-mr-section" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Load from Material Request (Optional)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    onChange={(e) => handleLoadFromMR(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select Approved MR to load items...</option>
                    {approvedMRs.map(mr => (
                      <option key={mr.mr_id} value={mr.mr_id}>
                        {mr.mr_id} - {mr.purpose}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formData.items.length > 0 && (
              <div className="items-list" style={{ marginBottom: '20px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{getItemName(item.item_code)}</td>
                        <td>{item.qty}</td>
                        <td>{item.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <hr />

          <div className="suppliers-section">
            <h3>Suppliers for Quotation</h3>
            
            <div className="add-supplier-section" style={{ marginBottom: '20px' }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Supplier *</label>
                  <select 
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.supplier_id} value={supplier.supplier_id}>
                        {supplier.name} ({supplier.supplier_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <Button 
                    onClick={handleAddSupplier}
                    variant="success"
                    type="button"
                    style={{ marginTop: '23px' }}
                  >
                    Add Supplier
                  </Button>
                </div>
              </div>
            </div>

            {formData.suppliers.length > 0 && (
              <div className="suppliers-list">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.suppliers.map(supplier => (
                      <tr key={supplier.id}>
                        <td>{getSupplierName(supplier.supplier_id)}</td>
                        <td>
                          <button 
                            type="button"
                            className="btn-sm btn-danger"
                            onClick={() => handleRemoveSupplier(supplier.id)}
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
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save RFQ'}
            </Button>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => navigate('/buying/rfqs')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}