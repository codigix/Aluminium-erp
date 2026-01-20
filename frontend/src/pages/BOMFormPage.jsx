import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const BOMFormPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [workstations, setWorkstations] = useState([]);
  const [operationsList, setOperationsList] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [bomData, setBomData] = useState({
    materials: [],
    components: [],
    operations: [],
    scrap: []
  });
  const [collapsedSections, setCollapsedSections] = useState({
    productInfo: false,
    components: false,
    materials: false,
    operations: false,
    scrap: false,
    costing: false
  });

  // Form States
  const [productForm, setProductForm] = useState({
    itemGroup: 'FG',
    uom: 'Kg',
    revision: '1',
    description: '',
    isActive: true,
    isDefault: false,
    quantity: 1
  });

  const [materialForm, setMaterialForm] = useState({ materialName: '', qty: '', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '' });
  const [componentForm, setComponentForm] = useState({ componentCode: '', quantity: '', uom: 'Kg', rate: '', lossPercent: '', notes: '' });
  const [operationForm, setOperationForm] = useState({ operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' });
  const [scrapForm, setScrapForm] = useState({ itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '' });

  const itemId = window.location.pathname.split('/').filter(Boolean).pop();

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      // Fetch Item Details
      const itemResponse = await fetch(`${API_BASE}/sales-orders/items/${itemId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!itemResponse.ok) throw new Error('Failed to fetch item details');
      const itemData = await itemResponse.json();
      setSelectedItem(itemData);
      setProductForm(prev => ({
        ...prev,
        description: itemData.description || '',
        uom: itemData.unit || 'Kg',
        itemGroup: itemData.item_group || 'FG',
        isActive: itemData.is_active !== 0,
        isDefault: itemData.is_default !== 0,
        quantity: itemData.quantity || 1
      }));

      // Fetch BOM Details
      const bomResponse = await fetch(`${API_BASE}/bom/items/${itemId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!bomResponse.ok) throw new Error('Failed to fetch BOM details');
      const bomData = await bomResponse.json();
      setBomData(bomData);

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

      // Fetch Stock Items (Raw Materials)
      const stockResponse = await fetch(`${API_BASE}/stock/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (stockResponse.ok) {
        const stockData = await stockResponse.json();
        setStockItems(stockData);
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (itemId) {
      fetchData();
    }
  }, [itemId, fetchData]);

  const handleAddSectionItem = async (section, formData, setFormState, initialForm) => {
    try {
      const token = localStorage.getItem('authToken');
      const payload = { ...formData };

      if (section === 'materials') {
        if (!payload.materialName || !payload.qty) {
          throw new Error('Material Name and Quantity are required');
        }
        // Drawing Validation
        const stockItem = stockItems.find(i => i.material_name === payload.materialName);
        if (stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && selectedItem?.drawing_no && stockItem.drawing_no !== selectedItem.drawing_no) {
          const confirm = await Swal.fire({
            title: 'Drawing Mismatch',
            text: `This material is linked to drawing ${stockItem.drawing_no}, but the product drawing is ${selectedItem.drawing_no}. Continue?`,
            icon: 'warning',
            showCancelButton: true
          });
          if (!confirm.isConfirmed) return;
        }
        payload.qtyPerPc = parseFloat(formData.qty) || 0;
        payload.materialType = 'Raw Material';
        payload.rate = parseFloat(payload.rate) || 0;
        delete payload.qty;
      } else if (section === 'components') {
        if (!payload.componentCode || !payload.quantity) {
          throw new Error('Component Code and Quantity are required');
        }
        // Drawing Validation
        const stockItem = stockItems.find(i => i.item_code === payload.componentCode);
        if (stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && selectedItem?.drawing_no && stockItem.drawing_no !== selectedItem.drawing_no) {
          const confirm = await Swal.fire({
            title: 'Drawing Mismatch',
            text: `This component is linked to drawing ${stockItem.drawing_no}, but the product drawing is ${selectedItem.drawing_no}. Continue?`,
            icon: 'warning',
            showCancelButton: true
          });
          if (!confirm.isConfirmed) return;
        }
        payload.quantity = parseFloat(payload.quantity) || 0;
        payload.rate = parseFloat(payload.rate) || 0;
        payload.lossPercent = parseFloat(payload.lossPercent) || 0;
      } else if (section === 'operations') {
        if (!payload.operationName || payload.cycleTimeMin === '' || payload.hourlyRate === '') {
          throw new Error('Operation Name, Cycle Time, and Hourly Rate are required');
        }
        payload.cycleTimeMin = parseFloat(payload.cycleTimeMin) || 0;
        payload.setupTimeMin = parseFloat(payload.setupTimeMin) || 0;
        payload.hourlyRate = parseFloat(payload.hourlyRate) || 0;
      } else if (section === 'scrap') {
        if (!payload.itemCode || payload.inputQty === '' || payload.rate === '') {
          throw new Error('Item Code, Input Qty, and Rate are required');
        }
        // Drawing Validation
        const stockItem = stockItems.find(i => i.item_code === payload.itemCode);
        if (stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && selectedItem?.drawing_no && stockItem.drawing_no !== selectedItem.drawing_no) {
          const confirm = await Swal.fire({
            title: 'Drawing Mismatch',
            text: `This scrap item is linked to drawing ${stockItem.drawing_no}, but the product drawing is ${selectedItem.drawing_no}. Continue?`,
            icon: 'warning',
            showCancelButton: true
          });
          if (!confirm.isConfirmed) return;
        }
        payload.inputQty = parseFloat(payload.inputQty) || 0;
        payload.lossPercent = parseFloat(payload.lossPercent) || 0;
        payload.rate = parseFloat(payload.rate) || 0;
      }

      const response = await fetch(`${API_BASE}/bom/items/${itemId}/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add ${section}`);
      }
      const result = await response.json();
      
      setBomData(prev => ({
        ...prev,
        [section]: [...prev[section], { ...payload, id: result.id }]
      }));
      setFormState(initialForm);
      Swal.fire('Success', `${section} added`, 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleDeleteSectionItem = async (section, id) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/${section}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Failed to delete ${section}`);
      
      setBomData(prev => ({
        ...prev,
        [section]: prev[section].filter(item => item.id !== id)
      }));
      Swal.fire('Deleted', `${section} removed`, 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleCreateBOM = async () => {
    try {
      if (!selectedItem?.id) {
        throw new Error('Product/Item not selected');
      }
      if (!productForm.quantity || productForm.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      if (bomData.materials.length === 0 && bomData.components.length === 0) {
        throw new Error('At least one raw material or sub-assembly component is required');
      }

      const token = localStorage.getItem('authToken');
      const bomPayload = {
        itemId: selectedItem.id,
        productForm: productForm,
        materials: bomData.materials,
        components: bomData.components,
        operations: bomData.operations,
        scrap: bomData.scrap,
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
      Swal.fire('Success', 'BOM created successfully', 'success').then(() => {
        navigate('/bom-creation');
      });
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  // Cost Calculations
  const batchQty = parseFloat(productForm.quantity || 1);

  const componentsCost = bomData.components.reduce((sum, c) => {
    const baseCost = parseFloat(c.quantity || 0) * parseFloat(c.rate || 0);
    const lossPercent = parseFloat(c.loss_percent || 0) / 100;
    const loss = baseCost * lossPercent;
    return sum + (baseCost - loss);
  }, 0);
  
  const rawMaterialsCost = bomData.materials.reduce((sum, m) => 
    sum + (parseFloat(m.qty_per_pc || 0) * batchQty * parseFloat(m.rate || 0)), 0);

  const scrapLoss = bomData.scrap.reduce((sum, s) => {
    const input = parseFloat(s.input_qty || 0);
    const loss = parseFloat(s.loss_percent || 0) / 100;
    const rate = parseFloat(s.rate || 0);
    return sum + (input * loss * rate);
  }, 0);

  const materialCostAfterScrap = (componentsCost + rawMaterialsCost) - scrapLoss;
  
  const operationsCost = bomData.operations.reduce((sum, o) => {
    const cycle = parseFloat(o.cycle_time_min || 0);
    const setup = parseFloat(o.setup_time_min || 0);
    const rate = parseFloat(o.hourly_rate || 0);
    return sum + (((cycle * batchQty) + setup) / 60 * rate);
  }, 0);

  const totalBOMCost = materialCostAfterScrap + operationsCost;
  const costPerUnit = totalBOMCost / batchQty;
  const totalScrapQty = bomData.scrap.reduce((sum, s) => sum + (parseFloat(s.input_qty || 0) * (parseFloat(s.loss_percent || 0) / 100)), 0);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Item Details...</div>;
  if (!selectedItem) return <div className="p-8 text-center text-red-500">Item not found</div>;

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-slate-900">
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold">Create BOM</h1>
              <p className="text-[10px] text-slate-400 tracking-wider">Bill of Materials</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium border border-indigo-100 hover:bg-indigo-100 transition-colors">
              Drafts
            </button>
            <button 
              onClick={() => navigate('/bom-creation')} 
              className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>
        </div>

        {/* SECTION 1: Product Information */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
          <div 
            className="bg-white p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('productInfo')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Product Information</h4>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Basics</p>
              </div>
            </div>
            <div className="text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${collapsedSections.productInfo ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.productInfo && (
            <div className="p-6 pt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px]  text-slate-500 ">Product Name *</label>
                  <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                    <option>{selectedItem.description} {selectedItem.drawing_no ? `(${selectedItem.drawing_no})` : ''}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]  text-slate-500 ">Item Code *</label>
                  <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                    <option>{selectedItem.item_code} {selectedItem.drawing_no && selectedItem.drawing_no !== selectedItem.item_code ? `[Drg: ${selectedItem.drawing_no}]` : ''}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]  text-slate-500 ">Item Group</label>
                  <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={productForm.itemGroup} onChange={(e) => setProductForm({...productForm, itemGroup: e.target.value})}>
                    <option value="FG">FG</option>
                    <option value="SFG">SFG</option>
                    <option value="Sub Assembly">Sub Assembly</option>
                    <option value="Assembly">Assembly</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]  text-slate-500 ">Base Quantity (For Cost/Unit) *</label>
                  <input type="number" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Enter finished product quantity" step="0.01" min="0.01" value={productForm.quantity} onChange={(e) => setProductForm({...productForm, quantity: e.target.value})} />
                  <p className="text-[9px] text-slate-400 mt-1">💡 This is used to calculate Cost Per Unit = Total BOM Cost ÷ Base Quantity</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]  text-slate-500 ">UOM</label>
                  <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={productForm.uom} onChange={(e) => setProductForm({...productForm, uom: e.target.value})}>
                    <option value="Kg">Kg</option>
                    <option value="Nos">Nos</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]  text-slate-500 ">Revision</label>
                  <input type="text" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={productForm.revision} onChange={(e) => setProductForm({...productForm, revision: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px]  text-slate-500 ">Description</label>
                <textarea rows="2" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" placeholder="Notes..." value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} />
              </div>
              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={productForm.isActive} onChange={(e) => setProductForm({...productForm, isActive: e.target.checked})} />
                  <span className="text-sm  text-slate-700 group-hover:text-blue-600 transition-colors">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={productForm.isDefault} onChange={(e) => setProductForm({...productForm, isDefault: e.target.checked})} />
                  <span className="text-sm  text-slate-700 group-hover:text-blue-600 transition-colors">Default</span>
                </label>
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 2: Components */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
          <div 
            className="bg-white p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('components')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Components/Sub-Assemblies</h4>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">{bomData.components.length} items • ₹{componentsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${collapsedSections.components ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.components && (
            <div className="p-4 pt-0">
              <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 mb-4">
                <p className="text-xs font-bold text-indigo-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Component
                </p>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Component Code *</label>
                    <select 
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      value={componentForm.componentCode}
                      onChange={(e) => {
                        const item = stockItems.find(i => i.item_code === e.target.value);
                        setComponentForm({
                          ...componentForm,
                          componentCode: e.target.value,
                          rate: item ? (item.valuation_rate || 0) : componentForm.rate,
                          uom: item ? (item.unit || 'Kg') : componentForm.uom
                        });
                      }}
                    >
                      <option value="">Select Component</option>
                      {stockItems
                        .filter(item => !selectedItem?.drawing_no || !item.drawing_no || item.drawing_no === 'N/A' || item.drawing_no === selectedItem.drawing_no)
                        .map(item => (
                        <option key={item.id} value={item.item_code}>
                          {item.item_code} - {item.material_name} {item.drawing_no && item.drawing_no !== 'N/A' ? `(${item.drawing_no})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Qty *</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={componentForm.quantity} onChange={(e) => setComponentForm({...componentForm, quantity: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">UOM</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-lg text-xs" value={componentForm.uom} onChange={(e) => setComponentForm({...componentForm, uom: e.target.value})}>
                      <option value="Kg">Kg</option>
                      <option value="Nos">Nos</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Rate (₹)</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={componentForm.rate} onChange={(e) => setComponentForm({...componentForm, rate: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Loss % (Scrap)</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={componentForm.lossPercent} onChange={(e) => setComponentForm({...componentForm, lossPercent: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Notes</label>
                    <div className="flex gap-2">
                      <input className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="Notes" value={componentForm.notes} onChange={(e) => setComponentForm({...componentForm, notes: e.target.value})} />
                      <button 
                        onClick={() => handleAddSectionItem('components', componentForm, setComponentForm, { componentCode: '', quantity: '', uom: 'Kg', rate: '', lossPercent: '', notes: '' })} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {bomData.components.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px]  text-slate-400 ">Code</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Qty</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Rate</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Loss %</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Amount</th>
                        <th className="px-4 py-2 text-right text-[10px]  text-slate-400 ">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bomData.components.map((c) => {
                        const stockItem = stockItems.find(i => i.item_code === c.component_code);
                        const baseCost = parseFloat(c.quantity) * parseFloat(c.rate);
                        const lossPercent = parseFloat(c.loss_percent || 0) / 100;
                        const netCost = baseCost * (1 - lossPercent);
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs font-medium text-slate-700">
                              <div>{c.component_code}</div>
                              {stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && (
                                <div className="text-[9px] text-blue-500 ">Drg: {stockItem.drawing_no}</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-center">{c.quantity} {c.uom}</td>
                            <td className="px-4 py-2 text-xs text-center">₹{parseFloat(c.rate).toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs text-center">{parseFloat(c.loss_percent || 0).toFixed(2)}%</td>
                            <td className="px-4 py-2 text-xs text-center ">₹{netCost.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleDeleteSectionItem('components', c.id)} 
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Component"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 3: Materials */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
          <div 
            className="bg-white p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('materials')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Materials</h4>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">{bomData.materials.length} • ₹{rawMaterialsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${collapsedSections.materials ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.materials && (
            <div className="p-4 pt-0">
              <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 mb-4">
                <p className="text-xs font-bold text-emerald-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Raw Material
                </p>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Item Name *</label>
                    <select 
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      value={materialForm.materialName}
                      onChange={(e) => {
                        const item = stockItems.find(i => i.material_name === e.target.value);
                        setMaterialForm({
                          ...materialForm,
                          materialName: e.target.value,
                          rate: item ? (item.valuation_rate || 0) : materialForm.rate,
                          uom: item ? (item.unit || 'Kg') : materialForm.uom
                        });
                      }}
                    >
                      <option value="">Select Material</option>
                      {stockItems
                        .filter(item => !selectedItem?.drawing_no || !item.drawing_no || item.drawing_no === 'N/A' || item.drawing_no === selectedItem.drawing_no)
                        .map(item => (
                        <option key={item.id} value={item.material_name}>
                          {item.material_name} ({item.item_code}) {item.drawing_no && item.drawing_no !== 'N/A' ? `[Drg: ${item.drawing_no}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Qty *</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={materialForm.qty} onChange={(e) => setMaterialForm({...materialForm, qty: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">UOM</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-lg text-xs" value={materialForm.uom} onChange={(e) => setMaterialForm({...materialForm, uom: e.target.value})}>
                      <option value="Kg">Kg</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Item Group</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-lg text-xs" value={materialForm.itemGroup} onChange={(e) => setMaterialForm({...materialForm, itemGroup: e.target.value})}>
                      <option value="Raw Material">Raw Material</option>
                      <option value="Sub Assembly">Sub Assembly</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Rate (₹)</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={materialForm.rate} onChange={(e) => setMaterialForm({...materialForm, rate: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Warehouse</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-lg text-xs" value={materialForm.warehouse} onChange={(e) => setMaterialForm({...materialForm, warehouse: e.target.value})}>
                      <option value="">Select</option>
                      <option value="Main">Main</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Operation</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                        value={materialForm.operation} 
                        onChange={(e) => setMaterialForm({...materialForm, operation: e.target.value})}
                      >
                        <option value="">Select Operation</option>
                        {operationsList.map(op => (
                          <option key={op.id} value={op.operation_name}>
                            {op.operation_name}
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={() => handleAddSectionItem('materials', materialForm, setMaterialForm, { materialName: '', qty: '', uom: 'Kg', itemGroup: 'Raw Material', rate: '', warehouse: '', operation: '' })} 
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {bomData.materials.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px]  text-slate-400 ">Item</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Qty/pc</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Total Qty</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Rate</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Total Amount</th>
                        <th className="px-4 py-2 text-right text-[10px]  text-slate-400 ">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bomData.materials.map((m) => {
                        const stockItem = stockItems.find(i => i.material_name === m.material_name);
                        const qtyPerPc = parseFloat(m.qty_per_pc || 0);
                        const totalQty = qtyPerPc * batchQty;
                        const rate = parseFloat(m.rate || 0);
                        const amount = totalQty * rate;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs font-medium text-slate-700">
                              <div>{m.material_name || 'N/A'}</div>
                              {stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && (
                                <div className="text-[9px] text-blue-500 ">Drg: {stockItem.drawing_no}</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-center">{qtyPerPc.toFixed(4)}</td>
                            <td className="px-4 py-2 text-xs text-center font-medium text-slate-900">{totalQty.toFixed(2)} {m.uom || 'Kg'}</td>
                            <td className="px-4 py-2 text-xs text-center">₹{rate.toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs text-center  text-emerald-600">₹{amount.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleDeleteSectionItem('materials', m.id)} 
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Material"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 4: Operations */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
          <div 
            className="bg-white p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('operations')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Operations</h4>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">{bomData.operations.length} • ₹{operationsCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${collapsedSections.operations ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.operations && (
            <div className="p-4 pt-0">
              <div className="bg-purple-50/30 p-4 rounded-xl border border-purple-100 mb-4">
                <p className="text-xs font-bold text-purple-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Operation
                </p>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Operation *</label>
                    <select 
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      value={operationForm.operationName}
                      onChange={(e) => {
                        const op = operationsList.find(o => o.operation_name === e.target.value);
                        if (op) {
                          setOperationForm({
                            ...operationForm,
                            operationName: e.target.value,
                            workstation: op.workstation_code || op.workstation || '',
                            cycleTimeMin: op.std_time || 0,
                            hourlyRate: op.hourly_rate || 0
                          });
                        } else {
                          setOperationForm({ ...operationForm, operationName: e.target.value });
                        }
                      }}
                    >
                      <option value="">Select Operation</option>
                      {operationsList.map(op => (
                        <option key={op.id} value={op.operation_name}>
                          {op.operation_name} ({op.operation_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Operation Resource</label>
                    <select 
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs" 
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
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Cycle Time (min)</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={operationForm.cycleTimeMin} onChange={(e) => setOperationForm({...operationForm, cycleTimeMin: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Setup Time (min)</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={operationForm.setupTimeMin} onChange={(e) => setOperationForm({...operationForm, setupTimeMin: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Hourly Rate (₹)</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={operationForm.hourlyRate} onChange={(e) => setOperationForm({...operationForm, hourlyRate: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Cost (₹)</label>
                    <input type="text" readOnly className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs " value={((parseFloat(operationForm.cycleTimeMin || 0) / 60) * parseFloat(operationForm.hourlyRate || 0)).toFixed(2)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Type</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-lg text-xs" value={operationForm.operationType} onChange={(e) => setOperationForm({...operationForm, operationType: e.target.value})}>
                      <option value="In-House">In-House</option>
                      <option value="Sub-Contract">Sub-Contract</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Target Warehouse</label>
                    <select className="px-3 py-2 border border-slate-200 rounded-lg text-xs" value={operationForm.targetWarehouse} onChange={(e) => setOperationForm({...operationForm, targetWarehouse: e.target.value})}>
                      <option value="">Select</option>
                      <option value="WIP">WIP</option>
                      <option value="FG">FG</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button 
                      onClick={() => handleAddSectionItem('operations', operationForm, setOperationForm, { operationName: '', workstation: '', cycleTimeMin: '', setupTimeMin: '', hourlyRate: '', operationType: 'In-House', targetWarehouse: '' })} 
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  </div>
                </div>
              </div>
              {bomData.operations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px]  text-slate-400 ">Operation</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Cycle</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Setup</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Rate/hr</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Total Time</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Total Cost</th>
                        <th className="px-4 py-2 text-right text-[10px]  text-slate-400 ">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bomData.operations.map((o) => {
                        const cycleTime = parseFloat(o.cycle_time_min || 0);
                        const setupTime = parseFloat(o.setup_time_min || 0);
                        const hourlyRate = parseFloat(o.hourly_rate || 0);
                        const totalTimeMin = (cycleTime * batchQty) + setupTime;
                        const totalTimeHrs = totalTimeMin / 60;
                        const operationCost = totalTimeHrs * hourlyRate;
                        return (
                          <tr key={o.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs font-medium text-slate-700">
                              <div>{o.operation_name}</div>
                              <div className="text-[9px] text-slate-400">{o.workstation || 'N/A'}</div>
                            </td>
                            <td className="px-4 py-2 text-xs text-center">{cycleTime}m</td>
                            <td className="px-4 py-2 text-xs text-center">{setupTime}m</td>
                            <td className="px-4 py-2 text-xs text-center">₹{hourlyRate.toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs text-center">{totalTimeHrs.toFixed(2)}h</td>
                            <td className="px-4 py-2 text-xs text-center  text-purple-600">₹{operationCost.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleDeleteSectionItem('operations', o.id)} 
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Operation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 5: Scrap & Loss */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
          <div 
            className="bg-white p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('scrap')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Scrap & Loss</h4>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">{bomData.scrap.length} items</p>
              </div>
            </div>
            <div className="text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${collapsedSections.scrap ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.scrap && (
            <div className="p-4 pt-0">
              <div className="bg-orange-50/30 p-4 rounded-xl border border-orange-100 mb-4">
                <p className="text-xs font-bold text-orange-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Scrap
                </p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Item Code *</label>
                    <input type="text" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="Enter item code" value={scrapForm.itemCode} onChange={(e) => setScrapForm({...scrapForm, itemCode: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Name</label>
                    <select 
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      value={scrapForm.itemName}
                      onChange={(e) => {
                        const item = stockItems.find(i => i.material_name === e.target.value);
                        setScrapForm({
                          ...scrapForm,
                          itemName: e.target.value,
                          itemCode: item ? item.item_code : scrapForm.itemCode,
                          rate: item ? (item.valuation_rate || 0) : scrapForm.rate
                        });
                      }}
                    >
                      <option value="">Select Item</option>
                      {stockItems
                        .filter(item => !selectedItem?.drawing_no || !item.drawing_no || item.drawing_no === 'N/A' || item.drawing_no === selectedItem.drawing_no)
                        .map(item => (
                        <option key={item.id} value={item.material_name}>
                          {item.material_name} ({item.item_code}) {item.drawing_no && item.drawing_no !== 'N/A' ? `[Drg: ${item.drawing_no}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Input Qty *</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={scrapForm.inputQty} onChange={(e) => setScrapForm({...scrapForm, inputQty: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Loss %</label>
                    <input type="number" className="px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={scrapForm.lossPercent} onChange={(e) => setScrapForm({...scrapForm, lossPercent: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px]  text-slate-500  ml-1">Rate (₹)</label>
                    <div className="flex gap-2">
                      <input type="number" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs" placeholder="0" step="0.01" value={scrapForm.rate} onChange={(e) => setScrapForm({...scrapForm, rate: e.target.value})} />
                      <button 
                        onClick={() => handleAddSectionItem('scrap', scrapForm, setScrapForm, { itemCode: '', itemName: '', inputQty: '', lossPercent: '', rate: '' })} 
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {bomData.scrap.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px]  text-slate-400 ">Item Code</th>
                        <th className="px-4 py-2 text-left text-[10px]  text-slate-400 ">Name</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Input Qty</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Loss %</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Scrap Qty</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Rate (₹)</th>
                        <th className="px-4 py-2 text-center text-[10px]  text-slate-400 ">Amount (₹)</th>
                        <th className="px-4 py-2 text-right text-[10px]  text-slate-400 ">Action</th>
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
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs font-medium text-slate-700">
                              <div>{s.item_code || 'N/A'}</div>
                              {stockItem?.drawing_no && stockItem.drawing_no !== 'N/A' && (
                                <div className="text-[9px] text-blue-500 ">Drg: {stockItem.drawing_no}</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs font-medium text-slate-700">{s.item_name || 'N/A'}</td>
                            <td className="px-4 py-2 text-xs text-center">{inputQty.toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs text-center">{lossPercent.toFixed(2)}%</td>
                            <td className="px-4 py-2 text-xs text-center font-medium">{scrapQty.toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs text-center">₹{rate.toFixed(2)}</td>
                            <td className="px-4 py-2 text-xs text-center ">₹{scrapAmount.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleDeleteSectionItem('scrap', s.id)} 
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Scrap Item"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* SECTION 6: BOM Costing */}
        <Card className="p-0 border-slate-200 overflow-hidden shadow-sm">
          <div 
            className="bg-white p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => toggleSection('costing')}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">BOM Costing</h4>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">₹{totalBOMCost.toFixed(2)} Analysis for {batchQty} {productForm.uom}</p>
              </div>
            </div>
            <div className="text-slate-400">
              <svg className={`w-5 h-5 transition-transform ${collapsedSections.costing ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {!collapsedSections.costing && (
            <div className="p-6 pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[10px]  text-blue-600  mb-1">Material Cost</p>
                  <p className="text-2xl font-black text-blue-900">₹{materialCostAfterScrap.toFixed(2)}</p>
                  <p className="text-[10px] text-blue-400 font-medium mt-1">(Components - Scrap)</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-[10px]  text-purple-600  mb-1">Labour Cost</p>
                  <p className="text-2xl font-black text-purple-900">₹{operationsCost.toFixed(2)}</p>
                  <p className="text-[10px] text-purple-400 font-medium mt-1">Operations</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px]  text-emerald-600  mb-1">Total BOM Cost</p>
                  <p className="text-2xl font-black text-emerald-900">₹{totalBOMCost.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-400 font-medium mt-1">Per Unit Cost: ₹{costPerUnit.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-50">
                  <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-medium text-slate-600">Components Cost:</span>
                    <span className="text-xs text-slate-900">₹{componentsCost.toFixed(2)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-medium text-slate-600">Raw Materials Cost:</span>
                    <span className="text-xs text-slate-900">₹{rawMaterialsCost.toFixed(2)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors text-red-600">
                    <span className="text-xs font-medium">Scrap Loss (Deduction):</span>
                    <span className="text-xs ">-₹{scrapLoss.toFixed(2)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center bg-blue-50/50">
                    <span className="text-xs  text-blue-700">Material Cost (after Scrap):</span>
                    <span className="text-xs font-black text-blue-900">₹{materialCostAfterScrap.toFixed(2)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-medium text-slate-600">Operations Cost:</span>
                    <span className="text-xs text-slate-900">₹{operationsCost.toFixed(2)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center bg-amber-50/50">
                    <span className="text-xs  text-amber-700">Total Scrap Qty:</span>
                    <span className="text-xs font-black text-amber-900">{totalScrapQty.toFixed(2)} Kg</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-slate-900 rounded-xl text-white">
                <span className="text-sm   tracking-widest">Cost Per Unit:</span>
                <span className="text-xl font-black">₹{costPerUnit.toFixed(2)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <button 
            onClick={() => window.location.href = '/bom-creation'} 
            className="px-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreateBOM} 
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Create BOM
          </button>
        </div>
      </div>
    </div>
  );
};

export default BOMFormPage;
