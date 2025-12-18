import React, { useState, useEffect } from 'react'
import { X, ChevronDown, AlertCircle, Save, Play, Loader } from 'lucide-react'
import axios from 'axios'

const CreateInspectionDrawer = ({ activeTab, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    grn_id: '',
    inspection_template_id: '',
    sampling_plan: 'aql',
    inspection_level: 'normal',
    sampling_qty: '',
    inspector_name: 'Current User'
  })

  const [grnData, setGrnData] = useState(null)
  const [grnList, setGrnList] = useState([])
  const [templates, setTemplates] = useState([])
  const [parameters, setParameters] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingGrns, setLoadingGrns] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    grn: true,
    material: true,
    setup: true,
    parameters: true
  })
  const [showGrnDropdown, setShowGrnDropdown] = useState(false)
  const [grnSearch, setGrnSearch] = useState('')

  useEffect(() => {
    fetchGrnList()
    fetchTemplates()
  }, [activeTab])

  const fetchGrnList = async () => {
    setLoadingGrns(true)
    try {
      const response = await axios.get(`/api/quality/pending-grns?type=${activeTab}`)
      setGrnList(response.data || [])
    } catch (error) {
      console.error('Error fetching GRNs:', error)
    } finally {
      setLoadingGrns(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/quality/inspection-templates')
      setTemplates(response.data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const handleGrnSelect = async (grn) => {
    setFormData(prev => ({ ...prev, grn_id: grn.id }))
    setGrnData(grn)
    setShowGrnDropdown(false)
    setGrnSearch('')

    if (grn.id) {
      try {
        const response = await axios.get(`/api/quality/grn-details/${grn.id}`)
        setGrnData(response.data)
      } catch (error) {
        console.error('Error fetching GRN details:', error)
      }
    }
  }

  const handleTemplateSelect = async (templateId) => {
    setFormData(prev => ({ ...prev, inspection_template_id: templateId }))
    
    if (templateId) {
      try {
        const response = await axios.get(`/api/quality/templates/${templateId}/parameters`)
        setParameters(response.data || [])
      } catch (error) {
        console.error('Error fetching template parameters:', error)
      }
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSubmit = async (isDraft = false) => {
    if (!formData.grn_id) {
      alert('Please select a GRN')
      return
    }
    if (!formData.inspection_template_id) {
      alert('Please select an Inspection Template')
      return
    }
    if (!formData.sampling_qty || parseInt(formData.sampling_qty) <= 0) {
      alert('Please enter a valid sampling quantity')
      return
    }

    setSaving(true)
    try {
      const payload = {
        grn_id: formData.grn_id,
        inspection_type: activeTab,
        inspection_template_id: formData.inspection_template_id,
        sampling_plan: formData.sampling_plan,
        inspection_level: formData.inspection_level,
        sampling_qty: parseInt(formData.sampling_qty),
        inspector_name: formData.inspector_name,
        status: isDraft ? 'pending' : 'in_progress'
      }

      const response = await axios.post('/api/quality/inspections/create', payload)
      
      if (response.status === 201) {
        onCreated()
      }
    } catch (error) {
      console.error('Error creating inspection:', error)
      alert(error.response?.data?.message || 'Error creating inspection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const filteredGrns = grnList.filter(grn =>
    grn.grn_no?.toLowerCase().includes(grnSearch.toLowerCase()) ||
    grn.supplier?.toLowerCase().includes(grnSearch.toLowerCase()) ||
    grn.po_no?.toLowerCase().includes(grnSearch.toLowerCase())
  )

  const SectionHeader = ({ title, section }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-900 transition-colors"
    >
      {title}
      <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`} />
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-6 flex items-center justify-between border-b">
          <div>
            <h2 className="text-2xl font-bold">Create Incoming Quality Check</h2>
            <p className="text-green-100 text-sm mt-1">GRN-based Material Inspection</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* SECTION 1: GRN SELECTION */}
            <div>
              <SectionHeader title="1. GRN Selection (Required)" section="grn" />
              {expandedSections.grn && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">GRN No</label>
                    <div className="relative">
                      <button
                        onClick={() => setShowGrnDropdown(!showGrnDropdown)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-left font-medium text-gray-900 flex items-center justify-between hover:bg-blue-50 transition-colors"
                      >
                        {grnData ? (
                          <span>{grnData.grn_no || formData.grn_id}</span>
                        ) : (
                          <span className="text-gray-500">Select GRN...</span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showGrnDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showGrnDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                          <input
                            type="text"
                            placeholder="Search GRN / PO / Supplier..."
                            value={grnSearch}
                            onChange={(e) => setGrnSearch(e.target.value)}
                            className="w-full px-3 py-2 border-b border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 sticky top-0 bg-white"
                          />
                          {loadingGrns ? (
                            <div className="p-4 text-center text-gray-500">Loading GRNs...</div>
                          ) : filteredGrns.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">No GRNs pending QC</div>
                          ) : (
                            filteredGrns.map(grn => (
                              <button
                                key={grn.id}
                                onClick={() => handleGrnSelect(grn)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 transition-colors"
                              >
                                <div className="font-medium text-gray-900">{grn.grn_no}</div>
                                <div className="text-xs text-gray-600">{grn.supplier} • PO: {grn.po_no}</div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {grnData && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase">GRN Type</p>
                        <p className="font-medium text-gray-900">{grnData.grn_type || 'Normal'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase">Supplier</p>
                        <p className="font-medium text-gray-900">{grnData.supplier}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase">PO No</p>
                        <p className="font-medium text-gray-900">{grnData.po_no}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase">GRN Date</p>
                        <p className="font-medium text-gray-900">{new Date(grnData.grn_date || Date.now()).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: MATERIAL DETAILS */}
            {grnData && (
              <div>
                <SectionHeader title="2. Material Details (Auto-Populated)" section="material" />
                {expandedSections.material && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-4">
                    <div className="space-y-3">
                      {grnData.items && grnData.items.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-2 block">Items in GRN</p>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-40 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="py-2 px-3 text-left font-semibold text-gray-700">Item</th>
                                  <th className="py-2 px-3 text-left font-semibold text-gray-700">Drawing</th>
                                  <th className="py-2 px-3 text-center font-semibold text-gray-700">Qty</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grnData.items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2 px-3 text-gray-900 font-medium">{item.item_name}</td>
                                    <td className="py-2 px-3 text-gray-600">{item.drawing_no || 'N/A'}</td>
                                    <td className="py-2 px-3 text-center text-gray-900 font-medium">{item.qty}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: INSPECTION SETUP */}
            <div>
              <SectionHeader title="3. Inspection Setup" section="setup" />
              {expandedSections.setup && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Inspection Template</label>
                    <select
                      value={formData.inspection_template_id}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
                    >
                      <option value="">Select template...</option>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Sampling Plan</label>
                      <select
                        value={formData.sampling_plan}
                        onChange={(e) => setFormData(prev => ({ ...prev, sampling_plan: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="aql">AQL (Acceptance Quality Level)</option>
                        <option value="100">100% Inspection</option>
                        <option value="custom">Custom Sampling</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Inspection Level</label>
                      <select
                        value={formData.inspection_level}
                        onChange={(e) => setFormData(prev => ({ ...prev, inspection_level: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="normal">Normal</option>
                        <option value="tightened">Tightened</option>
                        <option value="reduced">Reduced</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Sampling Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.sampling_qty}
                      onChange={(e) => setFormData(prev => ({ ...prev, sampling_qty: e.target.value }))}
                      placeholder="Enter number of items to sample"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Inspector Name</label>
                    <input
                      type="text"
                      value={formData.inspector_name}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 4: INSPECTION PARAMETERS */}
            {parameters.length > 0 && (
              <div>
                <SectionHeader title="4. Inspection Parameters (Template)" section="parameters" />
                {expandedSections.parameters && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-200 border-b border-gray-300">
                            <th className="py-2 px-3 text-left font-semibold text-gray-900">Parameter</th>
                            <th className="py-2 px-3 text-left font-semibold text-gray-900">Specification</th>
                            <th className="py-2 px-3 text-center font-semibold text-gray-900">UOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parameters.map((param, idx) => (
                            <tr key={idx} className="border-b border-gray-200 bg-white">
                              <td className="py-2 px-3 font-medium text-gray-900">{param.name}</td>
                              <td className="py-2 px-3 text-gray-700">{param.specification}</td>
                              <td className="py-2 px-3 text-center text-gray-600">{param.uom || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">These parameters will be filled during inspection execution</p>
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Workflow Info</p>
                <p>After creating inspection:</p>
                <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                  <li><strong>Save Draft:</strong> Status = Pending (can edit later)</li>
                  <li><strong>Start Inspection:</strong> Status = In Progress (ready to inspect)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving || !formData.grn_id}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving || !formData.grn_id}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Inspection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateInspectionDrawer
