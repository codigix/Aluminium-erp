# Department Pages - Code Reference Guide

## Complete Code Implementation Examples

---

## 1. DEPARTMENT DASHBOARD MAIN ENTRY POINT

### File: `frontend/src/pages/DepartmentDashboard.jsx`

#### Department Detection & User Access
```javascript
// Lines 11-20
export default function DepartmentDashboard() {
  const { user } = useAuth()  // Get authenticated user
  const userDept = user?.department?.toLowerCase() || 'buying'  // Extract department
  const [stats, setStats] = useState({})
  const [boms, setBOMs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDepartmentStats()
  }, [userDept])
  // Department changes trigger new data fetch
}
```

#### Buying Department Data Fetching
```javascript
// Lines 27-47 - Parallel API calls for Buying module
if (userDept === 'buying' || userDept === 'procurement') {
  const [mrRes, rfqRes, quotRes, supplierRes, poRes, invRes] = await Promise.all([
    fetch(`${import.meta.env.VITE_API_URL}/material-requests`, { headers }),
    fetch(`${import.meta.env.VITE_API_URL}/rfqs`, { headers }),
    fetch(`${import.meta.env.VITE_API_URL}/quotations`, { headers }),
    fetch(`${import.meta.env.VITE_API_URL}/suppliers`, { headers }),
    fetch(`${import.meta.env.VITE_API_URL}/purchase-orders`, { headers }),
    fetch(`${import.meta.env.VITE_API_URL}/purchase-invoices`, { headers })
  ])
  
  // Handle all responses
  const [mrs, rfqs, quotations, suppliers, pos, invoices] = await Promise.all([
    mrRes.json?.().catch(() => []),
    rfqRes.json?.().catch(() => []),
    quotRes.json?.().catch(() => []),
    supplierRes.json?.().catch(() => []),
    poRes.json?.().catch(() => []),
    invRes.json?.().catch(() => [])
  ])
  
  // Set state with data
  setStats({
    materialRequests: Array.isArray(mrs) ? mrs.length : 0,
    rfqs: Array.isArray(rfqs) ? rfqs.length : 0,
    quotations: Array.isArray(quotations) ? quotations.length : 0,
    suppliers: Array.isArray(suppliers) ? suppliers.length : 0,
    purchaseOrders: Array.isArray(pos) ? pos.length : 0,
    invoices: Array.isArray(invoices) ? invoices.length : 0
  })
}
```

#### Dashboard Quick Action Links
```javascript
// Lines 312-376 - Quick action buttons for Buying module
<a 
  href="/buying/material-requests/new" 
  style={{...actionButtonStyle, backgroundColor: '#eff6ff', borderColor: '#bfdbfe'}}
  onMouseEnter={(e) => { e.target.style.backgroundColor = '#dbeafe' }}
  onMouseLeave={(e) => { e.target.style.backgroundColor = '#eff6ff' }}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <Plus size={16} />
    <span>Create Material Request</span>
  </div>
  <ChevronRight size={16} color="#0284c7" />
</a>

<a 
  href="/buying/purchase-orders" 
  style={{...actionButtonStyle, backgroundColor: '#fef2f2', borderColor: '#fecaca'}}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <Clipboard size={16} />
    <span>View Purchase Orders</span>
  </div>
  <ChevronRight size={16} color="#ef4444" />
</a>
```

---

## 2. SUPPLIER LIST - FULL CRUD EXAMPLE

### File: `frontend/src/pages/Suppliers/SupplierList.jsx` (562 lines)

#### Component Structure & State
```javascript
// Lines 1-32
import { useState, useEffect } from 'react'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import Alert from '../../components/Alert/Alert'
import SearchableSelect from '../../components/SearchableSelect'
import { suppliersAPI } from '../../services/api'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formError, setFormError] = useState('')

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    group: ''
  })

  const [formData, setFormData] = useState({
    name: '',
    supplier_group: '',
    gstin: '',
    payment_terms_days: 30,
    lead_time_days: 7,
    rating: 0,
    is_active: true
  })
```

#### Fetch Data - READ Operation
```javascript
// Lines 51-63 - Fetch suppliers list
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

// Called on component mount
useEffect(() => {
  fetchSuppliers()
}, [])
```

#### Filter Configuration
```javascript
// Lines 71-101 - Advanced filter options
const filterConfig = [
  {
    key: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Supplier name, email, or ID...'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'all', label: 'All Status' },
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' }
    ]
  },
  {
    key: 'group',
    label: 'Supplier Group',
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
```

#### Get Filtered Suppliers - SEARCH & FILTER
```javascript
// Lines 65-84 - Filtering logic
const getFilteredSuppliers = () => {
  return suppliers.filter(supplier => {
    // Text search across multiple fields
    if (filters.search) {
      const search = filters.search.toLowerCase()
      if (!supplier.name?.toLowerCase().includes(search) &&
          !supplier.supplier_id?.toLowerCase().includes(search) &&
          !supplier.gstin?.toLowerCase().includes(search)) {
        return false
      }
    }

    // Status filter (active/inactive)
    if (filters.status !== 'all') {
      if (supplier.is_active !== (filters.status === 'true')) return false
    }

    // Group filter
    if (filters.group && supplier.supplier_group !== filters.group) return false

    return true
  })
}

const filteredSuppliers = getFilteredSuppliers()
```

#### Reset Form
```javascript
// Lines 88-100 - Reset form to initial state
const resetForm = () => {
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
```

#### ADD Button Handler
```javascript
// Lines 102-105 - Handle Add button click
const handleAddClick = () => {
  resetForm()
  setShowAddForm(true)  // Open form modal
}

// In JSX - Add Button:
<button onClick={handleAddClick} className="btn-add">
  <Plus size={18} /> Add Supplier
</button>
```

#### EDIT Button Handler - Pre-fill Data
```javascript
// Lines 107-118 - Pre-fill form with supplier data
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
}

// In JSX - Edit Button:
<button 
  onClick={() => handleEditClick(supplier)}
  className="action-btn"
>
  <Edit2 size={16} /> Edit
</button>
```

#### Form Validation
```javascript
// Lines 120-130 - Validate required fields
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
```

#### CREATE/UPDATE via Submit Button
```javascript
// Lines 132-165 - Handle both create and update
const handleSubmit = async (e) => {
  e.preventDefault()
  setError(null)
  setFormError('')

  if (!validateForm()) return

  try {
    if (editingId) {
      // UPDATE Operation (Edit mode)
      await suppliersAPI.update(editingId, formData)
      setSuccess('Supplier updated successfully')
    } else {
      // CREATE Operation (Add mode)
      await suppliersAPI.create(formData)
      setSuccess('Supplier created successfully')
    }

    // Reset form and close modal
    resetForm()
    setShowAddForm(false)
    setEditingId(null)
    
    // Refresh list from API
    fetchSuppliers()
    
    // Show success message (then fade out)
    setTimeout(() => setSuccess(null), 3000)
  } catch (err) {
    setFormError(err.response?.data?.error || 'Failed to submit form')
    console.error('Error:', err)
  }
}
```

#### DELETE Button Handler
```javascript
// Lines 167-182 - Delete with confirmation
const handleDeleteClick = async (supplierId) => {
  // Confirmation dialog
  if (!window.confirm('Are you sure you want to delete this supplier?')) {
    return
  }

  try {
    // API DELETE request
    await suppliersAPI.delete(supplierId)
    setSuccess('Supplier deleted successfully')
    
    // Refresh list
    fetchSuppliers()
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(null), 3000)
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to delete supplier')
    console.error('Error deleting supplier:', err)
  }
}

// In JSX - Delete Button:
<button 
  onClick={() => handleDeleteClick(supplier.supplier_id)}
  className="delete-btn"
>
  <Trash2 size={16} />
</button>
```

#### Input Change Handler
```javascript
// Lines 184-190 - Update form state on input change
const handleInputChange = (e) => {
  const { name, value, type, checked } = e.target
  setFormData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? checked : value
  }))
}
```

