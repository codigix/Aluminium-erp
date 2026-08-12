import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, DataTable, Modal, StatusBadge, FormControl, SearchableSelect } from '../components/ui.jsx';
import {
  Box,
  Layers,
  AlertTriangle,
  RefreshCw,
  Plus,
  FileEdit,
  Trash2,
  Search,
  CheckCircle2,
  X,
  Package,
  Database
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const StockBalance = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shapes, setShapes] = useState([]);
  const [shapesLoading, setShapesLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [masterItems, setMasterItems] = useState([]);
  const [masterItemsLoading, setMasterItemsLoading] = useState(false);


  useEffect(() => {
    const isAdd = location.pathname.includes('/add');
    const isEdit = location.pathname.includes('/edit');
    const id = searchParams.get('id');

    if (isAdd) {
      setShowAddModal(true);
      setShowEditModal(false);
    } else if (isEdit && id) {
      const item = balances.find(b => String(b.id) === String(id));
      if (item) {
        setEditingItem({ ...item });
        setShowEditModal(true);
        setShowAddModal(false);
      }
    } else {
      setShowAddModal(false);
      setShowEditModal(false);
    }
  }, [location.pathname, searchParams, balances]);
  const [newItem, setNewItem] = useState({
    itemName: '',
    itemGroup: 'Raw Material',
    itemCode: 'Auto-generated',
    defaultUom: 'Nos',
    valuationRate: 0,
    drawingNo: '',
    materialGrade: '',
    // KG-wise dimension fields
    materialId: '',
    density: '',
    shapeId: '',
    length: '',
    width: '',
    thickness: '',
    diameter: '',
    outerDiameter: '',
    weightPerUnit: 0,
    weightUom: 'Kg'
  });
  const [stats, setStats] = useState({
    totalItems: 0,
    totalBalance: 0,
    lowStock: 0
  });

  useEffect(() => {
    fetchStockBalance();
    fetchShapes();
    fetchMaterials();
    fetchMasterItems();
  }, []);

  const fetchMasterItems = async () => {
    try {
      setMasterItemsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance?includeAll=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMasterItems(data);
      }
    } catch (error) {
      console.error('Failed to fetch master items:', error);
    } finally {
      setMasterItemsLoading(false);
    }
  };


  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true);
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
  };

  const fetchShapes = async () => {
    try {
      setShapesLoading(true);
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
  };

  // Compute selected shape name from newItem.shapeId
  const selectedNewShapeName = (() => {
    const s = shapes.find(s => String(s.id) === String(newItem.shapeId));
    return (s?.name || '').toLowerCase().trim();
  })();

  // Auto-calculate weight per unit from dimensions + density
  useEffect(() => {
    const shape = selectedNewShapeName;
    const density = parseFloat(newItem.density) || 0;
    if (density <= 0 || !shape) return;

    let calculatedWeight = 0;
    if (shape === 'plate') {
      const l = parseFloat(newItem.length) || 0;
      const w = parseFloat(newItem.width) || 0;
      const t = parseFloat(newItem.thickness) || 0;
      calculatedWeight = (l * w * t * density) / 1000000;
    } else if (shape === 'round') {
      const d = parseFloat(newItem.diameter) || 0;
      const l = parseFloat(newItem.length) || 0;
      calculatedWeight = (Math.PI * Math.pow(d, 2) / 4 * l * density) / 1000000;
    } else if (shape === 'pipe') {
      const od = parseFloat(newItem.outerDiameter) || 0;
      const t = parseFloat(newItem.thickness) || 0;
      const l = parseFloat(newItem.length) || 0;
      const id = od - 2 * t;
      if (id >= 0) calculatedWeight = (Math.PI * (Math.pow(od, 2) - Math.pow(id, 2)) / 4 * l * density) / 1000000;
    } else if (shape.includes('square tube')) {
      const a = parseFloat(newItem.width) || 0;
      const t = parseFloat(newItem.thickness) || 0;
      const l = parseFloat(newItem.length) || 0;
      calculatedWeight = ((a * a - Math.pow(a - 2 * t, 2)) * l * density) / 1000000;
    } else if (shape.includes('rectangular tube')) {
      const b = parseFloat(newItem.width) || 0;
      const h = parseFloat(newItem.outerDiameter) || 0;
      const t = parseFloat(newItem.thickness) || 0;
      const l = parseFloat(newItem.length) || 0;
      calculatedWeight = ((b * h - (b - 2 * t) * (h - 2 * t)) * l * density) / 1000000;
    } else if (shape === 'hexagonal bar') {
      const af = parseFloat(newItem.width) || 0;
      const l = parseFloat(newItem.length) || 0;
      calculatedWeight = ((Math.sqrt(3) / 2) * af * af * l * density) / 1000000;
    }

    if (calculatedWeight > 0) {
      setNewItem(prev => ({ ...prev, weightPerUnit: parseFloat(calculatedWeight.toFixed(4)) }));
    }
  }, [
    newItem.length, newItem.width, newItem.thickness,
    newItem.diameter, newItem.outerDiameter, newItem.density, selectedNewShapeName
  ]);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newItem)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create item');
      }

      successToast('New item created successfully');
      navigate('/inventory/stock-balance');
      setNewItem({
        itemName: '',
        itemGroup: 'Raw Material',
        itemCode: 'Auto-generated',
        defaultUom: 'Nos',
        valuationRate: 0,
        drawingNo: '',
        materialGrade: ''
      });
      fetchStockBalance();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/items/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemCode: editingItem.item_code,
          itemName: editingItem.material_name,
          itemGroup: editingItem.material_type,
          defaultUom: editingItem.unit,
          valuationRate: editingItem.valuation_rate,
          drawingNo: editingItem.drawing_no,
          materialGrade: editingItem.material_grade
        })
      });

      if (!response.ok) throw new Error('Failed to update item');

      successToast('Item updated successfully');
      navigate('/inventory/stock-balance');
      fetchStockBalance();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item) => {
    navigate(`/stock-balance/edit?id=${item.id}`);
  };

  const fetchStockBalance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch Stock Balance');
      const data = await response.json();
      const filteredData = (Array.isArray(data) ? data : []).filter(item => {
        const type = (item.material_type || '').toUpperCase();
        return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'FINISHED GOODS' && type !== 'FINISHED_GOODS' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY' && type !== 'SA' && type !== 'ASSEMBLY' && type !== 'PART';
      });
      setBalances(filteredData);

      const totalBalance = filteredData.reduce((sum, item) => sum + (parseFloat(item.current_balance) || 0), 0);
      const lowStock = filteredData.filter(item => (parseFloat(item.current_balance) || 0) < 10).length;

      setStats({
        totalItems: filteredData.length,
        totalBalance,
        lowStock
      });
    } catch (error) {
      console.error('Error fetching stock balance:', error);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will remove the item from stock balance and erase all of its ledger history!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/stock/balance/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to delete stock balance');

        successToast('Stock balance has been removed');
        fetchStockBalance();
      } catch (error) {
        errorToast(error.message || 'Failed to delete balance');
      }
    }
  };

  const getStatusColor = (val) => {
    const amount = parseFloat(val || 0);
    if (amount <= 0) return { indicator: 'bg-rose-500', text: 'text-rose-600' };
    if (amount < 10) return { indicator: 'bg-amber-500', text: 'text-amber-600' };
    return { indicator: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  const columns = [
    {
      label: 'Item Code',
      key: 'item_code',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    {
      label: 'Material Name',
      key: 'material_name',
      sortable: true,
      render: (val, row) => {
        return (
          <div className="flex flex-col">
            <span className="text-slate-900 ">{val || '—'}</span>
            {row.material_grade && (
              <span className="text-xs  text-slate-400 leading-none mt-0.5">{row.material_grade}</span>
            )}
          </div>
        );
      }
    },
    {
      label: 'Dimension',
      key: 'length',
      render: (_, row) => {
        return <span className="text-slate-500 text-xs">{formatDimensions(row) || '—'}</span>;
      }
    },
    {
      label: 'Material Type',
      key: 'material_type',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs">{val || '—'}</span>
    },
    {
      label: 'Qty (NOS)',
      key: 'current_balance',
      sortable: true,
      className: 'text-right',
      render: (val) => {
        const statusColor = getStatusColor(val);
        return (
          <div className="flex items-center justify-end gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded  ${statusColor.indicator}`}></span>
            <span className={`text-sm font-semibold ${statusColor.text}`}>
              {parseFloat(val || 0).toFixed(0)}
            </span>
            <span className="text-[10px] text-slate-400">NOS</span>
          </div>
        );
      }
    },
    {
      label: 'Weight (KG)',
      key: 'current_weight',
      sortable: true,
      className: 'text-right',
      render: (val, row) => {
        const isBoughtOut = (row.material_type || '').toUpperCase().trim().includes('BOUGHT') || (row.item_code && String(row.item_code).toUpperCase().startsWith('BO-'));
        if (isBoughtOut) return <div className="text-right text-slate-400 font-medium text-xs">—</div>;
        const wt = parseFloat(val || 0);
        return (
          <div className="flex items-center justify-end gap-1">
            <span className={`text-sm font-semibold ${wt > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
              {wt.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-400">KG</span>
          </div>
        );
      }
    },
    {
      label: 'Last Updated',
      key: 'last_updated',
      sortable: true,
      render: (val) => <span className="text-slate-400 text-xs">{new Date(val).toLocaleDateString()}</span>
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, item) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => openEditModal(item)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all"
            title="Edit Master Item"
          >
            <FileEdit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded  transition-all"
            title="Remove from Balance"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-indigo-600 border border-indigo-700 rounded p-5 flex items-center justify-between shadow-xl shadow-indigo-100">
            <div>
              <p className="text-xs text-indigo-100    mb-1">Total Items</p>
              <p className="text-xl   text-white">{stats.totalItems}</p>
            </div>
            <div className="p-2 bg-indigo-500/50 backdrop-blur-sm rounded  text-white ">
              <Box className="w-3 h-3" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 flex items-center justify-between hover: transition-all">
            <div>
              <p className="text-xs text-slate-500    mb-1">Total Balance</p>
              <p className="text-xl  text-slate-900">{parseFloat(stats.totalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded  text-emerald-600 border border-emerald-100">
              <Database className="w-3 h-3" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 flex items-center justify-between hover: transition-all">
            <div>
              <p className="text-xs text-slate-500    mb-1">Low Stock Items</p>
              <p className="text-xl   text-rose-600">{stats.lowStock}</p>
            </div>
            <div className="p-2 bg-rose-50 rounded  text-rose-600 border border-rose-100">
              <AlertTriangle className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
        <div>
          <h2 className="text-xl  text-slate-900 ">Inventory Status</h2>
          <p className="text-xs text-slate-500">Manage master items and monitor stock levels</p>
        </div>
        <button
          onClick={() => navigate('/stock-balance/add')}
          className="flex items-center gap-2 p-2  bg-indigo-600 text-white rounded text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create New Item
        </button>
      </div>

      <DataTable
        columns={columns}
        data={balances}
        loading={loading}
        pageSize={5}
        searchPlaceholder="Search by item code or description..."
        emptyMessage="No stock items found"
        className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm"
      />

      {/* Add Item Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => navigate('/inventory/stock-balance')}
        title="Add New Master Item"
        size="2xl"
      >
        <form onSubmit={handleCreateItem} className="space-y-2">
          {/* ... existing form fields ... */}
          <div className="grid grid-cols-2 gap-2">
            <FormControl label="Item Name">
              <input
                type="text"
                required
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. MS Plate 10mm"
              />
            </FormControl>

            <FormControl label="Item Group">
              <select
                value={newItem.itemGroup}
                onChange={(e) => setNewItem({ ...newItem, itemGroup: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="Raw Material">Raw Material</option>
                <option value="Consumable">Consumable</option>
                <option value="Packaging">Packaging</option>
                <option value="Service">Service</option>
                <option value="Other">Other</option>
              </select>
            </FormControl>

            <FormControl label="Item Code">
              <SearchableSelect
                options={[
                  { id: 'auto-generated', label: 'Auto-generated', value: 'Auto-generated' },
                  ...masterItems.map(item => ({
                    id: item.item_code,
                    label: `${item.material_name || item.item_description || 'Unnamed'} (${item.item_code})`,
                    value: item.item_code
                  }))
                ]}
                value={newItem.itemCode}
                onChange={(e) => {
                  const val = e.target.value;
                  const selected = masterItems.find(i => i.item_code === val);
                  setNewItem(prev => ({
                    ...prev,
                    itemCode: val,
                    itemName: selected?.material_name || selected?.item_description || prev.itemName,
                    itemGroup: selected?.material_type ? (
                      selected.material_type.toUpperCase() === 'RAW_MATERIAL' ? 'Raw Material' : selected.material_type
                    ) : prev.itemGroup,
                    defaultUom: selected?.unit || prev.defaultUom,
                    valuationRate: selected?.valuation_rate || prev.valuationRate,
                    drawingNo: selected?.drawing_no || prev.drawingNo,
                    materialGrade: selected?.material_grade || prev.materialGrade,
                    shapeId: selected?.shape_id ? String(selected.shape_id) : prev.shapeId,
                    density: selected?.density ? String(selected.density) : prev.density,
                    materialId: selected?.material_id ? String(selected.material_id) : prev.materialId,
                    length: selected?.length ? String(selected.length) : prev.length,
                    width: selected?.width ? String(selected.width) : prev.width,
                    thickness: selected?.thickness ? String(selected.thickness) : prev.thickness,
                    diameter: selected?.diameter ? String(selected.diameter) : prev.diameter,
                    outerDiameter: selected?.outer_diameter ? String(selected.outer_diameter) : prev.outerDiameter,
                    weightPerUnit: selected?.weight_per_unit || prev.weightPerUnit
                  }));
                }}
                allowCustom={true}
                placeholder="Select or enter code..."
                className="text-xs bg-white w-full"
              />
            </FormControl>


            <FormControl label="Default UOM">
              <select
                value={newItem.defaultUom}
                onChange={(e) => setNewItem({ ...newItem, defaultUom: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="Nos">Nos</option>
                <option value="Kg">Kg</option>
                <option value="Mtr">Mtr</option>
                <option value="Set">Set</option>
                <option value="Pkt">Pkt</option>
              </select>
            </FormControl>

            <FormControl label="Valuation Rate">
              <input
                type="number"
                step="0.01"
                value={newItem.valuationRate}
                onChange={(e) => setNewItem({ ...newItem, valuationRate: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>

            <FormControl label="Drawing No (Optional)">
              <input
                type="text"
                value={newItem.drawingNo}
                onChange={(e) => setNewItem({ ...newItem, drawingNo: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>
          </div>

          {/* Dimension Fields for KG-based materials */}
          {(newItem.defaultUom === 'Kg' || newItem.defaultUom === 'Kgs') && (
            <div className="space-y-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded">
              <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                Material &amp; Shape Dimensions (all in mm)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Material Type */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Material Type</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={newItem.materialId}
                    onChange={e => {
                      const mId = e.target.value;
                      const mat = materials.find(m => String(m.id) === String(mId));
                      setNewItem(prev => ({
                        ...prev,
                        materialId: mId,
                        density: mat?.density || ''
                      }));
                    }}
                  >
                    <option value="">Select Material</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {/* Shape Type */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Shape Type</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={newItem.shapeId}
                    onChange={e => {
                      const sId = e.target.value;
                      setNewItem(prev => ({
                        ...prev,
                        shapeId: sId,
                        length: '', width: '', thickness: '', diameter: '', outerDiameter: ''
                      }));
                    }}
                  >
                    <option value="">Select Shape</option>
                    {shapes.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shape-wise inputs */}
              {selectedNewShapeName && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedNewShapeName === 'plate' && (<>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Length (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.length} onChange={e => setNewItem(p => ({ ...p, length: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Width (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.width} onChange={e => setNewItem(p => ({ ...p, width: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Thickness (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.thickness} onChange={e => setNewItem(p => ({ ...p, thickness: e.target.value }))} /></div>
                  </>)}
                  {selectedNewShapeName === 'round' && (<>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Diameter (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.diameter} onChange={e => setNewItem(p => ({ ...p, diameter: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Length (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.length} onChange={e => setNewItem(p => ({ ...p, length: e.target.value }))} /></div>
                  </>)}
                  {selectedNewShapeName === 'pipe' && (<>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Outer Dia (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.outerDiameter} onChange={e => setNewItem(p => ({ ...p, outerDiameter: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Thickness (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.thickness} onChange={e => setNewItem(p => ({ ...p, thickness: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Length (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.length} onChange={e => setNewItem(p => ({ ...p, length: e.target.value }))} /></div>
                  </>)}
                  {selectedNewShapeName.includes('square tube') && (<>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Side A (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.width} onChange={e => setNewItem(p => ({ ...p, width: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Thickness (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.thickness} onChange={e => setNewItem(p => ({ ...p, thickness: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Length (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.length} onChange={e => setNewItem(p => ({ ...p, length: e.target.value }))} /></div>
                  </>)}
                  {selectedNewShapeName.includes('rectangular tube') && (<>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Width B (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.width} onChange={e => setNewItem(p => ({ ...p, width: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Height H (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.outerDiameter} onChange={e => setNewItem(p => ({ ...p, outerDiameter: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Thickness (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.thickness} onChange={e => setNewItem(p => ({ ...p, thickness: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Length (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.length} onChange={e => setNewItem(p => ({ ...p, length: e.target.value }))} /></div>
                  </>)}
                  {selectedNewShapeName === 'hexagonal bar' && (<>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Across Flats AF (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.width} onChange={e => setNewItem(p => ({ ...p, width: e.target.value }))} /></div>
                    <div className="space-y-1"><label className="text-xs text-slate-500">Length (mm)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs outline-none" placeholder="0" value={newItem.length} onChange={e => setNewItem(p => ({ ...p, length: e.target.value }))} /></div>
                  </>)}
                </div>
              )}

              {/* Auto weight display */}
              {parseFloat(newItem.weightPerUnit || 0) > 0 && (
                <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700">
                  <span className="font-semibold">Weight/Unit:</span>
                  <span>{parseFloat(newItem.weightPerUnit || 0).toFixed(4)} Kg</span>
                  <span className="text-emerald-500 ml-1">(auto-calculated)</span>
                </div>
              )}
            </div>
          )}


          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-balance')}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded  text-xs  hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Item
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => navigate('/inventory/stock-balance')}
        title="Edit Master Item"
        size="2xl"
      >
        {editingItem && (
          <form onSubmit={handleEditItem} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <FormControl label="Item Name">
                <input
                  type="text"
                  required
                  value={editingItem.material_name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, material_name: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Item Group">
                <select
                  value={editingItem.material_type || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, material_type: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="Raw Material">Raw Material</option>
                  <option value="Consumable">Consumable</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Service">Service</option>
                  <option value="Other">Other</option>
                </select>
              </FormControl>

              <FormControl label="Item Code">
                <input
                  type="text"
                  readOnly
                  value={editingItem.item_code || ''}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded  text-xs  text-slate-500 outline-none cursor-not-allowed"
                />
              </FormControl>

              <FormControl label="Default UOM">
                <input
                  type="text"
                  value={editingItem.unit || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Valuation Rate">
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.valuation_rate || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, valuation_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Drawing No">
                <input
                  type="text"
                  value={editingItem.drawing_no || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, drawing_no: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-200 rounded  text-xs  text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/inventory/stock-balance')}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded  text-xs  hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />}
                Update Item
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default StockBalance;

