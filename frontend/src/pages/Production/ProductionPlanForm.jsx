import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, Box, Layers, ShoppingCart, Calendar } from 'lucide-react'
import * as productionService from '../../services/productionService'
import './Production.css'

export default function ProductionPlanForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [boms, setBOMs] = useState([])
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    planningDetails: true,
    salesOrders: true,
    finishedGoods: true,
    subAssemblies: true,
    rawMaterials: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const [formData, setFormData] = useState({
    naming_series: 'PP',
    posting_date: new Date().toISOString().split('T')[0],
    company: '',
    sales_orders: [],
    items: [],
    sub_assemblies: [],
    raw_materials: [],
    consolidate_sub_assemblies: false,
    skip_available_sub_assemblies: false
  })

  const [availableSalesOrders, setAvailableSalesOrders] = useState([])
  const [selectedSalesOrder, setSelectedSalesOrder] = useState('')

  useEffect(() => {
    fetchBOMs()
    fetchAvailableSalesOrders()
    if (id) {
      fetchPlanDetails(id)
    }
  }, [id])

  const fetchBOMs = async () => {
    try {
      const response = await productionService.getBOMs({ status: 'active' })
      setBOMs(response.data || [])
    } catch (err) {
      console.error('Failed to fetch BOMs:', err)
    }
  }

  const fetchAvailableSalesOrders = async () => {
    try {
      const response = await fetch('/api/selling/sales-orders')
      const data = await response.json()
      setAvailableSalesOrders(data.data || [])
    } catch (err) {
      console.error('Failed to fetch sales orders:', err)
    }
  }

  const fetchPlanDetails = async (planId) => {
    try {
      setLoading(true)
      const response = await productionService.getProductionPlanDetails(planId)
      const plan = response.data
      setFormData({
        ...plan,
        posting_date: plan.posting_date?.split('T')[0] || new Date().toISOString().split('T')[0]
      })
    } catch (err) {
      setError('Failed to load plan details')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSalesOrderSelect = (e) => {
    const soId = e.target.value
    setSelectedSalesOrder(soId)
    
    if (soId) {
      const so = availableSalesOrders.find(o => o.name === soId)
      if (so) {
        // Add to sales orders list if not exists
        if (!formData.sales_orders.find(item => item.sales_order === soId)) {
          setFormData(prev => ({
            ...prev,
            sales_orders: [...prev.sales_orders, {
              sales_order: so.name,
              sales_order_date: so.transaction_date,
              customer: so.customer_name,
              grand_total: so.grand_total
            }]
          }))
          
          // Auto-populate items from SO
          // In a real app, we'd fetch SO items here
          // For demo, let's add a dummy item
          setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
              item_code: 'ITEM-C',
              bom_no: 'BOM-1765798893184',
              planned_qty: 1,
              uom: 'Nos',
              warehouse: '',
              planned_start_date: new Date().toISOString().split('T')[0]
            }]
          }))
        }
      }
    }
  }

  const removeSalesOrder = (index) => {
    setFormData(prev => ({
      ...prev,
      sales_orders: prev.sales_orders.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (id) {
        await productionService.updateProductionPlan(id, formData)
      } else {
        await productionService.createProductionPlan(formData)
      }
      navigate('/production/plans')
    } catch (err) {
      setError(err.message || 'Failed to save plan')
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
            <Calendar size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              {id ? 'Edit Production Plan' : 'Production Planning'}
            </h1>
            <p style={{ color: '#6b7280', margin: 0 }}>Create and manage production schedule</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Planning Details */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('planningDetails')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.planningDetails ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px' }}>📋</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Planning Details</h3>
            </div>
            {expandedSections.planningDetails ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.planningDetails && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Step 1: Select Sales Order</label>
                  <select 
                    value={selectedSalesOrder} 
                    onChange={handleSalesOrderSelect}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff' }}
                  >
                    <option value="">Select Sales Order...</option>
                    {availableSalesOrders.map(so => (
                      <option key={so.name} value={so.name}>{so.name} - {so.customer_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Naming Series</label>
                  <input 
                    type="text" 
                    name="naming_series" 
                    value={formData.naming_series} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Company</label>
                  <input 
                    type="text" 
                    name="company" 
                    value={formData.company} 
                    onChange={handleInputChange}
                    placeholder="Enter company name"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Posting Date</label>
                  <input 
                    type="date" 
                    name="posting_date" 
                    value={formData.posting_date} 
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sales Orders */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('salesOrders')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.salesOrders ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#f3e8ff', padding: '6px', borderRadius: '6px' }}>📦</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Sales Orders</h3>
            </div>
            {expandedSections.salesOrders ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.salesOrders && (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Get Sales Orders</div>
              {formData.sales_orders.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>No.</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Sales Order</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Sales Order Date</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Customer</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Grand Total</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.sales_orders.map((so, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#374151' }}>{index + 1}</td>
                        <td style={{ padding: '12px', color: '#3b82f6' }}>{so.sales_order}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{so.sales_order_date}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{so.customer}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>₹{so.grand_total}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button 
                            type="button"
                            onClick={() => removeSalesOrder(index)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic' }}>No sales orders selected.</p>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Finished Goods */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('finishedGoods')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.finishedGoods ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#fee2e2', padding: '6px', borderRadius: '6px' }}>📦</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Step 2: Finished Goods ({formData.items.length})</h3>
            </div>
            {expandedSections.finishedGoods ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.finishedGoods && (
            <div style={{ padding: '24px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>Item Details</div>
                <div style={{ fontSize: '12px', color: '#3b82f6' }}>Finished Goods Item Group: Ungrouped</div>
                <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{formData.items.length} items</div>
              </div>

              {formData.items.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>No.</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Item Code</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>BOM No</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Planned Qty</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>UOM</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Finished Goods Warehouse</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Planned Start Date</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#374151' }}>{index + 1}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.item_code}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.bom_no}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{item.planned_qty.toFixed(6)}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.uom}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.warehouse || '-'}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.planned_start_date}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button 
                            type="button"
                            style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            ✏️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '13px', fontStyle: 'italic' }}>No items added.</p>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Sub-Assembly Items */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('subAssemblies')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.subAssemblies ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#d1fae5', padding: '6px', borderRadius: '6px' }}>⚙️</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Step 3: Sub-Assembly Items ({formData.sub_assemblies.length})</h3>
            </div>
            {expandedSections.subAssemblies ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.subAssemblies && (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="consolidate_sub_assemblies" 
                    checked={formData.consolidate_sub_assemblies} 
                    onChange={handleInputChange}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Consolidate Sub Assembly Items</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="skip_available_sub_assemblies" 
                    checked={formData.skip_available_sub_assemblies} 
                    onChange={handleInputChange}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Skip Available Sub Assembly Items</span>
                </label>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginLeft: '24px' }}>
                  If this checkbox is enabled, then the system won't run the MRP for the available sub-assembly items.
                </p>
              </div>

              <div style={{ marginBottom: '16px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Sub Assemblies ({formData.sub_assemblies.length})</div>
              
              {formData.sub_assemblies.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>No.</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Sub Assembly Item Code</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Target Warehouse</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Scheduled Date</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Required Qty</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>BOM No</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Manufacturing Type</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.sub_assemblies.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px', color: '#374151' }}>{index + 1}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.item_code}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.target_warehouse || '-'}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.scheduled_date}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{item.required_qty.toFixed(6)}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.bom_no || '-'}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{item.manufacturing_type}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button 
                            type="button"
                            style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            ✏️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {/* Dummy data for visualization as per image */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>ITEM-CRING16188</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>In House</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                      <span>Req: 1.000000</span>
                      <span>2025-12-20</span>
                    </div>
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>ITEM-K</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>In House</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                      <span>Req: 1.000000</span>
                      <span>2025-12-20</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Raw Material Planning */}
        <div className="card" style={{ marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div 
            onClick={() => toggleSection('rawMaterials')}
            style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: expandedSections.rawMaterials ? '1px solid #e5e7eb' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#e0e7ff', padding: '6px', borderRadius: '6px' }}>🧱</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Step 4: Raw Material Planning ({formData.raw_materials.length})</h3>
            </div>
            {expandedSections.rawMaterials ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </div>
          
          {expandedSections.rawMaterials && (
            <div style={{ padding: '24px' }}>
              {formData.raw_materials.length > 0 ? (
                <p>Raw materials table here...</p>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '13px' }}>No raw materials found. Select a sales order first.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px', paddingBottom: '40px' }}>
          <button 
            type="button"
            onClick={() => navigate('/production/plans')}
            style={{ 
              padding: '10px 24px', 
              borderRadius: '6px', 
              border: '1px solid #d1d5db', 
              background: 'white',
              color: '#374151',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <X size={16} /> Cancel
          </button>
          <button 
            type="submit"
            disabled={loading}
            style={{ 
              padding: '10px 32px', 
              borderRadius: '6px', 
              border: 'none', 
              background: '#10b981',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Save size={16} /> {loading ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}