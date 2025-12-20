import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export default function SearchableSelect({ 
  label, 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select...',
  isLoading = false,
  error = '',
  required = false,
  onSearch = null,
  allowCustom = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)

  const filteredOptions = React.useMemo(() => {
    if (onSearch) return options

    if (!searchTerm) return options

    const lower = searchTerm.toLowerCase()
    const filtered = options.filter(opt => 
      opt.label.toLowerCase().includes(lower)
    )
    
    if (allowCustom && searchTerm.trim() && !options.some(opt => opt.label.toLowerCase() === lower)) {
      filtered.push({ 
        label: `Add "${searchTerm}"`, 
        value: searchTerm, 
        isCustom: true 
      })
    }
    
    return filtered
  }, [options, searchTerm, onSearch, allowCustom])

  useEffect(() => {
    if (onSearch) {
      onSearch(searchTerm)
    }
  }, [searchTerm, onSearch])

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions])

  useEffect(() => {
    if (isOpen && !searchTerm && onSearch && options.length === 0) {
      onSearch('')
    }
  }, [isOpen, searchTerm, onSearch, options.length])

  useEffect(() => {
    if (value) {
      const selectedOption = options.find(opt => opt.value === value)
      if (selectedOption && selectedOption.label !== searchTerm) {
        setSearchTerm(selectedOption.label)
      }
    } else if (!isOpen) {
      setSearchTerm('')
    }
  }, [value, options, isOpen])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        // Reset search term to selected value on close if valid
        if (value) {
          const selectedOption = options.find(opt => opt.value === value)
          if (selectedOption) setSearchTerm(selectedOption.label)
        } else {
          setSearchTerm('')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value, options])

  const handleSelect = (option) => {
    onChange(option.value)
    setSearchTerm(option.isCustom ? option.value : option.label)
    setIsOpen(false)
  }

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    if (!onSearch) {
      // Don't trigger onChange here, only on selection
    }
    setIsOpen(true)
  }

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        if (value) {
          const selectedOption = options.find(opt => opt.value === value)
          if (selectedOption) setSearchTerm(selectedOption.label)
        } else {
          setSearchTerm('')
        }
        break
      default:
        break
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div 
        className={`
          flex items-center w-full border rounded-md bg-white transition-all duration-200
          ${isOpen ? 'ring-2 ring-blue-100 border-blue-400' : 'border-gray-300 hover:border-gray-400'}
          ${error ? 'border-red-500' : ''}
        `}
      >
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true)
            if (onSearch && !searchTerm) onSearch('')
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full p-2 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 rounded-md"
          disabled={isLoading}
        />
        <ChevronDown 
          size={18} 
          className={`mr-2 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-2 text-sm text-gray-500 text-center">Loading...</div>
          )}
          
          {!isLoading && filteredOptions.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500 text-center">No options found</div>
          )}

          {!isLoading && filteredOptions.map((option, index) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option)}
              className={`
                px-4 py-2 text-sm cursor-pointer transition-colors border-b border-gray-50 last:border-0
                ${highlightedIndex === index ? 'bg-gray-50' : ''}
                ${option.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
              `}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
