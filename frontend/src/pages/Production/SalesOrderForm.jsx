import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Save } from 'lucide-react'
import * as productionService from '../../services/productionService'
import './Production.css'

export default function SalesOrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [customers, setCustomers] = useState([])
  const [boms, setBOMs] = useState([])
  const [warehouses, setWarehouses] = useState([])

  const [formData, setFormData] = useState({
    sales_order_id: '',
    customer_id: '',
    customer_name: '',
    email: '',
    phone: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    qty: '1',
    bom_id: '',
    bom_code: '',
    source_warehouse: '',
    order_type: 'Sales',
    status: 'draft',
    total_amount: '0',
    notes: ''
  })

  const [bomLines, setBomLines] = useState([])
  const [selectedBOM, setSelectedBOM] = useState(null)

  useEffect(() => {
    fetchLookupData()
    if (id) {
      fetchSalesOrderDetails(id)
    }
  }, [id])

  const fetchLookupData = async () => {
    try {
      const [customersRes, bomsRes, warehousesRes] = await Promise.all([
        productionService.getCustomers?.() || Promise.resolve({ data: [] }),
        productionService.getBOMs(),
        productionService.getWarehouses?.() || Promise.resolve({ data: [] })
      ]).catch(() => {
        return [{ data: [] }, { data: [] }, { data: [] }]
      })
      
      setCustomers(customersRes.data || [])
      setBOMs(bomsRes.data || [])
      setWarehouses(warehousesRes.data || [])
    } catch (err) {
      console.error('Failed to fetch lookup data:', err)
    }
  }

  const fetchSalesOrderDetails = async (orderId) => {
    try {
      setLoading(true)
      const response = await productionService.getSalesOrderById(orderId)
      const order = response.data
      
      setFormData({
        sales_order_id: order.sales_order_id,
        customer_id: order.customer_id,
        customer_name: order.customer_name || '',
        email: order.email || '',
        phone: order.phone || '',
        order_date: order.order_date || new Date().toISOString().split('T')[0],
        delivery_date: order.delivery_date || '',
        qty: order.quantity || order.qty || '1',
        bom_id: order.bom_id || '',
        bom_code: order.bom_code || '',
        source_warehouse: order.source_warehouse || '',
        order_type: order.order_type || 'Sales',
        status: order.status || 'draft',
        total_amount: order.order_amount || order.total_value || order.total_amount || '0',
        notes: order.notes || ''
      })

      if (order.bom_id) {
        await fetchBOMDetails(order.bom_id)
      }
      if (order.items) {
        setBomLines(order.items)
      }
    } catch (err) {
      setError('Failed to load sales order details')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBOMDetails = async (bomId) => {
    try {
      const response = await productionService.getBOMDetails(bomId)
      const bom = response.data
      setSelectedBOM(bom)
      
      const bomMaterials = bom.materials || bom.lines || []
      if (bomMaterials && bomMaterials.length > 0) {
        const lines = bomMaterials.map(line => {
          const qty = parseFloat(line.qty || line.quantity || 0)
          const rate = parseFloat(line.rate || line.valuation_rate || line.standard_selling_rate || 0)
          const lineTotal = (qty * rate).toFixed(2)
          
          return {
            ...line,
            qty: qty,
            quantity: qty,
            rate: rate,
            line_total: lineTotal
          }
        })
        setBomLines(lines)
        
        const totalAmount = lines.reduce((sum, line) => sum + parseFloat(line.line_total || 0), 0)
        setFormData(prev => ({
          ...prev,
          total_amount: totalAmount.toFixed(2)
        }))
      }
    } catch (err) {
      setError('Failed to load BOM details')
      console.error(err)
    }
  }

  const steps = [
    { id: 1, label: 'Basic Details' },
    { id: 2, label: 'Items' },
    { id: 3, label: 'BOM Details' }
  ]

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))

    if (name === 'customer_id') {
      const selectedCustomer = customers.find(c => c.customer_id === value)
      if (selectedCustomer) {
        setFormData(prev => ({
          ...prev,
          customer_name: selectedCustomer.name,
          email: selectedCustomer.email || '',
          phone: selectedCustomer.phone || ''
        }))
      }
    }

    if (name === 'bom_id') {
      if (value) {
        fetchBOMDetails(value)
      } else {
        setSelectedBOM(null)
        setBomLines([])
      }
    }
  }



  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.customer_id || !formData.bom_id || !formData.qty) {
      setError('Please fill in all required fields: Customer, BOM, and Quantity')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const payload = {
        customer_id: formData.customer_id,
        customer_name: formData.customer_name,
        email: formData.email,
        phone: formData.phone,
        order_date: formData.order_date,
        delivery_date: formData.delivery_date,
        quantity: parseFloat(formData.qty) || 1,
        qty: parseFloat(formData.qty) || 1,
        bom_id: formData.bom_id,
        bom_code: formData.bom_code,
        source_warehouse: formData.source_warehouse,
        order_type: formData.order_type,
        status: 'draft',
        order_amount: parseFloat(formData.total_amount) || 0,
        total_amount: parseFloat(formData.total_amount) || 0,
        notes: formData.notes,
        items: bomLines
      }

      if (formData.sales_order_id) {
        await productionService.updateSalesOrder(formData.sales_order_id, payload)
      } else {
        const response = await productionService.createSalesOrder(payload)
        if (response.data && response.data.sales_order_id) {
          setFormData(prev => ({
            ...prev,
            sales_order_id: response.data.sales_order_id
          }))
        }
      }
      
      setSuccess('Sales Order saved successfully')
      setTimeout(() => {
        navigate('/production/sales-orders', { state: { success: true } })
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to save sales order')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/production/sales-orders')
  }

  const confirmSalesOrder = async () => {
    if (!id) {
      setError('Please save the sales order first')
      return
    }

    try {
      setLoading(true)
      await productionService.confirmSalesOrder(id)
      setSuccess('Sales Order confirmed successfully')
      setFormData(prev => ({ ...prev, status: 'confirmed' }))
      setTimeout(() => {
        navigate('/production/sales-orders', { state: { success: true } })
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to confirm sales order')
    } finally {
      setLoading(false)
    }
  }

  if (loading && id) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          Loading sales order...
        </div>
      </div>
    )
  }

  const renderStepContent = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="form-grid">
            <div className="form-group">
              <label>Series {formData.sales_order_id && <span style={{ color: '#27ae60', fontSize: '0.85rem' }}>✓ Generated on Save</span>}</label>
              <input 
                type="text" 
                value={formData.sales_order_id} 
                placeholder="Generated when you save"
                disabled
                className="form-control"
                style={{ backgroundColor: formData.sales_order_id ? '#f0fdf4' : '#f5f5f5' }}
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input 
                type="date" 
                name="order_date" 
                value={formData.order_date}
                onChange={handleInputChange}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label>Customer *</label>
              <select 
                name="customer_id" 
                value={formData.customer_id}
                onChange={handleInputChange}
                className="form-control"
                required
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Customer Name</label>
              <input 
                type="text" 
                value={formData.customer_name}
                disabled
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email}
                onChange={handleInputChange}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input 
                type="text" 
                name="phone" 
                value={formData.phone}
                onChange={handleInputChange}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label>BOM *</label>
              <select 
                name="bom_id" 
                value={formData.bom_id}
                onChange={handleInputChange}
                className="form-control"
                required
              >
                <option value="">Search BOM...</option>
                {boms.map(b => (
                  <option key={b.bom_id} value={b.bom_id}>
                    {b.bom_id} - {b.product_name || b.item_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity *</label>
              <input 
                type="number" 
                name="qty" 
                value={formData.qty}
                onChange={handleInputChange}
                className="form-control"
                min="1"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Source Warehouse</label>
              <select 
                name="source_warehouse" 
                value={formData.source_warehouse}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="">Select warehouse...</option>
                {warehouses.map(w => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_name || w.warehouse_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Delivery Date</label>
              <input 
                type="date" 
                name="delivery_date" 
                value={formData.delivery_date}
                onChange={handleInputChange}
                className="form-control"
                placeholder="dd-mm-yyyy"
              />
            </div>

            <div className="form-group">
              <label>Order Type</label>
              <select 
                name="order_type" 
                value={formData.order_type}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="Sales">Sales</option>
                <option value="Internal">Internal</option>
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select 
                name="status" 
                value={formData.status}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="partial">Partial</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="section-content">
            {bomLines.length > 0 ? (
              <>
                <div className="table-container">
                  <h3 style={{ marginBottom: '15px' }}>Bill of Materials Items</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Rate</th>
                        <th style={{ textAlign: 'right' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomLines.map((line, idx) => (
                        <tr key={idx}>
                          <td>{line.item_code}</td>
                          <td>{line.item_name || 'N/A'}</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(line.qty || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>₹{parseFloat(line.rate || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>₹{parseFloat(line.line_total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label style={{ fontWeight: 'bold' }}>Total Amount</label>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    ₹{parseFloat(formData.total_amount).toFixed(2)}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#666' }}>
                <p>Please select a BOM in the Basic Details step to view items</p>
              </div>
            )}
          </div>
        )
      case 3:
        return (
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Additional Notes</label>
              <textarea 
                name="notes" 
                value={formData.notes}
                onChange={handleInputChange}
                className="form-control"
                rows="6"
                placeholder="Add any additional notes for this sales order"
              />
            </div>

            <div className="form-group full-width">
              <label style={{ fontWeight: 'bold' }}>Order Summary</label>
              <div style={{ 
                border: '1px solid #ddd', 
                padding: '15px', 
                borderRadius: '4px',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Customer:</span>
                  <strong>{formData.customer_name || 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Order Date:</span>
                  <strong>{formData.order_date}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Delivery Date:</span>
                  <strong>{formData.delivery_date || 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Quantity:</span>
                  <strong>{formData.qty}</strong>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  paddingTop: '10px',
                  borderTop: '1px solid #ddd',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}>
                  <span>Total Amount:</span>
                  <strong style={{ color: '#27ae60' }}>₹{parseFloat(formData.total_amount).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const canProceedToNext = () => {
    if (currentStep === 1) {
      return formData.customer_id && formData.bom_id && formData.qty
    }
    return true
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={handleCancel}>
            <ArrowLeft size={20} />
          </button>
          <div className="page-title-section">
            <h1>{id ? 'Edit Sales Order' : 'New Sales Order'}</h1>
          </div>
        </div>
      </div>

      {success && (
        <div className="alert alert-success" role="alert">
          <AlertCircle size={18} />
          {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="form-container">
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e1e8ed',
          marginBottom: '30px',
          gap: '0'
        }}>
          {steps.map((step) => (
            <div
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              style={{
                flex: 1,
                padding: '15px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                borderBottom: currentStep === step.id ? '3px solid #3498db' : 'none',
                color: currentStep === step.id ? '#3498db' : '#666',
                fontWeight: currentStep === step.id ? 'bold' : 'normal',
                backgroundColor: currentStep === step.id ? '#f0f8ff' : 'transparent',
                transition: 'all 0.3s ease'
              }}
            >
              {step.label}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {renderStepContent()}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '40px',
            paddingTop: '20px',
            borderTop: '1px solid #e1e8ed'
          }}>
            <button
              type="button"
              onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : handleCancel()}
              className="btn btn-secondary"
              disabled={loading}
            >
              ← {currentStep === 1 ? 'Cancel' : 'Previous'}
            </button>

            <div style={{ color: '#666', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Step {currentStep} of {steps.length}
            </div>

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={() => {
                  if (canProceedToNext()) {
                    setCurrentStep(currentStep + 1)
                  } else {
                    setError('Please fill in all required fields')
                  }
                }}
                className="btn btn-primary"
                disabled={loading}
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-success"
                disabled={loading}
              >
                <Save size={18} style={{ marginRight: '8px' }} />
                {id ? 'Update Order' : 'Create Order'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
