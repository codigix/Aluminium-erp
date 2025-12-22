import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/Button/Button'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import './Selling.css'

const styles = {
  mainContainer: {
    maxWidth: '100%',
    margin: '2rem',
    padding: '0'
  },
  header: {
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #e5e7eb'
  },
  tabsContainer: {
    marginBottom: '20px',
    borderBottom: '2px solid #e5e7eb'
  },
  tabsList: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '0',
    borderBottom: 'none'
  },
  tab: {
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#666',
    borderBottom: '3px solid transparent',
    transition: 'all 0.3s',
    whiteSpace: 'nowrap'
  },
  tabActive: {
    color: '#007bff',
    borderBottomColor: '#007bff'
  },
  tabContent: {
    padding: '20px 0'
  },
  gridRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '12px',
    marginBottom: '12px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '4px',
    color: '#374151'
  },
  input: {
    padding: '8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit'
  },
  select: {
    padding: '8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit',
    backgroundColor: 'white'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    marginTop: '8px'
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: '600',
    padding: '8px',
    textAlign: 'left',
    borderBottom: '2px solid #d1d5db'
  },
  tableCell: {
    padding: '8px',
    borderBottom: '1px solid #e5e7eb'
  },
  totalsBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    padding: '12px',
    marginTop: '12px'
  },
  wizardNav: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between',
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb'
  },
  analysisCard: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #0ea5e9',
    borderRadius: '4px',
    padding: '16px',
    marginTop: '16px'
  }
}

