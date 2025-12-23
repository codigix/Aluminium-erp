import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import DataTable from '../../components/Table/DataTable'
import AdvancedFilters from '../../components/AdvancedFilters'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit2, Trash2, Building2, Mail, MapPin, Phone, TrendingUp } from 'lucide-react'
import './ClientManagement.css'

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  })
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchClients()
  }, [filters])

  const fetchClients = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      )
      const res = await fetch(`/api/clients?${query}`)
      const data = await res.json()
      if (data.success) {
        setClients(data.data || [])
        calculateStats(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch clients')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    const total = data.length
    const active = data.filter(c => c.is_active).length
    const inactive = total - active
    setStats({ total, active, inactive })
  }

  const handleDelete = async (client_id) => {
    if (!confirm('Are you sure you want to delete this client?')) return
    try {
      const res = await fetch(`/api/clients/${client_id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchClients()
      } else {
        setError(data.error || 'Failed to delete client')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const statusFilter = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          <p className="text-gray-500 mt-1">Manage all client information and their orders</p>
        </div>
        <Link to="/client-management/clients/new">
          <Button variant="primary" icon={Plus}>Create Client</Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <div className="text-sm font-semibold text-gray-600">Total Clients</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{stats.total}</div>
        </Card>
        <Card className="bg-green-50">
          <div className="text-sm font-semibold text-gray-600">Active Clients</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{stats.active}</div>
        </Card>
        <Card className="bg-orange-50">
          <div className="text-sm font-semibold text-gray-600">Inactive Clients</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{stats.inactive}</div>
        </Card>
        <Card className="bg-purple-50">
          <div className="text-sm font-semibold text-gray-600">Active Rate</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">
            {stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(0) : 0}%
          </div>
        </Card>
      </div>

      {/* Filters */}
      <AdvancedFilters
        filters={filters}
        setFilters={setFilters}
        filterConfig={[
          { key: 'status', label: 'Status', type: 'select', options: statusFilter },
          { key: 'search', label: 'Search by Name/Email', type: 'text' }
        ]}
      />

      {/* Clients Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Client Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Address</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No clients found
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.client_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{client.client_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{client.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{client.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{client.address || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={client.is_active ? 'success' : 'warning'}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link to={`/client-management/clients/${client.client_id}`}>
                          <button className="p-2 hover:bg-blue-100 rounded text-blue-600">
                            <Eye size={16} />
                          </button>
                        </Link>
                        <Link to={`/client-management/clients/${client.client_id}/edit`}>
                          <button className="p-2 hover:bg-green-100 rounded text-green-600">
                            <Edit2 size={16} />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(client.client_id)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
