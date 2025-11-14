import React, { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import Modal from '../Modal'
import * as productionService from '../../services/productionService'

// Helper function to get week number
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export default function CreateProductionPlanModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    plan_date: new Date().toISOString().split('T')[0],
    week_number: getWeekNumber(new Date()),
    planned_by_id: '',
    status: 'draft'
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    let updatedData = { ...formData, [name]: value }
    
    // If plan_date changes, recalculate week_number
    if (name === 'plan_date') {
      updatedData.week_number = getWeekNumber(new Date(value))
    }
    
    setFormData(updatedData)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.planned_by_id) {
        throw new Error('Please enter Planner ID')
      }

      await productionService.createProductionPlan(formData)
      
      // Reset form
      const today = new Date()
      setFormData({
        plan_date: today.toISOString().split('T')[0],
        week_number: getWeekNumber(today),
        planned_by_id: '',
        status: 'draft'
      })
      
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create production plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Create Production Plan" size="md">
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
            Plan Date *
          </label>
          <input
            type="date"
            name="plan_date"
            value={formData.plan_date}
            onChange={handleInputChange}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
            Week Number
          </label>
          <input
            type="number"
            name="week_number"
            value={formData.week_number}
            onChange={handleInputChange}
            readOnly
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontFamily: 'inherit',
              background: '#f9fafb',
              color: '#666'
            }}
          />
          <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
            Auto-calculated based on plan date
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
            Planner ID *
          </label>
          <input
            type="text"
            name="planned_by_id"
            placeholder="PL-XXXXX or Employee ID"
            value={formData.planned_by_id}
            onChange={handleInputChange}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontFamily: 'inherit'
            }}
          >
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div style={{
          background: '#f0fdf4',
          border: '1px solid #dcfce7',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          color: '#166534'
        }}>
          <strong>📌 Note:</strong> You can add items to this plan after creation.
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: '#f9fafb',
              color: '#1a1a1a',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              background: '#f59e0b',
              color: 'white',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Creating...' : '✓ Create Plan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}