#### Render Table with Action Buttons
```javascript
// Lines 230-280 - Supplier table with CRUD buttons
<table className="suppliers-table">
  <thead>
    <tr>
      <th>Supplier ID</th>
      <th>Supplier Name</th>
      <th>GSTIN</th>
      <th>Group</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {filteredSuppliers.map((supplier) => (
      <tr key={supplier.supplier_id}>
        <td>{supplier.supplier_id}</td>
        <td>{supplier.name}</td>
        <td>{supplier.gstin}</td>
        <td>{supplier.supplier_group}</td>
        <td>
          <Badge 
            status={supplier.is_active ? 'active' : 'inactive'}
          >
            {supplier.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </td>
        <td className="actions">
          {/* EDIT Button */}
          <button 
            onClick={() => handleEditClick(supplier)}
            className="btn-icon-edit"
            title="Edit supplier"
          >
            <Edit2 size={16} />
          </button>

          {/* DELETE Button */}
          <button 
            onClick={() => handleDeleteClick(supplier.supplier_id)}
            className="btn-icon-delete"
            title="Delete supplier"
          >
            <Trash2 size={16} />
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

#### Modal Form JSX
```javascript
// Lines 300+ - Add/Edit Form Modal
{showAddForm && (
  <Modal>
    <Modal.Header>
      <h2>{editingId ? 'Edit Supplier' : 'Add Supplier'}</h2>
    </Modal.Header>
    
    <Modal.Body>
      {formError && <Alert type="error">{formError}</Alert>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Supplier Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter supplier name"
            required
          />
        </div>

        <div className="form-group">
          <label>GSTIN *</label>
          <input
            type="text"
            name="gstin"
            value={formData.gstin}
            onChange={handleInputChange}
            placeholder="GST ID"
            required
          />
        </div>

        <div className="form-group">
          <label>Supplier Group</label>
          <SearchableSelect
            options={supplierGroups}
            value={formData.supplier_group}
            onChange={(val) => setFormData({...formData, supplier_group: val})}
          />
        </div>

        <div className="form-group">
          <label>Payment Terms (Days)</label>
          <input
            type="number"
            name="payment_terms_days"
            value={formData.payment_terms_days}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleInputChange}
            />
            Active
          </label>
        </div>
      </form>
    </Modal.Body>
    
    <Modal.Footer>
      <Button onClick={() => setShowAddForm(false)} variant="secondary">
        Cancel
      </Button>
      <Button onClick={handleSubmit} variant="primary">
        {editingId ? 'Update Supplier' : 'Create Supplier'}
      </Button>
    </Modal.Footer>
  </Modal>
)}
```

---

## 3. EMPLOYEES LIST - MODAL-BASED CRUD

### File: `frontend/src/pages/Masters/EmployeeList.jsx` (665 lines)

#### Modal Hook Usage
```javascript
// Lines 48-51 - Initialize modals using custom hook
const addModal = useModal()
const editModal = useModal()
const deleteModal = useModal()
const [selectedEmployee, setSelectedEmployee] = useState(null)
```

#### useModal Hook Implementation
```javascript
// Common pattern used across app
export function useModal() {
  const [isOpen, setIsOpen] = useState(false)
  
  return {
    isOpen,
    openModal: () => setIsOpen(true),
    closeModal: () => setIsOpen(false)
  }
}

// Usage:
const { isOpen, openModal, closeModal } = useModal()
```

#### Handle Add Click - Open Modal
```javascript
// Lines 150-160 - Add button opens modal with empty form
const handleAddClick = () => {
  setFormData({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    // ... reset all fields
  })
  setEditingId(null)
  addModal.openModal()  // Opens modal
}

// In JSX:
<button onClick={handleAddClick} className="btn-primary">
  <Plus size={16} /> Add Employee
</button>
```

#### Handle Edit Click - Pre-fill & Open Modal
```javascript
// Lines 162-182 - Edit button pre-fills form and opens modal
const handleEdit = (employee) => {
  setFormData({
    first_name: employee.first_name || '',
    middle_name: employee.middle_name || '',
    last_name: employee.last_name || '',
    email: employee.email || '',
    phone: employee.phone || '',
    date_of_birth: employee.date_of_birth || '',
    gender: employee.gender || '',
    department: employee.department || '',
    // ... fill all fields
  })
  setEditingId(employee.id)
  editModal.openModal()  // Opens modal
}

// In JSX:
<button 
  onClick={() => handleEdit(employee)}
  className="action-btn"
>
  <Edit2 size={16} />
</button>
```

#### Handle Delete - Confirmation & Delete
```javascript
// Lines 195-215 - Delete with confirmation dialog
const handleDelete = async (employeeId, employeeName) => {
  setSelectedEmployee({ id: employeeId, name: employeeName })
  
  if (!window.confirm(`Delete ${employeeName}?`)) {
    return
  }

  try {
    setError(null)
    await employeesAPI.delete(employeeId)
    setSuccess(`${employeeName} deleted successfully`)
    
    // Refresh list
    fetchEmployees()
    
    // Clear success message
    setTimeout(() => setSuccess(null), 3000)
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to delete employee')
  }
}

// In JSX:
<button 
  onClick={() => handleDelete(employee.id, employee.full_name)}
  className="btn-danger"
>
  <Trash2 size={16} />
