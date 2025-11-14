import React, { useState, useEffect } from 'react'
import axios from 'axios'
import DataTable from '../../components/Table/DataTable'
import Alert from '../../components/Alert/Alert'
import Badge from '../../components/Badge/Badge'
import Pagination from './Pagination'
import Button from '../../components/Button/Button'
import { Search, BarChart3, X } from 'lucide-react'
import './Inventory.css'

export default function StockBalance() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [warehouses, setWarehouses] = useState([])
  const [stats, setStats] = useState({ total: 0, low: 0, outOfStock: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    fetchWarehouses()
    fetchStockBalance()
  }, [warehouseFilter])

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get('/api/stock/warehouses')
      setWarehouses(response.data.data || [])
    } catch (err) {
      console.error('Failed to fetch warehouses:', err)
    }
  }

  const fetchStockBalance = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (warehouseFilter) params.append('warehouse_id', warehouseFilter)
      
      const response = await axios.get(`/api/stock/stock-balance?${params}`)
      const stockData = response.data.data || []
      
      // Calculate statistics
      const lowStock = stockData.filter(s => s.quantity <= (s.reorder_level || 0)).length
      const outOfStock = stockData.filter(s => s.quantity === 0).length
      
      setStocks(stockData)
      setStats({
        total: stockData.length,
        low: lowStock,
        outOfStock: outOfStock
      })
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch stock balance')
      setStocks([])
    } finally {
      setLoading(false)
    }
  }

  const getStockStatus = (quantity, reorderLevel) => {
    if (quantity === 0) return { text: 'Out of Stock', class: 'status-out-of-stock' }
    if (quantity <= reorderLevel) return { text: 'Low Stock', class: 'status-low-stock' }
    return { text: 'In Stock', class: 'status-in-stock' }
  }

  const getStockStatusValue = (quantity, reorderLevel) => {
    if (quantity === 0) return 'out-of-stock'
    if (quantity <= reorderLevel) return 'low-stock'
    return 'in-stock'
  }

  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          stock.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === '' || getStockStatusValue(stock.quantity, stock.reorder_level) === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = filteredStocks.slice(startIndex, endIndex)

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setWarehouseFilter('')
    setCurrentPage(1)
  }

  const columns = [
    { key: 'item_code', label: 'Item Code' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'warehouse_name', label: 'Warehouse' },
    {
      key: 'quantity',
      label: 'Current Stock',
      render: (row) => <strong>{row.quantity}</strong>
    },
    { key: 'uom', label: 'UOM' },
    {
      key: 'reorder_level',
      label: 'Reorder Level',
      render: (row) => row.reorder_level || 'N/A'
    },
    {
      key: 'stock_status',
      label: 'Status',
      render: (row) => {
        const status = getStockStatus(row.quantity, row.reorder_level)
        return <Badge className={status.class}>{status.text}</Badge>
      }
    },
    {
      key: 'value',
      label: 'Stock Value',
      render: (row) => `₹${((row.quantity || 0) * (row.rate || 0)).toFixed(2)}`
    }
  ]

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h1>
          <BarChart3 size={28} style={{ display: 'inline', marginRight: '10px' }} />
          Stock Balance
        </h1>
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      {/* Statistics */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <div className="inventory-stat-label">Total Items</div>
          <div className="inventory-stat-value">{stats.total}</div>
        </div>
        <div className="inventory-stat-card">
          <div className="inventory-stat-label">Low Stock Items</div>
          <div className="inventory-stat-value" style={{ color: '#ef4444' }}>
            {stats.low}
          </div>
        </div>
        <div className="inventory-stat-card">
          <div className="inventory-stat-label">Out of Stock</div>
          <div className="inventory-stat-value" style={{ color: '#6b7280' }}>
            {stats.outOfStock}
          </div>
        </div>
      </div>

      {/* Filters */}
      {stocks.length > 0 && (
        <div className="inventory-filters">
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search by item code or name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <select 
            value={warehouseFilter} 
            onChange={(e) => {
              setWarehouseFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(wh => (
              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                {wh.warehouse_name}
              </option>
            ))}
          </select>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
          {(searchTerm || statusFilter || warehouseFilter) && (
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

      {/* Table */}
      {loading ? (
        <div className="no-data">
          <BarChart3 size={48} style={{ opacity: 0.5 }} />
          <p>Loading stock balance...</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="no-data">
          <BarChart3 size={48} style={{ opacity: 0.5 }} />
          <p>📊 No stock items available.</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>Stock entries will appear here once created.</p>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="no-data">
          <BarChart3 size={48} style={{ opacity: 0.5 }} />
          <p>❌ No items match your filters.</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={paginatedData} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredStocks.length}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}
    </div>
  )
}