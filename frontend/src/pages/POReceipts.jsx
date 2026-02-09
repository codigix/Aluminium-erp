import { useState, useEffect } from 'react';
import { Card, DataTable, StatusBadge, Modal, FormControl } from '../components/ui.jsx';
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
        setStockItems(data || []);
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
      }
    } else {
      fetchReceipts();
      fetchStats();
      fetchPurchaseOrders();
      fetchStockItems();
      fetchWarehouses();
    }
  }, []);

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
        setPurchaseOrders(Array.isArray(data) ? data : []);
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
          const items = (detailedPO.items || []).map(item => ({
            ...item,
            item_code: item.item_code || '',
            material_name: item.material_name || item.description,
            description: item.description || '',
            quantity: item.quantity || 0,
            received_qty: item.quantity || 0,
            rate: item.unit_rate || item.rate || 0,
            amount: (item.quantity || 0) * (item.unit_rate || item.rate || 0),
            warehouse: warehouses[0]?.warehouse_code || 'main',
            unit: item.unit || 'NOS'
          }));

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
        <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 uppercase tracking-tight">#{val || 'Direct'}</span>
      )
    },
    { 
      key: 'vendor_name', 
      label: 'Supplier', 
      sortable: true,
      render: (val) => (
        <div className="flex flex-col">
          <span className="font-black text-slate-900 text-sm tracking-tight">{val}</span>
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5 tracking-tighter">Active Vendor</span>
        </div>
      )
    },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 font-bold shadow-sm inline-flex">
          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border shadow-sm ${
          val === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
          val === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          val === 'ACKNOWLEDGED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          'bg-slate-50 text-slate-700 border-slate-200'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            val === 'DRAFT' ? 'bg-amber-500' : 
            val === 'RECEIVED' ? 'bg-emerald-500' :
            val === 'ACKNOWLEDGED' ? 'bg-blue-500' :
            'bg-slate-500'
          }`} />
          <span className="uppercase tracking-tight">{val}</span>
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-50 shadow-sm active:scale-90"
            title="View Details"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button 
            onClick={() => handleOpenPdfInNewTab(row)} 
            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all border border-emerald-50 shadow-sm active:scale-90"
            title="Print GRN"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <button 
            onClick={() => handleDeleteReceipt(row.id)} 
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-rose-50 shadow-sm active:scale-90"
            title="Delete Receipt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-indigo-200 shadow-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Buying</span>
              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              <span>Procurement</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Receipts</h1>
            <p className="text-xs text-slate-500 font-medium">Process material receipts and quality inspections</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              KANBAN
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              LIST
            </button>
          </div>
          <button
            onClick={fetchReceipts}
            className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-slate-200 shadow-sm active:scale-95 bg-white"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            Create GRN
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {[
          { label: 'Total Receipts', value: stats?.total_receipts, sub: 'Total processing requests', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'blue', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
          { label: 'Pending QC', value: stats?.draft_receipts, sub: 'Awaiting initial check', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'orange', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
          { label: 'QC Review', value: stats?.qc_review_count || 0, sub: 'Quality check in progress', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'indigo', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
          { label: 'Awaiting Storage', value: stats?.awaiting_storage || 0, sub: 'Pending warehouse entry', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'blue', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
          { label: 'Completed', value: stats?.received_receipts, sub: 'Successfully stored', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'emerald', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          { label: 'Rejected', value: stats?.rejected_count || 0, sub: 'Failed quality criteria', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'rose', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.bg} border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <p className={`text-[10px] font-black ${stat.bg === 'bg-white' ? 'text-slate-500' : 'text-blue-100'} uppercase tracking-widest`}>{stat.label}</p>
                <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded-xl shadow-sm`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
                </div>
              </div>
              <p className={`text-2xl font-black ${stat.text} tracking-tight`}>{stat.value || 0}</p>
              <p className={`text-[10px] ${stat.subText} mt-1 font-black uppercase tracking-tighter opacity-80`}>{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('grn')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'grn' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            GRN Request
          </button>
          <button 
            onClick={() => setActiveTab('stocks')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'stocks' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
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
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
          />
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm font-bold text-blue-600 outline-none bg-transparent cursor-pointer"
          >
            <option value="ALL">ALL STATUS</option>
            <option value="DRAFT">DRAFT</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          </select>
        </div>

        <button className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
        </button>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
      </div>

      {/* GRN View Details Modal */}
      <Modal 
        isOpen={showViewModal} 
        onClose={() => setShowViewModal(false)}
        title={selectedReceiptForView ? `GRN Details - GRN-${String(selectedReceiptForView.id).padStart(4, '0')}` : 'GRN Details'}
        maxWidth="max-w-4xl"
      >
        {selectedReceiptForView && (
          <div className="p-8 space-y-8 bg-slate-50/30">
            {/* Header Status & Date */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</span>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase ${
                  selectedReceiptForView.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                  selectedReceiptForView.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {selectedReceiptForView.status === 'RECEIVED' ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      selectedReceiptForView.status === 'DRAFT' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                  )}
                  {selectedReceiptForView.status}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Receipt Date</span>
                <span className="text-sm font-black text-slate-900">
                  {new Date(selectedReceiptForView.receipt_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Reference & Supplier Cards */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 hover:border-indigo-100 transition-colors">
                <div className="flex items-center gap-2 text-indigo-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4a2 2 0 00-2-2H9a2 2 0 00-2 2v10" /></svg>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PO Reference</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <span className="text-sm font-black text-slate-900 uppercase tracking-tight">#{selectedReceiptForView.po_number || 'Direct'}</span>
                </div>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 hover:border-blue-100 transition-colors">
                <div className="flex items-center gap-2 text-blue-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
                  </div>
                  <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedReceiptForView.vendor_name}</span>
                </div>
              </div>
            </div>

            {/* Received Items Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Received Items</h4>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4 text-right">Received Qty</th>
                      <th className="px-6 py-4 text-right">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedReceiptForView.items || []).map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-xs font-black text-slate-900">{item.item_code}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 tracking-tight">{item.material_name || item.description}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 text-xs">
                          {parseFloat(item.received_quantity || 0).toFixed(4)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
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
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                PRINT GRN
              </button>
              <button 
                onClick={() => setShowViewModal(false)}
                className="px-8 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
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
        maxWidth="max-w-6xl"
      >
        <form onSubmit={handleCreateReceipt} className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-y-auto max-h-[70vh]">
            {/* Sidebar: Receipt Context */}
            <div className="lg:col-span-1 space-y-6 border-r border-slate-100 pr-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Receipt Context</h4>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Link source and set date</p>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">GRN Number</label>
                  <input
                    type="text"
                    value={`GRN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(receipts.length + 1).padStart(4, '0')}`}
                    readOnly
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Purchase Order</label>
                  <select
                    value={formData.poId}
                    onChange={(e) => handlePoChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="">Select PO (Optional)</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.po_number} - {po.vendor_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Receipt Date</label>
                  <input
                    type="date"
                    value={formData.receiptDate}
                    onChange={(e) => setFormData({...formData, receiptDate: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Supplier Info</h4>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Verified supplier details</p>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 shadow-inner">
                  {formData.vendorName ? (
                    <>
                      <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Selected Supplier</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">{formData.vendorName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Supplier ID</p>
                        <p className="text-xs font-black text-blue-600 mt-0.5 tracking-tight">#{formData.vendorId || 'N/A'}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm font-black text-slate-400 italic">No Supplier Linked</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">Link a PO above</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content: Receipt Items */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Receipt Items</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verify received quantities against PO</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-100 text-blue-600 rounded-xl text-[10px] font-black hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  Add Line Item
                </button>
              </div>

              <div className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80">
                    <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200">
                      <th className="px-6 py-4">Item Details</th>
                      <th className="px-4 py-4">Warehouse</th>
                      <th className="px-4 py-4 text-center">PO Qty</th>
                      <th className="px-4 py-4 text-center">Received</th>
                      <th className="px-4 py-4 text-center">Rate</th>
                      <th className="px-4 py-4 text-center">Total</th>
                      <th className="px-4 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/30 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            {item.poId || formData.poId ? (
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-xs">{item.material_name || item.item_code || 'Select Item.'}</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 tracking-tight">
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
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate max-w-[150px] italic">
                              {item.description || (item.poId ? 'Fetched from PO' : 'Manual entry item')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={item.warehouse}
                            onChange={(e) => handleItemChange(idx, 'warehouse', e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl text-xs font-black py-2 px-3 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm min-w-[120px]"
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
                        <td className="px-4 py-4 text-center font-black text-slate-500 text-xs">{item.quantity || 0}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              value={item.received_qty}
                              onChange={(e) => handleItemChange(idx, 'received_qty', e.target.value)}
                              className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-black text-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                           <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-black text-slate-900 focus:border-blue-500 outline-none transition-all shadow-sm"
                            />
                        </td>
                        <td className="px-4 py-4 text-center font-black text-slate-900 text-xs">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {formData.items.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No items linked</p>
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
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Quantity</p>
                <p className="text-xl font-black text-slate-900">{formData.receivedQuantity || 0} <span className="text-xs text-slate-400 font-medium ml-1">Units</span></p>
              </div>
              <div className="border-l border-slate-200 pl-8">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Valuation</p>
                <p className="text-xl font-black text-blue-600">{formatCurrency(formData.totalValuation)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formData.items.length === 0}
                className={`flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-200 active:scale-95 ${formData.items.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-blue-700'}`}
              >
                Create GRN Request
              </button>
            </div>
          </div>
        </form>
      </Modal>

        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit PO Receipt">
          <form onSubmit={handleUpdateReceipt} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl label="Receipt Date *">
                <input
                  type="date"
                  value={editFormData.receiptDate}
                  onChange={(e) => setEditFormData({...editFormData, receiptDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                />
              </FormControl>
              <FormControl label="Status *">
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  required
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm  text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </FormControl>

            <FormControl label="Notes (Optional)">
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                rows="3"
              />
            </FormControl>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm  text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
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

