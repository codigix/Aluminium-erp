import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Eye, X, ChevronRight, AlertCircle, CheckCircle, Clock, XCircle, Pause } from 'lucide-react'
import axios from 'axios'
import InspectionDrawer from './InspectionDrawer'
import CreateInspectionDrawer from './CreateInspectionDrawer'
import QuickSummaryPanel from './QuickSummaryPanel'

const QualityChecks = () => {
  const [activeTab, setActiveTab] = useState('incoming')
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [showInspectionDrawer, setShowInspectionDrawer] = useState(false)
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dateRangeStart, setDateRangeStart] = useState('')
  const [dateRangeEnd, setDateRangeEnd] = useState('')

  useEffect(() => {
    fetchInspections()
  }, [activeTab])

  const mockInspections = [
    {
      id: 1,
      inspection_no: 'QC-IN-00045',
      inspection_type: 'incoming',
      grn_id: 'GRN-140',
      po_no: 'PO-230',
      supplier: 'ABC Aluminium Pvt Ltd',
      drawing_no: 'DWG-001',
      item_name: 'Aluminium Coil 5mm',
      batch_no: 'BATCH-45',
      received_qty: 100,
      inspected_qty: 20,
      status: 'passed',
      result: 'pass'
    },
    {
      id: 2,
      inspection_no: 'QC-IN-00046',
      inspection_type: 'incoming',
      grn_id: 'GRN-141',
      po_no: 'PO-231',
      supplier: 'XYZ Metals Ltd',
      drawing_no: 'DWG-002',
      item_name: 'T-Slot Frame',
      batch_no: 'BATCH-46',
      received_qty: 50,
      inspected_qty: 15,
      status: 'rejected',
      result: 'fail'
    },
    {
      id: 3,
      inspection_no: 'QC-IN-00047',
      inspection_type: 'incoming',
      grn_id: 'GRN-142',
      po_no: 'PO-232',
      supplier: 'Steel Corp',
      drawing_no: 'DWG-003',
      item_name: 'Steel Plate 10mm',
      batch_no: 'BATCH-47',
      received_qty: 75,
      inspected_qty: 20,
      status: 'in_progress',
      result: null
    },
    {
      id: 4,
      inspection_no: 'QC-IN-00048',
      inspection_type: 'incoming',
      grn_id: 'GRN-143',
      po_no: 'PO-233',
      supplier: 'ABC Aluminium Pvt Ltd',
      drawing_no: 'DWG-004',
      item_name: 'Copper Wire',
      batch_no: 'BATCH-48',
      received_qty: 200,
      inspected_qty: 25,
      status: 'on_hold',
      result: null
    },
    {
      id: 5,
      inspection_no: 'QC-IN-00049',
      inspection_type: 'incoming',
      grn_id: 'GRN-144',
      po_no: 'PO-234',
      supplier: 'Precision Metals',
      drawing_no: 'DWG-005',
      item_name: 'Aluminum Sheet',
      batch_no: 'BATCH-49',
      received_qty: 150,
      inspected_qty: 30,
      status: 'passed',
      result: 'pass'
    },
    {
      id: 6,
      inspection_no: 'QC-IN-00050',
      inspection_type: 'incoming',
      grn_id: 'GRN-145',
      po_no: 'PO-235',
      supplier: 'Global Supplies',
      drawing_no: 'DWG-006',
      item_name: 'Brass Rod',
      batch_no: 'BATCH-50',
      received_qty: 80,
      inspected_qty: 20,
      status: 'pending',
      result: null
    },
    {
      id: 7,
      inspection_no: 'QC-IP-00001',
      inspection_type: 'in_process',
      grn_id: 'WO-001',
      po_no: 'PO-240',
      supplier: 'Internal Production',
      drawing_no: 'DWG-101',
      item_name: 'Machined Part A',
      batch_no: 'BATCH-101',
      received_qty: 500,
      inspected_qty: 50,
      status: 'passed',
      result: 'pass'
    },
    {
      id: 8,
      inspection_no: 'QC-IP-00002',
      inspection_type: 'in_process',
      grn_id: 'WO-002',
      po_no: 'PO-241',
      supplier: 'Internal Production',
      drawing_no: 'DWG-102',
      item_name: 'Welded Assembly',
      batch_no: 'BATCH-102',
      received_qty: 300,
      inspected_qty: 30,
      status: 'in_progress',
      result: null
    },
    {
      id: 9,
      inspection_no: 'QC-IP-00003',
      inspection_type: 'in_process',
      grn_id: 'WO-003',
      po_no: 'PO-242',
      supplier: 'Internal Production',
      drawing_no: 'DWG-103',
      item_name: 'Stamped Component',
      batch_no: 'BATCH-103',
      received_qty: 1000,
      inspected_qty: 100,
      status: 'rejected',
      result: 'fail'
    },
    {
      id: 10,
      inspection_no: 'QC-FN-00001',
      inspection_type: 'final',
      grn_id: 'PO-250',
      po_no: 'PO-250',
      supplier: 'Internal',
      drawing_no: 'DWG-200',
      item_name: 'Final Product - Assembly',
      batch_no: 'BATCH-200',
      received_qty: 100,
      inspected_qty: 100,
      status: 'passed',
      result: 'pass'
    },
    {
      id: 11,
      inspection_no: 'QC-FN-00002',
      inspection_type: 'final',
      grn_id: 'PO-251',
      po_no: 'PO-251',
      supplier: 'Internal',
      drawing_no: 'DWG-201',
      item_name: 'Final Product - Complete Unit',
      batch_no: 'BATCH-201',
      received_qty: 50,
      inspected_qty: 50,
      status: 'in_progress',
      result: null
    },
    {
      id: 12,
      inspection_no: 'QC-FN-00003',
      inspection_type: 'final',
      grn_id: 'PO-252',
      po_no: 'PO-252',
      supplier: 'Internal',
      drawing_no: 'DWG-202',
      item_name: 'Final Product - Packed Unit',
      batch_no: 'BATCH-202',
      received_qty: 75,
      inspected_qty: 75,
      status: 'passed',
      result: 'pass'
    },
    {
      id: 13,
      inspection_no: 'QC-FN-00004',
      inspection_type: 'final',
      grn_id: 'PO-253',
      po_no: 'PO-253',
      supplier: 'Internal',
      drawing_no: 'DWG-203',
      item_name: 'Final Product - Branded Package',
      batch_no: 'BATCH-203',
      received_qty: 200,
      inspected_qty: 200,
      status: 'on_hold',
      result: null
    }
  ]

  const fetchInspections = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/quality/inspections?type=${activeTab}`)
      setInspections(response.data || mockInspections)
    } catch (error) {
      console.error('Error fetching inspections:', error)
      setInspections(mockInspections)
    } finally {
      setLoading(false)
    }
  }

  const filteredInspections = inspections.filter(inspection => {
    const matchesTab = inspection.inspection_type === activeTab
    const matchesSearch = inspection.inspection_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.grn_id?.toString().includes(searchTerm) ||
      inspection.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.drawing_no?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || inspection.status === statusFilter
    const matchesSupplier = !supplierFilter || inspection.supplier?.toLowerCase().includes(supplierFilter.toLowerCase())
    
    return matchesTab && matchesSearch && matchesStatus && matchesSupplier
  })

  const getStatusIcon = (status) => {
    const icons = {
      'pending': <Clock className="w-4 h-4 text-orange-600" />,
      'in_progress': <Clock className="w-4 h-4 text-blue-600" />,
      'passed': <CheckCircle className="w-4 h-4 text-green-600" />,
      'rejected': <XCircle className="w-4 h-4 text-red-600" />,
      'on_hold': <Pause className="w-4 h-4 text-amber-600" />
    }
    return icons[status] || <AlertCircle className="w-4 h-4 text-gray-600" />
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-orange-100 text-orange-800 border border-orange-300',
      'in_progress': 'bg-blue-100 text-blue-800 border border-blue-300',
      'passed': 'bg-green-100 text-green-800 border border-green-300',
      'rejected': 'bg-red-100 text-red-800 border border-red-300',
      'on_hold': 'bg-amber-100 text-amber-800 border border-amber-300'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getResultColor = (result) => {
    const colors = {
      'pass': 'bg-green-100 text-green-800 border border-green-300',
      'fail': 'bg-red-100 text-red-800 border border-red-300',
      'hold': 'bg-amber-100 text-amber-800 border border-amber-300'
    }
    return colors[result] || 'bg-gray-100 text-gray-800'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setSupplierFilter('')
    setDateRangeStart('')
    setDateRangeEnd('')
  }

  const TabButton = ({ tab, label, count }) => (
    <button
      onClick={() => {
        setActiveTab(tab)
        clearFilters()
      }}
      className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
        activeTab === tab
          ? 'border-blue-600 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {label}
      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
        activeTab === tab ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-700'
      }`}>
        {count}
      </span>
    </button>
  )

  const InspectionRow = ({ inspection }) => (
    <tr key={inspection.id} className="border-b hover:bg-blue-50 transition-colors">
      <td className="py-4 px-4">
        <input type="checkbox" className="rounded border-gray-300 cursor-pointer" />
      </td>
      <td className="py-4 px-4 font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">
        {inspection.inspection_no}
      </td>
      <td className="py-4 px-4 text-gray-700 font-medium">{inspection.grn_id || 'N/A'}</td>
      <td className="py-4 px-4 text-gray-700">{inspection.supplier || 'N/A'}</td>
      <td className="py-4 px-4 text-gray-600 text-sm">{inspection.drawing_no || 'N/A'}</td>
      <td className="py-4 px-4 text-gray-700">{inspection.item_name}</td>
      <td className="py-4 px-4 text-gray-600 text-sm">Batch-{inspection.batch_no}</td>
      <td className="py-4 px-4 text-center text-gray-700 font-medium">{inspection.received_qty || 0}</td>
      <td className="py-4 px-4 text-center text-gray-700 font-medium">{inspection.inspected_qty || 0}</td>
      <td className="py-4 px-4">
        <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(inspection.status)}`}>
          {getStatusIcon(inspection.status)}
          {inspection.status?.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="py-4 px-4">
        {inspection.result ? (
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getResultColor(inspection.result)}`}>
            {inspection.result?.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">Pending</span>
        )}
      </td>
      <td className="py-4 px-4 text-right">
        <button
          onClick={() => {
            setSelectedInspection(inspection)
            setShowInspectionDrawer(true)
          }}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Eye className="w-4 h-4" />
          {inspection.status === 'pending' ? 'Inspect' : 'View'}
        </button>
      </td>
    </tr>
  )

  const getTabCounts = () => {
    const counts = {
      incoming: inspections.filter(i => i.inspection_type === 'incoming').length,
      in_process: inspections.filter(i => i.inspection_type === 'in_process').length,
      final: inspections.filter(i => i.inspection_type === 'final').length
    }
    return counts
  }

  const getPageTitle = () => {
    const titles = {
      'incoming': { title: 'Incoming Quality Checks', desc: 'Inspect incoming materials received via GRN / Subcontract GRN before stock acceptance' },
      'in_process': { title: 'In-Process Quality Checks', desc: 'Monitor quality during manufacturing operations' },
      'final': { title: 'Final Quality Checks', desc: 'Inspect finished products before delivery' }
    }
    return titles[activeTab] || titles['incoming']
  }

  const pageInfo = getPageTitle()
  const counts = getTabCounts()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium text-gray-900">Quality</span>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-gray-900">Quality Checks</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-blue-600 font-medium capitalize">
            {activeTab === 'in_process' ? 'In-Process QC' : activeTab === 'final' ? 'Final QC' : 'Incoming QC'}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Header with prominent button */}
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{pageInfo.title}</h1>
            <p className="text-gray-600 mt-1 text-sm">{pageInfo.desc}</p>
          </div>
          <button
            onClick={() => setShowCreateDrawer(true)}
            className="flex-shrink-0 bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md font-bold text-base whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            {activeTab === 'incoming' ? 'Create Incoming QC' : activeTab === 'in_process' ? 'Create In-Process QC' : 'Create Final QC'}
          </button>
        </div>

        {/* Tabs & Main Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-1 px-6">
              <TabButton tab="incoming" label="Incoming QC" count={counts.incoming} />
              <TabButton tab="in_process" label="In-Process QC" count={counts.in_process} />
              <TabButton tab="final" label="Final QC" count={counts.final} />
            </div>
          </div>

          {/* Search & Filter Bar - Sticky */}
          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <div className="flex gap-3 p-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search GRN / Inspection ID / Drawing No"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-colors ${
                  showFilters
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              {(searchTerm || statusFilter || supplierFilter || dateRangeStart) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="bg-white border-t border-gray-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="passed">Passed</option>
                    <option value="rejected">Rejected</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                  <input
                    type="text"
                    placeholder="Filter by supplier"
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredInspections.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No inspections found</p>
                <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">
                      <input type="checkbox" className="rounded border-gray-300 cursor-pointer" />
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Inspection ID</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">GRN No</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Supplier</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Drawing No</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Item / Part Name</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Batch No</th>
                    <th className="py-3 px-4 text-center font-semibold text-gray-700">Received Qty</th>
                    <th className="py-3 px-4 text-center font-semibold text-gray-700">Inspected Qty</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Status</th>
                    <th className="py-3 px-4 text-left font-semibold text-gray-700">Result</th>
                    <th className="py-3 px-4 text-right font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInspections.map(inspection => (
                    <InspectionRow key={inspection.id} inspection={inspection} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Inspection Drawer - Right Sidebar */}
      {showInspectionDrawer && selectedInspection && (
        <InspectionDrawer
          inspection={selectedInspection}
          onClose={() => {
            setShowInspectionDrawer(false)
            setSelectedInspection(null)
          }}
          activeTab={activeTab}
        />
      )}

      {/* Create Inspection Drawer */}
      {showCreateDrawer && (
        <CreateInspectionDrawer
          activeTab={activeTab}
          onClose={() => setShowCreateDrawer(false)}
          onCreated={() => {
            setShowCreateDrawer(false)
            fetchInspections()
          }}
        />
      )}

      {/* Quick Summary Panel - Bottom Right (Optional) */}
      {activeTab === 'incoming' && !showInspectionDrawer && !showCreateDrawer && (
        <QuickSummaryPanel inspections={inspections} />
      )}
    </div>
  )
}

export default QualityChecks
