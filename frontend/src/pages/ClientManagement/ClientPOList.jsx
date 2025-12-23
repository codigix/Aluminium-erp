import { useState, useEffect } from 'react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import AdvancedFilters from '../../components/AdvancedFilters'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit2, Trash2, Calendar, DollarSign, Download, Upload, Check, X } from 'lucide-react'
import ImportClientPOModal from '../../components/ClientManagement/ImportClientPOModal'
import './ClientManagement.css'

const XLSX = window.XLSX
const Swal = window.Swal

export default function ClientPOs() {
  const navigate = useNavigate()
  const [pos, setPOs] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    total_value: 0
  })
  const [filters, setFilters] = useState({
    status: '',
    client_id: '',
    search: ''
  })
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  useEffect(() => {
    fetchClients()
    fetchPOs()
  }, [filters])

  const fetchClients = async () => {
    try {
      const res = await fetch(`/api/selling/customers`)
      const data = await res.json()
      if (data.success) {
        setClients(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  const fetchPOs = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      )
      const res = await fetch(`/api/client-pos?${query}`)
      const data = await res.json()
      if (data.success) {
        setPOs(data.data || [])
        calculateStats(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch client POs')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    const total = data.length
    const pending = data.filter(po => po.po_status === 'draft' || po.po_status === 'pending').length
    const confirmed = data.filter(po => po.po_status === 'confirmed').length
    const total_value = data.reduce((sum, po) => sum + (parseFloat(po.total_value) || 0), 0)
    setStats({ total, pending, confirmed, total_value })
  }

  const handleDelete = async (po_id) => {
    if (!confirm('Are you sure you want to delete this Client PO?')) return
    try {
      const res = await fetch(`/api/client-pos/${po_id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchPOs()
      } else {
        setError(data.error || 'Failed to delete PO')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAccept = async (po_id) => {
    if (!confirm('Are you sure you want to accept this Client PO? This will create a Sales Order.')) return
    try {
      const res = await fetch(`/api/client-pos/${po_id}/accept`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        // Navigate to Sales Orders page
        navigate('/selling/sales-orders')
      } else {
        setError(data.error || 'Failed to accept PO')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const getStatusColor = (status) => {
    const statusMap = {
      draft: 'warning',
      pending: 'warning',
      confirmed: 'success',
      cancelled: 'danger',
      completed: 'success'
    }
    return statusMap[status] || 'default'
  }

  const downloadTemplate = async (format) => {
    try {
      setDownloadingTemplate(true)
      
      const today = new Date().toISOString().split('T')[0]
      
      const templateData = [
        {
          po_number: '',
          client_id: '',
          po_date: today,
          contact_person: 'John Doe',
          email_reference: 'john@example.com',
          po_status: 'draft'
        },
        {
          po_number: '',
          client_id: '',
          po_date: today,
          contact_person: 'Jane Smith',
          email_reference: 'jane@example.com',
          po_status: 'pending'
        },
        {
          po_number: 'PO-CUSTOM-001',
          client_id: '',
          po_date: today,
          contact_person: '',
          email_reference: '',
          po_status: 'draft'
        }
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Client POs')
      
      const fileName = `client-po-template.${format === 'xlsx' ? 'xlsx' : 'xls'}`
      XLSX.writeFile(wb, fileName)

      await Swal.fire({
        icon: 'success',
        title: 'Template Downloaded',
        text: `Template downloaded as ${format.toUpperCase()}`,
        timer: 2000,
        showConfirmButton: false
      })
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: err.message
      })
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const statusFilter = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Cancelled', value: 'cancelled' }
  ]

  const clientFilter = [
    { label: 'All Clients', value: '' },
    ...clients.map(c => ({ label: c.client_name, value: c.client_id }))
  ]

  return (
    <div className="space-y-6">
      <ImportClientPOModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        onSuccess={() => fetchPOs()}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Client Purchase Orders</h1>
          <p className="text-gray-500 mt-1">Manage all client purchase orders and track their status</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Button variant="secondary" icon={Download}>
              Download Template
            </Button>
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10">
              <button
                onClick={() => downloadTemplate('xlsx')}
                disabled={downloadingTemplate}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700 disabled:opacity-50"
              >
                <Download size={16} /> Download as .xlsx
              </button>
              <button
                onClick={() => downloadTemplate('xls')}
                disabled={downloadingTemplate}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700 disabled:opacity-50 border-t"
              >
                <Download size={16} /> Download as .xls
              </button>
            </div>
          </div>
          <Button variant="secondary" icon={Upload} onClick={() => setShowImportModal(true)}>
            Import Client POs
          </Button>
          <Link to="/client-management/client-pos/new">
            <Button variant="primary" icon={Plus}>Create Client PO</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <div className="text-sm font-semibold text-gray-600">Total POs</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{stats.total}</div>
        </Card>
        <Card className="bg-orange-50">
          <div className="text-sm font-semibold text-gray-600">Pending POs</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{stats.pending}</div>
        </Card>
        <Card className="bg-green-50">
          <div className="text-sm font-semibold text-gray-600">Confirmed POs</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{stats.confirmed}</div>
        </Card>
        <Card className="bg-purple-50">
          <div className="text-sm font-semibold text-gray-600">Total Value</div>
          <div className="text-2xl font-bold text-purple-600 mt-2">
            ₹{stats.total_value?.toLocaleString('en-IN')}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <AdvancedFilters
        filters={filters}
        setFilters={setFilters}
        filterConfig={[
          { key: 'status', label: 'Status', type: 'select', options: statusFilter },
          { key: 'client_id', label: 'Client', type: 'select', options: clientFilter },
          { key: 'search', label: 'Search by PO No', type: 'text' }
        ]}
      />

      {/* POs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">PO No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Client</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
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
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No client POs found
                  </td>
                </tr>
              ) : (
                pos.map((po) => (
                  <tr key={po.po_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{po.po_number || po.po_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">{po.client_name || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">₹{(parseFloat(po.total_value) || 0).toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(po.po_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusColor(po.po_status)}>
                        {po.po_status?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {po.po_status !== 'confirmed' && (
                          <button
                            onClick={() => handleAccept(po.po_id)}
                            className="p-2 hover:bg-green-100 rounded text-green-600"
                            title="Accept & Create Sales Order"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <Link to={`/client-management/client-pos/${po.po_id}/review`}>
                          <button className="p-2 hover:bg-blue-100 rounded text-blue-600" title="View">
                            <Eye size={16} />
                          </button>
                        </Link>
                        <Link to={`/client-management/client-pos/${po.po_id}/edit`}>
                          <button className="p-2 hover:bg-yellow-100 rounded text-yellow-600" title="Edit">
                            <Edit2 size={16} />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(po.po_id)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                          title="Delete"
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
