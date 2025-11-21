import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import AuditTrail from '../../components/AuditTrail'
import { ChevronLeft, ChevronRight, X, Edit, Trash2 } from 'lucide-react'
import './Buying.css'

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchasing', label: 'Purchasing' },
  { id: 'sales', label: 'Sales' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'tax', label: 'Tax' },
  { id: 'quality', label: 'Quality' },
  { id: 'manufacturing', label: 'Manufacturing' }
]

export default function ItemForm() {
  const { item_code } = useParams()
  const navigate = useNavigate()
  const isEditMode = item_code && item_code !== 'new'

  const [activeTab, setActiveTab] = useState('details')
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editingDimension, setEditingDimension] = useState(null)
  const [editingType, setEditingType] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [editingBarcode, setEditingBarcode] = useState(null)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [barcodeEditData, setBarcodeEditData] = useState({})
  const [supplierEditData, setSupplierEditData] = useState({})

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    item_group: '',
    uom: 'Nos',
    hsn_code: '',
    disabled: false,
    allow_alternative_item: false,
    maintain_stock: true,
    has_variants: false,
    opening_stock: 0,
    valuation_rate: 0,
    valuation_method: 'FIFO',
    standard_selling_rate: 0,
    is_fixed_asset: false,
    shelf_life_in_days: '',
    warranty_period_in_days: '',
    end_of_life: '',
    weight_per_unit: '',
    weight_uom: '',
    allow_negative_stock: false,
    barcode_list: [],
    has_batch_no: false,
    has_serial_no: false,
    automatically_create_batch: false,
    batch_number_series: '',
    has_expiry_date: false,
    retain_sample: false,
    max_sample_quantity: '',
    default_purchase_uom: 'Nos',
    lead_time_days: 0,
    minimum_order_qty: 1,
    safety_stock: 0,
    is_customer_provided_item: false,
    suppliers_list: [],
    default_sales_uom: 'Nos',
    max_discount_percentage: 0,
    grant_commission: false,
    allow_sales: true,
    customer_details: [],
    gst_rate: 0,
    cess_rate: 0,
    inclusive_tax: false,
    supply_raw_materials_for_purchase: false,
    include_item_in_manufacturing: false,
    description: '',
    hsncode: '',
    no_of_cavities: 1,
    family_mould: false,
    mould_number: '',
    gdc_dimensional_parameters: [],
    pdi_dimensional_parameters: [],
    visual_parameters: [],
    machining_dimensional_parameters: [],
    machining_process_parameters: []
  })

  const [itemGroups, setItemGroups] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    fetchDropdownData()
    if (isEditMode) {
      fetchItem()
    }
  }, [])

  const fetchDropdownData = async () => {
    try {
      const [groupsRes, suppliersRes, customersRes] = await Promise.all([
        axios.get('/api/item-groups'),
        axios.get('/api/suppliers?limit=1000'),
        axios.get('/api/customers?limit=1000')
      ])
      
      setItemGroups(groupsRes.data.data || [])
      setSuppliers(suppliersRes.data.data || [])
      setCustomers(customersRes.data.data || [])
    } catch (err) {
      console.error('Failed to fetch dropdown data:', err)
    }
  }

  const fetchItem = async () => {
    try {
      const response = await axios.get(`/api/items/${item_code}`)
      const itemData = response.data.data
      setItem(itemData)
      setFormData(prev => ({
        ...prev,
        ...itemData
      }))
    } catch (err) {
      setError('Failed to fetch item details')
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleAddBarcode = () => {
    setFormData({
      ...formData,
      barcode_list: [...(formData.barcode_list || []), { barcode: '', barcode_name: '', barcode_type: '' }]
    })
  }

  const handleRemoveBarcode = (index) => {
    setFormData({
      ...formData,
      barcode_list: formData.barcode_list.filter((_, i) => i !== index)
    })
  }

  const handleEditBarcode = (index, barcode) => {
    setEditingBarcode(index)
    setBarcodeEditData({ ...barcode })
  }

  const handleSaveBarcode = () => {
    const updated = [...formData.barcode_list]
    updated[editingBarcode] = barcodeEditData
    setFormData({
      ...formData,
      barcode_list: updated
    })
    setEditingBarcode(null)
    setBarcodeEditData({})
  }

  const handleBarcodeCheckboxChange = (index) => {
    const rows = formData.barcode_list.map((row, i) => ({
      ...row,
      selected: i === index ? !row.selected : row.selected
    }))
    setFormData({
      ...formData,
      barcode_list: rows
    })
  }

  const handleDeleteSelectedBarcodes = () => {
    const updated = formData.barcode_list.filter(row => !row.selected)
    setFormData({
      ...formData,
      barcode_list: updated
    })
  }

  const handleAddSupplier = () => {
    setFormData({
      ...formData,
      suppliers_list: [...(formData.suppliers_list || []), { supplier_name: '', supplier_code: '' }]
    })
  }

  const handleEditSupplier = (index, supplier) => {
    setEditingSupplier(index)
    setSupplierEditData({ ...supplier })
  }

  const handleSaveSupplier = () => {
    const updated = [...formData.suppliers_list]
    updated[editingSupplier] = supplierEditData
    setFormData({
      ...formData,
      suppliers_list: updated
    })
    setEditingSupplier(null)
    setSupplierEditData({})
  }

  const handleRemoveSupplier = (index) => {
    setFormData({
      ...formData,
      suppliers_list: formData.suppliers_list.filter((_, i) => i !== index)
    })
  }

  const handleSupplierCheckboxChange = (index) => {
    const rows = formData.suppliers_list.map((row, i) => ({
      ...row,
      selected: i === index ? !row.selected : row.selected
    }))
    setFormData({
      ...formData,
      suppliers_list: rows
    })
  }

  const handleDeleteSelectedSuppliers = () => {
    const updated = formData.suppliers_list.filter(row => !row.selected)
    setFormData({
      ...formData,
      suppliers_list: updated
    })
  }

  const handleAddCustomerDetail = () => {
    setFormData({
      ...formData,
      customer_details: [...(formData.customer_details || []), { customer_name: '', customer_group: '', ref_code: '' }]
    })
  }

  const handleRemoveCustomerDetail = (index) => {
    setFormData({
      ...formData,
      customer_details: formData.customer_details.filter((_, i) => i !== index)
    })
  }

  const handleUpdateCustomerDetail = (index, field, value) => {
    const updated = [...formData.customer_details]
    updated[index][field] = value
    setFormData({
      ...formData,
      customer_details: updated
    })
  }

  const handleAddAutoReorder = () => {
    setFormData({
      ...formData,
      auto_reorder: [...(formData.auto_reorder || []), { warehouse: '', reorder_level: 0, reorder_qty: 0 }]
    })
  }

  const handleRemoveAutoReorder = (index) => {
    setFormData({
      ...formData,
      auto_reorder: formData.auto_reorder.filter((_, i) => i !== index)
    })
  }

  const handleUpdateAutoReorder = (index, field, value) => {
    const updated = [...formData.auto_reorder]
    updated[index][field] = field === 'warehouse' ? value : parseFloat(value) || 0
    setFormData({
      ...formData,
      auto_reorder: updated
    })
  }

  const handleAddDimensionRow = (type) => {
    setFormData({
      ...formData,
      [type]: [...(formData[type] || []), { id: Date.now(), name: '', value: '', status: '' }]
    })
  }

  const handleEditDimension = (type, index, row) => {
    setEditingType(type)
    setEditingDimension(index)
    setEditFormData({ ...row })
  }

  const handleSaveDimension = () => {
    const updated = [...formData[editingType]]
    updated[editingDimension] = editFormData
    setFormData({
      ...formData,
      [editingType]: updated
    })
    setEditingDimension(null)
    setEditingType(null)
    setEditFormData({})
  }

  const handleDeleteDimension = (type, index) => {
    const updated = formData[type].filter((_, i) => i !== index)
    setFormData({
      ...formData,
      [type]: updated
    })
  }

  const handleDimensionCheckboxChange = (type, index) => {
    const rows = formData[type].map((row, i) => ({
      ...row,
      selected: i === index ? !row.selected : row.selected
    }))
    setFormData({
      ...formData,
      [type]: rows
    })
  }

  const handleDeleteSelectedDimensions = (type) => {
    const updated = formData[type].filter(row => !row.selected)
    setFormData({
      ...formData,
      [type]: updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.item_code || !formData.item_name || !formData.item_group) {
      setError('Item Code, Name, and Group are required in Details tab')
      setActiveTab('details')
      return
    }

    try {
      setLoading(true)
      if (isEditMode) {
        await axios.put(`/api/items/${item_code}`, formData)
        setSuccess('Item updated successfully')
      } else {
        await axios.post('/api/items', formData)
        setSuccess('Item created successfully')
      }

      setTimeout(() => navigate('/buying/items'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
  }

  const currentTabIndex = TABS.findIndex(t => t.id === activeTab)

  const renderDimensionTable = (type, title) => (
    <div className="dimension-section">
      <h3>{title}</h3>
      <div className="dimension-table-wrapper">
        {formData[type] && formData[type].length > 0 ? (
          <table className="dimension-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    onChange={() => {}}
                  />
                </th>
                <th style={{ width: '60px' }}>No.</th>
                <th>Parameter</th>
                <th>Value</th>
                <th>Status</th>
                <th style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formData[type].map((row, index) => (
                <tr key={index} className={row.selected ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.selected || false}
                      onChange={() => handleDimensionCheckboxChange(type, index)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{row.name || row.parameter || '-'}</td>
                  <td>{row.value || '-'}</td>
                  <td>{row.status || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon-edit"
                      onClick={() => handleEditDimension(type, index, row)}
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data-message">No parameters added</div>
        )}
      </div>
      <div className="dimension-actions">
        {formData[type] && formData[type].some(r => r.selected) && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => handleDeleteSelectedDimensions(type)}
          >
            Delete Selected
          </Button>
        )}
        <Button
          type="button"
          variant="success"
          size="sm"
          onClick={() => handleAddDimensionRow(type)}
        >
          Add Row
        </Button>
      </div>
    </div>
  )

  const renderDetailsTab = () => (
    <div className="form-section">
      <div className="form-row">
        <div className="form-group">
          <label>Item Code *</label>
          <input
            type="text"
            name="item_code"
            value={formData.item_code}
            onChange={handleChange}
            disabled={isEditMode}
            placeholder="Auto-generated"
            required
          />
        </div>
        <div className="form-group">
          <label>Item Name *</label>
          <input
            type="text"
            name="item_name"
            value={formData.item_name}
            onChange={handleChange}
            placeholder="Enter item name"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Item Group *</label>
          <select
            name="item_group"
            value={formData.item_group}
            onChange={handleChange}
            required
          >
            <option value="">Select Item Group</option>
            {itemGroups.map(group => (
              <option key={group.name} value={group.name}>{group.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Default UOM *</label>
          <input
            type="text"
            name="uom"
            value={formData.uom}
            onChange={handleChange}
            placeholder="e.g., Nos, Kg, Meter"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>HSN Code</label>
          <input
            type="text"
            name="hsn_code"
            value={formData.hsn_code}
            onChange={handleChange}
            placeholder="Enter HSN code"
          />
        </div>
        <div className="form-group">
          <label>No of Cavity</label>
          <input
            type="number"
            name="no_of_cavities"
            value={formData.no_of_cavities}
            onChange={handleChange}
            min="1"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="disabled"
            id="disabled"
            checked={formData.disabled}
            onChange={handleChange}
          />
          <label htmlFor="disabled">Disabled</label>
        </div>
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="allow_alternative_item"
            id="allow_alternative_item"
            checked={formData.allow_alternative_item}
            onChange={handleChange}
          />
          <label htmlFor="allow_alternative_item">Allow Alternative Item</label>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="maintain_stock"
            id="maintain_stock"
            checked={formData.maintain_stock}
            onChange={handleChange}
          />
          <label htmlFor="maintain_stock">Maintain Stock</label>
        </div>
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="has_variants"
            id="has_variants"
            checked={formData.has_variants}
            onChange={handleChange}
          />
          <label htmlFor="has_variants">Has Variants</label>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="family_mould"
            id="family_mould"
            checked={formData.family_mould}
            onChange={handleChange}
          />
          <label htmlFor="family_mould">Family Mould</label>
        </div>
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="is_fixed_asset"
            id="is_fixed_asset"
            checked={formData.is_fixed_asset}
            onChange={handleChange}
          />
          <label htmlFor="is_fixed_asset">Is Fixed Asset</label>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Mould Number</label>
          <input
            type="text"
            name="mould_number"
            value={formData.mould_number}
            onChange={handleChange}
            placeholder="Enter mould number"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group full-width">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter item description"
            rows="3"
          />
        </div>
      </div>

      <hr style={{ margin: 'var(--spacing-4) 0' }} />

      {renderDimensionTable('gdc_dimensional_parameters', 'GDC Dimensional Parameters')}
      {renderDimensionTable('pdi_dimensional_parameters', 'PDI Dimensional Parameters')}
      {renderDimensionTable('visual_parameters', 'Visual Parameters')}
      {renderDimensionTable('machining_dimensional_parameters', 'Machining Dimensional Parameters')}
      {renderDimensionTable('machining_process_parameters', 'Machining Process Parameters')}
    </div>
  )

  const renderInventoryTab = () => (
    <div className="form-section">
      <h3>Inventory Settings</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label>Valuation Method</label>
          <select
            name="valuation_method"
            value={formData.valuation_method}
            onChange={handleChange}
          >
            <option value="FIFO">FIFO</option>
            <option value="Moving Average">Moving Average</option>
            <option value="LIFO">LIFO</option>
          </select>
        </div>
        <div className="form-group">
          <label>Shelf Life In Days</label>
          <input
            type="number"
            name="shelf_life_in_days"
            value={formData.shelf_life_in_days}
            onChange={handleChange}
            placeholder="Days"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Warranty Period (in days)</label>
          <input
            type="number"
            name="warranty_period_in_days"
            value={formData.warranty_period_in_days}
            onChange={handleChange}
            placeholder="Days"
          />
        </div>
        <div className="form-group">
          <label>End of Life</label>
          <input
            type="date"
            name="end_of_life"
            value={formData.end_of_life}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Weight Per Unit</label>
          <input
            type="number"
            name="weight_per_unit"
            value={formData.weight_per_unit}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
          />
        </div>
        <div className="form-group">
          <label>Weight UOM</label>
          <input
            type="text"
            name="weight_uom"
            value={formData.weight_uom}
            onChange={handleChange}
            placeholder="Kg"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="allow_negative_stock"
            id="allow_negative_stock"
            checked={formData.allow_negative_stock}
            onChange={handleChange}
          />
          <label htmlFor="allow_negative_stock">Allow Negative Stock</label>
        </div>
      </div>

      <hr />
      <h3>Barcodes</h3>
      
      <div className="items-section">
        {formData.barcode_list.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" />
                </th>
                <th style={{ width: '60px' }}>No.</th>
                <th>Barcode Name</th>
                <th>Barcode Type</th>
                <th style={{ width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {formData.barcode_list.map((barcode, index) => (
                <tr key={index} className={barcode.selected ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={barcode.selected || false}
                      onChange={() => handleBarcodeCheckboxChange(index)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{barcode.barcode_name || '-'}</td>
                  <td>{barcode.barcode_type || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon-edit"
                      onClick={() => handleEditBarcode(index, barcode)}
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {formData.barcode_list && formData.barcode_list.some(r => r.selected) && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteSelectedBarcodes}
            >
              Delete Selected
            </Button>
          )}
          <Button
            type="button"
            onClick={handleAddBarcode}
            variant="success"
            size="sm"
          >
            Add Row
          </Button>
        </div>
      </div>

      <hr />
      <h3>
        <input
          type="checkbox"
          id="has_batch_no"
          name="has_batch_no"
          checked={formData.has_batch_no}
          onChange={handleChange}
          style={{ marginRight: '8px' }}
        />
        <label htmlFor="has_batch_no" style={{ display: 'inline', cursor: 'pointer' }}>Serial Nos and Batches</label>
      </h3>

      {formData.has_batch_no && (
        <div className="form-section" style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
          <div className="form-row">
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="has_batch_no_opt"
                name="has_batch_no"
                checked={formData.has_batch_no}
                onChange={handleChange}
              />
              <label htmlFor="has_batch_no_opt">Has Batch No</label>
            </div>
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="has_serial_no"
                name="has_serial_no"
                checked={formData.has_serial_no}
                onChange={handleChange}
              />
              <label htmlFor="has_serial_no">Has Serial No</label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="automatically_create_batch"
                name="automatically_create_batch"
                checked={formData.automatically_create_batch}
                onChange={handleChange}
              />
              <label htmlFor="automatically_create_batch">Automatically Create New Batch</label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Batch Number Series</label>
              <input
                type="text"
                name="batch_number_series"
                value={formData.batch_number_series}
                onChange={handleChange}
                placeholder="Example: ABCD.##### . If series is set and Batch No is not mentioned in transactions, then automatic batch number will be created based on this series."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="has_expiry_date"
                name="has_expiry_date"
                checked={formData.has_expiry_date}
                onChange={handleChange}
              />
              <label htmlFor="has_expiry_date">Has Expiry Date</label>
            </div>
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="retain_sample"
                name="retain_sample"
                checked={formData.retain_sample}
                onChange={handleChange}
              />
              <label htmlFor="retain_sample">Retain Sample</label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Max Sample Quantity</label>
              <input
                type="number"
                name="max_sample_quantity"
                value={formData.max_sample_quantity}
                onChange={handleChange}
                placeholder="Maximum sample quantity that can be retained"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderPurchasingTab = () => (
    <div className="form-section">
      <div className="form-row">
        <div className="form-group">
          <label>Default Purchase Unit of Measure</label>
          <input
            type="text"
            name="default_purchase_uom"
            value={formData.default_purchase_uom}
            onChange={handleChange}
            placeholder="e.g., Nos, Kg"
          />
        </div>
        <div className="form-group">
          <label>Lead Time in days</label>
          <input
            type="number"
            name="lead_time_days"
            value={formData.lead_time_days}
            onChange={handleChange}
            placeholder="0"
            min="0"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Minimum Order Qty</label>
          <input
            type="number"
            name="minimum_order_qty"
            value={formData.minimum_order_qty}
            onChange={handleChange}
            placeholder="1"
            min="0"
            step="0.01"
          />
        </div>
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="is_customer_provided_item"
            id="is_customer_provided_item"
            checked={formData.is_customer_provided_item}
            onChange={handleChange}
          />
          <label htmlFor="is_customer_provided_item">Is Customer Provided Item</label>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Safety Stock</label>
          <input
            type="number"
            name="safety_stock"
            value={formData.safety_stock}
            onChange={handleChange}
            placeholder="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="form-group checkbox">
        <input
          type="checkbox"
          name="supply_raw_materials_for_purchase"
          id="supply_raw_materials"
          checked={formData.supply_raw_materials_for_purchase}
          onChange={handleChange}
        />
        <label htmlFor="supply_raw_materials">Supply Raw Materials for Purchase - If subcontracted to a vendor</label>
      </div>

      <hr />
      <h3>Suppliers</h3>
      
      <div className="items-section">
        {formData.suppliers_list.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" />
                </th>
                <th style={{ width: '60px' }}>No.</th>
                <th>Supplier Name</th>
                <th>Supplier Code</th>
                <th style={{ width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {formData.suppliers_list.map((supplier, index) => (
                <tr key={index} className={supplier.selected ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={supplier.selected || false}
                      onChange={() => handleSupplierCheckboxChange(index)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{supplier.supplier_name || '-'}</td>
                  <td>{supplier.supplier_code || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon-edit"
                      onClick={() => handleEditSupplier(index, supplier)}
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {formData.suppliers_list && formData.suppliers_list.some(r => r.selected) && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteSelectedSuppliers}
            >
              Delete Selected
            </Button>
          )}
          <Button
            type="button"
            onClick={handleAddSupplier}
            variant="success"
            size="sm"
          >
            Add Row
          </Button>
        </div>
      </div>
    </div>
  )

  const renderSalesTab = () => (
    <div className="form-section">
      <div className="form-row">
        <div className="form-group">
          <label>Default Sales Unit of Measure</label>
          <input
            type="text"
            name="default_sales_uom"
            value={formData.default_sales_uom}
            onChange={handleChange}
            placeholder="e.g., Nos, Kg"
          />
        </div>
        <div className="form-group">
          <label>Max Discount (%)</label>
          <input
            type="number"
            name="max_discount_percentage"
            value={formData.max_discount_percentage}
            onChange={handleChange}
            placeholder="0"
            min="0"
            max="100"
            step="0.01"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="grant_commission"
            id="grant_commission"
            checked={formData.grant_commission}
            onChange={handleChange}
          />
          <label htmlFor="grant_commission">Grant Commission</label>
        </div>
        <div className="form-group checkbox">
          <input
            type="checkbox"
            name="allow_sales"
            id="allow_sales"
            checked={formData.allow_sales}
            onChange={handleChange}
          />
          <label htmlFor="allow_sales">Allow Sales</label>
        </div>
      </div>
    </div>
  )

  const renderAccountingTab = () => (
    <div className="form-section">
      <div className="form-row">
        <div className="form-group">
          <label>Opening Stock</label>
          <input
            type="number"
            name="opening_stock"
            value={formData.opening_stock}
            onChange={handleChange}
            placeholder="0"
            step="0.01"
          />
        </div>
        <div className="form-group">
          <label>Valuation Rate</label>
          <input
            type="number"
            name="valuation_rate"
            value={formData.valuation_rate}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Standard Selling Rate</label>
          <input
            type="number"
            name="standard_selling_rate"
            value={formData.standard_selling_rate}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
          />
        </div>
      </div>
    </div>
  )

  const renderTaxTab = () => (
    <div className="form-section">
      <div className="form-row">
        <div className="form-group">
          <label>GST Rate (%)</label>
          <input
            type="number"
            name="gst_rate"
            value={formData.gst_rate}
            onChange={handleChange}
            placeholder="0"
            min="0"
            max="100"
            step="0.01"
          />
        </div>
        <div className="form-group">
          <label>Cess Rate (%)</label>
          <input
            type="number"
            name="cess_rate"
            value={formData.cess_rate}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="form-group checkbox">
        <input
          type="checkbox"
          name="inclusive_tax"
          id="inclusive_tax"
          checked={formData.inclusive_tax}
          onChange={handleChange}
        />
        <label htmlFor="inclusive_tax">Inclusive Tax</label>
      </div>
    </div>
  )

  const renderQualityTab = () => (
    <div className="form-section">
      <div className="form-row">
        <div className="form-group">
          <label>Quality Control Required</label>
          <input
            type="checkbox"
            id="quality_control"
            placeholder="Quality control settings"
          />
        </div>
      </div>
      <p className="text-neutral-500 text-sm">Quality control features can be configured here</p>
    </div>
  )

  const renderManufacturingTab = () => (
    <div className="form-section">
      <div className="form-group checkbox">
        <input
          type="checkbox"
          name="include_item_in_manufacturing"
          id="include_item_in_manufacturing"
          checked={formData.include_item_in_manufacturing}
          onChange={handleChange}
        />
        <label htmlFor="include_item_in_manufacturing">Include Item In Manufacturing</label>
      </div>

      <div className="form-group checkbox">
        <input
          type="checkbox"
          name="supply_raw_materials_for_purchase"
          id="supply_raw_materials_mfg"
          checked={formData.supply_raw_materials_for_purchase}
          onChange={handleChange}
        />
        <label htmlFor="supply_raw_materials_mfg">Supply Raw Materials for Purchase - If subcontracted to a vendor</label>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return renderDetailsTab()
      case 'inventory':
        return renderInventoryTab()
      case 'purchasing':
        return renderPurchasingTab()
      case 'sales':
        return renderSalesTab()
      case 'accounting':
        return renderAccountingTab()
      case 'tax':
        return renderTaxTab()
      case 'quality':
        return renderQualityTab()
      case 'manufacturing':
        return renderManufacturingTab()
      default:
        return null
    }
  }

  return (
    <div className="buying-container">
      <Card>
        <div className="page-header">
          <h2>{isEditMode ? 'Edit Item' : 'Create Item'}</h2>
          <Button 
            onClick={() => navigate('/buying/items')}
            variant="secondary"
          >
            Back
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {isEditMode && item && (
          <AuditTrail 
            createdAt={item.created_at}
            createdBy={item.created_by}
            updatedAt={item.updated_at}
            updatedBy={item.updated_by}
          />
        )}

        <div className="tab-wizard-container">
          <div className="tab-wizard-header">
            <div className="tab-wizard-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-wizard-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <span className="tab-wizard-dot"></span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="tab-wizard-content">
            {renderTabContent()}

            <div className="form-actions">
              <div></div>
              <div className="flex gap-2">
                <Button 
                  type="submit"
                  variant="primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/buying/items')}
                >
                  Cancel
                </Button>
              </div>
              <div></div>
            </div>
          </form>
        </div>

        {editingDimension !== null && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Edit Parameter</h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setEditingDimension(null)
                    setEditingType(null)
                    setEditFormData({})
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Parameter Name</label>
                  <input
                    type="text"
                    value={editFormData.name || editFormData.parameter || ''}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      name: e.target.value,
                      parameter: e.target.value
                    })}
                    placeholder="Enter parameter name"
                  />
                </div>
                <div className="form-group">
                  <label>Value</label>
                  <input
                    type="text"
                    value={editFormData.value || ''}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      value: e.target.value
                    })}
                    placeholder="Enter value"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editFormData.status || ''}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      status: e.target.value
                    })}
                  >
                    <option value="">Select Status</option>
                    <option value="Match">Match</option>
                    <option value="No Match">No Match</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingDimension(null)
                    setEditingType(null)
                    setEditFormData({})
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveDimension}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {editingBarcode !== null && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Edit Barcode</h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setEditingBarcode(null)
                    setBarcodeEditData({})
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Barcode</label>
                  <input
                    type="text"
                    value={barcodeEditData.barcode || ''}
                    onChange={(e) => setBarcodeEditData({
                      ...barcodeEditData,
                      barcode: e.target.value
                    })}
                    placeholder="Enter barcode"
                  />
                </div>
                <div className="form-group">
                  <label>Barcode Name</label>
                  <input
                    type="text"
                    value={barcodeEditData.barcode_name || ''}
                    onChange={(e) => setBarcodeEditData({
                      ...barcodeEditData,
                      barcode_name: e.target.value
                    })}
                    placeholder="Enter barcode name"
                  />
                </div>
                <div className="form-group">
                  <label>Barcode Type</label>
                  <select
                    value={barcodeEditData.barcode_type || ''}
                    onChange={(e) => setBarcodeEditData({
                      ...barcodeEditData,
                      barcode_type: e.target.value
                    })}
                  >
                    <option value="">Select Barcode Type</option>
                    <option value="EAN">EAN</option>
                    <option value="CODE128">CODE128</option>
                    <option value="CODE39">CODE39</option>
                    <option value="QR">QR</option>
                    <option value="UPC">UPC</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingBarcode(null)
                    setBarcodeEditData({})
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveBarcode}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {editingSupplier !== null && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Edit Supplier</h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setEditingSupplier(null)
                    setSupplierEditData({})
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Supplier Name</label>
                  <select
                    value={supplierEditData.supplier_name || ''}
                    onChange={(e) => setSupplierEditData({
                      ...supplierEditData,
                      supplier_name: e.target.value
                    })}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(supp => (
                      <option key={supp.supplier_id} value={supp.supplier_name}>{supp.supplier_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Supplier Code</label>
                  <input
                    type="text"
                    value={supplierEditData.supplier_code || ''}
                    onChange={(e) => setSupplierEditData({
                      ...supplierEditData,
                      supplier_code: e.target.value
                    })}
                    placeholder="Enter supplier code"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingSupplier(null)
                    setSupplierEditData({})
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveSupplier}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
