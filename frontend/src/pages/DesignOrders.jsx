import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatusBadge, Modal } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { getFileUrl } from '../utils/url';
import { Plus, Search, RefreshCw, Filter, FileText, Send, Eye, LayoutList, LayoutGrid } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, infoToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DesignOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' or 'progress'
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Details Modal State
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewDetails, setReviewDetails] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Item Edit State
  const [editingItem, setEditingItem] = useState(null);
  const [editItemData, setEditItemData] = useState({
    drawing_no: '',
    revision_no: '',
    drawing_pdf: null
  });
  const [itemSaveLoading, setItemSaveLoading] = useState(false);

  // Bulk Operations State
  const [selectedIncomingOrders, setSelectedIncomingOrders] = useState(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [expandedIncomingPo, setExpandedIncomingPo] = useState({});
  const [expandedActivePo, setExpandedActivePo] = useState({});

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectData, setRejectData] = useState({
    id: null,
    type: '', // 'ITEM' or 'ORDER'
    reason: ''
  });
  const [materialFormData, setMaterialFormData] = useState({
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
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [targetOrderItemId, setTargetOrderItemId] = useState(null);
  const [targetOrderItemCode, setTargetOrderItemCode] = useState(null);
  const [itemsList, setItemsList] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [isEditingMaterial, setIsEditingMaterial] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [materialSubTab, setMaterialSubTab] = useState('add'); // 'add' or 'groups'
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [itemGroups, setItemGroups] = useState([
    { id: 1, name: 'Raw Material', code: 'RM', status: 'Active' },
    { id: 2, name: 'SFG', code: 'SFG', status: 'Active' },
    { id: 3, name: 'FG', code: 'FG', status: 'Active' },
    { id: 4, name: 'Sub Assembly', code: 'SA', status: 'Active' },
    { id: 5, name: 'Consumable', code: 'CON', status: 'Active' }
  ]);
  const [groupFormData, setGroupFormData] = useState({ name: '', code: '', status: 'Active' });
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingGroup(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isEditingGroup) {
        setItemGroups(prev => prev.map(g => g.id === editingGroupId ? { ...g, ...groupFormData } : g));
        successToast('Item group updated successfully');
      } else {
        const newGroup = {
          id: Date.now(),
          ...groupFormData
        };
        setItemGroups(prev => [...prev, newGroup]);
        successToast('Item group added successfully');
      }
      setGroupFormData({ name: '', code: '', status: 'Active' });
      setIsEditingGroup(false);
      setEditingGroupId(null);
    } catch (error) {
      errorToast('Failed to save item group');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleEditGroup = (group) => {
    setGroupFormData({ name: group.name, code: group.code, status: group.status });
    setIsEditingGroup(true);
    setEditingGroupId(group.id);
  };

  const handleDeleteGroup = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You want to delete this item group?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        setItemGroups(prev => prev.filter(g => g.id !== id));
        successToast('Item group deleted');
      }
    });
  };

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const renderItemGroups = () => {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-300">
        {/* Add/Edit Group Form */}
        <div className="bg-slate-50 p-6 rounded border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded text-xs font-bold">+</span>
            <h4 className="text-sm font-semibold">{isEditingGroup ? 'Edit Item Group' : 'Add New Item Group'}</h4>
          </div>
          <form onSubmit={handleGroupSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Group Name *</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Raw Material"
                value={groupFormData.name}
                onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Code *</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. RM"
                value={groupFormData.code}
                onChange={(e) => setGroupFormData({...groupFormData, code: e.target.value})}
                required
              />
            </div>
            <div className="flex gap-3">
              <button 
                type="submit" 
                disabled={isSubmittingGroup}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingGroup ? 'Saving...' : (isEditingGroup ? 'Update Group' : 'Add Group')}
              </button>
              {isEditingGroup && (
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditingGroup(false);
                    setGroupFormData({ name: '', code: '', status: 'Active' });
                  }}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded text-xs hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Groups List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded"></span>
              Item Groups Master
            </h4>
          </div>
          <div className="overflow-hidden border border-slate-200 rounded shadow-sm">
            <table className="w-full text-left border-collapse bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4 text-xs font-semibold text-slate-500 border-b border-slate-200">Group Name</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 border-b border-slate-200">Code</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 border-b border-slate-200">Status</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-xs font-medium text-slate-700">{group.name}</td>
                    <td className="p-4 text-xs text-slate-600">
                      <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold">{group.code}</span>
                    </td>
                    <td className="p-4 text-xs">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[10px]">
                        {group.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditGroup(group)}
                          className="p-1.5 text-amber-500 hover:bg-amber-50 rounded transition-all"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-all"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const handlePreview = (item) => {
    setPreviewDrawing(item);
    setShowPreviewModal(true);
  };

  const renderMaterialForm = () => {
    return (
      <div className="bg-white rounded border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 mb-6 shadow-sm">
        {/* Sub-Header with Back Button and Title */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <button 
            onClick={() => setShowAddMaterialModal(false)}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-all px-3 py-2 bg-white border border-slate-200 rounded text-xs font-semibold shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tasks
          </button>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-100 text-emerald-600 rounded-lg text-sm">📦</span>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {isEditingMaterial ? 'Edit Material / Item' : 'Add New Material / Item'}
            </h3>
          </div>
          <div className="w-[120px]"></div>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 border-b border-slate-100 bg-white">
          <div className="flex gap-8">
            <button
              onClick={() => setMaterialSubTab('add')}
              className={`py-4 text-xs font-bold transition-all relative ${materialSubTab === 'add' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Add Material
              {materialSubTab === 'add' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
            <button
              onClick={() => setMaterialSubTab('groups')}
              className={`py-4 text-xs font-bold transition-all relative ${materialSubTab === 'groups' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Item Groups
              {materialSubTab === 'groups' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
          </div>
        </div>

        {materialSubTab === 'add' ? (
          <>
            <form onSubmit={handleMaterialSubmit} className="p-8 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Row 1 */}
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Item Code *</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      placeholder="ITM-0001"
                      value={materialFormData.itemCode}
                      onChange={(e) => setMaterialFormData({...materialFormData, itemCode: e.target.value})}
                      required
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const code = await fetchNextItemCode(materialFormData.itemName, materialFormData.itemGroup);
                        if (code) setMaterialFormData(prev => ({ ...prev, itemCode: code }));
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs   transition-all border border-slate-200"
                      title="Generate Next Code"
                    >
                      🔄
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Item Name *</label>
                  <input 
                    type="text" 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="Enter item name"
                    value={materialFormData.itemName}
                    onChange={(e) => setMaterialFormData({...materialFormData, itemName: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Item Group *</label>
                  <select 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    value={materialFormData.itemGroup}
                    onChange={(e) => setMaterialFormData({...materialFormData, itemGroup: e.target.value})}
                    required
                  >
                    <option value="">Select item group</option>
                    {itemGroups.map(group => (
                      <option key={group.id} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                </div>

                {/* Row 2 */}
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Default UOM *</label>
                  <select 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    value={materialFormData.defaultUom}
                    onChange={(e) => setMaterialFormData({...materialFormData, defaultUom: e.target.value})}
                    required
                  >
                    <option value="Nos">Nos</option>
                    <option value="Kg">Kg</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Set">Set</option>
                    <option value="Ltr">Litre (Ltr)</option>
                    <option value="ml">Millilitre (ml)</option>
                    <option value="m³">Cubic Meter (m³)</option>
                    <option value="mm">Millimeter (mm)</option>
                    <option value="ft">Feet (ft)</option>
                    <option value="in">Inch (in)</option>
                    <option value="g">Gram (g)</option>
                    <option value="Ton">Ton</option>
                    <option value="MT">Metric Ton (MT)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Valuation Rate</label>
                  <input 
                    type="number" 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    value={materialFormData.valuationRate}
                    onChange={(e) => setMaterialFormData({...materialFormData, valuationRate: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">No. of Cavity (for mould items)</label>
                  <input 
                    type="number" 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    value={materialFormData.noOfCavity}
                    onChange={(e) => setMaterialFormData({...materialFormData, noOfCavity: e.target.value})}
                  />
                </div>

                {/* Row 3 */}
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Weight per Unit</label>
                  <input 
                    type="number" 
                    step="0.001"
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="0.00"
                    value={materialFormData.weightPerUnit}
                    onChange={(e) => setMaterialFormData({...materialFormData, weightPerUnit: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Weight UOM</label>
                  <select 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    value={materialFormData.weightUom}
                    onChange={(e) => setMaterialFormData({...materialFormData, weightUom: e.target.value})}
                  >
                    <option value="">Select weight UOM</option>
                    <option value="Kg">Kg</option>
                    <option value="g">Gram (g)</option>
                    <option value="Ltr">Litre (Ltr)</option>
                    <option value="ml">Millilitre (ml)</option>
                    <option value="Ton">Ton</option>
                    <option value="MT">Metric Ton (MT)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Drawing No (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="Enter drawing number"
                    value={materialFormData.drawingNo}
                    onChange={(e) => setMaterialFormData({...materialFormData, drawingNo: e.target.value})}
                  />
                </div>

                {/* Row 4 */}
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Revision (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="Enter revision"
                    value={materialFormData.revision}
                    onChange={(e) => setMaterialFormData({...materialFormData, revision: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs  text-slate-500  ">Material Grade (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="Enter material grade"
                    value={materialFormData.materialGrade}
                    onChange={(e) => setMaterialFormData({...materialFormData, materialGrade: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <button 
                    type="button"
                    onClick={handleClearMaterialForm}
                    className="p-2.5 bg-slate-100 text-slate-600 rounded  text-xs  hover:bg-slate-200 transition-all border border-slate-200"
                  >
                    Clear Form
                  </button>
                  <button 
                    type="button"
                    className="p-2.5 bg-blue-600 text-white rounded  text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    Generate EAN Barcode
                  </button>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    type="button"
                    onClick={() => setShowAddMaterialModal(false)}
                    className="flex-1 md:flex-none p-2.5 bg-white border border-slate-200 text-slate-600 rounded  text-xs  hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingMaterial}
                    className="flex-1 md:flex-none px-10 py-2.5 bg-emerald-600 text-white rounded  text-xs  hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    {isSubmittingMaterial ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded  animate-spin"></div>
                        {isEditingMaterial ? 'Updating...' : 'Saving...'}
                      </>
                    ) : (isEditingMaterial ? 'Update Material' : 'Save Material')}
                  </button>
                </div>
              </div>
            </form>

            {/* Items List Section */}
            <div className="px-8 pb-8 animate-in fade-in duration-300">
              <div className="border-t border-slate-100 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                  <h4 className="text-sm  text-slate-700 flex items-center gap-2 ">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded "></span>
                    {materialFormData.drawingNo ? `Materials for Drawing: ${materialFormData.drawingNo}` : 'Recently Added Materials'}
                  </h4>
                  <div className="flex items-center gap-2  w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <input
                        type="text"
                        placeholder="Search items or drawing..."
                        className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded  text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                      />
                      <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {materialFormData.drawingNo && (
                      <button
                        type="button"
                        onClick={() => setModalSearchTerm(materialFormData.drawingNo)}
                        className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded text-xs   hover:bg-blue-100 transition-all whitespace-nowrap"
                      >
                        This Drawing
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="overflow-hidden border border-slate-200 rounded ">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200">Item Code</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200">Material Name</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200">Group</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200">UOM</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200 text-center">Valuation Rate</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200 text-center">Weight/Unit</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200">Drawing No</th>
                          <th className="p-2 text-xs   text-slate-500   border-b border-slate-200 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemsLoading ? (
                          <tr>
                            <td colSpan="8" className="px-4 py-8 text-center text-slate-400 text-xs italic">
                              Loading materials...
                            </td>
                          </tr>
                        ) : itemsList.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="px-4 py-8 text-center text-slate-400 text-xs italic">
                              No materials found
                            </td>
                          </tr>
                        ) : (
                          [...itemsList]
                            .filter(item => {
                              const search = modalSearchTerm.toLowerCase();
                              return (
                                item.item_code?.toLowerCase().includes(search) ||
                                item.material_name?.toLowerCase().includes(search) ||
                                item.drawing_no?.toLowerCase().includes(search)
                              );
                            })
                            .sort((a, b) => b.id - a.id)
                            .map((item) => {
                              const isCurrentDrawing = materialFormData.drawingNo && item.drawing_no === materialFormData.drawingNo;
                              return (
                                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isCurrentDrawing ? 'bg-emerald-50/40' : ''}`}>
                                  <td className="p-2  text-xs  text-slate-700">
                                    {item.item_code}
                                    {isCurrentDrawing && <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[8px]  ">Current Drg</span>}
                                  </td>
                                  <td className="p-2  text-xs text-slate-600">{item.material_name}</td>
                                  <td className="p-2  text-xs text-slate-600">
                                    <span className="p-1  bg-slate-100 text-slate-600 rounded text-[10px]">{item.material_type}</span>
                                  </td>
                                  <td className="p-2  text-xs text-slate-600">{item.unit}</td>
                                  <td className="p-2  text-xs text-slate-600 text-center">₹{parseFloat(item.valuation_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-2  text-xs text-slate-600 text-center">{parseFloat(item.weight_per_unit || 0).toFixed(3)} {item.weight_uom}</td>
                                  <td className="p-2  text-xs text-slate-600">{item.drawing_no || '—'}</td>
                                  <td className="p-2  text-right">
                                    <div className="flex justify-end gap-1">
                                      <button 
                                        onClick={() => handleCopyMaterial(item)}
                                        className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                        title="Copy Details"
                                      >
                                        📋
                                      </button>
                                      <button 
                                        onClick={() => handleEditMaterialInModal(item)}
                                        className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
                                        title="Edit"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteMaterialInModal(item.id)}
                                        className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                        title="Delete"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          renderItemGroups()
        )}
      </div>
    );
  };

  const fetchItemsList = async (drawingNo = null) => {
    try {
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/stock/balance`;
      if (drawingNo) {
        url += `?drawingNo=${encodeURIComponent(drawingNo)}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItemsList(data);
      }
    } catch (error) {
      console.error('Failed to fetch items list:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const toggleIncomingPo = (po) => {
    setExpandedIncomingPo(prev => ({ ...prev, [po]: !prev[po] }));
  };

  const toggleActivePo = (po) => {
    setExpandedActivePo(prev => ({ ...prev, [po]: !prev[po] }));
  };

  const groupedIncoming = incomingOrders.reduce((acc, order) => {
    const poKey = order.po_number || (order.customer_po_id ? `PO-${order.customer_po_id}` : 'NO-PO');
    const companyKey = order.company_name || 'Unknown';
    const key = `${companyKey}_${poKey}`;

    if (!acc[key]) {
      acc[key] = {
        po_number: poKey,
        company_name: companyKey,
        project_name: order.project_name || '',
        orders: []
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {});

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch design orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingOrders = async () => {
    try {
      setIncomingLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/incoming?department=DESIGN_ENG`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch incoming orders');
      const data = await response.json();
      setIncomingOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIncomingLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchIncomingOrders();
  }, []);

  useEffect(() => {
    if (showAddMaterialModal) {
      fetchItemsList(materialFormData.drawingNo);
    }
  }, [materialFormData.drawingNo, showAddMaterialModal]);

  useEffect(() => {
    const autoGenerateCode = async () => {
      if (!isEditingMaterial && showAddMaterialModal && materialFormData.itemName && materialFormData.itemGroup && !materialFormData.itemCode) {
        const nextCode = await fetchNextItemCode(materialFormData.itemName, materialFormData.itemGroup);
        if (nextCode) {
          setMaterialFormData(prev => ({ ...prev, itemCode: nextCode }));
        }
      }
    };
    autoGenerateCode();
  }, [materialFormData.itemName, materialFormData.itemGroup, materialFormData.itemCode, isEditingMaterial, showAddMaterialModal]);

  const handleViewOrder = async (order) => {
    try {
      setReviewLoading(true);
      setReviewOrder(order);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order items');
      const items = await response.json();
      
      // Filter items to show only the specific drawing that was clicked
      const filteredItems = items.filter(item => item.drawing_no === order.drawing_no);
      setReviewDetails(filteredItems || []);
      
      setShowReviewModal(true);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      successToast(`Design order status updated to ${status}`);
      fetchOrders();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleApproveDesign = async (orderId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/approve-design`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      
      if (!response.ok) throw new Error('Failed to approve design');
      
      successToast('Design accepted and moved to Process tab.');
      setShowReviewModal(false);
      setReviewOrder(null);
      setReviewDetails([]);
      setActiveTab('progress');
      fetchOrders();
      fetchIncomingOrders();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleRejectItem = (itemId) => {
    setRejectData({ id: itemId, type: 'ITEM', reason: '' });
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!rejectData.reason) {
      errorToast('Please enter a rejection reason');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      if (rejectData.type === 'ORDER') {
        const response = await fetch(`${API_BASE}/sales-orders/${rejectData.id}/reject-design`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason: rejectData.reason })
        });
        
        if (!response.ok) throw new Error('Failed to reject design');
        
        successToast('Design rejected and sent back to sales.');
        setShowReviewModal(false);
      } else {
        const response = await fetch(`${API_BASE}/sales-orders/items/${rejectData.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'REJECTED', reason: rejectData.reason })
        });

        if (!response.ok) throw new Error('Failed to reject item');

        successToast('Item marked as rejected');
        
        setReviewDetails(prev => prev.map(item => 
          item.id === rejectData.id ? { 
            ...item, 
            status: 'REJECTED', 
            item_status: 'REJECTED',
            rejection_reason: rejectData.reason,
            item_rejection_reason: rejectData.reason,
            reason: rejectData.reason 
          } : item
        ));

        // Update local state for incoming orders
        setIncomingOrders(prev => prev.map(order => 
          order.item_id === rejectData.id ? { 
            ...order, 
            item_status: 'REJECTED', 
            status: 'REJECTED',
            item_rejection_reason: rejectData.reason,
            rejection_reason: rejectData.reason 
          } : order
        ));
      }
      
      setShowRejectModal(false);
      setRejectData({ id: null, type: '', reason: '' });
      fetchOrders();
      fetchIncomingOrders();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const toggleSelectOrder = (orderId) => {
    const newSelected = new Set(selectedIncomingOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedIncomingOrders(newSelected);
  };

  const toggleSelectAllOrders = () => {
    if (selectedIncomingOrders.size === incomingOrders.length && incomingOrders.length > 0) {
      setSelectedIncomingOrders(new Set());
    } else {
      setSelectedIncomingOrders(new Set(incomingOrders.map(o => o.item_id)));
    }
  };

  const handleAcceptAll = async (orderIds) => {
    if (!orderIds || orderIds.length === 0) return;

    const result = await Swal.fire({
      title: '<span class="text-lg font-semibold">Accept & Move to Process</span>',
      html: `<span class="text-sm text-gray-600">Are you sure you want to accept all ${orderIds.length} items and move them to the Process tab?</span>`,
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Accept All',
      width: '400px',
      padding: '1rem',
      customClass: {
        confirmButton: 'text-sm p-2 ',
        cancelButton: 'text-sm p-2 '
      }
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/approve-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds })
        });

        if (!response.ok) throw new Error('Failed to accept orders');

        successToast('Orders accepted and moved to Process tab');
        setActiveTab('progress');
        fetchOrders();
        fetchIncomingOrders();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleApproveItem = async (itemId) => {
    try {
      setBulkOperationLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/items/${itemId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Approved ' })
      });

      if (!response.ok) throw new Error('Failed to approve item');

      successToast('Item approved');
      
      // Update local state if in review modal
      setReviewDetails(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'Approved ', item_status: 'Approved ' } : item
      ));

      // Update local state for incoming orders
      setIncomingOrders(prev => prev.map(order => 
        order.item_id === itemId ? { ...order, item_status: 'Approved ', status: 'Approved ' } : order
      ));

      fetchOrders();
      fetchIncomingOrders();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIncomingOrders.size === 0) {
      infoToast('Please select at least one order to approve');
      return;
    }

    const result = await Swal.fire({
      title: 'Bulk Accept Designs',
      text: `Are you sure you want to approve ${selectedIncomingOrders.size} selected item(s)?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, approve all'
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/items/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            itemIds: Array.from(selectedIncomingOrders),
            status: 'Approved '
          })
        });

        if (!response.ok) throw new Error('Failed to approve items');

        successToast(`${selectedIncomingOrders.size} items approved.`);
        setSelectedIncomingOrders(new Set());
        fetchIncomingOrders();
        fetchOrders();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleBulkReject = async () => {
    if (selectedIncomingOrders.size === 0) {
      infoToast('Please select at least one order to reject');
      return;
    }

    const result = await Swal.fire({
      title: 'Bulk Reject Designs',
      input: 'textarea',
      inputLabel: 'Rejection reason (required for all selected orders)',
      inputPlaceholder: 'Enter reason for rejection...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Please enter a reason';
      }
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/items/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            itemIds: Array.from(selectedIncomingOrders), 
            status: 'REJECTED',
            reason: result.value 
          })
        });

        if (!response.ok) throw new Error('Failed to reject items');

        successToast(`${selectedIncomingOrders.size} items rejected and sent back to Sales.`);
        setSelectedIncomingOrders(new Set());
        fetchIncomingOrders();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleViewDetails = async (order) => {
    try {
      setSelectedOrder(order);
      setShowDetails(true);
      setDetailsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.sales_order_id}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      
      // Filter details to show only the specific drawing that was clicked
      const filteredDetails = data.filter(item => item.drawing_no === order.drawing_no);
      setOrderDetails(filteredDetails);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load order details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItemData({
      drawing_no: item.drawing_no || '',
      revision_no: item.revision_no || '0',
      drawing_pdf: null
    });
  };

  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!materialFormData.itemCode || !materialFormData.itemName || !materialFormData.itemGroup) {
      errorToast('Please fill all required fields');
      return;
    }
    
    setIsSubmittingMaterial(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = isEditingMaterial ? `${API_BASE}/stock/items/${editingMaterialId}` : `${API_BASE}/stock/items`;
      const method = isEditingMaterial ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(materialFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditingMaterial ? 'update' : 'create'} material`);
      }

      // If we have a target order item, update its item_code ONLY IF it's empty/No Code
      // This prevents overwriting the main FG item when adding raw materials/consumables
      const currentCode = (targetOrderItemCode || '').trim();
      const shouldLink = targetOrderItemId && 
                         !isEditingMaterial && 
                         (!currentCode || currentCode === 'No Code');

      if (shouldLink) {
        await fetch(`${API_BASE}/sales-orders/items/${targetOrderItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ item_code: materialFormData.itemCode })
        });
        setTargetOrderItemCode(materialFormData.itemCode); // Update current target code so next items don't overwrite
      }
      
      successToast(`Material ${isEditingMaterial ? 'updated' : 'created'} successfully`);
      await fetchItemsList(materialFormData.drawingNo);
      setTargetOrderItemId(null);
      setIsEditingMaterial(false);
      setEditingMaterialId(null);
      fetchOrders();
      fetchIncomingOrders();
      if (showDetails && selectedOrder) {
        handleViewDetails(selectedOrder);
      }
      setMaterialFormData({
        itemCode: '',
        itemName: '',
        itemGroup: '',
        defaultUom: 'Nos',
        valuationRate: 0,
        sellingRate: 0,
        noOfCavity: 1,
        weightPerUnit: 0,
        weightUom: '',
        drawingNo: materialFormData.drawingNo,
        revision: materialFormData.revision,
        materialGrade: ''
      });
    } catch (error) {
      console.error('Material Submit Error:', error);
      errorToast(error.message);
    } finally {
      setIsSubmittingMaterial(false);
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
        return data.itemCode;
      }
    } catch (error) {
      console.error('Failed to fetch next item code:', error);
    }
    return '';
  };

  const openAddMaterialModal = async (item = null) => {
    if (item) {
      setTargetOrderItemId(item.item_id || item.id || null);
      setTargetOrderItemCode(item.item_code || '');
      setMaterialFormData({
        itemCode: '',
        itemName: '',
        itemGroup: '',
        defaultUom: item.unit || 'Nos',
        valuationRate: 0,
        sellingRate: 0,
        noOfCavity: 1,
        weightPerUnit: 0,
        weightUom: '',
        drawingNo: item.drawing_no || '',
        revision: item.revision_no || '',
        materialGrade: ''
      });
    } else {
      setTargetOrderItemId(null);
      setMaterialFormData({
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
    }
    setShowAddMaterialModal(true);
    setIsEditingMaterial(false);
    setEditingMaterialId(null);
  };

  const handleEditMaterialInModal = (item) => {
    setIsEditingMaterial(true);
    setEditingMaterialId(item.id);
    setMaterialFormData({
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
  };

  const handleCopyMaterial = (item) => {
    setMaterialFormData(prev => ({
      ...prev,
      itemName: item.material_name || '',
      itemGroup: item.material_type || '',
      defaultUom: item.unit || 'Nos',
      valuationRate: item.valuation_rate || 0,
      sellingRate: item.selling_rate || 0,
      noOfCavity: item.no_of_cavity || 1,
      weightPerUnit: item.weight_per_unit || 0,
      weightUom: item.weight_uom || '',
      // drawingNo and revision are usually kept from the current order context
      materialGrade: item.material_grade || ''
    }));
    successToast('Material details copied!');
  };

  const handleClearMaterialForm = async () => {
    setMaterialFormData({
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
    setIsEditingMaterial(false);
    setEditingMaterialId(null);
  };

  const handleDeleteMaterialInModal = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/stock/items/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete material');

        successToast('Material has been deleted.');
        fetchItemsList(materialFormData.drawingNo);
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const handleSaveItem = async (itemId) => {
    try {
      setItemSaveLoading(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('drawingNo', editItemData.drawing_no);
      formData.append('revisionNo', editItemData.revision_no);
      if (editItemData.drawing_pdf) {
        formData.append('drawing_pdf', editItemData.drawing_pdf);
      }

      const response = await fetch(`${API_BASE}/drawings/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update item drawing');
      
      successToast('Item drawing updated');
      setEditingItem(null);
      // Refresh details
      handleViewDetails(selectedOrder);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setItemSaveLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/design-orders/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to delete order');
        
        successToast('Order has been deleted.');
        fetchOrders();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.design_order_number?.toLowerCase().includes(searchLower) ||
      order.po_number?.toLowerCase().includes(searchLower) ||
      order.company_name?.toLowerCase().includes(searchLower) ||
      order.project_name?.toLowerCase().includes(searchLower) ||
      order.drawing_no?.toLowerCase().includes(searchLower) ||
      ((!order.po_number || order.po_number === 'NO-PO') ? 'DR-' : 'SO-').toLowerCase().includes(searchLower)
    );
  });

  const groupedActive = filteredOrders.reduce((acc, order) => {
    // Filter out rejected items from "Design Tasks in Progress"
    if (order.item_status === 'REJECTED') return acc;

    const poKey = order.po_number || (order.customer_po_id ? `PO-${order.customer_po_id}` : 'NO-PO');
    const companyKey = order.company_name || 'Unknown';
    const groupKey = `${companyKey}_${poKey}`;

    if (!acc[groupKey]) {
      acc[groupKey] = {
        po_number: poKey,
        customer_po_id: order.customer_po_id,
        company_name: companyKey,
        project_name: order.project_name || '',
        orders: []
      };
    }
    
    // Add all orders (which are individual items from the backend join)
    acc[groupKey].orders.push(order);
    
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ">
      <div className="max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="mb-4">
          <div className="flex justify-between items-end mb-3 gap-4">
            <div>
              <h1 className="text-xl text-slate-900">Design Engineering Hub</h1>
              <p className="text-xs text-slate-600">Review customer drawings and create technical specifications</p>
            </div>
            {!showAddMaterialModal && (
              <div className="flex bg-slate-200 p-1 rounded ">
                <button
                  onClick={() => setActiveTab('incoming')}
                  className={`px-4 py-1.5 rounded  text-xs  transition-all ${activeTab === 'incoming' ? 'bg-white text-indigo-600 ' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Incoming Requests
                </button>
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`px-4 py-1.5 rounded  text-xs  transition-all ${activeTab === 'progress' ? 'bg-white text-indigo-600 ' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  In Progress
                </button>
              </div>
            )}
          </div>

          {/* INFO BANNER */}
          {!showAddMaterialModal && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded  p-3 flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs text-blue-900 ">
                {activeTab === 'incoming' 
                  ? 'Review incoming drawings from sales and accept them for design engineering review.'
                  : 'Manage active design tasks, create technical specifications, and track progress of approved drawings.'}
              </p>
            </div>
          )}
        </div>

        {/* INCOMING REQUESTS SECTION */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2  rounded   border border-blue-700 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-lg  text-white flex items-center gap-2 ">
                    <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    Incoming Design Requests
                  </h2>
                  <p className="text-blue-100 text-xs mt-1  opacity-90">Review and approve customer drawings from sales department</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex bg-white/10 p-1 rounded  backdrop-blur-sm border border-white/20 mr-2">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded  transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 ' : 'text-blue-100 hover:text-white'}`}
                      title="List View"
                    >
                      <LayoutList className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded  transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 ' : 'text-blue-100 hover:text-white'}`}
                      title="Card View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={fetchIncomingOrders}
                    disabled={incomingLoading}
                    className="flex-1 md:flex-none p-2  bg-white/10 hover:bg-white/20 border border-white/30 rounded  text-xs  text-white transition-all backdrop-blur-sm flex items-center justify-center gap-2"
                  >
                    <svg className={`w-3.5 h-3.5 ${incomingLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Refresh
                  </button>
                  
                  {incomingOrders.length > 0 && (
                    <div className="p-2  bg-white text-blue-600 rounded  text-xs  shadow-lg shadow-blue-900/20">
                      {incomingOrders.length} REQUESTS
                    </div>
                  )}
                </div>
              </div>

              {selectedIncomingOrders.size > 0 && (
                <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-2 .5 bg-white/20 rounded  border border-white/30 flex items-center gap-2 ">
                    <span className="w-2 h-2 bg-emerald-400 rounded  animate-pulse"></span>
                    <span className="text-white text-xs   ">
                      {selectedIncomingOrders.size} Selected
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2  ml-auto">
                    <button
                      onClick={handleBulkApprove}
                      disabled={bulkOperationLoading}
                      className="p-2  bg-emerald-500 hover:bg-emerald-600 text-white rounded  text-xs  shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2  border border-emerald-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                      Approve Selected
                    </button>
                    <button
                      onClick={handleBulkReject}
                      disabled={bulkOperationLoading}
                      className="p-2  bg-red-500 hover:bg-red-600 text-white rounded  text-xs  shadow-lg shadow-red-900/20 transition-all flex items-center gap-2  border border-red-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                      Reject Selected
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {incomingLoading ? (
                <div className="py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded  animate-spin"></div>
                    <p className="text-sm  text-slate-600 animate-pulse">Scanning for incoming requests...</p>
                  </div>
                </div>
              ) : incomingOrders.length === 0 ? (
                <div className="p-2 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-inner">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-slate-50 rounded  flex items-center justify-center text-slate-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    </div>
                    <div>
                      <h3 className="text-lg  text-slate-900">Inbox is Clear</h3>
                      <p className="text-sm text-slate-500 mt-1 ">No new design requests waiting for review.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-2  bg-slate-100 rounded  mb-2">
                    <input
                      type="checkbox"
                      checked={selectedIncomingOrders.size === incomingOrders.length && incomingOrders.length > 0}
                      onChange={toggleSelectAllOrders}
                      className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                      disabled={incomingOrders.length === 0}
                    />
                    <span className="text-[10px]  text-slate-500  ">Select All Requests</span>
                  </div>
                  
                  {Object.entries(groupedIncoming).map(([groupKey, group]) => {
                    const isExpanded = expandedIncomingPo[groupKey];
                    const allSelected = group.orders.length > 0 && group.orders.every(o => selectedIncomingOrders.has(o.item_id));

                    return (
                      <div key={groupKey} className="bg-white rounded  border border-slate-200  overflow-hidden transition-all hover:border-blue-200">
                        <div 
                          onClick={() => toggleIncomingPo(groupKey)}
                          className={`p-2  flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedIncomingOrders);
                                  group.orders.forEach(o => {
                                    if (e.target.checked) newSelected.add(o.item_id);
                                    else newSelected.delete(o.item_id);
                                  });
                                  setSelectedIncomingOrders(newSelected);
                                }}
                                className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>
                            <div className={`p-2 rounded  transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <svg className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-sm  text-slate-900 flex items-center gap-2 ">
                                {group.po_number === 'NO-PO' ? (group.project_name || 'Direct Design Request') : `PO: ${group.po_number}`}
                                <span className="p-1  bg-blue-50 text-blue-600 roundedtext-xs  ">
                                  {group.orders.length} Drawings
                                </span>
                              </h3>
                              <p className="text-[10px] text-blue-500 font-semibold tracking-tight mt-0.5">
                                {group.company_name} {group.po_number !== 'NO-PO' && group.project_name && `| ${group.project_name}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-4 md:mt-0 ml-auto md:ml-0">
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400   ">Total Quantity</p>
                              <p className="text-sm  text-slate-800">
                                {group.orders.reduce((sum, o) => sum + (Number(o.item_qty) || 1), 0)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptAll([...new Set(group.orders.map(o => o.id))]);
                              }}
                              className="p-2  bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded  text-xs  transition-all border border-indigo-10"
                            >
                              Accept Group
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 bg-slate-50/50">
                            {viewMode === 'grid' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {group.orders.map((order, index) => (
                                  <div 
                                    key={order.item_id} 
                                    className={`bg-white rounded  border-2 transition-all group relative ${
                                      selectedIncomingOrders.has(order.item_id) ? 'border-blue-500 shadow-md ring-4 ring-blue-50' : 'border-slate-100 hover:border-slate-300'
                                    } ${order.item_status === 'REJECTED' ? 'bg-red-50/30' : ''}`}
                                  >
                                    <div className="p-4">
                                      <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={selectedIncomingOrders.has(order.item_id)}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              toggleSelectOrder(order.item_id);
                                            }}
                                            className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div>
                                            <p className="text-sm  text-slate-900 truncate max-w-[150px]">
                                              {order.drawing_no || 'NO DRAWING NO'}
                                            </p>
                                            <p className="text-[10px] text-slate-400   ">{order.item_code || 'No Item Code'}</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs  text-indigo-600">{order.item_qty || 1}</p>
                                          <p className="text-[9px] text-slate-400   ">Qty</p>
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        <div className="flex flex-wrap gap-1.5">
                                          {order.item_code ? (
                                            <span className="p-1  bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px]   tracking-tight">
                                              {order.item_code}
                                            </span>
                                          ) : (
                                            <span className="p-1  bg-slate-100 text-slate-400 italic rounded text-[9px] ">Pending Code</span>
                                          )}
                                          {order.item_group && (
                                            <span className="p-1  bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px]   tracking-tight">
                                              {order.item_group}
                                            </span>
                                          )}
                                        </div>

                                        <div className="bg-slate-50/80 rounded  p-2.5 border border-slate-100">
                                          <p className="text-[9px] text-slate-400    mb-1">Description</p>
                                          <p className="text-[11px] text-slate-600 italic line-clamp-2 leading-relaxed">
                                            {order.item_description || 'No description provided'}
                                          </p>
                                        </div>

                                        {(order.item_status || order.status) && (order.item_status || order.status) !== 'PENDING' && (
                                          <div className="flex flex-col gap-1.5">
                                            <StatusBadge status={order.item_status || order.status} />
                                            {(order.item_status === 'REJECTED' || order.status === 'REJECTED') && (order.item_rejection_reason || order.rejection_reason || order.reason) && (
                                              <div className="p-2 bg-red-50 rounded  border border-red-100">
                                                <p className="text-[9px] text-red-500 italic leading-snug">
                                                  <span className="  not-italic mr-1 text-[8px]">Reason:</span>
                                                  {order.item_rejection_reason || order.rejection_reason || order.reason}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="p-2 .5 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center rounded-b-xl min-h-[52px]">
                                      <div className="flex items-center gap-2 ">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleViewOrder(order); }}
                                          className="flex items-center gap-2  p-2 .5 bg-white hover:bg-blue-50 text-blue-600 rounded text-xs border border-slate-200 hover:border-blue-200 transition-all "
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Review
                                        </button>
                                        {(!(order.item_status) || order.item_status === 'PENDING') && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleApproveItem(order.item_id); }}
                                            disabled={bulkOperationLoading}
                                            className="p-2 .5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded text-xs   border border-emerald-200 transition-all  disabled:opacity-50"
                                          >
                                            Approve
                                          </button>
                                        )}
                                      </div>
                                      {(!(order.item_status) || order.item_status === 'PENDING') && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleRejectItem(order.item_id); }}
                                          disabled={bulkOperationLoading}
                                          className="p-2 .5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded text-xs   border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
                                        >
                                          Reject
                                        </button>
                                      )}
                                      {(order.item_status === 'Approved ' || order.status === 'Approved ') && (
                                        <span className="flex items-center gap-1 p-2 .5 bg-emerald-100 text-emerald-700 rounded text-xs  font-semibold border border-emerald-200">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                          Approved
                                        </span>
                                      )}
                                      {(order.item_status === 'REJECTED' || order.status === 'REJECTED') && (
                                        <span className="flex items-center gap-1 p-2 .5 bg-red-100 text-red-700 rounded text-xs  font-semibold border border-red-200">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-white rounded  border border-slate-200 overflow-hidden">
                                <table className="min-w-full divide-y divide-slate-200">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="w-10 p-2 "></th>
                                      <th className="p-2 text-left text-xs ">Drawing No</th>
                                      <th className="p-2 text-left text-xs ">Description</th>
                                      <th className="p-2 text-left text-xs ">Qty</th>
                                      <th className="p-2 text-left text-xs ">Status</th>
                                      <th className="p-2 text-right text-xs ">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.orders.map((order) => (
                                      <tr key={order.item_id} className={`hover:bg-slate-50 transition-colors ${selectedIncomingOrders.has(order.item_id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="p-2 ">
                                          <input
                                            type="checkbox"
                                            checked={selectedIncomingOrders.has(order.item_id)}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              toggleSelectOrder(order.item_id);
                                            }}
                                            className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                        </td>
                                        <td className="p-2 ">
                                          <div className="flex flex-col">
                                            <span className="text-xs  text-slate-900">{order.drawing_no || 'NO DRAWING NO'}</span>
                                            <span className="text-[9px] text-slate-400 ">{order.item_code || 'No Item Code'}</span>
                                          </div>
                                        </td>
                                        <td className="p-2 ">
                                          <p className="text-xs text-slate-600 italic truncate max-w-md">{order.item_description || order.description || 'No description'}</p>
                                        </td>
                                        <td className="p-2 ">
                                          <span className="text-xs  text-indigo-600">{order.item_qty || 1}</span>
                                        </td>
                                        <td className="p-2 ">
                                          <div className="flex flex-col gap-1">
                                            {(order.item_status || order.status) && (order.item_status || order.status) !== 'PENDING' ? (
                                              <div className="flex flex-col gap-1">
                                                <StatusBadge status={order.item_status || order.status} />
                                                {(order.item_status === 'REJECTED' || order.status === 'REJECTED') && (order.item_rejection_reason || order.rejection_reason || order.reason) && (
                                                  <span className="text-[9px] text-red-500 italic truncate max-w-[150px]" title={order.item_rejection_reason || order.rejection_reason || order.reason}>
                                                    Reason: {order.item_rejection_reason || order.rejection_reason || order.reason}
                                                  </span>
                                                )}
                                              </div>
                                            ) : order.item_code ? (
                                              <span className="p-1  bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] w-fit">{order.item_code}</span>
                                            ) : (
                                              <span className="p-1  bg-slate-100 text-slate-400 italic rounded text-[9px] w-fit">Pending Code</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-2  text-right">
                                          <div className="flex justify-center gap-2 items-center">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleViewOrder(order); }}
                                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded  hover:bg-blue-600 hover:text-white transition-all border border-blue-100 text-xs  "
                                              title="Review"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                              <span>Review</span>
                                            </button>
                                            {(!(order.item_status) || order.item_status === 'PENDING') && (
                                              <>
                                                <button 
                                                  onClick={(e) => { e.stopPropagation(); handleApproveItem(order.item_id); }}
                                                  disabled={bulkOperationLoading}
                                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded  hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 text-xs   disabled:opacity-50"
                                                >
                                                  Approve
                                                </button>
                                                <button 
                                                  onClick={(e) => { e.stopPropagation(); handleRejectItem(order.item_id); }}
                                                  disabled={bulkOperationLoading}
                                                  className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded  transition-alltext-xs   border border-transparent hover:border-red-200 disabled:opacity-50"
                                                >
                                                  Reject
                                                </button>
                                              </>
                                            )}
                                            {(order.item_status === 'Approved ' || order.status === 'Approved ') && (
                                              <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-semibold border border-emerald-200">
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                                Approved
                                              </span>
                                            )}
                                            {(order.item_status === 'REJECTED' || order.status === 'REJECTED') && (
                                              <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded text-[9px] font-semibold border border-red-200">
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                                                Rejected
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE DESIGN TASKS SECTION */}
        {activeTab === 'progress' && (
          <div className="bg-white rounded   overflow-hidden border border-slate-200">
            {!showAddMaterialModal && (
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 border-b border-purple-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className="text-base  text-white flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                         Design Tasks in Progress
                      </h2>
                      <p className="text-purple-100 text-xs">Manage active design orders and technical specifications</p>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white/10 border border-white/20 text-white placeholder-purple-200 text-xs rounded  p-2 .5 w-64 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                      />
                      <svg className="w-3.5 h-3.5 text-purple-200 absolute right-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ">
                    <div className="flex bg-white/10 p-1 rounded  backdrop-blur-sm border border-white/20 mr-2">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded  transition-all ${viewMode === 'list' ? 'bg-white text-purple-600 ' : 'text-purple-100 hover:text-white'}`}
                        title="List View"
                      >
                        <LayoutList className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded  transition-all ${viewMode === 'grid' ? 'bg-white text-purple-600 ' : 'text-purple-100 hover:text-white'}`}
                        title="Card View"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={fetchOrders}
                      disabled={loading}
                      className="p-2 .5 bg-white rounded text-xs text-purple-600  transition-colors disabled:opacity-50 "
                    >
                      ↻ Refresh
                    </button>
                    {orders.length > 0 && (
                      <span className="p-2  bg-white text-purple-600 rounded  text-xs ">
                        {filteredOrders.length} {filteredOrders.length !== orders.length ? `of ${orders.length}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
        
          <div className="space-y-4 p-4">
            {showAddMaterialModal ? (
              renderMaterialForm()
            ) : loading ? (
              <div className="py-24 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded  animate-spin"></div>
                </div>
                <p className="text-slate-600 ">Loading design tasks...</p>
              </div>
            ) : Object.keys(groupedActive).length === 0 ? (
              <div className="py-24 text-center bg-slate-50 rounded  border-2 border-dashed border-slate-200">
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded   mb-4">
                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">No active tasks found</h3>
                  <p className="text-sm text-slate-500 mt-1">Try adjusting your search or refresh to see newly added orders.</p>
                </div>
              </div>
            ) : (
              Object.entries(groupedActive).map(([groupKey, group]) => {
                const isExpanded = expandedActivePo[groupKey];
                return (
                  <div key={groupKey} className="bg-white rounded  border border-slate-200  overflow-hidden transition-all hover:border-indigo-200">
                    {/* Group Header */}
                    <div 
                      onClick={() => toggleActivePo(groupKey)}
                      className={`p-2  flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className={`p-2.5 rounded  transition-all duration-300 ${isExpanded ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                          <svg className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm  text-slate-900 flex items-center gap-2 ">
                            {group.po_number === 'NO-PO' ? (group.project_name || 'Direct Design Request') : `PO: ${group.po_number}`}
                            <span className="p-1  bg-indigo-50 text-indigo-600 rounded-md text-xs">
                              {group.orders.length} Drawings
                            </span>
                          </h3>
                          <p className="text-xs text-indigo-500 font-semibold mt-0.5 tracking-wide">
                            {group.company_name} {group.po_number !== 'NO-PO' && group.project_name && `| ${group.project_name}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400    mb-0.5">Total Quantity</p>
                          <p className="text-sm  text-slate-800 tracking-tight">
                            {group.orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                           <StatusBadge status={group.orders.some(o => o.status === 'DESIGN_QUERY') ? 'DESIGN_QUERY' : group.orders.some(o => o.status === 'IN_DESIGN') ? 'IN_DESIGN' : 'DRAFT'} />
                           <button className="p-1.5 hover:bg-slate-200 rounded  transition-colors text-slate-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                           </button>
                        </div>
                      </div>
                    </div>

                    {/* Group Items (Cards) */}
                    {isExpanded && (
                      <div className="p-5 bg-slate-50/50">
                        {viewMode === 'grid' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {group.orders.filter(o => o.item_type === 'FG' || !o.item_type).map((order) => (
                              <div key={`${order.id}-${order.item_id}`} className="bg-white rounded  border border-slate-200  hover:shadow-md transition-all duration-300 group flex flex-col h-full">
                                {/* Card Header */}
                                <div className="p-2 border-b border-slate-100 flex justify-between items-start gap-3 bg-slate-50/30">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs  text-slate-900 truncate">
                                        {order.drawing_no || 'Pending Drawing'}
                                      </span>
                                      {order.item_status === 'Rejected' && (
                                        <span className="flex-shrink-0 p-1  bg-red-100 text-red-700 rounded text-xs animate-pulse border border-red-200">Rejected</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {order.item_code ? (
                                        <span className="p-1  bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-xs  ">
                                          {order.item_code}
                                        </span>
                                      ) : (
                                        <span className="p-1  bg-slate-100 text-slate-400 italic rounded text-xs ">No Item Code</span>
                                      )}
                                      {order.item_group && (
                                        <span className="p-1  bg-purple-50 text-purple-600 border border-purple-100 rounded text-xs  ">
                                          {order.item_group}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] text-slate-400    mb-0.5">Quantity</p>
                                    <p className="text-sm  text-indigo-600 leading-none">{order.total_quantity || 0}</p>
                                  </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-2 flex-1">
                                  <div className="mb-2">
                                    <p className="text-xs text-slate-400    mb-1.5">Description</p>
                                    <p className="text-xs text-slate-600 line-clamp-2  leading-relaxed">
                                      {order.description || 'No technical description provided'}
                                    </p>
                                    {order.item_status === 'REJECTED' && order.item_rejection_reason && (
                                      <div className="mt-3 p-2 bg-red-50 rounded  border border-red-100">
                                        <p className="text-[10px] text-red-400   mb-0.5">Rejection Reason</p>
                                        <p className="text-[10px] text-red-600 italic leading-snug">{order.item_rejection_reason}</p>
                                      </div>
                                    )}
                                  </div>

                                  <div className=" border-t border-slate-50">
                                    <p className="text-[10px] text-slate-400    mb-2">Technical Status</p>
                                    <select
                                      value={order.status}
                                      onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                      className={`w-full text-xs  rounded  px-3 py-2 border-2 focus:ring-4 focus:ring-indigo-500/20 cursor-pointer transition-all appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem_1rem] ${
                                        order.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        order.status === 'In-Design' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        'bg-slate-50 text-slate-600 border-slate-200'
                                      }`}
                                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")` }}
                                    >
                                      <option value="Draft">DRAFT SPEC</option>
                                      <option value="In-Design">IN PROGRESS</option>
                                      <option value="Completed">FINALIZED</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Card Footer */}
                                <div className="p-2 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => openAddMaterialModal(order)}
                                      className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded  transition-all border border-transparent hover:border-emerald-100"
                                      title="Add Technical Material"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                    <button 
                                      onClick={() => handleViewDetails(order)}
                                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all border border-transparent hover:border-indigo-100"
                                      title="View Timeline & Specs"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    </button>
                                  </div>
                                  <button 
                                    onClick={() => handleDelete(order.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded  transition-all border border-transparent hover:border-red-100"
                                    title="Delete Task"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white rounded  border border-slate-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="p-2 text-left text-xs ">Drawing No</th>
                                  <th className="p-2 text-left text-xs ">Description</th>
                                  <th className="p-2 text-left text-xs ">Qty</th>
                                  <th className="p-2 text-left text-xs ">Status</th>
                                  <th className="p-2 text-right text-xs ">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.orders.filter(o => o.item_type === 'FG' || !o.item_type).map((order) => (
                                  <tr key={`${order.id}-${order.item_id}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 ">
                                      <div className="flex flex-col">
                                        <span className="text-xs  text-slate-900">{order.drawing_no || 'Pending Drawing'}</span>
                                        <span className="text-[9px] text-slate-400 ">
                                          {order.item_code || 'No Code'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-2 ">
                                      <p className="text-xs text-slate-600 italic truncate max-w-md">{order.description || 'No description'}</p>
                                    </td>
                                    <td className="p-2 ">
                                      <span className="text-xs  text-indigo-600">{order.total_quantity || 0}</span>
                                    </td>
                                    <td className="p-2 ">
                                      <select
                                        value={order.status}
                                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                        className={`text-[10px] font-semibold rounded  px-2 py-1 border focus:outline-none transition-all ${
                                          order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                          order.status === 'IN_DESIGN' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                          'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                      >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="IN_DESIGN">PROGRESS</option>
                                        <option value="COMPLETED">FINALIZED</option>
                                      </select>
                                    </td>
                                    <td className="p-2  text-right">
                                      <div className="flex justify-end gap-1">
                                        <button 
                                          onClick={() => openAddMaterialModal(order)}
                                          className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded  transition-all"
                                          title="Add Material"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          onClick={() => handleViewDetails(order)}
                                          className="p-1.5 text-blue-500 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all"
                                          title="View"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          onClick={() => handleDelete(order.id)}
                                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded  transition-all"
                                          title="Delete"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>

    {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDetails(false)}></div>
            <div className="relative bg-white rounded  shadow-2xl max-w-4xl w-full overflow-hidden transform transition-all">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 border-b border-purple-700">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg  text-white mb-1">
                      Technical Details: {selectedOrder?.po_number && selectedOrder?.po_number !== 'NO-PO' ? `PO ${selectedOrder.po_number}` : 'Design Request'}
                    </h3>
                    <p className="text-sm text-purple-100">
                      {(selectedOrder?.po_number === 'NO-PO' ? 'DR-' : 'SO-') + String(selectedOrder?.sales_order_id).padStart(4, '0')} | {selectedOrder?.company_name} - {selectedOrder?.project_name}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetails(false)}
                    className="text-white hover:bg-white/20 rounded  p-1 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {detailsLoading ? (
                  <div className="p-2 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded  animate-spin"></div>
                    </div>
                    <p className="text-slate-600  text-xs">Loading technical details...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-2  text-left text-xs  text-slate-600 ">Item Code</th>
                          <th className="p-2  text-left text-xs  text-slate-600 ">Drawing No</th>
                          <th className="p-2  text-left text-xs  text-slate-600 ">Rev</th>
                          <th className="p-2  text-left text-xs  text-slate-600 ">Description</th>
                          <th className="p-2  text-left text-xs  text-slate-600 ">Qty</th>
                          <th className="p-2  text-right text-xs  text-slate-600 ">PDF / Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {orderDetails.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-xs">
                            <td className="p-2  whitespace-nowrap text-slate-600">{item.item_code}</td>
                            <td className="p-2  whitespace-nowrap">
                              {editingItem?.id === item.id ? (
                                <input 
                                  type="text" 
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-xs"
                                  value={editItemData.drawing_no}
                                  onChange={(e) => setEditItemData({...editItemData, drawing_no: e.target.value})}
                                />
                              ) : (
                                <span className=" text-slate-900">{item.drawing_no || '—'}</span>
                              )}
                            </td>
                            <td className="p-2  whitespace-nowrap">
                              {editingItem?.id === item.id ? (
                                <input 
                                  type="text" 
                                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                                  value={editItemData.revision_no}
                                  onChange={(e) => setEditItemData({...editItemData, revision_no: e.target.value})}
                                />
                              ) : (
                                <span className="text-slate-600">{item.revision_no || '—'}</span>
                              )}
                            </td>
                            <td className="p-2  text-slate-600">{item.description}</td>
                            <td className="p-2  whitespace-nowrap text-center  text-indigo-600">{parseFloat(item.quantity).toFixed(3)} {item.unit}</td>
                            <td className="p-2  whitespace-nowrap text-right">
                              {editingItem?.id === item.id ? (
                                <div className="flex flex-col gap-2 items-end">
                                  <input 
                                    type="file" 
                                    accept=".pdf"
                                    className="text-xs"
                                    onChange={(e) => setEditItemData({...editItemData, drawing_pdf: e.target.files[0]})}
                                  />
                                  <div className="space-x-2">
                                    <button 
                                      onClick={() => handleSaveItem(item.id)}
                                      disabled={itemSaveLoading}
                                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs  hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingItem(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs  hover:bg-slate-300 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => openAddMaterialModal(item)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                                    title="Add Material"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                                  </button>
                                  {item.drawing_pdf ? (
                                    <button 
                                      onClick={() => handlePreview(item)}
                                      className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                                      title="View Drawing"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                  <button 
                                    onClick={() => handleEditItem(item)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                                    title="Edit Drawing Info"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-2border-t border-slate-200 flex justify-end">
                <button 
                  type="button" 
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 transition-colors"
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && reviewOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded  shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 sticky top-0">
              <h2 className="text-lg  text-white">
                {reviewDetails.length === 1 ? 'Drawing Review' : 'Design Review'} - {reviewOrder.company_name}
              </h2>
              <p className="text-indigo-100 text-xs mt-1">
                {reviewDetails.length === 1 ? `Drawing: ${reviewDetails[0].drawing_no}` : `Order: ${reviewOrder.project_name}`}
              </p>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs  text-slate-600 ">Customer</label>
                  <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder.company_name}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">{reviewOrder.po_number === 'NO-PO' ? 'Request Type' : 'PO Number'}</label>
                  <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder.po_number === 'NO-PO' ? 'Design Request' : reviewOrder.po_number || '—'}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">Project</label>
                  <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder.project_name}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">{reviewOrder.po_number === 'NO-PO' ? 'Request ID' : 'Sales Order'}</label>
                  <p className="text-sm  text-slate-900 text-xs mt-1">{(reviewOrder.po_number === 'NO-PO' ? 'DR-' : 'SO-') + String(reviewOrder.id).padStart(4, '0')}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-xs  text-slate-600  block mb-3">Drawing Details</label>
                {reviewLoading ? (
                  <div className="text-center py-4">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded  animate-spin mx-auto"></div>
                  </div>
                ) : reviewDetails.length > 0 ? (
                  <div className="space-y-3">
                    {reviewDetails.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3 flex-1">
                            {item.drawing_pdf && (
                              <button 
                                onClick={() => handlePreview(item)}
                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded  hover:bg-indigo-100 transition-all border border-indigo-100"
                                title="View Drawing"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <div className="grid grid-cols-4 gap-3 text-sm flex-1">
                              <div>
                                <span className="text-xs text-slate-500">Drawing No</span>
                                <p className=" text-slate-900 text-xs">{item.drawing_no || '—'}</p>
                              </div>
                            <div>
                              <span className="text-xs text-slate-500">Group</span>
                              <p className=" text-slate-900 text-xs">
                                {item.item_group ? (
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">
                                    {item.item_group}
                                  </span>
                                ) : '—'}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500">Revision</span>
                              <p className=" text-slate-900 text-xs">{item.revision_no || '—'}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500">Quantity</span>
                              <p className=" text-slate-900 text-xs">{item.quantity || 1} {item.unit || 'NOS'}</p>
                            </div>
                          </div>
                        </div>
                          {((item.item_status || item.status) === 'REJECTED') ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 roundedtext-xs   border border-red-200">Rejected</span>
                          ) : ((item.item_status || item.status) === 'Approved ') ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 roundedtext-xs   border border-emerald-200">Approved</span>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveItem(item.id)}
                                className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white roundedtext-xs   border border-emerald-200 transition-all "
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectItem(item.id)}
                                className="px-2 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 roundedtext-xs   border border-transparent hover:border-red-200 transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{item.item_description || item.description || 'No description provided'}</p>
                        
                        {item.drawing_pdf && (
                          <div className="mt-4 border rounded  overflow-hidden bg-white">
                            {['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(item.drawing_pdf.toLowerCase().split('.').pop()) ? (
                              <div className="relative group">
                                <img 
                                  src={getFileUrl(item.drawing_pdf)} 
                                  alt="Drawing" 
                                  className="max-w-full h-auto object-contain mx-auto max-h-[400px] cursor-pointer"
                                  onClick={() => handlePreview(item)}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-900 p-2 .5 rounded text-xs    transition-opacity">
                                    Click to Enlarge
                                  </span>
                                </div>
                              </div>
                            ) : item.drawing_pdf.toLowerCase().endsWith('.pdf') ? (
                              <div className="p-6 flex flex-col items-center justify-center bg-slate-50/50">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded  flex items-center justify-center mb-3">
                                  <FileText className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm  text-slate-900 mb-1">PDF Drawing Available</h4>
                                <p className="text-xs text-slate-500 mb-4">This drawing is in PDF format and cannot be previewed directly here.</p>
                                <button 
                                  onClick={() => handlePreview(item)}
                                  className="p-2  bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 transition-all flex items-center gap-2 "
                                >
                                  <Eye className="w-4 h-4" />
                                  Open PDF Preview
                                </button>
                              </div>
                            ) : (
                              <div className="p-6 text-center text-slate-500 text-xs">
                                Preview not available for this file type
                              </div>
                            )}
                          </div>
                        )}

                        {(item.item_status === 'REJECTED' || item.status === 'REJECTED') && (item.item_rejection_reason || item.rejection_reason || item.reason) && (
                          <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                            <p className="text-[10px] text-red-500 italic leading-snug">
                              <span className="font-semibold not-italic mr-1">Reason:</span>
                              {item.item_rejection_reason || item.rejection_reason || item.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No drawing details available</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-end gap-3">
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="p-2  bg-slate-300 text-slate-900 rounded  text-xs  hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleApproveDesign(reviewOrder.id)}
                  className="p-2  bg-emerald-600 text-white rounded  text-xs  hover:bg-emerald-700 transition-colors"
                >
                  ✓ Approve & Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}></div>
            <div className="relative bg-white rounded  shadow-2xl max-w-lg w-full overflow-hidden transform transition-all border border-slate-200">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 border-b border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl  text-white mb-1">
                      Reject Reason
                    </h3>
                    <p className="text-indigo-100 text-xs ">
                      {rejectData.type === 'ITEM' ? 'Rejecting specific item' : `Rejecting order for ${reviewOrder?.company_name}`}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowRejectModal(false)}
                    className="text-white/80 hover:text-white transition-colors p-1"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs  text-slate-600 ">Customer</label>
                    <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder?.company_name}</p>
                  </div>
                  <div>
                    <label className="text-xs  text-slate-600 ">PO Number</label>
                    <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder?.po_number || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs  text-slate-600 ">Project</label>
                    <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder?.project_name}</p>
                  </div>
                  <div>
                    <label className="text-xs  text-slate-600 ">Sales Order</label>
                    <p className="text-sm  text-slate-900 text-xs mt-1">{reviewOrder?.so_number || '—'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-xs  text-slate-600  block mb-2">Rejection Reason</label>
                  <textarea
                    value={rejectData.reason}
                    onChange={(e) => setRejectData({ ...rejectData, reason: e.target.value })}
                    placeholder="Enter reason for rejection here..."
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all min-h-[120px] resize-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                <button 
                  onClick={() => setShowRejectModal(false)}
                  className="p-2  bg-slate-300 text-slate-900 rounded  text-xs  hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitRejection}
                  className="p-2  bg-red-600 text-white rounded  text-xs  hover:bg-red-700 transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DrawingPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default DesignOrders;

