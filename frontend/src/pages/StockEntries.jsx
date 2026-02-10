import { useState, useEffect, useCallback } from 'react';
import { Card, Badge } from '../components/ui.jsx';
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
  'Material Adjustment': <Activity className="w-4 h-4 text-amber-500" />
};

const StatCard = ({ label, value, icon: Icon, colorClass, iconBg }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 flex-1 min-w-[200px]">
    <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-[10px]  text-slate-500  tracking-wider uppercase">{label}</p>
      <p className="text-xl text-slate-900 leading-tight font-semibold">{value}</p>
    </div>
  </div>
);

const StockEntries = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [grns, setGrns] = useState([]);
  const [stockBalances, setStockBalances] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

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
      setStockBalances(Array.isArray(data) ? data : []);
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

  const handleSubmit = async (e, status = 'draft') => {
    if (e) e.preventDefault();
    if (formData.items.length === 0) {
      errorToast('At least one item is required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock-entries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...formData, status })
      });

      if (!response.ok) throw new Error('Failed to create stock entry');
      
      successToast(`Stock entry ${status === 'submitted' ? 'submitted' : 'saved'} successfully`);
      setShowModal(false);
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
    const matchesSearch = 
      entry.entry_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.purpose && entry.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.from_warehouse_name && entry.from_warehouse_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.to_warehouse_name && entry.to_warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || entry.entry_type === typeFilter;
    const matchesWarehouse = warehouseFilter === 'all' || 
      entry.from_warehouse_id === parseInt(warehouseFilter) || 
      entry.to_warehouse_id === parseInt(warehouseFilter);

    return matchesSearch && matchesType && matchesWarehouse;
  });

  const totalMovements = entries.length;
  const pendingDrafts = entries.filter(e => e.status === 'draft').length;
  const totalValue = entries.reduce((acc, curr) => acc + (parseFloat(curr.total_value) || 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4">
      {/* Stats Summary */}
      <div className="flex flex-wrap gap-4">
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by ID, No, or warehouse..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="Material Receipt">Material Receipt</option>
              <option value="Material Issue">Material Issue</option>
              <option value="Material Transfer">Material Transfer</option>
              <option value="Material Adjustment">Material Adjustment</option>
            </select>

            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
            >
              <option value="all">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
              ))}
            </select>

            <button 
              onClick={() => { setShowModal(true); setFormData(prev => ({ ...prev, items: [] })); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Entry
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-500  tracking-wider uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 text-left">Entry No</th>
                <th className="px-4 py-3 text-left">Type & Purpose</th>
                <th className="px-4 py-3 text-left">Warehouse (Source → Dest)</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left text-center">Items</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading stock entries...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                    No entries found matching filters
                  </td>
                </tr>
              ) : filteredEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{entry.entry_no}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tighter">ID: {entry.id}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 font-medium text-slate-700">
                      {entryTypeIcons[entry.entry_type]}
                      {entry.entry_type}
                    </div>
                    {entry.purpose && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]" title={entry.purpose}>
                        {entry.purpose}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className={entry.from_warehouse_name ? "text-slate-900 font-medium" : "text-slate-400 italic"}>
                        {entry.from_warehouse_name || 'N/A'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className={entry.to_warehouse_name ? "text-slate-900 font-medium" : "text-slate-400 italic"}>
                        {entry.to_warehouse_name || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="outline" className={`${statusColors[entry.status]} font-medium`}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(entry.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-slate-700">
                    {entry.item_count}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.status === 'draft' && (
                        <>
                          <button 
                            onClick={() => submitExisting(entry.id)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Submit"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create Stock Entry</h2>
                <p className="text-xs text-slate-500 mt-1">Record material movements between warehouses or adjust stock levels.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Basic Details */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">1</div>
                  Basic Information
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select GRN Request (Optional)</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
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
                    <div className="flex items-center gap-4 px-1">
                      <span className="text-[10px] text-slate-400">Available GRNs: {grns?.length || 0}</span>
                      <span className="text-[10px] text-slate-400">Processed: 0</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Entry Date *</label>
                      <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={formData.entryDate}
                        onChange={e => setFormData({ ...formData, entryDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Entry Type *</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={formData.entryType}
                        onChange={e => setFormData({ ...formData, entryType: e.target.value })}
                      >
                        <option value="Material Receipt">Material Receipt</option>
                        <option value="Material Issue">Material Issue</option>
                        <option value="Material Transfer">Material Transfer</option>
                        <option value="Material Adjustment">Material Adjustment</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">From Warehouse</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
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
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">To Warehouse</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
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
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">2</div>
                  Add Items
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Item Code *</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.itemCode}
                        onChange={e => setCurrentItem({ ...currentItem, itemCode: e.target.value })}
                      >
                        <option value="">Select Item</option>
                        {stockBalances.map(item => (
                          <option key={item.item_code} value={item.item_code}>{item.item_code} - {item.material_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Quantity *</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.quantity}
                        onChange={e => setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">UOM</label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.uom}
                        onChange={e => setCurrentItem({ ...currentItem, uom: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Batch No</label>
                      <input 
                        type="text" 
                        placeholder="Optional"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.batchNo}
                        onChange={e => setCurrentItem({ ...currentItem, batchNo: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Valuation Rate (₹)</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={currentItem.valuationRate}
                        onChange={e => setCurrentItem({ ...currentItem, valuationRate: parseFloat(e.target.value) })}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={addItem}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]"
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {formData.items.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                        <tr>
                          <th className="px-4 py-3 text-left">Item Code</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-left">UOM</th>
                          <th className="px-4 py-3 text-left">Batch</th>
                          <th className="px-4 py-3 text-right">Rate</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{item.itemCode}</td>
                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                            <td className="px-4 py-3 text-slate-500">{item.uom}</td>
                            <td className="px-4 py-3 text-slate-500">{item.batchNo || '—'}</td>
                            <td className="px-4 py-3 text-right">₹{item.valuationRate}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700">₹{(item.quantity * item.valuationRate).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => removeItem(idx)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-6">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Remarks</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]"
                  placeholder="Additional notes..."
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-end gap-4 bg-slate-50/50">
              <button 
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-white transition-all"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => handleSubmit(e, 'draft')}
                  className="px-6 py-2.5 rounded-2xl border border-indigo-200 text-indigo-600 font-bold text-sm hover:bg-indigo-50 transition-all"
                >
                  Save as Draft
                </button>
                <button 
                  onClick={(e) => handleSubmit(e, 'submitted')}
                  className="px-8 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                >
                  Create Entry
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
