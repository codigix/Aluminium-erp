import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Table from '../../components/Table/Table'
import Input from '../../components/Input/Input'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import './Buying.css'

export default function Items() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState([])
  const [filters, setFilters] = useState({
    item_group: '',
    search: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchItemGroups()
    fetchItems()
  }, [filters])

  const fetchItemGroups = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/items/groups')
      const data = await res.json()
      if (data.success) {
        setGroups(data.data)
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      )
      const res = await fetch(`http://localhost:5000/api/items?${query}`)
      const data = await res.json()
      if (data.success) {
        setItems(data.data)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'item_code', label: 'Item Code' },
    { key: 'name', label: 'Item Name' },
    { key: 'item_group', label: 'Group' },
    { key: 'uom', label: 'UOM' },
    { key: 'hsn_code', label: 'HSN Code' },
    { key: 'gst_rate', label: 'GST %', format: (val) => `${val}%` }
  ]

  return (
    <div>
      <div className="flex-between mb-6">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Items Master</h2>
        <Link to="/masters/item/new">
          <Button variant="primary" className="flex items-center gap-2">
            <Plus size={20} /> Create Item
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="text"
            placeholder="Search Items..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            className="px-3 py-2 border border-neutral-300 rounded-lg"
            value={filters.item_group}
            onChange={(e) => setFilters({ ...filters, item_group: e.target.value })}
          >
            <option value="">All Groups</option>
            {groups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Items List */}
      <Card>
        {loading ? (
          <p className="text-center text-neutral-500">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-neutral-500">No items found</p>
        ) : (
          <Table
            columns={columns}
            data={items}
            onRowClick={(item) => navigate(`/masters/item/${item.item_code}`)}
          />
        )}
      </Card>
    </div>
  )
}