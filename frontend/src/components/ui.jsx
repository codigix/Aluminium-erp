import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, X, Search, FileText, ChevronRight, ChevronLeft, Loader2, Check, ChevronsLeft, ChevronsRight, Home, User, Settings, Info } from 'lucide-react';

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
  className = '',
  onFocus
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
          className={`w-full p-2 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'} ${className}`}
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
          onFocus={() => {
            if (onFocus) onFocus();
            if (!disabled) setIsOpen(true);
          }}
          disabled={disabled}
        />
        {!className.includes('hide-arrow') && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </div>
        )}
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
                  <div className="flex items-center gap-2">
                    <span className="">{getLabel(opt)}</span>
                    {getSublabel(opt) && (
                      <span className="text-xs text-slate-400 font-normal whitespace-pre-line">
                        {getSublabel(opt).startsWith('🟢') || getSublabel(opt).startsWith('🔴')
                          ? getSublabel(opt)
                          : `(${getSublabel(opt)})`
                        }
                      </span>
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
              <span key={val} className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md flex items-center gap-1 ">
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
  <label className="flex flex-col gap-2 w-full">
    <span className="text-xs text-slate-500 ">{label}</span>
    {children}
  </label>
)

export const Button = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  icon: Icon,
  loading = false,
  ...props
}) => {
  const variants = {
    default: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm',
    primary: 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-md shadow-emerald-100',
    secondary: 'bg-sky-500 text-white border-sky-600 hover:bg-sky-600 shadow-md shadow-sky-100',
    success: 'text-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-md shadow-emerald-100',
    danger: 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600 shadow-md shadow-rose-100',
    warning: 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-md shadow-amber-100',
    info: 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600 shadow-md shadow-blue-100',
    purple: 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700 shadow-md shadow-purple-100',
    rosey: 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600 shadow-md shadow-rose-100',
    light: 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 shadow-sm',
    dark: 'bg-slate-700 text-white border-slate-800 hover:bg-slate-800 shadow-md shadow-slate-200'
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs ',
    sm: 'px-3 py-1.5 text-xs',
    md: 'p-2 text-xs',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 
        rounded border    
        transition-all duration-200 active:scale-[0.98] 
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant] || variants.default} 
        ${sizes[size] || sizes.md} 
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-4 h-4'} />
      ) : null}
      {children}
    </button>
  );
};

