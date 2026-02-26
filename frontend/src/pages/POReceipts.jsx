import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, DataTable, StatusBadge, Modal, FormControl } from '../components/ui.jsx';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Package, 
  RefreshCw, 
  Eye, 
  FileEdit, 
  Trash2, 
  Calendar, 
  ChevronRight, 
  LayoutGrid, 
  List, 
  CheckCircle2, 
  User, 
  Warehouse, 
  ClipboardCheck,
  X,
  ArrowLeft,
  Download,
  Printer,
  History,
  AlertCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const warehouseOptions = [
  { value: 'main', label: 'Main Warehouse' },
  { value: 'RM', label: 'Raw Material Warehouse' },
  { value: 'WIP', label: 'Production Issue (WIP)' },
  { value: 'FG', label: 'Finished Goods' },
  { value: 'SUB', label: 'Subcontract Store' },
  { value: 'REJECT', label: 'Rejected Store' }
];

const formatCurrency = (value, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const POReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedReceiptForView, setSelectedReceiptForView] = useState(null);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'details'
  const [activeTab, setActiveTab] = useState('grn');
  const [stockBalances, setStockBalances] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [formData, setFormData] = useState({
    poId: '',
    vendorName: '',
    vendorId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    receivedQuantity: 0,
    totalValuation: 0,
    notes: '',
    items: []
  });

  const handleAddLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { 
          item_code: '', 
          description: '', 
          quantity: 0, 
          received_qty: 0, 
          rate: 0, 
          amount: 0, 
          warehouse: warehouses[0]?.warehouse_code || 'main',
          unit: 'NOS'
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const totalQty = newItems.reduce((sum, it) => sum + (parseFloat(it.received_qty) || 0), 0);
    const totalVal = newItems.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
    setFormData({
      ...formData,
      items: newItems,
      receivedQuantity: totalQty,
      totalValuation: totalVal
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'received_qty' || field === 'rate') {
      const qty = parseFloat(newItems[index].received_qty) || 0;
      const rate = parseFloat(newItems[index].rate) || 0;
      newItems[index].amount = qty * rate;
    }

    const totalQty = newItems.reduce((sum, it) => sum + (parseFloat(it.received_qty) || 0), 0);
    const totalVal = newItems.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
    
    setFormData({
      ...formData,
      items: newItems,
      receivedQuantity: totalQty,
      totalValuation: totalVal
    });
  };

  const [editFormData, setEditFormData] = useState({
    receiptDate: '',
    receivedQuantity: '',
    notes: '',
    status: ''
  });

  const fetchStockItems = async () => {
    try {
      const response = await fetch(`${API_BASE}/inventory/items`);
      if (response.ok) {
        const data = await response.json();
        const filteredData = (Array.isArray(data) ? data : []).filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
        setStockItems(filteredData);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.department_code === 'ADMIN' || parsedUser.department_code === 'PROCUREMENT' || parsedUser.department_code === 'INVENTORY' || parsedUser.department_code === 'SALES') {
        fetchReceipts();
        fetchStats();
        fetchPurchaseOrders();
        fetchStockItems();
        fetchWarehouses();
        fetchStockBalance();
      }
    } else {
      fetchReceipts();
      fetchStats();
      fetchPurchaseOrders();
      fetchStockItems();
      fetchWarehouses();
      fetchStockBalance();
    }
  }, []);

  const fetchStockBalance = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const filteredData = (Array.isArray(data) ? data : []).filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
        setStockBalances(filteredData);
      }
    } catch (error) {
      console.error('Error fetching stock balance:', error);
    }
  };

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      errorToast(error.message || 'Failed to load receipts');
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(Array.isArray(data) ? data.filter(po => po.status !== 'DRAFT') : []);
      }
    } catch (error) {
      console.error('Error fetching POs:', error);
    }
  };

  const handlePoChange = async (poId) => {
    const selectedPO = purchaseOrders.find(po => String(po.id) === String(poId));
    if (selectedPO) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const detailedPO = await response.json();
          const items = (detailedPO.items || [])
            .filter(item => {
              const type = (item.material_type || '').toUpperCase();
              return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
            })
            .map(item => {
              const dQty = parseFloat(item.design_qty || 0);
              const qQty = parseFloat(item.quantity || 0);
            const finalQty = dQty > 0 ? dQty : qQty;
            
            return {
              ...item,
              item_code: item.item_code || '',
              material_name: item.material_name || item.description,
              description: item.description || '',
              design_qty: dQty,
              quantity: qQty,
              received_qty: finalQty,
              rate: parseFloat(item.unit_rate || item.rate || 0),
              amount: finalQty * parseFloat(item.unit_rate || item.rate || 0),
              warehouse: warehouses[0]?.warehouse_code || 'main',
              unit: item.unit || 'NOS'
            };
          });

          setFormData({
            ...formData,
            poId,
            vendorName: selectedPO.vendor_name,
            vendorId: selectedPO.vendor_id,
            items,
            receivedQuantity: items.reduce((sum, item) => sum + parseFloat(item.received_qty || 0), 0),
            totalValuation: items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0)
          });
        }
      } catch (error) {
        console.error('Error fetching PO details:', error);
        setFormData({
          ...formData,
          poId,
          vendorName: selectedPO.vendor_name,
          vendorId: selectedPO.vendor_id,
          receivedQuantity: selectedPO.total_quantity || selectedPO.items_count || 0,
          totalValuation: selectedPO.total_amount || 0,
          items: []
        });
      }
    } else {
      setFormData({
        ...formData,
        poId: '',
        vendorName: '',
        vendorId: '',
        receivedQuantity: 0,
        totalValuation: 0,
        items: []
      });
    }
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();

    if (!formData.poId) {
      errorToast('Please select a purchase order');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poId: parseInt(formData.poId),
          receiptDate: formData.receiptDate,
          receivedQuantity: formData.receivedQuantity,
          notes: formData.notes || null,
          items: formData.items
        })
      });

      if (!response.ok) throw new Error('Failed to create receipt');

      successToast('PO Receipt created successfully');
      setShowCreateModal(false);
      setFormData({ poId: '', receiptDate: new Date().toISOString().split('T')[0], receivedQuantity: '', notes: '', items: [] });
      fetchReceipts();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to create receipt');
    }
  };

  const handleEditReceipt = async (receiptId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipt details');
      const data = await response.json();
      setSelectedReceipt(data);
      setEditFormData({
        receiptDate: data.receipt_date?.split('T')[0] || '',
        receivedQuantity: data.received_quantity || '',
        notes: data.notes || '',
        status: data.status || ''
      });
      setShowEditModal(true);
    } catch (error) {
      errorToast(error.message || 'Failed to load receipt details');
    }
  };

  const handleUpdateReceipt = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${selectedReceipt.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiptDate: editFormData.receiptDate,
          receivedQuantity: editFormData.receivedQuantity,
          notes: editFormData.notes,
          status: editFormData.status
        })
      });

      if (!response.ok) throw new Error('Failed to update receipt');

      successToast('PO Receipt updated successfully');
      setShowEditModal(false);
      fetchReceipts();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update receipt');
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    const result = await Swal.fire({
      title: 'Delete Receipt?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete receipt');

      successToast('PO Receipt deleted successfully');
      fetchReceipts();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete receipt');
    }
  };

  const handleOpenPdfInNewTab = async (receipt) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receipt.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('Error opening PDF:', error);
      errorToast('Failed to open PDF');
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'GRN Number',
      sortable: true,
      render: (val, row) => (
        <span className="font-black text-slate-900 text-sm tracking-tight">{`GRN-${String(row.id).padStart(4, '0')}`}</span>
      )
    },
    {
      key: 'po_number',
      label: 'PO Number',
      sortable: true,
      render: (val) => (
        <span className="text-xs  text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100  tracking-tight">#{val || 'Direct'}</span>
      )
    },
    { 
      key: 'vendor_name', 
      label: 'Supplier', 
      sortable: true,
      render: (val) => (
        <div className="flex flex-col">
          <span className="font-black text-slate-900 text-sm tracking-tight">{val}</span>
          <span className="text-[10px] text-slate-500 font-black  tracking-widest mt-0.5 tracking-tighter">Active Vendor</span>
        </div>
      )
    },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-xs  text-slate-500   inline-flex">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center gap-1.5 p-2  rounded text-xs  font-extrabold border  ${
          val === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
          val === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          val === 'ACKNOWLEDGED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          'bg-slate-50 text-slate-700 border-slate-200'
        }`}>
          <div className={`w-1.5 h-1.5 rounded  ${
            val === 'DRAFT' ? 'bg-amber-500' : 
            val === 'RECEIVED' ? 'bg-emerald-500' :
            val === 'ACKNOWLEDGED' ? 'bg-blue-500' :
            'bg-slate-500'
          }`} />
          <span className=" tracking-tight">{val}</span>
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={async () => {
              try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`${API_BASE}/po-receipts/${row.id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                  const data = await response.json();
                  setSelectedReceiptForView(data);
                  setShowViewModal(true);
                }
              } catch (error) {
                errorToast('Failed to load receipt details');
              }
            }} 
            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded  transition-all border border-indigo-50  active:scale-90"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleOpenPdfInNewTab(row)} 
            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded  transition-all border border-emerald-50  active:scale-90"
            title="Print GRN"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteReceipt(row.id)} 
            className="p-2 text-rose-500 hover:bg-rose-50 rounded  transition-all border border-rose-50  active:scale-90"
            title="Delete Receipt"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];
  const stockColumns = [
    {
      label: 'Item Code',
      key: 'item_code',
      sortable: true,
      render: (val) => <span className="text-slate-900 font-black">{val}</span>
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
      render: (val) => <span className="text-slate-500 text-xs    tracking-widest">{val || '—'}</span>
    },
    {
      label: 'Warehouse',
      key: 'warehouse',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs    tracking-widest bg-slate-50 px-2 py-1 rounded  border border-slate-100">{val || '—'}</span>
    },
    {
      label: 'Current Balance',
      key: 'current_balance',
      sortable: true,
      className: 'text-right',
      render: (val) => (
        <div className="flex items-center justify-end gap-2">
          <span className={`inline-block w-1.5 h-1.5 rounded  ${parseFloat(val || 0) <= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
          <span className={`font-black text-xs ${parseFloat(val || 0) <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {parseFloat(val || 0).toFixed(3)}
          </span>
        </div>
      )
    },
    {
      label: 'Unit',
      key: 'unit',
      sortable: true,
      render: (val) => <span className="text-slate-400text-xs  font-black ">{val || 'NOS'}</span>
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded  text-white shadow-indigo-200 shadow-xl">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs  text-slate-400   tracking-widest">
              <span>Buying</span>
              <ChevronRight className="w-2.5 h-2.5" />
              <span>Procurement</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Receipts</h1>
            <p className="text-xs text-slate-500 ">Process material receipts and quality inspections</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded  border border-slate-200">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2  p-2  rounded text-xs  font-black transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900  border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              KANBAN
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2  p-2  rounded text-xs  font-black transition-all ${viewMode === 'list' ? 'bg-white text-slate-900  border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-3.5 h-3.5" />
              LIST
            </button>
          </div>
          <button
            onClick={fetchReceipts}
            className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded  transition-all border border-slate-200  active:scale-95 bg-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2  px-5 py-2.5 bg-blue-600 text-white rounded  text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create GRN
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {[
          { label: 'Total Receipts', value: stats?.total_receipts, sub: 'Total processing requests', icon: ClipboardCheck, color: 'blue', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
          { label: 'Pending QC', value: stats?.draft_receipts, sub: 'Awaiting initial check', icon: History, color: 'orange', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
          { label: 'QC Review', value: stats?.qc_review_count || 0, sub: 'Quality check in progress', icon: Search, color: 'indigo', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
          { label: 'Awaiting Storage', value: stats?.awaiting_storage || 0, sub: 'Pending warehouse entry', icon: Package, color: 'blue', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
          { label: 'Completed', value: stats?.received_receipts, sub: 'Successfully stored', icon: CheckCircle2, color: 'emerald', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          { label: 'Rejected', value: stats?.rejected_count || 0, sub: 'Failed quality criteria', icon: AlertCircle, color: 'rose', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.bg} border border-slate-200 rounded  p-4  hover:shadow-md transition-all relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <p className={`text-[10px] font-black ${stat.bg === 'bg-white' ? 'text-slate-500' : 'text-blue-100'}  tracking-widest`}>{stat.label}</p>
                <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded  `}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-2xl font-black ${stat.text} tracking-tight`}>{stat.value || 0}</p>
              <p className={`text-[10px] ${stat.subText} mt-1 font-black  tracking-tighter opacity-80`}>{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4">
        <div className="flex bg-white p-1 rounded  border border-slate-200 ">
          <button 
            onClick={() => setActiveTab('grn')}
            className={`flex items-center gap-2  px-5 py-2 rounded  text-xs font-black transition-all ${activeTab === 'grn' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FileText className="w-4 h-4" />
            GRN Request
          </button>
          <button 
            onClick={() => setActiveTab('stocks')}
            className={`flex items-center gap-2  px-5 py-2 rounded  text-xs font-black transition-all ${activeTab === 'stocks' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Package className="w-4 h-4" />
            Available Stocks
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Search by GRN #, PO #, or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded  text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all "
          />
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex items-center gap-2  p-2  bg-white border border-slate-200 rounded  ">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400   ">Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm  text-blue-600 outline-none bg-transparent cursor-pointer"
          >
            <option value="ALL">ALL STATUS</option>
            <option value="DRAFT">DRAFT</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          </select>
        </div>

        <button className="p-2.5 bg-emerald-500 text-white rounded  hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded  border border-slate-200  overflow-hidden">
        {activeTab === 'grn' ? (
          <DataTable
            columns={columns}
            data={receipts.filter(r => {
              const matchesSearch = !searchTerm || 
                String(r.id).includes(searchTerm) ||
                r.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
              return matchesSearch && matchesStatus;
            })}
            loading={loading}
            hideHeader={true}
            className="border-none shadow-none rounded-none"
          />
        ) : (
          <DataTable
            columns={stockColumns}
            data={stockBalances.filter(s => {
              const matchesSearch = !searchTerm || 
                s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.material_name?.toLowerCase().includes(searchTerm.toLowerCase());
              return matchesSearch;
            })}
            loading={loading}
            hideHeader={true}
            className="border-none shadow-none rounded-none"
            searchPlaceholder="Search available stocks..."
            emptyMessage="No available stocks found"
          />
        )}
      </div>

      {/* GRN View Details Modal */}
      <Modal 
        isOpen={showViewModal} 
        onClose={() => setShowViewModal(false)}
        title={selectedReceiptForView ? `GRN Details - GRN-${String(selectedReceiptForView.id).padStart(4, '0')}` : 'GRN Details'}
        size="6xl"
      >
        {selectedReceiptForView && (
          <div className="p-8 space-y-8 bg-slate-50/30">
            {/* Header Status & Date */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-slate-500  tracking-widest">Status</span>
                <div className={`flex items-center gap-2  p-2 .5 rounded  bordertext-xs  font-black  ${
                  selectedReceiptForView.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                  selectedReceiptForView.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {selectedReceiptForView.status === 'RECEIVED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded  ${
                      selectedReceiptForView.status === 'DRAFT' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                  )}
                  {selectedReceiptForView.status}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-black text-slate-500  tracking-widest">Receipt Date</span>
                <span className="text-sm font-black text-slate-900">
                  {new Date(selectedReceiptForView.receipt_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Reference & Supplier Cards */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-white border border-slate-200 rounded   space-y-3 hover:border-indigo-100 transition-colors">
                <div className="flex items-center gap-2  text-indigo-500">
                  <Warehouse className="w-4 h-4" />
                  <span className="text-[10px] font-black text-slate-400  tracking-widest">PO Reference</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded ">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-sm font-black text-slate-900  tracking-tight">#{selectedReceiptForView.po_number || 'Direct'}</span>
                </div>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded   space-y-3 hover:border-blue-100 transition-colors">
                <div className="flex items-center gap-2  text-blue-500">
                  <User className="w-4 h-4" />
                  <span className="text-[10px] font-black text-slate-400  tracking-widest">Supplier</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded ">
                    <Warehouse className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-black text-slate-900  tracking-tight">{selectedReceiptForView.vendor_name}</span>
                </div>
              </div>
            </div>

            {/* Received Items Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 ">
                <div className="w-8 h-8 bg-indigo-50 rounded  flex items-center justify-center text-indigo-600">
                  <Package className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-900  tracking-widest">Received Items</h4>
              </div>

              <div className="bg-white border border-slate-200 rounded  overflow-hidden ">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr className="text-[10px] font-black text-slate-400  tracking-widest border-b border-slate-200">
                      <th className="p-2 ">Item</th>
                      <th className="p-2  text-right">Received Qty</th>
                      <th className="p-2  text-right">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedReceiptForView.items || []).map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 ">
                          <div className="text-xs font-black text-slate-900">{item.item_code}</div>
                          <div className="text-[10px] text-slate-500   mt-0.5 tracking-tight">{item.material_name || item.description}</div>
                        </td>
                        <td className="p-2  text-right font-black text-slate-900 text-xs">
                          {parseFloat(item.received_quantity || 0).toFixed(4)}
                        </td>
                        <td className="p-2  text-right">
                          <span className="text-[10px] font-black text-slate-400  tracking-widest bg-slate-100 px-2 py-1 rounded  border border-slate-200">
                            {item.unit || 'NOS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button 
                onClick={() => handleOpenPdfInNewTab(selectedReceiptForView)}
                className="flex items-center gap-2  p-2.5 bg-emerald-600 text-white rounded  text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                PRINT GRN
              </button>
              <button 
                onClick={() => setShowViewModal(false)}
                className="px-8 py-2.5 bg-emerald-500 text-white rounded  text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal logic remains same but with updated styling if needed */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title="Create GRN Request"
        size="6xl"
      >
        <form onSubmit={handleCreateReceipt} className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
            {/* Sidebar: Receipt Context */}
            <div className="lg:col-span-1 space-y-6 border-r border-slate-100 pr-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded  flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-800  tracking-widest">Receipt Context</h4>
                    <p className="text-[8px] text-slate-400   tracking-tighter">Link source and set date</p>
                  </div>
                </div>
                
                <FormControl label="GRN Number">
                  <input
                    type="text"
                    value={`GRN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(receipts.length + 1).padStart(4, '0')}`}
                    readOnly
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-black text-slate-900 outline-none"
                  />
                </FormControl>

                <FormControl label="Purchase Order">
                  <select
                    value={formData.poId}
                    onChange={(e) => handlePoChange(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select PO (Optional)</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} - {po.vendor_name}
                      </option>
                    ))}
                  </select>
                </FormControl>

                <FormControl label="Receipt Date *">
                  <input
                    type="date"
                    value={formData.receiptDate}
                    onChange={(e) => setFormData({...formData, receiptDate: e.target.value})}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </FormControl>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-100 rounded  flex items-center justify-center text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-800  tracking-widest">Supplier Info</h4>
                    <p className="text-[8px] text-slate-400   tracking-tighter">Verified supplier details</p>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 rounded  border border-slate-100 space-y-3 shadow-inner">
                  {formData.vendorName ? (
                    <>
                      <div>
                        <p className="text-[10px] text-slate-500 font-black  tracking-widest">Selected Supplier</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">{formData.vendorName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-black  tracking-widest">Supplier ID</p>
                        <p className="text-xs font-black text-blue-600 mt-0.5 tracking-tight">#{formData.vendorId || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm font-black text-slate-400 italic">No Supplier Linked</p>
                      <p className="text-[10px] text-slate-400 mt-1  tracking-widest font-black">Link a PO above</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content: Receipt Items */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center ">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800  tracking-tight">Receipt Items</h3>
                    <p className="text-[10px] text-slate-400   tracking-widest">Verify received quantities against PO</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="flex items-center gap-2  p-2  bg-white border border-blue-100 text-blue-600 rounded text-xs  font-black hover:bg-blue-50 transition-all  active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Add Line Item
                </button>
              </div>

              <div className="bg-white border border-slate-100 rounded-[24px] overflow-hidden ">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80">
                    <tr className="text-[10px] font-black text-slate-500  tracking-[0.2em] border-b border-slate-200">
                      <th className="p-2 ">Item Details</th>
                      <th className="px-4 py-4">Warehouse</th>
                      <th className="px-4 py-4 text-center">Design Qty</th>
                      <th className="px-4 py-4 text-center">Receiving Qty</th>
                      <th className="px-4 py-4 text-center">Rate</th>
                      <th className="px-4 py-4 text-center">Amount</th>
                      <th className="px-4 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/30 transition-all">
                        <td className="p-2 ">
                          <div className="flex flex-col">
                            {item.poId || formData.poId ? (
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-xs">{item.material_name || item.item_code || 'Select Item.'}</span>
                                <span className="text-[10px] text-slate-500   mt-0.5 tracking-tight">
                                  {item.item_code ? `Code: ${item.item_code}` : 'Manual entry item'}
                                </span>
                              </div>
                            ) : (
                              <select 
                                value={item.item_code || ''}
                                onChange={(e) => {
                                  const selectedItem = stockItems.find(it => it.item_code === e.target.value);
                                  handleItemChange(idx, 'item_code', e.target.value);
                                  if (selectedItem) {
                                    handleItemChange(idx, 'material_name', selectedItem.material_name);
                                    handleItemChange(idx, 'description', selectedItem.description);
                                    handleItemChange(idx, 'unit', selectedItem.unit_of_measure);
                                    handleItemChange(idx, 'rate', selectedItem.valuation_rate || 0);
                                  }
                                }}
                                className="bg-transparent font-black text-slate-900 text-xs w-full outline-none focus:text-blue-600 transition-colors appearance-none cursor-pointer"
                              >
                                <option value="">Select Item.</option>
                                {stockItems.map(si => (
                                  <option key={si.id} value={si.item_code}>{si.item_code} - {si.material_name}</option>
                                ))}
                              </select>
                            )}
                            <p className="text-[10px] text-slate-500  mt-0.5 truncate max-w-[150px] italic">
                              {item.description || (item.poId ? 'Fetched from PO' : 'Manual entry item')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={item.warehouse}
                            onChange={(e) => handleItemChange(idx, 'warehouse', e.target.value)}
                            className="bg-white border border-slate-200 rounded  text-xs font-black py-2 px-3 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all  min-w-[120px]"
                          >
                            {warehouses.length > 0 ? (
                              warehouses.map(w => (
                                <option key={w.id} value={w.warehouse_code}>{w.warehouse_name || w.warehouse_code}</option>
                              ))
                            ) : (
                              <option value="main">main</option>
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-4 text-center font-black text-slate-500 text-xs">
                          {Number(item.design_qty > 0 ? item.design_qty : item.quantity).toFixed(3)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              value={item.received_qty}
                              onChange={(e) => handleItemChange(idx, 'received_qty', e.target.value)}
                              className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded  text-center text-xs font-black text-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all "
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded  text-center text-xs font-black text-emerald-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all "
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-black text-slate-900 text-xs">{formatCurrency(item.amount || 0)}</span>
                            <span className="text-[9px] text-slate-400 font-normal">Incl. 18% GST: {formatCurrency((item.amount || 0) * 1.18)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded  transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {formData.items.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded  flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8" />
                    </div>
                    <p className="text-xs  text-slate-400  tracking-widest">No items linked</p>
                    <p className="text-[10px] text-slate-300 mt-1">Select a PO or add manual items</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-6 flex items-center justify-between bg-slate-50 rounded-b-[24px]">
            <div className="flex items-center gap-12">
              <div>
                <p className="text-[10px] text-slate-500 font-black  tracking-widest">Total Quantity</p>
                <p className="text-xl font-black text-slate-900">{formData.receivedQuantity || 0} <span className="text-xs text-slate-400  ml-1">Units</span></p>
              </div>
              <div className="h-10 w-[1px] bg-slate-200"></div>
              <div>
                <p className="text-[10px] text-emerald-600 font-black  tracking-widest">Total Valuation</p>
                <p className="text-xl font-black text-emerald-600">{formatCurrency(formData.totalValuation || 0)}</p>
              </div>
              <div className="h-10 w-[1px] bg-slate-200"></div>
              <div>
                <p className="text-[10px] text-indigo-600 font-black  tracking-widest">Grand Total (18% GST)</p>
                <p className="text-xl font-black text-indigo-600">{formatCurrency((formData.totalValuation || 0) * 1.18)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded  text-sm font-black hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formData.items.length === 0}
                className={`flex items-center gap-2  px-8 py-2.5 bg-blue-600 text-white rounded  text-sm font-black transition-all shadow-lg shadow-blue-200 active:scale-95 ${formData.items.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-blue-700'}`}
              >
                Create GRN Request
              </button>
            </div>
          </div>
        </form>
      </Modal>

        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit PO Receipt" size="xl">
          <form onSubmit={handleUpdateReceipt} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Receipt Date *">
                <input
                  type="date"
                  value={editFormData.receiptDate}
                  onChange={(e) => setEditFormData({...editFormData, receiptDate: e.target.value})}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </FormControl>
              <FormControl label="Status *">
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="DRAFT">Draft</option>
                  <option value="RECEIVED">Received</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </FormControl>
            </div>

            <FormControl label="Total Received Quantity">
              <input
                type="number"
                value={editFormData.receivedQuantity}
                onChange={(e) => setEditFormData({...editFormData, receivedQuantity: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-indigo-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              />
            </FormControl>

            <FormControl label="Notes (Optional)">
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                rows="3"
              />
            </FormControl>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-2.5 border border-slate-200 rounded text-xs font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="p-2.5 bg-blue-600 text-white rounded text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                Update Receipt
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  };

export default POReceipts;

