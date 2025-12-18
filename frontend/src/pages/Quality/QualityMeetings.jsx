import React, { useState, useEffect } from 'react'
import { Calendar, Plus, Users } from 'lucide-react'
import axios from 'axios'

const QualityMeetings = () => {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    try {
      const response = await axios.get('/api/quality/meetings')
      setMeetings(response.data || [])
    } catch (error) {
      console.error('Error fetching meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quality Meetings</h1>
          <p className="text-gray-600 mt-1">Schedule and track quality review meetings</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Schedule Meeting
        </button>
      </div>

      {/* Upcoming Meetings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Meetings</h3>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No upcoming meetings scheduled</p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map(meeting => (
              <div key={meeting.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{meeting.title}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {meeting.date}
                      </span>
                      <span>{meeting.time}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {meeting.attendees} attendees
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meeting Minutes */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Meeting Minutes</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(item => (
            <div key={item} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">Quality Review Meeting #{item}</p>
                <p className="text-sm text-gray-600">Dec {18 - item}, 2025</p>
              </div>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QualityMeetings
