import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import DataTable from '../../components/Table/DataTable'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import Pagination from './Pagination'
import { Plus, Edit2, Trash2, Package, Eye, X } from 'lucide-react'
import './Inventory.css'

export default function StockEntries() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [items, setItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    purpose: '',
    reference_doctype: '',
    reference_name: '',
    remarks: ''
  })

  const [entryItems, setEntryItems] = useState([])
  const [newItem, setNewItem] = useState({ item_code: '', qty: 1 })

  useEffect(() => {
    fetchEntries()
    fetchWarehouses()
    fetchItems()
  }, [])

  const fetchEntries = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/stock/entries')
      setEntries(response.data.data || [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch stock entries')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get('/api/stock/warehouses')
      setWarehouses(response.data.data || [])
    } catch (err) {
      console.error('Failed to fetch warehouses:', err)
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleAddItem = () => {
    if (newItem.item_code && newItem.qty > 0) {
      setEntryItems([...entryItems, { ...newItem, id: Date.now() }])
      setNewItem({ item_code: '', qty: 1 })
    }
  }

  const handleRemoveItem = (id) => {
    setEntryItems(entryItems.filter(item => item.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (entryItems.length === 0) {
      setError('Please add at least one item')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        ...formData,
        items: entryItems
      }

      if (editingId) {
        await axios.put(`/api/stock/entries/${editingId}`, submitData)
        setSuccess('Stock entry updated successfully')
      } else {
        await axios.post('/api/stock/entries', submitData)
        setSuccess('Stock entry created successfully')
      }

      resetForm()
      fetchEntries()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save stock entry')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      entry_date: new Date().toISOString().split('T')[0],
      entry_type: '',
      from_warehouse_id: '',
      to_warehouse_id: '',
      purpose: '',
      reference_doctype: '',
      reference_name: '',
      remarks: ''
    })
    setEntryItems([])
    setShowForm(false)
    setEditingId(null)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this stock entry?')) {
      try {
        await axios.delete(`/api/stock/entries/${id}`)
        setSuccess('Stock entry deleted successfully')
        fetchEntries()
        setTimeout(() => setSuccess(null), 3000)
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete stock entry')
      }
    }
  }

  // Filter and pagination logic
  const filteredEntries = entries.filter(entry =>
    (entry.entry_id?.toString().includes(searchTerm.toLowerCase()) ||
     entry.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (typeFilter === '' || entry.reference_doctype === typeFilter) &&
    (warehouseFilter === '' || entry.warehouse_id?.toString() === warehouseFilter)
  )

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = filteredEntries.slice(startIndex, endIndex)

  const handleClearFilters = () => {
    setSearchTerm('')
    setTypeFilter('')
    setWarehouseFilter('')
    setCurrentPage(1)
  }

  const columns = [
    { key: 'entry_id', label: 'Entry ID' },
    { key: 'warehouse_name', label: 'Warehouse' },
    { key: 'total_items', label: 'Items Count' },
    {
      key: 'entry_date',
      label: 'Date',
      render: (row) => new Date(row.entry_date).toLocaleDateString()
    },
    { key: 'reference_doctype', label: 'Type' },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div className="inventory-actions-cell">
          <button className="btn-delete" onClick={() => handleDelete(row.entry_id)}>
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h1>
          <Package size={28} style={{ display: 'inline', marginRight: '10px' }} />
          Stock Entries
        </h1>
        <Button
          variant="primary"
          onClick={() => setShowForm(!showForm)}
          icon={Plus}
        >
          {showForm ? 'Cancel' : 'New Entry'}
        </Button>
      </div>

      {error && <Alert type="danger">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      {showForm && (
        <Card title="Create Stock Entry" className="inventory-form">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Entry Date *</label>
                <input
                  type="date"
                  name="entry_date"
                  value={formData.entry_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Entry Type *</label>
                <select
                  name="entry_type"
                  value={formData.entry_type}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Type</option>
                  <option value="Material Transfer">Material Transfer</option>
                  <option value="Receipt">Receipt</option>
                  <option value="Issue">Issue</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>From Warehouse</label>
                <select
                  name="from_warehouse_id"
                  value={formData.from_warehouse_id}
                  onChange={handleChange}
                >
                  <option value="">Select Source Warehouse</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>To Warehouse</label>
                <select
                  name="to_warehouse_id"
                  value={formData.to_warehouse_id}
                  onChange={handleChange}
                >
                  <option value="">Select Destination Warehouse</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Purpose</label>
                <input
                  type="text"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  placeholder="Purpose of the entry"
                />
              </div>
              <div className="form-group">
                <label>Reference Type</label>
                <select
                  name="reference_doctype"
                  value={formData.reference_doctype}
                  onChange={handleChange}
                >
                  <option value="">Select Type</option>
                  <option value="purchase_receipt">Purchase Receipt</option>
                  <option value="production">Production</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Reference Name</label>
              <input
                type="text"
                name="reference_name"
                value={formData.reference_name}
                onChange={handleChange}
                placeholder="Reference document name"
              />
            </div>

            {/* Items Section */}
            <Card title="Add Items" style={{ marginBottom: '15px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Item Code *</label>
                  <select
                    value={newItem.item_code}
                    onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value })}
                  >
                    <option value="">Select Item</option>
                    {items.map(item => (
                      <option key={item.item_code} value={item.item_code}>
                        {item.item_name} ({item.item_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.qty}
                    onChange={(e) => setNewItem({ ...newItem, qty: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button variant="secondary" onClick={handleAddItem}>
                    Add Item
                  </Button>
                </div>
              </div>

              {entryItems.length > 0 && (
                <table className="inventory-items-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Quantity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.item_code}</td>
                        <td>{item.qty}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div className="form-group">
              <label>Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Additional notes"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={loading}>
                Create Entry
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!showForm && entries.length > 0 && (
        <div className="inventory-filters">
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search by entry ID or warehouse..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <select 
            value={typeFilter} 
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Types</option>
            <option value="purchase_receipt">Purchase Receipt</option>
            <option value="production">Production</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <select 
            value={warehouseFilter} 
            onChange={(e) => {
              setWarehouseFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(wh => (
              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                {wh.warehouse_name}
              </option>
            ))}
          </select>
          {(searchTerm || typeFilter || warehouseFilter) && (
            <Button 
              variant="secondary" 
              onClick={handleClearFilters}
              icon={X}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {loading && !showForm ? (
        <div className="no-data">
          <Package size={48} style={{ opacity: 0.5 }} />
          <p>Loading stock entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="no-data">
          <Package size={48} style={{ opacity: 0.5 }} />
          <p>📦 No stock entries found.</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>Create your first entry to track stock movements.</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="no-data">
          <Package size={48} style={{ opacity: 0.5 }} />
          <p>❌ No entries match your filters.</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={paginatedData} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredEntries.length}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}
    </div>
  )
}