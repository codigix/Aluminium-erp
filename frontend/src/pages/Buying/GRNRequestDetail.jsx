import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Badge from '../../components/Badge/Badge'
import Alert from '../../components/Alert/Alert'
import { ArrowLeft, CheckCircle, XCircle, Clock, Package, User, ChevronRight, Truck, Home, FileCheck, AlertCircle } from 'lucide-react'
import ItemInspectionModal from '../../components/Buying/ItemInspectionModal'
import InspectionApprovalModal from '../../components/Buying/InspectionApprovalModal'
import InventoryApprovalModal from '../../components/Buying/InventoryApprovalModal'
import './Buying.css'

export default function GRNRequestDetail() {
  const { grnNo } = useParams()
  const navigate = useNavigate()
  const [grn, setGrn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showInspectionModal, setShowInspectionModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showInventoryApprovalModal, setShowInventoryApprovalModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (grnNo) {
      fetchGRN()
      fetchUser()
    }
  }, [grnNo])

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    }
  }

  const fetchGRN = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:5000/api/grn-requests/${grnNo}`)
      const data = await res.json()
      if (data.success) {
        setGrn(data.data)
      } else {
        setError(data.error || 'Failed to fetch GRN')
      }
    } catch (error) {
      console.error('Error fetching GRN:', error)
      setError('Error fetching GRN details')
    } finally {
      setLoading(false)
    }
  }

  const refetchGRN = () => {
    fetchGRN()
  }

  const handleStartInspection = async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/grn-requests/${grn.id}/start-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.success) {
        setGrn(data.data)
        setSuccess('Inspection started successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error starting inspection')
    } finally {
      setLoading(false)
    }
  }

  const handleItemInspection = (item) => {
    setSelectedItem(item)
    setShowInspectionModal(true)
  }

  const handleApproval = () => {
    setShowApprovalModal(true)
  }

  const handleApprovalSuccess = (updatedGrn) => {
    setGrn(updatedGrn)
    setShowApprovalModal(false)
    setSuccess('GRN approved and stock moved to inventory')
    setTimeout(() => setSuccess(null), 3000)
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      inspecting: 'info',
      awaiting_inventory_approval: 'info',
      approved: 'success',
      rejected: 'danger',
      sent_back: 'warning'
    }
    return colors[status] || 'secondary'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} />
      case 'inspecting':
        return <Package size={16} />
      case 'awaiting_inventory_approval':
        return <Clock size={16} />
      case 'approved':
        return <CheckCircle size={16} />
      case 'rejected':
        return <XCircle size={16} />
      case 'sent_back':
        return <ArrowLeft size={16} />
      default:
        return null
    }
  }

  if (loading && !grn) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Loading GRN details...</p>
        </div>
      </div>
    )
  }

  if (error && !grn) {
    return (
      <Card className="p-6 bg-red-50 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">{error}</p>
        <Button variant="primary" size="sm" onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </Card>
    )
  }

  if (!grn) return null

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="icon"
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm">
            <span>Buying</span>
            <ChevronRight size={16} />
            <span>GRN</span>
            <ChevronRight size={16} />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{grn.grn_no}</span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">GRN #{grn.grn_no}</h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2 text-base">
              <span className="font-medium">PO:</span> {grn.po_no} <span className="mx-2">•</span> <span className="font-medium">Supplier:</span> {grn.supplier_name}
            </p>
          </div>
          <Badge color={getStatusColor(grn.status)} variant="solid" className="flex items-center gap-2 text-base px-4 py-2">
            {getStatusIcon(grn.status)}
            {grn.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {error && <Alert type="danger" className="mb-2">{error}</Alert>}
      {success && <Alert type="success" className="mb-2">{success}</Alert>}

      {/* Workflow Progress - Horizontal Timeline */}
      <Card className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          {[
            { status: 'pending', label: 'Received', icon: Truck },
            { status: 'inspecting', label: 'Inspecting', icon: FileCheck },
            { status: 'awaiting_inventory_approval', label: 'Review', icon: Home },
            { status: 'approved', label: 'Completed', icon: CheckCircle }
          ].map((step, idx) => {
            const Icon = step.icon
            const isCompleted = ['inspecting', 'awaiting_inventory_approval', 'approved', 'rejected'].includes(grn.status) && idx === 0 ||
                               ['awaiting_inventory_approval', 'approved'].includes(grn.status) && idx <= 1 ||
                               grn.status === 'approved' && idx <= 3
            const isActive = (idx === 0 && grn.status === 'pending') ||
                            (idx === 1 && grn.status === 'inspecting') ||
                            (idx === 2 && grn.status === 'awaiting_inventory_approval') ||
                            (idx === 3 && grn.status === 'approved')
            const isSkipped = ['rejected', 'sent_back'].includes(grn.status) && idx >= 3

            return (
              <div key={step.status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all transform font-semibold text-lg shadow-md ${
                    isCompleted ? 'bg-green-500 text-white scale-105' :
                    isActive ? 'bg-blue-500 text-white scale-105' :
                    isSkipped ? 'bg-red-400 text-white' :
                    'bg-neutral-300 text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <p className="text-xs font-semibold mt-3 text-neutral-700 dark:text-neutral-300 text-center whitespace-nowrap">{step.label}</p>
                </div>
                {idx < 3 && (
                  <div className={`h-1.5 flex-1 mx-2 mb-10 rounded-full transition-colors ${
                    isCompleted ? 'bg-green-500' :
                    isActive ? 'bg-blue-300' :
                    isSkipped ? 'bg-red-200' :
                    'bg-neutral-300 dark:bg-neutral-700'
                  }`}></div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">Total Items</p>
              <p className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">{grn.items?.length || 0}</p>
            </div>
            <Package size={40} className="text-blue-500 opacity-20 ml-2" />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-amber-500 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">Receipt Date</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {new Date(grn.receipt_date).toLocaleDateString()}
              </p>
            </div>
            <Clock size={40} className="text-amber-500 opacity-20 ml-2" />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">Assigned To</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {grn.assigned_user || '—'}
              </p>
            </div>
            <User size={40} className="text-purple-500 opacity-20 ml-2" />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-2">Created By</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {grn.created_by_user || 'System'}
              </p>
            </div>
            <FileCheck size={40} className="text-green-500 opacity-20 ml-2" />
          </div>
        </Card>
      </div>

      {/* GRN Details Section */}
      {(grn.approved_by_user || grn.notes) && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide mb-6 flex items-center gap-2">
            <AlertCircle size={18} />
            Additional Information
          </h3>
          <div className="space-y-4">
            {grn.approved_by_user && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Approved By:</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{grn.approved_by_user}</span>
              </div>
            )}
            {grn.notes && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">Notes:</p>
                <p className="text-neutral-900 dark:text-neutral-100">{grn.notes}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Items Section */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Receipt Items</h2>
          {grn.status === 'pending' && (
            <Button
              variant="primary"
              onClick={handleStartInspection}
              loading={loading}
              size="sm"
              className="gap-2 flex items-center"
            >
              <CheckCircle size={16} />
              Start Inspection
            </Button>
          )}
        </div>

        {grn.items && grn.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="px-6 py-4 text-left font-semibold text-neutral-700 dark:text-neutral-300">#</th>
                  <th className="px-6 py-4 text-left font-semibold text-neutral-700 dark:text-neutral-300">Item Code</th>
                  <th className="px-6 py-4 text-left font-semibold text-neutral-700 dark:text-neutral-300">Item Name</th>
                  <th className="px-6 py-4 text-center font-semibold text-neutral-700 dark:text-neutral-300">PO Qty</th>
                  <th className="px-6 py-4 text-center font-semibold text-neutral-700 dark:text-neutral-300">Received Qty</th>
                  <th className="px-6 py-4 text-center font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
                  <th className="px-6 py-4 text-left font-semibold text-neutral-700 dark:text-neutral-300">Warehouse</th>
                  <th className="px-6 py-4 text-center font-semibold text-neutral-700 dark:text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grn.items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100">{item.item_code}</td>
                    <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">{item.item_name}</td>
                    <td className="px-6 py-4 text-center font-semibold text-neutral-900 dark:text-neutral-100">{item.po_qty}</td>
                    <td className="px-6 py-4 text-center font-semibold text-amber-600 dark:text-amber-400">{item.received_qty}</td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        color={item.item_status === 'accepted' ? 'success' : item.item_status === 'rejected' ? 'danger' : 'warning'}
                        variant="solid"
                        className="text-xs inline-block"
                      >
                        {item.item_status?.replace('_', ' ') || 'pending'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100">{item.warehouse_name}</td>
                    <td className="px-6 py-4 text-center">
                      {grn.status === 'inspecting' && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleItemInspection(item)}
                          className="text-xs"
                        >
                          Inspect
                        </Button>
                      )}
                      {grn.status === 'approved' && item.accepted_qty > 0 && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-semibold text-xs">
                          <CheckCircle size={14} /> {item.accepted_qty}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package size={48} className="mx-auto text-neutral-400 mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">No items in this GRN</p>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      {(grn.status === 'inspecting' || grn.status === 'awaiting_inventory_approval') && (
        <Card className="p-8 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-900">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide mb-6 flex items-center gap-2">
            <AlertCircle size={20} />
            Required Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grn.status === 'inspecting' && (
              <>
                <Button
                  variant="success"
                  onClick={handleApproval}
                  className="flex items-center justify-center gap-2 py-4 text-base font-semibold h-auto shadow-lg hover:shadow-xl"
                >
                  <CheckCircle size={22} />
                  Send to Inventory
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowApprovalModal(true)}
                  className="flex items-center justify-center gap-2 py-4 text-base font-semibold h-auto shadow-lg hover:shadow-xl"
                >
                  <XCircle size={22} />
                  Reject GRN
                </Button>
              </>
            )}
            {grn.status === 'awaiting_inventory_approval' && (
              <>
                <Button
                  variant="success"
                  onClick={() => setShowInventoryApprovalModal(true)}
                  className="flex items-center justify-center gap-2 py-4 text-base font-semibold h-auto shadow-lg hover:shadow-xl"
                >
                  <Home size={22} />
                  Approve & Store
                </Button>
                <Button
                  variant="warning"
                  onClick={() => setShowApprovalModal(true)}
                  className="flex items-center justify-center gap-2 py-4 text-base font-semibold h-auto shadow-lg hover:shadow-xl"
                >
                  <ArrowLeft size={22} />
                  Send Back to Inspection
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Activity Timeline */}
      {grn.logs && grn.logs.length > 0 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-8 flex items-center gap-2">
            <Clock size={24} />
            Activity History
          </h2>
          
          <div className="relative pl-8">
            <div className="absolute left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-green-500"></div>
            
            <div className="space-y-6">
              {grn.logs.map((log, idx) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-5 top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-neutral-900"></div>
                  
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-5 border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 text-base">{log.action}</p>
                      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-3 py-1 rounded-full">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge color="info" variant="solid" className="text-xs">
                          {log.status_from}
                        </Badge>
                        <span className="text-neutral-600 dark:text-neutral-400 font-semibold">→</span>
                        <Badge color="success" variant="solid" className="text-xs">
                          {log.status_to}
                        </Badge>
                      </div>
                      
                      {log.reason && (
                        <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900">
                          <p className="text-sm text-amber-900 dark:text-amber-200">
                            <span className="font-semibold">Reason:</span> {log.reason}
                          </p>
                        </div>
                      )}
                      
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-3">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      {showInspectionModal && selectedItem && (
        <ItemInspectionModal
          item={selectedItem}
          grnId={grn.id}
          grnNo={grn.grn_no}
          onClose={() => {
            setShowInspectionModal(false)
            setSelectedItem(null)
          }}
          onSuccess={() => {
            refetchGRN()
            setShowInspectionModal(false)
            setSelectedItem(null)
          }}
        />
      )}

      {showApprovalModal && (
        <InspectionApprovalModal
          grn={grn}
          onClose={() => setShowApprovalModal(false)}
          onSuccess={handleApprovalSuccess}
        />
      )}

      {showInventoryApprovalModal && (
        <InventoryApprovalModal
          grn={grn}
          onClose={() => setShowInventoryApprovalModal(false)}
          onSuccess={(updatedGrn) => {
            setGrn(updatedGrn)
            setShowInventoryApprovalModal(false)
            setSuccess('GRN approved and items stored in inventory')
            setTimeout(() => setSuccess(null), 3000)
          }}
        />
      )}
    </div>
  )
}
