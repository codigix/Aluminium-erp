import React, { useState, useEffect, useRef } from 'react';

export const Card = ({ id, title, subtitle, action, children }) => (
  <div id={id} >
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

export const SearchableSelect = ({ options, value, onChange, placeholder, labelField = 'label', valueField = 'value', subLabelField, allowCustom = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt[valueField] === value);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption[labelField] : (value || ''));
    }
  }, [value, selectedOption, isOpen]);

  const filteredOptions = options.filter(opt => 
    opt[labelField]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt[valueField]?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
    (subLabelField && opt[subLabelField]?.toLowerCase().includes(searchTerm.toLowerCase()))
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
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (allowCustom) {
              onChange({ target: { value: e.target.value } });
            }
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
          {isOpen ? '▲' : '▼'}
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 ${opt[valueField] === value ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}`}
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
        return 'bg-rose-50 border-rose-200 text-rose-600'
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
