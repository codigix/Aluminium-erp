import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Button from '../../components/Button/Button'
import DataTable from '../../components/Table/DataTable'
import Alert from '../../components/Alert/Alert'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, Package } from 'lucide-react'
import InventoryApprovalModal from '../../components/Buying/InventoryApprovalModal'
import './Inventory.css'

export default function GRNRequests() {
  const [grns, setGrns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [filters, setFilters] = useState({ status: '' })
  const [selectedGRN, setSelectedGRN] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showApprovalForm, setShowApprovalForm] = useState(false)
  const [showInventoryApprovalModal, setShowInventoryApprovalModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [approvalItems, setApprovalItems] = useState([])

  useEffect(() => {
    fetchGRNRequests()
  }, [filters])

  const fetchGRNRequests = async () => {
    try {
      setLoading(true)
      const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
      const response = await axios.get(`/api/grn-requests?${query}`)
      setGrns(response.data.data || [])
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch GRN requests')
    } finally {
      setLoading(false)
    }
  }

  const handleStartInspection = async (grnId) => {
    try {
      const response = await axios.post(`/api/grn-requests/${grnId}/start-inspection`)
      setSuccess('Inspection started')
      fetchGRNRequests()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start inspection')
    }
  }

  const handleApprove = async (grnId) => {
    if (approvalItems.length === 0) {
      setError('Please add accepted items')
      return
    }

    try {
      const response = await axios.post(`/api/grn-requests/${grnId}/approve`, {
        approvedItems: approvalItems
      })
      setSuccess('GRN approved and stock entry created')
      setShowApprovalForm(false)
      setApprovalItems([])
      fetchGRNRequests()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve GRN')
    }
  }

  const handleReject = async (grnId) => {
    if (!rejectionReason.trim()) {
      setError('Please provide rejection reason')
      return
    }

    try {
      await axios.post(`/api/grn-requests/${grnId}/reject`, {
        reason: rejectionReason
      })
      setSuccess('GRN rejected')
      setShowDetails(false)
      setRejectionReason('')
      fetchGRNRequests()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject GRN')
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'warning',
      inspecting: 'info',
      awaiting_inventory_approval: 'info',
      approved: 'success',
      rejected: 'danger',
      sent_back: 'warning'
    }
    const labels = {
      pending: 'Pending',
      inspecting: 'Inspecting',
      awaiting_inventory_approval: 'Awaiting Inventory Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      sent_back: 'Sent Back'
    }
    return <Badge variant={colors[status] || 'secondary'}>{labels[status] || status}</Badge>
  }

  const handleApprovalItemChange = (itemId, field, value) => {
    setApprovalItems(prev => {
      const existing = prev.find(item => item.id === itemId)
      if (existing) {
        return prev.map(item =>
          item.id === itemId ? { ...item, [field]: parseFloat(value) || 0 } : item
        )
      } else {
        return [...prev, { id: itemId, [field]: parseFloat(value) || 0 }]
      }
    })
  }

  const columns = [
    { key: 'grn_no', label: 'GRN Number' },
    { key: 'po_no', label: 'PO Number' },
    { key: 'supplier_name', label: 'Supplier' },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      render: (val) => val ? new Date(val).toLocaleDateString() : '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => getStatusBadge(val)
    },
    {
      key: 'total_items',
      label: 'Items'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (val, row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn-primary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => {
              setSelectedGRN(row)
              setShowDetails(true)
            }}
          >
            <Eye size={14} style={{ marginRight: '4px' }} /> View
          </button>
          {row.status === 'pending' && (
            <button 
              className="btn-info" 
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => handleStartInspection(row.id)}
            >
              <Clock size={14} style={{ marginRight: '4px' }} /> Inspect
            </button>
          )}
          {row.status === 'inspecting' && (
            <>
              <button 
                className="btn-success" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => {
                  setSelectedGRN(row)
                  setApprovalItems(row.items.map(item => ({ id: item.id, accepted_qty: item.received_qty })))
                  setShowApprovalForm(true)
                }}
              >
                <CheckCircle size={14} style={{ marginRight: '4px' }} /> Approve
              </button>
              <button 
                className="btn-danger" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => {
                  setSelectedGRN(row)
                  setShowDetails(true)
                }}
              >
                <XCircle size={14} style={{ marginRight: '4px' }} /> Reject
              </button>
            </>
          )}
          {row.status === 'awaiting_inventory_approval' && (
            <button 
              className="btn-success" 
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => {
                setSelectedGRN(row)
                setShowInventoryApprovalModal(true)
              }}
            >
              <CheckCircle size={14} style={{ marginRight: '4px' }} /> Store
            </button>
          )}
        </div>
      )
    }
  ]

  if (loading) {
    return <div className="inventory-container"><p>Loading GRN requests...</p></div>
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h1>
          <Package size={28} style={{ display: 'inline', marginRight: '10px' }} />
          GRN Requests
        </h1>
      </div>

      {error && <Alert type="danger">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <Card title="GRN Requests">
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '15px' }}>
            Filter by Status:
            <select 
              value={filters.status} 
              onChange={(e) => setFilters({ status: e.target.value })}
              style={{ marginLeft: '8px', padding: '6px' }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="inspecting">Inspecting</option>
              <option value="awaiting_inventory_approval">Awaiting Inventory Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="sent_back">Sent Back</option>
            </select>
          </label>
        </div>

        {grns.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No GRN requests found</p>
        ) : (
          <DataTable columns={columns} data={grns} />
        )}
      </Card>

      {showDetails && selectedGRN && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Card title={`GRN Details - ${selectedGRN.grn_no}`} style={{
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ marginBottom: '15px' }}>
              <p><strong>PO Number:</strong> {selectedGRN.po_no}</p>
              <p><strong>Supplier:</strong> {selectedGRN.supplier_name}</p>
              <p><strong>Receipt Date:</strong> {new Date(selectedGRN.receipt_date).toLocaleDateString()}</p>
              <p><strong>Status:</strong> {getStatusBadge(selectedGRN.status)}</p>
              {selectedGRN.rejection_reason && (
                <p style={{ color: '#d32f2f' }}><strong>Rejection Reason:</strong> {selectedGRN.rejection_reason}</p>
              )}
            </div>

            <h4>Items:</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Item Code</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Item Name</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Received Qty</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedGRN.items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{item.item_code}</td>
                    <td style={{ padding: '10px' }}>{item.item_name}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.received_qty}</td>
                    <td style={{ padding: '10px' }}>{item.item_status || 'pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedGRN.status === 'inspecting' && !showApprovalForm && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label>Rejection Reason (if rejecting):</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '10px',
                      marginTop: '5px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontFamily: 'Arial'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => {
                    setShowDetails(false)
                    setRejectionReason('')
                  }}>Close</Button>
                  <Button variant="danger" onClick={() => handleReject(selectedGRN.id)}>Reject</Button>
                </div>
              </div>
            )}

            {!showApprovalForm && selectedGRN.status !== 'inspecting' && (
              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setShowDetails(false)}>Close</Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {showApprovalForm && selectedGRN && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Card title={`Approve GRN - ${selectedGRN.grn_no}`} style={{
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Item Code</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Received Qty</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Accepted Qty</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Rejected Qty</th>
                </tr>
              </thead>
              <tbody>
                {selectedGRN.items.map(item => {
                  const approval = approvalItems.find(a => a.id === item.id) || {}
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{item.item_code}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{item.received_qty}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={approval.accepted_qty || 0}
                          onChange={(e) => handleApprovalItemChange(item.id, 'accepted_qty', e.target.value)}
                          min="0"
                          max={item.received_qty}
                          style={{ width: '70px', padding: '6px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={approval.rejected_qty || 0}
                          onChange={(e) => handleApprovalItemChange(item.id, 'rejected_qty', e.target.value)}
                          min="0"
                          max={item.received_qty}
                          style={{ width: '70px', padding: '6px', textAlign: 'center' }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => {
                setShowApprovalForm(false)
                setApprovalItems([])
              }}>Cancel</Button>
              <Button variant="success" onClick={() => handleApprove(selectedGRN.id)}>Approve</Button>
            </div>
          </Card>
        </div>
      )}

      {showInventoryApprovalModal && selectedGRN && (
        <InventoryApprovalModal
          grn={selectedGRN}
          onClose={() => {
            setShowInventoryApprovalModal(false)
            setSelectedGRN(null)
          }}
          onSuccess={(updatedGRN) => {
            setSuccess('GRN approved and items stored in inventory')
            setShowInventoryApprovalModal(false)
            setSelectedGRN(null)
            fetchGRNRequests()
            setTimeout(() => setSuccess(null), 3000)
          }}
        />
      )}
    </div>
  )
}
