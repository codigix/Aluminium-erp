import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, StatusBadge, DataTable, SearchableSelect, Tabs, Button, FormControl } from '../components/ui.jsx';
import { Plus, Search, RefreshCw, Package, Layers, Trash2, Edit2, Copy, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, infoToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ItemsMaster = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'groups'
  const [itemsList, setItemsList] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemGroups, setItemGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [shapes, setShapes] = useState([]);
  const [shapesLoading, setShapesLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [approvedDrawings, setApprovedDrawings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Item Form State
  const [showItemForm, setShowItemForm] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    itemCode: '',
    itemName: '',
    itemGroup: '',
    defaultUom: 'Nos',
    valuationRate: 0,
    sellingRate: 0,
    noOfCavity: 1,
    weightPerUnit: 0,
    weightUom: '',
    drawingNo: '',
    revision: '',
    materialGrade: '',
    materialId: '',
    density: '',
    shapeId: '',
    length: '',
    width: '',
    thickness: '',
    diameter: '',
    outerDiameter: ''
  });
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Group Form State
  const [activeForm, setActiveForm] = useState('group'); // 'group', 'shape', 'material'
  const [groupFormData, setGroupFormData] = useState({ name: '', group_type: '', status: 'ACTIVE' });
  const [shapeFormData, setShapeFormData] = useState({ name: '', status: 'ACTIVE' });
  const [materialFormData, setMaterialFormData] = useState({ name: '', density: '', density_unit: 'g/cm³', status: 'ACTIVE' });
  
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  const [isEditingShape, setIsEditingShape] = useState(false);
  const [editingShapeId, setEditingShapeId] = useState(null);
  const [isSubmittingShape, setIsSubmittingShape] = useState(false);

  const [isEditingMaterial, setIsEditingMaterial] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);

  const fillFormFromItem = (item, isCopy = false) => {
    // Find the original group name if it was normalized
    let displayGroup = item.material_type || '';
    const matchingGroup = itemGroups.find(g => 
      g.name === displayGroup || 
      g.name.toUpperCase().replace(/ /g, '_') === displayGroup
    );
    if (matchingGroup) displayGroup = matchingGroup.name;

    setItemFormData({
      itemCode: isCopy ? '' : (item.item_code || ''),
      itemName: item.material_name || '',
      itemGroup: displayGroup,
      defaultUom: item.unit || 'Nos',
      valuationRate: item.valuation_rate || 0,
      sellingRate: item.selling_rate || 0,
      noOfCavity: item.no_of_cavity || 1,
      weightPerUnit: item.weight_per_unit || 0,
      weightUom: item.weight_uom || '',
      drawingNo: item.drawing_no || '',
      revision: item.revision || '',
      materialGrade: item.material_grade || '',
      materialId: item.material_id || '',
      density: item.density || '',
      shapeId: item.shape_id || '',
      length: item.length || '',
      width: item.width || '',
      thickness: item.thickness || '',
      diameter: item.diameter || '',
      outerDiameter: item.outer_diameter || ''
    });
  };

  useEffect(() => {
    const path = location.pathname;
    
    // For Edit and Copy, we need itemsList and itemGroups to be loaded
    const isEditPath = path.includes('/item-master/edit-item/');
    const isCopyPath = path.includes('/item-master/copy-item/');
    
    if (path.endsWith('/item-master/add-items')) {
      setActiveTab('items');
      if (!showItemForm || isEditingItem) {
        handleClearItemForm();
        
        // Handle initial data from state if present
        if (location.state?.item) {
          const { item } = location.state;
          setItemFormData(prev => ({
            ...prev,
            drawingNo: item.drawing_no || '',
            revision: item.revision_no || '',
            defaultUom: item.unit || 'Nos'
          }));
        }
        
        setShowItemForm(true);
        fetchNextItemCode();
      }
      return;
    }

    if (isEditPath || isCopyPath) {
      setActiveTab('items');
      if (itemsList.length === 0 || itemGroups.length === 0) return;
      
      const identifier = path.split('/').pop();
      const item = itemsList.find(i => (i.public_id === identifier) || (i.id.toString() === identifier));
      
      if (item) {
        const isCopy = isCopyPath;
        if (!showItemForm || isEditingItem !== (!isCopy) || editingItemId !== item.id) {
          fillFormFromItem(item, isCopy);
          setIsEditingItem(!isCopy);
          setEditingItemId(item.id);
          setShowItemForm(true);
          if (isCopy) {
            infoToast('Details copied. Please provide a new Item Code.');
          }
        }
      }
      return;
    }

    if (path.endsWith('/item-master/groups')) {
      setActiveTab('groups');
      if (showItemForm) {
        setShowItemForm(false);
        handleClearItemForm();
      }
      return;
    }

    // Default: Close form and reset tab if on base path
    if (path.endsWith('/item-master')) {
      if (showItemForm) {
        setShowItemForm(false);
        handleClearItemForm();
      }
      if (activeTab !== 'items') {
        setActiveTab('items');
      }
    }
  }, [location.pathname, location.state, itemsList, itemGroups, activeTab, isEditingItem, editingItemId, showItemForm]);

  useEffect(() => {
    fetchItemsList();
    fetchItemGroups();
    fetchShapes();
    fetchMaterials();
    fetchApprovedDrawings();
    
    // Check if we have initial data from navigation
    if (location.state?.addItem && !location.pathname.endsWith('/item-master/add-items')) {
      navigate(`${deptPrefix}/item-master/add-items`, { state: location.state, replace: true });
    }
  }, [location.state]);

  const fetchItemsList = useCallback(async () => {
    try {
      setItemsLoading(true);
      setItemsList([]); // Clear stale data
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance?includeAll=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItemsList(data);
      }
    } catch (error) {
      console.error('Failed to fetch items list:', error);
      errorToast('Failed to load items');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const fetchItemGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      setItemGroups([]); // Clear stale data
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
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const fetchShapes = useCallback(async () => {
    try {
      setShapesLoading(true);
      setShapes([]); // Clear stale data
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/shapes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setShapes(data);
      }
    } catch (error) {
      console.error('Failed to fetch shapes:', error);
    } finally {
      setShapesLoading(false);
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    try {
      setMaterialsLoading(true);
      setMaterials([]); // Clear stale data
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    } finally {
      setMaterialsLoading(false);
    }
  }, []);

  const fetchApprovedDrawings = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      setApprovedDrawings([]); // Clear stale data
      const response = await fetch(`${API_BASE}/drawings/approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApprovedDrawings(data);
      }
    } catch (error) {
      console.error('Failed to fetch approved drawings:', error);
    }
  }, []);

  const fetchNextItemCode = useCallback(async (itemName = '', itemGroup = '') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/items/next-code?itemName=${encodeURIComponent(itemName)}&itemGroup=${encodeURIComponent(itemGroup)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItemFormData(prev => ({ ...prev, itemCode: data.itemCode }));
      }
    } catch (error) {
      console.error('Failed to fetch next item code:', error);
    }
  }, []);

  const handleItemNameSelect = (e) => {
    const value = e.target.value;
    const drawing = approvedDrawings.find(d => d.drawing_no === value);
    const existingItem = itemsList.find(i => i.item_code === value || i.material_name === value);
    
    if (drawing) {
      const newFormData = {
        ...itemFormData,
        itemName: drawing.material_name || drawing.item_description || drawing.drawing_no,
        itemGroup: drawing.item_group || itemFormData.itemGroup,
        drawingNo: drawing.drawing_no || '',
        revision: drawing.revision_no || '',
        defaultUom: drawing.unit || itemFormData.defaultUom
      };
      setItemFormData(newFormData);
      
      if (!isEditingItem) {
        fetchNextItemCode(newFormData.itemName, newFormData.itemGroup);
      }
    } else if (existingItem) {
      const newFormData = {
        ...itemFormData,
        itemName: existingItem.material_name || existingItem.item_name,
        itemGroup: existingItem.material_type || existingItem.item_group || itemFormData.itemGroup,
        drawingNo: existingItem.drawing_no || '',
        revision: existingItem.revision || '',
        defaultUom: existingItem.unit || existingItem.uom || itemFormData.defaultUom,
        valuationRate: existingItem.valuation_rate || 0
      };
      setItemFormData(newFormData);
      
      if (!isEditingItem) {
        fetchNextItemCode(newFormData.itemName, newFormData.itemGroup);
      }
    } else {
      setItemFormData(prev => ({ 
        ...prev, 
        itemName: value,
        drawingNo: '' 
      }));
      if (!isEditingItem) {
        fetchNextItemCode(value, itemFormData.itemGroup);
      }
    }
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    if (!itemFormData.itemCode || !itemFormData.itemName || !itemFormData.itemGroup) {
      errorToast('Please fill all required fields');
      return;
    }
    
    setIsSubmittingItem(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = isEditingItem ? `${API_BASE}/stock/items/${editingItemId}` : `${API_BASE}/stock/items`;
      const method = isEditingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(itemFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditingItem ? 'update' : 'create'} item`);
      }
      
      successToast(`Item ${isEditingItem ? 'updated' : 'created'} successfully`);
      fetchItemsList();
      navigate(`${deptPrefix}/item-master`);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleClearItemForm = () => {
    setItemFormData({
      itemCode: '',
      itemName: '',
      itemGroup: '',
      defaultUom: 'Nos',
      valuationRate: 0,
      sellingRate: 0,
      noOfCavity: 1,
      weightPerUnit: 0,
      weightUom: '',
      drawingNo: '',
      revision: '',
      materialGrade: '',
      materialId: '',
      density: '',
      shapeId: '',
      length: '',
      width: '',
      thickness: '',
      diameter: '',
      outerDiameter: ''
    });
    setIsEditingItem(false);
    setEditingItemId(null);
  };

  const handleEditItem = useCallback((item) => {
    navigate(`${deptPrefix}/item-master/edit-item/${item.public_id || item.id}`);
  }, [navigate, deptPrefix]);

  const handleCopyItem = useCallback((item) => {
    navigate(`${deptPrefix}/item-master/copy-item/${item.public_id || item.id}`);
  }, [navigate, deptPrefix]);

  const handleDeleteItem = useCallback(async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/stock/items/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete item');

        successToast('Item has been deleted.');
        fetchItemsList();
      } catch (error) {
        errorToast(error.message);
      }
    }
  }, [fetchItemsList]);

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingGroup(true);
      const token = localStorage.getItem('authToken');
      const url = isEditingGroup ? `${API_BASE}/item-groups/${editingGroupId}` : `${API_BASE}/item-groups`;
      const method = isEditingGroup ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(groupFormData)
      });
      
      if (!response.ok) throw new Error('Failed to save item group');
      
      successToast(isEditingGroup ? 'Item group updated' : 'Item group added');
      fetchItemGroups();
      setGroupFormData({ name: '', group_type: '', status: 'ACTIVE' });
      setIsEditingGroup(false);
      setEditingGroupId(null);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleShapeSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingShape(true);
      const token = localStorage.getItem('authToken');
      const url = isEditingShape ? `${API_BASE}/shapes/${editingShapeId}` : `${API_BASE}/shapes`;
      const method = isEditingShape ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(shapeFormData)
      });
      
      if (!response.ok) throw new Error('Failed to save shape');
      
      successToast(isEditingShape ? 'Shape updated' : 'Shape added');
      fetchShapes();
      setShapeFormData({ name: '', status: 'ACTIVE' });
      setIsEditingShape(false);
      setEditingShapeId(null);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmittingShape(false);
    }
  };

  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingMaterial(true);
      const token = localStorage.getItem('authToken');
      const url = isEditingMaterial ? `${API_BASE}/materials/${editingMaterialId}` : `${API_BASE}/materials`;
      const method = isEditingMaterial ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(materialFormData)
      });
      
      if (!response.ok) throw new Error('Failed to save material');
      
      successToast(isEditingMaterial ? 'Material updated' : 'Material added');
      fetchMaterials();
      setMaterialFormData({ name: '', density: '', density_unit: 'g/cm³', status: 'ACTIVE' });
      setIsEditingMaterial(false);
      setEditingMaterialId(null);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  const handleDeleteShape = useCallback((id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "Delete this shape?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_BASE}/shapes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error('Failed to delete shape');
          successToast('Shape deleted');
          fetchShapes();
        } catch (error) {
          errorToast(error.message);
        }
      }
    });
  }, [fetchShapes]);

  const handleDeleteMaterial = useCallback((id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "Delete this material?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_BASE}/materials/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error('Failed to delete material');
          successToast('Material deleted');
          fetchMaterials();
        } catch (error) {
          errorToast(error.message);
        }
      }
    });
  }, [fetchMaterials]);

  const handleDeleteGroup = useCallback((id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "Delete this item group?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_BASE}/item-groups/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error('Failed to delete item group');
          successToast('Item group deleted');
          fetchItemGroups();
        } catch (error) {
          errorToast(error.message);
        }
      }
    });
  }, [fetchItemGroups]);

  const itemColumns = useMemo(() => [
    { label: 'Item Code', key: 'item_code', sortable: true, className: ' text-indigo-600' },
    { 
      label: 'Item Name', 
      key: 'material_name', 
      sortable: true,
      render: (val, row) => {
        const shapeName = (shapes.find(s => String(s.id) === String(row.shape_id))?.name || '').toLowerCase().trim();
        const dims = [];
        
        if (shapeName === 'plate') {
          if (row.length) dims.push(`${parseFloat(row.length)}mm`);
          if (row.width) dims.push(`${parseFloat(row.width)}mm`);
          if (row.thickness) dims.push(`${parseFloat(row.thickness)}mm`);
        } else if (shapeName === 'round') {
          if (row.diameter) dims.push(`D:${parseFloat(row.diameter)}mm`);
          if (row.length) dims.push(`${parseFloat(row.length)}mm`);
        } else if (shapeName === 'pipe') {
          if (row.outer_diameter) dims.push(`OD:${parseFloat(row.outer_diameter)}mm`);
          if (row.thickness) dims.push(`${parseFloat(row.thickness)}mm`);
          if (row.length) dims.push(`${parseFloat(row.length)}mm`);
        } else {
          // Fallback for other shapes
          if (row.length) dims.push(`${parseFloat(row.length)}mm`);
          if (row.width) dims.push(`${parseFloat(row.width)}mm`);
          if (row.thickness) dims.push(`${parseFloat(row.thickness)}mm`);
          if (row.diameter) dims.push(`D:${parseFloat(row.diameter)}mm`);
          if (row.outer_diameter) dims.push(`OD:${parseFloat(row.outer_diameter)}mm`);
        }
        
        return (
          <div className="flex flex-col">
            <span className=" text-slate-900">{val}</span>
            {dims.length > 0 && (
              <span className="text-xs  text-slate-400 mt-0.5">
                {dims.join(' x ')}
              </span>
            )}
          </div>
        );
      }
    },
    { label: 'Group', key: 'material_type', sortable: true, render: (val) => <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{val}</span> },
    { 
      label: 'Unit Details', 
      key: 'unit', 
      sortable: true,
      render: (val, row) => {
        const weight = parseFloat(row.weight_per_unit || 0);
        if (weight > 0) {
          return `${weight.toFixed(3)} ${row.weight_uom || 'Kg'}`;
        }
        return `1 ${val || 'Nos'}`;
      }
    },
    { 
      label: 'Stock', 
      key: 'current_balance', 
      sortable: true,
      render: (val, row) => {
        const balance = parseFloat(row.current_balance || 0);
        const isLow = balance <= 0;
        const uom = row.unit || 'Nos';
        
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-semibold ${isLow ? 'text-amber-700' : 'text-slate-700'}`}>
                  {balance.toLocaleString('en-IN', { minimumFractionDigits: row.weight_per_unit > 0 ? 3 : 2 })}
                </span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs    ">
                  {uom}
                </span>
              </div>
            </div>
            {isLow && (
              <div className="flex items-center gap-1 text-[9px] text-amber-600  mt-0.5 ml-3.5">
                <AlertTriangle size={10} />
                <span>LOW STOCK</span>
              </div>
            )}
          </div>
        );
      }
    },
    { 
      label: 'Valuation Rate (₹)', 
      key: 'valuation_rate', 
      sortable: true, 
      className: 'text-right text-slate-700',
      render: (val) => `₹${(parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
    },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val || 'ACTIVE'} /> },
    { 
      label: 'Actions', 
      key: 'actions', 
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => handleCopyItem(row)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded" title="Copy"><Copy size={14} /></button>
          <button onClick={() => handleEditItem(row)} className="p-1 text-amber-500 hover:bg-amber-50 rounded" title="Edit"><Edit2 size={14} /></button>
          <button onClick={() => handleDeleteItem(row.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Delete"><Trash2 size={14} /></button>
        </div>
      )
    }
  ], [shapes, handleCopyItem, handleEditItem, handleDeleteItem]);

  const groupColumns = useMemo(() => [
    { label: 'Group Name', key: 'name', sortable: true, className: '' },
    { label: 'Type', key: 'group_type', sortable: true, render: (val) => <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-xs">{val || 'OTHER'}</span> },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val || 'ACTIVE'} /> },
    { 
      label: 'Actions', 
      key: 'actions', 
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => { setActiveForm('group'); setGroupFormData({ name: row.name, group_type: row.group_type || 'OTHER', status: row.status || 'ACTIVE' }); setIsEditingGroup(true); setEditingGroupId(row.id); }} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Edit2 size={14} /></button>
          <button onClick={() => handleDeleteGroup(row.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={14} /></button>
        </div>
      )
    }
  ], [handleDeleteGroup]);

  const shapeColumns = useMemo(() => [
    { label: 'Shape Name', key: 'name', sortable: true, className: '' },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val || 'ACTIVE'} /> },
    { 
      label: 'Actions', 
      key: 'actions', 
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => { setActiveForm('shape'); setShapeFormData({ name: row.name, status: row.status || 'ACTIVE' }); setIsEditingShape(true); setEditingShapeId(row.id); }} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Edit2 size={14} /></button>
          <button onClick={() => handleDeleteShape(row.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={14} /></button>
        </div>
      )
    }
  ], [handleDeleteShape]);

  const materialColumns = useMemo(() => [
    { label: 'Material Name', key: 'name', sortable: true, className: '' },
    { label: 'Density', key: 'density', sortable: true, render: (val, row) => `${parseFloat(val).toFixed(4)} ${row.density_unit || 'g/cm³'}` },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val || 'ACTIVE'} /> },
    { 
      label: 'Actions', 
      key: 'actions', 
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => { setActiveForm('material'); setMaterialFormData({ name: row.name, density: row.density, density_unit: row.density_unit || 'g/cm³', status: row.status || 'ACTIVE' }); setIsEditingMaterial(true); setEditingMaterialId(row.id); }} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Edit2 size={14} /></button>
          <button onClick={() => handleDeleteMaterial(row.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={14} /></button>
        </div>
      )
    }
  ], [handleDeleteMaterial]);

  const selectedShape = (shapes.find(s => String(s.id) === String(itemFormData.shapeId))?.name || '').trim();

  // Auto-calculate Weight per Unit
  useEffect(() => {
    const shape = selectedShape.toLowerCase();
    const density = parseFloat(itemFormData.density) || 0;
    let calculatedWeight = 0;

    if (density > 0) {
      if (shape === 'plate') {
        const l = parseFloat(itemFormData.length) || 0;
        const w = parseFloat(itemFormData.width) || 0;
        const t = parseFloat(itemFormData.thickness) || 0;
        // Formula: L * W * T * Density / 1,000,000
        calculatedWeight = (l * w * t * density) / 1000000;
      } else if (shape === 'round') {
        const d = parseFloat(itemFormData.diameter) || 0;
        const l = parseFloat(itemFormData.length) || 0;
        // Formula: π * (D² / 4) * Length * Density / 1,000,000
        calculatedWeight = (Math.PI * Math.pow(d, 2) / 4 * l * density) / 1000000;
      } else if (shape === 'pipe') {
        const od = parseFloat(itemFormData.outerDiameter) || 0;
        const t = parseFloat(itemFormData.thickness) || 0;
        const l = parseFloat(itemFormData.length) || 0;
        const id = od - (2 * t);
        // Formula: π * (OD² - ID²) / 4 * Length * Density / 1,000,000
        if (id >= 0) {
          calculatedWeight = (Math.PI * (Math.pow(od, 2) - Math.pow(id, 2)) / 4 * l * density) / 1000000;
        }
      }
    }

    if (calculatedWeight > 0) {
      setItemFormData(prev => ({
        ...prev,
        weightPerUnit: parseFloat(calculatedWeight.toFixed(3)),
        weightUom: 'Kg'
      }));
    }
  }, [
    itemFormData.length, 
    itemFormData.width, 
    itemFormData.thickness, 
    itemFormData.diameter, 
    itemFormData.outerDiameter, 
    itemFormData.density, 
    selectedShape
  ]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return itemsList.filter(item => 
      item.item_code?.toLowerCase().includes(term) ||
      item.material_name?.toLowerCase().includes(term) ||
      item.drawing_no?.toLowerCase().includes(term)
    );
  }, [itemsList, searchTerm]);

  return (
    <div className=" space-y-2  animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl   text-slate-900 ">Items Master</h1>
          <p className="text-sm text-slate-500">Manage your products, materials, and categories</p>
        </div>
        
        <Tabs
          tabs={[
            { id: 'items', label: 'Items List', icon: Package },
            { id: 'groups', label: 'Item Groups', icon: Layers }
          ]}
          activeTab={activeTab}
          onTabChange={(id) => navigate(id === 'items' ? `${deptPrefix}/item-master` : `${deptPrefix}/item-master/groups`)}
        />
      </div>

      {activeTab === 'items' && !showItemForm && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Search items by code, name, or drawing..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary"
                onClick={fetchItemsList}
                title="Refresh"
                icon={RefreshCw}
                className={itemsLoading ? 'animate-spin' : ''}
              />
              <Button 
                variant="primary"
                onClick={() => navigate(`${deptPrefix}/item-master/add-items`)}
                icon={Plus}
              >
                Add New Item
              </Button>
            </div>
          </div>
          <div className="p-0">
            <DataTable 
              columns={itemColumns}
              data={filteredItems}
              loading={itemsLoading}
              pageSize={10}
              hideHeader={false}
            />
          </div>
        </Card>
      )}

      {activeTab === 'items' && showItemForm && (
        <Card className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded">
                <Package size={20} />
              </div>
              <div>
                <h2 className="text-lg  text-slate-900">{isEditingItem ? 'Edit Item' : 'Add New Item'}</h2>
                <p className="text-xs text-slate-500">Define item specifications and valuation</p>
              </div>
            </div>
            <Button 
              variant="secondary"
              onClick={() => navigate(`${deptPrefix}/item-master`)}
            >
              Cancel
            </Button>
          </div>
          <form onSubmit={handleItemSubmit} className="p-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-xs  text-slate-500  ">Item Code *</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. ITM-001"
                    value={itemFormData.itemCode}
                    onChange={(e) => setItemFormData({...itemFormData, itemCode: e.target.value})}
                    required
                  />
                  {!isEditingItem && (
                    <button 
                      type="button"
                      onClick={() => fetchNextItemCode(itemFormData.itemName, itemFormData.itemGroup)}
                      className="p-2 bg-slate-100 text-slate-600 rounded  hover:bg-slate-200 transition-all border border-slate-200"
                      title="Generate Code"
                    >
                      <RefreshCw size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs  text-slate-500  ">Item Name *</label>
                <SearchableSelect 
                  options={[
                    ...approvedDrawings.map(d => ({
                      label: d.material_name || d.item_description || d.drawing_no,
                      value: d.drawing_no,
                      subLabel: `Drawing: ${d.drawing_no} | Client: ${d.client_name || 'N/A'}`
                    })),
                    ...itemsList.map(item => ({
                      label: item.material_name || item.item_name,
                      value: item.item_code,
                      subLabel: `Item: ${item.item_code} | Group: ${item.material_type || item.item_group}`
                    }))
                  ]}
                  value={itemFormData.drawingNo || itemFormData.itemName}
                  onChange={handleItemNameSelect}
                  placeholder="Enter or select item name"
                  allowCustom={true}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs  text-slate-500  ">Item Group *</label>
                <select 
                  className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                  value={itemFormData.itemGroup}
                  onChange={(e) => {
                    const group = e.target.value;
                    setItemFormData({...itemFormData, itemGroup: group});
                    if (!isEditingItem) fetchNextItemCode(itemFormData.itemName, group);
                  }}
                  required
                >
                  <option value="">Select Item Group</option>
                  {itemGroups.map(group => (
                    <option key={group.id} value={group.name}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs  text-slate-500  ">UOM</label>
                <select 
                  className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={itemFormData.defaultUom}
                  onChange={(e) => setItemFormData({...itemFormData, defaultUom: e.target.value})}
                >
                  <option value="Nos">Nos</option>
                  <option value="Kg">Kg</option>
                  <option value="Mtr">Mtr</option>
                  <option value="Set">Set</option>
                  <option value="Pkt">Pkt</option>
                  <option value="Litre (Ltr)">Litre (Ltr)</option>
                  <option value="Millilitre (ml)">Millilitre (ml)</option>
                  <option value="Cubic Meter (m³)">Cubic Meter (m³)</option>
                  <option value="Millimeter (mm)">Millimeter (mm)</option>
                  <option value="Feet (ft)">Feet (ft)</option>
                  <option value="Inch (in)">Inch (in)</option>
                  <option value="Gram (g)">Gram (g)</option>
                  <option value="Ton">Ton</option>
                  <option value="Metric Ton (MT)">Metric Ton (MT)</option>
                </select>
              </div>

              {((['RAW MATERIALS', 'RAW MATERIAL', 'RAW_MATERIALS', 'RAW_MATERIAL', 'RM', 'CONSUMABLES', 'CONSUMABLE', 'CON'].includes(itemFormData.itemGroup?.toUpperCase().trim()) && itemFormData.defaultUom === 'Kg') || 
                (['CONSUMABLES', 'CONSUMABLE', 'CON'].includes(itemFormData.itemGroup?.toUpperCase().trim()) && itemFormData.defaultUom === 'Litre (Ltr)')) && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Select Material Type</label>
                    <select 
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={itemFormData.materialId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        const selectedMaterial = materials.find(m => String(m.id) === String(mId));
                        setItemFormData({
                          ...itemFormData, 
                          materialId: mId,
                          density: selectedMaterial ? selectedMaterial.density : ''
                        });
                      }}
                    >
                      <option value="">Select Material</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.density ? `[Density = ${parseFloat(m.density).toFixed(4)} ${m.density_unit || 'g/cm³'}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {itemFormData.defaultUom === 'Kg' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">Select Shape Type</label>
                        <select 
                          className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          value={itemFormData.shapeId}
                          onChange={(e) => setItemFormData({...itemFormData, shapeId: e.target.value})}
                        >
                          <option value="">Select Shape</option>
                          {shapes.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedShape && (
                        <div className="md:col-span-3 p-4 bg-indigo-50/50 rounded border border-indigo-100 space-y-3">
                          <div className="flex items-center gap-2 text-indigo-700  text-sm">
                            <div className="w-1.5 h-1.5 rounded bg-indigo-500"></div>
                            {selectedShape} Dimensions (All in mm)
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {selectedShape.toLowerCase() === 'plate' && (
                              <>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Length (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.length} onChange={(e) => setItemFormData({...itemFormData, length: e.target.value})} required />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Width (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.width} onChange={(e) => setItemFormData({...itemFormData, width: e.target.value})} required />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Thickness (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.thickness} onChange={(e) => setItemFormData({...itemFormData, thickness: e.target.value})} required />
                                </div>
                              </>
                            )}
                            {selectedShape.toLowerCase() === 'round' && (
                              <>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Diameter (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.diameter} onChange={(e) => setItemFormData({...itemFormData, diameter: e.target.value})} required />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Length (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.length} onChange={(e) => setItemFormData({...itemFormData, length: e.target.value})} required />
                                </div>
                              </>
                            )}
                            {selectedShape.toLowerCase() === 'pipe' && (
                              <>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Outer Diameter (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.outerDiameter} onChange={(e) => setItemFormData({...itemFormData, outerDiameter: e.target.value})} required />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Thickness (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.thickness} onChange={(e) => setItemFormData({...itemFormData, thickness: e.target.value})} required />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs    font-semibold text-slate-400">Length (mm) *</label>
                                  <input type="number" step="0.01" className="w-full p-2 bg-white border border-slate-200 rounded text-xs" placeholder="0.00" value={itemFormData.length} onChange={(e) => setItemFormData({...itemFormData, length: e.target.value})} required />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Weight per Unit</label>
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            step="0.001"
                            className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={itemFormData.weightPerUnit}
                            onChange={(e) => setItemFormData({...itemFormData, weightPerUnit: parseFloat(e.target.value) || 0})}
                          />
                          <select 
                            className="w-24 p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={itemFormData.weightUom}
                            onChange={(e) => setItemFormData({...itemFormData, weightUom: e.target.value})}
                          >
                            <option value="">UOM</option>
                            <option value="Nos">Nos</option>
                            <option value="Kg">Kg</option>
                            <option value="Mtr">Mtr</option>
                            <option value="Set">Set</option>
                            <option value="Pkt">Pkt</option>
                            <option value="Litre (Ltr)">Litre (Ltr)</option>
                            <option value="Millilitre (ml)">Millilitre (ml)</option>
                            <option value="Cubic Meter (m³)">Cubic Meter (m³)</option>
                            <option value="Millimeter (mm)">Millimeter (mm)</option>
                            <option value="Feet (ft)">Feet (ft)</option>
                            <option value="Inch (in)">Inch (in)</option>
                            <option value="Gram (g)">Gram (g)</option>
                            <option value="Ton">Ton</option>
                            <option value="Metric Ton (MT)">Metric Ton (MT)</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs  text-slate-500  ">Valuation Rate (₹)</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={itemFormData.valuationRate}
                  onChange={(e) => setItemFormData({...itemFormData, valuationRate: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-50 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => navigate(`${deptPrefix}/item-master`)}
                className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleClearItemForm}
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-50 transition-all"
              >
                Clear Form
              </button>
              <button 
                type="submit" 
                disabled={isSubmittingItem}
                className="p-2 bg-indigo-600 text-white rounded text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
              >
                {isSubmittingItem ? 'Saving...' : (isEditingItem ? 'Update Item' : 'Save Item')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
          <Card className="lg:col-span-1 bg-white h-fit sticky top-2 p-0 overflow-hidden">
            <div className="flex flex-col">
              {[
                { id: 'group', label: 'Item Groups', icon: Layers },
                { id: 'shape', label: 'Shape Master', icon: Plus },
                { id: 'material', label: 'Material Master', icon: Plus }
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setActiveForm(item.id)}
                  className={`w-full flex items-center gap-3 p-4 text-sm transition-all border-b border-slate-50 last:border-0 ${
                    activeForm === item.id 
                      ? 'bg-rose-50 text-rose-700  border-r-2 border-r-rose-500' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon size={18} className={activeForm === item.id ? 'text-rose-600' : 'text-slate-400'} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="p-4 bg-slate-50/50">
              {activeForm === 'group' && (
                <form onSubmit={handleGroupSubmit} className="space-y-4">
                  <FormControl label="Group Name" required>
                    <input 
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                      placeholder="e.g. Raw Material"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                      required
                    />
                  </FormControl>
                  <FormControl label="Group Type" required>
                    <select 
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                      value={groupFormData.group_type}
                      onChange={(e) => setGroupFormData({...groupFormData, group_type: e.target.value})}
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="RM">RM (Raw Material)</option>
                      <option value="PART">PART</option>
                      <option value="ASSEMBLY">ASSEMBLY</option>
                      <option value="CON">CON (Consumables)</option>
                      <option value="PAC">PAC (Packing Material)</option>
                      <option value="SCRAP">SCRAP</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </FormControl>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="primary"
                      type="submit" 
                      disabled={isSubmittingGroup}
                      className="flex-1"
                    >
                      {isSubmittingGroup ? 'Saving...' : (isEditingGroup ? 'Update' : 'Save Group')}
                    </Button>
                    {isEditingGroup && (
                      <Button 
                        variant="secondary"
                        onClick={() => { setIsEditingGroup(false); setGroupFormData({ name: '', group_type: '', status: 'ACTIVE' }); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              )}

              {activeForm === 'shape' && (
                <form onSubmit={handleShapeSubmit} className="space-y-4">
                  <FormControl label="Shape Name" required>
                    <input 
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                      placeholder="e.g. Plate, Round"
                      value={shapeFormData.name}
                      onChange={(e) => setShapeFormData({...shapeFormData, name: e.target.value})}
                      required
                    />
                  </FormControl>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="primary"
                      type="submit" 
                      disabled={isSubmittingShape}
                      className="flex-1"
                    >
                      {isSubmittingShape ? 'Saving...' : (isEditingShape ? 'Update' : 'Save Shape')}
                    </Button>
                    {isEditingShape && (
                      <Button 
                        variant="secondary"
                        onClick={() => { setIsEditingShape(false); setShapeFormData({ name: '', status: 'ACTIVE' }); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              )}

              {activeForm === 'material' && (
                <form onSubmit={handleMaterialSubmit} className="space-y-4">
                  <FormControl label="Material Name" required>
                    <input 
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                      placeholder="e.g. Aluminum 6063"
                      value={materialFormData.name}
                      onChange={(e) => setMaterialFormData({...materialFormData, name: e.target.value})}
                      required
                    />
                  </FormControl>
                  <FormControl label="Density" required>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        step="0.0001"
                        className="flex-1 p-2 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        placeholder="e.g. 2.7"
                        value={materialFormData.density}
                        onChange={(e) => setMaterialFormData({...materialFormData, density: e.target.value})}
                        required
                      />
                      <select
                        className="w-28 p-2 bg-white border border-slate-200 rounded text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        value={materialFormData.density_unit}
                        onChange={(e) => setMaterialFormData({...materialFormData, density_unit: e.target.value})}
                        required
                      >
                        <option value="g/cm³">g/cm³</option>
                        <option value="g/mL">g/mL</option>
                      </select>
                    </div>
                  </FormControl>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="primary"
                      type="submit" 
                      disabled={isSubmittingMaterial}
                      className="flex-1"
                    >
                      {isSubmittingMaterial ? 'Saving...' : (isEditingMaterial ? 'Update' : 'Save Material')}
                    </Button>
                    {isEditingMaterial && (
                      <Button 
                        variant="secondary"
                        onClick={() => { setIsEditingMaterial(false); setMaterialFormData({ name: '', density: '', density_unit: 'g/cm³', status: 'ACTIVE' }); }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </Card>

          <Card className="lg:col-span-3">
            <div className="p-4 border-b border-slate-100 bg-white">
              <h3 className="text-lg  text-slate-800 flex items-center gap-2">
                <Layers size={20} className="text-rose-500" /> 
                {activeForm === 'group' ? 'Item Groups' : activeForm === 'shape' ? 'Shapes' : 'Materials'}
              </h3>
            </div>
            <div className="p-0">
              {activeForm === 'group' && (
                <DataTable columns={groupColumns} data={itemGroups} loading={groupsLoading} pageSize={10} />
              )}
              {activeForm === 'shape' && (
                <DataTable columns={shapeColumns} data={shapes} loading={shapesLoading} pageSize={10} />
              )}
              {activeForm === 'material' && (
                <DataTable columns={materialColumns} data={materials} loading={materialsLoading} pageSize={10} />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ItemsMaster;
