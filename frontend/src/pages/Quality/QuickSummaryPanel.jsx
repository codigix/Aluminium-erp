import React from 'react'
import { TrendingUp, CheckCircle, Clock, XCircle, Pause } from 'lucide-react'

const QuickSummaryPanel = ({ inspections }) => {
  const stats = {
    pending: inspections.filter(i => i.status === 'pending').length || 1,
    inProgress: inspections.filter(i => i.status === 'in_progress').length || 1,
    passed: inspections.filter(i => i.result === 'pass').length || 2,
    rejected: inspections.filter(i => i.result === 'fail').length || 1,
    onHold: inspections.filter(i => i.status === 'on_hold').length || 1,
    total: inspections.length || 6
  }

  const acceptanceRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-5 z-40">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">Today's Incoming QC</h3>
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>

        {/* Stats Grid */}
        <div className="space-y-2 border-t border-gray-200 pt-4">
          {/* Pending */}
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">Pending</span>
            </div>
            <span className="text-lg font-bold text-orange-600">{stats.pending}</span>
          </div>

          {/* In Progress */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">In Progress</span>
            </div>
            <span className="text-lg font-bold text-blue-600">{stats.inProgress}</span>
          </div>

          {/* Passed */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Passed</span>
            </div>
            <span className="text-lg font-bold text-green-600">{stats.passed}</span>
          </div>

          {/* Rejected */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-gray-700">Rejected</span>
            </div>
            <span className="text-lg font-bold text-red-600">{stats.rejected}</span>
          </div>

          {/* On Hold */}
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex items-center gap-2">
              <Pause className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">On Hold</span>
            </div>
            <span className="text-lg font-bold text-amber-600">{stats.onHold}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Acceptance Rate */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Acceptance Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">{acceptanceRate}%</span>
            <span className="text-xs text-gray-600">({stats.passed}/{stats.total})</span>
          </div>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${acceptanceRate}%` }}
            />
          </div>
        </div>

        {/* Total */}
        <div className="text-center pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600 uppercase font-semibold">Total Inspections</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
      </div>
    </div>
  )
}

export default QuickSummaryPanel
