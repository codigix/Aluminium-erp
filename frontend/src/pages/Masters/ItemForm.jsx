import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import axios from 'axios'
import Alert from '../../components/Alert/Alert'
import SearchableSelect from '../../components/SearchableSelect'
import { useToast } from '../../components/ToastContainer'
import '../Buying/Buying.css'

export default function ItemForm() {
  const { item_code } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const isEditMode = item_code && item_code !== 'new'
  
  const getBasePath = () => {
    if (location.pathname.includes('/masters')) return '/masters/items'
    if (location.pathname.includes('/buying')) return '/buying/items'
    return '/masters/items'
  }
  
  const basePath = getBasePath()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    item_group: '',
    uom: 'Nos',
    valuation_rate: 0,
    no_of_cavities: 1,
    weight_per_unit: '',
    weight_uom: '',
    drawing_no: '',
    revision: '',
    material_grade: '',
    barcode_list: [],
    // Keep other fields for compatibility if needed, or just minimal
    disabled: false,
    maintain_stock: true,
    has_variants: false,
    opening_stock: 0,
    valuation_method: 'FIFO',
    standard_selling_rate: 0,
    is_fixed_asset: false,
    allow_negative_stock: false,
    has_batch_no: false,
    has_serial_no: false,
    automatically_create_batch: false,
    has_expiry_date: false,
    retain_sample: false,
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
    hsn_code: '',
    family_mould: false,
    mould_number: '',
    gdc_dimensional_parameters: [],
    pdi_dimensional_parameters: [],
    visual_parameters: [],
    machining_dimensional_parameters: [],
    machining_process_parameters: []
  })

  const [itemGroups, setItemGroups] = useState([])
  const [uomList, setUomList] = useState([])

  const STATIC_ITEM_GROUPS = [
    'Finished Goods',
    'Raw Material',
    'Sub Assemblies',
    'Consumable',
    'Mould',
    'Products',
    'Services',
    'SET'
  ]

  const STATIC_UOMS = [
    'Nos',
    'Kg',
    'Meter',
    'Litre',
    'Box',
    'Bar',
    'Set'
  ]

  useEffect(() => {
    fetchDropdownData()
    if (isEditMode) {
      fetchItem()
    }
  }, [])

  useEffect(() => {
    if (!isEditMode && formData.item_name && !formData.item_code) {
      const generatedCode = generateItemCode(formData.item_name)
      setFormData(prev => ({
        ...prev,
        item_code: generatedCode
      }))
    }
  }, [formData.item_name, isEditMode])

  const generateItemCode = (itemName) => {
    const cleaned = itemName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 20)

    return cleaned ? `ITEM-${cleaned}` : `ITEM-${Date.now()}`
  }

  const fetchDropdownData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const [groupsRes, uomRes] = await Promise.all([
        axios.get(`${apiUrl}/items/groups`),
        axios.get(`${apiUrl}/uom?limit=1000`).catch(() => ({ data: { data: [] } }))
      ])

      const groups = groupsRes.data.data || []
      const validGroups = groups.filter(g => g !== null && g !== undefined && g !== '')
      
      // Merge static groups with API groups, removing duplicates
      const apiGroupNames = validGroups.map(g => typeof g === 'object' ? (g.name || g.item_group || '') : String(g))
      const allGroupNames = [...new Set([...STATIC_ITEM_GROUPS, ...apiGroupNames])].filter(Boolean)
      
      setItemGroups(allGroupNames.map(g => ({ label: g, value: g })))

      const uoms = uomRes.data.data || []
      const validUoms = uoms.filter(u => u !== null && u !== undefined)

      // Merge static UOMs with API UOMs, removing duplicates
      const apiUomNames = validUoms.map(u => typeof u === 'object' ? (u.name || u.uom || '') : String(u))
      const allUomNames = [...new Set([...STATIC_UOMS, ...apiUomNames])].filter(Boolean)

      setUomList(allUomNames.map(u => ({ label: u, value: u })))
    } catch (err) {
      console.error('Failed to fetch dropdown data:', err)
      // Fallback to static lists if API fails
      setItemGroups(STATIC_ITEM_GROUPS.map(g => ({ label: g, value: g })))
      setUomList(STATIC_UOMS.map(u => ({ label: u, value: u })))
    }
  }

  const fetchItem = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/items/${item_code}`)
      const itemData = response.data.data
      setItem(itemData)
      setFormData(prev => ({
        ...prev,
        ...itemData,
        item_name: itemData.name || itemData.item_name || ''
      }))
    } catch (err) {
      setError('Failed to fetch item details')
      console.error('Error fetching item:', err)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleGenerateEAN = () => {
    const ean = '890' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    setFormData(prev => ({
      ...prev,
      barcode_list: [...(prev.barcode_list || []), { barcode: ean, barcode_type: 'EAN', barcode_name: 'Primary' }]
    }))
    setSuccess('EAN Barcode generated')
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.item_code || !formData.item_name || !formData.item_group || !formData.uom) {
      setError('Item Code, Name, Group, and UOM are required')
      window.scrollTo(0, 0)
      return
    }

    try {
      setLoading(true)
      const apiUrl = import.meta.env.VITE_API_URL
      const submitData = {
        ...formData,
        name: formData.item_name
      }
      if (isEditMode) {
        await axios.put(`${apiUrl}/items/${item_code}`, submitData)
        addToast('Item updated successfully', 'success')
        setSuccess('Item updated successfully')
      } else {
        await axios.post(`${apiUrl}/items`, submitData)
        addToast('Item created successfully', 'success')
        setSuccess('Item created successfully')
      }

      setTimeout(() => navigate(basePath), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit Item' : 'Create Item'}</h1>
        <button
          onClick={() => navigate(basePath)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Back
        </button>
      </div>

      {error && <Alert type="danger" className="mb-4">{error}</Alert>}
      {success && <Alert type="success" className="mb-4">{success}</Alert>}

      <div className="bg-white rounded-lg shadow p-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Row 1 */}
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Code *</label>
              <input
                type="text"
                name="item_code"
                value={formData.item_code}
                onChange={handleChange}
                disabled={isEditMode}
                className={`w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 ${isEditMode ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="Auto-generated or enter manually"
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                type="text"
                name="item_name"
                value={formData.item_name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter item name"
                required
              />
            </div>
            <div className="form-group">
              <SearchableSelect
                label="Item Group *"
                value={formData.item_group}
                onChange={(val) => setFormData({ ...formData, item_group: val })}
                options={itemGroups}
                placeholder="Select item group"
                allowCustom={true}
              />
            </div>

            {/* Row 2 */}
            <div className="form-group">
              <SearchableSelect
                label="Default UOM *"
                value={formData.uom}
                onChange={(val) => setFormData({ ...formData, uom: val })}
                options={uomList}
                placeholder="Select UOM"
                allowCustom={true}
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Rate</label>
              <input
                type="number"
                name="valuation_rate"
                value={formData.valuation_rate}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">No. of Cavity (for mould items)</label>
              <input
                type="number"
                name="no_of_cavities"
                value={formData.no_of_cavities}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="1"
              />
            </div>

            {/* Row 3 */}
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight per Unit</label>
              <input
                type="number"
                name="weight_per_unit"
                value={formData.weight_per_unit}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <SearchableSelect
                label="Weight UOM"
                value={formData.weight_uom}
                onChange={(val) => setFormData({ ...formData, weight_uom: val })}
                options={uomList}
                placeholder="Select weight UOM"
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Drawing No (Optional)</label>
              <input
                type="text"
                name="drawing_no"
                value={formData.drawing_no || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter drawing number"
              />
            </div>

            {/* Row 4 */}
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Revision (Optional)</label>
              <input
                type="text"
                name="revision"
                value={formData.revision || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter revision"
              />
            </div>
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">Material Grade (Optional)</label>
              <input
                type="text"
                name="material_grade"
                value={formData.material_grade || ''}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter material grade"
              />
            </div>
            <div className="form-group flex items-end">
              <button
                type="button"
                onClick={handleGenerateEAN}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium h-[42px]"
              >
                Generate EAN Barcode
              </button>
            </div>
          </div>

          {/* Barcode List Section */}
          {formData.barcode_list && formData.barcode_list.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Barcodes</h3>
              <div className="bg-gray-50 rounded border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formData.barcode_list.map((b, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm">
                      <div>
                        <div className="font-medium text-gray-900">{b.barcode}</div>
                        <div className="text-xs text-gray-500">{b.barcode_type} - {b.barcode_name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newList = [...formData.barcode_list]
                          newList.splice(index, 1)
                          setFormData(prev => ({ ...prev, barcode_list: newList }))
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4 mt-8">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium min-w-[120px]"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate(basePath)}
              className="px-8 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium min-w-[120px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}