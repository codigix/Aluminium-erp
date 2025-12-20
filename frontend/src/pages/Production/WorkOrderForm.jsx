import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, Clipboard, Settings, Calendar } from 'lucide-react'
import * as productionService from '../../services/productionService'
import './Production.css'

export default function WorkOrderForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [items, setItems] = useState([])
  const [bomsData, setBOMsData] = useState([])
  const [requiredItems, setRequiredItems] = useState([])
  const [operationsData, setOperationsData] = useState([])
  const [warehouses, setWarehouses] = useState([])
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    basicDetails: true,
    operations: true,
    requiredItems: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const [formData, setFormData] = useState({
    series: 'MFG-WO-.YYYY.-',
    company: 'codigix infotech',
    item_to_manufacture: '',
    bom_no: '',
    qty_to_manufacture: '1',
    project: '',
    sales_order: '',
    source_warehouse: '',
    target_warehouse: '',
    wip_warehouse: '',
    scrap_warehouse: '',
    allow_alternative_item: false,
    use_multi_level_bom: true,
    skip_material_transfer_to_wip: false,
    update_consumed_material_cost: true,
    priority: 'Medium',
    notes: '',
    planned_start_date: new Date().toISOString().split('T')[0],
    planned_end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    expected_delivery_date: ''
  })

  useEffect(() => {
    fetchItems()
    fetchBOMs()
    fetchWarehouses()
    if (id) {
      fetchWorkOrderDetails(id)
    }
  }, [id])

  const fetchItems = async () => {
    try {
      const response = await productionService.getItemsList()
      const itemsData = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : [])
      setItems(itemsData)
    } catch (err) {
      console.error('Failed to fetch items:', err)
    }
  }

  const fetchBOMs = async () => {
    try {
      const response = await productionService.getBOMs({ status: 'active' })
      const bomsData = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : [])
      setBOMsData(bomsData)
    } catch (err) {
      console.error('Failed to fetch BOMs:', err)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await productionService.getWarehouses()
      const warehouseList = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : [])
      const warehouseOptions = warehouseList.map(wh => ({
        label: `${wh.warehouse_name || wh.name}`,
        value: wh.warehouse_name || wh.name
      }))
      setWarehouses(warehouseOptions)
    } catch (err) {
      console.error('Failed to fetch warehouses:', err)
    }
  }

  const fetchWorkOrderDetails = async (workOrderId) => {
    try {
      const response = await productionService.getWorkOrder(workOrderId)
      const workOrderData = response.data || response
      
      if (workOrderData && typeof workOrderData === 'object') {
        setFormData(prev => ({
          ...prev,
          ...workOrderData,
          planned_start_date: workOrderData.planned_start_date ? new Date(workOrderData.planned_start_date).toISOString().split('T')[0] : '',
          planned_end_date: workOrderData.planned_end_date ? new Date(workOrderData.planned_end_date).toISOString().split('T')[0] : ''
        }))
      }
    } catch (err) {
      console.error('Failed to fetch work order details:', err)
      setError(`Failed to load work order details: ${err.response?.data?.message || err.message}`)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    setError(null)

    if (name === 'item_to_manufacture' && value) {
      fetchBOMsForItem(value)
    }

    if (name === 'bom_no' && value) {
      fetchBOMDetailsAndPopulate(value)
    }
  }

  const fetchBOMsForItem = async (itemCode) => {
    try {
      setLoading(true)
      const response = await productionService.getBOMs({ item_code: itemCode, status: 'active' })
      const bomsForItem = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : [])
      
      if (bomsForItem.length > 0) {
        const firstBOM = bomsForItem[0]
        setFormData(prev => ({
          ...prev,
          bom_no: firstBOM.bom_id
        }))
        
        await fetchBOMDetailsAndPopulate(firstBOM.bom_id)
      } else {
        setFormData(prev => ({
          ...prev,
          bom_no: ''
        }))
        setRequiredItems([])
        setOperationsData([])
      }
      setError(null)
    } catch (err) {
      console.error('Failed to fetch BOMs for item:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBOMDetailsAndPopulate = async (bomId) => {
    try {
      setLoading(true)
      const response = await productionService.getBOMDetails(bomId)
      const bomData = response.data || response

      if (bomData && bomData.lines && Array.isArray(bomData.lines)) {
        const requiredItemsFromBOM = bomData.lines.map(line => ({
          id: Date.now() + Math.random(),
          item_code: line.component_code,
          source_warehouse: 'Stores', // Default
          required_qty: line.quantity,
          transferred_qty: '0.000',
          consumed_qty: '0.000',
          returned_qty: '0.000'
        }))
        setRequiredItems(requiredItemsFromBOM)
      }

      if (bomData.operations && Array.isArray(bomData.operations)) {
        const operationsFromBOM = bomData.operations.map(op => ({
          id: Date.now() + Math.random(),
          operation: op.operation_name || op.operation,
          completed_qty: '0.000',
          process_loss_qty: '0.000',
          bom: bomData.bom_id,
          workstation: op.workstation || '',
          time: op.time || '4.00' // Default or from BOM
        }))
        setOperationsData(operationsFromBOM)
      }

      setError(null)
    } catch (err) {
      console.error('Failed to fetch BOM details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...formData,
        required_items: requiredItems,
        operations: operationsData
      }

      if (id) {
        await productionService.updateWorkOrder(id, payload)
        setSuccess('Work order updated successfully')
      } else {
        await productionService.createWorkOrder(payload)
        setSuccess('Work order created successfully')
      }

      setTimeout(() => {
        navigate('/production/work-orders')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to save work order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="production-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#3b82f6', padding: '10px', borderRadius: '8px', color: 'white' }}>
            <Clipboard size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              {id ? 'Edit Work Order' : 'Create Work Order'}
            </h1>
          </div>
        </div>
        <button onClick={() => navigate('/production/work-orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
          <X size={24} />
        </button>
      </div>

      {success && <div className="alert alert-success">✓ {success}</div>}
      {error && <div className="alert alert-error">✕ {error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Basic Details */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Item to Manufacture *</label>
              <select 
                name="item_to_manufacture" 
                value={formData.item_to_manufacture} 
                onChange={handleInputChange}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
                required
              >
                <option value="">Select Item</option>
                {items.map(item => (
                  <option key={item.item_code} value={item.item_code}>{item.item_code} - {item.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Quantity to Manufacture *</label>
              <input 
                type="number" 
                name="qty_to_manufacture" 
                value={formData.qty_to_manufacture} 
                onChange={handleInputChange}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Sales Order ID</label>
              <input 
                type="text" 
                name="sales_order" 
                value={formData.sales_order} 
                onChange={handleInputChange}
                placeholder="Optional"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>BOM ID *</label>
              <select 
                name="bom_no" 
                value={formData.bom_no} 
                onChange={handleInputChange}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
                required
              >
                <option value="">Select BOM</option>
                {bomsData.map(bom => (
                  <option key={bom.bom_id} value={bom.bom_id}>{bom.bom_id} ({bom.status})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Priority</label>
              <select 
                name="priority" 
                value={formData.priority} 
                onChange={handleInputChange}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Planned Start Date</label>
              <input 
                type="date" 
                name="planned_start_date" 
                value={formData.planned_start_date} 
                onChange={handleInputChange}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Planned End Date</label>
            <input 
              type="date" 
              name="planned_end_date" 
              value={formData.planned_end_date} 
              onChange={handleInputChange}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Notes</label>
            <textarea 
              name="notes" 
              value={formData.notes} 
              onChange={handleInputChange}
              placeholder="Enter any additional notes..."
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', minHeight: '80px' }}
            />
          </div>
        </div>

        {/* Operations */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('operations')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.operations ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px' }}>⚙️</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Operations</h3>
            </div>
            {expandedSections.operations ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.operations && (
            <div style={{ padding: '24px' }}>
              {operationsData.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>No.</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Operation *</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Completed Qty</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Process Loss Qty</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>BOM</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Workstation</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Time *</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationsData.map((op, index) => (
                      <tr key={op.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#374151' }}>{index + 1}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{op.operation}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <input type="number" value={op.completed_qty} style={{ width: '60px', padding: '4px', border: '1px solid #e5e7eb', borderRadius: '4px' }} readOnly />
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <input type="number" value={op.process_loss_qty} style={{ width: '60px', padding: '4px', border: '1px solid #e5e7eb', borderRadius: '4px' }} readOnly />
                        </td>
                        <td style={{ padding: '12px', color: '#374151' }}>{op.bom}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{op.workstation}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <input type="number" value={op.time} style={{ width: '60px', padding: '4px', border: '1px solid #e5e7eb', borderRadius: '4px' }} readOnly />
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button type="button" style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic' }}>No operations found.</p>
              )}
            </div>
          )}
        </div>

        {/* Required Items */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('requiredItems')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.requiredItems ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#f3e8ff', padding: '6px', borderRadius: '6px' }}>🧱</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Required Items</h3>
            </div>
            {expandedSections.requiredItems ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.requiredItems && (
            <div style={{ padding: '24px' }}>
              {requiredItems.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>No.</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Item Code</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Source Warehouse</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Required Qty</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Transferred Qty</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Consumed Qty</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Returned Qty</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredItems.map((item, index) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#374151' }}>{index + 1}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.item_code}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.source_warehouse}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{parseFloat(item.required_qty).toFixed(6)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{item.transferred_qty}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{item.consumed_qty}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{item.returned_qty}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button type="button" style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic' }}>No required items found.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px', paddingBottom: '40px' }}>
          <button 
            type="button"
            onClick={() => navigate('/production/work-orders')}
            style={{ 
              padding: '10px 24px', 
              borderRadius: '6px', 
              border: '1px solid #d1d5db', 
              background: 'white',
              color: '#374151',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading}
            style={{ 
              padding: '10px 32px', 
              borderRadius: '6px', 
              border: 'none', 
              background: '#3b82f6',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Save size={16} /> {loading ? 'Saving...' : 'Save Work Order'}
          </button>
        </div>
      </form>
    </div>
  )
}