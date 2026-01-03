import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import ActionBar from '../components/ActionBar'
import DashboardSection from '../components/DashboardSection'
import ActivityFeed from '../components/ActivityFeed'
import StatusBadge from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import { getWarehouses, getStockBalance, getStockLedger } from '../api/inventory'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

const InventoryDashboardPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [ledger, setLedger] = useState([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [warehouseData, stockData, ledgerData] = await Promise.all([
          getWarehouses(),
          getStockBalance(),
          getStockLedger({ from_date: '', to_date: '' })
        ])
        if (!mounted) return
        setWarehouses(warehouseData || [])
        setStockItems(stockData || [])
        setLedger(ledgerData || [])
      } catch (err) {
        if (!mounted) return
        setError(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const dashboard = useMemo(() => {
    if (!stockItems.length) {
      return {
        totalValue: 0,
        lowStock: [],
        coverageDays: 0,
        netFlow: 0
      }
    }
    const totalValue = stockItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0)
    const lowStock = stockItems.filter(item => Number(item.quantity || 0) <= Number(item.reorder_level || 0))
    const dailyIssue = stockItems.reduce((sum, item) => sum + Number(item.consumption_rate || 0), 0)
    const coverageDays = dailyIssue ? Math.round(stockItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0) / dailyIssue) : 0
    const today = new Date().toISOString().slice(0, 10)
    const todaysLedger = ledger.filter(entry => (entry.posting_date || '').startsWith(today))
    const netFlow = todaysLedger.reduce((sum, entry) => sum + Number(entry.qty_in || 0) - Number(entry.qty_out || 0), 0)
    return {
      totalValue,
      lowStock,
      coverageDays,
      netFlow
    }
  }, [stockItems, ledger])

  const recentMovements = useMemo(() => ledger.slice(0, 6), [ledger])

  return (
    <div className="page">
      <PageHeader title="Inventory Dashboard" subtitle="Live overview across warehouses and value streams" />
      {loading && <div className="loader">Loading live inventory…</div>}
      {error && <div className="error">Unable to load inventory data</div>}
      {!loading && !error && (
        <>
          <div className="grid stats">
            <StatCard label="Network Warehouses" value={warehouses.length} helper="Active locations" />
            <StatCard label="Stock On Hand" value={currency.format(dashboard.totalValue)} helper="Valuation" />
            <StatCard label="Low Stock Alerts" value={dashboard.lowStock.length} helper="Below reorder level" />
            <StatCard label="Net Flow Today" value={`${dashboard.netFlow >= 0 ? '+' : ''}${dashboard.netFlow.toLocaleString()}`} helper="Qty movement" />
          </div>
          <div className="grid two">
            <div className="card">
              <div className="card-header">
                <p>Warehouse Utilization</p>
                <span>{dashboard.coverageDays} days coverage</span>
              </div>
              <div className="list">
                {warehouses.map((item, index) => (
                  <div key={item.warehouse_id || item.id || `warehouse-${index}`} className="list-row">
                    <div>
                      <p>{item.warehouse_name || item.name}</p>
                      <span>{item.location || item.address}</span>
                    </div>
                    <div className="progress">
                      <div style={{ width: `${item.utilization || item.capacity ? Math.min(100, Math.round(((item.occupied || 0) / (item.capacity || 1)) * 100)) : 0}%` }} />
                    </div>
                    <StatusBadge status={(item.status || 'Optimal').toLowerCase()} />
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <p>Recent Movements</p>
                <span>Last six ledger events</span>
              </div>
              <div className="table">
                <div className="table-head">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Warehouse</span>
                  <span>Type</span>
                </div>
                {recentMovements.map(entry => (
                  <div key={entry.ledger_id || `${entry.item_code}-${entry.posting_date}`} className="table-row">
                    <span>{entry.item_name || entry.item_code}</span>
                    <span>{entry.qty_in ? `+${entry.qty_in}` : `-${entry.qty_out}`}</span>
                    <span>{entry.warehouse_name}</span>
                    <StatusBadge status={entry.transaction_type} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {dashboard.lowStock.length > 0 && (
            <div className="card">
              <div className="card-header">
                <p>Critical Materials</p>
                <span>Items below buffer</span>
              </div>
              <div className="table">
                <div className="table-head">
                  <span>Material</span>
                  <span>Available</span>
                  <span>Reorder</span>
                  <span>Lead Time</span>
                </div>
                {dashboard.lowStock.map((item, index) => (
                  <div key={item.item_code || `lowstock-${index}`} className="table-row">
                    <span>{item.item_name || item.item_code}</span>
                    <span>{item.quantity}</span>
                    <span>{item.reorder_level}</span>
                    <span>{item.lead_time || item.leadTime || 'n/a'} days</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default InventoryDashboardPage
