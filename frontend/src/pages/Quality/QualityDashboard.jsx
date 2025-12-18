import React, { useState, useEffect } from 'react'
import { ChevronDown, Plus, TrendingUp, AlertCircle } from 'lucide-react'
import axios from 'axios'

const QualityDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    incomingQC: 0,
    inProcessQC: 0,
    finalQC: 0,
    ncrOpen: 0,
    capaActions: 0,
    acceptanceRate: 0,
    defectRate: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/api/quality/dashboard')
      setDashboardData(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, subtitle, color, icon: Icon }) => (
    <div className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${color}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className="w-8 h-8 text-gray-400" />}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quality Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor quality metrics and inspection data</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          New Inspection
        </button>
      </div>

      {/* Quality Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Incoming QC"
          value={dashboardData.incomingQC}
          subtitle="Pending"
          color="border-blue-500"
          icon={AlertCircle}
        />
        <StatCard
          title="In-Process QC"
          value={dashboardData.inProcessQC}
          subtitle="Active"
          color="border-purple-500"
          icon={TrendingUp}
        />
        <StatCard
          title="Final QC"
          value={`${dashboardData.finalQC}%`}
          subtitle="Pass Rate"
          color="border-green-500"
          icon={TrendingUp}
        />
        <StatCard
          title="NCR Open"
          value={dashboardData.ncrOpen}
          subtitle="Pending"
          color="border-red-500"
          icon={AlertCircle}
        />
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acceptance Rate</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-green-600">{dashboardData.acceptanceRate}%</p>
              <p className="text-sm text-gray-600 mt-1">Target: 98%</p>
            </div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-100 to-green-50 flex items-center justify-center">
              <svg className="w-16 h-16" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeDasharray={`${dashboardData.acceptanceRate * 2.83} 283`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Defect Rate</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-red-600">{dashboardData.defectRate}%</p>
              <p className="text-sm text-gray-600 mt-1">Target: &lt;2%</p>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                <span className="inline-block w-3 h-3 bg-red-500 rounded mr-2"></span>
                Critical: 2%
              </div>
              <div className="text-xs text-gray-600">
                <span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-2"></span>
                Major: 3%
              </div>
              <div className="text-xs text-gray-600">
                <span className="inline-block w-3 h-3 bg-blue-500 rounded mr-2"></span>
                Minor: 1%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Inspections</h3>
          <a href="/quality/checks" className="text-blue-600 text-sm hover:underline">
            View All
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Inspection ID</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">GRN No.</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">QI-001</td>
                <td className="py-3 px-4">GRN-142</td>
                <td className="py-3 px-4">Incoming</td>
                <td className="py-3 px-4"><span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">Pending</span></td>
                <td className="py-3 px-4">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default QualityDashboard
