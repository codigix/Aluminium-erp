import React, { useState, useEffect } from 'react'
import { Plus, AlertTriangle, Search, Filter } from 'lucide-react'
import axios from 'axios'

const NonConformance = () => {
  const [ncrList, setNcrList] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    item_name: '',
    defect_qty: '',
    defect_description: '',
    severity: 'major',
    reported_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchNCRs()
  }, [filterStatus])

  const fetchNCRs = async () => {
    try {
      setLoading(true)
      const url = filterStatus === 'all' 
        ? '/api/quality/ncr' 
        : `/api/quality/ncr?status=${filterStatus}`
      const response = await axios.get(url)
      setNcrList(response.data || [])
    } catch (error) {
      console.error('Error fetching NCRs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/quality/ncr', formData)
      fetchNCRs()
      setShowForm(false)
      setFormData({
        item_name: '',
        defect_qty: '',
        defect_description: '',
        severity: 'major',
        reported_date: new Date().toISOString().split('T')[0]
      })
    } catch (error) {
      console.error('Error creating NCR:', error)
    }
  }

  const filteredNCRs = ncrList.filter(ncr =>
    ncr.ncr_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ncr.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSeverityColor = (severity) => {
    const colors = {
      'critical': 'bg-red-100 text-red-800 border-red-300',
      'major': 'bg-orange-100 text-orange-800 border-orange-300',
      'minor': 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
    return colors[severity] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadge = (status) => {
    const colors = {
      'open': 'bg-red-100 text-red-800',
      'investigation': 'bg-blue-100 text-blue-800',
      'root_cause_identified': 'bg-purple-100 text-purple-800',
      'capa_assigned': 'bg-orange-100 text-orange-800',
      'closed': 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Non-Conformance Management</h1>
          <p className="text-gray-600 mt-1">Track and manage non-conforming materials</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          New NCR
        </button>
      </div>

      {/* NCR Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Create New NCR</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Defect Quantity</label>
                  <input
                    type="number"
                    value={formData.defect_qty}
                    onChange={(e) => setFormData({ ...formData, defect_qty: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Defect Description</label>
                <textarea
                  value={formData.defect_description}
                  onChange={(e) => setFormData({ ...formData, defect_description: e.target.value })}
                  rows="4"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                ></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium"
                >
                  Create NCR
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border rounded-lg py-2 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search NCR No, Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="investigation">Under Investigation</option>
            <option value="root_cause_identified">Root Cause Found</option>
            <option value="capa_assigned">CAPA Assigned</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* NCR List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : filteredNCRs.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No NCRs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">NCR No</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Item</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Severity</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Qty</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Status</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Reported Date</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNCRs.map(ncr => (
                  <tr key={ncr.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{ncr.ncr_no}</td>
                    <td className="py-3 px-4 text-gray-600">{ncr.item_name}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(ncr.severity)}`}>
                        {ncr.severity?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{ncr.defect_qty}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(ncr.status)}`}>
                        {ncr.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{ncr.reported_date}</td>
                    <td className="py-3 px-4">
                      <a href={`/quality/ncr/${ncr.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default NonConformance
