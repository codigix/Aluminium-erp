import { useState, useEffect } from 'react'
import axios from 'axios'
import Button from '../Button/Button'
import Alert from '../Alert/Alert'
import Badge from '../Badge/Badge'
import { X, CheckCircle } from 'lucide-react'
import '../../styles/Modal.css'

export default function InventoryApprovalModal({ grn, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleApprove = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await axios.post(
        `http://localhost:5000/api/grn-requests/${grn.id}/inventory-approve`
      )

      if (response.data.success) {
        onSuccess && onSuccess(response.data.data)
      } else {
        setError(response.data.error || 'Failed to approve GRN')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error approving GRN')
    } finally {
      setLoading(false)
    }
  }

  const acceptedItems = grn.items?.filter(item => item.accepted_qty > 0) || []
  const totalAccepted = acceptedItems.reduce((sum, item) => sum + (item.accepted_qty || 0), 0)
  const totalRejected = grn.items?.reduce((sum, item) => sum + (item.rejected_qty || 0), 0) || 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2>Inventory Storage Approval</h2>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>GRN #{grn.grn_no} - Approve & Store in Warehouse</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {error && <Alert type="danger" className="mb-4">{error}</Alert>}

        <form>
          {/* GRN Summary */}
          <Card className="mb-6">
            <h4 style={{ fontWeight: 600, marginBottom: '12px' }}>GRN Summary</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>PO Number</p>
                <p style={{ fontWeight: 600, color: '#16a34a' }}>{grn.po_no}</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Supplier</p>
                <p style={{ fontWeight: 600, color: '#16a34a' }}>{grn.supplier_name}</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#dcfce7', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Accepted Qty</p>
                <p style={{ fontWeight: 600, fontSize: '1.2rem', color: '#16a34a' }}>{totalAccepted}</p>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Rejected Qty</p>
                <p style={{ fontWeight: 600, fontSize: '1.2rem', color: '#991b1b' }}>{totalRejected}</p>
              </div>
            </div>
          </Card>

          {/* Items to be Stored */}
          <Card className="mb-6">
            <h4 style={{ fontWeight: 600, marginBottom: '12px' }}>Items for Storage</h4>
            {acceptedItems.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead style={{ backgroundColor: '#f5f5f5' }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Item Code</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Item Name</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Qty Ordered</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Qty Received</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Qty Accepted</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Warehouse</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Batch No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceptedItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{item.item_code}</td>
                        <td style={{ padding: '10px', fontSize: '0.85rem', color: '#666' }}>{item.item_name}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{item.po_qty || '-'}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{item.received_qty}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>
                          {item.accepted_qty}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                            {item.warehouse_name}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.85rem' }}>{item.batch_no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#666', padding: '12px' }}>No items accepted for storage</p>
            )}
          </Card>

          {/* Inspection Details */}
          <Card className="mb-6">
            <h4 style={{ fontWeight: 600, marginBottom: '12px' }}>Inspection Details</h4>
            {grn.items?.map((item) => (
              item.qc_checks && (
                <div key={item.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                  <p style={{ fontWeight: 600, marginBottom: '8px' }}>
                    {item.item_code} - {item.item_name}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.9rem' }}>
                    {Object.entries(item.qc_checks).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={value?.passed || false}
                          disabled
                          style={{ cursor: 'default' }}
                        />
                        <span style={{ color: '#666' }}>{value?.label || key}</span>
                      </div>
                    ))}
                  </div>
                  {item.notes && (
                    <p style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                      Notes: {item.notes}
                    </p>
                  )}
                </div>
              )
            ))}
          </Card>

          {/* Approval Confirmation */}
          <Card className="mb-6">
            <div style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: '#e0f2fe', borderRadius: '6px', alignItems: 'flex-start' }}>
              <CheckCircle size={20} style={{ color: '#0284c7', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: 600, color: '#0284c7', marginBottom: '4px' }}>Ready to Store in Warehouse</p>
                <p style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>
                  By approving, {acceptedItems.length} item{acceptedItems.length !== 1 ? 's' : ''} will be stored in their assigned warehouse{acceptedItems.length !== 1 ? 's' : ''} and stock entries will be created automatically.
                </p>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="success"
              type="button"
              onClick={handleApprove}
              loading={loading}
              className="flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Approve & Store in Inventory
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div style={{
      padding: '16px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      backgroundColor: '#fafafa'
    }} className={className}>
      {children}
    </div>
  )
}
