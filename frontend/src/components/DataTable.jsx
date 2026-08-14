import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Bookmark, LayoutGrid, List, X, Download, Trash2, MoreHorizontal, Edit2, ArrowUpDown, Check , Plus, Minus } from 'lucide-react';

const CustomDataTable = ({ 
  columns = [], 
  data = [], 
  loading = false,
  searchPlaceholder = "Search...", 
  initialPageSize = 25,
  pageSize: pageSizeProp,
  onRowClick,
  emptyMessage = "No entries found",
  showSearch = true,
  hideSearch = false,
  hideHeader = false,
  showPagination = true,
  customFilter,
  onSearchChange,
  isRowSelectable = null,
  rowClassName,
  // New Props for Advanced Features
  tabs = [],
  activeTab = '',
  onTabChange,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  bulkActions = [],
  advancedFilters = null, // React Node for the panel content
  activeFilters = [], // Array of { id, label, value }
  onFilterRemove,
  onClearFilters,
  onApplyFilters, // function to trigger apply
  onSortChange, // function(key, dir)
  subRowsKey = null,
  expandable = false,
  rowIdKey,
  rowId: rowIdAlias,
  expandedRows: expandedRowsProp,
  onExpandedChange,
  renderExpanded,
}) => {
  const effectiveRowIdKey = rowIdKey || rowIdAlias || 'id';
  const shouldShowSearchToolbar = showSearch && !hideSearch && !hideHeader;

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeProp || initialPageSize);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const [internalExpandedRows, setInternalExpandedRows] = useState(new Set());

  const activeExpandedRows = expandedRowsProp || internalExpandedRows;

  const isRowExpanded = (id) => {
    if (activeExpandedRows instanceof Set) {
      return activeExpandedRows.has(id);
    } else if (Array.isArray(activeExpandedRows)) {
      return activeExpandedRows.includes(id);
    }
    return false;
  };

  const toggleRowExpansion = (e, rowId) => {
    e.stopPropagation();
    let next;
    if (activeExpandedRows instanceof Set) {
      next = new Set(activeExpandedRows);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
    } else if (Array.isArray(activeExpandedRows)) {
      if (activeExpandedRows.includes(rowId)) {
        next = activeExpandedRows.filter(i => i !== rowId);
      } else {
        next = [...activeExpandedRows, rowId];
      }
    } else {
      next = new Set();
      next.add(rowId);
    }

    if (onExpandedChange) {
      onExpandedChange(next);
    } else {
      setInternalExpandedRows(next instanceof Set ? next : new Set(next));
    }
  };

  // Helper for row selection check
  const isRowSelected = (rowId) => {
    if (selectedRows instanceof Set) {
      return selectedRows.has(rowId);
    } else if (Array.isArray(selectedRows)) {
      return selectedRows.includes(rowId);
    }
    return false;
  };

  // Handle Select All
  const handleSelectAll = (e) => {
    const selectableData = isRowSelectable ? paginatedData.filter(isRowSelectable) : paginatedData;
    const allIds = selectableData.map(r => r[effectiveRowIdKey] !== undefined ? r[effectiveRowIdKey] : (r.id || r._id || r));
    if (selectedRows instanceof Set) {
      if (e.target.checked) {
        onSelectionChange && onSelectionChange(new Set(allIds));
      } else {
        onSelectionChange && onSelectionChange(new Set());
      }
    } else {
      if (e.target.checked) {
        onSelectionChange && onSelectionChange(allIds);
      } else {
        onSelectionChange && onSelectionChange([]);
      }
    }
  };

  const handleRowSelect = (e, row) => {
    e.stopPropagation();
    const rowId = row[effectiveRowIdKey] !== undefined ? row[effectiveRowIdKey] : (row.id || row._id || row);
    if (selectedRows instanceof Set) {
      const next = new Set(selectedRows);
      if (e.target.checked) next.add(rowId);
      else next.delete(rowId);
      onSelectionChange && onSelectionChange(next);
    } else {
      if (e.target.checked) {
        onSelectionChange && onSelectionChange([...selectedRows, rowId]);
      } else {
        onSelectionChange && onSelectionChange(selectedRows.filter(id => id !== rowId));
      }
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    if (onSortChange) onSortChange(key, direction);
  };

  // Filter and Sort Data internally if onSortChange is not provided
  const processedData = useMemo(() => {
    let result = [...(data || [])];
    
    // Search
    if (searchTerm) {
      if (customFilter) {
        result = result.filter(row => customFilter(row, searchTerm.toLowerCase()));
      } else {
        result = result.filter(row => {
          return columns.some(col => {
            const value = row[col.key];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchTerm.toLowerCase());
          });
        });
      }
    }

    // Sort
    if (!onSortChange && sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, columns, customFilter, sortConfig, onSortChange]);

  // Pagination logic
  const totalPages = Math.ceil(processedData.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = useMemo(() => {
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, startIndex, pageSize]);

  // Ensure current page is valid when data changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setCurrentPage(1);
    if (onSearchChange) onSearchChange(val);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const selectableRowsOnPage = isRowSelectable ? paginatedData.filter(isRowSelectable) : paginatedData;
  const currentPageIds = selectableRowsOnPage.map(r => r[effectiveRowIdKey] !== undefined ? r[effectiveRowIdKey] : (r.id || r._id || r));
  const selectedCount = currentPageIds.filter(id => isRowSelected(id)).length;

  const isAllSelected = currentPageIds.length > 0 && selectedCount === currentPageIds.length;
  const isSomeSelected = selectedCount > 0 && selectedCount < currentPageIds.length;

  const isExpandable = expandable || !!renderExpanded;

  return (
    <div className="flex flex-col w-full bg-white border border-slate-100 rounded-xl shadow-sm relative overflow-hidden text-slate-800">
      
      {/* 1. Global Toolbar */}
      {shouldShowSearchToolbar && (
        <div className="flex flex-col md:flex-row justify-between items-center p-3 gap-4 border-b border-slate-100 bg-white">
          <div className="relative w-full md:w-[400px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={handleSearch}
              className="block w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
               <kbd className="hidden sm:inline-block border border-slate-200 rounded px-1.5 text-[10px] font-bold text-slate-400 bg-white shadow-sm">/</kbd>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
             {advancedFilters && (
                <button 
                  onClick={() => setShowFilterPanel(true)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${activeFilters.length > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilters.length > 0 && (
                     <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] ml-1">{activeFilters.length}</span>
                  )}
                </button>
             )}

             <button className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                <Bookmark className="w-4 h-4" />
                Saved Views
             </button>

             <div className="hidden md:flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50 ml-2">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                   <List className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                   <LayoutGrid className="w-4 h-4" />
                </button>
             </div>
          </div>
        </div>
      )}

      {/* 2. Tabs Row */}
      {tabs.length > 0 && (
         <div className="flex border-b border-slate-100 px-2 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
               <button
                  key={tab.id}
                  onClick={() => onTabChange && onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
               >
                  {tab.label}
                  {tab.count !== undefined && (
                     <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {tab.count}
                     </span>
                  )}
               </button>
            ))}
         </div>
      )}

      {/* 3. Active Filters Row */}
      {activeFilters.length > 0 && (
         <div className="flex items-center gap-2 p-3 bg-slate-50/50 border-b border-slate-100 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-2">Active Filters:</span>
            {activeFilters.map((filter, idx) => (
               <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                  <span className="font-semibold">{filter.label}:</span> {filter.value}
                  <button onClick={() => onFilterRemove && onFilterRemove(filter.id)} className="ml-1 hover:text-indigo-900 transition-colors p-0.5 rounded-full hover:bg-indigo-200">
                     <X className="w-3 h-3" />
                  </button>
               </div>
            ))}
            <button onClick={onClearFilters} className="flex items-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-rose-600 text-xs font-semibold ml-auto transition-colors">
               <Trash2 className="w-3.5 h-3.5" />
               Clear All
            </button>
         </div>
      )}

      {/* 4. Bulk Actions Bar */}
      {selectable && ((selectedRows instanceof Set ? selectedRows.size : selectedRows.length) > 0) && (
         <div className="flex items-center gap-3 p-2 bg-indigo-50/50 border-b border-indigo-100 px-4 slide-down animate-in duration-200">
            <label className="flex items-center gap-2 cursor-pointer">
               <input type="checkbox" checked={true} onChange={() => onSelectionChange(selectedRows instanceof Set ? new Set() : [])} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white" />
               <span className="text-sm font-semibold text-indigo-900">{(selectedRows instanceof Set ? selectedRows.size : selectedRows.length)} items selected</span>
            </label>
            <div className="h-4 w-px bg-indigo-200 mx-2" />
            
            {bulkActions.length > 0 ? (
               bulkActions.map((action, idx) => (
                  <button key={idx} onClick={() => action.onClick(selectedRows)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${action.className || 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'}`}>
                     {action.icon && <action.icon className="w-4 h-4" />}
                     {action.label}
                  </button>
               ))
            ) : (
               <>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm">
                     <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-rose-600 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 shadow-sm">
                     <Trash2 className="w-4 h-4" /> Delete
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm ml-auto">
                     <Download className="w-4 h-4" /> Export
                  </button>
               </>
            )}
         </div>
      )}

      {/* 5. Table Container */}
      <div className="overflow-x-auto relative min-h-[300px]">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-slate-50/80 backdrop-blur-md border-b-2 border-slate-200 sticky top-0 z-10">
            <tr>
              {isExpandable && (
                 <th className="px-2 py-3 w-8"></th>
              )}
              {selectable && (
                 <th className="px-4 py-3 w-10">
                    <input 
                       type="checkbox" 
                       checked={isAllSelected} 
                       ref={input => { if (input) input.indeterminate = isSomeSelected; }}
                       onChange={handleSelectAll}
                       className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                    />
                 </th>
              )}
              {columns.map((col, idx) => (
                <th 
                  key={idx}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:bg-slate-100 transition-colors select-none' : ''} ${(col.key === 'actions' || col.key === 'action' || (typeof col.label === 'string' && col.label.toLowerCase() === 'actions') || (typeof col.label === 'string' && col.label.toLowerCase() === 'action')) ? 'sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]' : ''} ${col.className || ''}`}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1.5">
                     {col.header || col.label}
                     {col.sortable !== false && (
                        <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig.key === col.key ? 'text-indigo-600' : 'text-slate-300'}`} />
                     )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, rowIdx) => (
                <tr key={`skeleton-${rowIdx}`} className="animate-pulse">
                  {isExpandable && <td className="px-2 py-3"><div className="w-4 h-4 bg-slate-100 rounded"></div></td>}
                  {selectable && <td className="px-4 py-3"><div className="w-4 h-4 bg-slate-100 rounded"></div></td>}
                  {columns.map((col, colIdx) => (
                    <td key={`skeleton-col-${colIdx}`} className="px-4 py-3.5">
                      <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => {
                 const renderRow = (currentRow, currentRowIdx, depth = 0) => {
                    const rowId = currentRow[effectiveRowIdKey] !== undefined ? currentRow[effectiveRowIdKey] : (currentRow.id || currentRow._id || currentRowIdx);
                    const selected = isRowSelected(rowId);
                    const hasSubRows = subRowsKey && Array.isArray(currentRow[subRowsKey]) && currentRow[subRowsKey].length > 0;
                    const expanded = isRowExpanded(rowId);
                    const customRowClass = typeof rowClassName === 'function' ? rowClassName(currentRow) : (rowClassName || '');
                    const isSelectableRow = !isRowSelectable || isRowSelectable(currentRow);

                    return (
                      <React.Fragment key={depth + '-' + rowId}>
                        <tr 
                          onClick={() => onRowClick && onRowClick(currentRow)}
                          className={`group transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${selected ? 'bg-indigo-50/30' : 'hover:bg-slate-50 bg-white'} ${customRowClass}`}
                        >
                          {isExpandable && (
                            <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                              {(hasSubRows || renderExpanded) && (
                                <button
                                  onClick={(e) => toggleRowExpansion(e, rowId)}
                                  className="p-0.5 rounded-sm border border-slate-300 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors bg-white shadow-sm"
                                >
                                  {expanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                </button>
                              )}
                            </td>
                          )}
                          {selectable && (
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              {isSelectableRow ? (
                               <input 
                                  type="checkbox" 
                                  checked={selected}
                                  onChange={(e) => handleRowSelect(e, currentRow)}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                               />
              ) : (
                                <div className="w-4 h-4" />
                              )}
                            </td>
                          )}
                          {columns.map((col, colIdx) => (
                            <td key={colIdx} className={`px-4 py-3.5 text-sm text-slate-700 font-medium ${(col.key === 'actions' || col.key === 'action' || (typeof col.label === 'string' && col.label.toLowerCase() === 'actions') || (typeof col.label === 'string' && col.label.toLowerCase() === 'action')) ? `sticky right-0 z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] ${selected ? 'bg-[#f5f3ff] group-hover:bg-[#ebe9fe]' : 'bg-white group-hover:bg-slate-50'}` : ''} ${col.cellClassName || ''}`}>
                              <div className="flex items-center" style={{ paddingLeft: colIdx === 0 && depth > 0 ? `${depth * 24}px` : '0' }}>
                                {colIdx === 0 && depth > 0 && <div className="w-3 h-px bg-slate-300 mr-2"></div>}
                                {col.render ? col.render(currentRow[col.key], currentRow, startIndex + rowIdx) : currentRow[col.key] || '—'}
                              </div>
                            </td>
                          ))}
                        </tr>
                        {expanded && renderExpanded && (
                          <tr key={`expanded-${rowId}`}>
                            <td colSpan={columns.length + (selectable ? 1 : 0) + (isExpandable ? 1 : 0)} className="p-2 bg-slate-50/50 border-b border-slate-200">
                              {renderExpanded(currentRow)}
                            </td>
                          </tr>
                        )}
                        {expanded && hasSubRows && currentRow[subRowsKey].map((subRow, subIdx) => 
                          renderRow(subRow, `${currentRowIdx}-${subIdx}`, depth + 1)
                        )}
                      </React.Fragment>
                    );
                 };

                 return renderRow(row, rowIdx);
              })
            ) : (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (isExpandable ? 1 : 0)} className="px-6 py-16 text-center">
                   <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 text-slate-200 mb-3" />
                      <p className="text-sm text-slate-500 font-semibold">{emptyMessage}</p>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Footer / Pagination */}
      {showPagination && (
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-t border-slate-200 bg-white gap-4">
          <div className="text-sm font-medium text-slate-500">
            Showing {processedData.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + pageSize, processedData.length)} of {processedData.length} entries
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">Rows per page</span>
                <select 
                   value={pageSize} 
                   onChange={handlePageSizeChange}
                   className="border border-slate-200 rounded-md py-1 px-2 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                   {[10, 25, 50, 100].map(size => (
                   <option key={size} value={size}>{size}</option>
                   ))}
                </select>
             </div>

             {totalPages > 1 && (
               <div className="flex items-center gap-1">
                 <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors">
                   <ChevronsLeft className="h-4 w-4" />
                 </button>
                 <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors">
                   <ChevronLeft className="h-4 w-4" />
                 </button>
                 
                 <div className="flex items-center mx-1">
                   {[...Array(Math.min(5, totalPages))].map((_, i) => {
                     let pageNum;
                     if (totalPages <= 5) {
                       pageNum = i + 1;
                     } else if (currentPage <= 3) {
                       pageNum = i + 1;
                     } else if (currentPage >= totalPages - 2) {
                       pageNum = totalPages - 4 + i;
                     } else {
                       pageNum = currentPage - 2 + i;
                     }
                     
                     return (
                       <button
                         key={pageNum}
                         onClick={() => handlePageChange(pageNum)}
                         className={`w-8 h-8 text-sm font-semibold rounded-md mx-0.5 transition-colors ${
                           currentPage === pageNum 
                             ? 'bg-indigo-600 text-white shadow-sm' 
                             : 'text-slate-600 hover:bg-slate-100'
                         }`}
                       >
                         {pageNum}
                       </button>
                     );
                   })}
                 </div>

                 <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors">
                   <ChevronRight className="h-4 w-4" />
                 </button>
                 <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors">
                   <ChevronsRight className="h-4 w-4" />
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* 7. Advanced Filters Slide-out Panel */}
      {showFilterPanel && (
         <>
            <div className="fixed inset-0 bg-slate-900/20 z-40 backdrop-blur-sm" onClick={() => setShowFilterPanel(false)} />
            <div className="fixed inset-y-0 right-0 w-[350px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
               <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                     <Filter className="w-4 h-4 text-indigo-600" /> Advanced Filters
                  </h3>
                  <div className="flex items-center gap-2">
                     <button onClick={onClearFilters} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">Reset</button>
                     <button onClick={() => setShowFilterPanel(false)} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 transition-colors">
                        <X className="w-4 h-4" />
                     </button>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {advancedFilters}
               </div>
               <div className="p-4 border-t border-slate-100 flex items-center gap-3 bg-white">
                  <button onClick={() => setShowFilterPanel(false)} className="flex-1 py-2 px-4 rounded-lg font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                     Cancel
                  </button>
                  <button onClick={() => { onApplyFilters && onApplyFilters(); setShowFilterPanel(false); }} className="flex-1 py-2 px-4 rounded-lg font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors">
                     Apply Filters
                  </button>
               </div>
            </div>
         </>
      )}
    </div>
  );
};

export default CustomDataTable;
