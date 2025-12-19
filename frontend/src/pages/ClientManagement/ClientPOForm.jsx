import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import { ArrowLeft, Save, Loader, Plus, Trash2, Download, Upload } from 'lucide-react'
import { read, utils, writeFile } from 'xlsx'
import './ClientManagement.css'

export default function ClientPOForm() {
  const { po_id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!po_id && po_id !== 'new')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [clients, setClients] = useState([])
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    client_id: '',
    po_number: '',
    po_date: new Date().toISOString().split('T')[0],
    contact_person: '',
    email_reference: '',
    project_reference: '', // Read-only, auto-generated
    project_name: '',
    project_requirement: '',
    drawings: []
  })

  useEffect(() => {
    fetchClients()
    if (po_id && po_id !== 'new') {
      fetchPO()
    }
  }, [po_id])

  const fetchClients = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/clients`)
      const data = await res.json()
      if (data.success) {
        setClients(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  const fetchPO = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client-pos/${po_id}/review`)
      const data = await res.json()
      if (data.success) {
        const po = data.data.po
        const project = data.data.project || {}
        const drawings = data.data.drawings || []
        
        setFormData({
          po_id: po.po_id,
          client_id: po.client_id,
          po_number: po.po_number,
          po_date: po.po_date ? po.po_date.split('T')[0] : '',
          contact_person: po.contact_person || '',
          email_reference: po.email_reference || '',
          project_reference: po.project_reference || '',
          project_name: po.project_name || project.project_name || '',
          project_requirement: po.project_requirement || '',
          drawings: drawings.map(d => ({
            id: d.id || d.drawing_id,
            drawing_no: d.drawing_no,
            revision: d.revision,
            description: d.description,
            quantity: d.quantity || 1,
            unit_rate: d.unit_rate || 0,
            line_value: d.line_value || 0,
            file_path: d.file_path,
            delivery_date: d.delivery_date ? d.delivery_date.split('T')[0] : ''
          }))
        })
      } else {
        setError(data.error || 'Failed to fetch PO')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAddDrawing = () => {
    setFormData(prev => ({
      ...prev,
      drawings: [
        ...prev.drawings,
        {
          _key: Date.now(),
          drawing_no: '',
          revision: '',
          description: '',
          quantity: 1,
          unit_rate: 0,
          line_value: 0,
          file_path: '',
          delivery_date: ''
        }
      ]
    }))
  }

  const handleDrawingChange = (index, field, value) => {
    const newDrawings = [...formData.drawings]
    newDrawings[index][field] = value
    
    // Auto-calculate line value if quantity or rate changes
    if (field === 'quantity' || field === 'unit_rate') {
        const qty = parseFloat(field === 'quantity' ? value : newDrawings[index].quantity) || 0
        const rate = parseFloat(field === 'unit_rate' ? value : newDrawings[index].unit_rate) || 0
        newDrawings[index].line_value = (qty * rate).toFixed(2)
    }

    setFormData(prev => ({ ...prev, drawings: newDrawings }))
  }

  const handleRemoveDrawing = (index) => {
    const newDrawings = [...formData.drawings]
    newDrawings.splice(index, 1)
    setFormData(prev => ({ ...prev, drawings: newDrawings }))
  }

  const handleExportTemplate = () => {
    const template = [
      { 'Drawing No': '', 'Description': '', 'Quantity': 1, 'Unit Rate': 0, 'Value': 0, 'Revision': '', 'Delivery Date': '' }
    ]
    const ws = utils.json_to_sheet(template)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Drawings')
    writeFile(wb, 'drawing_template.xlsx')
  }

  const handleImportExcel = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const wb = read(data, { type: 'array' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        
        // Convert to array of arrays to find the header row
        const rawData = utils.sheet_to_json(ws, { header: 1 })
        
        console.log('Raw Excel Data:', rawData)

        // Find the header row index
        let headerRowIndex = -1
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i]
          // Check if this row looks like a header row (contains "Drawing No" or similar)
          const rowString = JSON.stringify(row).toLowerCase()
          if (rowString.includes('drawing no') || rowString.includes('drawing number')) {
            headerRowIndex = i
            break
          }
        }

        if (headerRowIndex === -1) {
             console.warn('Could not find a row with "Drawing No". Defaulting to first row.')
             headerRowIndex = 0
        }

        // Extract headers from the found row
        const headers = rawData[headerRowIndex].map(h => (h ? String(h).trim() : ''))
        
        // Map headers to our keys
        const keyMap = {}
        headers.forEach((h, index) => {
            const lowerH = h.toLowerCase()
            if (lowerH.includes('drawing no') || lowerH.includes('drawing number')) keyMap['drawing_no'] = index
            else if (lowerH === 'description') keyMap['description'] = index
            else if (lowerH === 'qty' || lowerH === 'quantity') keyMap['quantity'] = index
            else if (lowerH === 'rev' || lowerH === 'revision') keyMap['revision'] = index
            else if (lowerH.includes('date') || lowerH.includes('delivery')) keyMap['delivery_date'] = index
            else if (lowerH.includes('rate') || lowerH.includes('unit rate')) keyMap['unit_rate'] = index
            else if (lowerH === 'value' || lowerH === 'amount') keyMap['line_value'] = index
        })

        console.log('Found Headers:', headers)
        console.log('Key Map:', keyMap)

        if (keyMap['drawing_no'] === undefined) {
             alert('Could not find "Drawing No" column. Please check the file format.')
             return
        }

        const newDrawings = []
        const today = new Date().toISOString().split('T')[0]

        // Process rows after the header
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i]
            // Skip empty rows
            if (!row || row.length === 0) continue
            
            const drawingNo = row[keyMap['drawing_no']]
            
            // Skip rows without a drawing number
            if (drawingNo === undefined || drawingNo === null || String(drawingNo).trim() === '') continue

            const qty = keyMap['quantity'] !== undefined ? (parseFloat(row[keyMap['quantity']]) || 1) : 1
            const rate = keyMap['unit_rate'] !== undefined ? (parseFloat(row[keyMap['unit_rate']]) || 0) : 0
            const value = keyMap['line_value'] !== undefined ? (parseFloat(row[keyMap['line_value']]) || (qty * rate)) : (qty * rate)

            newDrawings.push({
                _key: Date.now() + i,
                drawing_no: String(drawingNo),
                description: keyMap['description'] !== undefined ? (row[keyMap['description']] || '') : '',
                quantity: qty,
                unit_rate: rate,
                line_value: value,
                revision: keyMap['revision'] !== undefined ? (row[keyMap['revision']] || '') : '',
                delivery_date: keyMap['delivery_date'] !== undefined ? (row[keyMap['delivery_date']] || today) : today,
                file_path: ''
            })
        }

        if (newDrawings.length === 0) {
            alert('No valid drawing rows found after the header.')
        } else {
            setFormData(prev => ({
                ...prev,
                drawings: [...prev.drawings, ...newDrawings]
            }))
        }

      } catch (err) {
        console.error('Error parsing Excel:', err)
        setError('Failed to parse Excel file')
      }
    }
    reader.readAsArrayBuffer(file)
    
    // Reset input
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.client_id || !formData.po_date) {
      setError('Please fill all required fields')
      return
    }

    if (formData.drawings.length === 0) {
      setError('Please add at least one drawing')
      return
    }

    // Validate drawings
    const invalidDrawingIndex = formData.drawings.findIndex(d => !d.drawing_no || d.drawing_no.trim() === '')
    if (invalidDrawingIndex !== -1) {
        setError(`Drawing Number is required for row ${invalidDrawingIndex + 1}`)
        // Scroll to the invalid row
        const rows = document.querySelectorAll('tbody tr')
        if (rows[invalidDrawingIndex]) {
            rows[invalidDrawingIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
            rows[invalidDrawingIndex].classList.add('bg-red-50')
            setTimeout(() => rows[invalidDrawingIndex].classList.remove('bg-red-50'), 2000)
        }
        return
    }

    setSubmitting(true)
    setError(null)

    try {
      const url = `${import.meta.env.VITE_API_URL}/client-pos/create-full`
      
      const payload = {
        ...formData,
        po_id: po_id === 'new' ? null : po_id
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.success) {
        navigate('/client-management/client-pos')
      } else {
        setError(data.error || 'Failed to save PO')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center p-8"><Loader className="animate-spin" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/client-management/client-pos')} className="p-2 hover:bg-gray-100 rounded">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold">Client PO Creation</h1>
          <p className="text-gray-500">Create new client purchase order with drawings</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Client Information */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Client Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
              <select 
                name="client_id" 
                value={formData.client_id} 
                onChange={handleChange} 
                required
                className="w-full border rounded-lg p-2"
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.client_id} value={c.client_id}>{c.client_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client PO No</label>
              <input 
                type="text" 
                name="po_number" 
                value={formData.po_number} 
                onChange={handleChange} 
                placeholder="Auto-generated if empty"
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client PO Date *</label>
              <input 
                type="date" 
                name="po_date" 
                value={formData.po_date} 
                onChange={handleChange} 
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input 
                type="text" 
                name="contact_person" 
                value={formData.contact_person} 
                onChange={handleChange} 
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Reference</label>
              <input 
                type="email" 
                name="email_reference" 
                value={formData.email_reference} 
                onChange={handleChange} 
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>
        </Card>

        {/* Project Information */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Project Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Reference *</label>
              <input 
                type="text" 
                value={formData.project_reference || 'Auto-generated'} 
                readOnly 
                className="w-full border rounded-lg p-2 bg-gray-50 text-gray-500"
              />
            </div>
          </div>
        </Card>

        {/* Drawing Details */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Drawing Details</h2>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={handleExportTemplate} icon={Download} size="sm">
                Export Template
              </Button>
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current.click()} icon={Upload} size="sm">
                Import Excel
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportExcel} 
                className="hidden" 
                accept=".xlsx, .xls" 
              />
              <Button type="button" onClick={handleAddDrawing} icon={Plus} size="sm">Add New Drawing</Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Drawing No *</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Rev</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Description</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Qty</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Unit Rate</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Value</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Delivery Date</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.drawings.map((drawing, index) => (
                  <tr key={drawing._key || index} className="border-b">
                    <td className="p-2">
                      <input 
                        type="text" 
                        value={drawing.drawing_no} 
                        onChange={(e) => handleDrawingChange(index, 'drawing_no', e.target.value)}
                        className="w-full border rounded p-1"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" 
                        value={drawing.revision} 
                        onChange={(e) => handleDrawingChange(index, 'revision', e.target.value)}
                        className="w-20 border rounded p-1"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" 
                        value={drawing.description} 
                        onChange={(e) => handleDrawingChange(index, 'description', e.target.value)}
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        value={drawing.quantity} 
                        onChange={(e) => handleDrawingChange(index, 'quantity', e.target.value)}
                        className="w-20 border rounded p-1"
                        min="1"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        value={drawing.unit_rate} 
                        onChange={(e) => handleDrawingChange(index, 'unit_rate', e.target.value)}
                        className="w-24 border rounded p-1"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        value={drawing.line_value} 
                        readOnly
                        className="w-24 border rounded p-1 bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="date" 
                        value={drawing.delivery_date} 
                        onChange={(e) => handleDrawingChange(index, 'delivery_date', e.target.value)}
                        className="w-full border rounded p-1"
                      />
                    </td>
                    <td className="p-2">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveDrawing(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {formData.drawings.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      No drawings added. Click "Add New Drawing" to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="secondary" onClick={() => navigate('/client-management/client-pos')}>Cancel</Button>
          <Button type="submit" icon={submitting ? Loader : Save} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Client PO'}
          </Button>
        </div>
      </form>
    </div>
  )
}
