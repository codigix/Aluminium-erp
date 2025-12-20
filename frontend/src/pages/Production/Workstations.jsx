import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import './Production.css'

export default function Workstations() {
  const navigate = useNavigate()
  const [workstations, setWorkstations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchWorkstations()
  }, [])

  const fetchWorkstations = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/production/workstations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setWorkstations(data.data || [])
        setError(null)
      } else {
        setError('Failed to fetch workstations')
      }
    } catch (err) {
      setError('Error loading workstations')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (workstationName) => {
    if (!window.confirm('Are you sure you want to delete this workstation?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/production/workstations/${workstationName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        setSuccess('Workstation deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchWorkstations()
      } else {
        setError('Failed to delete workstation')
      }
    } catch (err) {
      setError('Error deleting workstation')
      console.error(err)
    }
  }

  const handleEdit = (workstation) => {
    navigate(`/production/workstations/form/${workstation.name}`, { state: { workstation } })
  }

  const filteredWorkstations = workstations.filter(ws => 
    ws.name.toLowerCase().includes(search.toLowerCase()) ||
    ws.workstation_name?.toLowerCase().includes(search.toLowerCase()) ||
    ws.description?.toLowerCase().includes(search.toLowerCase())
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
              backgroundColor: '#0ea5e9', 
              padding: '8px', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ color: 'white' }}>🏭</div>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Workstations</h1>
              <p className="header-subtitle" style={{ margin: 0 }}>Manage manufacturing equipment</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/production/workstations/form')}
          className="btn-submit"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            backgroundColor: '#0ea5e9',
            border: 'none'
          }}
        >
          <Plus size={18} /> New Workstation
        </button>
      </div>

      {success && <div className="alert alert-success">✓ {success}</div>}
      {error && <div className="alert alert-error">✕ {error}</div>}

      <div className="filter-section" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
        <div className="filter-group" style={{ width: '100%' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Search</label>
          <input 
            type="text" 
            placeholder="Search name or description..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <p>Loading workstations...</p>
        </div>
      ) : filteredWorkstations.length > 0 ? (
        <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <table className="entries-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>ID</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Name</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Last Updated</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkstations.map((ws) => (
                <tr key={ws.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#111827' }}>
                    {ws.name}
                  </td>
                  <td style={{ padding: '16px', color: '#374151' }}>{ws.workstation_name || ws.name}</td>
                  <td style={{ padding: '16px', color: '#374151' }}>
                    <span style={{ color: '#6b7280' }}>
                      {ws.description || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#6b7280' }}>
                    <span style={{ fontSize: '0.9rem' }}>
                      {formatDate(ws.modified)}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEdit(ws)}
                        title="Edit workstation"
                        style={{ padding: '6px', color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(ws.name)}
                        title="Delete workstation"
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
            Showing {filteredWorkstations.length} of {workstations.length} workstations
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
          <p>{search ? 'No workstations found matching your search' : 'No workstations created yet'}</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px', color: '#9ca3af' }}>
            {!search && <button onClick={() => navigate('/production/workstations/form')} style={{ color: '#0ea5e9', cursor: 'pointer', border: 'none', background: 'none', textDecoration: 'underline' }}>Create your first workstation</button>}
          </p>
        </div>
      )}
    </div>
  )
}
