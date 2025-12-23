import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Clock } from 'lucide-react'
import './Production.css'

export default function Operations() {
  const navigate = useNavigate()
  const [operations, setOperations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchOperations()
  }, [])

  const fetchOperations = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/production/operations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setOperations(data.data || [])
        setError(null)
      } else {
        setError('Failed to fetch operations')
      }
    } catch (err) {
      setError('Error loading operations')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (operationName) => {
    if (!window.confirm('Are you sure you want to delete this operation?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/production/operations/${operationName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Operation deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchOperations()
      } else {
        setError('Failed to delete operation')
      }
    } catch (err) {
      setError('Error deleting operation')
      console.error(err)
    }
  }

  const handleEdit = (operation) => {
    navigate(`/production/operations/form/${operation.name}`, { state: { operation } })
  }

  const filteredOperations = operations.filter(op => 
    op.name.toLowerCase().includes(search.toLowerCase()) ||
    op.operation_name?.toLowerCase().includes(search.toLowerCase()) ||
    op.default_workstation?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return '-'
    }
  }

  return (
    <div className="production-container">
      <div className="production-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              backgroundColor: '#f97316', 
              padding: '8px', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ color: 'white' }}>⚙️</div>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Operations</h1>
              <p className="header-subtitle" style={{ margin: 0 }}>Manage manufacturing operations</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/production/operations/form')}
          className="btn-submit"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            backgroundColor: '#f97316',
            border: 'none'
          }}
        >
          <Plus size={18} /> New operation
        </button>
      </div>

      {success && <div className="alert alert-success">✓ {success}</div>}
      {error && <div className="alert alert-error">✕ {error}</div>}

      <div className="filter-section" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
        <div className="filter-group" style={{ width: '100%' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Search</label>
          <input 
            type="text" 
            placeholder="Search name or workstation..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <p>Loading operations...</p>
        </div>
      ) : filteredOperations.length > 0 ? (
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table className="entries-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>ID</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Operation Name</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Default Workstation</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Last Updated</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map((op) => (
                <tr key={op.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#111827' }}>
                    {op.name}
                  </td>
                  <td style={{ padding: '16px', color: '#374151' }}>{op.operation_name || op.name}</td>
                  <td style={{ padding: '16px', color: '#374151' }}>
                    {op.default_workstation ? (
                      <span>{op.default_workstation}</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: '#6b7280' }}>
                    <span style={{ fontSize: '0.9rem' }}>
                      {formatDate(op.modified)}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEdit(op)}
                        title="Edit operation"
                        style={{ padding: '6px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(op.name)}
                        title="Delete operation"
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
            Showing {filteredOperations.length} of {operations.length} operations
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
          <p>{search ? 'No operations found matching your search' : 'No operations created yet'}</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px', color: '#9ca3af' }}>
            {!search && <button onClick={() => navigate('/production/operations/form')} style={{ color: '#f97316', cursor: 'pointer', border: 'none', background: 'none', textDecoration: 'underline' }}>Create your first operation</button>}
          </p>
        </div>
      )}
    </div>
  )
}
