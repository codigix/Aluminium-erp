# Pagination & Filters - Developer Implementation Guide

## 📚 For Developers: How to Add Pagination & Filters to Other Pages

---

## 🏗️ Architecture Overview

### **Component Structure:**
```
Page Component
├── State Management (filters, pagination, data)
├── Data Fetching (API calls)
├── Filtering Logic (client-side)
├── Pagination Logic (slice data)
├── Render Filters
├── Render Table (paginated data)
└── Render Pagination Component
```

### **Data Flow:**
```
Raw Data → Filter → Slice → Display
         ↑       ↓       ↓
    State      Event   Handlers
```

---

## 🔧 Step-by-Step Implementation

### **Step 1: Import Pagination Component**
```javascript
import Pagination from './Pagination'
```

### **Step 2: Add State Variables**
```javascript
// Pagination state
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(10)

// Filter state
const [searchTerm, setSearchTerm] = useState('')
const [statusFilter, setStatusFilter] = useState('')
// Add more filter states as needed
```

### **Step 3: Add Filtering Logic**
```javascript
// Apply all filters
const filteredData = data.filter(item => {
  // Combine all filter conditions with AND logic
  const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.code?.toLowerCase().includes(searchTerm.toLowerCase())
  const matchesStatus = statusFilter === '' || item.status === statusFilter
  
  return matchesSearch && matchesStatus // AND all conditions
})
```

### **Step 4: Add Pagination Logic**
```javascript
// Calculate pagination values
const totalPages = Math.ceil(filteredData.length / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedData = filteredData.slice(startIndex, endIndex)
```

### **Step 5: Add Clear Filters Function**
```javascript
const handleClearFilters = () => {
  setSearchTerm('')
  setStatusFilter('')
  // Reset other filters
  setCurrentPage(1) // Reset to first page
}
```

### **Step 6: Render Filters**
```javascript
{data.length > 0 && (
  <div className="inventory-filters">
    <input
      type="text"
      placeholder="Search..."
      value={searchTerm}
      onChange={(e) => {
        setSearchTerm(e.target.value)
        setCurrentPage(1) // Reset pagination
      }}
    />
    <select 
      value={statusFilter}
      onChange={(e) => {
        setStatusFilter(e.target.value)
        setCurrentPage(1) // Reset pagination
      }}
    >
      <option value="">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    {(searchTerm || statusFilter) && (
      <Button 
        variant="secondary" 
        onClick={handleClearFilters}
        icon={X}
      >
        Clear Filters
      </Button>
    )}
  </div>
)}
```

### **Step 7: Render Empty States**
```javascript
{loading ? (
  <div className="no-data">
    <Icon size={48} style={{ opacity: 0.5 }} />
    <p>Loading items...</p>
  </div>
) : data.length === 0 ? (
  <div className="no-data">
    <Icon size={48} style={{ opacity: 0.5 }} />
    <p>📦 No items found.</p>
    <p style={{ fontSize: '14px', marginTop: '10px' }}>
      Create your first item to get started.
    </p>
  </div>
) : filteredData.length === 0 ? (
  <div className="no-data">
    <Icon size={48} style={{ opacity: 0.5 }} />
    <p>❌ No items match your filters.</p>
    <p style={{ fontSize: '14px', marginTop: '10px' }}>
      Try adjusting your search or filters.
    </p>
  </div>
) : (
  <>
    <DataTable columns={columns} data={paginatedData} />
    <Pagination {...props} />
  </>
)}
```

### **Step 8: Render Pagination Component**
```javascript
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  itemsPerPage={itemsPerPage}
  totalItems={filteredData.length}
  onItemsPerPageChange={setItemsPerPage}
/>
```

---

## 📋 Complete Example Implementation

### **Before (Simple Page):**
```javascript
export default function SimpleList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/items')
      setItems(response.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {loading ? (
        <p>Loading...</p>
      ) : items.length > 0 ? (
        <DataTable columns={columns} data={items} />
      ) : (
        <p>No items</p>
      )}
    </div>
  )
}
```

