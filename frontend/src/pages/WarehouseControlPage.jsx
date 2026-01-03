import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { getWarehouses } from '../api/inventory'

const WarehouseControlPage = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [warehouses, setWarehouses] = useState([])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getWarehouses()
        if (active) setWarehouses(data || [])
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

  return (
    <div className="page">
      <PageHeader title="Warehouse Control" subtitle="Live utilization, contact grid and capacity view" />
      {loading && <div className="loader">Loading warehouses…</div>}
      {error && <div className="error">Unable to load warehouses</div>}
      {!loading && !error && (
        <div className="card">
          <div className="table">
            <div className="table-head">
              <span>Name</span>
              <span>Location</span>
              <span>Capacity</span>
              <span>Manager</span>
              <span>Status</span>
            </div>
            {warehouses.map(entry => (
              <div key={entry.warehouse_id || entry.id} className="table-row">
                <span>{entry.warehouse_name || entry.name}</span>
                <span>{entry.location || entry.address}</span>
                <span>{entry.capacity ? `${entry.capacity.toLocaleString()} units` : '—'}</span>
                <span>{entry.manager_name || entry.contact_person || '—'}</span>
                <StatusBadge status={(entry.status || 'Optimal').toLowerCase()} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WarehouseControlPage
