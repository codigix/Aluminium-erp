import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { getStockLedger } from '../api/inventory'

const MaterialInwardPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ledger, setLedger] = useState([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getStockLedger()
        if (mounted) setLedger(data || [])
      } catch (err) {
        if (mounted) setError(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const inbound = useMemo(
    () => ledger.filter(entry => ['receipt', 'transfer_in', 'adjustment'].includes((entry.transaction_type || '').toLowerCase())),
    [ledger]
  )

  const totalQty = inbound.reduce((sum, entry) => sum + Number(entry.qty_in || entry.qty || 0), 0)

  return (
    <div className="page">
      <PageHeader title="Material Inward" subtitle="Inbound receipts, QC status and routing" />
      {loading && <div className="loader">Loading inbound queue…</div>}
      {error && <div className="error">Unable to load inbound data</div>}
      {!loading && !error && (
        <>
          <div className="card compact">
            <div className="card-header">
              <p>Inbound Today</p>
              <span>{totalQty.toLocaleString()} units</span>
            </div>
          </div>
          <div className="card">
            <div className="table">
              <div className="table-head">
                <span>Date</span>
                <span>Material</span>
                <span>Qty</span>
                <span>Warehouse</span>
                <span>Type</span>
              </div>
              {inbound.map(entry => (
                <div key={entry.ledger_id || `${entry.item_code}-${entry.posting_date}-in`} className="table-row">
                  <span>{entry.posting_date?.slice(0, 10)}</span>
                  <span>{entry.item_name || entry.item_code}</span>
                  <span>{entry.qty_in || entry.qty}</span>
                  <span>{entry.warehouse_name}</span>
                  <StatusBadge status={entry.transaction_type} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default MaterialInwardPage
