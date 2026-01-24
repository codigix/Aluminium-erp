import React, { useState, useEffect, useRef } from 'react';

export const Card = ({ id, title, subtitle, action, children, className = '' }) => (
  <div id={id} className={className}>
    {(title || subtitle || action) && (
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between p-2 border-b border-slate-100/80 rounded-t-[32px]">
        <div>
          {subtitle && <p className="text-sm text-slate-400 ">{subtitle}</p>}
          {title && <h2 className="text-xl text-slate-900 text-xs">{title}</h2>}
        </div>
        {action}
      </div>
    )}
    <div className="p-2">{children}</div>
  </div>
)

export const SearchableSelect = ({ options, value, onChange, placeholder, labelField = 'label', valueField = 'value', subLabelField, allowCustom = true, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => String(opt[valueField]) === String(value));

  useEffect(() => {
    if (!isOpen) {
      const newVal = selectedOption ? selectedOption[labelField] : (value || '');
      if (searchTerm !== newVal) {
        setSearchTerm(newVal);
      }
    }
  }, [value, selectedOption, isOpen, labelField, searchTerm]);

  const filteredOptions = options.filter(opt => 
    String(opt[labelField] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(opt[valueField] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (subLabelField && String(opt[subLabelField] || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            if (disabled) return;
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (allowCustom) {
              onChange({ target: { value: e.target.value } });
            }
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
          {isOpen ? '▲' : '▼'}
        </div>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 ${String(opt[valueField]) === String(value) ? 'bg-blue-50 text-blue-600 ' : 'text-slate-700'}`}
                  onClick={() => {
                    onChange({ target: { value: opt[valueField] } });
                    setSearchTerm(opt[labelField]);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{opt[labelField]}</span>
                    {subLabelField && opt[subLabelField] && (
                      <span className="text-[9px] text-slate-400 font-normal">{opt[subLabelField]}</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-xs text-center text-slate-400">
                {allowCustom ? 'Custom value entered' : 'No results found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const FormControl = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className="text-[0.65rem] text-slate-500 ">{label}</span>
    {children}
  </label>
)

export const StatusBadge = ({ status }) => {
  const normalized = (status || 'ACTIVE').toUpperCase()
  
  const getStatusStyles = (s) => {
    switch (s) {
      case 'DRAFT':
      case 'CREATED':
        return 'bg-amber-50 border-amber-200 text-amber-600'
      case 'DESIGN_IN_REVIEW':
      case 'IN_DESIGN':
      case 'IN_PROGRESS':
      case 'RELEASED':
        return 'bg-blue-50 border-blue-200 text-blue-600'
      case 'BOM_SUBMITTED':
        return 'bg-indigo-50 border-indigo-200 text-indigo-600'
      case 'ACTIVE':
      case 'DESIGN_APPROVED':
      case 'BOM_APPROVED':
      case 'COMPLETED':
      case 'PRODUCTION_COMPLETED':
        return 'bg-emerald-50 border-emerald-200 text-emerald-600'
      case 'DESIGN_QUERY':
      case 'INACTIVE':
      case 'REJECTED':
      case 'BLOCKED':
      case 'CANCELLED':
        return 'bg-rose-50 border-rose-200 text-rose-600'
      case 'ON_HOLD':
        return 'bg-amber-50 border-amber-200 text-amber-600'
      default:
        return 'bg-slate-50 border-slate-200 text-slate-600'
    }
  }

  const formatStatus = (s) => {
    return s.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
  }

  return (
    <span className={`px-3 py-1 rounded-full text-[10px]  border  tracking-wider ${getStatusStyles(normalized)}`}>
      {formatStatus(normalized)}
    </span>
  )
}

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    danger: 'bg-rose-50 text-rose-600 border-rose-200',
    info: 'bg-blue-50 text-blue-600 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
};

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-md shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 p-2 flex items-center justify-between rounded-sm">
          <h2 className="text-lg  text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export const DataTable = ({ columns, data, loading, loadingMessage = "Loading...", emptyMessage = "No data found", searchPlaceholder = "Search...", actions, onRowClick, renderExpanded }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (id) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    let sortableData = [...data];
    if (sortConfig !== null) {
      sortableData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [data, sortConfig]);

  const filteredData = sortedData.filter(item => {
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[280px] relative group">
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {actions}
      </div>

      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50/50 text-slate-500 text-[10px]  tracking-widest ">
            <tr>
              {renderExpanded && <th className="px-6 py-4 border-b border-slate-100 w-10"></th>}
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-6 py-4 border-b border-slate-100 ${col.sortable ? 'cursor-pointer hover:bg-slate-100/50 transition-colors' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && (
                      <span className="text-slate-300">
                        {sortConfig?.key === col.key ? (sortConfig.direction === 'ascending' ? '↑' : '↓') : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (renderExpanded ? 1 : 0)} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span className="text-slate-400 font-medium animate-pulse">{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderExpanded ? 1 : 0)} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-slate-400 font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIdx) => {
                const isExpanded = expandedRows.has(row.id || rowIdx);
                return (
                  <React.Fragment key={row.id || rowIdx}>
                    <tr 
                      className={`group transition-all duration-200 ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/30' : 'hover:bg-slate-50/50'} ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                      onClick={() => {
                        if (renderExpanded) toggleRow(row.id || rowIdx);
                        if (onRowClick) onRowClick(row);
                      }}
                    >
                      {renderExpanded && (
                        <td className="px-6 py-4 text-slate-400">
                          <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      )}
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} className={`px-6 py-4 text-slate-600 group-hover:text-slate-900 transition-colors ${col.className || ''}`}>
                          {col.render ? col.render(row[col.key], row) : (row[col.key] || '—')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr>
                        <td colSpan={columns.length + 1} className="px-6 py-0 border-b border-slate-100">
                          <div className="py-4 animate-in slide-in-from-top-2 duration-200">
                            {renderExpanded(row)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
