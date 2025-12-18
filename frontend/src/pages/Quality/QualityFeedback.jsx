import React, { useState } from 'react'
import { Plus, MessageSquare } from 'lucide-react'

const QualityFeedback = () => {
  const [feedbackList] = useState([
    {
      id: 1,
      source: 'Customer',
      topic: 'Dimensional Tolerance Issue',
      description: 'Received feedback about tolerance on batch AL-115',
      date: '2025-12-17',
      status: 'open'
    },
    {
      id: 2,
      source: 'Internal',
      topic: 'Surface Finish Quality',
      description: 'Production observed surface finish degradation',
      date: '2025-12-16',
      status: 'under_review'
    }
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quality Feedback</h1>
          <p className="text-gray-600 mt-1">Collect and manage quality feedback from all sources</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          New Feedback
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">Total Feedback</p>
          <p className="text-3xl font-bold text-gray-900">24</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">Open</p>
          <p className="text-3xl font-bold text-red-600">5</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-gray-600 text-sm">Resolved</p>
          <p className="text-3xl font-bold text-green-600">19</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="py-3 px-4 text-left font-semibold text-gray-700">Topic</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-700">Source</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-700">Date</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-700">Status</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {feedbackList.map(feedback => (
                <tr key={feedback.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{feedback.topic}</p>
                        <p className="text-xs text-gray-600">{feedback.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{feedback.source}</td>
                  <td className="py-3 px-4 text-gray-600">{feedback.date}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded ${
                      feedback.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {feedback.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default QualityFeedback
