import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { getTransfers } from '../api/inventory'

const TransferPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transfers, setTransfers] = useState([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getTransfers()
        if (mounted) setTransfers(data || [])
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

  return (
    <div className="page">
      <PageHeader title="Inter-Warehouse Transfer" subtitle="In-transit jobs, receiving status and routing" />
      {loading && <div className="loader">Loading transfers…</div>}
      {error && <div className="error">Unable to load transfers</div>}
      {!loading && !error && (
        <div className="card">
          <div className="table">
            <div className="table-head">
              <span>Transfer</span>
              <span>Route</span>
              <span>Date</span>
              <span>Items</span>
              <span>Status</span>
            </div>
            {transfers.map(entry => (
              <div key={entry.transfer_id || entry.id} className="table-row">
                <span>{entry.reference || entry.transfer_id}</span>
                <span>{entry.from_warehouse || entry.source} → {entry.to_warehouse || entry.destination}</span>
                <span>{entry.transfer_date?.slice(0, 10)}</span>
                <span>{entry.item_count || entry.items?.length || 0}</span>
                <StatusBadge status={entry.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TransferPage
