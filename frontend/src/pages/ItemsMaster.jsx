import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, StatusBadge, DataTable, SearchableSelect } from '../components/ui.jsx';
import { Plus, Search, RefreshCw, Package, Layers, Trash2, Edit2, Copy } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, infoToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const ItemsMaster = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'groups'
  const [itemsList, setItemsList] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemGroups, setItemGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
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
    materialGrade: ''
  });
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Group Form State
  const [groupFormData, setGroupFormData] = useState({ name: '', group_type: '', status: 'ACTIVE' });
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  useEffect(() => {
    fetchItemsList();
    fetchItemGroups();
    fetchApprovedDrawings();
    
    // Check if we have initial data from navigation
    if (location.state?.addItem) {
      const { item } = location.state;
      if (item) {
        setItemFormData(prev => ({
          ...prev,
          drawingNo: item.drawing_no || '',
          revision: item.revision_no || '',
          defaultUom: item.unit || 'Nos'
        }));
      }
      setShowItemForm(true);
    }
  }, [location.state]);

  const fetchItemsList = async () => {
    try {
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
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
  };

  const fetchItemGroups = async () => {
    try {
      setGroupsLoading(true);
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
  };

  const fetchApprovedDrawings = async () => {
    try {
      const token = localStorage.getItem('authToken');
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
  };

  const fetchNextItemCode = async (itemName = '', itemGroup = '') => {
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
  };

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
      setShowItemForm(false);
      handleClearItemForm();
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
      materialGrade: ''
    });
    setIsEditingItem(false);
    setEditingItemId(null);
  };

  const handleEditItem = (item) => {
    setIsEditingItem(true);
    setEditingItemId(item.id);
    setItemFormData({
      itemCode: item.item_code || '',
      itemName: item.material_name || '',
      itemGroup: item.material_type || '',
      defaultUom: item.unit || 'Nos',
      valuationRate: item.valuation_rate || 0,
      sellingRate: item.selling_rate || 0,
      noOfCavity: item.no_of_cavity || 1,
      weightPerUnit: item.weight_per_unit || 0,
      weightUom: item.weight_uom || '',
      drawingNo: item.drawing_no || '',
      revision: item.revision || '',
      materialGrade: item.material_grade || ''
    });
    setShowItemForm(true);
  };

  const handleCopyItem = (item) => {
    setItemFormData({
      itemCode: '',
      itemName: item.material_name || '',
      itemGroup: item.material_type || '',
      defaultUom: item.unit || 'Nos',
      valuationRate: item.valuation_rate || 0,
      sellingRate: item.selling_rate || 0,
      noOfCavity: item.no_of_cavity || 1,
      weightPerUnit: item.weight_per_unit || 0,
      weightUom: item.weight_uom || '',
      drawingNo: item.drawing_no || '',
      revision: item.revision || '',
      materialGrade: item.material_grade || ''
    });
    setIsEditingItem(false);
    setEditingItemId(null);
    setShowItemForm(true);
    infoToast('Details copied. Please provide a new Item Code.');
  };

  const handleDeleteItem = async (id) => {
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
  };

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

  const handleDeleteGroup = (id) => {
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
  };

  const itemColumns = [
    { label: 'Item Code', key: 'item_code', sortable: true, className: 'font-bold text-indigo-600' },
    { label: 'Item Name', key: 'material_name', sortable: true },
    { label: 'Group', key: 'material_type', sortable: true, render: (val) => <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{val}</span> },
    { label: 'UOM', key: 'unit', sortable: true },
    { 
      label: 'Valuation Rate (₹)', 
      key: 'valuation_rate', 
      sortable: true, 
      className: 'text-right font-medium text-slate-700',
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
  ];

  const groupColumns = [
    { label: 'Group Name', key: 'name', sortable: true, className: 'font-medium' },
    { label: 'Type', key: 'group_type', sortable: true, render: (val) => <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px]">{val || 'OTHER'}</span> },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status={val || 'ACTIVE'} /> },
    { 
      label: 'Actions', 
      key: 'actions', 
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => { setGroupFormData({ name: row.name, group_type: row.group_type || 'OTHER', status: row.status || 'ACTIVE' }); setIsEditingGroup(true); setEditingGroupId(row.id); }} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Edit2 size={14} /></button>
          <button onClick={() => handleDeleteGroup(row.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={14} /></button>
        </div>
      )
    }
  ];

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Items Master</h1>
            <p className="text-sm text-slate-500 font-medium">Manage your products, materials, and categories</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'items' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package size={16} /> Items List
          </button>
          <button 
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'groups' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Layers size={16} /> Item Groups
          </button>
        </div>
      </div>

      {activeTab === 'items' && !showItemForm && (
        <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text"
                placeholder="Search items by code, name, or drawing..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchItemsList}
                className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-slate-200"
                title="Refresh"
              >
                <RefreshCw size={18} className={itemsLoading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => { handleClearItemForm(); setShowItemForm(true); fetchNextItemCode(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Plus size={18} /> Add New Item
              </button>
            </div>
          </div>
          <div className="p-2">
            <DataTable 
              columns={itemColumns}
              data={itemsList.filter(item => 
                item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.material_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.drawing_no?.toLowerCase().includes(searchTerm.toLowerCase())
              )}
              loading={itemsLoading}
              pageSize={5}
              hideHeader={true}
            />
          </div>
        </Card>
      )}

      {activeTab === 'items' && showItemForm && (
        <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Plus size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{isEditingItem ? 'Edit Item' : 'Add New Item'}</h2>
            </div>
            <button 
              onClick={() => setShowItemForm(false)}
              className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-bold transition-all"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleItemSubmit} className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Code *</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. ITM-001"
                    value={itemFormData.itemCode}
                    onChange={(e) => setItemFormData({...itemFormData, itemCode: e.target.value})}
                    required
                  />
                  {!isEditingItem && (
                    <button 
                      type="button"
                      onClick={() => fetchNextItemCode(itemFormData.itemName, itemFormData.itemGroup)}
                      className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all border border-slate-200"
                      title="Generate Code"
                    >
                      <RefreshCw size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name *</label>
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Group *</label>
                <select 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">UOM</label>
                <select 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valuation Rate (₹)</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={itemFormData.valuationRate}
                  onChange={(e) => setItemFormData({...itemFormData, valuationRate: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weight per Unit</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    step="0.001"
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={itemFormData.weightPerUnit}
                    onChange={(e) => setItemFormData({...itemFormData, weightPerUnit: parseFloat(e.target.value) || 0})}
                  />
                  <select 
                    className="w-24 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
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
            </div>
            
            <div className="pt-6 border-t border-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={handleClearItemForm}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Clear Form
              </button>
              <button 
                type="submit" 
                disabled={isSubmittingItem}
                className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
              >
                {isSubmittingItem ? 'Saving...' : (isEditingItem ? 'Update Item' : 'Save Item')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          <Card className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 h-fit sticky top-4">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Plus size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{isEditingGroup ? 'Edit Group' : 'Add New Group'}</h2>
              </div>
            </div>
            <form onSubmit={handleGroupSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Group Name *</label>
                <input 
                  type="text"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Raw Material"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Group Type *</label>
                <select 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={groupFormData.group_type}
                  onChange={(e) => setGroupFormData({...groupFormData, group_type: e.target.value})}
                  required
                >
                  <option value="">Select Type</option>
                  <option value="RM">RM (Raw Material)</option>
                  <option value="FG">FG (Finished Goods)</option>
                  <option value="SFG">SFG (Semi-Finished Goods)</option>
                  <option value="SA">SA (Sub-Assembly)</option>
                  <option value="CON">CON (Consumables)</option>
                  <option value="PAC">PAC (Packing Material)</option>
                  <option value="SCRAP">SCRAP</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmittingGroup}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isSubmittingGroup ? 'Saving...' : (isEditingGroup ? 'Update' : 'Add Group')}
                </button>
                {isEditingGroup && (
                  <button 
                    type="button"
                    onClick={() => { setIsEditingGroup(false); setGroupFormData({ name: '', group_type: '', status: 'ACTIVE' }); }}
                    className="px-4 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </Card>

          <Card className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers size={20} className="text-indigo-600" />
                Existing Groups
              </h2>
              <button 
                onClick={fetchItemGroups}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <RefreshCw size={18} className={groupsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="p-2">
              <DataTable 
                columns={groupColumns}
                data={itemGroups}
                loading={groupsLoading}
                hideHeader={true}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ItemsMaster;
