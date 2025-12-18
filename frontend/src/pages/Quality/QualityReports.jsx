import React, { useState } from 'react'
import { Download, BarChart3, TrendingUp } from 'lucide-react'

const QualityReports = () => {
  const [reports] = useState([
    {
      id: 1,
      name: 'Incoming QC Summary',
      description: 'Monthly summary of incoming inspection data',
      type: 'summary',
      period: 'December 2025',
      size: '2.4 MB'
    },
    {
      id: 2,
      name: 'Defect Trend Analysis',
      description: 'Historical defect trends and patterns',
      type: 'analysis',
      period: 'Q4 2025',
      size: '1.8 MB'
    },
    {
      id: 3,
      name: 'Supplier Performance Report',
      description: 'Supplier quality scorecard and metrics',
      type: 'supplier',
      period: 'December 2025',
      size: '3.2 MB'
    },
    {
      id: 4,
      name: 'NCR Analysis Report',
      description: 'Non-conformance trends and root causes',
      type: 'ncr',
      period: 'Q4 2025',
      size: '2.1 MB'
    },
    {
      id: 5,
      name: 'CAPA Effectiveness Report',
      description: 'Effectiveness verification of corrective actions',
      type: 'capa',
      period: 'December 2025',
      size: '1.6 MB'
    },
    {
      id: 6,
      name: 'Process Capability Analysis',
      description: 'Cpk and Ppk analysis for key processes',
      type: 'capability',
      period: 'Q4 2025',
      size: '2.8 MB'
    }
  ])

  const getReportIcon = (type) => {
    switch (type) {
      case 'summary':
      case 'analysis':
      case 'capability':
        return <BarChart3 className="w-5 h-5 text-blue-500" />
      case 'supplier':
        return <TrendingUp className="w-5 h-5 text-green-500" />
      case 'ncr':
        return <TrendingUp className="w-5 h-5 text-red-500" />
      case 'capa':
        return <TrendingUp className="w-5 h-5 text-orange-500" />
      default:
        return <BarChart3 className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quality Reports</h1>
        <p className="text-gray-600 mt-1">Generate and download quality analysis reports</p>
      </div>

      {/* Report Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">Total Reports</p>
          <p className="text-3xl font-bold text-gray-900">42</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">This Month</p>
          <p className="text-3xl font-bold text-blue-600">8</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">This Quarter</p>
          <p className="text-3xl font-bold text-green-600">24</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">This Year</p>
          <p className="text-3xl font-bold text-purple-600">96</p>
        </div>
      </div>

      {/* Available Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map(report => (
          <div key={report.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getReportIcon(report.type)}
                <div>
                  <h3 className="font-semibold text-gray-900">{report.name}</h3>
                  <p className="text-xs text-gray-600">{report.period}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">{report.description}</p>

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-xs text-gray-500">{report.size}</span>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Report Builder */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Custom Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Quality Summary</option>
              <option>Defect Analysis</option>
              <option>Supplier Scorecard</option>
              <option>Custom Report</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Last 30 Days</option>
              <option>Last Quarter</option>
              <option>Last Year</option>
              <option>Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>PDF</option>
              <option>Excel</option>
              <option>CSV</option>
            </select>
          </div>
        </div>
        <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium">
          Generate Report
        </button>
      </div>
    </div>
  )
}

export default QualityReports
