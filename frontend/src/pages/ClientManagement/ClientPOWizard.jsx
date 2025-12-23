import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Upload, Plus, Trash2, Loader } from 'lucide-react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import './ClientManagement.css'

const Swal = window.Swal

const STEPS = [
  { id: 1, name: 'Client Info', key: 'clientInfo', label: 'Client Information' },
  { id: 2, name: 'Project Info', key: 'projectInfo', label: 'Project Information' },
  { id: 3, name: 'Drawings', key: 'drawings', label: 'Drawing Details' },
  { id: 4, name: 'Commercials', key: 'commercials', label: 'Commercial Details' },
  { id: 5, name: 'Terms', key: 'terms', label: 'Terms & Attachments' },
  { id: 6, name: 'Review', key: 'review', label: 'Review & Submit' }
]

export default function ClientPOWizard() {
  const { po_id } = useParams()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [poData, setPoData] = useState(null)
  const [stepStatus, setStepStatus] = useState({})
  const [error, setError] = useState(null)
  const [clients, setClients] = useState([])

  // Step form states
  const [clientInfo, setClientInfo] = useState({
    po_number: '',
    client_id: '',
    po_date: new Date().toISOString().split('T')[0],
    contact_person: '',
    email_reference: ''
  })

  const [projectInfo, setProjectInfo] = useState({
    project_name: '',
    project_code: '',
    project_type: '',
    sales_engineer: '',
    delivery_start_date: '',
    delivery_end_date: ''
  })

  const [drawings, setDrawings] = useState([])
  const [newDrawing, setNewDrawing] = useState({
    drawing_no: '',
    revision: '',
    description: '',
    quantity: 1,
    unit: 'NOS',
    delivery_date: ''
  })

  const [commercials, setCommercials] = useState({
    subtotal: 0,
    currency: 'INR',
    payment_terms: '',
    tax_rate: 18,
    freight_charges: 0
  })

  const [terms, setTerms] = useState({
    payment_terms_description: '',
    delivery_schedule: '',
    packing_instructions: '',
    special_remarks: ''
  })

  useEffect(() => {
    fetchInitialData()
  }, [po_id])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      
      // Fetch clients
      const clientRes = await fetch(`/api/selling/customers`)
      const clientData = await clientRes.json()
      if (clientData.success) {
        setClients(clientData.data || [])
      }

      // If editing existing PO, fetch its data
      if (po_id && po_id !== 'new') {
        const poRes = await fetch(`/api/client-pos/${po_id}`)
        const poJson = await poRes.json()
        if (poJson.success) {
          const data = poJson.data
          setPoData(data)
          setStepStatus(data.stepStatus || {})

          // Populate form fields with existing data
          if (data.po) {
            setClientInfo({
              po_id: data.po.po_id,
              po_number: data.po.po_number || '',
              client_id: data.po.client_id || '',
              po_date: data.po.po_date || new Date().toISOString().split('T')[0],
              contact_person: data.po.contact_person || '',
              email_reference: data.po.email_reference || ''
            })
          }

          if (data.project) {
            setProjectInfo({
              project_id: data.project.project_id,
              project_name: data.project.project_name || '',
              project_code: data.project.project_code || '',
              project_type: data.project.project_type || '',
              sales_engineer: data.project.sales_engineer || '',
              delivery_start_date: data.project.delivery_start_date || '',
              delivery_end_date: data.project.delivery_end_date || ''
            })
          }

          if (data.drawings && data.drawings.length > 0) {
            setDrawings(data.drawings)
          }

          if (data.commercials) {
            setCommercials({
              commercial_id: data.commercials.commercial_id,
              subtotal: data.commercials.subtotal || 0,
              currency: data.commercials.currency || 'INR',
              payment_terms: data.commercials.payment_terms || '',
              tax_rate: data.commercials.tax_rate || 18,
              freight_charges: data.commercials.freight_charges || 0
            })
          }

          if (data.terms) {
            setTerms({
              term_id: data.terms.term_id,
              payment_terms_description: data.terms.payment_terms_description || '',
              delivery_schedule: data.terms.delivery_schedule || '',
              packing_instructions: data.terms.packing_instructions || '',
              special_remarks: data.terms.special_remarks || ''
            })
          }
        }
      }
    } catch (err) {
      console.error('Error fetching initial data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveStep = async () => {
    setSubmitting(true)
    setError(null)

    try {
      let endpoint = ''
      let payload = {}
      let method = 'POST'

      if (currentStep === 1) {
        endpoint = `/api/client-pos`
        payload = clientInfo
      } else if (currentStep === 2) {
        endpoint = `/api/client-pos/${clientInfo.po_id}/project`
        payload = { ...projectInfo, po_id: clientInfo.po_id }
      } else if (currentStep === 3) {
        endpoint = `/api/client-pos/${clientInfo.po_id}/drawings`
        payload = { drawings, po_id: clientInfo.po_id }
      } else if (currentStep === 4) {
        endpoint = `/api/client-pos/${clientInfo.po_id}/commercials`
        payload = { ...commercials, po_id: clientInfo.po_id }
      } else if (currentStep === 5) {
        endpoint = `/api/client-pos/${clientInfo.po_id}/terms`
        payload = { ...terms, po_id: clientInfo.po_id, attachments: [] }
      }

      if (!endpoint) {
        setSubmitting(false)
        return
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (data.success) {
        // Update po_id for first step
        if (currentStep === 1 && data.data.po_id) {
          setClientInfo(prev => ({
            ...prev,
            po_id: data.data.po_id
          }))
        }

        await Swal.fire({
          icon: 'success',
          title: `${STEPS[currentStep - 1].name} Saved`,
          text: `Proceed to ${STEPS[currentStep].name}`,
          timer: 1500,
          showConfirmButton: false
        })

        if (currentStep < 6) {
          setCurrentStep(currentStep + 1)
        }
      } else {
        setError(data.error || 'Failed to save step')
      }
    } catch (err) {
      console.error('Error saving step:', err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddDrawing = () => {
    if (!newDrawing.drawing_no || newDrawing.quantity <= 0) {
      setError('Please fill all required drawing fields')
      return
    }

    setDrawings([
      ...drawings,
      {
        ...newDrawing,
        _key: `${Date.now()}-${Math.random()}`
      }
    ])

    setNewDrawing({
      drawing_no: '',
      revision: '',
      description: '',
      quantity: 1,
      unit: 'NOS',
      delivery_date: ''
    })
    setError(null)
  }

  const handleRemoveDrawing = (index) => {
    setDrawings(drawings.filter((_, i) => i !== index))
  }

  const isStepCompleted = (step) => {
    const stepKey = STEPS[step - 1].key
    return stepStatus[`${stepKey}_completed`] || false
  }

  const getStepStatus = (step) => {
    if (step < currentStep) return 'completed'
    if (step === currentStep) return 'active'
    return 'pending'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/client-management/client-pos')}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold">Client PO Creation Wizard</h1>
          <p className="text-gray-500 mt-1">Complete each step to create your Client Purchase Order</p>
        </div>
      </div>

      {/* Progress Stepper */}
      <Card>
        <div className="flex items-center justify-between overflow-x-auto pb-4">
          {STEPS.map((step, idx) => {
            const status = getStepStatus(step.id)
            const isCompleted = isStepCompleted(step.id)

            return (
              <div key={step.id} className="flex items-center flex-1 min-w-max">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white transition-all ${
                      status === 'completed'
                        ? 'bg-green-500'
                        : status === 'active'
                        ? 'bg-blue-600'
                        : 'bg-gray-300'
                    }`}
                  >
                    {status === 'completed' ? <Check size={20} /> : step.id}
                  </div>
                  <span className="text-sm font-medium mt-2 text-center w-20 text-gray-700">
                    {step.name}
                  </span>
                  {isCompleted && <span className="text-xs text-green-600 font-semibold mt-1">✓ Saved</span>}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <Card>
        <div className="space-y-6">
          {/* Step 1: Client Information */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Step 1: Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <select
                    value={clientInfo.client_id}
                    onChange={(e) => setClientInfo({ ...clientInfo, client_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a client</option>
                    {clients.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client PO Number
                  </label>
                  <input
                    type="text"
                    value={clientInfo.po_number}
                    onChange={(e) => setClientInfo({ ...clientInfo, po_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client PO Date *
                  </label>
                  <input
                    type="date"
                    value={clientInfo.po_date}
                    onChange={(e) => setClientInfo({ ...clientInfo, po_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={clientInfo.contact_person}
                    onChange={(e) => setClientInfo({ ...clientInfo, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Reference
                  </label>
                  <input
                    type="email"
                    value={clientInfo.email_reference}
                    onChange={(e) => setClientInfo({ ...clientInfo, email_reference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Project Information */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Step 2: Project Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectInfo.project_name}
                    onChange={(e) => setProjectInfo({ ...projectInfo, project_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Code
                  </label>
                  <input
                    type="text"
                    value={projectInfo.project_code}
                    onChange={(e) => setProjectInfo({ ...projectInfo, project_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type
                  </label>
                  <input
                    type="text"
                    value={projectInfo.project_type}
                    onChange={(e) => setProjectInfo({ ...projectInfo, project_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Engineer
                  </label>
                  <input
                    type="text"
                    value={projectInfo.sales_engineer}
                    onChange={(e) => setProjectInfo({ ...projectInfo, sales_engineer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Start Date
                  </label>
                  <input
                    type="date"
                    value={projectInfo.delivery_start_date}
                    onChange={(e) => setProjectInfo({ ...projectInfo, delivery_start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery End Date
                  </label>
                  <input
                    type="date"
                    value={projectInfo.delivery_end_date}
                    onChange={(e) => setProjectInfo({ ...projectInfo, delivery_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Drawing Details */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Step 3: Drawing Details</h2>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-3">
                <h3 className="font-semibold text-gray-900">Add New Drawing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newDrawing.drawing_no}
                    onChange={(e) => setNewDrawing({ ...newDrawing, drawing_no: e.target.value })}
                    placeholder="Drawing No *"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newDrawing.revision}
                    onChange={(e) => setNewDrawing({ ...newDrawing, revision: e.target.value })}
                    placeholder="Revision"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newDrawing.description}
                    onChange={(e) => setNewDrawing({ ...newDrawing, description: e.target.value })}
                    placeholder="Description"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="number"
                    value={newDrawing.quantity}
                    onChange={(e) => setNewDrawing({ ...newDrawing, quantity: parseFloat(e.target.value) || 1 })}
                    placeholder="Qty"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newDrawing.unit}
                    onChange={(e) => setNewDrawing({ ...newDrawing, unit: e.target.value })}
                    placeholder="Unit"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={newDrawing.delivery_date}
                    onChange={(e) => setNewDrawing({ ...newDrawing, delivery_date: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={handleAddDrawing}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {drawings.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold">Drawing No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Rev</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Qty</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Unit</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Delivery Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawings.map((drawing, idx) => (
                        <tr key={drawing._key || idx} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm">{drawing.drawing_no}</td>
                          <td className="px-4 py-3 text-sm">{drawing.revision || '-'}</td>
                          <td className="px-4 py-3 text-sm">{drawing.description || '-'}</td>
                          <td className="px-4 py-3 text-sm">{drawing.quantity}</td>
                          <td className="px-4 py-3 text-sm">{drawing.unit}</td>
                          <td className="px-4 py-3 text-sm">{drawing.delivery_date || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveDrawing(idx)}
                              className="p-2 hover:bg-red-100 rounded text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Commercial Details */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Step 4: Commercial Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    value={commercials.subtotal}
                    onChange={(e) => setCommercials({ ...commercials, subtotal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={commercials.tax_rate}
                    onChange={(e) => setCommercials({ ...commercials, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Freight Charges (₹)
                  </label>
                  <input
                    type="number"
                    value={commercials.freight_charges}
                    onChange={(e) => setCommercials({ ...commercials, freight_charges: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    value={commercials.currency}
                    onChange={(e) => setCommercials({ ...commercials, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={commercials.payment_terms}
                    onChange={(e) => setCommercials({ ...commercials, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 30 days net, 50% advance..."
                  />
                </div>

                {/* Summary */}
                <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Subtotal</p>
                      <p className="text-xl font-bold">₹{commercials.subtotal.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tax ({commercials.tax_rate}%)</p>
                      <p className="text-xl font-bold">₹{((commercials.subtotal * commercials.tax_rate) / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Value</p>
                      <p className="text-xl font-bold text-blue-600">
                        ₹{(commercials.subtotal + (commercials.subtotal * commercials.tax_rate) / 100 + commercials.freight_charges).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Terms & Attachments */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Step 5: Terms & Attachments</h2>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Terms Description
                  </label>
                  <textarea
                    value={terms.payment_terms_description}
                    onChange={(e) => setTerms({ ...terms, payment_terms_description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Schedule
                  </label>
                  <textarea
                    value={terms.delivery_schedule}
                    onChange={(e) => setTerms({ ...terms, delivery_schedule: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Packing Instructions
                  </label>
                  <textarea
                    value={terms.packing_instructions}
                    onChange={(e) => setTerms({ ...terms, packing_instructions: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Remarks
                  </label>
                  <textarea
                    value={terms.special_remarks}
                    onChange={(e) => setTerms({ ...terms, special_remarks: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Review & Submit */}
          {currentStep === 6 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Step 6: Review & Submit</h2>
              <div className="space-y-6">
                {/* Client Info Summary */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">Client Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">PO Number</p>
                      <p className="font-semibold">{clientInfo.po_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Client Name</p>
                      <p className="font-semibold">{clients.find(c => c.customer_id === clientInfo.client_id)?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">PO Date</p>
                      <p className="font-semibold">{clientInfo.po_date}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Contact Person</p>
                      <p className="font-semibold">{clientInfo.contact_person || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Project Info Summary */}
                {projectInfo.project_name && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-4">Project Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Project Name</p>
                        <p className="font-semibold">{projectInfo.project_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Project Code</p>
                        <p className="font-semibold">{projectInfo.project_code || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Drawings Summary */}
                {drawings.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-4">Drawings ({drawings.length})</h3>
                    <div className="space-y-2 text-sm">
                      {drawings.map((d, idx) => (
                        <div key={idx} className="flex justify-between py-2 border-b last:border-b-0">
                          <span>{d.drawing_no} (Rev: {d.revision || '-'})</span>
                          <span>{d.quantity} {d.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commercials Summary */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="font-semibold text-lg mb-4">Commercial Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{commercials.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax ({commercials.tax_rate}%)</span>
                      <span>₹{((commercials.subtotal * commercials.tax_rate) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Freight</span>
                      <span>₹{commercials.freight_charges.toFixed(2)}</span>
                    </div>
                    <div className="border-t-2 pt-2 font-bold flex justify-between text-blue-600 text-lg">
                      <span>Grand Total</span>
                      <span>₹{(commercials.subtotal + (commercials.subtotal * commercials.tax_rate) / 100 + commercials.freight_charges).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t mt-8 pt-6 flex justify-between gap-4">
          <Button
            variant="secondary"
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep(currentStep - 1)
              } else {
                navigate('/client-management/client-pos')
              }
            }}
            icon={currentStep === 1 ? ArrowLeft : undefined}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < 6 && (
            <Button
              variant="primary"
              onClick={handleSaveStep}
              disabled={submitting}
              icon={submitting ? Loader : ArrowRight}
            >
              {submitting ? 'Saving...' : 'Save & Continue'}
            </Button>
          )}

          {currentStep === 6 && (
            <Button
              variant="primary"
              onClick={async () => {
                setSubmitting(true)
                try {
                  const res = await fetch(
                    `/api/client-pos/${clientInfo.po_id}/submit`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
                  )
                  const data = await res.json()
                  if (data.success) {
                    await Swal.fire({
                      icon: 'success',
                      title: 'Client PO Created Successfully',
                      text: 'PO has been submitted for approval',
                      timer: 2000,
                      showConfirmButton: false
                    })
                    navigate(`/client-management/client-pos/${clientInfo.po_id}/review`)
                  }
                } catch (err) {
                  setError(err.message)
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={submitting}
              icon={submitting ? Loader : Check}
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
