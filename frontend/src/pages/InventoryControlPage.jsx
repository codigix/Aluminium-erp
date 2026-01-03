import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { getStockBalance } from '../api/inventory'

const InventoryControlPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getStockBalance()
        if (active) setItems(data || [])
      } catch (err) {
        if (active) setError(err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!query) return items
    const term = query.toLowerCase()
    return items.filter(entry => (entry.item_name || entry.item_code || '').toLowerCase().includes(term))
  }, [items, query])

  const summary = useMemo(() => {
    if (!items.length) return { totalQty: 0, avgRate: 0 }
    const totalQty = items.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
    const totalValue = items.reduce((sum, entry) => sum + Number(entry.quantity || 0) * Number(entry.rate || 0), 0)
    return {
      totalQty,
      avgRate: totalQty ? Math.round(totalValue / totalQty) : 0
    }
  }, [items])

  return (
    <div className="page">
      <PageHeader
        title="Inventory Control"
        subtitle="Granular stock balance, reorder signals and valuation"
        actions={<input type="search" placeholder="Search material" value={query} onChange={event => setQuery(event.target.value)} />}
      />
      {loading && <div className="loader">Loading stock balance…</div>}
      {error && <div className="error">Unable to load stock balance</div>}
      {!loading && !error && (
        <>
          <div className="grid stats">
            <div className="stat-card">
              <p>Total Materials</p>
              <h2>{items.length}</h2>
              <span>Tracked items</span>
            </div>
            <div className="stat-card">
              <p>Quantity On Hand</p>
              <h2>{summary.totalQty.toLocaleString()}</h2>
              <span>All warehouses</span>
            </div>
            <div className="stat-card">
              <p>Average Carrying Rate</p>
              <h2>₹{summary.avgRate.toLocaleString()}</h2>
              <span>Per unit</span>
            </div>
          </div>
          <div className="card">
            <div className="table scrollable">
              <div className="table-head">
                <span>Item</span>
                <span>Warehouse</span>
                <span>Qty</span>
                <span>Reserved</span>
                <span>Reorder</span>
                <span>Rate</span>
              </div>
              {filtered.map(entry => (
                <div key={`${entry.item_code}-${entry.warehouse_id}`} className="table-row">
                  <span>{entry.item_name || entry.item_code}</span>
                  <span>{entry.warehouse_name}</span>
                  <span>{entry.quantity}</span>
                  <span>{entry.reserved_qty || 0}</span>
                  <span>{entry.reorder_level}</span>
                  <span>₹{Number(entry.rate || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default InventoryControlPage
