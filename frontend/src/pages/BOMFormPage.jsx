import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const SearchableSelect = ({ options, value, onChange, placeholder, labelField = 'label', valueField = 'value', subLabelField, allowCustom = true, disabled = false }) => {
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

  const filteredOptions = options.filter(opt => {
    const search = String(searchTerm || '').toLowerCase();
    return (
      String(opt[labelField] || '').toLowerCase().includes(search) ||
      String(opt[valueField] || '').toLowerCase().includes(search) ||
      (subLabelField && String(opt[subLabelField] || '').toLowerCase().includes(search))
    );
  });

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
          disabled={disabled}
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900'}`}
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
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
          {!disabled && (isOpen ? '▲' : '▼')}
        </div>
      </div>

      {isOpen && (
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

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

const RecursiveBOMRow = ({ item, level = 0, onRemove, isReadOnly, allItems, type: providedType, inheritedLoss = 0 }) => {
  // Determine if this item is a material or component if type not provided or to be sure
  const actualType = providedType || (item.material_name ? 'material' : 'component');

  const children = allItems.filter(child => String(child.parent_id || child.parentId) === String(item.id));

  const qty = parseFloat(actualType === 'material' ? item.qty_per_pc : (item.quantity || item.qty || 0));
  const rate = parseFloat(item.rate || 0);
  const baseCost = qty * rate;
  const itemLossPercent = actualType === 'component' ? parseFloat(item.loss_percent || item.lossPercent || 0) : 0;

  // Cumulative loss factor calculation
  // Effective factor = (1 - L_parent/100) * (1 - L_this/100)
  // But wait, the formula for cost increase is 1 / (1 - L/100).
  // Cumulative increase = 1 / [(1 - L1/100) * (1 - L2/100) * ...]
  const currentLevelLossFactor = 1 - (inheritedLoss / 100);
  const itemLossFactor = 1 - (itemLossPercent / 100);
  const cumulativeLossFactor = currentLevelLossFactor * itemLossFactor;

  // This item's cost increased by its parent's loss (if any) AND its own loss
  const netCost = baseCost / cumulativeLossFactor;

  return (
    <>
      <tr className={`${level > 0 ? 'bg-slate-50/50' : 'bg-white'} border-b border-slate-100 hover:bg-blue-50/30 transition-colors`}>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
            {level > 0 && <span className="text-slate-300 text-xs">┕</span>}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-800">
                {actualType === 'material' ? item.material_name : (item.component_code || item.componentCode)}
              </span>
              {item.description && (
                <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{cleanText(item.description)}</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2 text-center">
          <span className="text-xs text-slate-600">
            {(qty / cumulativeLossFactor).toFixed(actualType === 'material' ? 4 : 2)} {item.uom}
          </span>
        </td>
        <td className="px-4 py-2 text-left text-xs text-slate-600">₹{rate.toFixed(2)}</td>
        <td className="px-4 py-2 text-left text-xs text-slate-600">
          {actualType === 'component' ? `${itemLossPercent.toFixed(2)}%` : (item.operation || '—')}
        </td>
        <td className="px-4 py-2 text-left text-xs  text-slate-900">
          ₹{netCost.toFixed(2)}
        </td>
        {!isReadOnly && (
          <td className="px-4 py-2 text-right">
            <button
              onClick={() => onRemove(actualType === 'material' ? 'materials' : 'components', item.id, item.isLocal)}
              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        )}
      </tr>
      {children.map(child => (
        <RecursiveBOMRow
          key={`${child.material_name ? 'mat' : 'comp'}-${child.id}`}
          item={child}
          level={level + 1}
          onRemove={onRemove}
          isReadOnly={isReadOnly}
          allItems={allItems}
          inheritedLoss={100 * (1 - cumulativeLossFactor)}
        />
      ))}
    </>
  );
};

const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';

const BOMFormPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [workstations, setWorkstations] = useState([]);
  const [operationsList, setOperationsList] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [approvedBOMs, setApprovedBOMs] = useState([]);
  const [bomData, setBomData] = useState({
    materials: [],
    components: [],
    operations: [],
    scrap: []
  });
  const [activeTab, setActiveTab] = useState('general');
  const [collapsedSections, setCollapsedSections] = useState({
    productInfo: false,
    components: false,
    materials: false,
    operations: false,
    scrap: false,
    costing: false
  });
  const [showAllDrawings, setShowAllDrawings] = useState(false);
  const [drawingFilter, setDrawingFilter] = useState('');
  const [fetchedDrawingName, setFetchedDrawingName] = useState('');

  // Form States
  const [productForm, setProductForm] = useState({
    itemGroup: '',
    itemCode: '',
    drawingNo: '',
    drawing_id: '',
    uom: 'Kg',
    revision: '1',
    description: '',
    isActive: true,
    isDefault: false,
    quantity: 1
  });

  const [materialForm, setMaterialForm] = useState({ materialName: '', qty: '', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '' });
  const [componentForm, setComponentForm] = useState({ componentCode: '', quantity: '', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '' });
  const [operationForm, setOperationForm] = useState({ operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
  const [scrapForm, setScrapForm] = useState({ itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '', parentId: '' });
  const [approvedDrawings, setApprovedDrawings] = useState([]);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const handlePreviewByNo = async (drawingNo) => {
    if (!drawingNo || drawingNo === 'N/A') {
      errorToast('Please select a valid drawing number first');
      return;
    }
    
    // Check if we already have it in approvedDrawings
    let dwg = approvedDrawings.find(d => d.drawing_no === drawingNo);
    if (!dwg) {
        // Fetch from backend
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/drawings?search=${encodeURIComponent(drawingNo)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const drawings = await response.json();
                dwg = drawings.find(d => d.drawing_no === drawingNo);
            }
        } catch (error) {
            console.error(error);
        }
    }
    
    if (dwg) {
        setPreviewDrawing(dwg);
        setShowPreviewModal(true);
    } else {
        errorToast('Drawing file not found in system');
    }
  };

  const drawingOptions = useMemo(() => {
    const drawingMap = new Map();

    // Process approved drawings
    approvedDrawings.forEach(i => {
      if (i.drawing_no && i.drawing_no !== 'N/A') {
        if (!drawingMap.has(i.drawing_no)) {
          drawingMap.set(i.drawing_no, i.material_name || i.description || i.item_description);
        }
      }
    });

    // Process stock items
    stockItems.forEach(i => {
      if (i.drawing_no && i.drawing_no !== 'N/A') {
        if (!drawingMap.has(i.drawing_no)) {
          drawingMap.set(i.drawing_no, i.material_name || i.description || i.item_description);
        }
      }
    });

    return Array.from(drawingMap.entries())
      .map(([no, name]) => ({ label: cleanText(name), value: no, subLabel: no }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [approvedDrawings, stockItems]);

  const componentOptions = useMemo(() => {
    const options = [];
    const seenCodes = new Set();
    const currentItemCode = selectedItem?.item_code || productForm.itemCode;
    const productDrawing = selectedItem?.drawing_no || productForm.drawingNo;

    // Helper to check if item is a component type
    const isComponentType = (type) => {
      const t = (type || '').toLowerCase();
      return t.includes('semi') || t.includes('assembly') || t.includes('finished') || t.includes('sfg') || t.includes('fg');
    };

    // 1. Add Stock Items
    stockItems.forEach(item => {
      if (!isComponentType(item.material_type)) return;

      if (!showAllDrawings) {
        if (productDrawing && item.drawing_no && item.drawing_no !== 'N/A' && item.drawing_no !== productDrawing) return;
      }

      if (item.item_code === currentItemCode) return; // Skip self

      if (!seenCodes.has(item.item_code)) {
        // Find if this item has an approved BOM cost
        const bomInfo = approvedBOMs.find(b => b.item_code === item.item_code);
        const bomCost = bomInfo ? parseFloat(bomInfo.bom_cost) : 0;

        const isSA = (item.item_code || '').startsWith('SA-');
        options.push({
          label: isSA ? `${item.material_name}${bomCost > 0 ? ` | ₹${Math.round(bomCost)}` : ''}` : `${item.item_code} - ${item.material_name}`,
          value: item.item_code,
          subLabel: item.drawing_no && item.drawing_no !== 'N/A' ? `Drawing: ${item.drawing_no}${bomCost > 0 ? ` [BOM Cost: ₹${bomCost.toFixed(2)}]` : ''}` : `Stock Item${bomCost > 0 ? ` [BOM Cost: ₹${bomCost.toFixed(2)}]` : ''}`,
          rate: bomCost > 0 ? bomCost : (item.selling_rate > 0 ? item.selling_rate : (item.valuation_rate || 0)),
          uom: item.unit || 'Kg',
          description: item.material_name
        });
        seenCodes.add(item.item_code);
      }
    });

    // 2. Add Approved Drawings (Sales Order Items)
    approvedDrawings.forEach(item => {
      // For sales order items, we trust they are components if they are in approvedDrawings
      // and match the drawing center philosophy
      if (item.item_code === currentItemCode) return; // Skip self

      if (!showAllDrawings) {
        if (productDrawing && item.drawing_no && item.drawing_no !== 'N/A' && item.drawing_no !== productDrawing) return;
      }

      if (!seenCodes.has(item.item_code)) {
        // Also check approvedBOMs for these as well, although item.bom_cost might already be there
        const bomInfo = approvedBOMs.find(b => b.item_code === item.item_code || (b.drawing_no === item.drawing_no && b.drawing_no !== 'N/A'));
        const bomCost = (item.bom_cost && parseFloat(item.bom_cost) > 0) ? parseFloat(item.bom_cost) : (bomInfo ? parseFloat(bomInfo.bom_cost) : 0);

        const isSA = (item.item_code || '').startsWith('SA-');
        options.push({
          label: isSA ? `${item.description || item.material_name}${bomCost > 0 ? ` | ₹${Math.round(bomCost)}` : ''}` : `${item.item_code} - ${item.description || item.material_name}`,
          value: item.item_code,
          subLabel: `Drawing: ${item.drawing_no} (Order Item)${bomCost > 0 ? ` [BOM Cost: ₹${bomCost.toFixed(2)}]` : ''}`,
          rate: bomCost > 0 ? bomCost : (item.rate || 0),
          uom: item.unit || 'Kg',
          description: item.description || item.material_name
        });
        seenCodes.add(item.item_code);
      }
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [stockItems, approvedDrawings, approvedBOMs, showAllDrawings, selectedItem, productForm.itemCode, productForm.drawingNo]);

  const location = useLocation();

  const isReadOnly = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('view') === 'true';
  }, [location.search]);

  const itemId = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    return (lastSegment && lastSegment !== 'bom-form') ? lastSegment : null;
  }, [location.pathname]);

  const fetchDrawingName = useCallback(async (drawingNo) => {
    if (!drawingNo) {
      setFetchedDrawingName('');
      return '';
    }
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings?search=${encodeURIComponent(drawingNo)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const drawings = await response.json();
        const exactMatch = drawings.find(d => d.drawing_no === drawingNo);
        if (exactMatch) {
          const name = exactMatch.description || '';
          setFetchedDrawingName(name);
          return name;
        }
      }
      setFetchedDrawingName('');
      return '';
    } catch (err) {
      console.error('Error fetching drawing name:', err);
      setFetchedDrawingName('');
      return '';
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dwgParam = params.get('drawing_no');
    const dwgIdParam = params.get('drawing_id') === 'N/A' ? '' : params.get('drawing_id');
    const dwgNameParam = params.get('drawing_name');
    const itemCodeParam = params.get('itemCode');
    const itemIdParam = params.get('item_id');

    const handleInitialParams = async () => {
      // Handle itemCode or drawing_no or item_id from URL
      if (!selectedItem && (stockItems.length > 0 || approvedDrawings.length > 0 || itemIdParam)) {
        if (itemIdParam) {
          try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/sales-orders/items/${itemIdParam}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const item = await response.json();
              if (item) {
                setSelectedItem({ ...item, source: 'order' });
                setProductForm(prev => ({
                  ...prev,
                  itemCode: item.item_code || '',
                  description: item.drawing_name || item.description || item.item_description || '',
                  drawingNo: item.drawing_no || dwgParam || prev.drawingNo,
                  drawing_id: item.drawing_id || dwgIdParam || prev.drawing_id
                }));
                return; // Exit early if we found the item by ID
              }
            }
          } catch (err) {
            console.error('Error fetching item by ID:', err);
          }
        }
        
        if (itemCodeParam) {
          const orderItem = approvedDrawings.find(i => i.item_code === itemCodeParam);
          const stockItem = stockItems.find(i => i.item_code === itemCodeParam);
          const item = orderItem || stockItem;
          if (item) {
            setSelectedItem({ ...item, source: orderItem ? 'order' : 'stock' });
          }
        } else if (dwgParam && !itemId && !selectedItem) {
          // For NEW BOM creation from a drawing, just pre-fill the drawing info
          // and leave product info (name/code) blank for manual entry
          // as per user request to only fill drawing name and Id

          let dwgName = dwgNameParam || '';

          if (!dwgName) {
            const dwgInfo = approvedDrawings.find(i => i.drawing_no === dwgParam) ||
              stockItems.find(i => i.drawing_no === dwgParam);
            dwgName = dwgInfo ? (dwgInfo.material_name || dwgInfo.description || dwgInfo.item_description || '') : '';
          }

          if (!dwgName) {
            dwgName = await fetchDrawingName(dwgParam);
          } else {
            setFetchedDrawingName(dwgName);
          }

          setProductForm(prev => ({
            ...prev,
            drawingNo: dwgParam,
            drawing_id: dwgIdParam || prev.drawing_id,
            description: cleanText(dwgName) || prev.description
          }));
        }
      }

      if (dwgParam && !drawingFilter) {
        setDrawingFilter(dwgParam);
      }
    };

    handleInitialParams();
  }, [location.search, drawingFilter, selectedItem, approvedDrawings, stockItems, itemId, productForm.drawingNo, fetchDrawingName]);

  const getItemGroupFromMaterialType = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'fg') return 'FG';
    if (t.includes('finished') && !t.includes('semi')) return 'FG';
    if (t.includes('semi')) return 'SFG';
    if (t.includes('sub assembly') || t.includes('sub-assembly')) return 'Sub Assembly';
    if (t.includes('assembly') && !t.includes('sub')) return 'Assembly';
    // If it's a component or raw material being BOM'd, it's usually a Sub Assembly
    return 'Sub Assembly';
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('authToken');

      // Fetch Stock Items (Raw Materials) FIRST so we have latest rates
      const stockResponse = await fetch(`${API_BASE}/stock/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let latestStockItems = [];
      if (stockResponse.ok) {
        latestStockItems = await stockResponse.json();
        setStockItems(latestStockItems);
      }

      // Fetch Approved BOMs for Sub-Assembly Rates
      const approvedBomsResponse = await fetch(`${API_BASE}/bom/approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (approvedBomsResponse.ok) {
        const approvedBomsData = await approvedBomsResponse.json();
        setApprovedBOMs(approvedBomsData);
      }

      const params = new URLSearchParams(location.search);
      const itemCodeFromUrl = params.get('itemCode');
      const drawingNoFromUrl = params.get('drawing_no');
      const drawingIdFromUrl = params.get('drawing_id') === 'N/A' ? '' : params.get('drawing_id');
      const effectiveId = (itemId && itemId !== 'bom-form') 
        ? itemId 
        : (selectedItem?.source === 'order' ? selectedItem?.id : null);

      if (effectiveId || itemCodeFromUrl || selectedItem?.item_code || drawingNoFromUrl) {
        let currentItem = selectedItem;
        // If we have an ID but not selectedItem data (and it's not the one we just selected)
        if (effectiveId && (!selectedItem || String(selectedItem.id) !== String(effectiveId))) {
          const itemResponse = await fetch(`${API_BASE}/sales-orders/items/${effectiveId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            currentItem = { ...itemData, source: 'order' };

            // Auto-select if in read-only mode OR if we're editing an existing BOM
            if (isReadOnly || (itemId && itemId !== 'bom-form')) {
              setSelectedItem(currentItem);
            }

            if (itemData.drawing_no && itemData.drawing_no !== 'N/A') {
              setDrawingFilter(itemData.drawing_no);
            }

            // Manually populate drawing info in form without setting product code/name/group
            setProductForm(prev => ({
              ...prev,
              drawingNo: itemData.drawing_no || prev.drawingNo,
              drawing_id: itemData.drawing_id || drawingIdFromUrl || prev.drawing_id,
              uom: itemData.unit || itemData.uom || prev.uom,
              revision: itemData.revision_no || itemData.revision || prev.revision,
              quantity: itemData.quantity || prev.quantity
            }));
          }
        }

        // Fetch BOM Details
        const itemCodeParam = itemCodeFromUrl || currentItem?.item_code || currentItem?.itemCode;
        const drawingNoParam = drawingNoFromUrl || currentItem?.drawing_no || currentItem?.drawingNo || productForm.drawingNo;

        let bomUrl = `${API_BASE}/bom/items/${effectiveId || 'null'}`;
        const queryParams = [];
        if (itemCodeParam) {
          queryParams.push(`itemCode=${encodeURIComponent(itemCodeParam)}`);
        }
        if (drawingNoParam && drawingNoParam !== 'N/A') {
          queryParams.push(`drawingNo=${encodeURIComponent(drawingNoParam)}`);
        }

        if (queryParams.length > 0) {
          bomUrl += `?${queryParams.join('&')}`;
        }

        const bomResponse = await fetch(bomUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (bomResponse.ok) {
          const data = await bomResponse.json();

          // Sync rates with latest stock data if rate is 0 or missing
          if (data.materials) {
            data.materials = data.materials.map(m => {
              const s = latestStockItems.find(si => si.material_name === m.material_name);
              if (s && (!m.rate || parseFloat(m.rate) === 0)) {
                // Prioritize Selling Rate as it's often the manual rate added during item creation
                const targetRate = s.selling_rate > 0 ? s.selling_rate : (s.valuation_rate || 0);
                return { ...m, rate: targetRate };
              }
              return m;
            });
          }
          if (data.components) {
            data.components = data.components.map(c => {
              const s = latestStockItems.find(si => si.item_code === c.component_code);
              if (s && (!c.rate || parseFloat(c.rate) === 0)) {
                const targetRate = s.selling_rate > 0 ? s.selling_rate : (s.valuation_rate || 0);
                return { ...c, rate: targetRate };
              }
              return c;
            });
          }
          if (data.scrap) {
            data.scrap = data.scrap.map(sc => {
              const s = latestStockItems.find(si => si.item_code === sc.item_code);
              if (s && (!sc.rate || parseFloat(sc.rate) === 0)) {
                const targetRate = s.selling_rate > 0 ? s.selling_rate : (s.valuation_rate || 0);
                return { ...sc, rate: targetRate };
              }
              return sc;
            });
          }

          setBomData(data);
        } else if (bomResponse.status === 404) {
          setBomData({ materials: [], components: [], operations: [], scrap: [] });
        }
      }

      // Fetch All Approved Drawings for Selection
      const drawingsResponse = await fetch(`${API_BASE}/sales-orders/approved-drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (drawingsResponse.ok) {
        const drawingsData = await drawingsResponse.json();
        const allItems = drawingsData.flatMap(order => (order.items || []).map(item => ({
          ...item,
          company_name: order.company_name,
          po_number: order.po_number
        })));
        setApprovedDrawings(allItems);
      }

      // Fetch Workstations
      const wsResponse = await fetch(`${API_BASE}/workstations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (wsResponse.ok) {
        const wsData = await wsResponse.json();
        setWorkstations(wsData);
      }

      // Fetch Operations Master
      const opsResponse = await fetch(`${API_BASE}/operations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (opsResponse.ok) {
        const opsData = await opsResponse.json();
        setOperationsList(opsData);
      }

    } catch (error) {
      errorToast(error.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [itemId, selectedItem, isReadOnly, location.search, productForm.drawingNo]);

  useEffect(() => {
    // Only show full page loading on the very first mount
    const isFirstRun = !stockItems.length && !approvedDrawings.length;
    fetchData(isFirstRun);
  }, [itemId, fetchData, stockItems.length, approvedDrawings.length]);

  // Sync productForm with selectedItem when it changes
  useEffect(() => {
    if (selectedItem) {
      // Clean up description (remove trailing parentheses)
      const cleanDescription = (selectedItem.material_name || selectedItem.description || '')
        .replace(/\s*\($/, '');

      setProductForm(prev => ({
        ...prev,
        itemCode: selectedItem.item_code || selectedItem.itemCode || prev.itemCode,
        description: cleanDescription || prev.description,
        itemGroup: selectedItem.item_group || getItemGroupFromMaterialType(selectedItem.material_type) || prev.itemGroup,
        drawingNo: selectedItem.drawing_no || prev.drawingNo,
        drawing_id: selectedItem.drawing_id || prev.drawing_id,
        quantity: selectedItem.quantity || prev.quantity,
        uom: selectedItem.unit || selectedItem.uom || prev.uom,
        revision: selectedItem.revision_no || selectedItem.revision || prev.revision
      }));
    }
  }, [selectedItem]);

  const handleAddSectionItem = async (section, formData, setFormState, initialForm) => {
    try {
      const effectiveItemId = (itemId && itemId !== 'bom-form') 
        ? itemId 
        : (selectedItem?.source === 'order' ? selectedItem?.id : null);

      if (!effectiveItemId && !productForm.drawingNo) {
        throw new Error('Please select a Product/Item or Drawing first before adding details.');
      }

      const token = localStorage.getItem('authToken');
      const payload = { ...formData };
      payload.parent_id = payload.parentId || null;
      payload.itemCode = selectedItem?.item_code || productForm.itemCode;
      payload.drawingNo = selectedItem?.drawing_no || productForm.drawingNo;

      if (section === 'materials') {
        if (!payload.materialName || !payload.qty) {
          throw new Error('Material Name and Quantity are required');
        }
        // Drawing Validation
        const stockItem = stockItems.find(i => i.material_name === payload.materialName);
        const cleanStockDwg = cleanText(stockItem?.drawing_no || 'N/A');
        const cleanSelectedDwg = cleanText(selectedItem?.drawing_no || productForm.drawingNo || 'N/A');

        if (!showAllDrawings && stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && (selectedItem?.drawing_no || productForm.drawingNo) && cleanStockDwg !== cleanSelectedDwg) {
          const confirm = await Swal.fire({
            title: 'Drawing Mismatch',
            text: `This material is linked to drawing ${cleanStockDwg}, but the product drawing is ${cleanSelectedDwg}. Continue?`,
            icon: 'warning',
            showCancelButton: true
          });
          if (!confirm.isConfirmed) return;
        }
        payload.qtyPerPc = parseFloat(formData.qty) || 0;
        payload.qty_per_pc = payload.qtyPerPc;
        payload.materialType = 'Raw Material';
        payload.material_name = payload.materialName;
        payload.item_group = payload.itemGroup;
        payload.rate = parseFloat(payload.rate) || 0;
        delete payload.qty;
      } else if (section === 'components') {
        if (!payload.componentCode || !payload.quantity) {
          throw new Error('Component Code and Quantity are required');
        }
        // Drawing Validation
        const stockItem = stockItems.find(i => i.item_code === payload.componentCode);
        const approvedItem = approvedDrawings.find(i => i.item_code === payload.componentCode);
        const linkedItem = stockItem || approvedItem;
        const cleanStockDwg = cleanText(linkedItem?.drawing_no || 'N/A');
        const cleanSelectedDwg = cleanText(selectedItem?.drawing_no || productForm.drawingNo || 'N/A');

        if (!showAllDrawings && linkedItem?.drawing_no && linkedItem.drawing_no !== 'N/A' && (selectedItem?.drawing_no || productForm.drawingNo) && cleanStockDwg !== cleanSelectedDwg) {
          const confirm = await Swal.fire({
            title: 'Drawing Mismatch',
            text: `This component is linked to drawing ${cleanStockDwg}, but the product drawing is ${cleanSelectedDwg}. Continue?`,
            icon: 'warning',
            showCancelButton: true
          });
          if (!confirm.isConfirmed) return;
        }
        payload.component_code = payload.componentCode;
        payload.loss_percent = payload.lossPercent;
        payload.quantity = parseFloat(payload.quantity) || 0;
        payload.rate = parseFloat(payload.rate) || 0;
        payload.lossPercent = parseFloat(payload.lossPercent) || 0;
      } else if (section === 'operations') {
        if (!payload.operationName || payload.hourlyRate === '') {
          throw new Error('Operation Name and Hourly Rate are required');
        }
        payload.cycleTimeMin = parseFloat(payload.cycleTimeMin) || 0;
        payload.setupTimeMin = parseFloat(payload.setupTimeMin) || 0;
        payload.hourlyRate = parseFloat(payload.hourlyRate) || 0;
        payload.operation_name = payload.operationName;
        payload.cycle_time_min = payload.cycleTimeMin;
        payload.setup_time_min = payload.setupTimeMin;
        payload.hourly_rate = payload.hourlyRate;
        payload.operation_type = payload.operationType;
      } else if (section === 'scrap') {
        if (!payload.itemCode || payload.inputQty === '' || payload.rate === '') {
          throw new Error('Item Code, Input Qty, and Rate are required');
        }
        // Drawing Validation
        const stockItem = stockItems.find(i => i.item_code === payload.itemCode);
        const approvedItem = approvedDrawings.find(i => i.item_code === payload.itemCode);
        const linkedItem = stockItem || approvedItem;
        const cleanStockDwg = cleanText(linkedItem?.drawing_no || 'N/A');
        const cleanSelectedDwg = cleanText(selectedItem?.drawing_no || productForm.drawingNo || 'N/A');

        if (!showAllDrawings && linkedItem?.drawing_no && linkedItem.drawing_no !== 'N/A' && (selectedItem?.drawing_no || productForm.drawingNo) && cleanStockDwg !== cleanSelectedDwg) {
          const confirm = await Swal.fire({
            title: 'Drawing Mismatch',
            text: `This scrap item is linked to drawing ${cleanStockDwg}, but the product drawing is ${cleanSelectedDwg}. Continue?`,
            icon: 'warning',
            showCancelButton: true
          });
          if (!confirm.isConfirmed) return;
        }
        payload.inputQty = parseFloat(payload.inputQty) || 0;
        payload.lossPercent = parseFloat(payload.lossPercent) || 0;
        payload.rate = parseFloat(payload.rate) || 0;
        payload.item_code = payload.itemCode;
        payload.item_name = payload.itemName;
        payload.input_qty = payload.inputQty;
        payload.loss_percent = payload.lossPercent;
      }

      if (effectiveItemId) {
        // Direct API update for existing BOMs or SO-linked items
        const response = await fetch(`${API_BASE}/bom/items/${effectiveItemId}/${section}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to add ${section}`);
        }
        await fetchData(false);
      } else {
        // Local state update for new BOMs (especially from drawing/stock source)
        const newItem = {
          ...payload,
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isLocal: true
        };
        setBomData(prev => {
          const currentItems = Array.isArray(prev[section]) ? prev[section] : [];
          return {
            ...prev,
            [section]: [...currentItems, newItem]
          };
        });
      }

      setFormState(initialForm);
      successToast(`${section} added`);
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDeleteSectionItem = async (section, id, isLocal = false) => {
    try {
      if (isLocal || (!itemId || itemId === 'bom-form')) {
        setBomData(prev => {
          const idsToDelete = new Set([id]);

          const findChildren = (parentId) => {
            (prev.components || []).forEach(c => {
              if (String(c.parent_id || c.parentId) === String(parentId)) {
                if (!idsToDelete.has(c.id)) {
                  idsToDelete.add(c.id);
                  findChildren(c.id);
                }
              }
            });
            (prev.materials || []).forEach(m => {
              if (String(m.parent_id || m.parentId) === String(parentId)) {
                idsToDelete.add(m.id);
              }
            });
            (prev.scrap || []).forEach(s => {
              if (String(s.parent_id || s.parentId) === String(parentId)) {
                idsToDelete.add(s.id);
              }
            });
          };

          if (section === 'components') {
            findChildren(id);
          }

          return {
            ...prev,
            materials: prev.materials.filter(m => !idsToDelete.has(m.id)),
            components: prev.components.filter(c => !idsToDelete.has(c.id)),
            operations: section === 'operations' ? prev.operations.filter(o => o.id !== id) : prev.operations,
            scrap: section === 'scrap' ? prev.scrap.filter(s => s.id !== id) : prev.scrap
          };
        });
        successToast(`${section} removed`);
        return;
      }

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/${section}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Failed to delete ${section}`);

      await fetchData(false);
      successToast(`${section} removed`);
    } catch (error) {
      errorToast(error.message);
    }
  };

  const resetForm = () => {
    setProductForm({
      itemGroup: 'FG',
      itemCode: '',
      drawingNo: '',
      drawing_id: '',
      uom: 'Kg',
      revision: '1',
      description: '',
      isActive: true,
      isDefault: false,
      quantity: 1
    });
    setBomData({
      materials: [],
      components: [],
      operations: [],
      scrap: []
    });
    setSelectedItem(null);
    setDrawingFilter('');
    setMaterialForm({ materialName: '', qty: '', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '' });
    setComponentForm({ componentCode: '', quantity: '', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '' });
    setOperationForm({ operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
    setScrapForm({ itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '' });
  };

  const handleCreateBOM = async () => {
    try {
      if (!selectedItem?.id && !productForm.drawingNo) {
        throw new Error('Product/Item or Drawing not selected');
      }
      if (!productForm.quantity || productForm.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      if (bomData.materials.length === 0 && bomData.components.length === 0) {
        throw new Error('At least one raw material or sub-assembly component is required');
      }

      const effectiveItemId = (itemId && itemId !== 'bom-form') 
        ? itemId 
        : (selectedItem?.source === 'order' ? selectedItem?.id : null);

      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams(location.search);
      const salesOrderIdFromUrl = params.get('sales_order_id');

      const bomPayload = {
        itemId: effectiveItemId,
        salesOrderId: salesOrderIdFromUrl,
        productForm: productForm,
        materials: bomData.materials,
        components: bomData.components.map(c => ({
          ...c,
          sourceFg: (c.componentCode || '').startsWith('SA-') ? productForm.drawingNo : null
        })),
        operations: bomData.operations,
        scrap: bomData.scrap,
        source: selectedItem?.source || (productForm.drawingNo ? 'order' : 'stock'),
        costing: {
          componentsCost,
          rawMaterialsCost,
          scrapLoss,
          materialCostAfterScrap,
          operationsCost,
          totalBOMCost,
          costPerUnit,
          totalScrapQty
        }
      };

      const response = await fetch(`${API_BASE}/bom/createRequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bomPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create BOM');
      }

      await response.json();
      successToast('BOM created successfully');

      // Instead of resetting and navigating to list, stay on the page in view mode
      // This solves the "did not show saved bom" problem
      if (itemId && itemId !== 'bom-form') {
        navigate(`/bom-form/${itemId}?view=true`);
      } else if (selectedItem) {
        const targetId = selectedItem.source === 'order' ? selectedItem.id : 'bom-form';
        const queryParams = selectedItem.source === 'stock'
          ? `?itemCode=${encodeURIComponent(selectedItem.item_code || selectedItem.itemCode)}&view=true`
          : '?view=true';
        navigate(`/bom-form/${targetId}${queryParams}`);
      } else {
        resetForm();
        navigate('/bom-creation');
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  // Cost Calculations
  const batchQty = parseFloat(productForm.quantity || 1);

  // Helper for recursive cost calculation
  const calculateRecursiveCost = useCallback((item, allItems) => {
    const isMaterial = !!item.material_name;
    const qty = parseFloat(isMaterial ? item.qty_per_pc : (item.quantity || item.qty || 0));
    const rate = parseFloat(item.rate || 0);
    const baseItemCost = qty * rate;

    // Find children
    const children = allItems.filter(child => String(child.parent_id || child.parentId) === String(item.id));
    const childrenCost = children.reduce((sum, child) => sum + calculateRecursiveCost(child, allItems), 0);

    const totalBeforeLoss = baseItemCost + childrenCost;
    const lossPercent = isMaterial ? 0 : parseFloat(item.loss_percent || item.lossPercent || 0);

    // Apply loss to both item cost and its children's costs
    return (lossPercent > 0 && lossPercent < 100)
      ? totalBeforeLoss / (1 - (lossPercent / 100))
      : totalBeforeLoss;
  }, []);

  const componentsCost = useMemo(() => {
    return bomData.components
      .filter(c => !c.parent_id && !c.parentId)
      .reduce((sum, c) => sum + calculateRecursiveCost(c, [...bomData.components, ...bomData.materials]), 0);
  }, [bomData.components, bomData.materials, calculateRecursiveCost]);

  const rawMaterialsCost = useMemo(() => {
    return bomData.materials
      .filter(m => !m.parent_id && !m.parentId)
      .reduce((sum, m) => sum + calculateRecursiveCost(m, [...bomData.components, ...bomData.materials]), 0);
  }, [bomData.components, bomData.materials, calculateRecursiveCost]);

  const scrapLoss = bomData.scrap.reduce((sum, s) => {
    const input = parseFloat(s.input_qty || 0);
    const loss = parseFloat(s.loss_percent || 0) / 100;
    const rate = parseFloat(s.rate || 0);
    return sum + (input * loss * rate);
  }, 0) / batchQty;

  const materialCostAfterScrap = (componentsCost + rawMaterialsCost) - scrapLoss;

  const operationsCost = bomData.operations.reduce((sum, o) => {
    const hourlyRate = parseFloat(o.hourly_rate || 0);
    const setupTime = parseFloat(o.setup_time_min || 0);
    const cycleTime = parseFloat(o.cycle_time_min || 0);
    // Cost per unit: Cycle time + Setup time
    return sum + ((cycleTime + setupTime) / 60 * hourlyRate);
  }, 0);

  const totalBOMCost = materialCostAfterScrap + operationsCost;
  const costPerUnit = totalBOMCost;
  const totalScrapQty = bomData.scrap.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100)), 0) / batchQty;

  if (loading && stockItems.length === 0) return <div className="p-8 text-center text-slate-500">Loading Item Details...</div>;

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-slate-900">
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600">📙</span>
            <div>
              <h1 className="text-xl  flex items-center gap-3">
                {isReadOnly
                  ? `Viewing BOM: ${cleanText(productForm.description) || itemId} ${productForm.itemGroup ? `(${productForm.itemGroup})` : ''}`
                  : 'Create BOM'}
                {selectedItem?.status === 'REJECTED' && (
                  <span className="px-2 py-1 rounded text-[10px]  bg-rose-100 text-rose-600 border border-rose-200 animate-pulse ">
                    Rejected Drawing
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-slate-400   tracking-wider">
                {selectedItem?.status === 'REJECTED' && selectedItem?.rejection_reason
                  ? `Reason: ${selectedItem.rejection_reason}`
                  : isReadOnly ? 'Inspecting bill of materials details' : 'Configure bill of materials'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs  border border-blue-100">Drafts</button>
            <button onClick={() => navigate('/bom-creation')} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs  text-slate-600 hover:bg-slate-50 shadow-sm transition-all flex items-center gap-1">
              ← Back
            </button>
          </div>
        </div>

        {/* SECTION 1: Product Information */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div
            className="bg-white p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('productInfo')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 tracking-tight">Product Information</h4>
                <p className="text-[10px] text-slate-400 font-medium  tracking-wider">Primary Configuration</p>
              </div>
            </div>
            <div className={`transition-transform duration-300 ${collapsedSections.productInfo ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.productInfo && (
            <div className="p-4 bg-white">
              {!isReadOnly && (
                <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/50 mb-4 flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px]  text-blue-600  ml-1">Quick Filter by Drawing</label>
                    <SearchableSelect
                      placeholder="Type drawing number or name..."
                      options={drawingOptions}
                      subLabelField="subLabel"
                      value={drawingFilter}
                      onChange={async (e) => {
                        const newDwg = e.target.value;
                        setDrawingFilter(newDwg);
                        if (newDwg) {
                          const dwgInfo = approvedDrawings.find(i => i.drawing_no === newDwg) ||
                            stockItems.find(i => i.drawing_no === newDwg);

                          let dwgName = dwgInfo ? (dwgInfo.material_name || dwgInfo.description || dwgInfo.item_description || '') : '';

                          if (!dwgName) {
                            dwgName = await fetchDrawingName(newDwg);
                          } else {
                            setFetchedDrawingName(dwgName);
                          }

                          setSelectedItem(null);
                          setProductForm(prev => ({
                            ...prev,
                            itemCode: '',
                            description: cleanText(dwgName),
                            drawingNo: newDwg,
                            drawing_id: dwgInfo?.drawing_id || '',
                            quantity: 1
                          }));
                          setBomData({ materials: [], components: [], operations: [], scrap: [] });
                        } else {
                          setFetchedDrawingName('');
                        }
                      }}
                    />
                  </div>
                  {drawingFilter && (
                    <div className="flex items-center gap-3 pb-1 px-1">
                      <div className="h-8 w-px bg-blue-200 hidden md:block"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-medium">Selected Drawing</span>
                        <div className="text-xs text-blue-700  truncate max-w-[200px]">
                          {(() => {
                            if (fetchedDrawingName) return cleanText(fetchedDrawingName);
                            const opt = drawingOptions.find(o => o.value === drawingFilter);
                            return opt ? opt.label : '';
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePreviewByNo(drawingFilter)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="Preview Drawing"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDrawingFilter('');
                          setFetchedDrawingName('');
                          setSelectedItem(null);
                          setProductForm(prev => ({
                            ...prev,
                            itemCode: '',
                            description: '',
                            drawingNo: '',
                            drawing_id: '',
                            quantity: 1
                          }));
                          setBomData({ materials: [], components: [], operations: [], scrap: [] });
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors group"
                        title="Clear Filter"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Product Name <span className="text-rose-500">*</span></label>
                  {isReadOnly ? (
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 ">
                      {productForm.description || '—'}
                    </div>
                  ) : (
                    <SearchableSelect
                      placeholder="Select Product"
                      options={[
                        ...approvedDrawings.map(item => {
                          const cleanName = (item.material_name || item.description || '').replace(/\s*\($/, '');
                          return {
                            label: cleanName,
                            value: `order_${item.id}`,
                            id: item.id,
                            source: 'order',
                            drawing_no: item.drawing_no,
                            item_group: item.item_group || item.material_type,
                            subLabel: `[${item.item_group || 'Item'}] • ${item.item_code} ${item.drawing_no && item.drawing_no !== 'N/A' ? `• Drg: ${item.drawing_no}` : ''}`
                          };
                        }),
                        ...stockItems.map(item => {
                          const cleanName = (item.material_name || '').replace(/\s*\($/, '');
                          return {
                            label: cleanName,
                            value: `stock_${item.id}`,
                            id: item.id,
                            source: 'stock',
                            drawing_no: item.drawing_no,
                            item_group: item.material_type,
                            subLabel: `[${item.material_type || 'Stock'}] • ${item.item_code} ${item.drawing_no && item.drawing_no !== 'N/A' ? `• Drg: ${item.drawing_no}` : ''}`
                          };
                        })
                      ].filter(opt => {
                        const group = (opt.item_group || '').toLowerCase();
                        const isFinishedOrSub = group.includes('finished') || group.includes('sub') || group.includes('assembly') || group === 'fg' || group === 'sfg';

                        if (drawingFilter) {
                          const cleanOptDwg = String(opt.drawing_no || '').replace(/\s*\($/, '');
                          const cleanFilterDwg = String(drawingFilter || '').replace(/\s*\($/, '');
                          return cleanOptDwg === cleanFilterDwg && isFinishedOrSub;
                        }
                        return isFinishedOrSub;
                      })}
                      value={selectedItem ? `${selectedItem.source || 'order'}_${selectedItem.id}` : ''}
                      onChange={(e) => {
                        const [source, id] = e.target.value.split('_');
                        const item = source === 'order'
                          ? approvedDrawings.find(i => String(i.id) === String(id))
                          : stockItems.find(i => String(i.id) === String(id));

                        if (item) {
                          setSelectedItem({ ...item, source });
                          setProductForm(prev => ({
                            ...prev,
                            description: (item.material_name || item.description || item.item_description || '').replace(/\s*\($/, ''),
                            itemCode: item.item_code,
                            itemGroup: item.item_group || item.material_type || getItemGroupFromMaterialType(item.material_type),
                            drawingNo: item.drawing_no || '',
                            drawing_id: item.drawing_id || '',
                            uom: item.unit || item.uom || 'Kg',
                            revision: item.revision_no || item.revision || '1',
                            quantity: item.quantity || 1
                          }));
                        }
                      }}
                      subLabelField="subLabel"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Item Code <span className="text-rose-500">*</span></label>
                  {isReadOnly ? (
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 ">
                      {productForm.itemCode || '—'}
                    </div>
                  ) : (
                    <SearchableSelect
                      placeholder="Select Item Code"
                      options={[
                        ...approvedDrawings.map(item => {
                          const cleanName = (item.material_name || item.description || '').replace(/\s*\($/, '');
                          return {
                            label: item.item_code,
                            value: `order_${item.id}`,
                            id: item.id,
                            source: 'order',
                            drawing_no: item.drawing_no,
                            item_group: item.item_group || item.material_type,
                            subLabel: `${cleanName} [${item.item_group || 'Item'}] ${item.drawing_no && item.drawing_no !== 'N/A' ? `• Drg: ${item.drawing_no}` : ''}`
                          };
                        }),
                        ...stockItems.map(item => {
                          const cleanName = (item.material_name || '').replace(/\s*\($/, '');
                          return {
                            label: item.item_code,
                            value: `stock_${item.id}`,
                            id: item.id,
                            source: 'stock',
                            drawing_no: item.drawing_no,
                            item_group: item.material_type,
                            subLabel: `${cleanName} [${item.material_type || 'Stock'}] ${item.drawing_no && item.drawing_no !== 'N/A' ? `• Drg: ${item.drawing_no}` : ''}`
                          };
                        })
                      ].filter(opt => {
                        const group = (opt.item_group || '').toLowerCase();
                        const isFinishedOrSub = group.includes('finished') || group.includes('sub') || group.includes('assembly') || group === 'fg' || group === 'sfg';

                        if (drawingFilter) {
                          const cleanOptDwg = String(opt.drawing_no || '').replace(/\s*\($/, '');
                          const cleanFilterDwg = String(drawingFilter || '').replace(/\s*\($/, '');
                          return cleanOptDwg === cleanFilterDwg && isFinishedOrSub;
                        }
                        return isFinishedOrSub;
                      })}
                      value={selectedItem ? `${selectedItem.source || 'order'}_${selectedItem.id}` : ''}
                      onChange={(e) => {
                        const [source, id] = e.target.value.split('_');
                        const item = source === 'order'
                          ? approvedDrawings.find(i => String(i.id) === String(id))
                          : stockItems.find(i => String(i.id) === String(id));

                        if (item) {
                          setSelectedItem({ ...item, source });
                          setProductForm(prev => ({
                            ...prev,
                            description: (item.material_name || item.description || item.item_description || '').replace(/\s*\($/, ''),
                            itemCode: item.item_code,
                            itemGroup: item.item_group || item.material_type || getItemGroupFromMaterialType(item.material_type),
                            drawingNo: item.drawing_no || '',
                            drawing_id: item.drawing_id || '',
                            uom: item.unit || item.uom || 'Kg',
                            revision: item.revision_no || item.revision || '1',
                            quantity: item.quantity || 1
                          }));
                        }
                      }}
                      subLabelField="subLabel"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Item Group</label>
                  <select
                    disabled={isReadOnly}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    value={productForm.itemGroup}
                    onChange={(e) => {
                      const newGroup = e.target.value;
                      const isAssembly = ['Sub Assembly', 'Assembly'].includes(newGroup);
                      setProductForm({
                        ...productForm,
                        itemGroup: newGroup,
                        quantity: isAssembly ? 1 : productForm.quantity
                      });
                    }}
                  >
                    <option value="FG">FG (Finished Good)</option>
                    <option value="SFG">SFG (Semi-Finished)</option>
                    <option value="Sub Assembly">Sub Assembly</option>
                    <option value="Assembly">Assembly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Base Quantity (Yield)</label>
                  <div className="relative">
                    <input
                      type="number"
                      className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs  transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${(['Sub Assembly', 'Assembly'].includes(productForm.itemGroup) || isReadOnly) ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700'}`}
                      placeholder="Enter quantity"
                      step="0.01"
                      min="0.01"
                      value={productForm.quantity}
                      disabled={['Sub Assembly', 'Assembly'].includes(productForm.itemGroup) || isReadOnly}
                      onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">{productForm.uom}</div>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    Yield for cost calculation
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">UOM</label>
                  <select
                    disabled={isReadOnly}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    value={productForm.uom}
                    onChange={(e) => setProductForm({ ...productForm, uom: e.target.value })}
                  >
                    <option value="Kg">Kilogram (Kg)</option>
                    <option value="Nos">Numbers (Nos)</option>
                    <option value="Mtr">Meter (Mtr)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">BOM Revision</label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="e.g. 1.0"
                    value={productForm.revision}
                    onChange={(e) => setProductForm({ ...productForm, revision: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-5 pt-5 border-t border-slate-100">
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Technical Specifications / Notes</label>
                  <textarea
                    disabled={isReadOnly}
                    rows="2"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 resize-none"
                    placeholder="Enter any additional technical details or manufacturing notes..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
                <div className="flex flex-col justify-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${productForm.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <input
                        disabled={isReadOnly}
                        type="checkbox"
                        className="hidden"
                        checked={productForm.isActive}
                        onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                      />
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${productForm.isActive ? 'left-5' : 'left-1'}`}></div>
                    </div>
                    <span className="text-xs  text-slate-700">Active BOM</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${productForm.isDefault ? 'bg-blue-500' : 'bg-slate-300'}`}>
                      <input
                        disabled={isReadOnly}
                        type="checkbox"
                        className="hidden"
                        checked={productForm.isDefault}
                        onChange={(e) => setProductForm({ ...productForm, isDefault: e.target.checked })}
                      />
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${productForm.isDefault ? 'left-5' : 'left-1'}`}></div>
                    </div>
                    <span className="text-xs  text-slate-700">Default BOM</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 2: Components */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div
            className="bg-white p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('components')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 tracking-tight">Components/Sub-Assemblies</h4>
                <p className="text-[10px] text-slate-400 font-medium  tracking-wider">{bomData.components.length} items • Total ₹{componentsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (collapsedSections.components) {
                      toggleSection('components');
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs  hover:bg-indigo-100 transition-colors flex items-center gap-1.5 border border-indigo-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.components ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          {!collapsedSections.components && (
            <div className="p-4 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-[10px]  text-indigo-600  flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      Add New Component
                    </h5>
                    <label className="flex items-center gap-2 cursor-pointer group bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-indigo-300 transition-all">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={showAllDrawings}
                        onChange={(e) => setShowAllDrawings(e.target.checked)}
                      />
                      <span className="text-[10px]  text-slate-600 group-hover:text-indigo-600 transition-colors">Global Search</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Component Selection <span className="text-rose-500">*</span></label>
                      <SearchableSelect
                        placeholder="Select assembly or part..."
                        options={componentOptions}
                        value={componentForm.componentCode}
                        onChange={(e) => {
                          const item = componentOptions.find(i => i.value === e.target.value);
                          setComponentForm({
                            ...componentForm,
                            componentCode: e.target.value,
                            rate: item ? item.rate : componentForm.rate,
                            uom: item ? item.uom : componentForm.uom,
                            description: item ? item.description : componentForm.description
                          });
                        }}
                        subLabelField="subLabel"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Parent Level</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={componentForm.parentId}
                        onChange={(e) => setComponentForm({ ...componentForm, parentId: e.target.value })}
                      >
                        <option value="">None (Top Level)</option>
                        {bomData.components.map(c => (
                          <option key={c.id} value={c.id}>{c.component_code || c.componentCode}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Qty</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" step="0.01" value={componentForm.quantity} onChange={(e) => setComponentForm({ ...componentForm, quantity: e.target.value })} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">UOM</label>
                      <select className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={componentForm.uom} onChange={(e) => setComponentForm({ ...componentForm, uom: e.target.value })}>
                        <option value="Kg">Kg</option>
                        <option value="Nos">Nos</option>
                        <option value="Mtr">Mtr</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1 flex flex-col justify-end">
                      <button
                        onClick={() => handleAddSectionItem('components', componentForm, setComponentForm, { componentCode: '', quantity: '', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '' })}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Unit Rate (₹)</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" step="0.01" value={componentForm.rate} onChange={(e) => setComponentForm({ ...componentForm, rate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Process Loss %</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-rose-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" step="0.01" value={componentForm.lossPercent} onChange={(e) => setComponentForm({ ...componentForm, lossPercent: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Component Notes</label>
                      <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Special handling or revision notes..." value={componentForm.notes} onChange={(e) => setComponentForm({ ...componentForm, notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {bomData.components.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px]  text-slate-400 ">Component / Assembly</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Qty / UOM</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Rate (₹)</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Loss %</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Net Amount</th>
                        {!isReadOnly && <th className="px-4 py-3 text-right text-[10px]  text-slate-400 ">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomData.components.filter(c => !c.parent_id && !c.parentId).map((c) => (
                        <RecursiveBOMRow
                          key={c.id}
                          item={c}
                          onRemove={handleDeleteSectionItem}
                          isReadOnly={isReadOnly}
                          allItems={[...bomData.materials, ...bomData.components]}
                          type="component"
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-3">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-xs  text-slate-400 ">No components added yet</p>
                </div>
              )}
            </div>
          )}
        </Card>


        {/* SECTION 3: Materials */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div
            className="bg-white p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('materials')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 tracking-tight">Raw Materials</h4>
                <p className="text-[10px] text-slate-400 font-medium  tracking-wider">{bomData.materials.length} items • Total ₹{rawMaterialsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (collapsedSections.materials) {
                      toggleSection('materials');
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs  hover:bg-emerald-100 transition-colors flex items-center gap-1.5 border border-emerald-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.materials ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          {!collapsedSections.materials && (
            <div className="p-4 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-[10px]  text-emerald-600  flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Add New Material
                    </h5>
                    <label className="flex items-center gap-2 cursor-pointer group bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-emerald-300 transition-all">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={showAllDrawings}
                        onChange={(e) => setShowAllDrawings(e.target.checked)}
                      />
                      <span className="text-[10px]  text-slate-600 group-hover:text-emerald-600 transition-colors">Global Search</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Material Selection <span className="text-rose-500">*</span></label>
                      <SearchableSelect
                        placeholder="Select raw material..."
                        options={stockItems
                          .filter(item => {
                            // Type Filter
                            const type = (item.material_type || '').toLowerCase();
                            const targetGroup = (materialForm.itemGroup || '').toLowerCase();

                            if (targetGroup === 'raw material') {
                              if (!type.includes('raw')) return false;
                            } else if (targetGroup === 'sub assembly') {
                              if (!type.includes('sub assembly')) return false;
                            }

                            if (showAllDrawings) return true;
                            const productDrawing = selectedItem?.drawing_no || productForm.drawingNo;
                            return !productDrawing || !item.drawing_no || item.drawing_no === 'N/A' || item.drawing_no === productDrawing;
                          })
                          .map(item => ({
                            label: item.material_name,
                            value: item.material_name,
                            subLabel: `${item.item_code} ${item.drawing_no && item.drawing_no !== 'N/A' ? `[Drg: ${item.drawing_no}]` : ''}`
                          }))}
                        value={materialForm.materialName}
                        onChange={(e) => {
                          const item = stockItems.find(i => i.material_name === e.target.value);
                          // Check if this material is a sub-assembly and has an approved BOM cost
                          const bomInfo = item ? approvedBOMs.find(b => b.item_code === item.item_code) : null;
                          const bomCost = bomInfo ? parseFloat(bomInfo.bom_cost) : 0;

                          setMaterialForm({
                            ...materialForm,
                            materialName: e.target.value,
                            rate: item ? (bomCost > 0 ? bomCost : (item.selling_rate > 0 ? item.selling_rate : (item.valuation_rate || 0))) : materialForm.rate,
                            uom: item ? (item.unit || 'Kg') : materialForm.uom,
                            description: item ? item.material_name : materialForm.description
                          });
                        }}
                        subLabelField="subLabel"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Quantity</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="0.00" step="0.01" value={materialForm.qty} onChange={(e) => setMaterialForm({ ...materialForm, qty: e.target.value })} />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">UOM</label>
                      <select className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={materialForm.uom} onChange={(e) => setMaterialForm({ ...materialForm, uom: e.target.value })}>
                        <option value="Kg">Kg</option>
                        <option value="Nos">Nos</option>
                        <option value="Mtr">Mtr</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Item Group</label>
                      <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={materialForm.itemGroup} onChange={(e) => setMaterialForm({ ...materialForm, itemGroup: e.target.value })}>
                        <option value="Raw Material">Raw Material</option>
                        <option value="SFG">SFG</option>
                        <option value="Sub Assembly">Sub Assembly</option>
                        <option value="Consumable">Consumable</option>
                        <option value="Tooling">Tooling</option>
                        <option value="Service">Service</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1 flex flex-col justify-end">
                      <button
                        onClick={() => handleAddSectionItem('materials', materialForm, setMaterialForm, { materialName: '', qty: '', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '' })}
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs  hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Material
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Rate (₹)</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="0.00" step="0.01" value={materialForm.rate} onChange={(e) => setMaterialForm({ ...materialForm, rate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Warehouse</label>
                      <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={materialForm.warehouse} onChange={(e) => setMaterialForm({ ...materialForm, warehouse: e.target.value })}>
                        <option value="">Default</option>
                        <option value="Main">Main Warehouse</option>
                        <option value="Scrap">Scrap Yard</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Operation Link</label>
                      <SearchableSelect
                        placeholder="Select Operation"
                        options={operationsList.map(op => ({
                          label: op.operation_name,
                          value: op.operation_name
                        }))}
                        value={materialForm.operation}
                        onChange={(e) => setMaterialForm({ ...materialForm, operation: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Parent Component</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={materialForm.parentId}
                        onChange={(e) => setMaterialForm({ ...materialForm, parentId: e.target.value })}
                      >
                        <option value="">None (Top Level)</option>
                        {bomData.components.map(c => (
                          <option key={c.id} value={c.id}>{c.component_code || c.componentCode}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {bomData.materials.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px]  text-slate-400 ">Item Details</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Qty / UOM</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Rate (₹)</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Warehouse</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Operation</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Total</th>
                        {!isReadOnly && <th className="px-4 py-3 text-right text-[10px]  text-slate-400 ">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomData.materials.filter(m => !m.parent_id && !m.parentId).map((m) => (
                        <RecursiveBOMRow
                          key={m.id}
                          item={m}
                          onRemove={handleDeleteSectionItem}
                          isReadOnly={isReadOnly}
                          allItems={[...bomData.materials, ...bomData.components]}
                          type="material"
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-emerald-50/30">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-emerald-300 mb-3 shadow-sm border border-emerald-50">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-xs  text-emerald-400 ">No materials added yet</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 4: Operations */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div
            className="bg-white p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('operations')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 tracking-tight">Process Routing</h4>
                <p className="text-[10px] text-slate-400 font-medium  tracking-wider">{bomData.operations.length} operations • Total ₹{operationsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (collapsedSections.operations) {
                      toggleSection('operations');
                    } else {
                      handleAddSectionItem('operations', operationForm, setOperationForm, { operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
                    }
                  }}
                  className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs  hover:bg-purple-100 transition-colors flex items-center gap-1.5 border border-purple-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.operations ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          {!collapsedSections.operations && (
            <div className="p-4 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="text-[10px]  text-purple-600  flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                        Add New Operation
                      </h5>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">Define manufacturing sequence and standard times</p>
                    </div>
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                      <span className="text-[9px]  text-slate-400  tracking-tighter">Cost Formula:</span>
                      <code className="text-[10px] text-purple-600 font-mono ">((Cycle + Setup) / 60) * Rate</code>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Operation *</label>
                      <SearchableSelect
                        placeholder="Select process..."
                        options={operationsList.map(op => ({
                          label: op.operation_name,
                          value: op.operation_name,
                          subLabel: `Code: ${op.operation_code}`
                        }))}
                        value={operationForm.operationName}
                        onChange={(e) => {
                          const op = operationsList.find(o => o.operation_name === e.target.value);
                          if (op) {
                            setOperationForm({
                              ...operationForm,
                              operationName: e.target.value,
                              workstation: op.workstation_code || op.workstation || '',
                              hourlyRate: op.hourly_rate || 0
                            });
                          } else {
                            setOperationForm({ ...operationForm, operationName: e.target.value });
                          }
                        }}
                        subLabelField="subLabel"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Workstation / Resource</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        value={operationForm.workstation}
                        onChange={(e) => {
                          const ws = workstations.find(w => w.workstation_code === e.target.value);
                          setOperationForm({
                            ...operationForm,
                            workstation: e.target.value,
                            hourlyRate: ws ? ws.hourly_rate : operationForm.hourlyRate
                          });
                        }}
                      >
                        <option value="">Select Resource</option>
                        {workstations.map(ws => (
                          <option key={ws.id} value={ws.workstation_code}>
                            {ws.workstation_code} - {ws.workstation_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Cycle Time (min)</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0.00" step="0.01" value={operationForm.cycleTimeMin} onChange={(e) => setOperationForm({ ...operationForm, cycleTimeMin: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Setup Time (min)</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0.00" step="0.01" value={operationForm.setupTimeMin} onChange={(e) => setOperationForm({ ...operationForm, setupTimeMin: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Hourly Rate (₹)</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0.00" step="0.01" value={operationForm.hourlyRate} onChange={(e) => setOperationForm({ ...operationForm, hourlyRate: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 pt-4 border-t border-slate-200/60">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Process Type</label>
                      <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={operationForm.operationType} onChange={(e) => setOperationForm({ ...operationForm, operationType: e.target.value })}>
                        <option value="In-House">In-House Production</option>
                        <option value="Sub-Contract">Job Work (Sub-Contract)</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Output Warehouse (WIP)</label>
                      <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={operationForm.targetWarehouse} onChange={(e) => setOperationForm({ ...operationForm, targetWarehouse: e.target.value })}>
                        <option value="">Select Destination</option>
                        <option value="WIP">Work In Progress</option>
                        <option value="FG">Finished Goods</option>
                        <option value="Main">Main Warehouse</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Calculated Op. Cost</label>
                      <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs  text-purple-700 flex items-center h-[38px]">
                        ₹ {(((parseFloat(operationForm.cycleTimeMin || 0) + parseFloat(operationForm.setupTimeMin || 0)) / 60) * parseFloat(operationForm.hourlyRate || 0)).toFixed(2)}
                      </div>
                    </div>

                    <div className="md:col-span-3 flex items-end">
                      <button
                        onClick={() => handleAddSectionItem('operations', operationForm, setOperationForm, { operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' })}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg text-xs  hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Operation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {bomData.operations.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px]  text-slate-400 ">Sequence / Details</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Times (Min)</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Hourly Rate</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Net Time</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Op. Cost</th>
                        {!isReadOnly && <th className="px-4 py-3 text-right text-[10px]  text-slate-400 ">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomData.operations.map((o, idx) => {
                        const cycleTime = parseFloat(o.cycle_time_min || 0);
                        const setupTime = parseFloat(o.setup_time_min || 0);
                        const hourlyRate = parseFloat(o.hourly_rate || 0);
                        const totalTimeMin = cycleTime + setupTime;
                        const operationCost = (totalTimeMin / 60) * hourlyRate;
                        return (
                          <tr key={o.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px]  text-slate-500 border border-slate-200">{idx + 1}</span>
                                <div className="flex flex-col">
                                  <span className="text-xs  text-slate-800">{o.operation_name}</span>
                                  <span className="text-[9px] text-slate-400   flex items-center gap-1">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                                    {o.workstation || 'No Resource'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center">
                                <span className="text-xs  text-slate-700">C: {cycleTime} / S: {setupTime}</span>
                                <span className="text-[9px] text-slate-400 font-medium">Minutes</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-xs  text-slate-600">
                              ₹{hourlyRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px]  bg-indigo-50 text-indigo-600 border border-indigo-100">
                                {totalTimeMin.toFixed(1)}m
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className="text-xs  text-purple-600">
                                ₹{operationCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            {!isReadOnly && (
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteSectionItem('operations', o.id, o.isLocal)}
                                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  title="Remove Operation"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-purple-50/30">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-purple-300 mb-3 shadow-sm border border-purple-50">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                  </div>
                  <p className="text-xs  text-purple-400 ">No operations defined</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 5: Scrap & Loss */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div
            className="bg-white p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('scrap')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 border border-orange-100 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 tracking-tight">Scrap & Recoveries</h4>
                <p className="text-[10px] text-slate-400 font-medium  tracking-wider">{bomData.scrap.length} scrap items • Value ₹{scrapLoss.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (collapsedSections.scrap) {
                      toggleSection('scrap');
                    } else {
                      handleAddSectionItem('scrap', scrapForm, setScrapForm, { itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '' });
                    }
                  }}
                  className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs  hover:bg-orange-100 transition-colors flex items-center gap-1.5 border border-orange-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.scrap ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          {!collapsedSections.scrap && (
            <div className="p-4 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-[10px]  text-orange-600  flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      Add Scrap Item
                    </h5>
                    <label className="flex items-center gap-2 cursor-pointer group bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-orange-300 transition-all">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        checked={showAllDrawings}
                        onChange={(e) => setShowAllDrawings(e.target.checked)}
                      />
                      <span className="text-[10px]  text-slate-600 group-hover:text-orange-600 transition-colors">Global Search</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Scrap Material *</label>
                      <SearchableSelect
                        placeholder="Select scrap item..."
                        options={stockItems
                          .filter(item => {
                            if (showAllDrawings) return true;
                            const productDrawing = selectedItem?.drawing_no || productForm.drawingNo;
                            return !productDrawing || !item.drawing_no || item.drawing_no === 'N/A' || item.drawing_no === productDrawing;
                          })
                          .map(item => ({
                            label: item.material_name,
                            value: item.material_name,
                            subLabel: `${item.item_code} ${item.drawing_no && item.drawing_no !== 'N/A' ? `[Drg: ${item.drawing_no}]` : ''}`
                          }))}
                        value={scrapForm.itemName}
                        onChange={(e) => {
                          const item = stockItems.find(i => i.material_name === e.target.value);
                          setScrapForm({
                            ...scrapForm,
                            itemName: e.target.value,
                            itemCode: item ? item.item_code : scrapForm.itemCode,
                            rate: item ? (item.selling_rate > 0 ? item.selling_rate : (item.valuation_rate || 0)) : scrapForm.rate
                          });
                        }}
                        subLabelField="subLabel"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Process Link (Component)</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={scrapForm.parentId}
                        onChange={(e) => setScrapForm({ ...scrapForm, parentId: e.target.value })}
                      >
                        <option value="">None (Top Level)</option>
                        {bomData.components.map(c => (
                          <option key={c.id} value={c.id}>{c.component_code || c.componentCode}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Input Qty</label>
                      <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0.00" step="0.01" value={scrapForm.inputQty} onChange={(e) => setScrapForm({ ...scrapForm, inputQty: e.target.value })} />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Loss %</label>
                      <input type="number" className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0" step="0.01" value={scrapForm.lossPercent} onChange={(e) => setScrapForm({ ...scrapForm, lossPercent: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Recovery Rate (₹)</label>
                      <div className="flex gap-2">
                        <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0.00" step="0.01" value={scrapForm.rate} onChange={(e) => setScrapForm({ ...scrapForm, rate: e.target.value })} />
                        <button
                          onClick={() => handleAddSectionItem('scrap', scrapForm, setScrapForm, { itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '', parentId: '' })}
                          className="px-3 bg-orange-600 text-white rounded-lg text-xs  hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all active:scale-95"
                          title="Add Scrap"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {bomData.scrap.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px]  text-slate-400 ">Scrap Item</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Input Qty</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Loss %</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Scrap Qty</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Rate (₹)</th>
                        <th className="px-4 py-3 text-center text-[10px]  text-slate-400 ">Total Value</th>
                        {!isReadOnly && <th className="px-4 py-3 text-right text-[10px]  text-slate-400 ">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomData.scrap.map((s) => {
                        const stockItem = stockItems.find(i => i.item_code === s.item_code);
                        const inputQty = parseFloat(s.input_qty || 0);
                        const lossPercent = parseFloat(s.loss_percent || 0);
                        const rate = parseFloat(s.rate || 0);
                        const scrapQty = inputQty * (lossPercent / 100);
                        const scrapAmount = scrapQty * rate;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-xs  text-slate-800">{s.item_name || 'N/A'}</span>
                                <span className="text-[9px] text-slate-400   tracking-tight">
                                  {s.item_code} {s.parent_id || s.parentId ? `[Ref: Component]` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-xs  text-slate-600">{inputQty.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px]  bg-orange-50 text-orange-600 border border-orange-100">
                                {lossPercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-xs  text-slate-900">{scrapQty.toFixed(3)}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-xs  text-slate-600">₹{rate.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className="text-xs  text-rose-600">
                                - ₹{scrapAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            {!isReadOnly && (
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteSectionItem('scrap', s.id, s.isLocal)}
                                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  title="Remove Scrap"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-orange-50/30">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-orange-300 mb-3 shadow-sm border border-orange-50">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-xs  text-orange-400 ">No scrap or loss recorded</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {bomData.scrap.length > 0 && (
          <div className="mt-4 overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Item / Code</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Parent</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Input Qty</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Loss %</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Scrap Qty</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs  text-slate-500  tracking-wider">Scrap Value</th>
                  {!isReadOnly && <th className="px-4 py-3 text-right text-xs  text-slate-500  tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bomData.scrap.map((s) => {
                  const stockItem = stockItems.find(i => i.item_code === s.item_code);
                  const inputQty = parseFloat(s.input_qty || 0);
                  const lossPercent = parseFloat(s.loss_percent || 0);
                  const rate = parseFloat(s.rate || 0);
                  const scrapQty = inputQty * (lossPercent / 100);
                  const scrapAmount = scrapQty * rate;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm  text-slate-800">{s.item_name || 'N/A'}</span>
                          <span className="text-[10px] text-slate-500  tracking-tight">{s.item_code || 'N/A'}</span>
                          {stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && (
                            <span className="inline-flex items-center mt-1 text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 w-fit">
                              📐 Drg: {stockItem.drawing_no}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.parent_id || s.parentId ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-700">
                              {bomData.components.find(c => String(c.id) === String(s.parent_id || s.parentId))?.component_code || 'Unknown'}
                            </span>
                            <span className="text-[9px] text-slate-400">Sub-Component Scrap</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Top Level</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-sm text-slate-600 font-medium">{inputQty.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px]  bg-orange-50 text-orange-600 border border-orange-100">
                          {lossPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-sm  text-slate-900">{scrapQty.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-sm text-slate-600">
                        ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="text-sm  text-rose-600">
                          ₹{scrapAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteSectionItem('scrap', s.id, s.isLocal)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove Scrap Item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 6: BOM Costing */}
      <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
        <div
          className="bg-white p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => toggleSection('costing')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">₹</div>
            <div>
              <h4 className="text-sm  text-slate-800">BOM Costing</h4>
              <p className="text-[10px] text-slate-400 font-medium ">₹{totalBOMCost.toFixed(2)} Analysis Per Unit</p>
            </div>
          </div>
          <div className="text-slate-400">{collapsedSections.costing ? '▼' : '▲'}</div>
        </div>
        {!collapsedSections.costing && (
          <div className="p-2  space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div className="p-4 bg-blue-50 rounded-md border border-blue-100">
                <p className="text-xs text-blue-600  mb-1">Material Cost / FG</p>
                <p className="text-2xl  text-blue-900">₹{materialCostAfterScrap.toFixed(2)}</p>
                <p className="text-[10px] text-blue-400 font-medium mt-1">(Materials + Components - Scrap)</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-md border border-purple-100">
                <p className="text-xs text-purple-600  mb-1">Operations Cost / FG</p>
                <p className="text-2xl  text-purple-900">₹{operationsCost.toFixed(2)}</p>
                <p className="text-[10px] text-purple-400 font-medium mt-1">Based on (Cycle + Setup) / 60 * Rate</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100">
                <p className="text-xs text-emerald-600  mb-1">Total Cost / FG</p>
                <p className="text-2xl  text-emerald-900">₹{totalBOMCost.toFixed(2)}</p>
                <p className="text-[10px] text-emerald-400 font-medium mt-1">Base Quantity: {batchQty}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-md overflow-hidden">
              <div className="divide-y divide-slate-50">
                <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-medium text-slate-600">Components Cost:</span>
                  <span className="text-xs  text-slate-900">₹{componentsCost.toFixed(2)}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-medium text-slate-600">Raw Materials Cost:</span>
                  <span className="text-xs  text-slate-900">₹{rawMaterialsCost.toFixed(2)}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors text-red-600">
                  <span className="text-xs font-medium">Scrap Loss (Deduction):</span>
                  <span className="text-xs ">-₹{scrapLoss.toFixed(2)}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center bg-blue-50/50">
                  <span className="text-xs  text-blue-700 ">Material Cost (after Scrap):</span>
                  <span className="text-xs  text-blue-900 ">₹{materialCostAfterScrap.toFixed(2)}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors text-purple-600">
                  <span className="text-xs font-medium">Operations Cost:</span>
                  <span className="text-xs  text-purple-900 ">₹{operationsCost.toFixed(2)}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center bg-amber-50/50">
                  <span className="text-xs  text-amber-700">Total Scrap Qty:</span>
                  <span className="text-xs  text-amber-900">{totalScrapQty.toFixed(2)} Kg</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center bg-slate-50  border-t border-slate-200">
                  <span className="text-xs text-slate-700">ORDER TOTAL ({batchQty} {productForm.uom}):</span>
                  <span className="text-sm text-slate-900">₹{(totalBOMCost * batchQty).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-900 rounded-md text-white">
              <span className="text-sm   ">Cost Per Unit:</span>
              <span className="text-xl ">₹{costPerUnit.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pb-8">
        <button onClick={() => navigate('/bom-creation')} className="px-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm  text-slate-600 hover:bg-slate-50 transition-all">
          {isReadOnly ? 'Back to List' : 'Cancel'}
        </button>
        {!isReadOnly && (
          <button onClick={handleCreateBOM} className="px-8 py-2.5 bg-orange-500 text-white rounded-lg text-sm  hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all flex items-center gap-2">
            {itemId && itemId !== 'bom-form' ? 'Update BOM' : 'Create BOM'}
          </button>
        )}
      </div>

      <DrawingPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div >
      
      );
};

export default BOMFormPage;

