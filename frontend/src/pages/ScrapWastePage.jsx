import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { getReconciliations } from '../api/inventory'

const ScrapWastePage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [records, setRecords] = useState([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getReconciliations()
        if (mounted) setRecords(data || [])
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

  const insights = useMemo(() => {
    if (!records.length) return { variance: 0, open: 0 }
    const variance = records.reduce((sum, entry) => sum + (entry.items || []).reduce((inner, item) => inner + Math.abs(Number(item.variance || 0)), 0), 0)
    const open = records.filter(entry => entry.status !== 'submitted').length
    return { variance, open }
  }, [records])

  return (
    <div className="page">
      <PageHeader title="Scrap & Waste" subtitle="Reconciliation outcomes, variance and disposition" />
      {loading && <div className="loader">Loading reconciliation data…</div>}
      {error && <div className="error">Unable to load scrap data</div>}
      {!loading && !error && (
        <>
          <div className="grid stats">
            <div className="stat-card">
              <p>Total Variance</p>
              <h2>{insights.variance.toLocaleString()} units</h2>
              <span>Across active reconciliations</span>
            </div>
            <div className="stat-card">
              <p>Open Actions</p>
              <h2>{insights.open}</h2>
              <span>Pending submission</span>
            </div>
          </div>
          <div className="card">
            <div className="table">
              <div className="table-head">
                <span>Date</span>
                <span>Warehouse</span>
                <span>Items</span>
                <span>Variance</span>
                <span>Status</span>
              </div>
              {records.map(entry => (
                <div key={entry.reconciliation_id || entry.id} className="table-row">
                  <span>{entry.reconciliation_date?.slice(0, 10)}</span>
                  <span>{entry.warehouse_name}</span>
                  <span>{entry.item_count || entry.items?.length || 0}</span>
                  <span>
                    {(entry.items || []).reduce((sum, item) => sum + Number(item.variance || 0), 0)}
                  </span>
                  <StatusBadge status={entry.status} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ScrapWastePage