</button>
```

#### Submit Form - Create or Update
```javascript
// Lines 220-245 - Handle form submission
const handleSubmit = async (e) => {
  e.preventDefault()
  setFormError('')
  setError(null)

  try {
    if (editingId) {
      // UPDATE Operation
      await employeesAPI.update(editingId, formData)
      setSuccess('Employee updated successfully')
      editModal.closeModal()
    } else {
      // CREATE Operation
      await employeesAPI.create(formData)
      setSuccess('Employee created successfully')
      addModal.closeModal()
    }

    // Reset form and refresh list
    setEditingId(null)
    setFormData(initialFormData)
    fetchEmployees()

    // Clear success message
    setTimeout(() => setSuccess(null), 3000)
  } catch (err) {
    setFormError(err.response?.data?.error || 'Failed to save employee')
    console.error('Error:', err)
  }
}
```

#### Render Add/Edit Modal
```javascript
// Lines 400+ - Modal for add/edit
{addModal.isOpen && (
  <Modal size="lg" onClose={addModal.closeModal}>
    <Modal.Header>
      <h2>Add New Employee</h2>
      <button onClick={addModal.closeModal} className="close-btn">
        <X />
      </button>
    </Modal.Header>
    
    <Modal.Body>
      {formError && <Alert type="error">{formError}</Alert>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Department</label>
          <select
            name="department"
            value={formData.department}
            onChange={handleInputChange}
          >
            <option value="">Select Department</option>
            <option value="Buying">Buying</option>
            <option value="Selling">Selling</option>
            <option value="Production">Production</option>
            <option value="Inventory">Inventory</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
        </div>
      </form>
    </Modal.Body>
    
    <Modal.Footer>
      <Button onClick={addModal.closeModal} variant="secondary">
        Cancel
      </Button>
      <Button onClick={handleSubmit} variant="primary">
        Create Employee
      </Button>
    </Modal.Footer>
  </Modal>
)}

{editModal.isOpen && (
  <Modal size="lg" onClose={editModal.closeModal}>
    <Modal.Header>
      <h2>Edit Employee</h2>
    </Modal.Header>
    
    <Modal.Body>
      {/* Same form as above, but with filled data */}
    </Modal.Body>
    
    <Modal.Footer>
      <Button onClick={editModal.closeModal} variant="secondary">
        Cancel
      </Button>
      <Button onClick={handleSubmit} variant="primary">
        Update Employee
      </Button>
    </Modal.Footer>
  </Modal>
)}
```

---

## 4. OPERATIONS - NAVIGATE-BASED CRUD

### File: `frontend/src/pages/Production/Operations.jsx` (192 lines)

#### Component with useNavigate
```javascript
// Lines 1-39
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function Operations() {
  const navigate = useNavigate()  // Use for navigation
  const [operations, setOperations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchOperations()
  }, [])

  // Fetch operations list
  const fetchOperations = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/production/operations`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        setOperations(data.data || [])
      }
    } catch (err) {
      setError('Error loading operations')
    } finally {
      setLoading(false)
    }
  }
}
```

#### Add Button - Navigate to Form
```javascript
// Lines 94-100 - Add button navigates to new form page
<button
  onClick={() => navigate('/production/operations/form')}
  className="btn-submit"
>
  <Plus size={18} /> Add Operation
</button>
```

#### Edit Button - Navigate with ID
```javascript
// Lines 64-66 - Edit navigates to form page with ID
const handleEdit = (operation) => {
  navigate(`/production/operations/form/${operation.name}`, {
    state: { operation }
  })
}

// In JSX:
<button 
  onClick={() => handleEdit(operation)}
  className="edit-btn"
>
  <Edit2 size={16} /> Edit
</button>
```

#### Delete Button - API Call
```javascript
// Lines 41-62 - Delete operation via API
const handleDelete = async (operationName) => {
  if (!window.confirm('Are you sure?')) return

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/production/operations/${operationName}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (response.ok) {
      setSuccess('Operation deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
      fetchOperations()  // Refresh list
    } else {
      setError('Failed to delete operation')
    }
  } catch (err) {
    setError('Error deleting operation')
  }
}

// In JSX:
<button 
  onClick={() => handleDelete(operation.name)}
  className="btn-danger"
>
  <Trash2 size={16} />
</button>
```

#### Search Filter
```javascript
// Lines 68-72 - Client-side search filtering
const filteredOperations = operations.filter(op => 
  op.name.toLowerCase().includes(search.toLowerCase()) ||
  op.operation_name?.toLowerCase().includes(search.toLowerCase())
)

// In JSX - Search input:
<input
  type="text"
  placeholder="Search operations..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="search-input"
/>
```

---

## 5. API SERVICE LAYER

### File: `frontend/src/services/api.js` (typical pattern)

#### Supplier API Service
```javascript
// Services pattern for consistency
export const suppliersAPI = {
  // READ - Get all suppliers
  list: async () => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/suppliers`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    if (!response.ok) throw new Error('Failed to fetch')
    return response.json()
  },

  // READ - Get single supplier
  getById: async (id) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/suppliers/${id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (!response.ok) throw new Error('Failed to fetch')
    return response.json()
  },

  // CREATE - Add new supplier
  create: async (data) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/suppliers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )
    if (!response.ok) throw new Error('Failed to create')
    return response.json()
  },

  // UPDATE - Edit existing supplier
  update: async (id, data) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/suppliers/${id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )
    if (!response.ok) throw new Error('Failed to update')
    return response.json()
  },

  // DELETE - Remove supplier
  delete: async (id) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/suppliers/${id}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    if (!response.ok) throw new Error('Failed to delete')
    return response.json()
  }
}
```

#### Employees API Service
```javascript
// Similar pattern for employees
export const employeesAPI = {
  list: async () => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/hr/employees`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    return response.json()
  },

  create: async (data) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/hr/employees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )
    return response.json()
  },

  update: async (id, data) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/hr/employees/${id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    )
    return response.json()
  },

  delete: async (id) => {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/hr/employees/${id}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
    )
    return response.json()
  }
}
```

---

## 6. FORM COMPONENT PATTERNS

### Add/Edit Form (Separate Page)

#### File: `frontend/src/pages/Production/OperationForm.jsx` (typical structure)

```javascript
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

export default function OperationForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const [formData, setFormData] = useState({
    name: '',
    operation_name: '',
    description: '',
    default_workstation: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load existing data for edit mode
  useEffect(() => {
    if (id && location.state?.operation) {
      setFormData(location.state.operation)
    }
  }, [id, location.state])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const method = id ? 'PUT' : 'POST'
      const url = id 
        ? `${import.meta.env.VITE_API_URL}/production/operations/${id}`
        : `${import.meta.env.VITE_API_URL}/production/operations`

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        // Success - navigate back to list
        navigate('/production/operations')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <h1>{id ? 'Edit Operation' : 'Add Operation'}</h1>
      
      {error && <Alert type="error">{error}</Alert>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Operation Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

---

## 7. ERROR HANDLING PATTERNS

### Try-Catch with User Feedback
```javascript
const handleAction = async () => {
  try {
    setError(null)
    setLoading(true)
    
    // Perform action
    const response = await api.fetch()
    
    // Validate response
    if (!response.ok) {
      const errorData = await response.json()
      setError(errorData.error || 'An error occurred')
      return
    }
    
    // Success handling
    const data = await response.json()
    setSuccess('Action completed successfully')
    
    // Cleanup
    setTimeout(() => setSuccess(null), 3000)
  } catch (err) {
    console.error('Error:', err)
    setError(err.message || 'An unexpected error occurred')
  } finally {
    setLoading(false)
  }
}
```

### Form Validation
```javascript
const validateForm = () => {
  const errors = {}
  
  if (!formData.name?.trim()) {
    errors.name = 'Name is required'
  }
  
  if (!formData.email?.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = 'Invalid email format'
  }
  
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors)
    return false
  }
  
  return true
}
```

---

## 8. COMMON PATTERNS SUMMARY

### Data Fetching Pattern
```javascript
// 1. State
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

// 2. Effect hook
useEffect(() => {
  fetchData()
}, [])

// 3. Fetch function
const fetchData = async () => {
  try {
    setLoading(true)
    const response = await api.list()
    setData(response.data.data || [])
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}
```

### Form Handling Pattern
```javascript
// 1. Form state
const [formData, setFormData] = useState(initialState)
const [editingId, setEditingId] = useState(null)

// 2. Input change
const handleInputChange = (e) => {
  const { name, value } = e.target
  setFormData(prev => ({ ...prev, [name]: value }))
}

// 3. Submit
const handleSubmit = async () => {
  if (editingId) {
    // Update
    await api.update(editingId, formData)
  } else {
    // Create
    await api.create(formData)
  }
  resetForm()
  fetchData()
}

// 4. Reset
const resetForm = () => {
  setFormData(initialState)
  setEditingId(null)
}
```

### Modal Pattern
```javascript
// 1. State
const { isOpen, openModal, closeModal } = useModal()

// 2. Open
<button onClick={openModal}>Add Item</button>

// 3. Render
{isOpen && (
  <Modal onClose={closeModal}>
    <form onSubmit={handleSubmit}>
      {/* Form content */}
    </form>
  </Modal>
)}
```

