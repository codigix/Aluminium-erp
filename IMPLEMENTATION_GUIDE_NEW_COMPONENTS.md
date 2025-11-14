# 📖 Implementation Guide - New UI Components

Quick reference for adding the new components to any module.

---

## 🚀 Quick Copy-Paste Templates

### Template 1: List Page with Advanced Filters and DataTable

**Copy this to any list page component:**

```jsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'

export default function ItemsList() {
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchItems()
  }, [filters])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)

      const response = await axios.get(`/api/items?${params}`)
      setItems(response.data.data || [])
      setError(null)
    } catch (err) {
      setError('Failed to fetch items')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'item_id', label: 'Item ID', width: '15%' },
    { key: 'name', label: 'Name', width: '20%' },
    { 
      key: 'created_at', 
      label: 'Created', 
      width: '20%',
      render: (val) => new Date(val).toLocaleString()
    },
    { 
      key: 'created_by', 
      label: 'Created By', 
      width: '15%',
      render: (val) => val || 'System'
    }
  ]

  const renderActions = (row) => (
    <div style={{ display: 'flex', gap: '5px' }}>
      <button 
        className="btn-sm btn-primary"
        onClick={() => navigate(`/item/${row.item_id}`)}
      >
        View
      </button>
      <button 
        className="btn-sm btn-secondary"
        onClick={() => navigate(`/item/${row.item_id}/edit`)}
      >
        Edit
      </button>
    </div>
  )

  return (
    <div className="container">
      <Card>
        <div className="page-header">
          <h2>Items</h2>
          <Button onClick={() => navigate('/item/new')} variant="primary">
            + New Item
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}

        {/* ADVANCED FILTERS */}
        <AdvancedFilters 
          filters={filters}
          onFilterChange={setFilters}
          filterConfig={[
            {
              key: 'search',
              label: 'Search',
              type: 'text',
              placeholder: 'Item name or ID...'
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]
            }
          ]}
          onApply={fetchItems}
          onReset={() => setFilters({ search: '', status: '' })}
          showPresets={true}
        />

        {/* DATA TABLE */}
        {loading ? (
          <div className="loading">Loading...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p>No items found</p>
          </div>
        ) : (
          <DataTable 
            columns={columns}
            data={items}
            renderActions={renderActions}
            filterable={true}
            sortable={true}
            pageSize={10}
          />
        )}
      </Card>
    </div>
  )
}
```

---

### Template 2: Form/Detail Page with Audit Trail

**Copy this to any form/detail page component:**

```jsx
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import Button from '../../components/Button/Button'
import AuditTrail from '../../components/AuditTrail'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'

export default function ItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (isEditMode) {
      fetchItem()
    }
  }, [])

  const fetchItem = async () => {
    try {
      const response = await axios.get(`/api/items/${id}`)
      const itemData = response.data.data
      setItem(itemData)
      setFormData({
        name: itemData.name,
        description: itemData.description
      })
    } catch (err) {
      setError('Failed to fetch item')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setLoading(true)
      if (isEditMode) {
        await axios.put(`/api/items/${id}`, formData)
        setSuccess('Item updated successfully')
      } else {
        await axios.post('/api/items', formData)
        setSuccess('Item created successfully')
      }

      setTimeout(() => navigate('/items'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <Card>
        <div className="page-header">
          <h2>{isEditMode ? 'Edit Item' : 'Create Item'}</h2>
          <Button onClick={() => navigate('/items')} variant="secondary">
            Back
          </Button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* AUDIT TRAIL - Only show in edit mode */}
        {isEditMode && item && (
          <AuditTrail 
            createdAt={item.created_at}
            createdBy={item.created_by}
            updatedAt={item.updated_at}
            updatedBy={item.updated_by}
            status={item.status}
          />
        )}

        <form onSubmit={handleSubmit} className="form-section">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
            />
          </div>

          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              type="button" 
              variant="secondary"
              onClick={() => navigate('/items')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
```

---

## 🎯 Step-by-Step Implementation for Any Module

### Step 1: Import Components
```jsx
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import AuditTrail from '../../components/AuditTrail'
```

### Step 2: Define Filter Configuration
```jsx
const filterConfig = [
  {
    key: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Search...'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]
  },
  {
    key: 'date_created',
    label: 'Created Date',
    type: 'date'
  },
  {
    key: 'date_range',
    label: 'Date Range',
    type: 'dateRange'
  }
]
```

### Step 3: Define Table Columns
```jsx
const columns = [
  { key: 'id', label: 'ID', width: '12%' },
  { key: 'name', label: 'Name', width: '25%' },
  { 
    key: 'status', 
    label: 'Status', 
    width: '10%',
    render: (val) => <Badge color={statusColor[val]}>{val}</Badge>
  },
  { 
    key: 'created_at', 
    label: 'Created', 
    width: '15%',
    render: (val) => new Date(val).toLocaleString()
  },
  { 
    key: 'created_by', 
    label: 'By', 
    width: '12%',
    render: (val) => val || 'System'
  }
]
```

### Step 4: Add Audit Trail to Forms
```jsx
{isEditMode && item && (
  <AuditTrail 
    createdAt={item.created_at}
    createdBy={item.created_by}
    updatedAt={item.updated_at}
    updatedBy={item.updated_by}
    status={item.status}
  />
)}
```

