import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Sheet, Edit2 } from 'lucide-react'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import './ClientManagement.css'

const Swal = window.Swal

export default function ClientPOReview() {
  const { po_id } = useParams()
  const navigate = useNavigate()

  const [downloading, setDownloading] = useState(false)
  const [poData, setPoData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPOData()
  }, [po_id])

  const fetchPOData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client-pos/${po_id}/review`)
      const data = await res.json()

      if (data.success) {
        setPoData(data.data)
      } else {
        setError(data.error || 'Failed to fetch PO details')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client-pos/${po_id}/download/pdf`)
      
      if (!res.ok) {
        throw new Error('Failed to download PDF')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `PO-${poData?.po?.po_number || po_id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      await Swal.fire({
        icon: 'success',
        title: 'PDF Downloaded',
        text: 'Your purchase order PDF has been downloaded',
        timer: 2000,
        showConfirmButton: false
      })
    } catch (err) {
      console.error('Error downloading PDF:', err)
      await Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: err.message || 'Failed to download PDF'
      })
    } finally {
      setDownloading(false)
    }
  }

  const downloadExcel = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/client-pos/${po_id}/download/excel`)
      
      if (!res.ok) {
        throw new Error('Failed to download Excel')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `PO-${poData?.po?.po_number || po_id}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      await Swal.fire({
        icon: 'success',
        title: 'Excel Downloaded',
        text: 'Your purchase order Excel file has been downloaded',
        timer: 2000,
        showConfirmButton: false
      })
    } catch (err) {
      console.error('Error downloading Excel:', err)
      await Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: err.message || 'Failed to download Excel'
      })
    } finally {
      setDownloading(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/client-management/client-pos')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold">PO Review</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/client-management/client-pos')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">PO Review</h1>
            <p className="text-gray-500 mt-1">Review and download your Client Purchase Order</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Edit2}
            onClick={() => navigate(`/client-management/client-pos/${po_id}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Download Buttons */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex gap-4 flex-wrap">
          <Button
            variant="primary"
            icon={FileText}
            onClick={downloadPDF}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download PDF'}
          </Button>
          <Button
            variant="primary"
            icon={Sheet}
            onClick={downloadExcel}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download Excel'}
          </Button>
        </div>
      </Card>

      {/* PO Template Preview (EJS Rendering) */}
      <div className="bg-white rounded-lg shadow">
        <iframe
          src={`${import.meta.env.VITE_API_URL}/client-pos/${po_id}/template`}
          style={{
            width: '100%',
            height: '800px',
            border: 'none',
            borderRadius: '0.5rem'
          }}
          title="PO Template Preview"
        />
      </div>
    </div>
  )
}
