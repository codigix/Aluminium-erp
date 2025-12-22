import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  AlertCircle, Plus, Trash2, X, ChevronDown, ChevronUp, 
  Save, RotateCcw, FileText, ArrowLeft, CheckSquare, Square 
} from 'lucide-react'
import * as productionService from '../../services/productionService'
import './Production.css'

export default function BOMForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    productInfo: true,
    materials: true,
    operations: true,
    scrapLoss: false,
    costing: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const [formData, setFormData] = useState({
    bom_id: '',
    item_code: '',
    product_name: '',
    quantity: '1',
    uom: 'Kg',
    status: 'draft',
    revision: '1',
    description: '',
    is_active: true,
    is_default: false,
    allow_alternative_item: false,
    auto_sub_assembly_rate: false,
    project: '',
    cost_rate_based_on: 'Valuation Rate',
    currency: 'INR',
    with_operations: false,
    process_loss_percentage: '0',
    transfer_material_against: 'Work Order',
    routing: ''
  })

  const [bomLines, setBomLines] = useState([])
  const [operations, setOperations] = useState([])
  const [scrapItems, setScrapItems] = useState([])
  
  // New Line States
  const [newLine, setNewLine] = useState({
    item_code: '',
    item_name: '',
    qty: '1',
    uom: 'Kg',
    item_group: 'Select',
    rate: '0',
    warehouse: 'Select'
  })

  const [newOperation, setNewOperation] = useState({
    operation_name: '',
    workstation: 'Select',
    cycle_time: '0',
    setup_time: '0',
    cost: '0',
    target_warehouse: 'Select'
  })

  const [newScrapItem, setNewScrapItem] = useState({
    item_code: '',
    item_name: '',
    qty: '1',
    rate: '0'
  })

  const [operationsList, setOperationsList] = useState([])
  const [workstationsList, setWorkstationsList] = useState([])
  const [warehousesList, setWarehousesList] = useState([])

  useEffect(() => {
    fetchItems()
    fetchOperations()
    fetchWorkstations()
    fetchWarehouses()
    if (id) {
      fetchBOMDetails(id)
    }
  }, [id])

  const fetchItems = async () => {
    try {
      const response = await productionService.getItemsList()
      setItems(response.data || [])
    } catch (err) {
      console.error('Failed to fetch items:', err)
    }
  }

  const fetchOperations = async () => {
    try {
      const response = await productionService.getOperationsList()
      setOperationsList(response.data || [])
    } catch (err) {
      console.error('Failed to fetch operations:', err)
    }
  }

  const fetchWorkstations = async () => {
    try {
      const response = await productionService.getWorkstationsList()
      setWorkstationsList(response.data || [])
    } catch (err) {
      console.error('Failed to fetch workstations:', err)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await productionService.getWarehouses()
      setWarehousesList(response.data || [])
    } catch (err) {
      console.error('Failed to fetch warehouses:', err)
    }
  }

  const fetchBOMDetails = async (bomId) => {
    try {
      const response = await productionService.getBOMDetails(bomId)
      const bom = response.data
      setFormData({
        bom_id: bom.bom_id,
        item_code: bom.item_code,
        product_name: bom.product_name || '',
        quantity: bom.quantity || 1,
        uom: bom.uom || 'Kg',
        status: bom.status || 'draft',
        revision: bom.revision || 1,
        description: bom.description || '',
        is_active: bom.is_active !== false,
        is_default: bom.is_default === true,
        allow_alternative_item: bom.allow_alternative_item === true,
        auto_sub_assembly_rate: bom.auto_sub_assembly_rate === true,
        project: bom.project || '',
        cost_rate_based_on: bom.cost_rate_based_on || 'Valuation Rate',
        currency: bom.currency || 'INR',
        with_operations: bom.with_operations === true,
        process_loss_percentage: bom.process_loss_percentage || 0
      })
      setBomLines(bom.lines || [])
      setOperations(bom.operations || [])
      setScrapItems(bom.scrapItems || [])
    } catch (err) {
      setError('Failed to load BOM details')
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    
    if (name === 'item_code') {
      const selectedItem = items.find(item => item.item_code === value)
      if (selectedItem && !formData.product_name) {
        setFormData(prev => ({
          ...prev,
          product_name: selectedItem.name
        }))
      }
    }
  }

  const handleNewLineChange = (e) => {
    const { name, value } = e.target
    setNewLine(prev => ({ ...prev, [name]: value }))
    
    if (name === 'item_code') {
      const selectedItem = items.find(item => item.item_code === value)
      if (selectedItem) {
        setNewLine(prev => ({
          ...prev,
          item_name: selectedItem.name,
          uom: selectedItem.stock_uom || 'Kg'
        }))
      }
    }
  }

  const handleNewOperationChange = (e) => {
    const { name, value } = e.target
    setNewOperation(prev => ({ ...prev, [name]: value }))
  }

  const handleNewScrapItemChange = (e) => {
    const { name, value } = e.target
    setNewScrapItem(prev => ({ ...prev, [name]: value }))
    
    if (name === 'item_code') {
      const selectedItem = items.find(item => item.item_code === value)
      if (selectedItem) {
        setNewScrapItem(prev => ({
          ...prev,
          item_name: selectedItem.name
        }))
      }
    }
  }

  const addBomLine = () => {
    if (!newLine.item_code) {
      setError('Please select an item code')
      return
    }
    
    const id = `line-${Date.now()}`
    setBomLines([...bomLines, { ...newLine, id }])
    setNewLine({
      item_code: '',
      item_name: '',
      qty: '1',
      uom: 'Kg',
      item_group: 'Select',
      rate: '0',
      warehouse: 'Select'
    })
  }

  const removeBomLine = (id) => {
    setBomLines(bomLines.filter(line => line.id !== id))
  }

  const addOperation = () => {
    if (!newOperation.operation_name) {
      setError('Please select an operation')
      return
    }
    
    const id = `op-${Date.now()}`
    setOperations([...operations, { ...newOperation, id }])
    setNewOperation({
      operation_name: '',
      workstation: 'Select',
      cycle_time: '0',
      setup_time: '0',
      cost: '0',
      target_warehouse: 'Select'
    })
  }

  const removeOperation = (id) => {
    setOperations(operations.filter(op => op.id !== id))
  }

  const addScrapItem = () => {
    if (!newScrapItem.item_code) {
      setError('Please select a scrap item')
      return
    }
    
    const id = `scrap-${Date.now()}`
    setScrapItems([...scrapItems, { ...newScrapItem, id }])
    setNewScrapItem({
      item_code: '',
      item_name: '',
      qty: '1',
      rate: '0'
    })
  }

  const removeScrapItem = (id) => {
    setScrapItems(scrapItems.filter(item => item.id !== id))
  }

  const calculateCosts = () => {
    const materialCost = bomLines.reduce((sum, line) => sum + (parseFloat(line.qty) * parseFloat(line.rate || 0)), 0)
    const operationCost = operations.reduce((sum, op) => sum + parseFloat(op.cost || 0), 0)
    const scrapCost = scrapItems.reduce((sum, item) => sum + (parseFloat(item.qty) * parseFloat(item.rate || 0)), 0)
    const totalCost = materialCost + operationCost + scrapCost
    return { materialCost, operationCost, scrapCost, totalCost }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.item_code) {
      setError('Please select an item code')
      return
    }

    try {
      setLoading(true)
      const submitData = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        process_loss_percentage: parseFloat(formData.process_loss_percentage),
        materials: bomLines,
        operations: operations,
        scrap_items: scrapItems
      }

      if (id) {
        await productionService.updateBOM(id, submitData)
      } else {
        await productionService.createBOM(submitData)
      }

      navigate('/production/boms')
    } catch (err) {
      setError(err.message || 'Failed to save BOM')
    } finally {
      setLoading(false)
    }
  }

  const costs = calculateCosts()

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
          {id ? 'Edit BOM' : 'Create BOM'}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/production/boms')}
          style={{ padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          <ArrowLeft size={18} style={{ display: 'inline', marginRight: '8px' }} />
          Back
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Product Information */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('productInfo')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.productInfo ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#f3f4f6', padding: '6px', borderRadius: '6px' }}>📦</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Product Information</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Basic details</p>
              </div>
            </div>
            {expandedSections.productInfo ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>

          {expandedSections.productInfo && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Item Code *</label>
                  <select 
                    name="item_code" 
                    value={formData.item_code} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  >
                    <option value="">Select item...</option>
                    {items.map(item => (
                      <option key={item.item_code} value={item.item_code}>{item.item_code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Product Name *</label>
                  <input 
                    type="text" 
                    name="product_name" 
                    value={formData.product_name} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Quantity</label>
                  <input 
                    type="number" 
                    name="quantity" 
                    value={formData.quantity} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>UOM</label>
                  <select 
                    name="uom" 
                    value={formData.uom} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  >
                    <option value="Kg">Kg</option>
                    <option value="Nos">Nos</option>
                    <option value="Meter">Meter</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Revision</label>
                  <input 
                    type="text" 
                    name="revision" 
                    value={formData.revision} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Status</label>
                  <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange}
                  rows="3"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="is_active" 
                    checked={formData.is_active} 
                    onChange={handleInputChange}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '13px', color: '#374151' }}>Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="is_default" 
                    checked={formData.is_default} 
                    onChange={handleInputChange}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '13px', color: '#374151' }}>Default</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Materials */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('materials')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.materials ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#fef2f2', padding: '6px', borderRadius: '6px' }}>🧪</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Materials</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{bomLines.length} • ₹{costs.materialCost.toFixed(2)}</p>
              </div>
            </div>
            {expandedSections.materials ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.materials && (
            <div style={{ padding: '24px' }}>
              <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ color: '#991b1b', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>+ Add Raw Material</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Item Code *</label>
                    <select 
                      name="item_code" 
                      value={newLine.item_code} 
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    >
                      <option value="">Search items...</option>
                      {items.map(item => (
                        <option key={item.item_code} value={item.item_code}>{item.item_code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Qty *</label>
                    <input 
                      type="number" 
                      name="qty" 
                      value={newLine.qty} 
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>UOM</label>
                    <select 
                      name="uom" 
                      value={newLine.uom} 
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    >
                      <option value="Kg">Kg</option>
                      <option value="Nos">Nos</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Item Group</label>
                    <select 
                      name="item_group" 
                      value={newLine.item_group} 
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    >
                      <option value="Select">Select</option>
                      <option value="Raw Material">Raw Material</option>
                      <option value="Sub Assembly">Sub Assembly</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Rate (₹)</label>
                    <input 
                      type="number" 
                      name="rate" 
                      value={newLine.rate} 
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Warehouse</label>
                    <select 
                      name="warehouse" 
                      value={newLine.warehouse} 
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    >
                      <option value="Select">Select</option>
                      {warehousesList.map(wh => (
                        <option key={wh.warehouse_code} value={wh.warehouse_code}>{wh.warehouse_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginTop: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>Operation</label>
                    <select 
                      name="operation"
                      value={newLine.operation}
                      onChange={handleNewLineChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px' }}
                    >
                      <option value="Select">Select</option>
                      {operationsList.map(op => (
                        <option key={op.name} value={op.name}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    type="button"
                    onClick={addBomLine}
                    style={{ 
                      backgroundColor: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px', 
                      padding: '8px 24px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      height: '35px'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {bomLines.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Item Code</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Qty</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>UOM</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Group</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Rate</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomLines.map((line) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#1f2937', fontWeight: '500' }}>{line.item_code}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{line.qty}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{line.uom}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{line.item_group}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>₹{line.rate}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>₹{(parseFloat(line.qty) * parseFloat(line.rate || 0)).toFixed(2)}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => removeBomLine(line.id)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Operations */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('operations')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.operations ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#f3e8ff', padding: '6px', borderRadius: '6px' }}>⚙️</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Operations</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{operations.length} • ₹{costs.operationCost.toFixed(2)}</p>
              </div>
            </div>
            {expandedSections.operations ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.operations && (
            <div style={{ padding: '24px' }}>
              <div style={{ backgroundColor: '#faf5ff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ color: '#7e22ce', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>+ Add Operation</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b21a8', marginBottom: '4px' }}>Operation *</label>
                    <select 
                      name="operation_name" 
                      value={newOperation.operation_name} 
                      onChange={handleNewOperationChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e9d5ff', fontSize: '13px' }}
                    >
                      <option value="">Search operations...</option>
                      {operationsList.map(op => (
                        <option key={op.name} value={op.name}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b21a8', marginBottom: '4px' }}>Workstation</label>
                    <select 
                      name="workstation" 
                      value={newOperation.workstation} 
                      onChange={handleNewOperationChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e9d5ff', fontSize: '13px' }}
                    >
                      <option value="Select">Select</option>
                      {workstationsList.map(ws => (
                        <option key={ws.name} value={ws.name}>{ws.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b21a8', marginBottom: '4px' }}>Cycle Time (min)</label>
                    <input 
                      type="number" 
                      name="cycle_time" 
                      value={newOperation.cycle_time} 
                      onChange={handleNewOperationChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e9d5ff', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b21a8', marginBottom: '4px' }}>Setup Time (min)</label>
                    <input 
                      type="number" 
                      name="setup_time" 
                      value={newOperation.setup_time} 
                      onChange={handleNewOperationChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e9d5ff', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b21a8', marginBottom: '4px' }}>Cost (₹)</label>
                    <input 
                      type="number" 
                      name="cost" 
                      value={newOperation.cost} 
                      onChange={handleNewOperationChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e9d5ff', fontSize: '13px' }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={addOperation}
                    style={{ 
                      backgroundColor: '#7c3aed', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px', 
                      padding: '8px 24px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      height: '35px'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {operations.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Operation</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Workstation</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Cycle Time</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Cost</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op) => (
                      <tr key={op.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#1f2937', fontWeight: '500' }}>{op.operation_name}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{op.workstation}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{op.cycle_time}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>₹{op.cost}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => removeOperation(op.id)}
                            style={{ color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Scrap & Loss */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('scrapLoss')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.scrapLoss ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '6px' }}>♻️</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Scrap & Loss</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{scrapItems.length} • ₹{costs.scrapCost.toFixed(2)}</p>
              </div>
            </div>
            {expandedSections.scrapLoss ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.scrapLoss && (
            <div style={{ padding: '24px' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ color: '#166534', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>+ Add Scrap</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>Item Code *</label>
                    <select 
                      name="item_code" 
                      value={newScrapItem.item_code} 
                      onChange={handleNewScrapItemChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px' }}
                    >
                      <option value="">Search items...</option>
                      {items.map(item => (
                        <option key={item.item_code} value={item.item_code}>{item.item_code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>Name</label>
                    <input 
                      type="text" 
                      name="item_name" 
                      value={newScrapItem.item_name} 
                      onChange={handleNewScrapItemChange}
                      disabled
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', backgroundColor: '#f0fdf4' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>Qty *</label>
                    <input 
                      type="number" 
                      name="qty" 
                      value={newScrapItem.qty} 
                      onChange={handleNewScrapItemChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>Rate (₹)</label>
                    <input 
                      type="number" 
                      name="rate" 
                      value={newScrapItem.rate} 
                      onChange={handleNewScrapItemChange}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px' }}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={addScrapItem}
                    style={{ 
                      backgroundColor: '#fbbf24', 
                      color: '#78350f', 
                      border: 'none', 
                      borderRadius: '6px', 
                      padding: '8px 24px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      height: '35px'
                    }}
                  >
                    + Add
                  </button>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>Process Loss %</label>
                  <input 
                    type="number" 
                    name="process_loss_percentage" 
                    value={formData.process_loss_percentage} 
                    onChange={handleInputChange}
                    style={{ width: '100%', maxWidth: '200px', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px' }}
                  />
                  <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Included in BOM cost</p>
                </div>
              </div>

              {scrapItems.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Item Code</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Item Name</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#1f2937', fontWeight: '500' }}>{item.item_code}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.item_name}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{item.qty}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>₹{item.rate}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>₹{(parseFloat(item.qty) * parseFloat(item.rate || 0)).toFixed(2)}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => removeScrapItem(item.id)}
                            style={{ color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* BOM Costing */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('costing')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.costing ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#fef3c7', padding: '6px', borderRadius: '6px' }}>💰</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>BOM Costing</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>₹{costs.totalCost.toFixed(2)} Total Cost</p>
              </div>
            </div>
            {expandedSections.costing ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.costing && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', marginBottom: '4px' }}>Material Cost</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#0c4a6e' }}>₹{costs.materialCost.toFixed(2)}</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '600', marginBottom: '4px' }}>Labour Cost</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#6b21a8' }}>₹{costs.operationCost.toFixed(2)}</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                  <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '600', marginBottom: '4px' }}>Overhead (0%)</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#78350f' }}>₹0.00</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '8px', border: '1px solid #86efac' }}>
                  <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', marginBottom: '4px' }}>Total BOM Cost</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#166534' }}>₹{costs.totalCost.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '12px', lineHeight: '1.8' }}>
                  <div>Components Cost:</div>
                  <div style={{ textAlign: 'right', color: '#374151' }}>₹{costs.materialCost.toFixed(2)}</div>
                  <div>Raw Materials Cost:</div>
                  <div style={{ textAlign: 'right', color: '#374151' }}>₹{costs.materialCost.toFixed(2)}</div>
                  <div>Operations Cost:</div>
                  <div style={{ textAlign: 'right', color: '#374151' }}>₹{costs.operationCost.toFixed(2)}</div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', fontWeight: '600' }}>Cost Per Unit:</div>
                  <div style={{ textAlign: 'right', color: '#1f2937', fontWeight: '600', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>₹{(costs.totalCost / parseFloat(formData.quantity || 1)).toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => navigate('/production/boms')}
            style={{ padding: '12px 24px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Saving...' : 'Save BOM'}
          </button>
        </div>
      </form>
    </div>
  )
}