### **After (With Pagination & Filters):**
```javascript
import Pagination from './Pagination'

export default function EnhancedList() {
  // Data state
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/items')
      setItems(response.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Filtering logic
  const filteredItems = items.filter(item =>
    (item.name?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (statusFilter === '' || item.status === statusFilter)
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredItems.slice(
    startIndex,
    startIndex + itemsPerPage
  )

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setCurrentPage(1)
  }

  return (
    <div>
      {/* Filters */}
      {items.length > 0 && (
        <div className="inventory-filters">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(searchTerm || statusFilter) && (
            <Button
              variant="secondary"
              onClick={handleClearFilters}
              icon={X}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="no-data">Loading...</div>
      ) : items.length === 0 ? (
        <div className="no-data">
          <p>📦 No items found.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="no-data">
          <p>❌ No items match your filters.</p>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={paginatedData} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredItems.length}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}
    </div>
  )
}
```

---

## 🎯 Filter Patterns & Examples

### **Pattern 1: Simple String Search**
```javascript
const filtered = items.filter(item =>
  item.name?.toLowerCase().includes(searchTerm.toLowerCase())
)
```

### **Pattern 2: Multiple Field Search**
```javascript
const filtered = items.filter(item =>
  item.name?.toLowerCase().includes(search.toLowerCase()) ||
  item.code?.toLowerCase().includes(search.toLowerCase()) ||
  item.description?.toLowerCase().includes(search.toLowerCase())
)
```

### **Pattern 3: Dropdown Filter**
```javascript
const filtered = items.filter(item =>
  filterValue === '' || item.status === filterValue
)
```

### **Pattern 4: Date Range Filter**
```javascript
const filtered = items.filter(item => {
  const itemDate = new Date(item.date)
  return itemDate >= new Date(fromDate) && itemDate <= new Date(toDate)
})
```

### **Pattern 5: Numeric Range Filter**
```javascript
const filtered = items.filter(item =>
  item.quantity >= minQty && item.quantity <= maxQty
)
```

### **Pattern 6: Status-Based Filter**
```javascript
const filtered = items.filter(item => {
  if (statusFilter === '') return true
  if (statusFilter === 'active') return item.active === true
  if (statusFilter === 'inactive') return item.active === false
  return true
})
```

### **Pattern 7: Complex Multi-Filter**
```javascript
const filtered = items.filter(item => {
  const matchesSearch = item.name?.toLowerCase().includes(search.toLowerCase())
  const matchesStatus = filterStatus === '' || item.status === filterStatus
  const matchesWarehouse = warehouseFilter === '' || item.warehouse_id === warehouseFilter
  const matchesDate = !fromDate || new Date(item.date) >= new Date(fromDate)
  
  return matchesSearch && matchesStatus && matchesWarehouse && matchesDate
})
```

---

## 🛠️ Advanced Customization

### **Custom Pagination Display:**
```javascript
// Show items 1-10 of 100
<span>
  Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
  to {Math.min(currentPage * itemsPerPage, filteredData.length)} 
  of {filteredData.length} items
</span>
```

### **Pre-filter Options from Data:**
```javascript
// Get unique warehouse names from data
const uniqueWarehouses = [...new Set(items.map(i => i.warehouse_name))]

<select value={warehouseFilter} onChange={...}>
  <option value="">All Warehouses</option>
  {uniqueWarehouses.map(wh => (
    <option key={wh} value={wh}>{wh}</option>
  ))}
</select>
```

### **Combine Multiple Search Terms:**
```javascript
const filtered = items.filter(item => {
  const searchTerms = searchTerm.toLowerCase().split(' ')
  return searchTerms.every(term =>
    item.name?.toLowerCase().includes(term) ||
    item.code?.toLowerCase().includes(term)
  )
})
```

### **Search with Boost Weight:**
```javascript
const filtered = items.filter(item => {
  const search = searchTerm.toLowerCase()
  // Exact match gets priority
  if (item.code?.toLowerCase() === search) return true
  // Partial match
  if (item.code?.toLowerCase().includes(search)) return true
  if (item.name?.toLowerCase().includes(search)) return true
  return false
}).sort((a, b) => {
  // Sort by exact matches first
  const aExact = a.code?.toLowerCase() === searchTerm.toLowerCase()
  const bExact = b.code?.toLowerCase() === searchTerm.toLowerCase()
  return aExact ? -1 : bExact ? 1 : 0
})
```

---

