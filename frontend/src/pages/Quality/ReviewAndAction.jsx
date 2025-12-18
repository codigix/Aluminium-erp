import React, { useState, useEffect } from 'react'
import { CheckCircle, Clock, AlertCircle, Search } from 'lucide-react'
import axios from 'axios'

const ReviewAndAction = () => {
  const [capaActions, setCapaActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCAPAActions()
  }, [filterStatus])

  const fetchCAPAActions = async () => {
    try {
      setLoading(true)
      const url = filterStatus === 'all'
        ? '/api/quality/capa'
        : `/api/quality/capa?status=${filterStatus}`
      const response = await axios.get(url)
      setCapaActions(response.data || [])
    } catch (error) {
      console.error('Error fetching CAPA actions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCAPAs = capaActions.filter(capa =>
    capa.capa_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    capa.ncr_id?.toString().includes(searchTerm)
  )

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-red-100 text-red-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'verified': 'bg-green-600 text-white',
      'closed': 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getActionTypeColor = (type) => {
    return type === 'corrective'
      ? 'bg-orange-100 text-orange-800'
      : 'bg-purple-100 text-purple-800'
  }

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-gray-600 text-sm">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Review & Action (CAPA)</h1>
        <p className="text-gray-600 mt-1">Manage corrective and preventive actions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={AlertCircle}
          label="Pending"
          value={capaActions.filter(c => c.status === 'pending').length}
          color="bg-red-500"
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={capaActions.filter(c => c.status === 'in_progress').length}
          color="bg-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={capaActions.filter(c => c.status === 'completed').length}
          color="bg-yellow-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Verified"
          value={capaActions.filter(c => c.status === 'verified').length}
          color="bg-green-500"
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search CAPA No, NCR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* CAPA Actions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCAPAs.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No CAPA actions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">CAPA No</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">NCR No</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Type</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Status</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Due Date</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Assigned To</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Owner</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCAPAs.map(capa => (
                  <tr key={capa.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{capa.capa_no}</td>
                    <td className="py-3 px-4 text-gray-600">{capa.ncr_no}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded ${getActionTypeColor(capa.action_type)}`}>
                        {capa.action_type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(capa.status)}
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(capa.status)}`}>
                          {capa.status?.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{capa.due_date}</td>
                    <td className="py-3 px-4 text-gray-600">{capa.assigned_to}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
                        {capa.assigned_initials || 'NA'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <a href={`/quality/capa/${capa.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
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

      {/* Timeline View */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">CAPA Timeline</h3>
        <div className="space-y-4">
          {filteredCAPAs.slice(0, 5).map((capa, index) => (
            <div key={capa.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full ${
                  capa.status === 'verified' ? 'bg-green-500' :
                  capa.status === 'completed' ? 'bg-blue-500' :
                  capa.status === 'in_progress' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                {index < filteredCAPAs.length - 1 && <div className="w-0.5 h-12 bg-gray-200"></div>}
              </div>
              <div className="flex-1 pb-4">
                <p className="font-semibold text-gray-900">{capa.capa_no}</p>
                <p className="text-sm text-gray-600">{capa.action_description}</p>
                <p className="text-xs text-gray-500 mt-1">Due: {capa.due_date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ReviewAndAction
