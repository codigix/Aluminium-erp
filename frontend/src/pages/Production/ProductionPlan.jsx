import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Edit2, Trash2, Eye } from 'lucide-react'
import * as productionService from '../../services/productionService'
import ViewProductionPlanModal from '../../components/Production/ViewProductionPlanModal'
import './Production.css'

export default function ProductionPlan() {
  const navigate = useNavigate()
  const location = useLocation()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(location.state?.success || null)
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  })
  const [viewingPlanId, setViewingPlanId] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)

  useEffect(() => {
    fetchPlans()
  }, [filters])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await productionService.getProductionPlans(filters)
      setPlans(response.data || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to fetch production plans')
      setPlans([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDelete = async (plan_id) => {
    if (window.confirm('Delete this production plan?')) {
      try {
        await productionService.deleteProductionPlan(plan_id)
        setSuccess('Plan deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchPlans()
      } catch (err) {
        setError(err.message || 'Failed to delete plan')
      }
    }
  }

  const handleEdit = (plan) => {
    navigate(`/production/plans/form/${plan.plan_id}`)
  }

  const handleViewPlan = (plan) => {
    setViewingPlanId(plan.plan_id)
    setShowViewModal(true)
  }

  const getStatusColor = (status) => {
    const colors = {
      planned: 'status-planned',
      'in-progress': 'status-in-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      draft: 'status-draft'
    }
    return colors[status] || 'status-draft'
  }

  return (
    <div className="production-container">
      <div className="production-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              backgroundColor: '#3b82f6', 
              padding: '10px', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ color: 'white', fontSize: '20px' }}>📊</div>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Production Planning</h1>
              <p className="header-subtitle" style={{ margin: 0 }}>Create and manage production plans</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => navigate('/production/plans/form')}
          className="btn-submit w-auto"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            backgroundColor: '#3b82f6',
            border: 'none'
          }}
        >
          <Plus size={18} /> New Plan
        </button>
      </div>

      {success && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: '6px',
          padding: '12px 16px',
          marginBottom: '20px',
          color: '#16a34a',
          fontSize: '0.9rem'
        }}>
          ✓ {success}
        </div>
      )}

      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px 16px',
          marginBottom: '20px',
          color: '#dc2626',
          fontSize: '0.9rem'
        }}>
          ✕ {error}
        </div>
      )}

      <ViewProductionPlanModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false)
          setViewingPlanId(null)
        }}
        planId={viewingPlanId}
      />

      <div className="filter-section" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
        <div className="filter-group" style={{ width: '100%' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Search</label>
          <input 
            type="text" 
            name="search" 
            placeholder="Search plan ID or company..." 
            value={filters.search} 
            onChange={handleFilterChange} 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>Loading production plans...</div>
      ) : plans.length > 0 ? (
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table className="entries-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Plan ID</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Company</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Posting Date</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.plan_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#111827' }}>{plan.plan_id}</td>
                  <td style={{ padding: '16px', color: '#374151' }}>{plan.company || '-'}</td>
                  <td style={{ padding: '16px', color: '#374151' }}>{plan.posting_date ? new Date(plan.posting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      backgroundColor: plan.status === 'draft' ? '#fef9c3' : '#dcfce7', 
                      color: plan.status === 'draft' ? '#854d0e' : '#166534',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'lowercase'
                    }}>
                      {plan.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEdit(plan)} 
                        title="Edit"
                        style={{ padding: '6px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(plan.plan_id)} 
                        title="Delete"
                        style={{ padding: '6px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '16px', textAlign: 'right', color: '#6b7280', fontSize: '0.875rem', borderTop: '1px solid #e5e7eb' }}>
            Showing {plans.length} of {plans.length} production plans
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
          <p>No production plans found</p>
        </div>
      )}
    </div>
  )
}