export const Tabs = ({ tabs = [], activeTab, onTabChange, className = '' }) => {
  return (
    <div className={`border-b border-slate-100 flex items-center gap-8 px-4 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab || tab.id === activeTab || tab.label === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.value || tab.id || tab.label}
            onClick={() => onTabChange?.(tab.value || tab.id || tab.label)}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 transition-all duration-200 group
              ${isActive
                ? 'border-rose-500 text-rose-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'}
            `}
          >
            {Icon && (
              <Icon
                className={`w-4 h-4 transition-colors ${isActive ? 'text-rose-500' : 'text-slate-400 group-hover:text-slate-600'}`}
              />
            )}
            <span className={`text-sm  ${isActive ? '' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const normalized = (status || 'ACTIVE').trim().toUpperCase()

  const getStatusStyles = (s) => {
    switch (s) {
      case 'DRAFT':
      case 'CREATED':
        // Default style: White background, black text, border
        return 'bg-white border-slate-200 text-slate-700 shadow-sm'

      case 'APPROVED':
      case 'DESIGN_APPROVED':
      case 'BOM_APPROVED':
      case 'MASTER':
      case 'PO_CREATED':
      case 'ORDERED':
      case 'SENT':
        // Primary style: Indigo/Blue-ish
        return 'bg-rose-600 border-rose-700 text-white shadow-sm'

      case 'QC_CHECKED':
        return 'bg-emerald-500 border-emerald-600 text-white shadow-sm'

      case 'PROCESSING':
      case 'DESIGN_IN_REVIEW':
      case 'IN_DESIGN':
      case 'IN_PROGRESS':
      case 'RELEASED':
      case 'DISPATCHED':
        // Info style: Blue
        return 'text-blue-500 '

      case 'FULFILLED':
      case 'ACTIVE':
      case 'COMPLETED':
      case 'FULLY_CONSUMED':
      case 'PRODUCTION_COMPLETED':
      case 'DELIVERED':
      case 'RETURN_COMPLETED':
      case 'READY_FOR_SHIPMENT':
      case 'QC_APPROVED':
      case 'READY_TO_DISPATCH':
        // Success style: Green
        return 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm border'

      case 'DESIGN_QUERY':
      case 'INACTIVE':
      case 'REJECTED':
      case 'QC_REJECTED':
      case 'BLOCKED':
      case 'CANCELLED':
        // Danger style: Red
        return 'bg-rose-50 border-rose-100 text-rose-600 shadow-sm border'

      case 'RFQ_REQUESTED':
      case 'ON_HOLD':
      case 'PARTIALLY_CONSUMED':
      case 'PENDING':
      case 'OUT_FOR_DELIVERY':
      case 'RETURN_PICKUP_ASSIGNED':
      case 'REVISED':
      case 'IN_TRANSIT':
      case 'RETURN_IN_TRANSIT':
        // Warning style: Orange/Yellow
        return 'bg-amber-50 border-amber-100 text-amber-600 shadow-sm border'

      case 'RETURN_RECEIVED':
        // Secondary style: Sky/Cyan
        return 'text-sky-500 '

      default:
        // Dark style
        return 'text-slate-700 '
    }
  }

  const formatStatus = (s) => {
    if (s === 'QC_CHECKED') return 'QC CHECKED';
    return s.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
  }

  return (
    <span className={`p-1 rounded text-xs     flex-shrink-0 text-center min-w-fit inline-flex items-center justify-center transition-all duration-200 ${getStatusStyles(normalized)}`}>
      {formatStatus(normalized)}
    </span>
  )
}

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: ' text-slate-700 ',
    success: 'text-emerald-500  ',
    warning: 'text-amber-500 ',
    danger: 'text-rose-500  ',
    info: 'text-blue-500  ',
    indigo: 'text-rose-600  ',
    sky: 'text-sky-500  '
  };

  return (
    <span className={` text-xs  ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
};

export const Modal = ({ isOpen, onClose, title, children, className = '', size = '4xl', overlayClassName = 'z-50' }) => {
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
    <div className={`fixed inset-0 flex flex-col items-center justify-start bg-black/60 backdrop-blur-sm overflow-y-auto py-4 sm:py-8 ${overlayClassName}`} onClick={onClose}>
      <div className={`rounded  shadow-2xl ${maxWidth} w-full ${isFull ? 'min-h-full mx-0 rounded-none !my-0' : 'mx-4 h-fit max-h-[85vh] flex flex-col overflow-hidden'} border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 z-10 border-b p-2 flex items-center justify-between ${isDark ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-100 text-slate-900 '}`}>
          <h2 className="text-lg  ">{title}</h2>
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
      <div className="text-xs text-slate-500 ">
        Showing <span className="text-slate-900 ">{startItem}</span> to <span className="text-slate-900 ">{endItem}</span> of <span className="text-slate-900 ">{totalItems}</span> entries
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="default"
          size="xs"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First Page"
          icon={ChevronsLeft}
          className="!border-none !shadow-none hover:!bg-rose-50"
        />
        <Button
          variant="default"
          size="xs"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous Page"
          icon={ChevronLeft}
          className="!border-none !shadow-none hover:!bg-rose-50"
        />

        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers().map(page => (
            <Button
              key={page}
              variant={currentPage === page ? 'primary' : 'default'}
              size="xs"
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] !rounded-md ${currentPage === page ? '' : '!border-none !shadow-none hover:!bg-rose-50'}`}
            >
              {page}
            </Button>
          ))}
        </div>

        <Button
          variant="default"
          size="xs"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next Page"
          icon={ChevronRight}
          className="!border-none !shadow-none hover:!bg-rose-50"
        />
        <Button
          variant="default"
          size="xs"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last Page"
          icon={ChevronsRight}
          className="!border-none !shadow-none hover:!bg-rose-50"
        />
      </div>
    </div>
  );
};

export const DataTable = ({
  columns,
  data,
  loading,
  loadingMessage = "Loading...",
  emptyMessage = "No data found",
  searchPlaceholder = "Search...",
  actions,
  onRowClick,
  renderExpanded,
  className = '',
  hideHeader = false,
  hideExpander = false,
  pageSize: initialPageSize = 25,
  disableRowClickExpansion = false,
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  rowId: rowIdProp = 'id',
  expandedRows: expandedRowsProp,
  onExpandedChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(null);
  const [internalExpandedRows, setInternalExpandedRows] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const expandedRows = expandedRowsProp || internalExpandedRows;

  const toggleRow = (id) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }

    if (onExpandedChange) {
      onExpandedChange(newExpandedRows);
    } else {
      setInternalExpandedRows(newExpandedRows);
    }
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    let sortableData = Array.isArray(data) ? [...data] : [];
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
      // Only search in columns that are defined
      return columns.some(col => {
        const val = item[col.key];
        return String(val || '').toLowerCase().includes(searchLower);
      });
    });
  }, [sortedData, searchTerm, hideHeader, columns]);

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
        onSelectionChange(new Set(filteredData.map((row, idx) => row[rowIdProp] || row.id || idx)));
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
    <div className={`flex flex-col h-full ${className}`}>
      {!hideHeader && (
        <div className="flex flex-wrap my-3 gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white text-slate-900"
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-sm text-slate-500">entries</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group min-w-[200px] md:min-w-[250px]">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all placeholder:text-slate-400 bg-white text-slate-900 shadow-sm"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
            </div>
            {actions}
          </div>
        </div>
      )}

      <div className="overflow-x-auto custom-scrollbar bg-white relative max-h-[90vh]">
        <table className="w-full text-left bg-white text-sm border-collapse">
          <thead className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <tr>
              {selectable && (
                <th className="p-4 border-b border-slate-200 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    onChange={handleSelectAll}
                    checked={filteredData.length > 0 && filteredData.every((row, idx) => selectedRows.has(row[rowIdProp] || row.id || idx))}
                  />
                </th>
              )}
              {renderExpanded && !hideExpander && <th className="p-4 border-b border-slate-200 w-10"></th>}
              {columns.map((col, idx) => {
                const justifyClass = col.className?.includes('text-right') || col.className?.includes('text-end')
                  ? 'justify-end'
                  : col.className?.includes('text-center')
                    ? 'justify-center'
                    : 'justify-start';

                return (
                  <th
                    key={idx}
                    className={`p-2 border-b border-slate-200 bg-slate-50 text-slate-600 text-xs    ${col.sortable ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''} ${col.className || ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    <div className={`flex items-center gap-2 ${justifyClass}`}>
                      {col.label}
                      {col.sortable && (
                        <span className="text-slate-300 group-hover:text-slate-500">
                          {sortConfig?.key === col.key ? (sortConfig.direction === 'ascending' ? <ChevronUp className="w-3 h-3 text-rose-500" /> : <ChevronDown className="w-3 h-3 text-rose-500" />) : <ChevronsUpDown className="w-3 h-3" />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y bg-white divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (renderExpanded && !hideExpander ? 1 : 0) + (selectable ? 1 : 0)} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
                    <span className="text-slate-500 text-sm  animate-pulse">{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderExpanded && !hideExpander ? 1 : 0) + (selectable ? 1 : 0)} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-slate-50 rounded">
                      <FileText className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 ">{emptyMessage}</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const rowId = row[rowIdProp] || row.id || (currentPage - 1) * pageSize + rowIdx;
                const isExpanded = expandedRows.has(rowId);
                const isSelected = selectedRows.has(rowId);

                return (
                  <React.Fragment key={rowId}>
                    <tr
                      className={`group transition-all duration-150 ${onRowClick ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50/50'} ${isExpanded || isSelected ? 'bg-rose-50/30' : ''}`}
                      onClick={(e) => {
                        if (renderExpanded && !disableRowClickExpansion) toggleRow(rowId);
                        if (onRowClick) onRowClick(row, e);
                      }}
                    >
                      {selectable && (
                        <td className="p-2 w-10">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
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
                        <td
                          className="p-4 text-slate-400 cursor-pointer hover:text-rose-500 transition-colors"
                          data-expander="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(rowId);
                          }}
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-rose-500' : ''}`} />
                        </td>
                      )}
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} style={{ width: col.width, minWidth: col.width }} className={`p-2 whitespace-nowrap text-xs text-slate-600 group-hover:text-slate-900 transition-colors align-middle ${col.className || ''}`}>
                          {col.render ? col.render(row[col.key], row, (currentPage - 1) * pageSize + rowIdx) : (row[col.key] || '—')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr>
                        <td colSpan={columns.length + (hideExpander ? 0 : 1) + (selectable ? 1 : 0)} className="p-2 bg-slate-50/30 border-y border-slate-100 shadow-inner">
                          <div className="animate-in slide-in-from-top-2 duration-300 overflow-hidden">
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
        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-700">{Math.min(filteredData.length, (currentPage - 1) * pageSize + 1)}</span> to <span className="font-semibold text-slate-700">{Math.min(filteredData.length, currentPage * pageSize)}</span> of <span className="font-semibold text-slate-700">{filteredData.length}</span> entries
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredData.length}
            pageSize={pageSize}
          />
        </div>
      )}
    </div>
  );
};

