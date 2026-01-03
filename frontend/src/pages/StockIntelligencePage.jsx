import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { getStockBalance, getStockLedger, getBatches } from '../api/inventory'

const StockIntelligencePage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [ledger, setLedger] = useState([])
  const [batches, setBatches] = useState([])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [balanceData, ledgerData, batchData] = await Promise.all([
          getStockBalance(),
          getStockLedger(),
          getBatches()
        ])
        if (!active) return
        setItems(balanceData || [])
        setLedger(ledgerData || [])
        setBatches(batchData || [])
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

  const analytics = useMemo(() => {
    if (!items.length) {
      return { highValue: [], movers: [], ageing: [] }
    }
    const highValue = [...items]
      .map(entry => ({ ...entry, value: Number(entry.quantity || 0) * Number(entry.rate || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const movementMap = ledger
      .filter(entry => new Date(entry.posting_date) >= thirtyDaysAgo)
      .reduce((map, entry) => {
        const key = entry.item_code
        if (!map[key]) {
          map[key] = { item_code: entry.item_code, item_name: entry.item_name || entry.item_code, movement: 0 }
        }
        map[key].movement += Number(entry.qty_out || 0) + Number(entry.qty_in || 0)
        return map
      }, {})
    const movers = Object.values(movementMap)
      .sort((a, b) => b.movement - a.movement)
      .slice(0, 5)

    const ageing = [...items]
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
      .slice(0, 5)

    return { highValue, movers, ageing }
  }, [items, ledger])

  return (
    <div className="page">
      <PageHeader title="Stock Intelligence" subtitle="Value concentration, movement velocity and batch health" />
      {loading && <div className="loader">Compiling analytics…</div>}
      {error && <div className="error">Unable to load analytics</div>}
      {!loading && !error && (
        <div className="grid two">
          <div className="card">
            <div className="card-header">
              <p>High Value Concentration</p>
              <span>Top five items</span>
            </div>
            <div className="table">
              <div className="table-head">
                <span>Item</span>
                <span>Qty</span>
                <span>Value</span>
              </div>
              {analytics.highValue.map(entry => (
                <div key={`${entry.item_code}-value`} className="table-row">
                  <span>{entry.item_name || entry.item_code}</span>
                  <span>{entry.quantity}</span>
                  <span>₹{Math.round(entry.value).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <p>Fast Movers</p>
              <span>Last 30 days</span>
            </div>
            <div className="table">
              <div className="table-head">
                <span>Item</span>
                <span>Movement</span>
              </div>
              {analytics.movers.map(entry => (
                <div key={`${entry.item_code}-move`} className="table-row">
                  <span>{entry.item_name}</span>
                  <span>{entry.movement.toLocaleString()} units</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <p>Batch Watchlist</p>
              <span>Traceability</span>
            </div>
            <div className="table">
              <div className="table-head">
                <span>Batch</span>
                <span>Item</span>
                <span>Qty Available</span>
                <span>Expiry</span>
              </div>
              {batches.slice(0, 6).map(entry => (
                <div key={entry.batch_id || entry.batch_no} className="table-row">
                  <span>{entry.batch_no}</span>
                  <span>{entry.item_name || entry.item_code}</span>
                  <span>{entry.qty_available}</span>
                  <span>{entry.expiry_date?.slice(0, 10) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <p>Ageing Inventory</p>
              <span>Highest quantity on floor</span>
            </div>
            <div className="table">
              <div className="table-head">
                <span>Item</span>
                <span>Qty</span>
                <span>Warehouse</span>
              </div>
              {analytics.ageing.map(entry => (
                <div key={`${entry.item_code}-age`} className="table-row">
                  <span>{entry.item_name || entry.item_code}</span>
                  <span>{entry.quantity}</span>
                  <span>{entry.warehouse_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockIntelligencePage
