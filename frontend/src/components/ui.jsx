import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, X, Search, FileText, ChevronRight, ChevronLeft, Loader2, Check, ChevronsLeft, ChevronsRight } from 'lucide-react';

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

export const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  labelField = 'label', 
  valueField = 'value', 
  subLabelField, 
  getOptionLabel,
  getOptionSublabel,
  allowCustom = true, 
  disabled = false, 
  openUpwards = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const getLabel = (opt) => {
    if (!opt) return '';
    if (getOptionLabel) return getOptionLabel(opt);
    return opt[labelField] || '';
  };

  const getSublabel = (opt) => {
    if (!opt) return '';
    if (getOptionSublabel) return getOptionSublabel(opt);
    return opt[subLabelField] || '';
  };

  const selectedOption = options.find(opt => String(opt[valueField]) === String(value));

  useEffect(() => {
    if (!isOpen) {
      const newVal = selectedOption ? getLabel(selectedOption) : (value || '');
      if (searchTerm !== newVal) {
        setSearchTerm(newVal);
      }
    }
  }, [value, selectedOption, isOpen]);

  const safeSearchTerm = String(searchTerm || '').toLowerCase();
  const filteredOptions = options.filter(opt => 
    String(getLabel(opt) || '').toLowerCase().includes(safeSearchTerm) ||
    String(opt[valueField] || '').toLowerCase().includes(safeSearchTerm) ||
    String(getSublabel(opt) || '').toLowerCase().includes(safeSearchTerm)
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
          className={`w-full p-2 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'} ${className}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            if (disabled) return;
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (allowCustom) {
              onChange(e);
            }
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>
      
      {isOpen && !disabled && (
        <div className={`absolute z-[100] w-full bg-white border border-slate-200 rounded shadow-xl max-h-60 flex flex-col overflow-hidden ${openUpwards ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className={`p-2 text-xs cursor-pointer hover:bg-blue-50 ${String(opt[valueField]) === String(value) ? 'bg-blue-50 text-blue-600 ' : 'text-slate-700'}`}
                  onClick={() => {
                    onChange({ target: { value: opt[valueField] } });
                    setSearchTerm(getLabel(opt));
                    setIsOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{getLabel(opt)}</span>
                    {getSublabel(opt) && (
                      <span className="text-[10px] text-slate-400 font-normal whitespace-pre-line">{getSublabel(opt)}</span>
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

export const MultiSelect = ({ options, value = [], onChange, placeholder, labelField = 'label', valueField = 'value', subLabelField, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const selectedValues = Array.isArray(value) ? value.map(v => String(v)) : [];
  
  const toggleOption = (val) => {
    const stringVal = String(val);
    let newValue;
    if (selectedValues.includes(stringVal)) {
      newValue = selectedValues.filter(v => v !== stringVal);
    } else {
      newValue = [...selectedValues, stringVal];
    }
    onChange({ target: { value: newValue } });
  };

  const safeSearchTerm = String(searchTerm || '').toLowerCase();
  const filteredOptions = options.filter(opt => 
    String(opt[labelField] || '').toLowerCase().includes(safeSearchTerm) ||
    String(opt[valueField] || '').toLowerCase().includes(safeSearchTerm) ||
    (subLabelField && String(opt[subLabelField] || '').toLowerCase().includes(safeSearchTerm))
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
      <div 
        className={`min-h-[38px] w-full p-1.5 border border-slate-200 rounded text-xs text-slate-900 flex flex-wrap gap-1 items-center cursor-pointer focus-within:ring-2 focus:ring-blue-500 ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {selectedValues.length > 0 ? (
          selectedValues.map(val => {
            const opt = options.find(o => String(o[valueField]) === val);
            return (
              <span key={val} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md flex items-center gap-1 ">
                {opt ? opt[labelField] : val}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-indigo-800" 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(val);
                  }}
                />
              </span>
            );
          })
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <div className="ml-auto text-slate-400">
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border-none rounded text-xs focus:ring-0 outline-none"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedValues.includes(String(opt[valueField]));
                return (
                  <div
                    key={idx}
                    className={`p-2 text-xs cursor-pointer hover:bg-blue-50 flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-600 ' : 'text-slate-700'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt[valueField]);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{opt[labelField]}</span>
                      {subLabelField && opt[subLabelField] && (
                        <span className="text-xs text-slate-400 font-normal">{opt[subLabelField]}</span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-xs text-center text-slate-400">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const FormControl = ({ label, children }) => (
  <label className="flex flex-col gap-2">
    <span className="text-xs text-slate-500 ">{label}</span>
    {children}
  </label>
)

export const StatusBadge = ({ status }) => {
  const normalized = (status || 'ACTIVE').trim().toUpperCase()
  
  const getStatusStyles = (s) => {
    switch (s) {
      case 'DRAFT':
      case 'CREATED':
        return 'bg-slate-50 border-slate-200 text-slate-600'
      case 'APPROVED':
      case 'DESIGN_APPROVED':
      case 'BOM_APPROVED':
      case 'MASTER':
        return 'bg-blue-50 border-blue-200 text-blue-600'
      case 'PROCESSING':
      case 'DESIGN_IN_REVIEW':
      case 'IN_DESIGN':
      case 'IN_PROGRESS':
      case 'RELEASED':
      case 'PO_CREATED':
      case 'ORDERED':
      case 'DISPATCHED':
      case 'IN_TRANSIT':
      case 'RETURN_INITIATED':
      case 'RETURN_IN_TRANSIT':
        return 'bg-indigo-50 border-indigo-200 text-indigo-600'
      case 'FULFILLED':
      case 'ACTIVE':
      case 'COMPLETED':
      case 'PRODUCTION_COMPLETED':
      case 'DELIVERED':
      case 'RETURN_COMPLETED':
        return 'bg-emerald-50 border-emerald-200 text-emerald-600'
      case 'READY_FOR_SHIPMENT':
      case 'QC_APPROVED':
      case 'READY_TO_DISPATCH':
        return 'bg-emerald-50 border-emerald-200 text-emerald-600'
      case 'DESIGN_QUERY':
      case 'INACTIVE':
      case 'REJECTED':
      case 'QC_REJECTED':
      case 'BLOCKED':
      case 'CANCELLED':
        return 'bg-rose-50 border-rose-200 text-rose-600'
      case 'RFQ_REQUESTED':
      case 'ON_HOLD':
      case 'OUT_FOR_DELIVERY':
      case 'RETURN_PICKUP_ASSIGNED':
      case 'REVISED':
        return 'bg-amber-50 border-amber-200 text-amber-600'
      case 'SENT':
        return 'bg-indigo-50 border-indigo-200 text-indigo-600'
      case 'RETURN_RECEIVED':
        return 'bg-purple-50 border-purple-200 text-purple-600'
      default:
        return 'bg-slate-50 border-slate-200 text-slate-600'
    }
  }

  const formatStatus = (s) => {
    return s.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
  }

  return (
    <span className={`px-2.5 py-1 rounded text-xs  border   ${getStatusStyles(normalized)}`}>
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
    <span className={`p-1  rounded text-xs   border ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
};

export const Modal = ({ isOpen, onClose, title, children, className = '', size = '4xl' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isDark = className.includes('bg-slate-900') || className.includes('bg-[#1e293b]') || className.includes('dark');

  const sizeClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-full'
  };

  const maxWidth = sizeClasses[size] || 'max-w-4xl';
  const isFull = size === 'full';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-black/60 backdrop-blur-sm overflow-y-auto py-4 sm:py-8" onClick={onClose}>
      <div className={`rounded  shadow-2xl ${maxWidth} w-full ${isFull ? 'min-h-full mx-0 rounded-none !my-0' : 'mx-4 h-fit max-h-[85vh] flex flex-col overflow-hidden'} border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 z-10 border-b p-2 flex items-center justify-between ${isDark ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-100 text-slate-900 '}`}>
          <h2 className="text-lg  tracking-tight">{title}</h2>
          <button onClick={onClose} className={`p-2 rounded  transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="p-2 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize }) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);
      
      if (end === totalPages) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 border-t border-slate-50 bg-white">
      <div className="text-xs text-slate-500 font-medium">
        Showing <span className="text-slate-900 ">{startItem}</span> to <span className="text-slate-900 ">{endItem}</span> of <span className="text-slate-900 ">{totalItems}</span> entries
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title="First Page"
        >
          <ChevronsLeft size={15} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title="Previous Page"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded  text-xs  transition-all ${
                currentPage === page 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title="Next Page"
        >
          <ChevronRight size={15} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title="Last Page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};

export const DataTable = ({ columns, data, loading, loadingMessage = "Loading...", emptyMessage = "No data found", searchPlaceholder = "Search...", actions, onRowClick, renderExpanded, className = '', hideHeader = false, hideExpander = false, pageSize: initialPageSize = 10, disableRowClickExpansion = false, selectable = false, selectedRows = new Set(), onSelectionChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const isDark = className.includes('bg-[#1e293b]') || className.includes('bg-slate-900') || className.includes('bg-[#0f172a]');

  const toggleRow = (id) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
  };

  const toggleRowExternal = (id) => {
    toggleRow(id);
  };

  useEffect(() => {
    if (window) {
      window.toggleDataTableRow = toggleRowExternal;
    }
    return () => {
      if (window) {
        delete window.toggleDataTableRow;
      }
    };
  }, [expandedRows]);

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

  const filteredData = React.useMemo(() => {
    return sortedData.filter(item => {
      if (hideHeader) return true;
      const searchLower = String(searchTerm || '').toLowerCase();
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(searchLower)
      );
    });
  }, [sortedData, searchTerm, hideHeader]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, data.length]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSelectAll = (e) => {
    if (onSelectionChange) {
      if (e.target.checked) {
        onSelectionChange(new Set(paginatedData.map((row, idx) => row.id || (currentPage - 1) * pageSize + idx)));
      } else {
        onSelectionChange(new Set());
      }
    }
  };

  const handleSelectRow = (id) => {
    if (onSelectionChange) {
      const newSelected = new Set(selectedRows);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      onSelectionChange(newSelected);
    }
  };

  return (
    <div className={`flex flex-col h-full rounded    overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100 '} ${className}`}>
      {!hideHeader && (
        <div className={`border-b flex flex-wrap gap-2 items-center justify-between ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/30'}`}>
          <div className="flex-1 min-w-[280px] relative group">
            <input 
              type="text" 
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded  text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            />
            <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          {actions}
        </div>
      )}

      <div className="overflow-x-auto custom-scrollbar relative mt-3">
        <table className="w-full text-left bg-white  text-sm border-collapse">
          <thead className={`${isDark ? 'bg-white text-slate-400' : 'bg-slate-50/50 text-slate-500'} text-xs    `}>
            <tr>
              {selectable && (
                <th className={`p-2 border-b w-8 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={handleSelectAll}
                    checked={paginatedData.length > 0 && paginatedData.every((row, idx) => selectedRows.has(row.id || (currentPage - 1) * pageSize + idx))}
                  />
                </th>
              )}
              {renderExpanded && !hideExpander && <th className={`p-2 border-b w-10 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}></th>}
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`p-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} ${col.sortable ? 'cursor-pointer hover:bg-slate-100/50 transition-colors' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2 ">
                    {col.label}
                    {col.sortable && (
                      <span className="text-slate-300">
                        {sortConfig?.key === col.key ? (sortConfig.direction === 'ascending' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-50'}`}>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (renderExpanded && !hideExpander ? 1 : 0) + (selectable ? 1 : 0)} className="p-2 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
                    <span className="text-slate-400  animate-pulse">{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderExpanded && !hideExpander ? 1 : 0) + (selectable ? 1 : 0)} className="p-2 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-3 h-3 text-slate-200" />
                    <span className="text-slate-400 ">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const isExpanded = expandedRows.has(row.id || rowIdx);
                const rowId = row.id || (currentPage - 1) * pageSize + rowIdx;
                const isSelected = selectedRows.has(rowId);
                
                return (
                  <React.Fragment key={row.id || rowIdx}>
                    <tr 
                      className={`group transition-all duration-200 ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/30' : (isDark ? 'hover:bg-white' : 'hover:bg-slate-50/50')} ${isExpanded || isSelected ? (isDark ? 'bg-indigo-900/20' : 'bg-indigo-50/20') : ''}`}
                      onClick={() => {
                        if (renderExpanded && !disableRowClickExpansion) toggleRow(row.id || rowIdx);
                        if (onRowClick) onRowClick(row);
                      }}
                    >
                      {selectable && (
                        <td className="p-2 w-8">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectRow(rowId);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      )}
                      {renderExpanded && !hideExpander && (
                        <td className="p-2 text-slate-400">
                          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </td>
                      )}
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} className={`p-2 transition-colors text-xs ${isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'} ${col.className || ''}`}>
                          {col.render ? col.render(row[col.key], row) : (row[col.key] || '—')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr>
                        <td colSpan={columns.length + (hideExpander ? 0 : 1) + (selectable ? 1 : 0)} className={`p-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <div className=" animate-in slide-in-from-top-2 duration-200">
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

      {!loading && filteredData.length > 0 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredData.length}
          pageSize={pageSize}
        />
      )}
    </div>
  );
};