### Step 5: Add Advanced Filters
```jsx
<AdvancedFilters 
  filters={filters}
  onFilterChange={setFilters}
  filterConfig={filterConfig}
  onApply={fetchItems}
  onReset={handleReset}
  showPresets={true}
/>
```

### Step 6: Add DataTable
```jsx
<DataTable 
  columns={columns}
  data={items}
  renderActions={renderActions}
  filterable={true}
  sortable={true}
  pageSize={10}
/>
```

---

## 📊 Filter Types Reference

### Text Filter
```jsx
{
  key: 'search',
  label: 'Search',
  type: 'text',
  placeholder: 'Search...'
}
```

### Select Filter
```jsx
{
  key: 'status',
  label: 'Status',
  type: 'select',
  options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' }
  ]
}
```

### Date Filter
```jsx
{
  key: 'created_date',
  label: 'Created Date',
  type: 'date'
}
```

### Date Range Filter
```jsx
{
  key: 'date_range',
  label: 'Date Range',
  type: 'dateRange'
}
```

---

## 🎨 Column Rendering Functions

### Simple Text
```jsx
{ key: 'name', label: 'Name', width: '20%' }
```

### Formatted Date
```jsx
{ 
  key: 'created_at', 
  label: 'Created',
  render: (val) => new Date(val).toLocaleString()
}
```

### Currency
```jsx
{ 
  key: 'total_value', 
  label: 'Total',
  render: (val) => `₹${val?.toFixed(2)}`
}
```

### Badge/Status
```jsx
{ 
  key: 'status', 
  label: 'Status',
  render: (val) => <Badge color={colors[val]}>{val}</Badge>
}
```

### Custom Component
```jsx
{ 
  key: 'name', 
  label: 'Full Details',
  render: (val, row) => (
    <div>
      <strong>{row.name}</strong>
      <p>{row.description}</p>
    </div>
  )
}
```

---

## 🔄 Applying to Existing Modules

### RFQs Module
```jsx
// 1. Update RFQs.jsx (List)
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'

// 2. Update RFQForm.jsx
import AuditTrail from '../../components/AuditTrail'

// Add columns with created_at, created_by
```

### Purchase Orders Module
```jsx
// Same pattern as above
```

### Suppliers Module
```jsx
// Same pattern as above
```

---

## ✅ Checklist for Adding to New Module

- [ ] Import new components
- [ ] Add state: `[data, setData]`, `[filters, setFilters]`
- [ ] Define `filterConfig` array
- [ ] Define `columns` array with audit columns
- [ ] Create `fetchData()` function that respects filters
- [ ] Add `<AdvancedFilters />` component
- [ ] Add `<DataTable />` component
- [ ] In form: Add `<AuditTrail />` component (edit mode only)
- [ ] Ensure database has `created_at`, `updated_at`, `created_by`, `updated_by`
- [ ] Test filtering, sorting, pagination
- [ ] Test dark mode
- [ ] Test mobile responsive

---

## 🐛 Common Issues & Solutions

### Issue: Filters not working
**Solution:** Make sure `onFilterChange` is called and `fetchData()` is triggered in useEffect dependency array

```jsx
useEffect(() => {
  fetchData()
}, [filters]) // Add filters here!
```

### Issue: Audit trail not showing
**Solution:** Only show in edit mode, check data has the fields

```jsx
{isEditMode && item && <AuditTrail {...} />}
```

### Issue: Table columns too narrow
**Solution:** Adjust width percentages, ensure they add up to ~100%

```jsx
const columns = [
  { key: 'id', label: 'ID', width: '10%' },
  { key: 'name', label: 'Name', width: '40%' },
  { key: 'status', label: 'Status', width: '15%' },
  { key: 'created_at', label: 'Created', width: '20%' },
  { key: 'created_by', label: 'By', width: '15%' }
]
// Total = 100%
```

### Issue: Presets not saving
**Solution:** Check localStorage is enabled, presets use localStorage by default

---

## 📱 Responsive Design

All components are fully responsive. No extra work needed!

- Mobile: Single column layout
- Tablet: 2-3 columns
- Desktop: Full width

---

## 🌙 Dark Mode

All components automatically support dark mode via CSS variables:
- `--card-bg`
- `--text-primary`
- `--border-color`
- etc.

No extra configuration needed!

---

## 🚀 Performance Tips

1. **Pagination**: Set `pageSize` appropriately
   ```jsx
   <DataTable pageSize={10} /> // Adjust based on data
   ```

2. **Large datasets**: Use API-side filtering
   ```jsx
   // Send filters to API instead of client-side
   const params = new URLSearchParams(filters)
   const response = await axios.get(`/api/items?${params}`)
   ```

3. **Memoization**: DataTable uses React.useMemo internally

---

## 📞 Support

If components don't work:
1. Check console for errors
2. Verify imports are correct
3. Check data structure matches column keys
4. Ensure `created_at`, `created_by` fields exist in data

---

## Summary

**3-Step Quick Start:**
1. Copy template from top of this guide
2. Replace API endpoints and field names
3. Done! ✨

All components are plug-and-play!