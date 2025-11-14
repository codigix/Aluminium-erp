import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Modal from '../Modal/Modal'
import Button from '../Button/Button'
import Alert from '../Alert/Alert'
import { Plus, X } from 'lucide-react'

export default function CreateRFQModal({ isOpen, onClose, onSuccess }) {
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
  const [newSupplier, setNewSupplier] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchRequiredData()
    }
  }, [isOpen])

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

  const handleLoadFromMR = (mrId) => {
    const mr = approvedMRs.find(m => m.mr_id === mrId)
    if (mr) {
      axios.get(`/api/material-requests/${mrId}`).then(res => {
        const items = res.data.data.items || []
        setFormData({
          ...formData,
          items: items.map(item => ({
            item_code: item.item_code,
            qty: item.qty,
            uom: item.uom,
            id: Date.now() + Math.random()
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

      await axios.post('/api/rfqs', submitData)
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create RFQ')
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

  const handleClose = () => {
    setFormData({
      created_by_id: '',
      valid_till: '',
      items: [],
      suppliers: []
    })
    setError(null)
    setNewSupplier('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Request for Quotation (RFQ)" size="lg">
      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {error && <Alert type="danger">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          {/* Created By & Valid Till */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Created By *</label>
              <select 
                name="created_by_id"
                value={formData.created_by_id}
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Valid Till *</label>
              <input 
                type="date"
                name="valid_till"
                value={formData.valid_till}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>

          {/* Load from MR */}
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Load from Material Request (Optional)</label>
            <select 
              onChange={(e) => handleLoadFromMR(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">Select Approved MR to load items...</option>
              {approvedMRs.map(mr => (
                <option key={mr.mr_id} value={mr.mr_id}>
                  {mr.mr_id} - {mr.purpose}
                </option>
              ))}
            </select>
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
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '8px' }}>{getItemName(item.item_code)}</td>
                        <td style={{ padding: '8px' }}>{item.qty}</td>
                        <td style={{ padding: '8px' }}>{item.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add Suppliers */}
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h4 style={{ marginTop: 0 }}>Add Suppliers for Quotation</h4>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.name}
                  </option>
                ))}
              </select>

              <Button 
                onClick={handleAddSupplier}
                variant="success"
                type="button"
              >
                <Plus size={16} /> Add
              </Button>
            </div>
          </div>

          {/* Suppliers List */}
          {formData.suppliers.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Selected Suppliers ({formData.suppliers.length})</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ backgroundColor: '#f5f5f5' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Supplier</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '50px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.suppliers.map(supplier => (
                      <tr key={supplier.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '8px' }}>{getSupplierName(supplier.supplier_id)}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button 
                            type="button"
                            onClick={() => handleRemoveSupplier(supplier.id)}
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
              {loading ? 'Creating...' : 'Create RFQ'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}