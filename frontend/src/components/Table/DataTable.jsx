import React, { useState, useMemo } from 'react'
import '../Table/DataTable.css'

export default function DataTable({ 
  columns, 
  data, 
  renderActions,
  filterable = true,
  sortable = true,
  pageSize = 10
}) {
  const [filters, setFilters] = useState({})
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc'
  })
  const [currentPage, setCurrentPage] = useState(1)

  // Apply filters
  const filteredData = useMemo(() => {
    return data.filter(row => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true
        const rowValue = String(row[key]).toLowerCase()
        return rowValue.includes(String(value).toLowerCase())
      })
    })
  }, [data, filters])

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (aVal === null) return 1
      if (bVal === null) return -1

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortConfig.direction === 'asc' 
        ? aVal - bVal
        : bVal - aVal
    })

    return sorted
  }, [filteredData, sortConfig])

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  return (
    <div className="data-table-wrapper">
      {filterable && columns.length > 0 && (
        <div className="table-filters">
          {columns.map(col => (
            <div key={col.key} className="filter-input">
              <label>{col.label}</label>
              <input 
                type="text"
                placeholder={`Filter ${col.label}...`}
                value={filters[col.key] || ''}
                onChange={(e) => handleFilterChange(col.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th 
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => sortable && handleSort(col.key)}
                  className={sortable ? 'sortable' : ''}
                  title={sortable ? 'Click to sort' : ''}
                >
                  <div className="th-content">
                    {col.label}
                    {sortable && sortConfig.key === col.key && (
                      <span className="sort-indicator">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {renderActions && <th className="actions-col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="no-data">
                  No data available
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr key={idx} className="data-row">
                  {columns.map(col => (
                    <td key={col.key} style={{ width: col.width }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {renderActions && (
                    <td className="actions-col">
                      {renderActions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          
          <div className="page-info">
            Page {currentPage} of {totalPages} 
            ({sortedData.length} total records)
          </div>

          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}