export default function SalesOrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const tabs = [
    { id: 'basicDetails', label: 'Basic Details' },
    { id: 'items', label: 'Items' },
    { id: 'bomDetails', label: 'BOM Details' }
  ]

  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [formData, setFormData] = useState({
    series: 'SO',
    date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    bom_id: '',
    quantity: 1,
    source_warehouse: '',
    delivery_date: '',
    order_type: 'Sales',
    status: 'Draft',
    cost_center: '',
    project: '',
    order_amount: 0,
    items: []
  })

  const [customers, setCustomers] = useState([])
  const [boms, setBoms] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [allItems, setAllItems] = useState([])
  const [bomDetails, setBomDetails] = useState(null)
  const [bomAnalysis, setBomAnalysis] = useState(null)

  useEffect(() => {
    fetchRequiredData()
    if (id && id !== 'new') {
      fetchSalesOrder(id)
    }
  }, [id])

  useEffect(() => {
    if (bomDetails && formData.items.length === 0) {
      populateBOMItems(bomDetails)
    }
  }, [bomDetails])

  const fetchRequiredData = async () => {
    try {
      const [custRes, bomRes, whRes, itemRes] = await Promise.all([
        axios.get('http://localhost:5000/api/selling/customers').catch(err => {
          console.error('Customer API error:', err.message)
          return { data: { data: [] } }
        }),
        axios.get('http://localhost:5000/api/selling/bom-list').catch(err => {
          console.error('BOM API error:', err.message)
          return { data: { data: [] } }
        }),
        axios.get('http://localhost:5000/api/stock/warehouses').catch(err => {
          console.error('Warehouse API error:', err.message)
          return { data: { data: [] } }
        }),
        axios.get('http://localhost:5000/api/items').catch(err => {
          console.error('Items API error:', err.message)
          return { data: { data: [] } }
        })
      ])

      setCustomers(custRes.data.data || [])
      setBoms(bomRes.data.data || [])
      setWarehouses((whRes.data.data || []).map(w => ({ label: w.name || w.warehouse_name, value: w.name || w.id })))
      setAllItems(itemRes.data.data || [])
      
      console.log('Fetched BOMs:', bomRes.data.data || [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }

  const fetchSalesOrder = async (orderId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/selling/sales-orders/${orderId}`)
      const orderData = response.data.data
      setFormData(prev => ({
        ...prev,
        ...orderData
      }))
      if (orderData.bom_id) {
        fetchBOMDetails(orderData.bom_id)
        fetchBOMAnalysis(orderData.bom_id)
      }
    } catch (err) {
      setError('Failed to fetch sales order')
    }
  }

  const fetchBOMDetails = async (bomId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/selling/bom/${bomId}`)
      console.log('BOM Details fetched:', response.data.data)
      setBomDetails(response.data.data)
    } catch (err) {
      console.error('Failed to fetch BOM details:', err)
    }
  }

  const fetchBOMAnalysis = async (bomId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/selling/orders-by-bom/${bomId}`)
      setBomAnalysis(response.data.data)
    } catch (err) {
      console.error('Failed to fetch BOM analysis:', err)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleCustomerChange = (value) => {
    const customer = customers.find(c => c.customer_id === value)
    setFormData({
      ...formData,
      customer_id: value,
      customer_name: customer?.name || '',
      customer_email: customer?.email || '',
      customer_phone: customer?.phone || ''
    })
  }

  const handleBOMChange = (value) => {
    setFormData({
      ...formData,
      bom_id: value,
      items: []
    })
    if (value) {
      fetchBOMDetails(value)
      fetchBOMAnalysis(value)
    } else {
      setBomDetails(null)
      setBomAnalysis(null)
    }
  }

  const populateBOMItems = (bom) => {
    console.log('Populating BOM items from:', bom)
    
    if (!bom) {
      console.warn('BOM is null or undefined')
      return
    }

    // For Sales Order, we sell the Product produced by the BOM
    const bomItem = {
      item_code: bom.item_code,
      item_name: bom.product_name || bom.description || bom.item_code,
      qty: formData.quantity || 1,
      rate: bom.standard_selling_rate || bom.total_cost || 0,
      amount: (formData.quantity || 1) * (bom.standard_selling_rate || bom.total_cost || 0),
      _key: `bom_product_${Date.now()}`
    }
    
    console.log('Setting item:', bomItem)
    setFormData(prev => ({
      ...prev,
      items: [bomItem]
    }))
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
          rate: 0,
          amount: 0,
          _key: `manual_${Date.now()}_${Math.random()}`
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
    let newItemData = {
      ...updatedItems[idx],
      [field]: field === 'rate' || field === 'qty' ? parseFloat(value) || 0 : value
    }

    if (field === 'item_code') {
      const selectedItem = allItems.find(i => i.item_code === value)
      if (selectedItem) {
        newItemData.item_name = selectedItem.name || selectedItem.item_name
        newItemData.rate = parseFloat(selectedItem.standard_selling_rate) || parseFloat(selectedItem.valuation_rate) || 0
      }
    }

    if (field === 'qty' || field === 'rate' || field === 'item_code') {
      newItemData.amount = (parseFloat(newItemData.qty) || 0) * (parseFloat(newItemData.rate) || 0)
    }

    updatedItems[idx] = newItemData
    setFormData({ ...formData, items: updatedItems })
  }

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.customer_id || !formData.delivery_date) {
      setError('Please fill all required fields')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        ...formData,
        order_amount: calculateTotal(),
        items: formData.items.map(item => {
          const { _key, ...cleanItem } = item
          return cleanItem
        })
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

  const currentTab = tabs[activeTabIndex]

  const nextTab = () => {
    if (activeTabIndex < tabs.length - 1) {
      setActiveTabIndex(activeTabIndex + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prevTab = () => {
    if (activeTabIndex > 0) {
      setActiveTabIndex(activeTabIndex - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div style={styles.mainContainer}>
      <Card>
        <div style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{isEditMode ? 'Edit Sales Order' : 'New Sales Order'}</h2>
            <Button onClick={() => navigate('/selling/sales-orders')} variant="secondary">
              Back
            </Button>
          </div>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <div style={styles.tabsContainer}>
          <div style={styles.tabsList}>
            {tabs.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabIndex(idx)}
                style={{
                  ...styles.tab,
                  ...(idx === activeTabIndex ? styles.tabActive : {})
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {currentTab.id === 'basicDetails' && (
            <div style={styles.tabContent}>
              <div style={styles.gridRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Series</label>
                  <input
                    style={styles.input}
                    type="text"
                    name="series"
                    value={formData.series}
                    onChange={handleChange}
                    placeholder="SO"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date *</label>
                  <input
                    style={styles.input}
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div style={styles.gridRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Customer *</label>
                  <select
                    style={styles.select}
                    value={formData.customer_id}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    required
                  >
                    <option value="">Search customer...</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.gridRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Customer Name</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={formData.customer_name}
                    readOnly
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    style={styles.input}
                    type="email"
                    value={formData.customer_email}
                    readOnly
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={formData.customer_phone}
                    readOnly
                  />
                </div>
              </div>

              <div style={styles.gridRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>BOM *</label>
                  <select
                    style={styles.select}
                    value={formData.bom_id}
                    onChange={(e) => handleBOMChange(e.target.value)}
                    required
                  >
                    <option value="">Search BOM...</option>
                    {boms.map(b => (
                      <option key={b.bom_id} value={b.bom_id}>
                        {b.item_code} ({b.bom_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Quantity *</label>
                  <input
                    style={styles.input}
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div style={styles.gridRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Source Warehouse</label>
                  <select
                    style={styles.select}
                    name="source_warehouse"
                    value={formData.source_warehouse}
                    onChange={handleChange}
                  >
                    <option value="">Select warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Delivery Date *</label>
                  <input
                    style={styles.input}
                    type="date"
                    name="delivery_date"
                    value={formData.delivery_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div style={styles.gridRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Order Type</label>
                  <select
                    style={styles.select}
                    name="order_type"
                    value={formData.order_type}
                    onChange={handleChange}
                  >
                    <option value="Sales">Sales</option>
                    <option value="Custom">Custom</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Status</label>
                  <select
                    style={styles.select}
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Confirmed">Confirmed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentTab.id === 'items' && (
            <div style={styles.tabContent}>
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <Plus size={16} /> Add Item
                </button>
              </div>

              {formData.items.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.tableHeader}>Item Code</th>
                        <th style={styles.tableHeader}>Item Name</th>
                        <th style={styles.tableHeader}>Qty</th>
                        <th style={styles.tableHeader}>Rate</th>
                        <th style={styles.tableHeader}>Amount</th>
                        <th style={styles.tableHeader}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => (
                        <tr key={item._key || item.id || idx}>
                          <td style={styles.tableCell}>
                            <input
                              style={styles.input}
                              type="text"
                              value={item.item_code}
                              onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                              placeholder="Item code"
                              list="items-list"
                            />
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              style={styles.input}
                              type="text"
                              value={item.item_name}
                              onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                              placeholder="Item name"
                            />
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              style={styles.input}
                              type="number"
                              value={item.qty}
                              onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              style={styles.input}
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              placeholder="0.00"
                            />
                          </td>
                          <td style={styles.tableCell}>
                            {item.amount.toFixed(2)}
                          </td>
                          <td style={styles.tableCell}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Alert type="info">No items added. Click "Add Item" to add items to this order.</Alert>
              )}

              <div style={styles.totalsBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Subtotal:</span>
                  <span>₹{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <datalist id="items-list">
                {allItems.map(item => (
                  <option key={item.item_code} value={item.item_code}>
                    {item.name}
                  </option>
                ))}
              </datalist>
            </div>
          )}

          {currentTab.id === 'bomDetails' && (
            <div style={styles.tabContent}>
              {bomDetails ? (
                <div>
                  <div style={styles.gridRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>BOM ID</label>
                      <input style={styles.input} type="text" value={bomDetails.bom_id} readOnly />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Product</label>
                      <input style={styles.input} type="text" value={bomDetails.product_name} readOnly />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Total Cost</label>
                      <input style={styles.input} type="text" value={`₹${bomDetails.total_cost || 0}`} readOnly />
                    </div>
                  </div>

                  <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Materials</h3>
                  {bomDetails.materials && bomDetails.materials.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.tableHeader}>Item Code</th>
                            <th style={styles.tableHeader}>Qty</th>
                            <th style={styles.tableHeader}>UOM</th>
                            <th style={styles.tableHeader}>Rate</th>
                            <th style={styles.tableHeader}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bomDetails.materials.map((material, idx) => (
                            <tr key={idx}>
                              <td style={styles.tableCell}>{material.component_code || material.item_code}</td>
                              <td style={styles.tableCell}>{material.quantity || material.qty}</td>
                              <td style={styles.tableCell}>{material.uom}</td>
                              <td style={styles.tableCell}>₹{material.rate || 0}</td>
                              <td style={styles.tableCell}>₹{material.amount || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Alert type="info">No materials in this BOM</Alert>
                  )}

                  {bomAnalysis && bomAnalysis.summary && (
                    <div style={styles.analysisCard}>
                      <h3 style={{ marginTop: '0' }}>Sales Order Analysis for this BOM</h3>
                      <div style={styles.gridRow}>
                        <div>
                          <label style={styles.label}>Total Orders</label>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {bomAnalysis.summary.total_orders || 0}
                          </div>
                        </div>
                        <div>
                          <label style={styles.label}>Total Sales Amount</label>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            ₹{bomAnalysis.summary.total_amount || 0}
                          </div>
                        </div>
                        <div>
                          <label style={styles.label}>Unique Customers</label>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {bomAnalysis.summary.unique_customers || 0}
                          </div>
                        </div>
                        <div>
                          <label style={styles.label}>Avg Order Value</label>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            ₹{bomAnalysis.summary.avg_amount || 0}
                          </div>
                        </div>
                      </div>

                      {bomAnalysis.recent_orders && bomAnalysis.recent_orders.length > 0 && (
                        <div>
                          <h4 style={{ marginTop: '16px' }}>Recent Orders</h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                              <thead>
                                <tr>
                                  <th style={styles.tableHeader}>Order ID</th>
                                  <th style={styles.tableHeader}>Customer ID</th>
                                  <th style={styles.tableHeader}>Amount</th>
                                  <th style={styles.tableHeader}>Quantity</th>
                                  <th style={styles.tableHeader}>Status</th>
                                  <th style={styles.tableHeader}>Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bomAnalysis.recent_orders.map((order, idx) => (
                                  <tr key={idx}>
                                    <td style={styles.tableCell}>{order.sales_order_id}</td>
                                    <td style={styles.tableCell}>{order.customer_id}</td>
                                    <td style={styles.tableCell}>₹{order.order_amount}</td>
                                    <td style={styles.tableCell}>{order.quantity}</td>
                                    <td style={styles.tableCell}>{order.status}</td>
                                    <td style={styles.tableCell}>
                                      {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Alert type="info">Select a BOM to view details and analysis</Alert>
              )}
            </div>
          )}

          <div style={styles.wizardNav}>
            {activeTabIndex > 0 && (
              <Button type="button" onClick={prevTab} variant="secondary">
                ← Previous
              </Button>
            )}
            <div style={{ flex: 1 }}></div>
            {activeTabIndex < tabs.length - 1 ? (
              <Button type="button" onClick={nextTab} variant="primary">
                Next →
              </Button>
            ) : (
              <Button type="submit" variant="success" disabled={loading}>
                {loading ? 'Saving...' : 'Save Sales Order'}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
