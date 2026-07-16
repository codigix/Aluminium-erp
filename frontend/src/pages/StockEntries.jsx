import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, Badge, SearchableSelect } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { 
  Plus, 
  Search, 
  Filter, 
  RotateCw, 
  Package, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Edit3, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Boxes,
  Activity,
  DollarSign
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const statusColors = {
  draft: 'bg-slate-50 text-slate-700 border-slate-200',
  submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
};

const entryTypeIcons = {
  'Material Receipt': <Package className="w-4 h-4 text-emerald-500" />,
  'Material Issue': <ArrowRight className="w-4 h-4 text-orange-500" />,
  'Material Transfer': <RotateCw className="w-4 h-4 text-blue-500" />,
  'Material Adjustment': <Activity className="w-4 h-4 text-amber-500" />,
  'Manual Entry': <Plus className="w-4 h-4 text-indigo-500" />,
  'Stock Transfer': <RotateCw className="w-4 h-4 text-blue-500" />,
  'Stock Adjustment': <Activity className="w-4 h-4 text-amber-500" />,
  'Opening Stock': <Boxes className="w-4 h-4 text-teal-500" />
};

const StatCard = ({ label, value, icon: Icon, colorClass, iconBg }) => (
  <div className="bg-white p-2 rounded  border border-slate-200  flex flex-col gap-2 flex-1 min-w-[200px]">
    <div className={`w-5 h-5 rounded  ${iconBg} flex items-center justify-center ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-xs  text-slate-500   ">{label}</p>
      <p className="text-xl text-slate-900 leading-tight font-semibold">{value}</p>
    </div>
  </div>
);
const getDisplayTypeAndPurpose = (entry) => {
  if (entry.purpose === 'Initial Inventory' || entry.entry_type === 'Opening Stock') {
    return {
      type: 'Opening Stock',
      purpose: 'Initial Inventory',
      icon: entryTypeIcons['Opening Stock']
    };
  }

  if (entry.grn_id || entry.purpose === 'Stock Receipt from GRN') {
    return {
      type: 'Material Receipt',
      purpose: 'Stock Receipt from GRN',
      icon: entryTypeIcons['Material Receipt']
    };
  }

  if (entry.purpose === 'Purchase Return') {
    return {
      type: 'Material Issue',
      purpose: 'Purchase Return',
      icon: entryTypeIcons['Material Issue']
    };
  }

  if (entry.purpose === 'Material Issue to Production' || entry.purpose?.toLowerCase().includes('production') || entry.purpose?.toLowerCase().includes('request')) {
    return {
      type: 'Material Issue',
      purpose: entry.purpose || 'Material Issue to Production',
      icon: entryTypeIcons['Material Issue']
    };
  }

  if (entry.entry_type === 'Material Transfer') {
    return {
      type: 'Stock Transfer',
      purpose: entry.purpose || 'Warehouse Transfer',
      icon: entryTypeIcons['Stock Transfer']
    };
  }

  if (entry.entry_type === 'Material Adjustment') {
    return {
      type: 'Stock Adjustment',
      purpose: entry.purpose || 'Inventory Adjustment',
      icon: entryTypeIcons['Stock Adjustment']
    };
  }

  if (entry.entry_type === 'Material Receipt' && !entry.grn_id) {
    return {
      type: 'Manual Entry',
      purpose: entry.purpose || 'Manual Stock Receipt',
      icon: entryTypeIcons['Manual Entry']
    };
  }

  return {
    type: entry.entry_type,
    purpose: entry.purpose || 'Stock Movement',
    icon: entryTypeIcons[entry.entry_type]
  };
};

const StockEntries = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [grns, setGrns] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const loadEditingDetails = async (id) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock-entries/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load stock entry details');
      const detail = await response.json();

      setEditingId(parseInt(id));
      setFormData({
        entryType: detail.entry_type,
        entryDate: detail.entry_date ? new Date(detail.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        fromWarehouseId: detail.from_warehouse_id || '',
        toWarehouseId: detail.to_warehouse_id || '',
        grnId: detail.grn_id || '',
        purpose: detail.purpose || '',
        remarks: detail.remarks || '',
        items: (detail.items || []).map(item => ({
          id: item.id,
          itemCode: item.item_code,
          materialName: item.material_name,
          materialType: item.material_type,
          quantity: item.quantity,
          uom: item.uom,
          batchNo: item.batch_no || '',
          valuationRate: item.valuation_rate || 0
        }))
      });
    } catch (error) {
      errorToast(error.message);
    }
  };

  useEffect(() => {
    const isNew = location.pathname.includes('/new');
    const viewId = searchParams.get('id');
    const editId = searchParams.get('edit');

    if (isNew) {
      setShowModal(true);
      setExpandedId(null);
      if (editId) {
        loadEditingDetails(editId);
      } else {
        setEditingId(null);
      }
    } else if (viewId) {
      setExpandedId(parseInt(viewId));
      setShowModal(false);
      setEditingId(null);
    } else {
      setShowModal(false);
      setExpandedId(null);
      setEditingId(null);
    }
  }, [location.pathname, searchParams]);

  const [formData, setFormData] = useState({
    entryType: 'Material Receipt',
    entryDate: new Date().toISOString().split('T')[0],
    fromWarehouseId: '',
    toWarehouseId: '',
    grnId: '',
    purpose: '',
    remarks: '',
    items: []
  });

  const [currentItem, setCurrentItem] = useState({
    itemCode: '',
    quantity: 1,
    uom: 'Kg',
    batchNo: '',
    valuationRate: 0
  });

  useEffect(() => {
    fetchEntries();
    fetchWarehouses();
    fetchGRNs();
    fetchStockBalances();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock-entries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      errorToast('Failed to load stock entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchGRNs = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setGrns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching GRNs:', error);
    }
  };

  const fetchStockBalances = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const filteredData = (Array.isArray(data) ? data : []).filter(item => {
        const type = (item.material_type || '').toUpperCase();
        return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
      });
      setStockBalances(filteredData);
    } catch (error) {
      console.error('Error fetching stock balances:', error);
    }
  };

  const handleGRNSelect = async (grnId) => {
    setFormData(prev => ({ ...prev, grnId }));
    if (!grnId) {
      setFormData(prev => ({ ...prev, items: [] }));
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grn-items/${grnId}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data && data.items) {
        const mappedItems = data.items.map(item => ({
          itemCode: item.item_code || item.itemCode,
          quantity: parseFloat(item.accepted_qty || item.received_qty || item.receivedQuantity || item.quantity || 0),
          uom: item.unit || 'Kg',
          batchNo: '',
          valuationRate: parseFloat(item.unit_rate || item.rate || 0)
        }));
        
        setFormData(prev => ({ 
          ...prev, 
          items: mappedItems,
          entryType: 'Material Receipt' // Auto-set to Material Receipt when GRN is selected
        }));
        
        successToast(`Fetched ${mappedItems.length} items from GRN`);
      }
    } catch (error) {
      console.error('Error fetching GRN items:', error);
      errorToast('Failed to load items from GRN');
    }
  };

  const addItem = () => {
    if (!currentItem.itemCode || !currentItem.quantity) {
      errorToast('Item code and quantity are required');
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...currentItem }]
    }));
    setCurrentItem({
      itemCode: '',
      quantity: 1,
      uom: 'Kg',
      batchNo: '',
      valuationRate: 0
    });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const getModalDropdownValue = () => {
    if (formData.purpose === 'Initial Inventory') return 'Opening Stock';
    if (formData.grnId || formData.purpose === 'Stock Receipt from GRN') return 'Material Receipt (GRN)';
    if (formData.entryType === 'Material Issue' && formData.purpose === 'Purchase Return') return 'Purchase Return';
    if (formData.entryType === 'Material Issue') return 'Material Issue';
    if (formData.entryType === 'Material Transfer') return 'Stock Transfer';
    if (formData.entryType === 'Material Adjustment') return 'Stock Adjustment';
    if (formData.entryType === 'Material Receipt' && !formData.grnId) return 'Manual Entry';
    return 'Manual Entry';
  };

  const handleModalDropdownChange = (val) => {
    let entryType = 'Material Receipt';
    let purpose = '';
    
    if (val === 'Manual Entry') {
      entryType = 'Material Receipt';
      purpose = 'Manual Stock Receipt';
    } else if (val === 'Material Receipt (GRN)') {
      entryType = 'Material Receipt';
      purpose = 'Stock Receipt from GRN';
    } else if (val === 'Purchase Return') {
      entryType = 'Material Issue';
      purpose = 'Purchase Return';
    } else if (val === 'Material Issue') {
      entryType = 'Material Issue';
      purpose = 'Material Issue to Production';
    } else if (val === 'Stock Transfer') {
      entryType = 'Material Transfer';
      purpose = 'Warehouse Transfer';
    } else if (val === 'Stock Adjustment') {
      entryType = 'Material Adjustment';
      purpose = 'Inventory Adjustment';
    } else if (val === 'Opening Stock') {
      entryType = 'Material Receipt';
      purpose = 'Initial Inventory';
    }

    setFormData(prev => ({
      ...prev,
      entryType,
      purpose,
      grnId: val === 'Material Receipt (GRN)' ? prev.grnId : ''
    }));
  };

  const handleSubmit = async (e, status = 'draft') => {
    if (e) e.preventDefault();
    if (formData.items.length === 0) {
      errorToast('At least one item is required');
      return;
    }

    let finalPurpose = formData.purpose;
    if (!finalPurpose) {
      if (!formData.grnId) {
        if (formData.entryType === 'Material Receipt') {
          finalPurpose = 'Manual Stock Receipt';
        } else if (formData.entryType === 'Material Issue') {
          finalPurpose = 'Material Issue to Production';
        } else if (formData.entryType === 'Material Transfer') {
          finalPurpose = 'Warehouse Transfer';
        } else if (formData.entryType === 'Material Adjustment') {
          finalPurpose = 'Inventory Adjustment';
        }
      } else {
        finalPurpose = 'Stock Receipt from GRN';
      }
    }

    try {
      const token = localStorage.getItem('authToken');
      const url = editingId ? `${API_BASE}/stock-entries/${editingId}` : `${API_BASE}/stock-entries`;
      const method = editingId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...formData, purpose: finalPurpose, status })
      });

      if (!response.ok) throw new Error(editingId ? 'Failed to update stock entry' : 'Failed to create stock entry');
      
      successToast(`Stock entry ${status === 'submitted' ? 'submitted' : 'saved'} successfully`);
      setShowModal(false);
      setEditingId(null);
      setFormData({
        entryType: 'Material Receipt',
        entryDate: new Date().toISOString().split('T')[0],
        fromWarehouseId: '',
        toWarehouseId: '',
        grnId: '',
        purpose: '',
        remarks: '',
        items: []
      });
      fetchEntries();
      navigate(`${deptPrefix}/stock-entries`);
    } catch (error) {
      console.error('Error creating stock entry:', error);
      errorToast(error.message);
    }
  };

  const submitExisting = async (id) => {
    const confirm = await Swal.fire({
      title: 'Submit Entry?',
      text: 'This will update the stock ledger and balances.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      confirmButtonColor: '#10b981'
    });

    if (!confirm.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock-entries/${id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to submit stock entry');
      
      successToast('Stock entry submitted successfully');
      fetchEntries();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'Delete Entry?',
      text: 'Are you sure you want to delete this draft?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444'
    });

    if (!confirm.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock-entries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete stock entry');
      
      successToast('Stock entry deleted');
      fetchEntries();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const grnCode = entry.grn_id ? `GRN-${String(entry.grn_id).padStart(4, '0')}` : '';
    const matchesSearch = 
      entry.entry_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grnCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.po_number && entry.po_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.drawing_no && entry.drawing_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.finished_good && entry.finished_good.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.project_name && entry.project_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.client_name && entry.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.vendor_name && entry.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.material_ids && entry.material_ids.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.purpose && entry.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.from_warehouse_name && entry.from_warehouse_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.to_warehouse_name && entry.to_warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || (() => {
      const display = getDisplayTypeAndPurpose(entry);
      return display.type === typeFilter;
    })();
    const matchesWarehouse = warehouseFilter === 'all' || 
      entry.from_warehouse_id === parseInt(warehouseFilter) || 
      entry.to_warehouse_id === parseInt(warehouseFilter);

    return matchesSearch && matchesType && matchesWarehouse;
  });

  const totalMovements = entries.length;
  const pendingDrafts = entries.filter(e => e.status === 'draft').length;
  const totalValue = entries.reduce((acc, curr) => acc + (parseFloat(curr.total_value) || 0), 0);

  return (
    <div className="space-y-2 max-w-[1600px] mx-auto p-2">
      {/* Stats Summary */}
      <div className="flex flex-wrap gap-2">
        <StatCard 
          label="Total Movements" 
          value={totalMovements} 
          icon={Activity} 
          colorClass="text-indigo-600" 
          iconBg="bg-indigo-50"
        />
        <StatCard 
          label="Total Throughput" 
          value="1,600" 
          icon={Boxes} 
          colorClass="text-blue-600" 
          iconBg="bg-blue-50"
        />
        <StatCard 
          label="Inventory Value" 
          value={`₹${(totalValue / 100000).toFixed(2)}L`} 
          icon={DollarSign} 
          colorClass="text-emerald-600" 
          iconBg="bg-emerald-50"
        />
        <StatCard 
          label="Pending Drafts" 
          value={pendingDrafts} 
          icon={Clock} 
          colorClass="text-orange-600" 
          iconBg="bg-orange-50"
        />
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Drawing No., Finished Good, Entry No., GRN No., PO No., Project No., Material ID, or Warehouse..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <select 
              className="bg-slate-50 border border-slate-200 rounded  p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="Manual Entry">Manual Entry</option>
              <option value="Material Receipt">Material Receipt</option>
              <option value="Material Issue">Material Issue</option>
              <option value="Stock Transfer">Stock Transfer</option>
              <option value="Stock Adjustment">Stock Adjustment</option>
              <option value="Opening Stock">Opening Stock</option>
            </select>

            <select 
              className="bg-slate-50 border border-slate-200 rounded  p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
            >
              <option value="all">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
              ))}
            </select>

            <button 
              onClick={() => { navigate(`${deptPrefix}/stock-entries/new`); setFormData(prev => ({ ...prev, items: [] })); }}
              className="flex items-center gap-2  p-2  bg-indigo-600 text-white rounded  text-sm  hover:bg-indigo-700 transition-colors "
            >
              <Plus className="w-4 h-4" />
              Create Entry
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-500   text-xs ">
              <tr>
                <th className="p-2  text-left">Entry No.</th>
                <th className="p-2  text-left">Drawing</th>
                <th className="p-2  text-left">Type & Purpose</th>
                <th className="p-2  text-left">Warehouse</th>
                <th className="p-2  text-left">Status</th>
                <th className="p-2  text-left">Date</th>
                <th className="p-2  text-left text-center">Items</th>
                <th className="p-2  text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 p-2 text-center text-slate-400">
                    <RotateCw className="w-3 h-3 animate-spin mx-auto mb-2" />
                    Loading stock entries...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 p-2 text-center text-slate-400">
                    No entries found matching filters
                  </td>
                </tr>
              ) : filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-2 ">
                    <div className=" text-slate-900 font-semibold">{entry.entry_no}</div>
                    <div className="text-xs text-slate-400  er">ID: {entry.id}</div>
                  </td>
                  <td className="p-2 ">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#111827] leading-[16px]">
                        {entry.drawing_no || '—'}
                      </span>
                      {entry.finished_good && (
                        <span className="text-[10px] text-[#6B7280] leading-[14px] mt-0.5">
                          {entry.finished_good}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 ">
                    {(() => {
                      const display = getDisplayTypeAndPurpose(entry);
                      return (
                        <>
                          <div className="flex items-center gap-2 text-slate-700">
                            {display.icon}
                            {display.type}
                          </div>
                          {display.purpose && (
                            <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]" title={display.purpose}>
                              {display.purpose}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="p-2 ">
                    <div className="flex items-center gap-2  text-slate-600">
                      <span className={entry.from_warehouse_name ? "text-slate-900 font-semibold" : "text-slate-400 italic"}>
                        {entry.from_warehouse_name || 'N/A'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className={entry.to_warehouse_name ? "text-slate-900 font-semibold" : "text-slate-400 italic"}>
                        {entry.to_warehouse_name || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 ">
                    <Badge variant="outline" className={`${statusColors[entry.status]} `}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="p-2  text-slate-600">
                    {new Date(entry.entry_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="p-2  text-center  text-slate-700">
                    {entry.item_count}
                  </td>
                  <td className="p-2  text-right">
                    <div className="flex items-center justify-end gap-2  group-hover:opacity-100 transition-opacity">
                      {entry.status === 'draft' && (
                        <button 
                          onClick={() => submitExisting(entry.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded  transition-colors"
                          title="Submit"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => navigate(`${deptPrefix}/stock-entries/new?edit=${entry.id}`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded  transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded  transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => navigate(`${deptPrefix}/stock-entries?id=${entry.id}`)}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded  transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => navigate(`${deptPrefix}/stock-entries`)} />
          <div className="relative bg-white rounded shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-2  border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl  text-slate-900">{editingId ? 'Edit Stock Entry' : 'Create Stock Entry'}</h2>
                <p className="text-xs text-slate-500 mt-1">Record material movements between warehouses or adjust stock levels.</p>
              </div>
              <button 
                onClick={() => navigate(`${deptPrefix}/stock-entries`)}
                className="p-2 hover:bg-white rounded  transition-colors text-slate-400 hover:text-slate-900  border border-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {/* Basic Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-2  text-indigo-600 font-semibold text-sm">
                  <div className="w-3 h-3 rounded  bg-indigo-50 flex items-center justify-center">1</div>
                  Basic Information
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600  ">Select GRN Request (Optional)</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded  p-2  text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      value={formData.grnId}
                      onChange={e => handleGRNSelect(e.target.value)}
                    >
                      <option value="">-- Manual Entry --</option>
                      {grns && grns.length > 0 && grns.map(grn => (
                        <option key={grn.id} value={grn.id}>
                          GRN-{String(grn.id).padStart(4, '0')} ({grn.po_number || grn.poNumber || 'No PO'})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-slate-400">Available GRNs: {grns?.length || 0}</span>
                      <span className="text-xs text-slate-400">Processed: 0</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600  ">Entry Date *</label>
                      <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-200 rounded  p-2  text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={formData.entryDate}
                        onChange={e => setFormData({ ...formData, entryDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600  ">Entry Type *</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded  p-2  text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={getModalDropdownValue()}
                        onChange={e => handleModalDropdownChange(e.target.value)}
                      >
                        <option value="Manual Entry">Manual Entry</option>
                        <option value="Material Receipt (GRN)">Material Receipt (GRN)</option>
                        <option value="Purchase Return">Purchase Return</option>
                        <option value="Material Issue">Material Issue (to Production)</option>
                        <option value="Stock Transfer">Stock Transfer</option>
                        <option value="Stock Adjustment">Stock Adjustment</option>
                        <option value="Opening Stock">Opening Stock</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600  ">From Warehouse</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded  p-2  text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
                      value={formData.fromWarehouseId}
                      onChange={e => setFormData({ ...formData, fromWarehouseId: e.target.value })}
                      disabled={formData.entryType === 'Material Receipt'}
                    >
                      <option value="">Select Source Warehouse</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600  ">To Warehouse</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded  p-2  text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
                      value={formData.toWarehouseId}
                      onChange={e => setFormData({ ...formData, toWarehouseId: e.target.value })}
                      disabled={formData.entryType === 'Material Issue'}
                    >
                      <option value="">Select Destination Warehouse</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2  text-indigo-600 font-semibold text-sm">
                  <div className="w-3 h-3 rounded  bg-indigo-50 flex items-center justify-center">2</div>
                  Add Items
                </div>

                <div className="bg-slate-50 rounded p-2 border border-slate-100 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-1">
                      <label className="blocktext-xs   text-slate-500 mb-1.5 ">Item Code *</label>
                      <SearchableSelect
                        options={stockBalances.map(item => ({
                          id: item.item_code,
                          label: `${item.material_name || item.item_name} (${item.item_code})`,
                          value: item.item_code
                        }))}
                        value={currentItem.itemCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const selected = stockBalances.find(i => i.item_code === code);
                          setCurrentItem({
                            ...currentItem,
                            itemCode: code,
                            uom: selected?.unit || selected?.uom || currentItem.uom,
                            valuationRate: selected?.valuation_rate || selected?.rate || currentItem.valuationRate
                          });
                        }}
                        allowCustom={false}
                        placeholder="Search item..."
                        className="text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="blocktext-xs   text-slate-500 mb-1.5 ">Quantity *</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded  p-2  text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.quantity}
                        onChange={e => setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="blocktext-xs   text-slate-500 mb-1.5 ">UOM</label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded  p-2  text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.uom}
                        onChange={e => setCurrentItem({ ...currentItem, uom: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="blocktext-xs   text-slate-500 mb-1.5 ">Batch No</label>
                      <input 
                        type="text" 
                        placeholder="Optional"
                        className="w-full bg-white border border-slate-200 rounded  p-2  text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.batchNo}
                        onChange={e => setCurrentItem({ ...currentItem, batchNo: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="blocktext-xs   text-slate-500 mb-1.5 ">Valuation Rate (₹)</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded  p-2  text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.valuationRate}
                        onChange={e => setCurrentItem({ ...currentItem, valuationRate: parseFloat(e.target.value) })}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={addItem}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded  text-sm  hover:bg-emerald-700 transition-all  active:scale-[0.98]"
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {formData.items.length > 0 && (
                  <div className="border border-slate-200 rounded  overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500    border-b border-slate-200text-xs ">
                        <tr>
                          <th className="p-2  text-left">Item Code</th>
                          <th className="p-2  text-right">Qty</th>
                          <th className="p-2  text-left">UOM</th>
                          <th className="p-2  text-left">Batch</th>
                          <th className="p-2  text-right">Rate</th>
                          <th className="p-2  text-right">Total</th>
                          <th className="p-2  text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2   text-slate-900">{item.itemCode}</td>
                            <td className="p-2  text-right">{item.quantity}</td>
                            <td className="p-2  text-slate-500">{item.uom}</td>
                            <td className="p-2  text-slate-500">{item.batchNo || '—'}</td>
                            <td className="p-2  text-right">₹{item.valuationRate}</td>
                            <td className="p-2  text-right  text-slate-700">₹{(item.quantity * item.valuationRate).toFixed(2)}</td>
                            <td className="p-2  text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setCurrentItem({
                                      itemCode: item.itemCode,
                                      quantity: item.quantity,
                                      uom: item.uom,
                                      batchNo: item.batchNo || '',
                                      valuationRate: item.valuationRate || 0
                                    });
                                    removeItem(idx);
                                  }} 
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                  title="Edit Item"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => removeItem(idx)} 
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              <div className="space-y-2 pt-6">
                <label className="text-xs font-semibold text-slate-600  ">Remarks</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2  text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]"
                  placeholder="Additional notes..."
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="p-2  border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button 
                onClick={() => navigate(`${deptPrefix}/stock-entries`)}
                className="p-2 rounded  border border-slate-200 text-slate-600  text-sm hover:bg-white transition-all"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2 ">
                <button 
                  onClick={(e) => handleSubmit(e, 'draft')}
                  className="p-2 rounded  border border-indigo-200 text-indigo-600  text-sm hover:bg-indigo-50 transition-all"
                >
                  Save as Draft
                </button>
                <button 
                  onClick={(e) => handleSubmit(e, 'submitted')}
                  className="px-8 py-2.5 rounded  bg-indigo-600 text-white  text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                >
                  {editingId ? 'Update Entry' : 'Create Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockEntries;
