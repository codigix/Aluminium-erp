import { useState, useEffect } from 'react';
import { Card, DataTable, Modal, StatusBadge, FormControl } from '../components/ui.jsx';
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newItem, setNewItem] = useState({
    itemName: '',
    itemGroup: 'Raw Material',
    itemCode: 'Auto-generated',
    defaultUom: 'Nos',
    valuationRate: 0,
    drawingNo: '',
    materialGrade: ''
  });
  const [stats, setStats] = useState({
    totalItems: 0,
    totalBalance: 0,
    lowStock: 0
  });

  useEffect(() => {
    fetchStockBalance();
  }, []);

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
      setShowAddModal(false);
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
      setShowEditModal(false);
      fetchStockBalance();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
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
        return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
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
      text: "This will remove the item from stock balance! (Ledger history remains)",
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
      render: (val) => <span className="text-slate-600 ">{val || '—'}</span>
    },
    {
      label: 'Material Type',
      key: 'material_type',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs">{val || '—'}</span>
    },
    {
      label: 'Current Balance',
      key: 'current_balance',
      sortable: true,
      className: 'text-right',
      render: (val) => {
        const statusColor = getStatusColor(val);
        return (
          <div className="flex items-center justify-end gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded  ${statusColor.indicator}`}></span>
            <span className={`   text-sm ${statusColor.text}`}>
              {parseFloat(val || 0).toFixed(3)}
            </span>
          </div>
        );
      }
    },
    {
      label: 'Unit',
      key: 'unit',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs ">{val || 'NOS'}</span>
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
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Edit Master Item"
          >
            <FileEdit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
            title="Remove from Balance"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-indigo-600 border border-indigo-700 rounded-2xl p-5 flex items-center justify-between shadow-xl shadow-indigo-100">
            <div>
              <p className="text-[10px] text-indigo-100 font-black tracking-widest uppercase mb-1">Total Items</p>
              <p className="text-2xl font-black text-white">{stats.totalItems}</p>
            </div>
            <div className="p-3 bg-indigo-500/50 backdrop-blur-sm rounded-xl text-white shadow-inner">
              <Box className="w-6 h-6" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Total Balance</p>
              <p className="text-2xl font-black text-slate-900">{parseFloat(stats.totalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <Database className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all">
            <div>
              <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Low Stock Items</p>
              <p className="text-2xl font-black text-rose-600">{stats.lowStock}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Inventory Status</h2>
          <p className="text-xs text-slate-500">Manage master items and monitor stock levels</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create New Item
        </button>
      </div>

      <DataTable
        columns={columns}
        data={balances}
        loading={loading}
        searchPlaceholder="Search by item code or description..."
        emptyMessage="No stock items found"
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
      />

      {/* Add Item Modal */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Add New Master Item"
        size="2xl"
      >
        <form onSubmit={handleCreateItem} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Item Name">
              <input
                type="text"
                required
                value={newItem.itemName}
                onChange={(e) => setNewItem({...newItem, itemName: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. MS Plate 10mm"
              />
            </FormControl>

            <FormControl label="Item Group">
              <select
                value={newItem.itemGroup}
                onChange={(e) => setNewItem({...newItem, itemGroup: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="Raw Material">Raw Material</option>
                <option value="Consumable">Consumable</option>
                <option value="Packaging">Packaging</option>
                <option value="Service">Service</option>
                <option value="Other">Other</option>
              </select>
            </FormControl>

            <FormControl label="Item Code (Manual)">
              <input
                type="text"
                value={newItem.itemCode}
                onChange={(e) => setNewItem({...newItem, itemCode: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="Leave 'Auto-generated' for default"
              />
            </FormControl>

            <FormControl label="Default UOM">
              <input
                type="text"
                value={newItem.defaultUom}
                onChange={(e) => setNewItem({...newItem, defaultUom: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="Nos, Kg, Ltr, etc."
              />
            </FormControl>

            <FormControl label="Valuation Rate">
              <input
                type="number"
                step="0.01"
                value={newItem.valuationRate}
                onChange={(e) => setNewItem({...newItem, valuationRate: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>

            <FormControl label="Drawing No (Optional)">
              <input
                type="text"
                value={newItem.drawingNo}
                onChange={(e) => setNewItem({...newItem, drawingNo: e.target.value})}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-95"
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
        onClose={() => setShowEditModal(false)} 
        title="Edit Master Item"
        size="2xl"
      >
        {editingItem && (
          <form onSubmit={handleEditItem} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormControl label="Item Name">
                <input
                  type="text"
                  required
                  value={editingItem.material_name || ''}
                  onChange={(e) => setEditingItem({...editingItem, material_name: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>
              
              <FormControl label="Item Group">
                <select
                  value={editingItem.material_type || ''}
                  onChange={(e) => setEditingItem({...editingItem, material_type: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
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
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-500 outline-none cursor-not-allowed"
                />
              </FormControl>

              <FormControl label="Default UOM">
                <input
                  type="text"
                  value={editingItem.unit || ''}
                  onChange={(e) => setEditingItem({...editingItem, unit: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Valuation Rate">
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.valuation_rate || 0}
                  onChange={(e) => setEditingItem({...editingItem, valuation_rate: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>

              <FormControl label="Drawing No">
                <input
                  type="text"
                  value={editingItem.drawing_no || ''}
                  onChange={(e) => setEditingItem({...editingItem, drawing_no: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </FormControl>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-95"
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

