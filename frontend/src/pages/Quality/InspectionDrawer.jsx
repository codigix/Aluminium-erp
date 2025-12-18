import React, { useState } from 'react'
import { X, Save, Plus, AlertCircle, CheckCircle, FileText, Upload, ChevronDown } from 'lucide-react'
import axios from 'axios'

const InspectionDrawer = ({ inspection, onClose, activeTab }) => {
  const [formData, setFormData] = useState({
    samplingQty: '',
    parameters: {},
    acceptedQty: inspection.received_qty || 0,
    rejectedQty: 0,
    reworkQty: 0,
    overallResult: '',
    remarks: '',
    uploadedFiles: []
  })
  const [showNCRForm, setShowNCRForm] = useState(false)
  const [ncrData, setNcrData] = useState({
    defectType: '',
    severity: 'major',
    description: '',
    immediateAction: '',
    responsibleDept: ''
  })
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    header: true,
    material: true,
    parameters: true,
    result: true,
    ncr: false
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleParameterChange = (paramName, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramName]: value
      }
    }))
  }

  const handleParameterResult = (paramName, result) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramName]: {
          ...prev.parameters[paramName],
          result
        }
      }
    }))
  }

  const sampleParameters = [
    { name: 'Length', specification: '100 ± 0.5 mm' },
    { name: 'Width', specification: '50 ± 0.3 mm' },
    { name: 'Finish', specification: 'No scratches' },
    { name: 'Hardness', specification: '≥ 60' }
  ]

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const payload = {
        inspection_id: inspection.id,
        sampling_qty: parseInt(formData.samplingQty) || 0,
        accepted_qty: parseInt(formData.acceptedQty) || 0,
        rejected_qty: parseInt(formData.rejectedQty) || 0,
        rework_qty: parseInt(formData.reworkQty) || 0,
        overall_result: formData.overallResult,
        remarks: formData.remarks,
        parameters: formData.parameters
      }
      
      await axios.post(`/api/quality/inspections/${inspection.id}/submit`, payload)
      onClose()
    } catch (error) {
      console.error('Error submitting inspection:', error)
      alert('Error submitting inspection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateNCR = async () => {
    try {
      const ncrPayload = {
        inspection_id: inspection.id,
        defect_type: ncrData.defectType,
        severity: ncrData.severity,
        description: ncrData.description,
        immediate_action: ncrData.immediateAction,
        responsible_department: ncrData.responsibleDept
      }
      
      await axios.post('/api/quality/non-conformance', ncrPayload)
      setShowNCRForm(false)
      alert('NCR created successfully')
    } catch (error) {
      console.error('Error creating NCR:', error)
      alert('Error creating NCR. Please try again.')
    }
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    setFormData(prev => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, ...files.map(f => f.name)]
    }))
  }

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
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-6 flex items-center justify-between border-b">
          <div>
            <h2 className="text-2xl font-bold">Quality Inspection</h2>
            <p className="text-blue-100 text-sm mt-1">{inspection.inspection_no}</p>
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
            {/* A) INSPECTION HEADER - READ ONLY */}
            <div>
              <SectionHeader title="Inspection Header" section="header" />
              {expandedSections.header && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Inspection ID</p>
                      <p className="font-medium text-gray-900">{inspection.inspection_no}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">GRN No</p>
                      <p className="font-medium text-gray-900">{inspection.grn_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">PO No</p>
                      <p className="font-medium text-gray-900">{inspection.po_no || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Supplier</p>
                      <p className="font-medium text-gray-900">{inspection.supplier || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Warehouse</p>
                      <p className="font-medium text-gray-900">{inspection.warehouse || 'Main Store'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase">Date Received</p>
                      <p className="font-medium text-gray-900">{new Date(inspection.date_received || Date.now()).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* B) MATERIAL DETAILS */}
            <div>
              <SectionHeader title="Material Details" section="material" />
              {expandedSections.material && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Drawing No</label>
                      <input type="text" value={inspection.drawing_no || 'N/A'} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Part No</label>
                      <input type="text" value={inspection.part_no || 'N/A'} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Item Description</label>
                      <input type="text" value={inspection.item_name || 'N/A'} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Batch No</label>
                      <input type="text" value={`Batch-${inspection.batch_no}`} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">UOM</label>
                      <input type="text" value={inspection.uom || 'PCS'} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Received Qty</label>
                      <input type="text" value={inspection.received_qty || 0} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-semibold" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Sampling Qty</label>
                    <input
                      type="number"
                      min="0"
                      max={inspection.received_qty}
                      value={formData.samplingQty}
                      onChange={(e) => setFormData(prev => ({ ...prev, samplingQty: e.target.value }))}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter number of items to sample"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* C) INSPECTION PARAMETERS */}
            <div>
              <SectionHeader title="Inspection Parameters (Template Based)" section="parameters" />
              {expandedSections.parameters && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-200 border-b border-gray-300">
                          <th className="py-2 px-3 text-left font-semibold text-gray-900">Parameter</th>
                          <th className="py-2 px-3 text-left font-semibold text-gray-900">Specification</th>
                          <th className="py-2 px-3 text-center font-semibold text-gray-900">Actual Value</th>
                          <th className="py-2 px-3 text-center font-semibold text-gray-900">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleParameters.map((param) => (
                          <tr key={param.name} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="py-3 px-3 font-medium text-gray-900">{param.name}</td>
                            <td className="py-3 px-3 text-gray-700">{param.specification}</td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                placeholder="Enter value"
                                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <select
                                onChange={(e) => handleParameterResult(param.name, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              >
                                <option value="">-</option>
                                <option value="pass" className="text-green-700">Pass</option>
                                <option value="fail" className="text-red-700">Fail</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* D) INSPECTION RESULT SECTION */}
            <div>
              <SectionHeader title="Inspection Results" section="result" />
              {expandedSections.result && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Accepted Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.acceptedQty}
                        onChange={(e) => setFormData(prev => ({ ...prev, acceptedQty: e.target.value }))}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Rejected Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.rejectedQty}
                        onChange={(e) => setFormData(prev => ({ ...prev, rejectedQty: e.target.value }))}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Rework Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.reworkQty}
                        onChange={(e) => setFormData(prev => ({ ...prev, reworkQty: e.target.value }))}
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Overall Result</label>
                    <select
                      value={formData.overallResult}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, overallResult: e.target.value }))
                        if (e.target.value !== 'pass') {
                          setShowNCRForm(true)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
                    >
                      <option value="">Select result...</option>
                      <option value="pass">✓ Pass</option>
                      <option value="fail">✗ Fail / Reject</option>
                      <option value="hold">⊘ On Hold</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Inspector Name</label>
                    <input
                      type="text"
                      defaultValue="Current User"
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Remarks</label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Add any inspection notes or observations..."
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase block mb-2 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Evidence (Images / PDF)
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.uploadedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {formData.uploadedFiles.map(file => (
                          <p key={file} className="text-xs text-gray-600">✓ {file}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* E) NCR QUICK CREATE (CONDITIONAL) */}
            {showNCRForm && formData.overallResult !== 'pass' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">Create Non-Conformance Report (NCR)</h3>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Defect Type</label>
                  <input
                    type="text"
                    placeholder="e.g., Dimensional, Surface, Color, etc."
                    value={ncrData.defectType}
                    onChange={(e) => setNcrData(prev => ({ ...prev, defectType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Severity</label>
                  <select
                    value={ncrData.severity}
                    onChange={(e) => setNcrData(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Description</label>
                  <textarea
                    placeholder="Describe the non-conformance..."
                    value={ncrData.description}
                    onChange={(e) => setNcrData(prev => ({ ...prev, description: e.target.value }))}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Immediate Action</label>
                  <input
                    type="text"
                    placeholder="e.g., Segregate, Hold, Return to Supplier"
                    value={ncrData.immediateAction}
                    onChange={(e) => setNcrData(prev => ({ ...prev, immediateAction: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-2">Responsible Department</label>
                  <select
                    value={ncrData.responsibleDept}
                    onChange={(e) => setNcrData(prev => ({ ...prev, responsibleDept: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select department...</option>
                    <option value="buying">Buying</option>
                    <option value="quality">Quality</option>
                    <option value="inventory">Inventory</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateNCR}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create NCR & Link
                </button>
              </div>
            )}
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
            onClick={() => setFormData(prev => ({ ...prev, samplingQty: '', acceptedQty: inspection.received_qty || 0, rejectedQty: 0, reworkQty: 0, overallResult: '', remarks: '' }))}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Submitting...' : 'Submit Inspection'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default InspectionDrawer
