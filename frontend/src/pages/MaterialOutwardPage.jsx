import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { getStockLedger } from '../api/inventory'

const MaterialOutwardPage = () => {
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

  const outbound = useMemo(
    () => ledger.filter(entry => ['issue', 'transfer_out'].includes((entry.transaction_type || '').toLowerCase())),
    [ledger]
  )

  const totalQty = outbound.reduce((sum, entry) => sum + Number(entry.qty_out || entry.qty || 0), 0)

  return (
    <div className="page">
      <PageHeader title="Material Outward" subtitle="Outbound commitments, dispatch readiness and audit trail" />
      {loading && <div className="loader">Loading outbound queue…</div>}
      {error && <div className="error">Unable to load outbound data</div>}
      {!loading && !error && (
        <>
          <div className="card compact">
            <div className="card-header">
              <p>Outbound Commitments</p>
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
              {outbound.map(entry => (
                <div key={entry.ledger_id || `${entry.item_code}-${entry.posting_date}-out`} className="table-row">
                  <span>{entry.posting_date?.slice(0, 10)}</span>
                  <span>{entry.item_name || entry.item_code}</span>
                  <span>{entry.qty_out || entry.qty}</span>
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

export default MaterialOutwardPage
