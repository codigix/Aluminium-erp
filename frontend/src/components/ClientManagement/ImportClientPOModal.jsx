import { useState } from 'react'
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react'

const XLSX = window.XLSX
const Swal = window.Swal

export default function ImportClientPOModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [importData, setImportData] = useState([])
  const [importResult, setImportResult] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const ext = selectedFile.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setError('Please upload a .xlsx or .xls file')
      return
    }

    setError(null)
    setFile(selectedFile)
    parseExcelFile(selectedFile)
  }

  const parseExcelFile = (excelFile) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet)

        if (rows.length === 0) {
          setError('No data found in Excel file')
          return
        }

        setImportData(rows)
        setPreview(rows.slice(0, 5))
      } catch (err) {
        setError(`Error parsing file: ${err.message}`)
      }
    }
    reader.readAsBinaryString(excelFile)
  }

  const handleImport = async () => {
    if (importData.length === 0) {
      setError('No data to import')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/client-pos/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: importData })
      })

      const result = await res.json()
      if (result.success) {
        setImportResult(result)
        
        if (result.imported > 0) {
          await Swal.fire({
            icon: 'success',
            title: 'Import Successful',
            text: `${result.imported}/${result.total} Client POs imported successfully`,
            timer: 2000
          })
          onSuccess()
          resetModal()
        } else {
          setError(`All ${result.total} records failed to import. Check errors below.`)
        }
      } else {
        setError(result.error || 'Import failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setFile(null)
    setPreview([])
    setImportData([])
    setError(null)
    setImportResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Import Client POs</h2>
          <button onClick={resetModal} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div>
              <p className="text-sm text-blue-800">
                <strong>Supported formats:</strong> .xlsx and .xls
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-800">
                <strong>Required columns:</strong> po_date, po_status
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-800">
                <strong>Optional columns:</strong> po_number (auto-generated), client_id (uses first customer if empty), contact_person, email_reference
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-800">
                <strong>Valid po_status values:</strong> draft, pending, confirmed, cancelled
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> If client_id is empty, the first available customer will be used automatically
              </p>
            </div>
          </div>

          {/* File Input */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-input"
            />
            <label htmlFor="excel-input" className="cursor-pointer block">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">(.xlsx or .xls)</p>
            </label>
            {file && <p className="text-sm text-green-600 mt-2">✓ {file.name}</p>}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Import Result Errors */}
          {importResult?.errors && importResult.errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Import Errors ({importResult.errors.length})</h3>
              <div className="max-h-64 overflow-y-auto border border-red-200 rounded-lg bg-red-50">
                {importResult.errors.map((err, idx) => (
                  <div key={idx} className="px-3 py-2 border-b last:border-b-0">
                    <p className="text-sm font-semibold text-red-700">{err.row || `Row ${idx + 1}`}</p>
                    <p className="text-xs text-red-600">{err.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !importResult && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Preview ({importData.length} rows)</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-semibold text-gray-700">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        {Object.values(row).map((val, i) => (
                          <td key={i} className="px-3 py-2 text-gray-600">
                            {String(val).substring(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end gap-2 p-6 border-t bg-gray-50">
          <button
            onClick={resetModal}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importData.length === 0 || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
