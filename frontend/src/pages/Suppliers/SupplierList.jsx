import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Input from '../../components/Input/Input'
import Badge from '../../components/Badge/Badge'
import Modal, { useModal } from '../../components/Modal/Modal'
import Alert from '../../components/Alert/Alert'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table/Table'
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import { suppliersAPI } from '../../services/api'

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    group: ''
  })
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    supplier_group: '',
    gstin: '',
    payment_terms_days: 30,
    lead_time_days: 7,
    rating: 0,
    is_active: true
  })
  const [editingId, setEditingId] = useState(null)
  const [formError, setFormError] = useState('')

  // Modal states
  const addModal = useModal()
  const editModal = useModal()
  const deleteModal = useModal()
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  // Fetch suppliers
  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await suppliersAPI.list()
      setSuppliers(response.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch suppliers')
      console.error('Error fetching suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter configuration
  const filterConfig = [
    {
      key: 'search',
      label: 'Search',
      type: 'text',
      placeholder: 'Supplier name, ID, or GSTIN...'
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: '', label: 'All Status' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    },
    {
      key: 'group',
      label: 'Group',
      type: 'select',
      options: [
        { value: '', label: 'All Groups' },
        { value: 'Raw Materials', label: 'Raw Materials' },
        { value: 'Components', label: 'Components' },
        { value: 'Services', label: 'Services' },
        { value: 'Tools', label: 'Tools' }
      ]
    }
  ]

  // Column configuration
  const columns = [
    {
      key: 'supplier_id',
      label: 'Supplier ID',
      width: '12%'
    },
    {
      key: 'name',
      label: 'Name',
      width: '18%'
    },
    {
      key: 'supplier_group',
      label: 'Group',
      width: '12%',
      render: (val) => val || '-'
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      width: '15%',
      render: (val) => val ? <span className="font-mono text-sm">{val}</span> : '-'
    },
    {
      key: 'rating',
      label: 'Rating',
      width: '10%',
      render: (val) => val ? `⭐ ${(parseFloat(val) || 0).toFixed(1)}` : '—'
    },
    {
      key: 'is_active',
      label: 'Status',
      width: '12%',
      render: (val) => (
        <Badge variant={val ? 'success' : 'warning'}>
          {val ? 'Active' : 'Inactive'}
        </Badge>
      )
    }
  ]

  // Apply advanced filters
  const getFilteredSuppliers = () => {
    return suppliers.filter(supplier => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const matchesSearch = 
          supplier.name?.toLowerCase().includes(search) ||
          supplier.supplier_id?.toLowerCase().includes(search) ||
          supplier.gstin?.toLowerCase().includes(search)
        if (!matchesSearch) return false
      }

      // Status filter
      if (filters.status) {
        const isActive = filters.status === 'active'
        if (supplier.is_active !== isActive) return false
      }

      // Group filter
      if (filters.group && supplier.supplier_group !== filters.group) return false

      return true
    })
  }

  const filteredSuppliers = getFilteredSuppliers()

  // Render actions
  const renderActions = (supplier) => (
    <div className="flex gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          handleEditClick(supplier)
        }}
      >
        Edit
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          handleDeleteClick(supplier)
        }}
      >
        Delete
      </Button>
    </div>
  )

  // Form handlers
  const handleResetForm = () => {
    setFormData({
      name: '',
      supplier_group: '',
      gstin: '',
      payment_terms_days: 30,
      lead_time_days: 7,
      rating: 0,
      is_active: true
    })
    setEditingId(null)
    setFormError('')
  }

  const handleAddClick = () => {
    handleResetForm()
    addModal.open()
  }

  const handleEditClick = (supplier) => {
    setFormData({
      name: supplier.name || '',
      supplier_group: supplier.supplier_group || '',
      gstin: supplier.gstin || '',
      payment_terms_days: supplier.payment_terms_days || 30,
      lead_time_days: supplier.lead_time_days || 7,
      rating: supplier.rating || 0,
      is_active: supplier.is_active !== false
    })
    setEditingId(supplier.supplier_id)
    editModal.open()
  }

  const handleDeleteClick = (supplier) => {
    setSelectedSupplier(supplier)
    deleteModal.open()
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setFormError('Supplier name is required')
      return false
    }
    if (!formData.gstin.trim()) {
      setFormError('GSTIN is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setFormError('')
      if (editingId) {
        // Update existing supplier
        await suppliersAPI.update(editingId, formData)
        setSuccess('Supplier updated successfully')
        editModal.close()
      } else {
        // Create new supplier
        await suppliersAPI.create(formData)
        setSuccess('Supplier created successfully')
        addModal.close()
      }

      handleResetForm()
      fetchSuppliers()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save supplier')
      console.error('Error saving supplier:', err)
    }
  }

  const handleConfirmDelete = async () => {
    try {
      await suppliersAPI.delete(selectedSupplier.supplier_id)
      setSuccess('Supplier deleted successfully')
      deleteModal.close()
      setSelectedSupplier(null)
      fetchSuppliers()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete supplier')
      deleteModal.close()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-[var(--text-secondary)] font-medium">Loading suppliers...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Success Alert */}
      {success && (
        <Alert variant="success" className="mb-6">
          {success}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-md">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">Suppliers</h2>
          <Button variant="primary" onClick={handleAddClick}>
            + Add New Supplier
          </Button>
        </div>
        <p className="text-[var(--text-secondary)]">Manage your supplier database with advanced filtering and search</p>
      </div>

      {/* Advanced Filters */}
      <div className="mb-6">
        <AdvancedFilters
          filters={filters}
          onFilterChange={setFilters}
          filterConfig={filterConfig}
          onReset={() => setFilters({ search: '', status: '', group: '' })}
          showPresets={true}
        />
      </div>

      {/* Suppliers DataTable */}
      <Card>
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)] text-lg mb-4">No suppliers found</p>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Try adjusting your filters or create a new supplier</p>
            <Button variant="primary" size="sm" onClick={handleAddClick}>
              Create First Supplier
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredSuppliers}
            renderActions={renderActions}
            sortable={true}
            filterable={false}
            pageSize={10}
          />
        )}
      </Card>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={addModal.isOpen}
        onClose={() => {
          addModal.close()
          handleResetForm()
        }}
        title="Add New Supplier"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              addModal.close()
              handleResetForm()
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              Create Supplier
            </Button>
          </>
        }
      >
        <SupplierForm formData={formData} setFormData={setFormData} formError={formError} />
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() => {
          editModal.close()
          handleResetForm()
        }}
        title="Edit Supplier"
        footer={
          <>
            <Button variant="secondary" onClick={() => {
              editModal.close()
              handleResetForm()
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              Update Supplier
            </Button>
          </>
        }
      >
        <SupplierForm formData={formData} setFormData={setFormData} formError={formError} />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title="Delete Supplier"
        footer={
          <>
            <Button variant="secondary" onClick={deleteModal.close}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-neutral-700">
          Are you sure you want to delete <strong>{selectedSupplier?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}

// Supplier Form Component
function SupplierForm({ formData, setFormData, formError }) {
  return (
    <div className="space-y-4">
      {formError && (
        <Alert variant="danger">{formError}</Alert>
      )}

      <Input
        label="Supplier Name *"
        placeholder="e.g., ABC Industries"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />

      <Input
        label="GSTIN *"
        placeholder="e.g., 27AABCT1234H1Z0"
        value={formData.gstin}
        onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
      />

      <div className="form-group">
        <label className="block mb-2 text-sm font-medium text-[var(--text-primary)]">Supplier Group</label>
        <select
          className="input-base"
          value={formData.supplier_group}
          onChange={(e) => setFormData({ ...formData, supplier_group: e.target.value })}
        >
          <option value="">Select a group</option>
          <option value="Raw Materials">Raw Materials</option>
          <option value="Components">Components</option>
          <option value="Services">Services</option>
          <option value="Tools">Tools</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Payment Terms (Days)"
          type="number"
          min="0"
          value={formData.payment_terms_days}
          onChange={(e) => setFormData({ ...formData, payment_terms_days: parseInt(e.target.value) || 0 })}
        />

        <Input
          label="Lead Time (Days)"
          type="number"
          min="0"
          value={formData.lead_time_days}
          onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
        />
      </div>

      <Input
        label="Rating (0-5)"
        type="number"
        min="0"
        max="5"
        step="0.1"
        value={formData.rating}
        onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
      />

      <div className="form-group">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-neutral-700">Active</span>
        </label>
      </div>
    </div>
  )
}
