import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, SearchableSelect, Button } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import {
  Eye,
  Trash2,
  Plus,
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Info,
  Save,
  ArrowLeft,
  History,
  Settings,
  Layers,
  Activity,
  Package,
  Clock,
  CornerDownRight,
  Loader2,
  RefreshCw,
  Edit2,
  Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const RecursiveBOMRow = ({
  item,
  level = 0,
  onRemove,
  onEdit,
  editingItem,
  setEditingItem,
  onUpdate,
  isReadOnly,
  childrenMap,
  type: providedType,
  inheritedLoss = 0,
  isComponentSection = false
}) => {
  // Determine if this item is a material or component if type not provided or to be sure
  const actualType = providedType || ((item.material_name || item.materialName) ? 'material' : 'component');

  const isConsumable = (item.item_group || item.itemGroup || '').toLowerCase().includes('consumable') ||
    (item.material_type || item.materialType || '').toLowerCase().includes('consumable') ||
    (item.material_name || item.materialName || '').toLowerCase().includes('consumable') ||
    (item.component_code || item.componentCode || '').toLowerCase().startsWith('con-') ||
    (item.item_group || item.itemGroup || '').toLowerCase() === 'consumables';

  const displayGroup = (() => {
    if (isConsumable) return 'Consumable';
    const groupVal = (item.item_group || item.itemGroup || item.material_type || '').trim();
    if (groupVal) {
      if (groupVal.toLowerCase() === 'part') return 'Part';
      if (groupVal.toLowerCase() === 'assembly') return 'Assembly';
      return groupVal.charAt(0).toUpperCase() + groupVal.slice(1).toLowerCase();
    }
    return getAutofetchedGroup(item);
  })();

  const children = childrenMap.get(String(item.id)) || [];

  const qty = parseFloat(
    actualType === 'material'
      ? (item.qty_per_pc ?? item.qtyPerPc ?? item.qty ?? item.quantity ?? 0)
      : (item.quantity ?? item.qty ?? 0)
  );
  const rate = parseFloat(item.rate ?? 0);
  const weightPerUnit = (actualType === 'material' || isConsumable) ? parseFloat(item.weight_per_unit ?? item.weightPerUnit ?? 0) : 0;
  const scrapPercent = (actualType === 'material' || isConsumable) ? parseFloat(item.scrap_percent ?? item.scrapPercent ?? 0) : 0;

  const unitWeight = weightPerUnit * (1 + (scrapPercent > 1 ? scrapPercent / 100 : scrapPercent));
  const totalWeight = qty * unitWeight;

  let baseCost = qty * rate;
  if ((actualType === 'material' || isConsumable) && weightPerUnit > 0) {
    // Total Cost = Total Weight * Rate
    baseCost = totalWeight * rate;
  }

  const itemLossPercent = actualType === 'component' ? parseFloat(item.loss_percent || item.lossPercent || 0) : 0;

  const currentLevelLossFactor = 1 - (inheritedLoss / 100);
  const itemLossFactor = 1 - (itemLossPercent / 100);
  const cumulativeLossFactor = currentLevelLossFactor * itemLossFactor;

  // This item's cost increased by its parent's loss (if any) AND its own loss
  const netCost = baseCost / cumulativeLossFactor;

  const isEditing = editingItem?.id === item.id;

  if (isComponentSection) {
    if (isEditing) {
      return (
        <tr className="bg-indigo-50/30">
          <td className="p-2" style={{ paddingLeft: `${level * 20}px` }}>
            <div className="flex items-center gap-2">
              {level > 0 && <CornerDownRight className="w-3 h-3 text-slate-300" />}
              <span className="text-xs  text-slate-800">
                {item.component_code || item.componentCode || item.material_name || item.materialName}
              </span>
            </div>
          </td>
          <td className="p-2 text-center text-xs text-slate-400">--</td>
          <td className="p-2">
            <input
              type="number"
              className="w-full p-1 text-xs border border-indigo-200 rounded"
              value={editingItem.qty}
              onChange={(e) => setEditingItem({ ...editingItem, qty: e.target.value })}
            />
          </td>
          <td className="p-2 text-center text-xs text-slate-400">--</td>
          <td className="p-2">
            <input
              type="number"
              className="w-full p-1 text-xs border border-indigo-200 rounded"
              value={editingItem.rate}
              onChange={(e) => setEditingItem({ ...editingItem, rate: e.target.value })}
            />
          </td>
          <td className="p-2 text-center text-xs text-slate-400">--</td>
          <td className="p-2 text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="success"
                size="xs"
                onClick={onUpdate}
                title="Save"
                icon={Check}
              />
              <Button
                variant="default"
                size="xs"
                onClick={() => setEditingItem(null)}
                title="Cancel"
                icon={X}
              />
            </div>
          </td>
        </tr>
      );
    }

    return (
      <>
        <tr className={`${level > 0 ? 'bg-slate-50/50' : 'bg-white'} border-b border-slate-100 hover:bg-blue-50/30 transition-colors group`}>
          <td className="p-2 ">
            <div className="flex items-center gap-2 " style={{ paddingLeft: `${level * 20}px` }}>
              {level > 0 && <CornerDownRight className="w-3 h-3 text-slate-300" />}
              <div className="flex flex-col">
                <span className="text-xs  text-slate-800 ">
                  {item.component_code || item.componentCode || item.material_name || item.materialName}
                </span>
                {(item.drawing_no || item.drawingNo) && (item.drawing_no || item.drawingNo) !== 'N/A' && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.drawing_no || item.drawingNo}
                  </span>
                )}
                {getDimensionString(item) && (
                  <span className="text-xs text-emerald-600 ">
                    {getDimensionString(item)}
                  </span>
                )}
                {item.description && (
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{cleanText(item.description)}</span>
                )}
              </div>
            </div>
          </td>
          <td className="p-2 text-center">
            <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 ">
              {displayGroup}
            </span>
          </td>
          <td className="p-2 text-center text-[11px]  text-slate-600">
            <div className="flex flex-col items-center">
              <span>{qty.toFixed(2)} {item.uom}</span>
              {unitWeight > 0 && (
                <span className="text-xs text-slate-400">({unitWeight.toFixed(3)} Kg)</span>
              )}
            </div>
          </td>
          <td className="p-2 text-center text-xs text-slate-600">
            {totalWeight > 0 ? `${(totalWeight / cumulativeLossFactor).toFixed(3)} Kg` : '—'}
          </td>
          <td className="p-2 text-center text-xs text-slate-600">₹{rate.toFixed(2)}</td>
          <td className="p-2 text-center text-xs text-slate-900 ">
            ₹{netCost.toFixed(2)}
          </td>
          {!isReadOnly && (
            <td className="p-2 text-right">
              <div className="flex justify-end gap-1  group-hover:opacity-100 transition-all">
                <button
                  onClick={() => onEdit(item)}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemove('components', item.id, item.isLocal)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          )}
        </tr>
        {children.map(child => (
          <RecursiveBOMRow
            key={`${(child.material_name || child.materialName) ? 'mat' : 'comp'}-${child.id}`}
            item={child}
            level={level + 1}
            onRemove={onRemove}
            onEdit={onEdit}
            editingItem={editingItem}
            setEditingItem={setEditingItem}
            onUpdate={onUpdate}
            isReadOnly={isReadOnly}
            childrenMap={childrenMap}
            isComponentSection={true}
            inheritedLoss={100 * (1 - cumulativeLossFactor)}
          />
        ))}
      </>
    );
  }

  if (isEditing) {
    return (
      <tr className="bg-indigo-50/30">
        <td className="p-2" style={{ paddingLeft: `${level * 20}px` }}>
          <div className="flex items-center gap-2">
            {level > 0 && <CornerDownRight className="w-3 h-3 text-slate-300" />}
            <span className="text-xs  text-slate-800">
              {item.item_code || item.itemCode || item.material_name || item.materialName}
            </span>
          </div>
        </td>
        <td className="p-2">
          <input
            type="number"
            className="w-full p-1 text-xs border border-indigo-200 rounded"
            value={editingItem.qty}
            onChange={(e) => setEditingItem({ ...editingItem, qty: e.target.value })}
          />
        </td>
        <td className="p-2 text-center text-xs text-slate-400">--</td>
        <td className="p-2">
          <input
            type="number"
            className="w-full p-1 text-xs border border-indigo-200 rounded"
            value={editingItem.rate}
            onChange={(e) => setEditingItem({ ...editingItem, rate: e.target.value })}
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            className="w-full p-1 text-xs border border-indigo-200 rounded"
            value={editingItem.warehouse}
            onChange={(e) => setEditingItem({ ...editingItem, warehouse: e.target.value })}
            placeholder="Warehouse"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            className="w-full p-1 text-xs border border-indigo-200 rounded"
            value={editingItem.operation}
            onChange={(e) => setEditingItem({ ...editingItem, operation: e.target.value })}
            placeholder="Operation"
          />
        </td>
        <td className="p-2 text-center text-xs text-slate-400">--</td>
        <td className="p-2 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={onUpdate}
              className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditingItem(null)}
              className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className={`${level > 0 ? 'bg-slate-50/50' : 'bg-white'} border-b border-slate-100 hover:bg-blue-50/30 transition-colors group`}>
        <td className="p-2 ">
          <div className="flex items-center gap-2 " style={{ paddingLeft: `${level * 20}px` }}>
            {level > 0 && <CornerDownRight className="w-3 h-3 text-slate-300" />}
            <div className="flex flex-col">
              <span className="text-xs  text-slate-800">
                {actualType === 'material' ? (item.item_code || item.itemCode || item.material_name || item.materialName) : (item.component_code || item.componentCode)}
              </span>
              {actualType === 'material' && getDimensionString(item) && (
                <span className="text-xs text-emerald-600 ">
                  {getDimensionString(item)}
                </span>
              )}
              {item.description && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">{cleanText(item.description)}</span>
              )}
            </div>
          </div>
        </td>
        <td className="p-2 text-center text-[11px]  text-slate-600">
          <div className="flex flex-col items-center">
            <span>{(qty / cumulativeLossFactor).toFixed(actualType === 'material' ? 4 : 2)} {item.uom}</span>
            {unitWeight > 0 && (
              <span className="text-xs text-slate-400">({unitWeight.toFixed(3)} Kg)</span>
            )}
          </div>
        </td>
        <td className="p-2 text-center text-xs text-slate-600">
          {totalWeight > 0 ? `${(totalWeight / cumulativeLossFactor).toFixed(3)} Kg` : '—'}
        </td>
        <td className="p-2  text-center text-xs text-slate-600">₹{rate.toFixed(2)}</td>
        <td className="p-2  text-center text-xs text-slate-600">
          {item.warehouse || '—'}
          {(item.item_group || item.itemGroup) && <div className="text-xs text-blue-500 ">{item.item_group || item.itemGroup}</div>}
        </td>
        <td className="p-2  text-center text-xs text-slate-600">
          {actualType === 'component' ? `${itemLossPercent.toFixed(2)}%` : (item.operation || '—')}
        </td>
        <td className="p-2  text-center text-xs  text-slate-900 ">
          ₹{netCost.toFixed(2)}
        </td>
        {!isReadOnly && (
          <td className="p-2  text-right">
            <div className="flex justify-end gap-1  group-hover:opacity-100 transition-all">
              <button
                onClick={() => onEdit(item)}
                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRemove(actualType === 'material' ? 'materials' : 'components', item.id, item.isLocal)}
                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        )}
      </tr>
      {children.map(child => (
        <RecursiveBOMRow
          key={`${(child.material_name || child.materialName) ? 'mat' : 'comp'}-${child.id}`}
          item={child}
          level={level + 1}
          onRemove={onRemove}
          onEdit={onEdit}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          onUpdate={onUpdate}
          isReadOnly={isReadOnly}
          childrenMap={childrenMap}
          inheritedLoss={100 * (1 - cumulativeLossFactor)}
        />
      ))}
    </>
  );
};

const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';

const getDimensionString = (item) => {
  if (!item) return '';
  const dimensions = [];
  if (item.length && parseFloat(item.length) > 0) dimensions.push(`${parseFloat(item.length)}`);
  if (item.width && parseFloat(item.width) > 0) dimensions.push(`${parseFloat(item.width)}`);
  if (item.thickness && parseFloat(item.thickness) > 0) dimensions.push(`${parseFloat(item.thickness)}`);
  if (item.diameter && parseFloat(item.diameter) > 0) dimensions.push(`Ø${parseFloat(item.diameter)}`);
  if (item.outer_diameter && parseFloat(item.outer_diameter) > 0) dimensions.push(`OD${parseFloat(item.outer_diameter)}`);

  if (dimensions.length === 0) return '';

  const unit = (item.uom === 'Kg' || !item.uom) ? 'mm' : item.uom;
  return `${dimensions.join(' × ')} ${unit}`;
};

const getAutofetchedGroup = (item) => {
  if (!item) return 'Part';

  // 1. Check item code / name / description prefixes and content (case-insensitive)
  const code = String(item.item_code || item.itemCode || item.component_code || item.componentCode || '').trim().toUpperCase();
  const desc = String(item.description || item.material_name || item.material_type || item.drawing_name || item.name || '').trim().toUpperCase();

  // If the item code explicitly starts with PART-, it is a Part (regardless of desc keywords like ASSY)
  if (code.startsWith('PART-')) {
    return 'Part';
  }

  if (code.startsWith('ASSEMBLY-') || code.startsWith('ASSY-') || code.startsWith('SA-') ||
    code.includes('ASSEMBLY') || code.includes('ASSY') ||
    desc.includes('ASSEMBLY') || desc.includes('ASSY')) {
    return 'Assembly';
  }

  // 2. Check drawing_type
  if (item.drawing_type) {
    const dt = String(item.drawing_type).trim().toLowerCase();
    if (dt.includes('assembly')) return 'Assembly';
    return 'Part';
  }
  // 3. Check item_type
  if (item.item_type) {
    const it = String(item.item_type).trim().toLowerCase();
    if (it.includes('assembly')) return 'Assembly';
    return 'Part';
  }
  // 4. Check item_group
  if (item.item_group || item.itemGroup) {
    const ig = String(item.item_group || item.itemGroup).trim().toLowerCase();
    if (ig.includes('assembly')) return 'Assembly';
    return 'Part';
  }
  return 'Part';
};

const BOMFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const isReadOnly = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('view') === 'true';
  }, [location.search]);

  const itemId = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    return (lastSegment && lastSegment !== 'bom-form') ? lastSegment : null;
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const selectedItemRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  const [workstations, setWorkstations] = useState([]);
  const [operationsList, setOperationsList] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [approvedBOMs, setApprovedBOMs] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
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
    itemGroup: 'Part',
    itemCode: '',
    drawingNo: '',
    drawing_id: '',
    uom: 'Kg',
    revision: '1',
    description: '',
    notes: '',
    isActive: true,
    isDefault: false,
    quantity: 1
  });

  const [materialForm, setMaterialForm] = useState({ materialName: '', itemCode: '', qty: '1', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', length: '', width: '', thickness: '', diameter: '', outer_diameter: '' });
  const [componentForm, setComponentForm] = useState({ componentCode: '', quantity: '1', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', itemGroup: '', length: '', width: '', thickness: '', diameter: '', outer_diameter: '' });
  const [operationForm, setOperationForm] = useState({ operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
  const [editingOperation, setEditingOperation] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingSectionItem, setEditingSectionItem] = useState(null); // { section: 'materials'|'components'|'operations'|'scrap', id: string|number }

  const [scrapForm, setScrapForm] = useState({ itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '', parentId: '' });
  const [approvedDrawings, setApprovedDrawings] = useState([]);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);
  const [bomHistory, setBomHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const hasAutoUpdated = useRef(false);

  // Cost Calculations
  const batchQty = parseFloat(productForm.quantity || 1);

  // Helper for recursive cost calculation
  const calculateRecursiveCost = useCallback((item, allItems) => {
    const isMaterial = !!(item.material_name || item.materialName);
    const itemGroup = (item.item_group || item.itemGroup || '').toLowerCase();
    const materialType = (item.material_type || item.materialType || '').toLowerCase();
    const materialName = (item.material_name || item.materialName || '').toLowerCase();

    const isConsumable = itemGroup.includes('consumable') ||
      materialType.includes('consumable') ||
      materialName.includes('consumable');

    const qty = parseFloat(isMaterial ? (item.qty_per_pc ?? item.qtyPerPc ?? item.qty ?? item.quantity ?? 0) : (item.quantity ?? item.qty ?? 0));
    const rate = parseFloat(item.rate ?? 0);
    const weightPerUnit = (isMaterial || isConsumable) ? parseFloat(item.weight_per_unit ?? item.weightPerUnit ?? 0) : 0;
    const scrapPercent = (isMaterial || isConsumable) ? parseFloat(item.scrap_percent ?? item.scrapPercent ?? 0) : 0;

    let baseItemCost = qty * rate;
    if ((isMaterial || isConsumable) && weightPerUnit > 0) {
      // Total Cost = Qty * WeightPerUnit * (1 + ScrapPercent) * Rate
      const sP = scrapPercent > 1 ? scrapPercent / 100 : scrapPercent;
      baseItemCost = qty * weightPerUnit * (1 + sP) * rate;
    }

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
    const input = parseFloat(s.input_qty || s.inputQty || 0);
    const loss = parseFloat(s.loss_percent || s.lossPercent || 0) / 100;
    const rate = parseFloat(s.rate || 0);
    return sum + (input * loss * rate);
  }, 0) / batchQty;

  const materialCostAfterScrap = ((componentsCost + rawMaterialsCost) / batchQty) - scrapLoss;

  const operationsCost = bomData.operations.reduce((sum, o) => {
    const hourlyRate = parseFloat(o.hourly_rate || o.hourlyRate || 0);
    const setupTime = parseFloat(o.setup_time_min || o.setupTimeMin || 0);
    const cycleTime = parseFloat(o.cycle_time_min || o.cycleTimeMin || 0);
    // Cost per unit: Cycle time + (Setup time / Batch Quantity)
    const setupPerUnit = batchQty > 0 ? (setupTime / batchQty) : 0;
    return sum + ((cycleTime + setupPerUnit) / 60 * hourlyRate);
  }, 0);

  const totalBOMCost = materialCostAfterScrap + operationsCost;
  const costPerUnit = totalBOMCost;
  const totalScrapQty = bomData.scrap.reduce((sum, s) => sum + (parseFloat(s.input_qty || s.inputQty || 0) * (parseFloat(s.loss_percent || s.lossPercent || 0) / 100)), 0) / batchQty;

  const fetchBOMHistory = useCallback(async (itemCode, drawingNo, currentItemId = null) => {
    const effectiveId = (currentItemId === 'bom-form' || !currentItemId) ? null : currentItemId;
    if (!itemCode && !drawingNo && !effectiveId) return;

    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = new URL(`${API_BASE}/bom/history`, window.location.origin);
      if (itemCode) url.searchParams.append('itemCode', itemCode);
      if (drawingNo) url.searchParams.append('drawingNo', drawingNo);
      if (effectiveId) url.searchParams.append('itemId', effectiveId);

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Sort history by version ASC
        const sortedData = (data || []).sort((a, b) => {
          const vA = parseInt(a.version || 0);
          const vB = parseInt(b.version || 0);
          return vA - vB;
        });
        setBomHistory(sortedData);
      }
    } catch (error) {
      console.error('Error fetching BOM history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

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
    if (isReadOnly) return [];
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
      .map(([no, name]) => ({ label: cleanText(name) || '', value: no, subLabel: no }))
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [approvedDrawings, stockItems, isReadOnly]);

  const componentOptions = useMemo(() => {
    if (isReadOnly) return [];
    const options = [];
    const seenCodes = new Set();
    const currentItemCode = selectedItem?.item_code || productForm.itemCode;
    const productDrawing = selectedItem?.drawing_no || productForm.drawingNo;

    // Helper to check if item is a component type (show ONLY Part and Consumables, NOT Assemblies)
    const isComponentType = (type, code = '', name = '') => {
      const t = (type || '').toLowerCase();
      const c = (code || '').toUpperCase();
      const n = (name || '').toLowerCase();

      // EXCLUDE assemblies, finished goods, and sub-assemblies
      if (c.startsWith('SA-') || c.startsWith('SFG-') || c.startsWith('FG-') || c.startsWith('ASSEMBLY-') || c.startsWith('ASSY-')) {
        return false;
      }
      if (t.includes('assembly') || t.includes('finished') || t.includes('sfg') || t.includes('sub')) {
        return false;
      }

      // Exclude raw materials, packaging, hardware, service, tooling
      if (t.includes('raw') || t.includes('material') || t.includes('pack') || 
          t.includes('tool') || t.includes('service') || t.includes('fastener')) {
        return false;
      }

      // Exclude nuts, bolts, screws, washers, rivets, cartons, tapes from Component Selection
      if (n.includes('nut') || n.includes('bolt') || n.includes('screw') || 
          n.includes('washer') || n.includes('rivet') || n.includes('gasket') ||
          n.includes('packing') || n.includes('carton') || n.includes('sticker') ||
          n.includes('tape') || n.includes('glue')) {
        return false;
      }

      // Include only Parts and Consumables
      return t.includes('part') || t.includes('consumable') || c.startsWith('PART-');
    };

    // 1. Add Stock Items
    stockItems.forEach(item => {
      const type = (item.material_type || item.item_group || "").toLowerCase();
      if (!isComponentType(type, item.item_code, item.material_name)) return;

      // Strict FG check by code prefix
      if (item.item_code && item.item_code.startsWith("FG-")) return;

      const isSA = (item.item_code || "").startsWith("SA-") || (item.item_code || "").startsWith("SFG-") || (item.item_code || "").startsWith("PART-") || type.includes("assembly") || type.includes("sub") || type.includes("semi") || type.includes("sfg") || type.includes("consumable") || type.includes("part");

      if (!showAllDrawings) {
        if (["Part", "FG"].includes(productForm.itemGroup) && !isSA) return;
      }

      if (currentItemCode && item.item_code === currentItemCode) return; // Skip self by code

      if (!seenCodes.has(item.item_code)) {
        // Find if this item has an approved BOM cost, prioritizing those with non-zero cost
        const matchingBOMs = approvedBOMs.filter(b => b.item_code === item.item_code);
        const parseVer = (v) => parseInt((v || '').toString().replace(/[^0-9]/g, '') || '0');
        const bomInfo = matchingBOMs.length > 0 ? matchingBOMs.sort((a, b) => parseVer(b.version || b.revision_no) - parseVer(a.version || a.revision_no))[0] : null;
        const bomCost = bomInfo ? (parseFloat(bomInfo.bom_cost) || 0) : 0;
        const dims = getDimensionString(item);

        options.push({
          label: `${item.item_code} – ${item.material_name}${bomCost > 0 ? ` (₹${bomCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}`,
          value: item.item_code,
          subLabel: `${dims ? `${dims}\n` : ''}${item.drawing_no && item.drawing_no !== 'N/A' ? `Drawing: ${item.drawing_no}${bomCost > 0 ? ` [BOM Cost: ₹${bomCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}]` : ''}` : `Stock Item${bomCost > 0 ? ` [BOM Cost: ₹${bomCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}]` : ''}`}`,
          rate: bomCost > 0 ? bomCost : (item.selling_rate > 0 ? item.selling_rate : (item.valuation_rate || 0)),
          uom: item.unit || 'Kg',
          description: item.material_name,
          weightPerUnit: item.weight_per_unit || 0,
          itemGroup: item.material_type || item.item_group || "",
          scrapPercent: item.scrap_percent || 0,
          length: item.length,
          width: item.width,
          thickness: item.thickness,
          diameter: item.diameter,
          outer_diameter: item.outer_diameter,
          drawingNo: item.drawing_no || 'N/A',
          drawing_no: item.drawing_no || 'N/A'
        });
        seenCodes.add(item.item_code);
      }
    });

    // 2. Add Approved Drawings (Sales Order Items)
    approvedDrawings.forEach(item => {
      const type = (item.item_group || "").toLowerCase();
      if (!isComponentType(type, item.item_code, item.description || item.material_name)) return;

      const isSA = (item.item_code || "").startsWith("SA-") || (item.item_code || "").startsWith("SFG-") || (item.item_code || "").startsWith("PART-") || type.includes("assembly") || type.includes("sub") || type.includes("semi") || type.includes("sfg") || type.includes("consumable") || type.includes("part");

      if (!isSA && !showAllDrawings) return;
      // Strict FG check
      if (item.item_code && item.item_code.startsWith("FG-")) {
        if (!showAllDrawings) return;
      }
      if (type.includes("finished")) {
        if (!showAllDrawings) return;
      }

      if (item.item_code === currentItemCode) return; // Skip self

      if (!showAllDrawings) {
        if (["Part", "FG"].includes(productForm.itemGroup) && !isSA) return;
      }

      if (!seenCodes.has(item.item_code)) {
        // Find if this item has an approved BOM cost, prioritizing code match then drawing match, and non-zero costs
        const matchingBOMs = approvedBOMs.filter(b => b.item_code === item.item_code || (b.drawing_no === item.drawing_no && b.drawing_no !== 'N/A'));
        const bomInfo = matchingBOMs.length > 0 ? matchingBOMs.sort((a, b) => {
          // Prioritize code match
          if (a.item_code === item.item_code && b.item_code !== item.item_code) return -1;
          if (b.item_code === item.item_code && a.item_code !== item.item_code) return 1;
          // Then prioritize cost
          const parseVer = (v) => parseInt((v || '').toString().replace(/[^0-9]/g, '') || '0');
          return parseVer(b.version || b.revision_no) - parseVer(a.version || a.revision_no);
        })[0] : null;

        const bomCost = (item.bom_cost && parseFloat(item.bom_cost) > 0) ? parseFloat(item.bom_cost) : (bomInfo ? (parseFloat(bomInfo.bom_cost) || 0) : 0);
        const dims = getDimensionString(item);

        options.push({
          label: `${item.item_code} – ${item.description || item.material_name}${bomCost > 0 ? ` (₹${bomCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}`,
          value: item.item_code,
          subLabel: `${dims ? `${dims}\n` : ''}Drawing: ${item.drawing_no} (Order Item)${bomCost > 0 ? ` [BOM Cost: ₹${bomCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}]` : ''}`,
          rate: bomCost > 0 ? bomCost : (item.rate || 0),
          uom: item.unit || 'Kg',
          description: item.description || item.material_name,
          weightPerUnit: item.weight_per_unit || 0,
          itemGroup: item.item_group || "",
          scrapPercent: item.scrap_percent || 0,
          length: item.length,
          width: item.width,
          thickness: item.thickness,
          diameter: item.diameter,
          outer_diameter: item.outer_diameter,
          drawingNo: item.drawing_no || 'N/A',
          drawing_no: item.drawing_no || 'N/A'
        });
        seenCodes.add(item.item_code);
      }
    });

    return options.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [stockItems, approvedDrawings, approvedBOMs, showAllDrawings, selectedItem, productForm.itemCode, productForm.drawingNo, productForm.itemGroup, isReadOnly]);

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

  const childrenMap = useMemo(() => {
    const map = new Map();
    const allItems = [...bomData.materials, ...bomData.components];
    allItems.forEach(item => {
      const parentId = String(item.parent_id || item.parentId || '');
      if (parentId && parentId !== 'null' && parentId !== 'undefined') {
        if (!map.has(parentId)) map.set(parentId, []);
        map.get(parentId).push(item);
      }
    });
    return map;
  }, [bomData.materials, bomData.components]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dwgParam = params.get('drawing_no');
    let dwgIdParam = params.get('drawing_id') === 'N/A' ? '' : params.get('drawing_id');
    const dwgNameParam = params.get('drawing_name');
    const itemCodeParam = params.get('itemCode');
    const itemIdParam = params.get('item_id');

    const handleInitialParams = async () => {
      // Resolve UUID to real database ID if necessary
      if (dwgIdParam && isNaN(Number(dwgIdParam))) {
        try {
          const token = localStorage.getItem('authToken');
          const res = await fetch(`${API_BASE}/secure-id/resolve?uuid=${dwgIdParam}&type=drawing`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            dwgIdParam = String(data.id);
          }
        } catch (e) {
          console.error('Error resolving drawing_id UUID in useEffect:', e);
        }
      }

      // Handle itemCode or drawing_no or item_id from URL
      if (stockItems.length > 0 || approvedDrawings.length > 0 || itemIdParam) {
        if (itemIdParam) {
          try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_BASE}/sales-orders/items/${itemIdParam}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const item = await response.json();
              if (item) {
                setSelectedItem(prev => prev || { ...item, source: 'order' });
                setProductForm(prev => ({
                  ...prev,
                  itemCode: item.item_code || prev.itemCode || '',
                  description: item.drawing_name || item.description || item.item_description || prev.description || '',
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
            setSelectedItem(prev => prev || { ...item, source: orderItem ? 'order' : 'stock' });
          }
        } else if (dwgParam && !itemId) {
          // For NEW BOM creation from a drawing, pre-fill drawing info
          // and also try to find and set the related product/item info

          let dwgName = dwgNameParam || '';
          let itemCode = '';
          let matchedItem = null;

          const dwgInfo = approvedDrawings.find(i => i.drawing_no === dwgParam) ||
            stockItems.find(i => i.drawing_no === dwgParam);

          if (dwgInfo) {
            matchedItem = dwgInfo;
            dwgName = dwgInfo.material_name || dwgInfo.description || dwgInfo.item_description || '';
            itemCode = dwgInfo.item_code || '';
            setSelectedItem(prev => prev || { ...dwgInfo, source: approvedDrawings.find(i => i.drawing_no === dwgParam) ? 'order' : 'stock' });
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
            description: cleanText(dwgName) || prev.description,
            itemCode: itemCode || prev.itemCode
          }));
        }
      }

      if (dwgParam) {
        setDrawingFilter(prev => prev || dwgParam);
      }
    };

    handleInitialParams();
  }, [location.search, approvedDrawings.length, stockItems.length, itemId, fetchDrawingName]);

  useEffect(() => {
    const effectiveId = (itemId === 'bom-form' || !itemId) ? null : itemId;
    const itemCode = productForm.itemCode;
    const drawingNo = productForm.drawingNo;

    if (itemCode || (drawingNo && drawingNo !== 'N/A') || effectiveId) {
      fetchBOMHistory(itemCode, drawingNo, effectiveId);
    } else {
      setBomHistory([]);
    }
  }, [productForm.itemCode, productForm.drawingNo, itemId, fetchBOMHistory]);

  const getItemGroupFromMaterialType = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'fg' || t === 'part') return 'PART';
    if (t.includes('finished') && !t.includes('semi')) return 'PART';
    if (t.includes('semi')) return 'PART';
    if (t.includes('sub assembly') || t.includes('sub-assembly') || t.includes('assembly')) return 'ASSEMBLY';
    // If it's a component or raw material being BOM'd, it's usually an Assembly
    return 'ASSEMBLY';
  };

  const getMaterialItemGroupFromType = (item) => {
    if (!item) return 'Raw Material';

    const name = (item.material_name || item.itemName || '').toLowerCase();
    const ig = (item.item_group || item.itemGroup || item.material_group || item.material_type || '').toLowerCase();
    const t = (item.material_type || item.materialType || '').toLowerCase();

    // Priority 1: Consumables
    if (name.includes('consumable') || ig.includes('consumable') || t.includes('consumable') ||
      name.includes('con-') || t.includes('con-') || name.includes('grease') ||
      name.includes('oil') || name.includes('lubricant') || name.includes('coolant')) return 'Consumables';

    // Priority 2: Assemblies
    if (name.includes('sub assembly') || name.includes('sub-assembly') || ig.includes('sub assembly') ||
      t.includes('sub assembly') || t.includes('sub-assembly') || name.startsWith('sa-') || name.startsWith('sfg-') ||
      name.includes('assembly') || ig.includes('assembly') || t.includes('assembly')) return 'ASSEMBLY';
    if (name.includes('sfg') || name.includes('semi') || ig.includes('sfg') || ig.includes('semi') ||
      t.includes('sfg') || t.includes('semi')) return 'ASSEMBLY';

    // Priority 3: Packing Material
    if (name.includes('packing') || ig.includes('packing') || t.includes('packing') ||
      name.includes('pm') || ig.includes('pm') || t.includes('pm') ||
      name.startsWith('pac-') || name.includes('box') || name.includes('carton') ||
      name.includes('label') || name.includes('tape') || name.includes('wrap')) return 'Packing Material';

    // Priority 4: Other groups
    if (name.includes('tool') || ig.includes('tool') || t.includes('tool')) return 'Hardware & Accessories';
    if (name.includes('scrap') || ig.includes('scrap') || t.includes('scrap')) return 'Scrap';
    if (name.includes('raw') || ig.includes('raw') || t.includes('raw') || name.startsWith('rm-')) return 'Raw Material';

    return 'Raw Material';
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fetchItemGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/item-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItemGroups(data);
      }
    } catch (error) {
      console.error('Failed to fetch item groups:', error);
    }
  }, []);

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      console.log(`[fetchData] Starting - itemId: ${itemId}, showLoading: ${showLoading}`);
      if (showLoading) {
        setLoading(true);
        // Reset BOM data to avoid stale data flash
        setBomData({ materials: [], components: [], operations: [], scrap: [] });
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      fetchItemGroups();

      let latestStockItems = [];
      let currentApprovedDrawings = [];

      // Skip foundational data if read-only and we have an ID
      const effectiveId = (itemId && itemId !== 'bom-form') ? itemId : null;
      const shouldSkipFoundational = isReadOnly && effectiveId;

      if (!shouldSkipFoundational) {
        // Fetch foundational data in parallel
        console.log('[fetchData] Fetching foundational data...');
        const [stockRes, bomsRes, dwgsRes] = await Promise.all([
          fetch(`${API_BASE}/stock/balance?includeAll=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE}/bom/approved`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE}/sales-orders/approved-drawings`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (stockRes.ok) {
          latestStockItems = await stockRes.json();
          setStockItems(latestStockItems);
        }

        if (bomsRes.ok) setApprovedBOMs(await bomsRes.json());

        if (dwgsRes.ok) {
          const drawingsData = await dwgsRes.json();
          currentApprovedDrawings = drawingsData.flatMap(order => (order.items || []).map(item => ({
            ...item,
            company_name: order.company_name,
            po_number: order.po_number
          })));
          setApprovedDrawings(currentApprovedDrawings);
        }
      }

      const params = new URLSearchParams(location.search);
      const itemCodeFromUrl = params.get('itemCode');
      const drawingNoFromUrl = params.get('drawing_no');
      let drawingIdFromUrl = params.get('drawing_id') === 'N/A' ? '' : params.get('drawing_id');
      let salesOrderIdFromUrl = params.get('sales_order_id');

      // Resolve UUIDs to real database IDs if necessary
      if (salesOrderIdFromUrl && isNaN(Number(salesOrderIdFromUrl))) {
        try {
          const res = await fetch(`${API_BASE}/secure-id/resolve?uuid=${salesOrderIdFromUrl}&type=sales_order`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            salesOrderIdFromUrl = String(data.id);
          }
        } catch (e) {
          console.error('Error resolving sales_order_id UUID:', e);
        }
      }

      if (drawingIdFromUrl && isNaN(Number(drawingIdFromUrl))) {
        try {
          const res = await fetch(`${API_BASE}/secure-id/resolve?uuid=${drawingIdFromUrl}&type=drawing`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            drawingIdFromUrl = String(data.id);
          }
        } catch (e) {
          console.error('Error resolving drawing_id UUID:', e);
        }
      }

      if (effectiveId || itemCodeFromUrl || drawingNoFromUrl) {
        let currentItem = selectedItemRef.current;

        // 1. Auto-link drawing to Sales Order Item if needed
        if (!effectiveId && drawingNoFromUrl && salesOrderIdFromUrl && currentApprovedDrawings.length > 0) {
          const matchedItem = currentApprovedDrawings.find(d =>
            String(d.drawing_no) === String(drawingNoFromUrl) &&
            String(d.sales_order_id) === String(salesOrderIdFromUrl)
          );
          if (matchedItem) {
            console.log(`[fetchData] Auto-linked drawing to item ID: ${matchedItem.id}`);
            currentItem = { ...matchedItem, source: 'order' };
            setSelectedItem(currentItem);
          }
        }

        // 2. Fetch Item Info if we have an ID but no data
        if (effectiveId && (!currentItem || String(currentItem.id) !== String(effectiveId))) {
          console.log(`[fetchData] Fetching sales order item: ${effectiveId}`);
          const itemRes = await fetch(`${API_BASE}/sales-orders/items/${effectiveId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (itemRes.ok) {
            const itemData = await itemRes.json();
            currentItem = { ...itemData, source: 'order' };
            setSelectedItem(currentItem);

            setProductForm(prev => ({
              ...prev,
              itemCode: itemData.item_code || prev.itemCode,
              drawingNo: itemData.drawing_no || prev.drawingNo,
              drawing_id: itemData.drawing_id || drawingIdFromUrl || prev.drawing_id,
              description: itemData.drawing_name || itemData.description || prev.description,
              uom: itemData.unit || itemData.uom || prev.uom,
              revision: itemData.revision_no || itemData.revision || prev.revision,
              quantity: itemData.quantity || prev.quantity,
              bom_cost: itemData.bom_cost
            }));
          }
        }

        // 3. Fetch BOM structure
        const itemCodeParam = itemCodeFromUrl || currentItem?.item_code || productForm.itemCode;
        const drawingNoParam = drawingNoFromUrl || currentItem?.drawing_no || productForm.drawingNo;

        let bomUrl = `${API_BASE}/bom/items/${effectiveId || 'null'}`;
        const qp = [];
        if (itemCodeParam) qp.push(`itemCode=${encodeURIComponent(itemCodeParam)}`);
        if (drawingNoParam && drawingNoParam !== 'N/A') qp.push(`drawingNo=${encodeURIComponent(drawingNoParam)}`);
        if (qp.length > 0) bomUrl += `?${qp.join('&')}`;

        console.log(`[fetchData] Fetching BOM items: ${bomUrl}`);
        const bomRes = await fetch(bomUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (bomRes.ok) {
          const data = await bomRes.json();
          console.log(`[fetchData] BOM items loaded: ${data.materials?.length || 0} mat, ${data.components?.length || 0} comp`);

          if (data.materials) {
            data.materials = data.materials.map(m => {
              // Only override with latest stock rates if it's a new/draft BOM (not read-only with an ID)
              const isHistorical = isReadOnly && itemId && itemId !== 'bom-form';
              const s = latestStockItems.length > 0 ? latestStockItems.find(si => si.material_name === m.material_name) : null;

              let rate = m.rate;
              // For historical versions, we MUST trust the saved rate. 
              // Only fallback for non-historical drafts that have 0 rate.
              if (!isHistorical && (!m.rate || parseFloat(m.rate) === 0)) {
                rate = m.selling_rate || m.valuation_rate || s?.selling_rate || s?.valuation_rate || 0;
              }

              // Use stored weights/dimensions if available, especially for historical integrity
              return {
                ...m,
                drawingNo: m.drawing_no || m.drawingNo || s?.drawing_no || 'N/A',
                drawing_no: m.drawing_no || m.drawingNo || s?.drawing_no || 'N/A',
                rate: parseFloat(rate || 0),
                item_code: m.item_code || s?.item_code,
                weight_per_unit: (isHistorical && parseFloat(m.weight_per_unit) > 0) ? m.weight_per_unit : (m.weight_per_unit || s?.weight_per_unit || 0),
                length: (isHistorical && parseFloat(m.length) > 0) ? m.length : (m.length || s?.length),
                width: (isHistorical && parseFloat(m.width) > 0) ? m.width : (m.width || s?.width),
                thickness: (isHistorical && parseFloat(m.thickness) > 0) ? m.thickness : (m.thickness || s?.thickness),
                diameter: (isHistorical && parseFloat(m.diameter) > 0) ? m.diameter : (m.diameter || s?.diameter),
                outer_diameter: (isHistorical && parseFloat(m.outer_diameter) > 0) ? m.outer_diameter : (m.outer_diameter || s?.outer_diameter)
              };
            });
          }
          if (data.components) {
            data.components = data.components.map(c => {
              const isHistorical = isReadOnly && itemId && itemId !== 'bom-form';
              const s = latestStockItems.length > 0 ? latestStockItems.find(si => si.item_code === c.component_code) : null;

              let rate = c.rate;
              if (!isHistorical && (!c.rate || parseFloat(c.rate) === 0)) {
                rate = c.selling_rate || c.valuation_rate || s?.selling_rate || s?.valuation_rate || 0;
              }

              return {
                ...c,
                drawingNo: c.drawing_no || c.drawingNo || s?.drawing_no || 'N/A',
                drawing_no: c.drawing_no || c.drawingNo || s?.drawing_no || 'N/A',
                rate: parseFloat(rate || 0),
                weight_per_unit: (isHistorical && parseFloat(c.weight_per_unit) > 0) ? c.weight_per_unit : (c.weight_per_unit || s?.weight_per_unit || 0),
                length: (isHistorical && parseFloat(c.length) > 0) ? c.length : (c.length || s?.length || 0),
                width: (isHistorical && parseFloat(c.width) > 0) ? c.width : (c.width || s?.width || 0),
                thickness: (isHistorical && parseFloat(c.thickness) > 0) ? c.thickness : (c.thickness || s?.thickness || 0),
                diameter: (isHistorical && parseFloat(c.diameter) > 0) ? c.diameter : (c.diameter || s?.diameter || 0),
                outer_diameter: (isHistorical && parseFloat(c.outer_diameter) > 0) ? c.outer_diameter : (c.outer_diameter || s?.outer_diameter || 0)
              };
            });
          }

          setBomData(data);
        }
      }

      // Fetch Workstations & Operations List ONLY if not read-only
      if (!isReadOnly) {
        const [wsRes, opsRes] = await Promise.all([
          fetch(`${API_BASE}/workstations`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE}/operations`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (wsRes.ok) setWorkstations(await wsRes.json());
        if (opsRes.ok) setOperationsList(await opsRes.json());
      }

    } catch (error) {
      console.error('[fetchData] Error:', error);
      errorToast(error.message);
    } finally {
      if (showLoading) setLoading(false);
      console.log('[fetchData] Finished');
    }
  }, [itemId, location.search]);

  useEffect(() => {
    // Show loading when itemId changes to avoid showing stale data
    fetchData(true);
  }, [itemId, fetchData]);

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
        itemGroup: getAutofetchedGroup(selectedItem) || prev.itemGroup,
        drawingNo: (selectedItem.drawing_no && selectedItem.drawing_no !== 'N/A') ? selectedItem.drawing_no : (prev.drawingNo || ''),
        drawing_id: (selectedItem.drawing_id && selectedItem.drawing_id !== 'N/A') ? selectedItem.drawing_id : (prev.drawing_id || ''),
        quantity: selectedItem.quantity || prev.quantity,
        uom: selectedItem.unit || selectedItem.uom || prev.uom,
        revision: selectedItem.revision_no || selectedItem.revision || prev.revision,
        bom_cost: selectedItem.bom_cost || 0
      }));
    }
  }, [selectedItem]);

  const handleAddSectionItem = async (section, formData, setFormState, initialForm) => {
    try {
      const effectiveItemId = (itemId && itemId !== 'bom-form')
        ? itemId
        : (selectedItem?.source === 'order' ? selectedItem?.id : null);

      if (!effectiveItemId && !productForm.drawingNo && !productForm.itemCode) {
        throw new Error('Please select a Product/Item or Drawing first before adding details.');
      }

      const token = localStorage.getItem('authToken');
      const payload = { ...formData };
      payload.parent_id = payload.parentId || null;
      payload.itemCode = formData.itemCode || selectedItem?.item_code || productForm.itemCode;
      payload.drawingNo = (section === 'components' || section === 'materials' || section === 'scrap') ? (formData.drawingNo || formData.drawing_no || 'N/A') : (selectedItem?.drawing_no || productForm.drawingNo);
      payload.drawing_no = payload.drawingNo;

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
        payload.weight_per_unit = parseFloat(formData.weightPerUnit) || 0;
        payload.scrap_percent = parseFloat(formData.scrapPercent) || 0;
        payload.materialType = 'Raw Material';
        payload.materialName = payload.materialName;
        payload.itemGroup = payload.itemGroup;
        payload.rate = parseFloat(payload.rate) || 0;
        delete payload.qty;
        delete payload.weightPerUnit;
        delete payload.scrapPercent;
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
        payload.item_group = payload.itemGroup;
        payload.weight_per_unit = parseFloat(payload.weightPerUnit) || 0;
        payload.scrap_percent = parseFloat(payload.scrapPercent) || 0;
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

      // Always use local state update for BOM items while editing
      // to avoid corrupting the original version until the user clicks "Save" or "Save as New Version"
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

      setFormState(initialForm);
      successToast(`${section} added to list (click Save to persist)`);
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleUpdateSectionItem = async (section, formData, setFormState, initialForm) => {
    try {
      const token = localStorage.getItem('authToken');
      const payload = { ...formData };
      const editingId = editingSectionItem?.id;

      if (!editingId) throw new Error('No item selected for update');

      // Common transformations
      if (section === 'materials') {
        payload.qtyPerPc = parseFloat(formData.qty) || 0;
        payload.qty_per_pc = payload.qtyPerPc;
        payload.rate = parseFloat(payload.rate) || 0;
        payload.weight_per_unit = parseFloat(formData.weightPerUnit) || 0;
        payload.scrap_percent = parseFloat(formData.scrapPercent) || 0;
        payload.materialName = payload.materialName;
        payload.itemGroup = payload.itemGroup;
        payload.drawingNo = formData.drawingNo || formData.drawing_no || 'N/A';
        payload.drawing_no = payload.drawingNo;
      } else if (section === 'components') {
        payload.component_code = payload.componentCode;
        payload.quantity = parseFloat(payload.quantity) || 0;
        payload.rate = parseFloat(payload.rate) || 0;
        payload.loss_percent = parseFloat(payload.lossPercent) || 0;
        payload.weight_per_unit = parseFloat(formData.weightPerUnit) || 0;
        payload.scrap_percent = parseFloat(formData.scrapPercent) || 0;
        payload.item_group = payload.itemGroup;
        payload.drawingNo = formData.drawingNo || formData.drawing_no || 'N/A';
        payload.drawing_no = payload.drawingNo;
      } else if (section === 'operations') {
        payload.operation_name = payload.operationName;
        payload.cycle_time_min = parseFloat(payload.cycleTimeMin) || 0;
        payload.setup_time_min = parseFloat(payload.setupTimeMin) || 0;
        payload.hourly_rate = parseFloat(payload.hourlyRate) || 0;
        payload.operation_type = payload.operationType;
        payload.target_warehouse = payload.targetWarehouse;
      } else if (section === 'scrap') {
        payload.scrap_item_code = payload.itemCode;
        payload.item_name = payload.itemName;
        payload.input_qty = parseFloat(payload.inputQty) || 0;
        payload.loss_percent = parseFloat(payload.lossPercent) || 0;
        payload.rate = parseFloat(payload.rate) || 0;
      }

      // Always use local state update for BOM items while editing
      // to avoid corrupting the original version until the user clicks "Save" or "Save as New Version"
      setBomData(prev => ({
        ...prev,
        [section]: prev[section].map(item => item.id === editingId ? { ...item, ...payload } : item)
      }));

      setEditingSectionItem(null);
      setFormState(initialForm);
      successToast(`${section} updated in list (click Save to persist)`);
    } catch (error) {
      errorToast(error.message);
    }
  };


  const handleDeleteSectionItem = async (section, id, isLocal = false) => {
    try {
      // Always use local state update for BOM items while editing
      // to avoid corrupting the original version until the user clicks "Save" or "Save as New Version"
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
      successToast(`${section} removed from list (click Save to persist)`);
    } catch (error) {
      errorToast(error.message);
    }
  };

  const resetForm = () => {
    setProductForm({
      itemGroup: 'Part',
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
    setMaterialForm({ materialName: '', qty: '1', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '' });
    setComponentForm({ componentCode: '', quantity: '1', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '' });
    setOperationForm({ operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
    setScrapForm({ itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '' });
  };

  const handleStartEditSectionItem = (section, item) => {
    setEditingSectionItem({ section, id: item.id });

    // Prefill form
    if (section === 'materials') {
      setMaterialForm({
        materialName: item.material_name || item.materialName || '',
        itemCode: item.item_code || item.itemCode || '',
        qty: item.qty_per_pc || item.qtyPerPc || item.qty || item.quantity || '0',
        uom: item.uom || 'Kg',
        itemGroup: item.item_group || item.itemGroup || 'Raw Material',
        rate: item.rate || '0',
        warehouse: item.warehouse || '',
        operation: item.operation || '',
        parentId: item.parent_id || item.parentId || '',
        description: item.description || '',
        weightPerUnit: item.weight_per_unit || item.weightPerUnit || '',
        scrapPercent: item.scrap_percent || item.scrapPercent || '0',
        length: item.length || '',
        width: item.width || '',
        thickness: item.thickness || '',
        diameter: item.diameter || '',
        outer_diameter: item.outer_diameter || ''
      });
      // Ensure section is expanded
      setCollapsedSections(prev => ({ ...prev, materials: false }));
    } else if (section === 'components') {
      setComponentForm({
        componentCode: item.component_code || item.componentCode || '',
        quantity: item.quantity || item.qty || '0',
        uom: item.uom || 'Kg',
        rate: item.rate || '0',
        lossPercent: item.loss_percent || item.lossPercent || '0',
        notes: item.notes || '',
        parentId: item.parent_id || item.parentId || '',
        description: item.description || '',
        weightPerUnit: item.weight_per_unit || item.weightPerUnit || '',
        scrapPercent: item.scrap_percent || item.scrapPercent || '0',
        itemGroup: item.item_group || item.itemGroup || '',
        length: item.length || '',
        width: item.width || '',
        thickness: item.thickness || '',
        diameter: item.diameter || '',
        outer_diameter: item.outer_diameter || ''
      });
      setCollapsedSections(prev => ({ ...prev, components: false }));
    } else if (section === 'operations') {
      setOperationForm({
        operationName: item.operation_name || item.operationName || '',
        workstation: item.workstation || '',
        cycleTimeMin: item.cycle_time_min || item.cycleTimeMin || '0',
        setupTimeMin: item.setup_time_min || item.setupTimeMin || '0',
        hourlyRate: item.hourly_rate || item.hourlyRate || '0',
        operationType: item.operation_type || item.operationType || 'In-House',
        targetWarehouse: item.target_warehouse || item.targetWarehouse || ''
      });
      setCollapsedSections(prev => ({ ...prev, operations: false }));
    } else if (section === 'scrap') {
      setScrapForm({
        itemCode: item.item_code || item.itemCode || '',
        itemName: item.item_name || item.itemName || '',
        inputQty: item.input_qty || item.inputQty || '0',
        lossPercent: item.loss_percent || item.lossPercent || '0',
        rate: item.rate || '0',
        parentId: item.parent_id || item.parentId || ''
      });
      setCollapsedSections(prev => ({ ...prev, scrap: false }));
    }
  };

  const handleCancelEditSectionItem = (section) => {
    setEditingSectionItem(null);
    if (section === 'materials') {
      setMaterialForm({ materialName: '', itemCode: '', qty: '1', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', length: '', width: '', thickness: '', diameter: '', outer_diameter: '' });
    } else if (section === 'components') {
      setComponentForm({ componentCode: '', quantity: '1', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', itemGroup: '', length: '', width: '', thickness: '', diameter: '', outer_diameter: '' });
    } else if (section === 'operations') {
      setOperationForm({ operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
    } else if (section === 'scrap') {
      setScrapForm({ itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '', parentId: '' });
    }
  };


  const handleEditOperation = (operation) => {
    setEditingOperation({
      ...operation,
      operationName: operation.operation_name || operation.operationName,
      workstation: operation.workstation,
      cycleTimeMin: operation.cycle_time_min || operation.cycleTimeMin,
      setupTimeMin: operation.setup_time_min || operation.setupTimeMin,
      hourlyRate: operation.hourly_rate || operation.hourlyRate,
      operationType: operation.operation_type || operation.operationType,
      targetWarehouse: operation.target_warehouse || operation.targetWarehouse
    });
  };

  const handleUpdateOperation = async () => {
    try {
      if (!editingOperation.operationName || editingOperation.hourlyRate === '') {
        throw new Error('Operation Name and Hourly Rate are required');
      }

      const token = localStorage.getItem('authToken');
      const payload = {
        operation_name: editingOperation.operationName,
        workstation: editingOperation.workstation,
        cycle_time_min: parseFloat(editingOperation.cycleTimeMin) || 0,
        setup_time_min: parseFloat(editingOperation.setupTimeMin) || 0,
        hourly_rate: parseFloat(editingOperation.hourlyRate) || 0,
        operation_type: editingOperation.operationType,
        target_warehouse: editingOperation.targetWarehouse
      };

      if (editingOperation.isLocal || (!itemId || itemId === 'bom-form')) {
        setBomData(prev => ({
          ...prev,
          operations: prev.operations.map(o => o.id === editingOperation.id ? { ...o, ...payload } : o)
        }));
      } else {
        const response = await fetch(`${API_BASE}/bom/operations/${editingOperation.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to update operation');

        setBomData(prev => ({
          ...prev,
          operations: prev.operations.map(o => o.id === editingOperation.id ? { ...o, ...payload } : o)
        }));
      }

      setEditingOperation(null);
      successToast('Operation updated successfully');
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleEditMaterial = (item) => {
    setEditingMaterial({
      ...item,
      qty: item.qty_per_pc || item.qtyPerPc || item.qty || item.quantity || 0,
      rate: item.rate || 0,
      warehouse: item.warehouse || '',
      operation: item.operation || '',
      description: item.description || ''
    });
  };

  const handleUpdateMaterial = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        material_name: editingMaterial.material_name || editingMaterial.materialName,
        material_type: editingMaterial.material_type || editingMaterial.materialType,
        item_group: editingMaterial.item_group || editingMaterial.itemGroup,
        qty_per_pc: parseFloat(editingMaterial.qty) || 0,
        uom: editingMaterial.uom,
        rate: parseFloat(editingMaterial.rate) || 0,
        warehouse: editingMaterial.warehouse,
        operation: editingMaterial.operation,
        description: editingMaterial.description,
        weight_per_unit: parseFloat(editingMaterial.weight_per_unit || editingMaterial.weightPerUnit) || 0,
        scrap_percent: parseFloat(editingMaterial.scrap_percent || editingMaterial.scrapPercent) || 0
      };

      if (editingMaterial.isLocal || (!itemId || itemId === 'bom-form')) {
        setBomData(prev => ({
          ...prev,
          materials: prev.materials.map(m => m.id === editingMaterial.id ? { ...m, ...payload } : m)
        }));
      } else {
        const response = await fetch(`${API_BASE}/bom/materials/${editingMaterial.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to update material');

        setBomData(prev => ({
          ...prev,
          materials: prev.materials.map(m => m.id === editingMaterial.id ? { ...m, ...payload } : m)
        }));
      }

      setEditingMaterial(null);
      successToast('Material updated successfully');
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleCreateBOM = async (status = 'Active', isNewVersion = false, silent = false) => {
    try {
      const isDraft = status === 'Draft';

      if (!isDraft) {
        if (!selectedItem?.id && !productForm.drawingNo && !productForm.itemCode) {
          throw new Error('Product/Item or Drawing not selected');
        }
        if (!productForm.quantity || productForm.quantity <= 0) {
          throw new Error('Quantity must be greater than 0');
        }
        if (bomData.materials.length === 0 && bomData.components.length === 0) {
          throw new Error('At least one raw material or sub-assembly component is required');
        }
      } else {
        // Relaxed validation for draft
        if (!selectedItem?.id && !productForm.drawingNo && !productForm.description) {
          throw new Error('Provide a name or select a drawing to save as draft');
        }
      }

      // Determine version number
      let nextRevision = productForm.revision;
      if (isNewVersion) {
        // If there is no history at all, the "new version" should still be V1
        if (bomHistory.length === 0) {
          nextRevision = '1';
        } else {
          // Find highest version in history or current revision
          const currentRev = parseInt(productForm.revision || 0);
          const maxHistoryVersion = bomHistory.reduce((max, item) => {
            const v = parseInt(item.version || 0);
            return v > max ? v : max;
          }, 0);
          const maxVersion = Math.max(currentRev, maxHistoryVersion);
          nextRevision = (maxVersion + 1).toString();
        }
      }

      const effectiveItemId = (itemId && itemId !== 'bom-form')
        ? itemId
        : (selectedItem?.source === 'order' ? selectedItem?.id : null);

      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams(location.search);
      const salesOrderIdFromUrl = params.get('sales_order_id');

      const bomPayload = {
        itemId: effectiveItemId,
        bomId: selectedItem?.bom_id || selectedItem?.bomId || productForm.bomId || productForm.bom_id,
        isNewVersion,
        salesOrderId: salesOrderIdFromUrl || (selectedItem?.source === 'order' ? (selectedItem.sales_order_id || selectedItem.salesOrderId) : null),
        status: status,
        parentDrawingNo: params.get('drawing_no') || null,
        productForm: {
          ...productForm,
          revision: nextRevision
        },
        materials: bomData.materials.map(m => ({
          ...m,
          drawingNo: m.drawingNo || m.drawing_no || 'N/A',
          drawing_no: m.drawing_no || m.drawingNo || 'N/A'
        })),
        components: bomData.components.map(c => ({
          ...c,
          drawingNo: c.drawingNo || c.drawing_no || 'N/A',
          drawing_no: c.drawing_no || c.drawingNo || 'N/A',
          sourceFg: ((c.componentCode || '').startsWith('SA-') || (c.componentCode || '').startsWith('SFG-')) ? productForm.drawingNo : null
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

      const responseData = await response.json();
      const newId = responseData.id;

      if (!silent) {
        successToast(isDraft ? 'BOM saved as draft' : (isNewVersion ? `BOM Revision V${nextRevision} created successfully` : 'BOM created successfully'));
      }

      // Auto-update quotation and refresh history
      const targetUpdateId = isNewVersion ? newId : effectiveItemId;
      if (!isDraft && targetUpdateId) {
        try {
          await fetch(`${API_BASE}/quotation-requests/update-from-bom`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ salesOrderItemId: targetUpdateId, bomCost: totalBOMCost })
          });
        } catch (e) {
          console.error('Failed to auto-update quotation:', e);
        }

        // Refresh history to show updated cost in sidebar
        fetchBOMHistory(productForm.itemCode, productForm.drawingNo, targetUpdateId);

        // Also update local state for immediate feedback
        setProductForm(prev => ({ ...prev, bom_cost: totalBOMCost }));

        if (!isNewVersion) {
          setBomHistory(prev => {
            const newHistory = [...prev];
            // Find the version we're currently viewing to update its cost in history sidebar
            const currentViewingId = itemId || effectiveItemId;
            const idx = newHistory.findIndex(v => String(v.id) === String(currentViewingId));

            if (idx !== -1) {
              newHistory[idx] = { ...newHistory[idx], total_cost: totalBOMCost };
            } else if (newHistory.length > 0) {
              // Fallback: Update the last one (usually Current) if ID match fails
              const lastIdx = newHistory.length - 1;
              newHistory[lastIdx] = { ...newHistory[lastIdx], total_cost: totalBOMCost };
            }
            return newHistory;
          });
        }

        // Refresh all data from server to ensure sync
        fetchData(false);

        // Auto-trigger Quotation Update Request for FG items (Auto-click simulation)
        const groupG = (productForm.itemGroup || "").toUpperCase();
        const isFGItem = groupG.includes("FG") || groupG.includes("FINISHED") || groupG.includes("GOOD");
        if (isFGItem) {
          handleUpdateQuotation(targetUpdateId, totalBOMCost, true);
        }
      }

      // Instead of resetting and navigating to list, stay on the page in view mode
      if (newId) {
        navigate(`/bom-form/${newId}?view=true`);
      } else if (itemId && itemId !== 'bom-form' && !isNewVersion) {
        navigate(`/bom-form/${itemId}?view=true`);
      } else if (selectedItem) {
        const targetId = selectedItem.source === 'order' ? selectedItem.id : 'bom-form';
        const queryParams = selectedItem.source === 'stock'
          ? `?itemCode=${encodeURIComponent(selectedItem.item_code || selectedItem.itemCode)}&view=true`
          : '?view=true';
        navigate(`/bom-form/${targetId}${queryParams}`);
      } else {
        navigate(`${deptPrefix}/bom-creation`);
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleUpdateQuotation = async (salesOrderItemId, bomCost, skipConfirm = false) => {
    try {
      if (!skipConfirm) {
        const result = await Swal.fire({
          title: 'Request Quotation Update?',
          text: `Would you like to send a request to the Sales team to update all linked quotations with the latest BOM cost of ₹${parseFloat(bomCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, Send Request',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#4f46e5'
        });

        if (!result.isConfirmed) return;
      }

      const token = localStorage.getItem('authToken');

      // We directly call the request endpoint instead of trying direct update first
      const response = await fetch(`${API_BASE}/quotation-requests/request-update-from-bom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ salesOrderItemId, bomCost })
      });

      const data = await response.json();

      if (response.ok) {
        successToast(data.message || 'Update request sent to Sales team successfully');
      } else {
        throw new Error(data.error || data.message || 'Failed to send update request');
      }
    } catch (error) {
      console.error('Error requesting quotation update:', error);
      errorToast(error.message);
    }
  };

  const handleDeleteVersion = async (versionId, versionNo) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Version?',
        text: `Are you sure you want to permanently delete BOM Version V${versionNo}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ef4444'
      });

      if (!result.isConfirmed) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/items/${versionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        successToast(`Version V${versionNo} deleted successfully`);

        // If we were viewing the deleted version, navigate back to creation or another version
        if (String(itemId) === String(versionId)) {
          // Find another version to view if available
          const remainingVersions = bomHistory.filter(v => String(v.id) !== String(versionId));
          if (remainingVersions.length > 0) {
            const nextVersion = remainingVersions[remainingVersions.length - 1];
            navigate(`/bom-form/${nextVersion.id}?view=true`);
          } else {
            navigate(`${deptPrefix}/bom-creation`);
          }
        } else {
          // Just refresh history and data
          fetchData(false);
          const effectiveId = (itemId === 'bom-form' || !itemId) ? null : itemId;
          fetchBOMHistory(productForm.itemCode, productForm.drawingNo, effectiveId);
        }
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete version');
      }
    } catch (error) {
      console.error('Error deleting version:', error);
      errorToast(error.message);
    }
  };

  // Auto-Update logic for FG items when cost mismatch is detected
  useEffect(() => {
    const group = (productForm.itemGroup || "").toUpperCase();
    const isFG = group.includes("FG") || group.includes("FINISHED") || group.includes("GOOD");

    // ONLY auto-update if we have an existing BOM (itemId present) and NOT in read-only mode
    if (itemId && itemId !== 'bom-form' && !isReadOnly && !loading && totalBOMCost > 0 && !hasAutoUpdated.current) {
      // Robust parsing: remove everything except numbers and decimal point
      const savedCost = parseFloat(String(productForm.bom_cost || 0).replace(/[^0-9.]/g, ''));
      const currentCost = parseFloat(totalBOMCost);

      if (isFG && Math.abs(savedCost - currentCost) > 0.01) {
        console.log(`[AutoUpdate] Syncing cost mismatch for ${itemId}. Saved: ${savedCost}, Calculated: ${currentCost}`);
        hasAutoUpdated.current = true;

        const timer = setTimeout(() => {
          handleCreateBOM('Active', false, true); // (status, isNewVersion, silent)
        }, 100);

        return () => clearTimeout(timer);
      }
    }
  }, [totalBOMCost, productForm.bom_cost, loading, productForm.itemGroup, itemId, isReadOnly]);

  if (loading && stockItems.length === 0 && bomData.materials.length === 0 && bomData.components.length === 0) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
      <div className="text-slate-500 animate-pulse">Loading Item Details...</div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2  text-slate-900">

            <div>
              <h1 className="text-xl  flex items-center gap-2">
                {isReadOnly
                  ? `Viewing BOM V${productForm.revision || '1'}: ${cleanText(productForm.description) || itemId} ${productForm.itemGroup ? `(${productForm.itemGroup})` : ''}`
                  : (productForm.drawingNo && productForm.drawingNo !== 'N/A'
                    ? `Create BOM: ${productForm.drawingNo}`
                    : 'Create BOM')}
                {productForm.revision && (
                  <span className={`p-1 rounded text-xs border  ${selectedItem?.status === 'Approved' ? 'text-emerald-50  ' :
                    selectedItem?.status === 'Draft' ? 'text-amber-50 ' :
                      selectedItem?.status === 'Rejected' ? 'text-rose-50 ' :
                        ' text-blue-600 '
                    }`}>
                    {selectedItem?.status || 'Pending'}
                  </span>
                )}
                {selectedItem?.status === 'DRAFT' && (
                  <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-600 border border-amber-200">
                    Draft BOM
                  </span>
                )}
                {selectedItem?.status === 'REJECTED' && (
                  <span className="px-2 py-1 roundedtext-xs   bg-rose-100 text-rose-600 border border-rose-200 animate-pulse ">
                    Rejected Drawing
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400   ">
                {selectedItem?.status === 'REJECTED' && selectedItem?.rejection_reason
                  ? `Reason: ${selectedItem.rejection_reason}`
                  : isReadOnly
                    ? 'Inspecting bill of materials details'
                    : (productForm.description
                      ? `Drawing: ${productForm.description}${productForm.itemCode ? ` (${productForm.itemCode})` : ''}`
                      : 'Configure bill of materials')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/design/bom-creation?filter=drafts')}
              className="p-2 bg-blue-50 text-blue-600 rounded  text-xs  border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              View Drafts
            </button>
            <button onClick={() => navigate(`${deptPrefix}/bom-creation`)} className="p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-600 hover:bg-slate-50  transition-all flex items-center gap-1">
              ← Back
            </button>
          </div>
        </div>

        {/* SECTION 1: Product Information */}
        <div className="p-0 border-slate-200 overflow-hidden  transition-all hover:">
          <div
            className="bg-white p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('productInfo')}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-50 rounded  flex items-center justify-center text-blue-600 border border-blue-100 ">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 ">Product Information</h4>
                <p className="text-xs text-slate-400   ">Primary Configuration</p>
              </div>
            </div>
            <div className={`transition-transform duration-300 ${collapsedSections.productInfo ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </div>
          </div>
          {!collapsedSections.productInfo && (
            <div className="p-2 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Product Name <span className="text-rose-500">*</span></label>
                  {isReadOnly ? (
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded  text-xs text-slate-900 ">
                      {productForm.description || '—'}
                    </div>
                  ) : (
                    <SearchableSelect
                      placeholder="Select Product"
                      options={(() => {
                        const rawOptions = [
                          ...(selectedItem ? [{
                            label: (selectedItem.material_name || selectedItem.description || '').replace(/\s*\($/, ''),
                            value: `${selectedItem.source || 'order'}_${selectedItem.id}`,
                            id: selectedItem.id,
                            source: selectedItem.source || 'order',
                            drawing_no: selectedItem.drawing_no,
                            item_code: selectedItem.item_code || selectedItem.itemCode,
                            item_group: selectedItem.item_group || selectedItem.material_type,
                            subLabel: `[${getAutofetchedGroup(selectedItem).toUpperCase()}] • ${selectedItem.item_code} ${selectedItem.drawing_no && selectedItem.drawing_no !== 'N/A' ? `• Drg: ${selectedItem.drawing_no}` : ''}`
                          }] : []),
                          ...approvedDrawings.map(item => {
                            const cleanName = (item.material_name || item.description || '').replace(/\s*\($/, '');
                            return {
                              label: cleanName,
                              value: `order_${item.id}`,
                              id: item.id,
                              source: 'order',
                              drawing_no: item.drawing_no,
                              item_code: item.item_code,
                              item_group: item.item_group || item.material_type,
                              subLabel: `[${getAutofetchedGroup(item).toUpperCase()}] • ${item.item_code} ${item.drawing_no && item.drawing_no !== 'N/A' ? `• Drg: ${item.drawing_no}` : ''}`
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
                              item_code: item.item_code,
                              item_group: item.material_type,
                              subLabel: `[${getAutofetchedGroup(item).toUpperCase()}] • ${item.item_code} ${item.drawing_no && item.drawing_no !== 'N/A' ? `• Drg: ${item.drawing_no}` : ''}`
                            };
                          })
                        ];

                        // De-duplicate by option value
                        const seen = new Set();
                        const deduplicated = rawOptions.filter(opt => {
                          if (seen.has(opt.value)) return false;
                          seen.add(opt.value);
                          return true;
                        });

                        // Filter to show only FG (Finished Goods), SA (Sub-assemblies), SFG, and Parts
                        return deduplicated.filter(opt => {
                          // Always include selected item
                          if (selectedItem && opt.value === `${selectedItem.source || 'order'}_${selectedItem.id}`) return true;

                          const code = (opt.item_code || '').toUpperCase();
                          const group = (opt.item_group || '').toLowerCase();
                          const name = (opt.label || '').toLowerCase();

                          // Exclude raw materials, consumables, hardware, services, packaging
                          if (group.includes('raw') || group.includes('material') || group.includes('consumable') || 
                              group.includes('hardware') || group.includes('service') || group.includes('pack') ||
                              group.includes('tool') || group.includes('fastener') || group.includes('chemical') || 
                              group.includes('scrap')) {
                            return false;
                          }

                          if (name.includes('nut') || name.includes('bolt') || name.includes('screw') || 
                              name.includes('washer') || name.includes('rivet') || name.includes('gasket') ||
                              name.includes('packing') || name.includes('carton') || name.includes('sticker') ||
                              name.includes('tape') || name.includes('glue') || name.includes('consumable')) {
                            return false;
                          }

                          // Include only valid BOM-able groups: FG, SA, SFG, Part, Assembly, Semi-Finished
                          const isBOMableGroup = group.includes('fg') || group.includes('sfg') || group.includes('finished') || 
                                                 group.includes('assembly') || group.includes('assy') || group.includes('part') || 
                                                 group.includes('semi') || code.startsWith('SA-') || code.startsWith('SFG-') || 
                                                 code.startsWith('FG-') || code.startsWith('ASSEMBLY-') || code.startsWith('PART-');

                          return isBOMableGroup;
                        }).sort((a, b) => {
                          if (drawingFilter) {
                            const cleanA = String(a.drawing_no || '').replace(/\s*\($/, '');
                            const cleanB = String(b.drawing_no || '').replace(/\s*\($/, '');
                            const cleanFilter = String(drawingFilter || '').replace(/\s*\($/, '');
                            if (cleanA === cleanFilter && cleanB !== cleanFilter) return -1;
                            if (cleanB === cleanFilter && cleanA !== cleanFilter) return 1;
                          }
                          return (a.label || '').localeCompare(b.label || '');
                        });
                      })()}
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
                            itemGroup: getAutofetchedGroup(item),
                            drawingNo: (item.drawing_no && item.drawing_no !== 'N/A') ? item.drawing_no : (prev.drawingNo || ''),
                            drawing_id: (item.drawing_id && item.drawing_id !== 'N/A') ? item.drawing_id : (prev.drawing_id || ''),
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
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded  text-xs text-slate-900 ">
                      {productForm.itemCode || '—'}
                    </div>
                  ) : (
                    <SearchableSelect
                      placeholder="Select Item Code"
                      options={[
                        ...(selectedItem ? [{
                          label: selectedItem.item_code || selectedItem.itemCode || '',
                          value: `${selectedItem.source || 'order'}_${selectedItem.id}`,
                          id: selectedItem.id,
                          source: selectedItem.source || 'order',
                          drawing_no: selectedItem.drawing_no,
                          item_group: selectedItem.item_group || selectedItem.material_type,
                          subLabel: `[${selectedItem.item_group || selectedItem.material_type || 'Item'}] • ${selectedItem.item_code} ${selectedItem.drawing_no && selectedItem.drawing_no !== 'N/A' ? `• Drg: ${selectedItem.drawing_no}` : ''}`
                        }] : []),
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
                        // Always include selected item
                        if (selectedItem && opt.value === `${selectedItem.source || 'order'}_${selectedItem.id}`) return true;

                        const code = (opt.label || '').toUpperCase();
                        const group = (opt.item_group || '').toLowerCase();
                        const name = (opt.subLabel || '').toLowerCase();

                        // Exclude raw materials, consumables, hardware, services, packaging
                        if (group.includes('raw') || group.includes('material') || group.includes('consumable') || 
                            group.includes('hardware') || group.includes('service') || group.includes('pack') ||
                            group.includes('tool') || group.includes('fastener') || group.includes('chemical') || 
                            group.includes('scrap')) {
                          return false;
                        }

                        if (name.includes('nut') || name.includes('bolt') || name.includes('screw') || 
                            name.includes('washer') || name.includes('rivet') || name.includes('gasket') ||
                            name.includes('packing') || name.includes('carton') || name.includes('sticker') ||
                            name.includes('tape') || name.includes('glue') || name.includes('consumable')) {
                          return false;
                        }

                        // Include only valid BOM-able groups: FG, SA, SFG, Part, Assembly, Semi-Finished
                        const isBOMableGroup = group.includes('fg') || group.includes('sfg') || group.includes('finished') || 
                                               group.includes('assembly') || group.includes('assy') || group.includes('part') || 
                                               group.includes('semi') || code.startsWith('SA-') || code.startsWith('SFG-') || 
                                               code.startsWith('FG-') || code.startsWith('ASSEMBLY-') || code.startsWith('PART-');

                        return isBOMableGroup;
                      }).sort((a, b) => {
                        // Sort matching drawings to the top
                        if (drawingFilter) {
                          const cleanA = String(a.drawing_no || '').replace(/\s*\($/, '');
                          const cleanB = String(b.drawing_no || '').replace(/\s*\($/, '');
                          const cleanFilter = String(drawingFilter || '').replace(/\s*\($/, '');
                          if (cleanA === cleanFilter && cleanB !== cleanFilter) return -1;
                          if (cleanB === cleanFilter && cleanA !== cleanFilter) return 1;
                        }
                        return (a.label || '').localeCompare(b.label || '');
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
                            itemGroup: getAutofetchedGroup(item),
                            drawingNo: (item.drawing_no && item.drawing_no !== 'N/A') ? item.drawing_no : (prev.drawingNo || ''),
                            drawing_id: (item.drawing_id && item.drawing_id !== 'N/A') ? item.drawing_id : (prev.drawing_id || ''),
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
                  <label className="text-xs  text-slate-500 ml-1">Drawing No</label>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 ">
                    {productForm.drawingNo || 'N/A'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Item Group</label>
                  <select
                    disabled={isReadOnly}
                    className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    value={productForm.itemGroup}
                    onChange={(e) => {
                      const newGroup = e.target.value;
                      const isAssembly = newGroup === 'Assembly';
                      setProductForm({
                        ...productForm,
                        itemGroup: newGroup,
                        quantity: isAssembly ? 1 : productForm.quantity
                      });
                    }}
                  >
                    <option value="Part">Part</option>
                    <option value="Assembly">Assembly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Base Quantity (Yield)</label>
                  <div className="relative">
                    <input
                      type="number"
                      className={`w-full p-2 border border-slate-200 rounded  text-xs  transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${(productForm.itemGroup === 'Assembly' || isReadOnly) ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700'}`}
                      placeholder="Enter quantity"
                      step="0.01"
                      min="0.01"
                      value={productForm.quantity}
                      disabled={productForm.itemGroup === 'Assembly' || isReadOnly}
                      onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2text-xs  text-slate-400 ">{productForm.uom}</div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3 text-amber-500" />
                    Yield for cost calculation
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">UOM</label>
                  <select
                    disabled={isReadOnly}
                    className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
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
                    className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="e.g. 1.0"
                    value={productForm.revision}
                    onChange={(e) => setProductForm({ ...productForm, revision: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 mt-3">
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs  text-slate-500 ml-1">Technical Specifications / Notes</label>
                  <textarea
                    disabled={isReadOnly}
                    rows="2"
                    className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 resize-none"
                    placeholder="Enter any additional technical details or manufacturing notes..."
                    value={productForm.notes}
                    onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                  />
                </div>

              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Components */}
        {String(productForm.itemGroup || '').toLowerCase() === 'assembly' && (
          <Card className="p-0 border-slate-200 overflow-hidden  transition-all hover:">
            <div
              className="bg-white p-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
              onClick={() => toggleSection('components')}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-indigo-50 rounded  flex items-center justify-center text-indigo-600 border border-indigo-100 ">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm  text-slate-800 ">Component/Part</h4>
                  <p className="text-xs text-slate-400   ">{bomData.components.length} items • Total ₹{componentsCost.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (collapsedSections.components) {
                        toggleSection('components');
                      }
                    }}
                    className="p-2 .5 bg-indigo-50 text-indigo-600 rounded  text-xs  hover:bg-indigo-100 transition-colors flex items-center gap-1.5 border border-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Quick Add
                  </button>
                )}
                <div className={`transition-transform duration-300 ${collapsedSections.components ? 'rotate-180' : ''}`}>
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            </div>
            {!collapsedSections.components && (
              <div className="p-2 bg-white">
                {!isReadOnly && (
                  <div className="bg-slate-50 p-2 rounded  border border-slate-100 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="text-xs  text-indigo-600  flex items-center gap-2 ">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded "></span>
                        Add New Component
                      </h5>
                      <label className="flex items-center gap-2  cursor-pointer group bg-white px-2.5 py-1.5 rounded  border border-slate-200  hover:border-indigo-300 transition-all">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={showAllDrawings}
                          onChange={(e) => setShowAllDrawings(e.target.checked)}
                        />
                        <span className="text-xs  text-slate-600 group-hover:text-indigo-600 transition-colors">Global Search</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">Component Selection <span className="text-rose-500">*</span></label>
                        <SearchableSelect
                          placeholder="Select assembly or part..."
                          options={componentOptions}
                          value={componentForm.componentCode}
                          onChange={(e) => {
                            const item = componentOptions.find(i => i.value === e.target.value) ||
                              stockItems.find(si => si.item_code === e.target.value);
                            setComponentForm({
                              ...componentForm,
                              componentCode: e.target.value,
                              rate: item ? item.rate : componentForm.rate,
                              uom: item ? item.uom : componentForm.uom,
                              description: item ? item.description : componentForm.description,
                              weightPerUnit: item ? (item.weight_per_unit || item.weightPerUnit || 0) : '',
                              itemGroup: item ? (item.itemGroup || item.item_group || "") : '',
                              scrapPercent: item ? (item.scrapPercent || item.scrap_percent || 0) : '0',
                              length: item ? item.length : '',
                              width: item ? item.width : '',
                              thickness: item ? item.thickness : '',
                              diameter: item ? item.diameter : '',
                              outer_diameter: item ? item.outer_diameter : '',
                              drawingNo: item ? (item.drawingNo || item.drawing_no || 'N/A') : 'N/A',
                              drawing_no: item ? (item.drawing_no || item.drawingNo || 'N/A') : 'N/A'
                            });
                          }}
                          subLabelField="subLabel"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">Parent Level</label>
                        <select
                          className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          value={componentForm.parentId}
                          onChange={(e) => setComponentForm({ ...componentForm, parentId: e.target.value })}
                        >
                          <option value="">{productForm.description || productForm.drawingNo || new URLSearchParams(location.search).get('drawing_name') || new URLSearchParams(location.search).get('drawing_no') || 'None (Top Level)'}</option>
                          {bomData.components.map(c => (
                            <option key={c.id} value={c.id}>{c.component_code || c.componentCode}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">Qty</label>
                        <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" step="0.01" value={componentForm.quantity} onChange={(e) => setComponentForm({ ...componentForm, quantity: e.target.value })} />
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">UOM</label>
                        <select className="w-full px-2 py-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={componentForm.uom} onChange={(e) => setComponentForm({ ...componentForm, uom: e.target.value })}>
                          <option value="Kg">Kg</option>
                          <option value="Nos">Nos</option>
                          <option value="Mtr">Mtr</option>
                          <option value="Litre (Ltr)">Litre (Ltr)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-1 flex flex-col justify-end">
                        {editingSectionItem?.section === 'components' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateSectionItem('components', componentForm, setComponentForm, { componentCode: '', quantity: '1', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', itemGroup: '', length: '', width: '', thickness: '', diameter: '', outer_diameter: '', drawingNo: '', drawing_no: '' })}
                              className="flex-1 py-2 bg-blue-600 text-white rounded  text-xs  hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Save className="w-4 h-4" />
                              Update
                            </button>
                            <button
                              onClick={() => handleCancelEditSectionItem('components')}
                              className="px-3 py-2 bg-slate-100 text-slate-600 rounded  text-xs  hover:bg-slate-200 transition-all active:scale-95"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddSectionItem('components', componentForm, setComponentForm, { componentCode: '', quantity: '1', uom: 'Kg', rate: '', lossPercent: '', notes: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', itemGroup: '', length: '', width: '', thickness: '', diameter: '', outer_diameter: '', drawingNo: '', drawing_no: '' })}
                            className="w-full py-2 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`grid grid-cols-1 ${(() => {
                      const isWeightBasedGroup = ['raw materials', 'raw material', 'rm', 'consumables', 'consumable', 'con'].includes((componentForm.itemGroup || '').toLowerCase().trim());
                      const isKg = (componentForm.uom || '').toLowerCase() === 'kg';
                      return (isWeightBasedGroup && isKg) ? 'md:grid-cols-6' : 'md:grid-cols-4';
                    })()} gap-2 mt-3`}>
                      <div className="space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">Unit Rate (₹)</label>
                        <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" step="0.01" value={componentForm.rate} onChange={(e) => setComponentForm({ ...componentForm, rate: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">Process Loss %</label>
                        <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-rose-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" step="0.01" value={componentForm.lossPercent} onChange={(e) => setComponentForm({ ...componentForm, lossPercent: e.target.value })} />
                      </div>

                      {(() => {
                        const isWeightBasedGroup = ['raw materials', 'raw material', 'rm', 'consumables', 'consumable', 'con'].includes((componentForm.itemGroup || '').toLowerCase().trim());
                        const isKg = (componentForm.uom || '').toLowerCase() === 'kg';

                        if (isWeightBasedGroup && isKg) {
                          return (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500 ml-1">Weight/Unit (Kg)</label>
                                <input
                                  type="text"
                                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 outline-none "
                                  value={componentForm.weightPerUnit ? (parseFloat(componentForm.weightPerUnit) * (1 + parseFloat(componentForm.scrapPercent || 0))).toFixed(3) : ''}
                                  readOnly
                                  placeholder="Auto"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500 ml-1">Scrap(kg)</label>
                                <input
                                  type="number"
                                  className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={componentForm.scrapPercent}
                                  onChange={(e) => setComponentForm({ ...componentForm, scrapPercent: e.target.value })}
                                  placeholder="0"
                                />
                              </div>
                            </>
                          );
                        }
                        return null;
                      })()}

                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs  text-slate-500 ml-1">Component Notes</label>
                        <input type="text" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Special handling or revision notes..." value={componentForm.notes} onChange={(e) => setComponentForm({ ...componentForm, notes: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {bomData.components.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-100 rounded  ">
                    <table className="min-w-full divide-y divide-slate-100 bg-white">
                      <thead className="bg-slate-50/50">
                        <tr>
                          <th className="p-2  text-left text-xs   text-slate-400 ">Item</th>
                          <th className="p-2  text-center text-xs   text-slate-400 ">Type</th>
                          <th className="p-2  text-center text-xs   text-slate-400 ">Unit Details</th>
                          <th className="p-2  text-center text-xs   text-slate-400 ">Total Wt</th>
                          <th className="p-2  text-center text-xs   text-slate-400 ">Rate (₹)</th>
                          <th className="p-2  text-center text-xs   text-slate-400 ">Total (₹)</th>
                          {!isReadOnly && <th className="p-2  text-right text-xs   text-slate-400 ">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {bomData.components.filter(c => !c.parent_id && !c.parentId).map((c) => (
                          <RecursiveBOMRow
                            key={c.id}
                            item={c}
                            onRemove={handleDeleteSectionItem}
                            onEdit={(item) => handleStartEditSectionItem('components', item)}
                            isReadOnly={isReadOnly}
                            childrenMap={childrenMap}
                            type="component"
                            isComponentSection={true}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-2 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded  bg-slate-50/30">
                    <div className="w-8 h-8 bg-slate-100 rounded  flex items-center justify-center text-slate-300 mb-3">
                      <Layers className="w-8 h-8" />
                    </div>
                    <p className="text-xs  text-slate-400 ">No components added yet</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}


        {/* SECTION 3: Materials */}
        <Card className="p-0 border-slate-200 overflow-hidden  transition-all hover:">
          <div
            className="bg-white p-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('materials')}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-emerald-50 rounded  flex items-center justify-center text-emerald-600 border border-emerald-100 ">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 ">Raw Materials</h4>
                <p className="text-xs text-slate-400   ">{bomData.materials.length} items • Total ₹{rawMaterialsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (collapsedSections.materials) {
                      toggleSection('materials');
                    }
                  }}
                  className="p-2 .5 bg-emerald-50 text-emerald-600 rounded  text-xs  hover:bg-emerald-100 transition-colors flex items-center gap-1.5 border border-emerald-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.materials ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>
          {!collapsedSections.materials && (
            <div className="p-2 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-2 rounded  border border-slate-100 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-xs  text-emerald-600  flex items-center gap-2 ">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded "></span>
                      Add New Material
                    </h5>
                    <label className="flex items-center gap-2  cursor-pointer group bg-white px-2.5 py-1.5 rounded  border border-slate-200  hover:border-emerald-300 transition-all">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={showAllDrawings}
                        onChange={(e) => setShowAllDrawings(e.target.checked)}
                      />
                      <span className="text-xs  text-slate-600 group-hover:text-emerald-600 transition-colors">Global Search</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Material Selection <span className="text-rose-500">*</span></label>
                      <SearchableSelect
                        placeholder="Select material..."
                        options={stockItems
                          .filter(item => {
                            // FG and Sub-assembly check
                            const itemCode = (item.item_code || "").toUpperCase();
                            const type = (item.material_type || "").toLowerCase();
                            const group = (item.item_group || "").toLowerCase();

                            // EXCLUDE FG, Sub-assemblies, and Parts (Keep Raw Materials, Consumables, PM, etc.)
                            if (itemCode.startsWith("FG-") || itemCode.startsWith("SA-") || itemCode.startsWith("SFG-") || itemCode.startsWith("PART-")) return false;
                            if (type.includes("finished") || type.includes("assembly") || type.includes("part")) return false;
                            if (group.includes("finished") || group.includes("assembly") || group.includes("part")) return false;

                            // Type Filter
                            const targetGroup = (materialForm.itemGroup || '').toLowerCase().replace(/_/g, ' ').trim();
                            const normalizedType = type.replace(/_/g, ' ').trim();
                            const normalizedGroup = group.replace(/_/g, ' ').trim();

                            // Filter by group logic
                            if (targetGroup) {
                              if (targetGroup.includes('raw material') || targetGroup.includes('rm')) {
                                // For Raw Material selection, allow everything EXCEPT sub-assemblies/SFG/FG/Parts
                                if (normalizedType.includes('finished') || normalizedType.includes('assembly') || normalizedType.includes('part')) return false;
                                if (normalizedGroup.includes('finished') || normalizedGroup.includes('assembly') || normalizedGroup.includes('part')) return false;
                              } else if (targetGroup.includes('consumable') || targetGroup.includes('con')) {
                                if (!normalizedType.includes('consumable') && !normalizedGroup.includes('consumable') && !normalizedGroup.includes('con')) return false;
                              } else if (targetGroup.includes('pm') || targetGroup.includes('packing')) {
                                if (!normalizedType.includes('pm') && !normalizedType.includes('packing') && !normalizedGroup.includes('pm') && !normalizedGroup.includes('packing')) return false;
                              } else if (targetGroup.includes('sub assembly') || targetGroup.includes('sfg') || targetGroup.includes('semi')) {
                                if (!normalizedType.includes('sub assembly') && !normalizedType.includes('semi') && !normalizedType.includes('sfg')) return false;
                              } else if (targetGroup.includes('tool')) {
                                if (!normalizedType.includes('tool')) return false;
                              } else if (targetGroup.includes('service')) {
                                if (!normalizedType.includes('service')) return false;
                              } else {
                                // Direct match fallback
                                if (!normalizedType.includes(targetGroup) && !targetGroup.includes(normalizedType)) return false;
                              }
                            }

                            if (showAllDrawings) return true;

                            const productDrawing = (selectedItem?.drawing_no || productForm.drawingNo || '').trim();
                            const itemDrawing = (item.drawing_no || '').trim();

                            if (!productDrawing) return true;

                            // If item has no drawing or N/A, it's a generic raw material/consumable - ALWAYS show it
                            if (!itemDrawing || itemDrawing === 'N/A') return true;

                            // Otherwise, it must match the product drawing
                            return itemDrawing === productDrawing;
                          })
                          .map(item => {
                            const dims = getDimensionString(item);
                            return {
                              label: item.material_name || '',
                              value: item.item_code || '',
                              subLabel: `${dims ? `${dims}\n` : ''}${item.item_code || ''}${item.drawing_no && item.drawing_no !== 'N/A' ? ` [Drg: ${item.drawing_no}]` : ''}`
                            };
                          })
                          .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
                        }
                        value={stockItems.find(i => i.material_name === materialForm.materialName)?.item_code || ''}
                        onChange={(e) => {
                          const item = stockItems.find(i => i.item_code === e.target.value) ||
                            stockItems.find(i => i.material_name === e.target.value);
                          // Check if this material is a sub-assembly and has an approved BOM cost
                          const bomInfo = item ? approvedBOMs.find(b => b.item_code === item.item_code) : null;
                          const bomCost = bomInfo ? parseFloat(bomInfo.bom_cost) : 0;

                          let autoGroup = materialForm.itemGroup;
                          if (item) {
                            const ig = (item.material_type || item.item_group || item.materialType || "").toLowerCase().replace(/_/g, ' ').trim();
                            const matchingGroup = itemGroups.find(g => {
                              const gName = g.name.toLowerCase().replace(/_/g, ' ').trim();
                              return gName === ig || ig.includes(gName) || gName.includes(ig);
                            });
                            autoGroup = matchingGroup ? matchingGroup.name : getMaterialItemGroupFromType(item);
                          }

                          setMaterialForm({
                            ...materialForm,
                            materialName: item ? item.material_name : e.target.value,
                            itemCode: item ? item.item_code : '',
                            itemGroup: autoGroup,
                            rate: item ? (bomCost > 0 ? bomCost : (item.selling_rate > 0 ? item.selling_rate : (item.valuation_rate || 0))) : materialForm.rate,
                            uom: item ? (item.unit || 'Kg') : materialForm.uom,
                            description: item ? item.material_name : materialForm.description,
                            weightPerUnit: item ? (item.weight_per_unit || 0) : '',
                            length: item ? item.length : '',
                            width: item ? item.width : '',
                            thickness: item ? item.thickness : '',
                            diameter: item ? item.diameter : '',
                            outer_diameter: item ? item.outer_diameter : ''
                          });
                        }}
                        subLabelField="subLabel"
                      />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Quantity</label>
                      <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="0.00" step="0.01" value={materialForm.qty} onChange={(e) => setMaterialForm({ ...materialForm, qty: e.target.value })} />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">UOM</label>
                      <select className="w-full px-2 py-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={materialForm.uom} onChange={(e) => setMaterialForm({ ...materialForm, uom: e.target.value })}>
                        <option value="Kg">Kg</option>
                        <option value="Nos">Nos</option>
                        <option value="Mtr">Mtr</option>
                        <option value="Litre (Ltr)">Litre (Ltr)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Item Group</label>
                      <select className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={materialForm.itemGroup} onChange={(e) => setMaterialForm({ ...materialForm, itemGroup: e.target.value })}>
                        <option value="">Select Group</option>
                        {itemGroups.map(group => (
                          <option key={group.id} value={group.name}>{group.name}</option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const isWeightBasedGroup = ['raw materials', 'raw material', 'rm', 'consumables', 'consumable', 'con'].includes((materialForm.itemGroup || '').toLowerCase().trim());
                      const isKg = (materialForm.uom || '').toLowerCase() === 'kg';

                      if (isWeightBasedGroup && isKg) {
                        return (
                          <>
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-xs  text-slate-500 ml-1">Weight/Unit (Kg)</label>
                              <input
                                type="text"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 outline-none "
                                value={materialForm.weightPerUnit ? (parseFloat(materialForm.weightPerUnit) * (1 + (parseFloat(materialForm.scrapPercent) || 0))).toFixed(3) : ''}
                                readOnly
                                placeholder="Auto"
                              />
                            </div>
                            <div className="md:col-span-1 space-y-1">
                              <label className="text-xs  text-slate-500 ml-1">Scrap(kg)</label>
                              <input
                                type="number"
                                className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={materialForm.scrapPercent}
                                onChange={(e) => setMaterialForm({ ...materialForm, scrapPercent: e.target.value })}
                                placeholder="0"
                              />
                            </div>
                          </>
                        );
                      }
                      return null;
                    })()}

                    <div className={`space-y-1 flex flex-col justify-end ${(() => {
                      const isWeightBasedGroup = ['raw materials', 'raw material', 'rm', 'consumables', 'consumable', 'con'].includes((materialForm.itemGroup || '').toLowerCase().trim());
                      const isKg = (materialForm.uom || '').toLowerCase() === 'kg';
                      return (isWeightBasedGroup && isKg) ? 'md:col-span-2' : 'md:col-span-4';
                    })()}`}>
                      {editingSectionItem?.section === 'materials' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateSectionItem('materials', materialForm, setMaterialForm, { materialName: '', itemCode: '', qty: '1', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', length: '', width: '', thickness: '', diameter: '', outer_diameter: '' })}
                            className="flex-1 py-2 bg-blue-600 text-white rounded  text-xs  hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Update
                          </button>
                          <button
                            onClick={() => handleCancelEditSectionItem('materials')}
                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded  text-xs  hover:bg-slate-200 transition-all active:scale-95"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddSectionItem('materials', materialForm, setMaterialForm, { materialName: '', itemCode: '', qty: '1', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '', parentId: '', description: '', weightPerUnit: '', scrapPercent: '0', length: '', width: '', thickness: '', diameter: '', outer_diameter: '' })}
                          className="w-full py-2 bg-emerald-600 text-white rounded  text-xs  hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Material
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Rate (₹)</label>
                      <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="0.00" step="0.01" value={materialForm.rate} onChange={(e) => setMaterialForm({ ...materialForm, rate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Warehouse</label>
                      <select className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={materialForm.warehouse} onChange={(e) => setMaterialForm({ ...materialForm, warehouse: e.target.value })}>
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
                        className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={materialForm.parentId}
                        onChange={(e) => setMaterialForm({ ...materialForm, parentId: e.target.value })}
                      >
                        <option value="">{productForm.description || productForm.drawingNo || new URLSearchParams(location.search).get('drawing_name') || new URLSearchParams(location.search).get('drawing_no') || 'None (Top Level)'}</option>
                        {bomData.components.map(c => (
                          <option key={c.id} value={c.id}>{c.component_code || c.componentCode}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {bomData.materials.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded  ">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2  text-left text-xs   text-slate-400 ">Item Details</th>
                        <th className="p-2  text-center text-xs   text-slate-400 ">Unit Details</th>
                        <th className="p-2  text-center text-xs   text-slate-400 ">Total Wt</th>
                        <th className="p-2  text-center text-xs   text-slate-400 ">Rate (₹)</th>
                        <th className="p-2  text-center text-xs   text-slate-400 ">Warehouse</th>
                        <th className="p-2  text-center text-xs   text-slate-400 ">Operation</th>
                        <th className="p-2  text-center text-xs   text-slate-400 ">Total (₹)</th>
                        {!isReadOnly && <th className="p-2  text-right text-xs   text-slate-400 ">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomData.materials.filter(m => !m.parent_id && !m.parentId).map((m) => (
                        <RecursiveBOMRow
                          key={m.id}
                          item={m}
                          onRemove={handleDeleteSectionItem}
                          onEdit={(item) => handleStartEditSectionItem('materials', item)}
                          isReadOnly={isReadOnly}
                          childrenMap={childrenMap}
                          type="material"
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-2 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded  bg-emerald-50/30">
                  <div className="w-8 h-8 bg-white rounded  flex items-center justify-center text-emerald-300 mb-3  border border-emerald-50">
                    <Package className="w-8 h-8" />
                  </div>
                  <p className="text-xs  text-emerald-400 ">No materials added yet</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 4: Operations */}
        <Card className="p-0 border-slate-200 overflow-hidden  transition-all hover:">
          <div
            className="bg-white p-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('operations')}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-purple-50 rounded  flex items-center justify-center text-purple-600 border border-purple-100 ">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 ">Process Routing</h4>
                <p className="text-xs text-slate-400   ">{bomData.operations.length} operations • Total ₹{operationsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                  className="p-2 .5 bg-purple-50 text-purple-600 rounded  text-xs  hover:bg-purple-100 transition-colors flex items-center gap-1.5 border border-purple-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.operations ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>
          {!collapsedSections.operations && (
            <div className="p-2 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-2 rounded  border border-slate-100 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="text-xs  text-purple-600  flex items-center gap-2 ">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded "></span>
                        Add New Operation
                      </h5>
                      <p className="text-xs text-slate-400  mt-0.5">Define manufacturing sequence and standard times</p>
                    </div>
                    <div className="bg-white px-2.5 py-1.5 rounded  border border-slate-200  flex items-center gap-2 ">
                      <span className="text-xs  text-slate-400  er">Cost Formula:</span>
                      <code className="text-xs text-purple-600   ">((Cycle + Setup) / 60) * Rate</code>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
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
                            const wsCodes = op.workstation_codes ? op.workstation_codes.split(', ') : [];
                            setOperationForm({
                              ...operationForm,
                              operationName: e.target.value,
                              workstation: wsCodes.length === 1 ? wsCodes[0] : '',
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
                        className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
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
                        {(() => {
                          const op = operationsList.find(o => o.operation_name === operationForm.operationName);
                          const filteredWS = op && op.workstation_codes
                            ? workstations.filter(ws => op.workstation_codes.split(', ').includes(ws.workstation_code))
                            : workstations;

                          // If after filtering we have no workstations but we have global workstations, 
                          // show all as a fallback so user can still select something
                          const displayWS = (filteredWS.length === 0 && workstations.length > 0) ? workstations : filteredWS;

                          return displayWS.map(ws => (
                            <option key={ws.id} value={ws.workstation_code}>
                              {ws.workstation_code} - {ws.workstation_name}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Cycle Time (min)</label>
                      <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0.00" step="0.01" value={operationForm.cycleTimeMin} onChange={(e) => setOperationForm({ ...operationForm, cycleTimeMin: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Setup Time (min)</label>
                      <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0.00" step="0.01" value={operationForm.setupTimeMin} onChange={(e) => setOperationForm({ ...operationForm, setupTimeMin: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Hourly Rate (₹)</label>
                      <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0.00" step="0.01" value={operationForm.hourlyRate} onChange={(e) => setOperationForm({ ...operationForm, hourlyRate: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-4 pt-4 border-t border-slate-200/60">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Process Type</label>
                      <select className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={operationForm.operationType} onChange={(e) => setOperationForm({ ...operationForm, operationType: e.target.value })}>
                        <option value="In-House">In-House Production</option>
                        <option value="Sub-Contract">Job Work (Sub-Contract)</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Output Warehouse (WIP)</label>
                      <select className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={operationForm.targetWarehouse} onChange={(e) => setOperationForm({ ...operationForm, targetWarehouse: e.target.value })}>
                        <option value="">Select Destination</option>
                        <option value="WIP">Work In Progress</option>
                        <option value="FG">Finished Goods</option>
                        <option value="Main">Main Warehouse</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Calculated Op. Cost</label>
                      <div className="p-2 bg-purple-50 border border-purple-100 rounded  text-xs  text-purple-700 flex items-center h-[38px]">
                        ₹ {(((parseFloat(operationForm.cycleTimeMin || 0) + parseFloat(operationForm.setupTimeMin || 0)) / 60) * parseFloat(operationForm.hourlyRate || 0)).toFixed(2)}
                      </div>
                    </div>

                    <div className="md:col-span-3 flex items-end">
                      {editingSectionItem?.section === 'operations' ? (
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => handleUpdateSectionItem('operations', operationForm, setOperationForm, { operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' })}
                            className="flex-1 py-2 bg-blue-600 text-white rounded  text-xs  hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Update
                          </button>
                          <button
                            onClick={() => handleCancelEditSectionItem('operations')}
                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded  text-xs  hover:bg-slate-200 transition-all active:scale-95"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddSectionItem('operations', operationForm, setOperationForm, { operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' })}
                          className="w-full py-2 bg-purple-600 text-white rounded  text-xs  hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Operation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {bomData.operations.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded  ">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2  text-lefttext-xs   text-slate-400 ">Sequence / Details</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Times (Min)</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Hourly Rate</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Process Type</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Net Time</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Op. Cost</th>
                        {!isReadOnly && <th className="p-2  text-righttext-xs   text-slate-400 ">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomData.operations.map((o, idx) => {
                        const cycleTime = parseFloat(o.cycle_time_min || 0);
                        const setupTime = parseFloat(o.setup_time_min || 0);
                        const hourlyRate = parseFloat(o.hourly_rate || 0);
                        const setupPerUnit = batchQty > 0 ? (setupTime / batchQty) : 0;
                        const totalTimeMinPerUnit = cycleTime + setupPerUnit;
                        const operationCost = (totalTimeMinPerUnit / 60) * hourlyRate;

                        return (
                          <tr key={o.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="p-2  whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded  bg-slate-100 flex items-center justify-centertext-xs   text-slate-500 border border-slate-200">{idx + 1}</span>
                                <div className="flex flex-col">
                                  <span className="text-xs  text-slate-800">{o.operation_name || o.operationName}</span>
                                  <span className="text-xs text-slate-400   flex items-center gap-1">
                                    <Settings className="w-2.5 h-2.5" />
                                    {o.workstation || 'No Resource'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-2  text-center whitespace-nowrap">
                              <div className="flex flex-col items-center">
                                <span className="text-xs  text-slate-700">C: {cycleTime} / S: {setupTime}</span>
                                <span className="text-xs text-slate-400 ">Minutes</span>
                              </div>
                            </td>
                            <td className="p-2  text-center whitespace-nowrap text-xs  text-slate-600">
                              ₹{hourlyRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2  text-center whitespace-nowrap text-xs text-slate-600">
                              {o.operation_type || o.operationType || 'In-House'}
                            </td>
                            <td className="p-2  text-center whitespace-nowrap">
                              <span className="inline-flex items-center p-1  rounded text-xs   bg-indigo-50 text-indigo-600 border border-indigo-100">
                                {totalTimeMinPerUnit.toFixed(1)}m
                              </span>
                            </td>
                            <td className="p-2  text-center whitespace-nowrap">
                              <span className="text-xs  text-purple-600">
                                ₹{operationCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            {!isReadOnly && (
                              <td className="p-2  text-right whitespace-nowrap">
                                <div className="flex justify-end gap-1  group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={() => handleStartEditSectionItem('operations', o)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                    title="Edit Operation"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSectionItem('operations', o.id, o.isLocal)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                    title="Remove Operation"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-2 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded  bg-purple-50/30">
                  <div className="w-8 h-8 bg-white rounded  flex items-center justify-center text-purple-300 mb-3  border border-purple-50">
                    <Settings className="w-4 h-4" />
                  </div>
                  <p className="text-xs  text-purple-400 ">No operations defined</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 5: Scrap & Loss */}
        <Card className="p-0 border-slate-200 overflow-hidden  transition-all hover:">
          <div
            className="bg-white p-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => toggleSection('scrap')}
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-orange-50 rounded  flex items-center justify-center text-orange-600 border border-orange-100 ">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm  text-slate-800 ">Scrap & Recoveries</h4>
                <p className="text-xs text-slate-400   ">{bomData.scrap.length} scrap items • Value ₹{scrapLoss.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (collapsedSections.scrap) {
                      toggleSection('scrap');
                    } else {
                      handleAddSectionItem('scrap', scrapForm, setScrapForm, { itemCode: '', itemName: '', inputQty: '1', lossPercent: '', rate: '' });
                    }
                  }}
                  className="p-2 .5 bg-orange-50 text-orange-600 rounded  text-xs  hover:bg-orange-100 transition-colors flex items-center gap-1.5 border border-orange-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Quick Add
                </button>
              )}
              <div className={`transition-transform duration-300 ${collapsedSections.scrap ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>
          {!collapsedSections.scrap && (
            <div className="p-2 bg-white">
              {!isReadOnly && (
                <div className="bg-slate-50 p-2 rounded  border border-slate-100 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h5 className="text-xs  text-orange-600  flex items-center gap-2 ">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded "></span>
                      Add Scrap Item
                    </h5>
                    <label className="flex items-center gap-2  cursor-pointer group bg-white px-2.5 py-1.5 rounded  border border-slate-200  hover:border-orange-300 transition-all">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        checked={showAllDrawings}
                        onChange={(e) => setShowAllDrawings(e.target.checked)}
                      />
                      <span className="text-xs  text-slate-600 group-hover:text-orange-600 transition-colors">Global Search</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Scrap Material *</label>
                      <SearchableSelect
                        placeholder="Select scrap item..."
                        options={stockItems
                          .filter(item => {
                            if (showAllDrawings) return true;
                            const productDrawing = (selectedItem?.drawing_no || productForm.drawingNo || '').trim();
                            const itemDrawing = (item.drawing_no || '').trim();

                            if (!productDrawing) return true;
                            return itemDrawing === productDrawing;
                          })
                          .map(item => ({
                            label: item.material_name || '',
                            value: item.material_name || '',
                            subLabel: `${item.item_code || ''} ${item.drawing_no && item.drawing_no !== 'N/A' ? `[Drg: ${item.drawing_no}]` : ''}`
                          }))
                          .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
                        }
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
                        className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={scrapForm.parentId}
                        onChange={(e) => setScrapForm({ ...scrapForm, parentId: e.target.value })}
                      >
                        <option value="">{productForm.description || productForm.drawingNo || new URLSearchParams(location.search).get('drawing_name') || new URLSearchParams(location.search).get('drawing_no') || 'None (Top Level)'}</option>
                        {bomData.components.map(c => (
                          <option key={c.id} value={c.id}>{c.component_code || c.componentCode}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Input Qty</label>
                      <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0.00" step="0.01" value={scrapForm.inputQty} onChange={(e) => setScrapForm({ ...scrapForm, inputQty: e.target.value })} />
                    </div>

                    <div className="md:col-span-1 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Loss %</label>
                      <input type="number" className="w-full px-2 py-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0" step="0.01" value={scrapForm.lossPercent} onChange={(e) => setScrapForm({ ...scrapForm, lossPercent: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs  text-slate-500 ml-1">Recovery Rate (₹)</label>
                      <div className="flex gap-2">
                        <input type="number" className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0.00" step="0.01" value={scrapForm.rate} onChange={(e) => setScrapForm({ ...scrapForm, rate: e.target.value })} />
                        <button
                          onClick={() => handleAddSectionItem('scrap', scrapForm, setScrapForm, { itemCode: '', itemName: '', inputQty: '1', lossPercent: '', rate: '', parentId: '' })}
                          className="px-3 bg-orange-600 text-white rounded  text-xs  hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all active:scale-95"
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
                <div className="overflow-x-auto border border-slate-100 rounded  ">
                  <table className="min-w-full divide-y divide-slate-100 bg-white">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="p-2  text-lefttext-xs   text-slate-400 ">Scrap Item</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Input Qty</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Loss %</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Scrap Qty</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Rate (₹)</th>
                        <th className="p-2  text-centertext-xs   text-slate-400 ">Total Value (₹)</th>
                        {!isReadOnly && <th className="p-2  text-righttext-xs   text-slate-400 ">Actions</th>}
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
                            <td className="p-2  whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-xs  text-slate-800">{s.item_name || 'N/A'}</span>
                                <span className="text-xs text-slate-400   ">
                                  {s.item_code} {s.parent_id || s.parentId ? `[Ref: Component]` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="p-2  text-center whitespace-nowrap text-xs  text-slate-600">{inputQty.toFixed(2)}</td>
                            <td className="p-2  text-center whitespace-nowrap">
                              <span className="p-1  rounded text-xs   bg-orange-50 text-orange-600 border border-orange-100">
                                {lossPercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-2  text-center whitespace-nowrap text-xs  text-slate-900">{scrapQty.toFixed(3)}</td>
                            <td className="p-2  text-center whitespace-nowrap text-xs  text-slate-600">₹{rate.toFixed(2)}</td>
                            <td className="p-2  text-center whitespace-nowrap">
                              <span className="text-xs  text-rose-600">
                                - ₹{scrapAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            {!isReadOnly && (
                              <td className="p-2  text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteSectionItem('scrap', s.id, s.isLocal)}
                                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded  transition-all  group-hover:opacity-100"
                                  title="Remove Scrap"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                <div className="py-2 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded  bg-orange-50/30">
                  <div className="w-8 h-8 bg-white rounded  flex items-center justify-center text-orange-300 mb-3  border border-orange-50">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <p className="text-xs  text-orange-400 ">No scrap or loss recorded</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {bomData.scrap.length > 0 && (
          <div className="mt-4 overflow-x-auto border border-slate-200 rounded  ">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Item / Code</th>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Parent</th>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Input Qty</th>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Loss %</th>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Scrap Qty</th>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Rate (₹)</th>
                  <th className="p-2  text-left text-xs  text-slate-500  ">Scrap Value (₹)</th>
                  {!isReadOnly && <th className="p-2  text-right text-xs  text-slate-500  ">Actions</th>}
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
                      <td className="p-2  whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm  text-slate-800">{s.item_name || 'N/A'}</span>
                          <span className="text-xs text-slate-500  ">{s.item_code || 'N/A'}</span>
                          {stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs  text-blue-600 bg-blue-50 p-1 rounded-md border border-blue-100 w-fit">
                              <Search className="w-2.5 h-2.5" />
                              Drg: {stockItem.drawing_no}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2  whitespace-nowrap">
                        {s.parent_id || s.parentId ? (
                          <div className="flex flex-col">
                            <span className="text-xs  text-slate-700">
                              {bomData.components.find(c => String(c.id) === String(s.parent_id || s.parentId))?.component_code || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-400">Sub-Component Scrap</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Top Level</span>
                        )}
                      </td>
                      <td className="p-2  text-center whitespace-nowrap text-sm text-slate-600 ">{inputQty.toFixed(2)}</td>
                      <td className="p-2  text-center whitespace-nowrap">
                        <span className="p-1  rounded text-xs   bg-orange-50 text-orange-600 border border-orange-100">
                          {lossPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-2  text-center whitespace-nowrap text-xs  text-slate-900">{scrapQty.toFixed(2)}</td>
                      <td className="p-2  text-center whitespace-nowrap text-sm text-slate-600">
                        ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2  text-center whitespace-nowrap">
                        <span className="text-sm  text-rose-600">
                          ₹{scrapAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="p-2  text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteSectionItem('scrap', s.id, s.isLocal)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded  transition-all"
                            title="Remove Scrap Item"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Side-by-Side Costing and Version History */}
      <div className={itemId && itemId !== 'bom-form' ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "w-full"}>
        {/* SECTION 6: BOM Costing */}
        <Card className={`p-0 border-slate-200 overflow-hidden ${!(itemId && itemId !== 'bom-form') ? 'w-full' : ''}`}>
          <div
            className="bg-white p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('costing')}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded  flex items-center justify-center text-white text-sm">₹</div>
              <div>
                <h4 className="text-sm  text-slate-800">BOM Costing</h4>
                <p className="text-xs text-slate-400  ">₹{totalBOMCost.toFixed(2)} Analysis Per Unit</p>
              </div>
            </div>
            <div className="text-slate-400">{collapsedSections.costing ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</div>
          </div>
          {!collapsedSections.costing && (
            <div className=" my-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <div className="p-2 bg-blue-50 rounded-md border border-blue-100">
                  <p className="text-xs text-blue-600  mb-1">Material Cost / FG</p>
                  <p className="text-xl  text-blue-900">₹{materialCostAfterScrap.toFixed(2)}</p>
                  <p className="text-xs text-blue-400  mt-1">(Materials + Components - Scrap)</p>
                </div>
                <div className="p-2 bg-purple-50 rounded-md border border-purple-100">
                  <p className="text-xs text-purple-600  mb-1">Operations Cost / FG</p>
                  <p className="text-xl  text-purple-900">₹{operationsCost.toFixed(2)}</p>
                  <p className="text-xs text-purple-400  mt-1">Based on (Cycle + Setup) / 60 * Rate</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-md border border-emerald-100">
                  <p className="text-xs text-emerald-600  mb-1">Total Cost / FG</p>
                  <p className="text-xl  text-emerald-900">₹{parseFloat(isReadOnly ? (productForm.bom_cost || totalBOMCost) : totalBOMCost).toFixed(2)}</p>
                  <p className="text-xs text-emerald-400  mt-1">Base Quantity: {batchQty}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-md overflow-hidden">
                <div className="divide-y divide-slate-50">
                  <div className="p-2  flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <span className="text-xs  text-slate-600">Components Cost:</span>
                    <span className="text-xs  text-slate-900">₹{componentsCost.toFixed(2)}</span>
                  </div>
                  <div className="p-2  flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <span className="text-xs  text-slate-600">Raw Materials Cost:</span>
                    <span className="text-xs  text-slate-900">₹{rawMaterialsCost.toFixed(2)}</span>
                  </div>
                  <div className="p-2  flex justify-between items-center hover:bg-slate-50 transition-colors text-red-600">
                    <span className="text-xs ">Scrap Loss (Deduction):</span>
                    <span className="text-xs ">-₹{scrapLoss.toFixed(2)}</span>
                  </div>
                  <div className="p-2  flex justify-between items-center bg-blue-50/50">
                    <span className="text-xs  text-blue-700 ">Material Cost (after Scrap):</span>
                    <span className="text-xs  text-blue-900 ">₹{materialCostAfterScrap.toFixed(2)}</span>
                  </div>
                  <div className="p-2  flex justify-between items-center hover:bg-slate-50 transition-colors text-purple-600">
                    <span className="text-xs ">Operations Cost:</span>
                    <span className="text-xs  text-purple-900 ">₹{operationsCost.toFixed(2)}</span>
                  </div>
                  <div className="p-2  flex justify-between items-center bg-amber-50/50">
                    <span className="text-xs  text-amber-700">Total Scrap Qty:</span>
                    <span className="text-xs  text-amber-900">{totalScrapQty.toFixed(2)} Kg</span>
                  </div>
                  <div className="p-2  flex justify-between items-center bg-slate-50  border-t border-slate-200">
                    <span className="text-xs text-slate-700">ORDER TOTAL ({batchQty} {productForm.uom}):</span>
                    <span className="text-sm text-slate-900">₹{(totalBOMCost * batchQty).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-2 bg-slate-200 rounded-md text-white">
                <span className="text-sm   ">Cost Per Unit:</span>
                <span className="text-xl ">₹{costPerUnit.toFixed(2)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* BOM Version History */}
        {(itemId && itemId !== 'bom-form') && (
          <Card className="p-0 border-slate-200 overflow-hidden h-full">
            <div className="bg-white  flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white text-sm">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm  text-slate-800">BOM Version History</h4>
                  <p className="text-xs text-slate-400">Manage BOM revisions and compare changes</p>
                </div>
              </div>
              <button
                onClick={() => handleCreateBOM('Active', true)}
                className="text-xs text-indigo-600  hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Save as New Version
              </button>
            </div>
            <div className=" my-2 overflow-auto max-h-[350px]">
              {loadingHistory ? (
                <div className="py-2 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
                  <p className="text-xs ">Retrieving version history...</p>
                </div>
              ) : bomHistory.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {bomHistory.map((v, idx) => {
                    const isViewing = String(v.id) === String(itemId);
                    const isLatest = idx === bomHistory.length - 1;
                    return (
                      <div
                        key={v.id || idx}
                        onClick={() => navigate(`/bom-form/${v.id}?view=true`)}
                        className={`group relative p-2 rounded border transition-all cursor-pointer ${isViewing
                          ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100'
                          : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 p-1 rounded flex items-center justify-center  text-xs ${isViewing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                              }`}>
                              V{v.version || '1'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm  text-slate-800">
                                  ₹{parseFloat(v.total_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                                {isLatest && (
                                  <span className="p-1 bg-emerald-100 text-emerald-700 rounded text-xs   ">Current</span>
                                )}
                                {(isViewing && !isLatest) && (
                                  <span className="p-1 bg-amber-100 text-amber-700 rounded text-xs   ">Viewing</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-500">
                                  {v.revision_date ? new Date(v.revision_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs  text-slate-600">{v.changed_by || 'SPTECH'}</div>
                            <div className="text-xs text-slate-400">Technical Design</div>

                          </div>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 items-end">
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVersion(v.id, v.version || '1');
                              }}
                              className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-100 hover:bg-rose-100 transition-colors flex items-center gap-1"
                              title="Permanently delete this version"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const effectiveSOItemId = (itemId && itemId !== 'bom-form') ? itemId : (selectedItem?.id);
                                handleUpdateQuotation(effectiveSOItemId, v.total_cost);
                              }}
                              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                              title="Update linked quotations with this value"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Update Quotation
                            </button>
                            <span className="text-xs text-indigo-600  flex items-center gap-1 group-hover:opacity-100 transition-opacity">
                              View Details <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-2 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded flex items-center justify-center mx-auto mb-3">
                    <History className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-400 ">No version history found for this item</p>
                  <p className="text-xs text-slate-300 mt-1">This appears to be the initial version.</p>
                </div>
              )}
            </div>
            <div className="p-2 border-t border-slate-50 bg-slate-50/30">
              <button
                onClick={() => navigate(`${deptPrefix}/bom-approval`)}
                className="text-xs text-indigo-600  hover:underline"
              >
                View Full Version History →
              </button>
            </div>
          </Card>
        )}

      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-2 pb-8">
        <Button
          variant="default"
          onClick={() => navigate(`${deptPrefix}/bom-creation`)}
        >
          {isReadOnly ? 'Back to List' : 'Cancel'}
        </Button>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button
              variant="light"
              onClick={() => handleCreateBOM('Draft')}
              icon={FileText}
            >
              Save as Draft
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleCreateBOM('Active', true)}
              icon={History}
            >
              Save as New Version
            </Button>
            <Button
              variant="primary"
              onClick={() => handleCreateBOM('Active')}
            >
              {itemId && itemId !== 'bom-form' ? 'Update BOM' : 'Create BOM'}
            </Button>
          </div>
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

