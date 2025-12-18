import React, { useState, useEffect } from 'react'
import { TrendingUp, Star, AlertCircle, Search } from 'lucide-react'
import axios from 'axios'

const SupplierQuality = () => {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchSupplierQuality()
  }, [])

  const fetchSupplierQuality = async () => {
    try {
      const response = await axios.get('/api/quality/supplier-quality')
      setSuppliers(response.data || [])
    } catch (error) {
      console.error('Error fetching supplier quality:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600'
    if (rating >= 3.5) return 'text-blue-600'
    if (rating >= 2.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 text-green-800'
      case 'good':
        return 'bg-blue-100 text-blue-800'
      case 'fair':
        return 'bg-yellow-100 text-yellow-800'
      case 'poor':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Supplier Quality</h1>
        <p className="text-gray-600 mt-1">Monitor supplier performance and quality metrics</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Supplier Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No suppliers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(supplier.status)}`}>
                  {supplier.status?.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Quality Rating</p>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(supplier.rating || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`font-semibold ${getRatingColor(supplier.rating || 0)}`}>
                      {supplier.rating || 0}/5
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-gray-600">Acceptance Rate</p>
                    <p className="text-lg font-bold text-green-600">{supplier.acceptance_rate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">NCR Rate</p>
                    <p className="text-lg font-bold text-red-600">{supplier.ncr_rate || 0}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-600">On-Time Delivery</p>
                    <p className="text-lg font-bold text-blue-600">{supplier.on_time_delivery || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Lead Time (days)</p>
                    <p className="text-lg font-bold text-gray-900">{supplier.lead_time || 0}</p>
                  </div>
                </div>

                <button className="w-full mt-4 py-2 border rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SupplierQuality