## 📊 Performance Considerations

### **For Large Datasets (1000+ items):**

#### **Option 1: Server-Side Pagination** (Recommended)
```javascript
// Fetch paginated data from server
const fetchItems = async (page, filters) => {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('limit', itemsPerPage)
  params.append('search', searchTerm)
  params.append('status', statusFilter)
  
  const response = await axios.get(`/api/items?${params}`)
  setItems(response.data.data)
  setTotalCount(response.data.total)
}
```

#### **Option 2: Lazy Load More**
```javascript
const [allItems, setAllItems] = useState([])
const [hasMore, setHasMore] = useState(true)

const loadMore = async () => {
  const newPage = Math.floor(allItems.length / itemsPerPage) + 1
  const response = await axios.get(`/api/items?page=${newPage}`)
  setAllItems([...allItems, ...response.data.data])
  setHasMore(response.data.hasMore)
}
```

#### **Option 3: Virtual Scrolling** (For tables)
```javascript
// Use react-window or react-virtual for large lists
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={filteredItems.length}
  itemSize={35}
>
  {({ index, style }) => (
    <div style={style}>
      {/* Row content */}
    </div>
  )}
</FixedSizeList>
```

---

## 🧪 Testing the Implementation

### **Test Cases:**

```javascript
describe('Pagination & Filters', () => {
  test('should filter items by search term', () => {
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes('test')
    )
    expect(filtered.length).toBeGreaterThan(0)
  })

  test('should filter items by status', () => {
    const filtered = items.filter(item => item.status === 'active')
    expect(filtered.every(i => i.status === 'active')).toBe(true)
  })

  test('should paginate correctly', () => {
    const page = 2
    const pageSize = 10
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paged = filteredItems.slice(start, end)
    expect(paged.length).toBeLessThanOrEqual(pageSize)
  })

  test('should clear all filters', () => {
    handleClearFilters()
    expect(searchTerm).toBe('')
    expect(statusFilter).toBe('')
    expect(currentPage).toBe(1)
  })

  test('should show correct empty state', () => {
    const { getByText } = render(<Component />)
    expect(getByText(/no items match/i)).toBeInTheDocument()
  })
})
```

---

## 🎨 CSS Classes to Use

```css
.inventory-filters { /* Filter container */ }
.inventory-filters input { /* Search box */ }
.inventory-filters select { /* Dropdown filter */ }
.inventory-items-table { /* Table styling */ }
.no-data { /* Empty state container */ }
.pagination-wrapper { /* Pagination container */ }
.pagination-info { /* "Showing X to Y" text */ }
.pagination { /* Page buttons */ }
.pagination-btn { /* Individual page button */ }
.pagination-btn.active { /* Current page button */ }
```

---

## 📝 Checklist for Implementation

- [ ] Import Pagination component
- [ ] Add filter state variables
- [ ] Add pagination state variables
- [ ] Implement filtering logic
- [ ] Implement pagination calculations
- [ ] Create clear filters handler
- [ ] Render filter inputs
- [ ] Render empty states (loading, empty, no-matches)
- [ ] Render paginated data table
- [ ] Render Pagination component
- [ ] Test on desktop (1920px, 1440px)
- [ ] Test on tablet (768px)
- [ ] Test on mobile (375px)
- [ ] Test with dark mode
- [ ] Test all filter combinations
- [ ] Test pagination edge cases

---

## 🚀 Tips for Best Results

✅ **Always reset pagination to page 1** when filters change
✅ **Show filters only when data exists**
✅ **Provide clear empty state messages**
✅ **Make search case-insensitive**
✅ **Allow combining multiple filters**
✅ **Show item count in pagination info**
✅ **Support keyboard navigation**
✅ **Test on mobile devices**
✅ **Consider performance with large datasets**
✅ **Provide visual feedback for active filters**

---

## 🔗 References

- **Pagination Component:** `c:\repo\frontend\src\pages\Inventory\Pagination.jsx`
- **Example Pages:** All 8 inventory pages
- **CSS:** `c:\repo\frontend\src\pages\Inventory\Inventory.css`
- **Documentation:** `PAGINATION_QUICK_REFERENCE.md`

---

**Ready to implement pagination on other pages!** Use this guide as your template. 🚀
